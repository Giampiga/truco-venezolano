import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../lib/room-model.ts';
import { client } from './http-client.mts';
const a = client(),
  b = client(),
  c = client();
const suffix = crypto.randomUUID().slice(0, 8);
const ha = `ana_${suffix}`,
  hb = `luis_${suffix}`;
assert.equal((await a('/api/profile')).me, null);
await b('/api/profile');
await c('/api/profile');
await a('/api/profile', {
  type: 'save',
  handle: ha,
  name: 'Ana',
  bio: 'Me gusta el truco.',
});
await b(
  '/api/profile',
  { type: 'save', handle: ha, name: 'Impostor', bio: '' },
  409,
);
await b('/api/profile', { type: 'save', handle: hb, name: 'Luis', bio: '' });
assert.equal((await a('/api/profile')).me.handle, ha);
await a('/api/profile', { type: 'request', handle: hb });
await a('/api/profile', { type: 'accept', handle: hb }, 409);
await b('/api/profile', { type: 'accept', handle: ha });
assert.equal((await a('/api/profile')).friends[0].status, 'accepted');
await c('/api/profile', { type: 'remove', handle: ha }, 400);
const room = await a(
  '/api/rooms',
  { name: 'Temporary override', config: DEFAULT_CONFIG },
  201,
);
assert.equal(room.members[0].handle, ha);
assert.equal(room.members[0].name, 'Ana');
await c(`/api/rooms/${room.id}`, {
  type: 'join',
  name: 'Invitado',
  handle: ha,
});
const joined = await c(`/api/rooms/${room.id}`);
assert.equal(
  joined.members.find((m: { seatId: string }) => m.seatId === joined.you)
    .handle,
  undefined,
);
const chatted = await a(`/api/rooms/${room.id}`, {
  type: 'chat',
  id: crypto.randomUUID(),
  text: 'Hola',
});
assert.equal(chatted.messages[0].handle, ha);
await b('/api/profile', { type: 'remove', handle: ha });
assert.equal((await a('/api/profile')).friends.length, 0);
await a(`/api/rooms/${room.id}`, { type: 'close' });
console.log(
  'Profiles persist; unique handles, friendship authorization, server-controlled room/chat labels passed.',
);
