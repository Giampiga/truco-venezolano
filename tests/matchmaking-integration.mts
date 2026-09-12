import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../lib/room-model.ts';
import { client } from './http-client.mts';
for (const format of ['1v1', '2v2'] as const) {
  const users = Array.from({ length: format === '1v1' ? 2 : 4 }, client);
  for (const user of users) await user('/api/rooms');
  await Promise.all(
    users.map((user, i) =>
      user('/api/matchmaking', { type: 'join', format, name: `Player ${i}` }),
    ),
  );
  const states = await Promise.all(
    users.map((user) => user('/api/matchmaking', { type: 'poll' })),
  );
  assert.ok(states.every((s) => s.status === 'matched'));
  assert.equal(new Set(states.map((s) => s.room.id)).size, 1);
  const room = states[0].room;
  assert.equal(room.members.length, users.length);
  assert.equal(room.config.ranked, true);
  assert.equal(room.config.target, '24');
  assert.equal(
    (await users[0]('/api/matchmaking', { type: 'cancel' })).room.id,
    room.id,
  );
  const path = `/api/rooms/${room.id}`;
  for (const user of users) await user(path, { type: 'ready', ready: true });
  const host = users[states.findIndex((s) => s.room.you === room.host)];
  await host(path, { type: 'start' });
  await users[0](path, { type: 'leave' });
  for (const user of users)
    assert.equal((await user(`/api/ranking?format=${format}`)).you.games, 1);
  for (const user of users)
    assert.equal((await user('/api/matchmaking')).status, 'idle');
  console.log(
    `${format}: concurrent pairing produces one room, ready/start/forfeit awards Elo, completed assignments release.`,
  );
}
const cancel = client();
await cancel('/api/rooms');
assert.equal(
  (
    await cancel('/api/matchmaking', {
      type: 'join',
      format: '1v1',
      name: 'Cancel',
    })
  ).status,
  'searching',
);
assert.equal(
  (await cancel('/api/matchmaking', { type: 'cancel' })).status,
  'idle',
);
assert.equal(
  (await cancel('/api/matchmaking', { type: 'poll' })).status,
  'idle',
);
await cancel(
  '/api/matchmaking',
  { type: 'join', format: 'invalid', name: 'Test' },
  400,
);

const a = client(),
  b = client();
await a('/api/rooms');
await b('/api/rooms');
async function match() {
  const room = await a(
    '/api/rooms',
    {
      name: 'Repeated A',
      config: { ...DEFAULT_CONFIG, format: '1v1', ranked: true },
    },
    201,
  );
  const path = `/api/rooms/${room.id}`;
  await b(path, { type: 'join', name: 'Repeated B' });
  for (const user of [a, b]) await user(path, { type: 'ready', ready: true });
  await a(path, { type: 'start' });
  return path;
}
for (let i = 0; i < 2; i++) {
  const path = await match();
  await a(path, { type: 'leave' });
  await b(path, { type: 'close' });
}
const concurrent = await Promise.all([match(), match()]);
await Promise.all(concurrent.map((path) => a(path, { type: 'leave' })));
const ra = await a('/api/ranking?format=1v1');
const rb = await b('/api/ranking?format=1v1');
assert.equal(ra.you.games, 3);
assert.equal(rb.you.games, 3);
assert.equal(ra.history.length, 4);
assert.equal(ra.history.filter((r: { rated: boolean }) => !r.rated).length, 1);
assert.equal(ra.you.rating + rb.you.rating, 2000);
await a('/api/matchmaking', {
  type: 'join',
  format: '1v1',
  name: 'Repeated A',
});
assert.equal(
  (
    await b('/api/matchmaking', {
      type: 'join',
      format: '1v1',
      name: 'Repeated B',
    })
  ).status,
  'searching',
);
assert.equal(
  (await a('/api/matchmaking', { type: 'poll' })).status,
  'searching',
);
for (const user of [a, b]) await user('/api/matchmaking', { type: 'cancel' });
for (const path of concurrent) await b(path, { type: 'close' });
console.log(
  'Cancel, input validation, concurrent third-match cap, unrated history and exhausted-opponent exclusion passed.',
);
