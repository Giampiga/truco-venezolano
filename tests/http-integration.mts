import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../lib/room-model.ts';
import { client, origin } from './http-client.mts';
const a = client(),
  b = client(),
  c = client(),
  d = client(),
  stranger = client();
for (const user of [a, b, c, d, stranger]) await user('/api/rooms');
for (const format of ['1v1', '2v2'] as const) {
  let room = await a(
    '/api/rooms',
    {
      config: {
        ...DEFAULT_CONFIG,
        format,
        target: '12',
        ranked: format === '1v1',
        isPrivate: format === '1v1',
      },
      name: 'Ana',
    },
    201,
  );
  const path = `/api/rooms/${room.id}`;
  await stranger(path, undefined, 403);
  await stranger(path + '/voice', {}, 403);
  const publicRooms = await stranger('/api/rooms');
  assert.equal(
    publicRooms.rooms.some((item: { id: string }) => item.id === room.id),
    format === '2v2',
  );
  await b(`/api/rooms/${room.code}`, { type: 'join', name: 'Luis' });
  if (format === '2v2') {
    await c(path, { type: 'join', name: 'Luna' });
    await d(path, { type: 'join', name: 'José' });
  }
  const players = format === '1v1' ? [a, b] : [a, b, c, d];
  await stranger(path, { type: 'join', name: 'Quinto' }, 409);
  await b(path, { type: 'start' }, 403);
  await a(path, { type: 'start' }, 400);
  // Concurrent CAS writes must all survive.
  await Promise.all(
    players.map((user) => user(path, { type: 'ready', ready: true })),
  );
  room = await a(path);
  assert.ok(room.members.every((member: { ready: boolean }) => member.ready));
  await a(path, {
    type: 'chat',
    text: '¡Buena partida!',
    id: crypto.randomUUID(),
  });
  assert.equal((await b(path)).messages[0].text, '¡Buena partida!');
  await a(path + '/voice', {}, 503);
  room = await a(path, { type: 'start' });
  const views = await Promise.all(players.map((user) => user(path)));
  for (const view of views) {
    assert.equal(view.game.private.hand.length, 3);
    assert.equal('hands' in view.game.public, false);
    assert.equal('engine' in view, false);
  }
  const card = room.game.private.hand[0];
  await a(
    path,
    {
      type: 'command',
      id: 'stale',
      gameVersion: -1,
      command: { type: 'PLAY_CARD', cardId: `${card.rank}-${card.suit}` },
    },
    409,
  );
  // Exercise real legal moves and calls through a full server-authoritative match.
  let moves = 0;
  while (!room.game.public.match.complete && moves++ < 500) {
    const state = room.game.public;
    if (state.handComplete) {
      room = await a(path, { type: 'next', gameVersion: state.gameVersion });
      continue;
    }
    let acted = false;
    for (const user of players) {
      const view = await user(path);
      const legal = view.game.legal;
      const hand = view.game.private.hand;
      let command;
      if (legal.includes('answer-no-quiero'))
        command = { type: 'ANSWER_CALL', answer: 'no-quiero' };
      else if (legal.includes('play-stack')) command = { type: 'FOLD_HAND' };
      else if (legal.includes('play-card'))
        command = {
          type: 'PLAY_CARD',
          cardId: `${hand[0].rank}-${hand[0].suit}`,
        };
      if (command) {
        room = await user(path, {
          type: 'command',
          gameVersion: view.game.public.gameVersion,
          id: crypto.randomUUID(),
          command,
        });
        acted = true;
        break;
      }
    }
    assert.ok(acted, 'Every nonterminal state must progress');
    if (moves % 10 === 0)
      await Promise.all(
        players.map((user) => user(path, { type: 'heartbeat' })),
      );
  }
  assert.ok(room.game.public.match.complete, 'Match must reach target');
  if (format === '1v1') {
    const ra = await a('/api/ranking?format=1v1');
    const rb = await b('/api/ranking?format=1v1');
    assert.equal(ra.you.games, 1);
    assert.equal(rb.you.games, 1);
    assert.equal(ra.you.rating + rb.you.rating, 2000);
    assert.equal(ra.history.length, 1);
  }
  const profile = await a('/api/profile');
  const saved = profile.history.matches.find(
    (m: { room_id: string }) => m.room_id === room.id,
  );
  assert.ok(saved, 'Finished match is in the durable profile history');
  assert.equal(saved.mode, format === '1v1' ? 'ranked' : 'casual');
  assert.ok(saved.opponents && saved.score);
  assert.equal(JSON.stringify(profile).includes('user_id'), false);
  room = await a(path, { type: 'close' });
  assert.equal((await b(path, { type: 'heartbeat' })).closed, true);
  console.log(
    `${format}: complete match in ${moves} moves; membership, private hands, CAS, chat, voice authorization, closure passed.`,
  );
}
const csrf = await fetch(origin + '/api/rooms', {
  method: 'POST',
  headers: {
    Origin: 'https://other.example',
    'Content-Type': 'application/json',
  },
  body: '{}',
});
assert.equal(csrf.status, 403);
console.log(
  'Cross-origin writes rejected. All HTTP integration checks passed.',
);
