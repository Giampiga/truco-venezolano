import assert from 'node:assert/strict';
import test from 'node:test';

import {
  answerEnvido,
  answerTruco,
  applyAwards,
  beginNextHand,
  callEnvido,
  callTruco,
  createEngineSnapshot,
  createEnvidoState,
  createTrucoState,
  dealCards,
  disconnectSnapshot,
  faltaValue,
  finishPriorityCall,
  interruptTrucoWithEnvido,
  legalActions,
  legalActionsForSnapshot,
  manoForDealer,
  nextDealer,
  pardaContinuation,
  privandoTeams,
  projectPrivate,
  projectPublic,
  raiseEnvido,
  reconnectSnapshot,
  resolveDeclarationTie,
  resolveFlor,
  resolveHandWinner,
  resolvePrive,
  resolveTrick,
  resumeSnapshot,
  serializeSnapshot,
  transition,
  trucoHandAward,
  type EngineSnapshot,
  type ExecutableRules,
  type Seat,
  type TrickResult,
} from '../lib/truco-engine.ts';
import {
  createSpanishDeck,
  getPieces,
  trucoAcceptedValue,
  type TrucoCard,
} from '../lib/truco-rules.ts';

const seats1v1: Seat[] = [
  { id: 'human', team: 'A' },
  { id: 'bot', team: 'B' },
];
const seats2v2: Seat[] = [
  { id: 'p1', team: 'A' },
  { id: 'p2', team: 'B' },
  { id: 'p3', team: 'A' },
  { id: 'p4', team: 'B' },
];
const rules: ExecutableRules = {
  florMode: 'a-ley',
  pardaMode: 'abierta',
  pardaEngine: 'apilada-clasica',
  florPoints: 3,
};
const vira: TrucoCard = { rank: 6, suit: 'copas' };

function result(team: 'A' | 'B' | null): TrickResult {
  return {
    winnerTeam: team,
    winningSeatId: team ? team.toLowerCase() : null,
    parda: team === null,
    rank: team ? 90 : 80,
  };
}

void test('reparte 1v1 de a una, deja tres cartas y vira séptima', () => {
  const deck = createSpanishDeck();
  const deal = dealCards(deck, seats1v1, 'bot');
  assert.equal(deal.format, '1v1');
  assert.equal(deal.manoSeatId, 'human');
  assert.deepEqual(deal.hands.human, [deck[0], deck[2], deck[4]]);
  assert.deepEqual(deal.hands.bot, [deck[1], deck[3], deck[5]]);
  assert.deepEqual(deal.vira, deck[6]);
  assert.equal(deal.undealt.length, 33);
});

void test('reparte 2v2 con parejas fijas y vira decimotercera', () => {
  const deck = createSpanishDeck();
  const deal = dealCards(deck, seats2v2, 'p4');
  assert.equal(deal.format, '2v2');
  assert.equal(deal.manoSeatId, 'p1');
  assert.deepEqual(deal.vira, deck[12]);
  assert.equal(Object.values(deal.hands).every((hand) => hand.length === 3), true);
});

void test('rota Pie y Mano en cada base 1v1', () => {
  assert.equal(manoForDealer(['human', 'bot'], 'bot'), 'human');
  assert.equal(nextDealer(['human', 'bot'], 'bot'), 'human');
  assert.equal(manoForDealer(['human', 'bot'], 'human'), 'bot');
});

void test('resuelve vuelta por jerarquía y parda solo entre equipos rivales', () => {
  const won = resolveTrick(
    [
      { seatId: 'human', team: 'A', card: { rank: 3, suit: 'oros' } },
      { seatId: 'bot', team: 'B', card: { rank: 2, suit: 'copas' } },
    ],
    vira,
  );
  assert.equal(won.winnerTeam, 'A');

  const tied = resolveTrick(
    [
      { seatId: 'human', team: 'A', card: { rank: 3, suit: 'oros' } },
      { seatId: 'bot', team: 'B', card: { rank: 3, suit: 'bastos' } },
    ],
    vira,
  );
  assert.equal(tied.parda, true);

  const allied = resolveTrick(
    [
      { seatId: 'p1', team: 'A', card: { rank: 3, suit: 'oros' } },
      { seatId: 'p2', team: 'B', card: { rank: 2, suit: 'oros' } },
      { seatId: 'p3', team: 'A', card: { rank: 3, suit: 'bastos' } },
      { seatId: 'p4', team: 'B', card: { rank: 1, suit: 'copas' } },
    ],
    vira,
  );
  assert.equal(allied.winnerTeam, 'A');
  assert.equal(allied.parda, false);
});

void test('resuelve todos los caminos de parda y prioridad de primera', () => {
  assert.equal(resolveHandWinner([result(null), result('B')], 'A'), 'B');
  assert.equal(resolveHandWinner([result('A'), result(null)], 'B'), 'A');
  assert.equal(resolveHandWinner([result('A'), result('B'), result(null)], 'B'), 'A');
  assert.equal(resolveHandWinner([result(null), result(null), result(null)], 'A'), 'A');
  assert.equal(resolveHandWinner([result(null), result(null), result('B')], 'A'), 'B');
  assert.equal(pardaContinuation('abierta', 1)?.allowsRaiseBetweenReveal, true);
  assert.equal(pardaContinuation('cerrada', 1)?.allowsRaiseBetweenReveal, false);
});

void test('Envido y Flor empatados se resuelven por orden de Mano', () => {
  const hands = [
    {
      seatId: 'human',
      hand: [
        { rank: 7, suit: 'bastos' },
        { rank: 4, suit: 'bastos' },
        { rank: 12, suit: 'oros' },
      ] as TrucoCard[],
    },
    {
      seatId: 'bot',
      hand: [
        { rank: 7, suit: 'oros' },
        { rank: 4, suit: 'oros' },
        { rank: 12, suit: 'bastos' },
      ] as TrucoCard[],
    },
  ];
  assert.equal(resolveDeclarationTie(hands, vira, ['human', 'bot'], 'envido'), 'human');

  const florHands = [
    {
      seatId: 'human',
      hand: [
        { rank: 7, suit: 'bastos' },
        { rank: 4, suit: 'bastos' },
        { rank: 12, suit: 'bastos' },
      ] as TrucoCard[],
    },
    {
      seatId: 'bot',
      hand: [
        { rank: 7, suit: 'oros' },
        { rank: 4, suit: 'oros' },
        { rank: 12, suit: 'oros' },
      ] as TrucoCard[],
    },
  ];
  assert.equal(resolveDeclarationTie(florHands, vira, ['bot', 'human'], 'flor'), 'bot');
});

void test('Reservada es Flor invencible aunque una Flor común muestre más puntos', () => {
  const resolved = resolveFlor(
    [
      {
        seatId: 'human',
        team: 'A',
        declared: true,
        hand: [
          getPieces(vira).perico,
          getPieces(vira).perica,
          { rank: 4, suit: 'oros' },
        ],
      },
      {
        seatId: 'bot',
        team: 'B',
        declared: true,
        hand: [
          getPieces(vira).perico,
          { rank: 7, suit: 'bastos' },
          { rank: 6, suit: 'bastos' },
        ],
      },
    ],
    vira,
    ['bot', 'human'],
  );
  assert.equal(resolved?.winnerSeatId, 'human');
});

void test('suma flores aliadas y solo cobra el equipo de la Flor mayor', () => {
  const resolved = resolveFlor(
    [
      {
        seatId: 'p1',
        team: 'A',
        declared: true,
        hand: [
          { rank: 7, suit: 'oros' },
          { rank: 6, suit: 'oros' },
          { rank: 5, suit: 'oros' },
        ],
      },
      {
        seatId: 'p3',
        team: 'A',
        declared: true,
        hand: [
          { rank: 7, suit: 'bastos' },
          { rank: 4, suit: 'bastos' },
          { rank: 3, suit: 'bastos' },
        ],
      },
      {
        seatId: 'p2',
        team: 'B',
        declared: true,
        hand: [
          { rank: 4, suit: 'espadas' },
          { rank: 3, suit: 'espadas' },
          { rank: 2, suit: 'espadas' },
        ],
      },
    ],
    vira,
    ['p1', 'p2', 'p3'],
    3,
  );
  assert.equal(resolved?.winnerTeam, 'A');
  assert.equal(resolved?.points, 6);
});

void test('escalera de Truco alterna equipos hasta Vale Juego', () => {
  let state = callTruco(createTrucoState(), 'A');
  assert.equal(state.pending?.call, 'truco');
  state = answerTruco(state, 'B', 'raise').state;
  assert.equal(state.pending?.call, 'retruco');
  state = answerTruco(state, 'A', 'raise').state;
  assert.equal(state.pending?.call, 'vale-nueve');
  state = answerTruco(state, 'B', 'raise').state;
  assert.equal(state.pending?.call, 'vale-juego');
  state = answerTruco(state, 'A', 'quiero').state;
  assert.equal(state.accepted, 'vale-juego');
  assert.equal(trucoAcceptedValue('vale-juego'), 'game');
  assert.deepEqual(trucoHandAward(state, 'B'), { team: 'B', amount: 'game', reason: 'truco' });
  assert.throws(() => callTruco(state, 'A'));
});

void test('rechazos de Truco pagan 1, 3, 6 y 9', () => {
  let state = callTruco(createTrucoState(), 'A');
  assert.equal(answerTruco(state, 'B', 'no-quiero').award?.amount, 1);
  state = answerTruco(state, 'B', 'raise').state;
  assert.equal(answerTruco(state, 'A', 'no-quiero').award?.amount, 3);
  state = answerTruco(state, 'A', 'raise').state;
  assert.equal(answerTruco(state, 'B', 'no-quiero').award?.amount, 6);
  state = answerTruco(state, 'B', 'raise').state;
  assert.equal(answerTruco(state, 'A', 'no-quiero').award?.amount, 9);
});

void test('Envido, Quiero y Envido, N más y Falta mantienen apuesta de rechazo', () => {
  let state = callEnvido(createEnvidoState(), 'A', { A: 3, B: 5 }, 24);
  assert.equal(state.pending?.stake, 2);
  state = raiseEnvido(state, 'B', { A: 3, B: 5 }, 24, 'envido');
  assert.equal(state.pending?.stake, 4);
  assert.equal(state.pending?.rejectionAward, 2);
  state = raiseEnvido(state, 'A', { A: 3, B: 5 }, 24, 'n-mas', 3);
  assert.equal(state.pending?.stake, 7);
  state = raiseEnvido(state, 'B', { A: 3, B: 5 }, 24, 'falta');
  assert.equal(state.pending?.stake, 19);
  assert.equal(answerEnvido(state, 'A', 'no-quiero').award?.amount, 7);
  assert.equal(faltaValue({ A: 23, B: 9 }, 24), 1);
});

void test('Envido interrumpe una respuesta de Truco y la reanuda intacta', () => {
  const truco = callTruco(createTrucoState(), 'A');
  const interrupted = interruptTrucoWithEnvido(
    { active: 'truco', suspendedTruco: null },
    truco.pending,
  );
  assert.equal(interrupted.active, 'envido');
  assert.deepEqual(interrupted.suspendedTruco, { call: 'truco', by: 'A' });
  const resumed = finishPriorityCall(interrupted);
  assert.equal(resumed.active, 'truco');
  assert.deepEqual(resumed.suspendedTruco, truco.pending);
});

void test('la compuerta legal bloquea Envido tras jugar y obliga a responder cantos', () => {
  const hand: TrucoCard[] = [
    { rank: 7, suit: 'bastos' },
    { rank: 4, suit: 'bastos' },
    { rank: 12, suit: 'oros' },
  ];
  const base = {
    actorSeatId: 'human',
    activeSeatId: 'human',
    seats: seats1v1,
    firstTrick: true,
    actorHasPlayedFirstCard: false,
    actorHand: hand,
    vira,
    florMode: 'a-ley' as const,
    pardaMode: 'abierta' as const,
    pardaEngine: 'apilada-clasica' as const,
    truco: createTrucoState(),
    envido: createEnvidoState(),
    priority: { active: 'play' as const, suspendedTruco: null },
  };
  assert.ok(legalActions(base).includes('call-envido'));
  assert.equal(legalActions({ ...base, actorHasPlayedFirstCard: true }).includes('call-envido'), false);

  const pending = callTruco(createTrucoState(), 'B');
  const response = legalActions({
    ...base,
    truco: pending,
    priority: { active: 'truco', suspendedTruco: null },
  });
  assert.ok(response.includes('answer-quiero'));
  assert.ok(response.includes('answer-no-quiero'));
  assert.ok(response.includes('call-envido'));
  assert.equal(response.includes('play-card'), false);
});

void test('Privando se activa exactamente en target menos uno y gana por Mano en empate', () => {
  assert.deepEqual(privandoTeams({ A: 23, B: 17 }, 24), ['A']);
  assert.deepEqual(privandoTeams({ A: 23, B: 23 }, 24), ['A', 'B']);
  const award = resolvePrive(
    [
      {
        seatId: 'human',
        team: 'A',
        hand: [
          { rank: 7, suit: 'oros' },
          { rank: 4, suit: 'oros' },
          { rank: 12, suit: 'bastos' },
        ],
      },
      {
        seatId: 'bot',
        team: 'B',
        hand: [
          { rank: 7, suit: 'bastos' },
          { rank: 4, suit: 'bastos' },
          { rank: 12, suit: 'oros' },
        ],
      },
    ],
    vira,
    ['human', 'bot'],
  );
  assert.deepEqual(award, { team: 'A', amount: 1, reason: 'prive' });
});

void test('aplica Flor/Envido antes de Truco y corta al completar el partido', () => {
  const match = {
    target: 24,
    score: { A: 22, B: 20 },
    gamesToWin: 1 as const,
    gameWins: { A: 0, B: 0 },
    gameNumber: 1,
    gameComplete: false,
    winner: null,
    complete: false,
  };
  const completed = applyAwards(match, [
    { team: 'B', amount: 3, reason: 'truco' },
    { team: 'A', amount: 2, reason: 'envido' },
  ]);
  assert.deepEqual(completed.score, { A: 24, B: 20 });
  assert.equal(completed.winner, 'A');
  assert.equal(completed.complete, true);

  const valeJuego = applyAwards(match, [{ team: 'B', amount: 'game', reason: 'truco' }]);
  assert.equal(valeJuego.score.B, 24);
  assert.equal(valeJuego.winner, 'B');
});

void test('mejor de tres reinicia piedras y termina al ganar dos chicos', () => {
  let snapshot = createEngineSnapshot({
    deck: createSpanishDeck(),
    seats: seats1v1,
    dealerSeatId: 'bot',
    target: 12,
    gamesToWin: 2,
    rules,
  });
  snapshot.match.score.A = 11;
  snapshot.match = applyAwards(snapshot.match, [
    { team: 'A', amount: 1, reason: 'truco' },
  ]);
  snapshot.handComplete = true;
  assert.equal(snapshot.match.complete, false);
  assert.equal(snapshot.match.gameComplete, true);
  assert.deepEqual(snapshot.match.gameWins, { A: 1, B: 0 });
  snapshot = beginNextHand(snapshot, [...createSpanishDeck()].reverse());
  assert.deepEqual(snapshot.match.score, { A: 0, B: 0 });
  assert.equal(snapshot.match.gameNumber, 2);
  snapshot.match.score.A = 11;
  snapshot.match = applyAwards(snapshot.match, [
    { team: 'A', amount: 1, reason: 'truco' },
  ]);
  assert.equal(snapshot.match.complete, true);
  assert.equal(snapshot.match.winner, 'A');
  assert.deepEqual(snapshot.match.gameWins, { A: 2, B: 0 });
});

function resumableSnapshot(): EngineSnapshot {
  const snapshot = createEngineSnapshot({
    deck: createSpanishDeck(),
    seats: seats1v1,
    dealerSeatId: 'bot',
    target: 24,
  });
  snapshot.gameVersion = 7;
  snapshot.match.score = { A: 12, B: 9 };
  snapshot.truco = callTruco(snapshot.truco, 'A');
  snapshot.priority = { active: 'truco', suspendedTruco: null };
  return snapshot;
}

void test('disconnect/resume conserva formato, vira, mano, canto, turno y versión', () => {
  const snapshot = resumableSnapshot();
  const disconnected = disconnectSnapshot(snapshot);
  const resumed = reconnectSnapshot(resumeSnapshot(serializeSnapshot(disconnected)));
  assert.equal(resumed.format, '1v1');
  assert.deepEqual(resumed.vira, snapshot.vira);
  assert.deepEqual(resumed.hands, snapshot.hands);
  assert.equal(resumed.activeSeatId, snapshot.activeSeatId);
  assert.equal(resumed.manoSeatId, snapshot.manoSeatId);
  assert.deepEqual(resumed.truco.pending, snapshot.truco.pending);
  assert.deepEqual(resumed.match.score, { A: 12, B: 9 });
  assert.equal(resumed.gameVersion, 7);
  assert.equal(resumed.connection, 'online');
});

void test('transition valida turno, resuelve vuelta e ignora comando duplicado', () => {
  const snapshot = createEngineSnapshot({
    deck: createSpanishDeck(),
    seats: seats1v1,
    dealerSeatId: 'bot',
    target: 12,
    rules,
  });
  const humanCard = snapshot.hands.human[0];
  const first = transition(
    snapshot,
    'human',
    { type: 'PLAY_CARD', cardId: `${humanCard.rank}-${humanCard.suit}` },
    rules,
    'cmd-1',
  );
  assert.equal(first.state.activeSeatId, 'bot');
  assert.equal(first.state.hands.human.length, 2);
  assert.throws(() =>
    transition(snapshot, 'bot', { type: 'PLAY_CARD', cardId: '2-espadas' }, rules, 'bad'),
  );
  const duplicate = transition(
    first.state,
    'human',
    { type: 'PLAY_CARD', cardId: `${humanCard.rank}-${humanCard.suit}` },
    rules,
    'cmd-1',
  );
  assert.equal(duplicate.state, first.state);
});

void test('la siguiente base rota Pie/Mano sin perder el marcador', () => {
  const snapshot = createEngineSnapshot({
    deck: createSpanishDeck(),
    seats: seats1v1,
    dealerSeatId: 'bot',
    target: 12,
    rules,
  });
  snapshot.handComplete = true;
  snapshot.match.score.A = 3;
  const next = beginNextHand(snapshot, [...createSpanishDeck()].reverse());
  assert.equal(next.dealerSeatId, 'human');
  assert.equal(next.manoSeatId, 'bot');
  assert.equal(next.activeSeatId, 'bot');
  assert.deepEqual(next.match.score, { A: 3, B: 0 });
  assert.equal(next.handNumber, 2);
  assert.ok(next.appliedCommandIds.every((id) => snapshot.appliedCommandIds.includes(id)));
});

void test('la primera parda apilada termina la base con la mayor arriba', () => {
  for (const pardaMode of ['abierta', 'cerrada'] as const) {
   for (const pardaEngine of ['apilada-clasica', 'secuencial-online'] as const) {
    const stackRules: ExecutableRules = { ...rules, pardaMode, pardaEngine };
    let snapshot = createEngineSnapshot({
      deck: createSpanishDeck(),
      seats: seats1v1,
      dealerSeatId: 'bot',
      target: 12,
      rules: stackRules,
    });
    snapshot.vira = { rank: 6, suit: 'copas' };
    snapshot.hands = {
      human: [
        { rank: 3, suit: 'oros' },
        { rank: 7, suit: 'bastos' },
        { rank: 4, suit: 'oros' },
      ],
      bot: [
        { rank: 3, suit: 'copas' },
        { rank: 6, suit: 'bastos' },
        { rank: 5, suit: 'oros' },
      ],
    };
    snapshot.dealtHands = structuredClone(snapshot.hands);
    snapshot = transition(
      snapshot,
      'human',
      { type: 'PLAY_CARD', cardId: '3-oros' },
      stackRules,
      `${pardaMode}-1`,
    ).state;
    snapshot = transition(
      snapshot,
      'bot',
      { type: 'PLAY_CARD', cardId: '3-copas' },
      stackRules,
      `${pardaMode}-2`,
    ).state;
    assert.ok(legalActionsForSnapshot(snapshot, 'human', stackRules).includes('play-stack'));
    assert.equal(legalActionsForSnapshot(snapshot, 'human', stackRules).includes('play-card'), false);
    assert.equal(snapshot.activeSeatId, snapshot.manoSeatId);
    assert.throws(() => transition(snapshot, 'human', {type: 'PLAY_CARD', cardId: '7-bastos'}, stackRules, 'illegal-single'));
    assert.throws(() => transition(snapshot, 'human', {type: 'PLAY_STACK', cardIds: ['4-oros', '7-bastos']}, stackRules, 'wrong-order'));
    if (pardaMode === 'cerrada') {
      assert.equal(
        legalActionsForSnapshot(snapshot, 'human', stackRules).includes('call-truco'),
        false,
      );
    }
    snapshot = transition(
      snapshot,
      'human',
      { type: 'PLAY_STACK', cardIds: ['7-bastos', '4-oros'] },
      stackRules,
      `${pardaMode}-3`,
    ).state;
    snapshot = transition(
      snapshot,
      'bot',
      { type: 'PLAY_STACK', cardIds: ['6-bastos', '5-oros'] },
      stackRules,
      `${pardaMode}-4`,
    ).state;
    assert.equal(snapshot.handComplete, true);
    assert.equal(snapshot.match.score.A, 1);
   }
  }
});

void test('Flor se declara una vez, puntúa y cancela el Envite normal', () => {
  let snapshot = createEngineSnapshot({
    deck: createSpanishDeck(),
    seats: seats1v1,
    dealerSeatId: 'bot',
    target: 12,
    rules,
  });
  snapshot.vira = { rank: 6, suit: 'copas' };
  snapshot.hands.human = [
    { rank: 7, suit: 'oros' },
    { rank: 6, suit: 'oros' },
    { rank: 5, suit: 'oros' },
  ];
  snapshot.dealtHands.human = structuredClone(snapshot.hands.human);
  snapshot = transition(
    snapshot,
    'human',
    { type: 'DECLARE_FLOR', mode: 'flor' },
    rules,
    'flor-once',
  ).state;
  assert.equal(snapshot.match.score.A, 3);
  assert.equal(snapshot.envido.status, 'resolved');
  assert.equal(
    legalActionsForSnapshot(snapshot, 'human', rules).includes('declare-flor'),
    false,
  );
});

void test('Envido usa las tres cartas repartidas aunque Mano ya haya jugado', () => {
  const envidoRules: ExecutableRules = { ...rules, florMode: 'off' };
  let snapshot = createEngineSnapshot({
    deck: createSpanishDeck(),
    seats: seats1v1,
    dealerSeatId: 'bot',
    target: 12,
    rules: envidoRules,
  });
  snapshot.vira = { rank: 6, suit: 'copas' };
  snapshot.hands = {
    human: [
      { rank: 7, suit: 'oros' },
      { rank: 6, suit: 'oros' },
      { rank: 4, suit: 'espadas' },
    ],
    bot: [
      { rank: 7, suit: 'bastos' },
      { rank: 5, suit: 'bastos' },
      { rank: 4, suit: 'oros' },
    ],
  };
  snapshot.dealtHands = structuredClone(snapshot.hands);
  snapshot = transition(
    snapshot,
    'human',
    { type: 'PLAY_CARD', cardId: '7-oros' },
    envidoRules,
    'env-play',
  ).state;
  snapshot = transition(
    snapshot,
    'bot',
    { type: 'CALL_ENVIDO', amount: 2 },
    envidoRules,
    'env-call',
  ).state;
  snapshot = transition(
    snapshot,
    'human',
    { type: 'ANSWER_CALL', answer: 'quiero' },
    envidoRules,
    'env-answer',
  ).state;
  assert.deepEqual(snapshot.match.score, { A: 2, B: 0 });
  assert.equal(
    legalActionsForSnapshot(snapshot, 'bot', envidoRules).includes('call-envido'),
    false,
  );
});

void test('las proyecciones públicas no exponen manos ni tapadas rivales', () => {
  const snapshot = createEngineSnapshot({
    deck: createSpanishDeck(),
    seats: seats1v1,
    dealerSeatId: 'bot',
    target: 12,
    rules,
  });
  snapshot.pardaStacks.human = {
    top: { rank: 7, suit: 'oros' },
    hidden: { rank: 1, suit: 'espadas' },
  };
  const publicState = projectPublic(snapshot);
  assert.equal('hands' in publicState, false);
  assert.equal(JSON.stringify(publicState).includes('1-espadas'), false);
  assert.deepEqual(projectPrivate(snapshot, 'human').pardaStack?.hidden, {
    rank: 1,
    suit: 'espadas',
  });
});
