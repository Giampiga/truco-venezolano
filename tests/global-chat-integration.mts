import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../lib/room-model.ts';
const origin = process.env.TRUCO_TEST_URL ?? 'http://localhost:3012';
assert.ok(
  new URL(origin).hostname === 'localhost' ||
    new URL(origin).hostname === '127.0.0.1',
  'Integration suite is restricted to a local server.',
);
function client() {
  let cookie = '';
  return async (path: string, payload?: unknown, status = 200) => {
    const response = await fetch(origin + path, {
      method: payload ? 'POST' : 'GET',
      headers: {
        ...(payload
          ? { 'Content-Type': 'application/json', Origin: origin }
          : {}),
        Cookie: cookie,
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (response.headers.get('set-cookie'))
      cookie = response.headers.get('set-cookie')!.split(';')[0];
    const data: any = await response.json();
    assert.equal(response.status, status, `${path}: ${JSON.stringify(data)}`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return data;
  };
}
const a=client(), b=client();
await a('/api/chat');await b('/api/chat');
const handle='chat_'+crypto.randomUUID().slice(0,8);
await a('/api/profile', {type:'save',handle,name:'Ana',bio:''});
const id=crypto.randomUUID();
await a('/api/chat', {id,name:'Fake',handle:'fake',text:'Hola desde mi perfil'});
await a('/api/chat', {id,name:'Fake',text:'Hola desde mi perfil'});
await a('/api/chat', {id:crypto.randomUUID(),name:'Ana',text:'Too fast'},429);
await b('/api/chat', {id:crypto.randomUUID(),name:'Temporal',handle,verified:true,text:'Hola temporal'});
const {messages}=await b('/api/chat');
const registered=messages.findLast((m:any)=>m.handle===handle);
assert.equal(registered.author,'Ana'); assert.equal(registered.own,false);
assert.equal(typeof registered.id,'number');assert.equal('user_id' in registered,false);
const temp=messages.findLast((m:any)=>m.own);
assert.equal(temp.handle,null);assert.equal(temp.author,'Temporal');
await b('/api/chat',{id:crypto.randomUUID(),name:'Temporal',text:'x'.repeat(301)},400);
await b('/api/chat',{id:crypto.randomUUID(),name:'Temporal',text:'  '},400);
console.log('Global chat: delivery across users, trusted profile labels, no private IDs, deduplication, rate and length limits passed.');
