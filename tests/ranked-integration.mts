import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../lib/room-model.ts';
const origin = process.env.TRUCO_TEST_URL ?? 'http://localhost:3012';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
function client() {
  let cookie = '';
  return async (path: string, payload?: unknown, status = 200) => {
    const response = await fetch(origin + path, {
      method: payload ? 'POST' : 'GET',
      headers: {
        Cookie: cookie,
        Origin: origin,
        'Content-Type': 'application/json',
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    cookie = response.headers.get('set-cookie')?.split(';')[0] ?? cookie;
    const data: any = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    return data;
  };
}
const [a, b, c, d, outsider] = Array.from({ length: 5 }, client);
for (const user of [a, b, c, d, outsider]) await user('/api/rooms');
for (const format of ['1v1', '2v2'] as const) {
  const players = format === '1v1' ? [a, b] : [a, b, c, d];
  const room = await a(
    '/api/rooms',
    {
      name: 'Ana',
      config: {
        ...DEFAULT_CONFIG,
        format,
        ranked: true,
        camera: true,
        target: '12',
        flor: 'off',
      },
    },
    201,
  );
  assert.equal(room.config.target, '24');
  assert.equal(room.config.flor, 'a-ley');
  const path = `/api/rooms/${room.id}`;
  for (const [i, user] of players.entries()) {
    if (i) await user(path, { type: 'join', name: `Player ${i}` });
    await user(path, { type: 'ready', ready: true });
  }
  await a(path, { type: 'start' });
  await outsider(path + '/voice', {}, 403);
  await a(path, { type: 'close' }, 400);
  await b(path, { type: 'claim-forfeit' }, 409);
  // The first departure ends the match; concurrent departures must not settle twice.
  await Promise.all([
    a(path, { type: 'leave' }),
    b(path, { type: 'heartbeat' }),
  ]);
  await Promise.all(Array.from({ length: 8 }, () => b(path)));
  const results = await Promise.all(
    players.map((u) => u(`/api/ranking?format=${format}`)),
  );
  for (let i = 0; i < results.length; i++) {
    assert.equal(results[i].you.games, 1);
    assert.equal(results[i].you.rating, i % 2 ? 1016 : 984);
    assert.equal(results[i].history.length, 1);
    assert.equal(results[i].history[0].delta, i % 2 ? 16 : -16);
    assert.equal(JSON.stringify(results[i]).includes('userId'), false);
  }
  const profile = await b('/api/profile?mode=ranked');
  assert.equal(profile.ratings.find((r: any) => r.format === format).peak, 1016);
  assert.ok(profile.history.matches.some((m: any) => m.room_id === room.id && m.won));
  assert.equal((await outsider('/api/profile')).history.matches.length, 0);
  await b(path, { type: 'close' });
  console.log(
    `${format}: authenticated accounts, fixed rules, forfeit, atomic Elo, repeat settlement and private history passed.`,
  );
}
console.log('Competitive integration passed.');

const parallel = await Promise.all(
  [1, 2].map(async () => {
    const room = await a(
      '/api/rooms',
      {
        name: 'Ana',
        config: { ...DEFAULT_CONFIG, format: '1v1', ranked: true },
      },
      201,
    );
    const path = `/api/rooms/${room.id}`;
    await b(path, { type: 'join', name: 'Luis' });
    await a(path, { type: 'ready', ready: true });
    await b(path, { type: 'ready', ready: true });
    await a(path, { type: 'start' });
    return path;
  }),
);
await Promise.all(parallel.map((path) => a(path, { type: 'leave' })));
const ra = await a('/api/ranking?format=1v1');
const rb = await b('/api/ranking?format=1v1');
assert.equal(ra.you.games, 2);
assert.equal(rb.you.games, 2);
assert.equal(ra.you.rating + rb.you.rating, 2000);
assert.equal(ra.history.length, 3);
await Promise.all(parallel.map((path) => b(path, { type: 'close' })));
console.log(
  'Concurrent results for the same accounts preserve all rating updates.',
);
