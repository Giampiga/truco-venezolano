import assert from 'node:assert/strict';
import { client } from './http-client.mts';
const a = client(),
  b = client();
await a('/api/chat');
await b('/api/chat');
const handle = 'chat_' + crypto.randomUUID().slice(0, 8);
await a('/api/profile', { type: 'save', handle, name: 'Ana', bio: '' });
const id = crypto.randomUUID();
await a('/api/chat', {
  id,
  name: 'Fake',
  handle: 'fake',
  text: 'Hola desde mi perfil',
});
await a('/api/chat', { id, name: 'Fake', text: 'Hola desde mi perfil' });
await a(
  '/api/chat',
  { id: crypto.randomUUID(), name: 'Ana', text: 'Too fast' },
  429,
);
await b('/api/chat', {
  id: crypto.randomUUID(),
  name: 'Temporal',
  handle,
  verified: true,
  text: 'Hola temporal',
});
const { messages } = await b('/api/chat');
const registered = messages.findLast(
  (m: { handle: string | null }) => m.handle === handle,
);
assert.equal(registered.author, 'Ana');
assert.equal(registered.own, false);
assert.equal(typeof registered.id, 'number');
assert.equal('user_id' in registered, false);
const temp = messages.findLast((m: { own: boolean }) => m.own);
assert.equal(temp.handle, null);
assert.equal(temp.author, 'Temporal');
await b(
  '/api/chat',
  { id: crypto.randomUUID(), name: 'Temporal', text: 'x'.repeat(301) },
  400,
);
await b(
  '/api/chat',
  { id: crypto.randomUUID(), name: 'Temporal', text: '  ' },
  400,
);
console.log(
  'Global chat: delivery across users, trusted profile labels, no private IDs, deduplication, rate and length limits passed.',
);
