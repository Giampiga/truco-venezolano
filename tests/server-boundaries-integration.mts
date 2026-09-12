import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../lib/room-model.ts';

const origin = process.env.TRUCO_TEST_URL ?? 'http://localhost:3013';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
function client() {
  let cookie = '';
  return async (path: string, payload?: unknown) => {
    const response = await fetch(origin + path, {
      method: payload === undefined ? 'GET' : 'POST',
      headers: {
        Cookie: cookie,
        Origin: origin,
        'Content-Type': 'application/json',
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    cookie = response.headers.get('set-cookie')?.split(';')[0] ?? cookie;
    return { status: response.status, data: await response.json() };
  };
}
const owner = client();
assert.equal((await owner('/api/profile')).status, 200);
const created = await Promise.all(
  Array.from({ length: 8 }, () =>
    owner('/api/rooms', { name: 'Auditor', config: DEFAULT_CONFIG }),
  ),
);
assert.equal(
  created.filter((r) => r.status === 201).length,
  3,
  'Concurrent creation obeys the room limit',
);
assert.ok(created.every((r) => [201, 429].includes(r.status)));
const rooms = created.filter((r) => r.status === 201).map((r) => r.data);
try {
  for (const invalid of [null, false, 42, [], {}])
    assert.equal(
      (await owner(`/api/rooms/${rooms[0].id}`, invalid)).status,
      400,
    );
} finally {
  for (const room of rooms)
    assert.equal(
      (await owner(`/api/rooms/${room.id}`, { type: 'close' })).status,
      200,
    );
}
console.log('Concurrent room limits and malformed action validation passed.');

const text = `Concurrent message ${crypto.randomUUID()}`;
const message = { id: crypto.randomUUID(), name: 'Auditor', text };
const sent = await Promise.all(
  Array.from({ length: 8 }, () => owner('/api/chat', message)),
);
assert.ok(
  sent.every((r) => r.status === 200),
  'Concurrent delivery retries are idempotent',
);
assert.equal(
  (await owner('/api/chat')).data.messages.filter(
    (m: { message: string }) => m.message === text,
  ).length,
  1,
);
assert.equal(
  (await owner('/api/chat', { ...message, id: crypto.randomUUID() })).status,
  429,
);
console.log(
  'Concurrent chat retries save one message and preserve the rate limit.',
);

// Exercise the actual 200-relationship limit through the API, including incoming requests.
const suffix = crypto.randomUUID().slice(0, 8);
const recipient = client();
const handle = `limit_${suffix}`;
assert.equal(
  (
    await recipient('/api/profile', {
      type: 'save',
      handle,
      name: 'Recipient',
      bio: '',
    })
  ).status,
  200,
);
const senders = Array.from({ length: 201 }, () => client());
for (let start = 0; start < senders.length; start += 20) {
  const results = await Promise.all(
    senders.slice(start, start + 20).map((sender, i) =>
      sender('/api/profile', {
        type: 'save',
        handle: `s${start + i}_${suffix}`,
        name: 'Sender',
        bio: '',
      }),
    ),
  );
  assert.ok(results.every((r) => r.status === 200));
}
try {
  for (const sender of senders.slice(0, 199))
    assert.equal(
      (await sender('/api/profile', { type: 'request', handle })).status,
      200,
    );
  const last = await Promise.all(
    senders
      .slice(199)
      .map((sender) => sender('/api/profile', { type: 'request', handle })),
  );
  assert.deepEqual(
    last.map((r) => r.status).sort((a, b) => a - b),
    [200, 429],
    'Only one concurrent request can take the final slot',
  );
  assert.equal((await recipient('/api/profile')).data.friends.length, 200);
  assert.equal(
    (await senders[0]('/api/profile', { type: 'request', handle })).status,
    200,
    'Repeated requests remain idempotent at the limit',
  );
  const rejected = 199 + last.findIndex((r) => r.status === 429);
  assert.equal(
    (
      await recipient('/api/profile', {
        type: 'request',
        handle: `s${rejected}_${suffix}`,
      })
    ).status,
    429,
    'Outgoing requests obey the same total limit',
  );
  assert.equal(
    (await senders[0]('/api/profile', { type: 'remove', handle })).status,
    200,
  );
  assert.equal(
    (await senders[rejected]('/api/profile', { type: 'request', handle }))
      .status,
    200,
    'Removing a relationship releases capacity',
  );
} finally {
  for (let start = 0; start < senders.length; start += 20)
    await Promise.all(
      senders
        .slice(start, start + 20)
        .map((sender) => sender('/api/profile', { type: 'remove', handle })),
    );
}
console.log(
  'Sender/recipient friendship caps, final-slot concurrency, duplicate requests and released capacity passed.',
);
