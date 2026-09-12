import assert from 'node:assert/strict';
import test from 'node:test';

import {
  choosePracticeAiCommand,
  explainAiChoice,
  observeForAi,
  type PracticeDifficulty,
} from '../lib/practice-ai.ts';
import {
  beginNextHand,
  createEngineSnapshot,
  transition,
  type EngineSnapshot,
  type ExecutableRules,
  type Seat,
} from '../lib/truco-engine.ts';
import { createSpanishDeck, type TrucoCard } from '../lib/truco-rules.ts';

const seats: Seat[] = [
  { id: 'human', team: 'A' },
  { id: 'bot', team: 'B' },
];
const rules: ExecutableRules = {
  florMode: 'off',
  pardaMode: 'abierta',
  pardaEngine: 'apilada-clasica',
  florPoints: 3,
};

function practiceSnapshot(): EngineSnapshot {
  const snapshot = createEngineSnapshot({
    deck: createSpanishDeck(),
    seats,
    dealerSeatId: 'human',
    target: 12,
    rules,
  });
  snapshot.vira = { rank: 6, suit: 'copas' };
  snapshot.hands.bot = [
    { rank: 11, suit: 'copas' },
    { rank: 7, suit: 'bastos' },
    { rank: 4, suit: 'oros' },
  ];
  snapshot.hands.human = [
    { rank: 2, suit: 'oros' },
    { rank: 5, suit: 'espadas' },
    { rank: 12, suit: 'bastos' },
  ];
  snapshot.dealtHands = structuredClone(snapshot.hands);
  return snapshot;
}

void test('la proyección de IA excluye la mano humana y cartas no repartidas', () => {
  const snapshot = practiceSnapshot();
  const observation = observeForAi(snapshot, 'bot', rules);
  assert.deepEqual(
    observation.ownHand.map(({ rank, suit }) => ({ rank, suit })),
    snapshot.hands.bot,
  );
  assert.equal('hands' in observation, false);
  assert.equal('undealt' in observation, false);
  assert.deepEqual(observation.opponentCardCounts, { human: 3 });
  assert.equal(JSON.stringify(observation).includes('2-oros'), false);
});

void test('cambiar cartas humanas ocultas no cambia la decisión sembrada', () => {
  const first = practiceSnapshot();
  const second = practiceSnapshot();
  second.hands.human = [
    { rank: 1, suit: 'espadas' },
    { rank: 1, suit: 'bastos' },
    { rank: 7, suit: 'espadas' },
  ];
  second.dealtHands.human = structuredClone(second.hands.human);
  const commandA = choosePracticeAiCommand(
    observeForAi(first, 'bot', rules),
    'maestro',
    42,
  );
  const commandB = choosePracticeAiCommand(
    observeForAi(second, 'bot', rules),
    'maestro',
    42,
  );
  assert.deepEqual(commandA, commandB);
});

void test('todas las dificultades devuelven exactamente un comando legal', () => {
  const snapshot = practiceSnapshot();
  const observation = observeForAi(snapshot, 'bot', rules);
  for (const difficulty of [
    'aprendiz',
    'criollo',
    'maestro',
  ] as PracticeDifficulty[]) {
    const command = choosePracticeAiCommand(observation, difficulty, 7);
    assert.ok(
      observation.legalCommands.some(
        (legal) => JSON.stringify(legal) === JSON.stringify(command),
      ),
    );
  }
});

void test('la dificultad cambia estrategia, no información disponible', () => {
  const snapshot = practiceSnapshot();
  snapshot.match.score.B = 10;
  const observation = observeForAi(snapshot, 'bot', rules);
  const aprendiz = choosePracticeAiCommand(observation, 'aprendiz', 1);
  const criollo = choosePracticeAiCommand(observation, 'criollo', 1);
  const maestro = choosePracticeAiCommand(observation, 'maestro', 1);
  assert.equal(aprendiz.type, 'PLAY_CARD');
  assert.deepEqual(criollo, { type: 'CALL_ENVIDO', amount: 2 });
  assert.deepEqual(maestro, { type: 'CALL_ENVIDO', amount: 'falta' });
});

void test('la explicación declara el límite de información del bot', () => {
  const observation = observeForAi(practiceSnapshot(), 'bot', rules);
  const play = observation.legalCommands.find(
    (command) => command.type === 'PLAY_CARD',
  );
  assert.ok(play);
  assert.match(explainAiChoice(observation, play), /no conoce tu mano/i);
});

void test('dos IAs sembradas completan un partido 1v1 entero por la misma API legal', () => {
  let snapshot = practiceSnapshot();
  snapshot.match.score = { A: 0, B: 0 };
  let steps = 0;
  while (!snapshot.match.complete && steps < 500) {
    if (snapshot.handComplete) {
      const deck = createSpanishDeck();
      const offset = snapshot.handNumber % deck.length;
      snapshot = beginNextHand(snapshot, [
        ...deck.slice(offset),
        ...deck.slice(0, offset),
      ]);
      continue;
    }
    const pendingTeam =
      snapshot.priority.active === 'truco'
        ? snapshot.truco.pending?.by
        : snapshot.priority.active === 'envido' ||
            snapshot.priority.active === 'flor'
          ? snapshot.envido.pending?.by
          : null;
    const actor =
      snapshot.priority.active === 'play'
        ? snapshot.activeSeatId
        : snapshot.seats.find((seat) => seat.team !== pendingTeam)?.id;
    assert.ok(actor);
    const observation = observeForAi(snapshot, actor, rules);
    const command = choosePracticeAiCommand(
      observation,
      'aprendiz',
      steps + 17,
    );
    assert.ok(
      observation.legalCommands.some(
        (legal) => JSON.stringify(legal) === JSON.stringify(command),
      ),
    );
    snapshot = transition(
      snapshot,
      actor,
      command,
      rules,
      `match-${steps}`,
    ).state;
    steps += 1;
  }
  assert.ok(steps < 500, 'el partido debe terminar sin bucles');
  assert.equal(snapshot.match.complete, true);
  assert.ok(snapshot.handNumber > 1);
  assert.equal(snapshot.match.score[snapshot.match.winner ?? 'A'], 12);
});

void test('la proyección solo expone cartas ya públicas del rival', () => {
  const snapshot = practiceSnapshot();
  const publicCard: TrucoCard = { rank: 2, suit: 'oros' };
  snapshot.played.push({ seatId: 'human', team: 'A', card: publicCard });
  snapshot.activeSeatId = 'bot';
  const observation = observeForAi(snapshot, 'bot', rules);
  assert.deepEqual(observation.played[0].card, publicCard);
  assert.equal(JSON.stringify(observation).includes('5-espadas'), false);
});

void test('complete seeded games progress in both formats with Flor and both parda modes', () => {
  let completed = 0;
  for (const size of [2, 4])
    for (const florMode of ['off', 'a-ley', 'por-derecho'] as const)
      for (const pardaMode of ['abierta', 'cerrada'] as const)
        for (const difficulty of ['aprendiz', 'criollo', 'maestro'] as const) {
          let seed = 3109 + completed;
          const deck = () => {
            const cards = createSpanishDeck();
            for (let index = cards.length - 1; index; index--) {
              seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
              const other = seed % (index + 1);
              [cards[index], cards[other]] = [cards[other], cards[index]];
            }
            return cards;
          };
          const players = Array.from({ length: size }, (_, index) => ({
            id: `p${index}`,
            team: index % 2 ? ('B' as const) : ('A' as const),
          }));
          const tableRules = { ...rules, florMode, pardaMode };
          let state = createEngineSnapshot({
            deck: deck(),
            seats: players,
            dealerSeatId: 'p0',
            target: 24,
            gamesToWin: 2,
            rules: tableRules,
          });
          let turns = 0;
          while (!state.match.complete && turns++ < 2000) {
            if (state.handComplete) {
              state = beginNextHand(state, deck());
              continue;
            }
            const observations = players.map((player) =>
              observeForAi(state, player.id),
            );
            const actor = observations.find(
              (observation) => observation.legalCommands.length,
            );
            assert.ok(
              actor,
              `No legal actor: ${size}/${florMode}/${pardaMode}/${difficulty}`,
            );
            const command = choosePracticeAiCommand(
              actor,
              difficulty,
              seed + turns,
            );
            const before = JSON.stringify(state);
            const next = transition(
              state,
              actor.aiSeatId,
              command,
              tableRules,
            ).state;
            assert.equal(
              JSON.stringify(state),
              before,
              'transition must not mutate its input',
            );
            assert.equal(next.gameVersion, state.gameVersion + 1);
            state = next;
          }
          assert.ok(
            state.match.complete,
            `Game stalled: ${size}/${florMode}/${pardaMode}/${difficulty}`,
          );
          assert.equal(state.match.gameWins[state.match.winner!], 2);
          completed++;
        }
  assert.equal(completed, 36);
});
void test('the AI answers Envido using its tantos, not its strongest Truco card', () => {
  const state = practiceSnapshot();
  state.hands.bot = [
    { rank: 7, suit: 'copas' },
    { rank: 6, suit: 'copas' },
    { rank: 4, suit: 'oros' },
  ];
  state.dealtHands.bot = structuredClone(state.hands.bot);
  state.activeSeatId = 'human';
  const called = transition(
    state,
    'human',
    { type: 'CALL_ENVIDO', amount: 2 },
    rules,
  ).state;
  assert.deepEqual(
    choosePracticeAiCommand(observeForAi(called, 'bot'), 'criollo', 1),
    { type: 'ANSWER_CALL', answer: 'quiero' },
  );
});
