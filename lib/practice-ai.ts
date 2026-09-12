import {
  envidoScore,
  hasFlor,
  isFlorReservada,
  nextTrucoCall,
  trucoRank,
  type TrucoCard,
} from './truco-rules.ts';
import {
  dealtHandForSeat,
  legalActionsForSnapshot,
  type EngineCommand,
  type EngineSnapshot,
  type ExecutableRules,
  type SeatId,
} from './truco-engine.ts';

export type PracticeDifficulty = 'aprendiz' | 'criollo' | 'maestro';

export type AiCard = TrucoCard & { id: string };

/**
 * This is the complete information boundary available to the bot. It omits
 * every rival hand and every undealt card by construction.
 */
export type AiObservation = {
  aiSeatId: SeatId;
  aiTeam: 'A' | 'B';
  ownHand: AiCard[];
  ownDealtHand: AiCard[];
  vira: TrucoCard;
  played: EngineSnapshot['played'];
  trickResults: EngineSnapshot['trickResults'];
  opponentCardCounts: Record<SeatId, number>;
  manoSeatId: SeatId;
  activeSeatId: SeatId;
  score: EngineSnapshot['match']['score'];
  target: number;
  truco: EngineSnapshot['truco'];
  envido: EngineSnapshot['envido'];
  priority: EngineSnapshot['priority'];
  legalCommands: EngineCommand[];
};

export function cardId(card: TrucoCard) {
  return `${card.rank}-${card.suit}`;
}

export function observeForAi(
  snapshot: EngineSnapshot,
  aiSeatId: SeatId,
  rules: ExecutableRules = snapshot.rules,
): AiObservation {
  const ai = snapshot.seats.find((seat) => seat.id === aiSeatId);
  if (!ai) throw new Error('La IA debe ocupar un asiento de la mesa.');
  const ownHand = (snapshot.hands[aiSeatId] ?? []).map((card) => ({
    ...card,
    id: cardId(card),
  }));
  const ownDealtHand = dealtHandForSeat(snapshot, aiSeatId).map((card) => ({
    ...card,
    id: cardId(card),
  }));
  const actions = legalActionsForSnapshot(snapshot, aiSeatId, rules);
  const legalCommands: EngineCommand[] = [];
  const nextAccepted = nextTrucoCall(snapshot.truco.accepted);
  const nextPending = snapshot.truco.pending
    ? nextTrucoCall(snapshot.truco.pending.call)
    : null;

  for (const action of actions) {
    if (action === 'play-card') {
      legalCommands.push(
        ...ownHand.map((card) => ({
          type: 'PLAY_CARD' as const,
          cardId: card.id,
        })),
      );
    } else if (action === 'play-stack' && ownHand.length >= 2) {
      const ordered = [...ownHand].sort(
        (a, b) => trucoRank(b, snapshot.vira) - trucoRank(a, snapshot.vira),
      );
      legalCommands.push({
        type: 'PLAY_STACK',
        cardIds: [ordered[0].id, ordered[1].id],
      });
    } else if (action === 'pass-card') {
      legalCommands.push({ type: 'PASS_CARDS' });
    } else if (action === 'fold') {
      legalCommands.push({ type: 'FOLD_HAND' });
    } else if (action === 'call-envido') {
      legalCommands.push({ type: 'CALL_ENVIDO', amount: 2 });
    } else if (action === 'call-falta') {
      legalCommands.push({ type: 'CALL_ENVIDO', amount: 'falta' });
    } else if (action === 'raise-envido') {
      legalCommands.push(
        { type: 'RAISE_ENVIDO', amount: 2 },
        { type: 'RAISE_ENVIDO', amount: 'falta' },
      );
    } else if (action === 'declare-flor') {
      legalCommands.push({ type: 'DECLARE_FLOR', mode: 'flor' });
    } else if (action === 'call-flor-envida') {
      legalCommands.push({ type: 'CALL_FLOR_ENVIDA' });
    } else if (
      action === 'call-truco' &&
      nextAccepted &&
      nextAccepted !== 'none'
    ) {
      legalCommands.push({ type: 'CALL_TRUCO', call: nextAccepted });
    } else if (action === 'answer-quiero') {
      legalCommands.push({ type: 'ANSWER_CALL', answer: 'quiero' });
    } else if (action === 'answer-no-quiero') {
      legalCommands.push({ type: 'ANSWER_CALL', answer: 'no-quiero' });
    } else if (
      action === 'raise-truco' &&
      nextPending &&
      nextPending !== 'none'
    ) {
      legalCommands.push({ type: 'RAISE_TRUCO', call: nextPending });
    }
  }

  const opponentCardCounts = Object.fromEntries(
    snapshot.seats
      .filter((seat) => seat.team !== ai.team)
      .map((seat) => [seat.id, snapshot.hands[seat.id]?.length ?? 0]),
  );

  return Object.freeze({
    aiSeatId,
    aiTeam: ai.team,
    ownHand: Object.freeze(
      ownHand.map((card) => Object.freeze(card)),
    ) as unknown as AiCard[],
    ownDealtHand: Object.freeze(
      ownDealtHand.map((card) => Object.freeze(card)),
    ) as unknown as AiCard[],
    vira: Object.freeze({ ...snapshot.vira }),
    played: Object.freeze(
      snapshot.played.map((play) =>
        Object.freeze({ ...play, card: Object.freeze({ ...play.card }) }),
      ),
    ) as unknown as EngineSnapshot['played'],
    trickResults: Object.freeze(
      snapshot.trickResults.map((result) => Object.freeze({ ...result })),
    ) as unknown as EngineSnapshot['trickResults'],
    opponentCardCounts: Object.freeze(opponentCardCounts),
    manoSeatId: snapshot.manoSeatId,
    activeSeatId: snapshot.activeSeatId,
    score: Object.freeze({ ...snapshot.match.score }),
    target: snapshot.match.target,
    truco: Object.freeze({
      ...snapshot.truco,
      pending: snapshot.truco.pending
        ? Object.freeze({ ...snapshot.truco.pending })
        : null,
    }),
    envido: Object.freeze({
      ...snapshot.envido,
      pending: snapshot.envido.pending
        ? Object.freeze({ ...snapshot.envido.pending })
        : null,
    }),
    priority: Object.freeze({ ...snapshot.priority }),
    legalCommands: Object.freeze(
      legalCommands.map((command) => Object.freeze(command)),
    ) as unknown as EngineCommand[],
  });
}

function seededUnit(seed: number) {
  let value = seed >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4_294_967_296;
}

function playCommands(observation: AiObservation) {
  return observation.legalCommands.filter(
    (command): command is Extract<EngineCommand, { type: 'PLAY_CARD' }> =>
      command.type === 'PLAY_CARD',
  );
}

function cardForCommand(observation: AiObservation, command: EngineCommand) {
  if (command.type !== 'PLAY_CARD') return null;
  return observation.ownHand.find((card) => card.id === command.cardId) ?? null;
}

function byStrength(observation: AiObservation, descending: boolean) {
  return [...playCommands(observation)].sort((a, b) => {
    const aCard = cardForCommand(observation, a);
    const bCard = cardForCommand(observation, b);
    const delta =
      trucoRank(aCard ?? observation.vira, observation.vira) -
      trucoRank(bCard ?? observation.vira, observation.vira);
    return descending ? -delta : delta;
  });
}

function findCommand<T extends EngineCommand['type']>(
  observation: AiObservation,
  type: T,
  predicate?: (command: Extract<EngineCommand, { type: T }>) => boolean,
) {
  return observation.legalCommands.find(
    (command): command is Extract<EngineCommand, { type: T }> =>
      command.type === type &&
      (!predicate || predicate(command as Extract<EngineCommand, { type: T }>)),
  );
}

export function choosePracticeAiCommand(
  observation: AiObservation,
  difficulty: PracticeDifficulty,
  seed: number,
): EngineCommand {
  if (observation.legalCommands.length === 0) {
    throw new Error('La IA no tiene una acción legal disponible.');
  }

  const flor = hasFlor(observation.ownDealtHand, observation.vira);
  const reservada = isFlorReservada(observation.ownDealtHand, observation.vira);
  const envido = envidoScore(observation.ownDealtHand, observation.vira);
  const ranks = observation.ownHand
    .map((card) => trucoRank(card, observation.vira))
    .sort((a, b) => b - a);
  const strongest = ranks[0] ?? 0;
  const second = ranks[1] ?? 0;
  const nearMatch =
    observation.score[observation.aiTeam] >= observation.target - 3;

  const declare = findCommand(observation, 'DECLARE_FLOR');
  if (declare && flor) return declare;

  if (difficulty === 'aprendiz') {
    const noQuiero = findCommand(
      observation,
      'ANSWER_CALL',
      (command) => command.answer === 'no-quiero',
    );
    if (noQuiero && strongest < 95) return noQuiero;
    const lowCards = byStrength(observation, false);
    if (lowCards.length) {
      return lowCards[
        Math.floor(seededUnit(seed) * lowCards.length) % lowCards.length
      ];
    }
    return observation.legalCommands[
      Math.floor(seededUnit(seed) * observation.legalCommands.length) %
        observation.legalCommands.length
    ];
  }

  const quiero = findCommand(
    observation,
    'ANSWER_CALL',
    (command) => command.answer === 'quiero',
  );
  const noQuiero = findCommand(
    observation,
    'ANSWER_CALL',
    (command) => command.answer === 'no-quiero',
  );
  const raiseTruco = findCommand(observation, 'RAISE_TRUCO');

  if (
    difficulty === 'maestro' &&
    raiseTruco &&
    (reservada || (strongest >= 96 && second >= 89))
  ) {
    return raiseTruco;
  }
  if (quiero || noQuiero) {
    return strongest >= (difficulty === 'maestro' ? 90 : 95) || reservada
      ? (quiero ?? raiseTruco ?? observation.legalCommands[0])
      : (noQuiero ?? quiero ?? observation.legalCommands[0]);
  }

  const falta = findCommand(
    observation,
    'CALL_ENVIDO',
    (command) => command.amount === 'falta',
  );
  const baseEnvido = findCommand(
    observation,
    'CALL_ENVIDO',
    (command) => command.amount === 2,
  );
  if (
    difficulty === 'maestro' &&
    falta &&
    (envido >= 34 || (nearMatch && envido >= 31))
  ) {
    return falta;
  }
  if (baseEnvido && envido >= (difficulty === 'maestro' ? 28 : 31))
    return baseEnvido;

  const florEnvida = findCommand(observation, 'CALL_FLOR_ENVIDA');
  if (florEnvida && (reservada || envido >= 34)) return florEnvida;

  const callTruco = findCommand(observation, 'CALL_TRUCO');
  if (
    callTruco &&
    (reservada ||
      (difficulty === 'maestro' ? strongest + second >= 184 : strongest >= 96))
  ) {
    return callTruco;
  }

  const cards = byStrength(observation, difficulty === 'criollo');
  if (cards.length) {
    if (
      difficulty === 'maestro' &&
      observation.played.length === 0 &&
      cards.length > 1
    ) {
      return cards[1];
    }
    return cards[0];
  }

  return observation.legalCommands[0];
}

export function explainAiChoice(
  observation: AiObservation,
  command: EngineCommand,
) {
  if (command.type === 'PLAY_CARD') {
    const card = cardForCommand(observation, command);
    return card
      ? `Eligió ${card.rank} de ${card.suit} comparando su fuerza con la vira visible; no conoce tu mano.`
      : 'Jugó una carta legal de su propia mano.';
  }
  if (command.type === 'CALL_ENVIDO') {
    return `Calculó ${envidoScore(observation.ownDealtHand, observation.vira)} de Envite usando solo sus tres cartas y la vira.`;
  }
  if (command.type === 'CALL_TRUCO' || command.type === 'RAISE_TRUCO') {
    return 'Aumentó el Truco por fuerza propia, posición y riesgo del marcador; no conoce las cartas ocultas.';
  }
  if (command.type === 'ANSWER_CALL') {
    return `Respondió “${command.answer === 'quiero' ? 'Quiero' : 'No quiero'}” según la apuesta y las cartas que conoce.`;
  }
  if (command.type === 'DECLARE_FLOR' || command.type === 'CALL_FLOR_ENVIDA') {
    return 'Tiene flor con las tres cartas de su mano.';
  }
  return 'Eligió una jugada válida según las reglas de la mesa.';
}
