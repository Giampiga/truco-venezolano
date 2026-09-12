import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_EXECUTABLE_RULES,
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
  projectPrivate,
  projectPublic,
  raiseEnvido,
  reconnectSnapshot,
  resolveDeclarationTie,
  resolveFlor,
  resolveHandWinner,
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
  assert.equal(
    Object.values(deal.hands).every((hand) => hand.length === 3),
    true,
  );
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
  assert.equal(
    resolveHandWinner([result('A'), result('B'), result(null)], 'B'),
    'A',
  );
  assert.equal(
    resolveHandWinner([result(null), result(null), result(null)], 'A'),
    'A',
  );
  assert.equal(
    resolveHandWinner([result(null), result(null), result('B')], 'A'),
    'B',
  );
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
  assert.equal(
    resolveDeclarationTie(hands, vira, ['human', 'bot'], 'envido'),
    'human',
  );

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
  assert.equal(
    resolveDeclarationTie(florHands, vira, ['bot', 'human'], 'flor'),
    'bot',
  );
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
  assert.deepEqual(trucoHandAward(state, 'B'), {
    team: 'B',
    amount: 'game',
    reason: 'truco',
  });
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
  assert.equal(
    legalActions({ ...base, actorHasPlayedFirstCard: true }).includes(
      'call-envido',
    ),
    false,
  );

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

  const valeJuego = applyAwards(match, [
    { team: 'B', amount: 'game', reason: 'truco' },
  ]);
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
  const resumed = reconnectSnapshot(
    resumeSnapshot(serializeSnapshot(disconnected)),
  );
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
  const rules: ExecutableRules = {
    ...DEFAULT_EXECUTABLE_RULES,
    florMode: 'off',
  };
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
    transition(
      snapshot,
      'bot',
      { type: 'PLAY_CARD', cardId: '2-espadas' },
      rules,
      'bad',
    ),
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
  assert.ok(
    next.appliedCommandIds.every((id) =>
      snapshot.appliedCommandIds.includes(id),
    ),
  );
});

void test('la primera parda apilada termina la base con la mayor arriba', () => {
  for (const pardaMode of ['abierta', 'cerrada'] as const) {
    for (const pardaEngine of [
      'apilada-clasica',
      'secuencial-online',
    ] as const) {
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
      assert.ok(
        legalActionsForSnapshot(snapshot, 'human', stackRules).includes(
          'play-stack',
        ),
      );
      assert.equal(
        legalActionsForSnapshot(snapshot, 'human', stackRules).includes(
          'play-card',
        ),
        false,
      );
      assert.equal(snapshot.activeSeatId, snapshot.manoSeatId);
      assert.throws(() =>
        transition(
          snapshot,
          'human',
          { type: 'PLAY_CARD', cardId: '7-bastos' },
          stackRules,
          'illegal-single',
        ),
      );
      assert.throws(() =>
        transition(
          snapshot,
          'human',
          { type: 'PLAY_STACK', cardIds: ['4-oros', '7-bastos'] },
          stackRules,
          'wrong-order',
        ),
      );
      if (pardaMode === 'cerrada') {
        assert.equal(
          legalActionsForSnapshot(snapshot, 'human', stackRules).includes(
            'call-truco',
          ),
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
      assert.equal(
        projectPublic(snapshot).played.length,
        4,
        'sin empate arriba, las tapadas siguen privadas',
      );
    }
  }
});

void test('la parda publica solo las tapadas necesarias para el desempate', () => {
  let snapshot = createEngineSnapshot({
    deck: createSpanishDeck(),
    seats: seats2v2,
    dealerSeatId: 'p4',
    target: 12,
    rules,
  });
  snapshot.vira = { rank: 6, suit: 'copas' };
  snapshot.hands = {
    p1: [
      { rank: 3, suit: 'oros' },
      { rank: 7, suit: 'bastos' },
      { rank: 6, suit: 'oros' },
    ],
    p2: [
      { rank: 3, suit: 'bastos' },
      { rank: 7, suit: 'copas' },
      { rank: 4, suit: 'oros' },
    ],
    p3: [
      { rank: 3, suit: 'copas' },
      { rank: 6, suit: 'bastos' },
      { rank: 4, suit: 'bastos' },
    ],
    p4: [
      { rank: 3, suit: 'espadas' },
      { rank: 5, suit: 'copas' },
      { rank: 4, suit: 'copas' },
    ],
  };
  snapshot.dealtHands = structuredClone(snapshot.hands);
  for (const seat of seats2v2) {
    const card = snapshot.hands[seat.id][0];
    snapshot = transition(
      snapshot,
      seat.id,
      { type: 'PLAY_CARD', cardId: `${card.rank}-${card.suit}` },
      rules,
    ).state;
  }
  for (const seat of seats2v2) {
    const [top, hidden] = snapshot.hands[seat.id];
    snapshot = transition(
      snapshot,
      seat.id,
      {
        type: 'PLAY_STACK',
        cardIds: [`${top.rank}-${top.suit}`, `${hidden.rank}-${hidden.suit}`],
      },
      rules,
    ).state;
    if (seat.id !== 'p4') {
      assert.equal(
        projectPublic(snapshot).played.some(
          (play) =>
            play.card.rank === 4 ||
            (play.card.suit === 'oros' && play.card.rank === 6),
        ),
        false,
      );
    }
  }
  assert.equal(snapshot.handComplete, true);
  assert.equal(snapshot.match.score.A, 1);
  const revealed = projectPublic(snapshot).played.slice(8);
  assert.deepEqual(
    revealed.map((play) => [play.seatId, play.card]),
    [
      ['p1', { rank: 6, suit: 'oros' }],
      ['p2', { rank: 4, suit: 'oros' }],
    ],
  );
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
  snapshot.hands.bot = [
    { rank: 4, suit: 'bastos' },
    { rank: 2, suit: 'copas' },
    { rank: 1, suit: 'oros' },
  ];
  snapshot.dealtHands = structuredClone(snapshot.hands);
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
  assert.deepEqual(snapshot.match.score, { A: 0, B: 0 });
  assert.equal(snapshot.envido.status, 'accepted');
  assert.equal(projectPublic(snapshot).envidoResult, null);
  assert.equal(
    legalActionsForSnapshot(snapshot, 'bot', envidoRules).includes(
      'call-envido',
    ),
    false,
  );
  snapshot = transition(
    snapshot,
    'bot',
    { type: 'FOLD_HAND' },
    envidoRules,
  ).state;
  assert.deepEqual(snapshot.match.score, { A: 3, B: 0 });
  assert.deepEqual(projectPublic(snapshot).envidoResult, {
    totals: [
      { id: 'human', team: 'A', tantos: 33 },
      { id: 'bot', team: 'B', tantos: 32 },
    ],
    winner: 'A',
    points: 2,
    declined: false,
    tied: false,
  });
  assert.equal(
    projectPublic(beginNextHand(snapshot, createSpanishDeck())).envidoResult,
    null,
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

function dealtSnapshot(hands: Record<string, TrucoCard[]>, tableRules = rules) {
  const seats = Object.keys(hands).map((id, index) => ({
    id,
    team: index % 2 ? ('B' as const) : ('A' as const),
  }));
  const deck = [0, 1, 2].flatMap((index) =>
    seats.map((seat) => hands[seat.id][index]),
  );
  return createEngineSnapshot({
    deck: [...deck, vira],
    seats,
    dealerSeatId: seats.at(-1)!.id,
    target: 24,
    rules: tableRules,
  });
}
const whiteFlor: TrucoCard[] = [
  { rank: 7, suit: 'oros' },
  { rank: 6, suit: 'oros' },
  { rank: 5, suit: 'oros' },
];
const lesserFlor: TrucoCard[] = [
  { rank: 7, suit: 'bastos' },
  { rank: 5, suit: 'bastos' },
  { rank: 4, suit: 'bastos' },
];
const noFlor: TrucoCard[] = [
  { rank: 1, suit: 'espadas' },
  { rank: 3, suit: 'bastos' },
  { rank: 2, suit: 'copas' },
];

void test('Flor is compulsory before playing, and opponents can compare or envidar it', () => {
  const initial = dealtSnapshot({ human: whiteFlor, bot: lesserFlor });
  assert.deepEqual(legalActionsForSnapshot(initial, 'human'), ['declare-flor']);
  assert.throws(() =>
    transition(
      initial,
      'human',
      { type: 'PLAY_CARD', cardId: '7-oros' },
      rules,
    ),
  );
  const announced = transition(
    initial,
    'human',
    { type: 'DECLARE_FLOR', mode: 'flor' },
    rules,
  ).state;
  assert.deepEqual(announced.match.score, { A: 0, B: 0 });
  assert.equal(announced.priority.active, 'flor');
  assert.ok(
    legalActionsForSnapshot(announced, 'bot').includes('call-flor-envida'),
  );
  for (const answer of ['quiero', 'no-quiero'] as const) {
    const done = transition(
      announced,
      'bot',
      { type: 'ANSWER_CALL', answer },
      rules,
    ).state;
    assert.deepEqual(done.match.score, { A: 3, B: 0 });
    assert.equal(done.priority.active, 'play');
    assert.ok(!legalActionsForSnapshot(done, 'human').includes('declare-flor'));
  }
  const raised = transition(
    announced,
    'bot',
    { type: 'CALL_FLOR_ENVIDA' },
    rules,
  ).state;
  assert.equal(raised.envido.pending?.stake, 5);
  assert.equal(raised.envido.pending?.rejectionAward, 3);
  const accepted = transition(
    raised,
    'human',
    { type: 'ANSWER_CALL', answer: 'quiero' },
    rules,
  ).state;
  assert.deepEqual(accepted.match.score, { A: 5, B: 0 });
  const rejected = transition(
    raised,
    'human',
    { type: 'ANSWER_CALL', answer: 'no-quiero' },
    rules,
  ).state;
  assert.deepEqual(rejected.match.score, { A: 0, B: 3 });
});

void test('a later Flor cancels accepted and rejected Envite before either is paid', () => {
  for (const answer of ['quiero', 'no-quiero'] as const) {
    let state = dealtSnapshot({
      p1: noFlor,
      p2: [
        { rank: 4, suit: 'oros' },
        { rank: 2, suit: 'bastos' },
        { rank: 1, suit: 'copas' },
      ],
      p3: whiteFlor,
      p4: [
        { rank: 3, suit: 'oros' },
        { rank: 5, suit: 'espadas' },
        { rank: 12, suit: 'copas' },
      ],
    });
    state = transition(
      state,
      'p1',
      { type: 'CALL_ENVIDO', amount: 2 },
      rules,
    ).state;
    state = transition(
      state,
      'p2',
      { type: 'ANSWER_CALL', answer },
      rules,
    ).state;
    assert.deepEqual(state.match.score, { A: 0, B: 0 });
    state = transition(
      state,
      'p1',
      { type: 'PLAY_CARD', cardId: '1-espadas' },
      rules,
    ).state;
    state = transition(
      state,
      'p2',
      { type: 'PLAY_CARD', cardId: '4-oros' },
      rules,
    ).state;
    state = transition(
      state,
      'p3',
      { type: 'DECLARE_FLOR', mode: 'flor' },
      rules,
    ).state;
    assert.deepEqual(state.match.score, { A: 3, B: 0 });
    state = transition(state, 'p3', { type: 'FOLD_HAND' }, rules).state;
    assert.deepEqual(state.match.score, { A: 3, B: 1 });
  }
});

void test('accepted Envite closes the game before a rejected Truco can score', () => {
  let state = dealtSnapshot(
    { human: whiteFlor, bot: noFlor },
    { ...rules, florMode: 'off' },
  );
  const tableRules = state.rules;
  state.match.score = { A: 22, B: 23 };
  state = transition(
    state,
    'human',
    { type: 'CALL_ENVIDO', amount: 2 },
    tableRules,
  ).state;
  state = transition(
    state,
    'bot',
    { type: 'ANSWER_CALL', answer: 'quiero' },
    tableRules,
  ).state;
  state = transition(
    state,
    'human',
    { type: 'PLAY_CARD', cardId: '7-oros' },
    tableRules,
  ).state;
  state = transition(
    state,
    'bot',
    { type: 'CALL_TRUCO', call: 'truco' },
    tableRules,
  ).state;
  state = transition(
    state,
    'human',
    { type: 'ANSWER_CALL', answer: 'no-quiero' },
    tableRules,
  ).state;
  assert.deepEqual(state.match.score, { A: 24, B: 23 });
  assert.equal(state.match.winner, 'A');
});

void test('resolved Envite cannot be called again while answering Truco', () => {
  let state = dealtSnapshot(
    { human: noFlor, bot: whiteFlor },
    { ...rules, florMode: 'off' },
  );
  state = transition(
    state,
    'human',
    { type: 'CALL_ENVIDO', amount: 2 },
    state.rules,
  ).state;
  state = transition(
    state,
    'bot',
    { type: 'ANSWER_CALL', answer: 'no-quiero' },
    state.rules,
  ).state;
  state = transition(
    state,
    'human',
    { type: 'CALL_TRUCO', call: 'truco' },
    state.rules,
  ).state;
  assert.ok(!legalActionsForSnapshot(state, 'bot').includes('call-envido'));
});

void test('only floral opponents answer Flor and a suspended Truco resumes', () => {
  let state = dealtSnapshot({
    p1: noFlor,
    p2: whiteFlor,
    p3: lesserFlor,
    p4: [
      { rank: 4, suit: 'oros' },
      { rank: 5, suit: 'espadas' },
      { rank: 1, suit: 'copas' },
    ],
  });
  state = transition(
    state,
    'p1',
    { type: 'CALL_TRUCO', call: 'truco' },
    rules,
  ).state;
  const pending = state.truco.pending;
  state = transition(
    state,
    'p2',
    { type: 'DECLARE_FLOR', mode: 'flor' },
    rules,
  ).state;
  assert.deepEqual(legalActionsForSnapshot(state, 'p1'), []);
  assert.ok(legalActionsForSnapshot(state, 'p3').includes('call-flor-envida'));
  state = transition(
    state,
    'p3',
    { type: 'DECLARE_FLOR', mode: 'flor' },
    rules,
  ).state;
  assert.deepEqual(state.match.score, { A: 0, B: 3 });
  assert.equal(state.priority.active, 'truco');
  assert.deepEqual(state.truco.pending, pending);
});

void test('Falta cannot lower an existing wager and fractional raises are rejected', () => {
  const called = callEnvido(createEnvidoState(), 'A', { A: 23, B: 0 }, 24);
  assert.throws(
    () => raiseEnvido(called, 'B', { A: 23, B: 0 }, 24, 'falta'),
    /aumentar/,
  );
  for (const amount of [0, -1, 1.5, Infinity, NaN, 33])
    assert.throws(() =>
      raiseEnvido(called, 'B', { A: 0, B: 0 }, 24, 'n-mas', amount),
    );
});

void test('legacy resolved Envite is not paid twice after restoring an older snapshot', () => {
  let state = dealtSnapshot(
    { human: noFlor, bot: whiteFlor },
    { ...rules, florMode: 'off' },
  );
  state.match.score.A = 2;
  state.envido = {
    status: 'resolved',
    winner: 'A',
    acceptedStake: 2,
    pending: null,
  };
  state = transition(state, 'human', { type: 'FOLD_HAND' }, state.rules).state;
  assert.deepEqual(state.match.score, { A: 2, B: 1 });
});

void test('rejected Envido reveals both totals only at the end, without awarding the higher hand', () => {
  let state = dealtSnapshot(
    { human: noFlor, bot: whiteFlor },
    { ...rules, florMode: 'off' },
  );
  state = transition(
    state,
    'human',
    { type: 'CALL_ENVIDO', amount: 2 },
    state.rules,
  ).state;
  state = transition(
    state,
    'bot',
    { type: 'ANSWER_CALL', answer: 'no-quiero' },
    state.rules,
  ).state;
  assert.equal(projectPublic(state).envidoResult, null);
  assert.deepEqual(state.match.score, { A: 0, B: 0 });
  state = transition(state, 'human', { type: 'FOLD_HAND' }, state.rules).state;
  const result = projectPublic(state).envidoResult!;
  assert.equal(result.declined, true);
  assert.equal(result.winner, 'A');
  assert.equal(result.points, 1);
  assert.equal(result.totals.length, 2);
  assert.ok(result.totals[1].tantos > result.totals[0].tantos);
  assert.deepEqual(state.match.score, { A: 1, B: 1 });
});
