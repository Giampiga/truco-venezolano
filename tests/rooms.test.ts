import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyRoomAction,
  DEFAULT_CONFIG,
  newRoom,
  projectRoom,
  validateConfig,
} from '../lib/room-model.ts';
import { validateCommand } from '../lib/command-validation.ts';

const clock = 1_000_000;
const create = () =>
  newRoom(
    'room-1',
    'ABC234',
    'owner',
    'Ana',
    { ...DEFAULT_CONFIG, format: '1v1' },
    clock,
  );
function readyRoom() {
  let room = create();
  room = applyRoomAction(room, 'rival', { type: 'join', name: 'Luis' }, clock);
  room = applyRoomAction(room, 'owner', { type: 'ready', ready: true }, clock);
  return applyRoomAction(room, 'rival', { type: 'ready', ready: true }, clock);
}
void test('private room data requires membership and omits account identifiers', () => {
  const room = create();
  assert.throws(() => projectRoom(room, 'outsider'));
  const view = projectRoom(room, 'owner');
  assert.equal(view.you, 'p0');
  assert.equal(JSON.stringify(view).includes('userId'), false);
  assert.equal(JSON.stringify(view).includes('owner'), false);
});
void test('only host can start; all seats must be ready and present', () => {
  assert.throws(() =>
    applyRoomAction(create(), 'owner', { type: 'start' }, clock),
  );
  assert.throws(() =>
    applyRoomAction(readyRoom(), 'rival', { type: 'start' }, clock),
  );
  assert.throws(() =>
    applyRoomAction(readyRoom(), 'owner', { type: 'start' }, clock + 50_000),
  );
  assert.ok(
    applyRoomAction(readyRoom(), 'owner', { type: 'start' }, clock).engine,
  );
});
void test('full room rejects additional seats and joining is idempotent', () => {
  const room = readyRoom();
  assert.throws(() =>
    applyRoomAction(room, 'third', { type: 'join', name: 'Inés' }, clock),
  );
  assert.equal(
    applyRoomAction(room, 'rival', { type: 'join', name: 'Luis' }, clock)
      .members.length,
    2,
  );
});
void test('both game projections expose only the requesting hand', () => {
  const room = applyRoomAction(readyRoom(), 'owner', { type: 'start' }, clock);
  for (const user of ['owner', 'rival']) {
    const view = projectRoom(room, user);
    assert.equal(view.game!.private.hand.length, 3);
    assert.equal('hands' in view.game!.public, false);
    assert.equal('dealtHands' in view.game!.public, false);
    assert.equal(view.game!.private.seatId, view.you);
  }
});
void test('stale and out-of-turn moves reject; repeated command cannot play twice', () => {
  const room = applyRoomAction(readyRoom(), 'owner', { type: 'start' }, clock);
  const first = room.engine!.activeSeatId;
  const user = room.members.find((m) => m.seatId === first)!.userId;
  const card = room.engine!.hands[first][0];
  const action = {
    type: 'command' as const,
    gameVersion: room.engine!.gameVersion,
    id: 'one',
    command: {
      type: 'PLAY_CARD' as const,
      cardId: `${card.rank}-${card.suit}`,
    },
  };
  assert.throws(() =>
    applyRoomAction(room, user, { ...action, gameVersion: -1 }, clock),
  );
  assert.throws(() =>
    applyRoomAction(room, user === 'owner' ? 'rival' : 'owner', action, clock),
  );
  const next = applyRoomAction(room, user, action, clock);
  assert.equal(applyRoomAction(next, user, action, clock), next);
  assert.equal(next.engine!.hands[first].length, 2);
});
void test('chat is membership-only, bounded, rate limited and idempotent', () => {
  const room = readyRoom();
  assert.throws(() =>
    applyRoomAction(
      room,
      'stranger',
      { type: 'chat', text: 'x', id: 'a' },
      clock,
    ),
  );
  const next = applyRoomAction(
    room,
    'owner',
    { type: 'chat', text: 'Hola'.repeat(100), id: 'a' },
    clock,
  );
  assert.equal(next.messages[0].text.length, 300);
  assert.equal(
    applyRoomAction(
      next,
      'owner',
      { type: 'chat', text: 'Hola', id: 'a' },
      clock,
    ),
    next,
  );
  assert.throws(() =>
    applyRoomAction(
      next,
      'owner',
      { type: 'chat', text: 'Otra', id: 'b' },
      clock + 100,
    ),
  );
});
void test('leaving a waiting room transfers hosting and reuses vacant seats', () => {
  let room = applyRoomAction(readyRoom(), 'owner', { type: 'leave' }, clock);
  assert.equal(room.hostId, 'rival');
  room = applyRoomAction(room, 'new', { type: 'join', name: 'José' }, clock);
  assert.equal(room.members.find((m) => m.userId === 'new')!.seatId, 'p0');
});
void test('disconnect preserves a played game; rejoin restores the same seat', () => {
  let room = applyRoomAction(readyRoom(), 'owner', { type: 'start' }, clock);
  const version = room.engine!.gameVersion;
  room = applyRoomAction(room, 'rival', { type: 'leave' }, clock);
  assert.throws(() => projectRoom(room, 'rival'));
  room = applyRoomAction(room, 'rival', { type: 'join', name: 'Luis' }, clock);
  assert.equal(projectRoom(room, 'rival').you, 'p1');
  assert.equal(room.engine!.gameVersion, version);
});
void test('closed room propagates through polling and denies further actions', () => {
  const room = applyRoomAction(readyRoom(), 'owner', { type: 'close' }, clock);
  assert.equal(
    applyRoomAction(room, 'rival', { type: 'heartbeat' }, clock).closed,
    true,
  );
  assert.throws(() =>
    applyRoomAction(room, 'rival', { type: 'ready', ready: true }, clock),
  );
});
void test('runtime schema rejects malformed commands and negative wagers', () => {
  for (const input of [
    null,
    {},
    { type: 'FOLD' },
    { type: 'RAISE_ENVIDO', amount: -4 },
    { type: 'RAISE_ENVIDO', amount: 1.5 },
    { type: 'PLAY_CARD', cardId: '999-oros' },
    { type: 'PLAY_STACK', cardIds: ['1-oros', '1-oros'] },
    { type: 'CALL_TRUCO', call: 'none' },
    { type: 'ANSWER_CALL', answer: 'yes' },
  ])
    assert.throws(() => validateCommand(input));
  assert.deepEqual(
    validateCommand({ type: 'FOLD_HAND', actor: 'someone-else' }),
    { type: 'FOLD_HAND' },
  );
});
void test('server accepts only supported room settings and clears staged options', () => {
  assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, target: '999' }));
  const config = validateConfig({
    ...DEFAULT_CONFIG,
    truco: 'abierto',
    privando: true,
    opponent: 'ai',
  });
  assert.equal(config.opponent, 'human');
  assert.equal(config.privando, false);
  assert.equal(config.truco, 'cerrado');
});

void test('ranked configuration is standardized and camera requires voice', () => {
  const config = validateConfig({
    ...DEFAULT_CONFIG,
    ranked: true,
    target: '12',
    match: 'mejor-de-tres',
    flor: 'off',
    camera: true,
    voice: false,
  });
  assert.equal(config.target, '24');
  assert.equal(config.match, 'un-chico');
  assert.equal(config.flor, 'a-ley');
  assert.equal(config.camera, false);
  assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, ranked: 'true' }));
});

void test('ranked departure forfeits once; active matches cannot be closed or claimed early', () => {
  let room = readyRoom();
  room.config.ranked = true;
  room = applyRoomAction(room, 'owner', { type: 'start' }, clock);
  assert.throws(() => applyRoomAction(room, 'owner', { type: 'close' }, clock));
  assert.throws(() =>
    applyRoomAction(room, 'owner', { type: 'claim-forfeit' }, clock + 119_999),
  );
  const claimed = applyRoomAction(
    room,
    'owner',
    { type: 'claim-forfeit' },
    clock + 120_000,
  );
  assert.equal(claimed.engine!.match.winner, 'A');
  const left = applyRoomAction(room, 'owner', { type: 'leave' }, clock);
  assert.equal(left.engine!.match.winner, 'B');
  assert.equal(left.engine!.match.complete, true);
  const closed = applyRoomAction(left, 'rival', { type: 'close' }, clock);
  assert.equal(closed.engine!.match.winner, 'B');
});

void test('room settings reject unimplemented four- and five-point Flor', () => {
  for (const florPoints of ['4', '5'])
    assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, florPoints }));
});

void test('passing requires a selected card and rejects the obsolete pass-all command', () => {
  assert.deepEqual(
    validateCommand({ type: 'PLAY_CARD', cardId: '7-oros', passed: true }),
    { type: 'PLAY_CARD', cardId: '7-oros', passed: true },
  );
  assert.throws(() => validateCommand({ type: 'PLAY_CARD', passed: true }));
  assert.throws(() => validateCommand({ type: 'PASS_CARDS' }));
});
