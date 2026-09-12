import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../lib/room-model.ts';
const origin = process.env.TRUCO_TEST_URL ?? 'http://localhost:3013';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
let cookie = '';
async function guest(path: string, payload?: unknown, status = 200) {
  const response = await fetch(origin + path, {
    method: payload ? 'POST' : 'GET',
    headers: {
      Cookie: cookie,
      Origin: origin,
      'Content-Type': 'application/json',
      'x-truco-test-guest': '1',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  cookie = response.headers.get('set-cookie')?.split(';')[0] ?? cookie;
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
}
assert.equal((await guest('/api/account')).registered, false);
await guest('/api/profile', undefined, 403);
await guest(
  '/api/profile',
  { type: 'save', name: 'Spoof', handle: 'spoof', bio: '' },
  403,
);
await guest(
  '/api/matchmaking',
  { type: 'join', format: '1v1', name: 'Invitado' },
  403,
);
await guest(
  '/api/rooms',
  { name: 'Invitado', config: { ...DEFAULT_CONFIG, ranked: true } },
  403,
);
const casual = await guest(
  '/api/rooms',
  { name: 'Invitado', config: DEFAULT_CONFIG },
  201,
);
assert.equal(casual.config.ranked, false);
const auth = await fetch(origin + '/api/account');
const registeredCookie = auth.headers.get('set-cookie')!.split(';')[0];
const created = await fetch(origin + '/api/rooms', {
  method: 'POST',
  headers: {
    Cookie: registeredCookie,
    Origin: origin,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Registrado',
    config: { ...DEFAULT_CONFIG, ranked: true },
  }),
});
assert.equal(created.status, 201);
const ranked = await created.json();
await guest('/api/rooms/' + ranked.id, { type: 'join', name: 'Invitado' }, 403);
await guest('/api/rooms/' + casual.id, { type: 'close' });
console.log(
  'Guests can create casual rooms; server rejects profile writes, matchmaking, ranked creation and ranked joins.',
);
