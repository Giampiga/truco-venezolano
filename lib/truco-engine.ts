import type { GameFormat } from './product-types.ts';
import {
  declarationWinner,
  envidoScore,
  florScore,
  getPieces,
  hasFlor,
  isFlorReservada,
  nextTrucoCall,
  trucoAcceptedValue,
  trucoRank,
  trucoRejectedValue,
  type TrucoCall,
  type TrucoCard,
} from './truco-rules.ts';

export type TeamId = 'A' | 'B';
export type SeatId = string;

export type Seat = {
  id: SeatId;
  team: TeamId;
};

export type Deal = {
  format: GameFormat;
  seatOrder: SeatId[];
  dealerSeatId: SeatId;
  manoSeatId: SeatId;
  hands: Record<SeatId, TrucoCard[]>;
  vira: TrucoCard;
  undealt: TrucoCard[];
};

export type TrickPlay = {
  seatId: SeatId;
  team: TeamId;
  card: TrucoCard;
};

export type TrickResult = {
  winnerTeam: TeamId | null;
  winningSeatId: SeatId | null;
  parda: boolean;
  rank: number;
};

export type PardaMode = 'abierta' | 'cerrada';
export type PardaEngine = 'apilada-clasica' | 'secuencial-online';

export type PardaStack = {
  top: TrucoCard;
  hidden: TrucoCard;
};

export type TrucoState = {
  accepted: TrucoCall;
  lastRaisedBy: TeamId | null;
  pending: null | {
    call: Exclude<TrucoCall, 'none'>;
    by: TeamId;
    bySeatId?: SeatId;
  };
};

export type EnvidoState = {
  status: 'idle' | 'pending' | 'accepted' | 'resolved';
  acceptedStake: number;
  pending: null | {
    by: TeamId;
    bySeatId?: SeatId;
    stake: number;
    rejectionAward: number;
    kind: 'envido' | 'n-mas' | 'falta';
  };
  winner: TeamId | null;
};

export type CallPriority = {
  active: 'play' | 'truco' | 'envido' | 'flor';
  suspendedTruco: TrucoState['pending'];
};

export type ScoreAward = {
  team: TeamId;
  amount: number | 'game';
  reason: 'flor' | 'envido' | 'truco' | 'prive';
};

export type MatchState = {
  target: number;
  score: Record<TeamId, number>;
  gamesToWin: 1 | 2;
  gameWins: Record<TeamId, number>;
  gameNumber: number;
  gameComplete: boolean;
  winner: TeamId | null;
  complete: boolean;
};

export type LegalAction =
  | 'play-card'
  | 'play-stack'
  | 'pass-card'
  | 'fold'
  | 'call-envido'
  | 'call-falta'
  | 'declare-flor'
  | 'call-flor-envida'
  | 'call-truco'
  | 'answer-quiero'
  | 'answer-no-quiero'
  | 'raise-envido'
  | 'raise-truco';

export type EngineCommand =
  | { type: 'PLAY_CARD'; cardId: string; passed?: boolean }
  | { type: 'PLAY_STACK'; cardIds: [string, string] }
  | { type: 'PASS_CARDS' }
  | { type: 'FOLD_HAND' }
  | { type: 'CALL_ENVIDO'; amount: 2 | 'falta' }
  | { type: 'RAISE_ENVIDO'; amount: number | 'falta' }
  | { type: 'DECLARE_FLOR'; mode: 'flor' | 'a-ley' }
  | { type: 'CALL_FLOR_ENVIDA' }
  | { type: 'CALL_TRUCO'; call: Exclude<TrucoCall, 'none'> }
  | { type: 'ANSWER_CALL'; answer: 'quiero' | 'no-quiero' }
  | { type: 'RAISE_TRUCO'; call: Exclude<TrucoCall, 'none'> };

export type LegalActionContext = {
  actorSeatId: SeatId;
  activeSeatId: SeatId;
  seats: Seat[];
  firstTrick: boolean;
  actorHasPlayedFirstCard: boolean;
  actorHand: TrucoCard[];
  vira: TrucoCard;
  florMode: 'off' | 'a-ley' | 'por-derecho';
  pardaMode: PardaMode;
  pardaEngine: PardaEngine;
  pardaRevealWindow?: boolean;
  actorDeclaredFlor?: boolean;
  opposingFlorDeclared?: boolean;
  actorPassedFirst?: boolean;
  truco: TrucoState;
  envido: EnvidoState;
  priority: CallPriority;
  matchComplete?: boolean;
  handComplete?: boolean;
};

export type EngineSnapshot = {
  schema: 1;
  gameVersion: number;
  format: GameFormat;
  seats: Seat[];
  dealerSeatId: SeatId;
  manoSeatId: SeatId;
  activeSeatId: SeatId;
  handNumber: number;
  trickNumber: number;
  handComplete: boolean;
  hands: Record<SeatId, TrucoCard[]>;
  dealtHands: Record<SeatId, TrucoCard[]>;
  handStartScore: Record<TeamId, number>;
  vira: TrucoCard;
  played: TrickPlay[];
  trickResults: TrickResult[];
  pardaStacks: Record<SeatId, PardaStack>;
  florDeclarations: SeatId[];
  truco: TrucoState;
  envido: EnvidoState;
  priority: CallPriority;
  match: MatchState;
  connection: 'online' | 'disconnected';
  appliedCommandIds: string[];
  rules: ExecutableRules;
};

export type ExecutableRules = {
  florMode: 'off' | 'a-ley' | 'por-derecho';
  pardaMode: PardaMode;
  pardaEngine: PardaEngine;
  florPoints: number;
};

export const DEFAULT_EXECUTABLE_RULES: ExecutableRules = {
  florMode: 'a-ley',
  pardaMode: 'abierta',
  pardaEngine: 'apilada-clasica',
  florPoints: 3,
};

export type TransitionResult = {
  state: EngineSnapshot;
  events: string[];
};

function assertUniqueDeck(deck: TrucoCard[]) {
  const ids = deck.map((card) => `${card.rank}-${card.suit}`);
  if (new Set(ids).size !== ids.length) {
    throw new Error('La baraja contiene cartas repetidas.');
  }
}

/** Deal one card at a time, counter-clockwise, beginning with Mano. */
export function dealCards(
  deck: readonly TrucoCard[],
  seats: readonly Seat[],
  dealerSeatId: SeatId,
): Deal {
  if (seats.length !== 2 && seats.length !== 4) {
    throw new Error('El Truco venezolano admite 2 o 4 asientos.');
  }
  if (deck.length < seats.length * 3 + 1) {
    throw new Error('No hay cartas suficientes para repartir.');
  }
  assertUniqueDeck([...deck]);
  const dealerIndex = seats.findIndex((seat) => seat.id === dealerSeatId);
  if (dealerIndex < 0) throw new Error('El Pie debe ocupar un asiento de la mesa.');

  const seatOrder = seats.map((seat) => seat.id);
  const recipientOrder = Array.from(
    { length: seats.length },
    (_, offset) => seatOrder[(dealerIndex + 1 + offset) % seats.length],
  );
  const hands = Object.fromEntries(seatOrder.map((id) => [id, []])) as Record<
    SeatId,
    TrucoCard[]
  >;
  let cursor = 0;
  for (let pass = 0; pass < 3; pass += 1) {
    for (const seatId of recipientOrder) {
      hands[seatId].push({ ...deck[cursor] });
      cursor += 1;
    }
  }
  const vira = { ...deck[cursor] };
  cursor += 1;

  return {
    format: seats.length === 2 ? '1v1' : '2v2',
    seatOrder,
    dealerSeatId,
    manoSeatId: recipientOrder[0],
    hands,
    vira,
    undealt: deck.slice(cursor).map((card) => ({ ...card })),
  };
}

export function nextDealer(seatOrder: readonly SeatId[], dealerSeatId: SeatId) {
  const current = seatOrder.indexOf(dealerSeatId);
  if (current < 0) throw new Error('El Pie no pertenece a esta mesa.');
  return seatOrder[(current + 1) % seatOrder.length];
}

export function manoForDealer(seatOrder: readonly SeatId[], dealerSeatId: SeatId) {
  return nextDealer(seatOrder, dealerSeatId);
}

export function resolveTrick(plays: readonly TrickPlay[], vira: TrucoCard): TrickResult {
  if (plays.length < 2) throw new Error('Una vuelta necesita al menos dos cartas.');
  const ranked = plays.map((play) => ({ play, rank: trucoRank(play.card, vira) }));
  const bestRank = Math.max(...ranked.map((entry) => entry.rank));
  const best = ranked.filter((entry) => entry.rank === bestRank);
  const teams = new Set(best.map((entry) => entry.play.team));
  if (teams.size > 1) {
    return { winnerTeam: null, winningSeatId: null, parda: true, rank: bestRank };
  }
  return {
    winnerTeam: best[0].play.team,
    winningSeatId: best[0].play.seatId,
    parda: false,
    rank: bestRank,
  };
}

/** Resolve the Venezuelan three-vuelta path, including Mano on total parda. */
export function resolveHandWinner(
  tricks: readonly TrickResult[],
  manoTeam: TeamId,
): TeamId | null {
  const first = tricks[0]?.winnerTeam ?? null;
  const second = tricks[1]?.winnerTeam ?? null;
  const third = tricks[2]?.winnerTeam ?? null;

  if (first && second === first) return first;
  if (first && tricks[1]?.parda) return first;
  if (tricks[0]?.parda && second) return second;
  if (first && second && first !== second) {
    if (third) return third;
    if (tricks[2]?.parda) return first;
  }
  if (tricks[0]?.parda && tricks[1]?.parda) {
    if (third) return third;
    if (tricks[2]?.parda) return manoTeam;
  }
  return null;
}

export function pardaContinuation(mode: PardaMode, trickNumber: number) {
  if (trickNumber !== 1) return null;
  return {
    cardsRequired: 2 as const,
    presentation: mode === 'abierta' ? 'mayor-arriba' : 'juntas-cerradas',
    allowsRaiseBetweenReveal: mode === 'abierta',
  };
}

export function createEngineSnapshot({
  deck,
  seats,
  dealerSeatId,
  target,
  gamesToWin = 1,
  rules = DEFAULT_EXECUTABLE_RULES,
}: {
  deck: readonly TrucoCard[];
  seats: Seat[];
  dealerSeatId: SeatId;
  target: number;
  gamesToWin?: 1 | 2;
  rules?: ExecutableRules;
}): EngineSnapshot {
  const deal = dealCards(deck, seats, dealerSeatId);
  return {
    schema: 1,
    gameVersion: 1,
    format: deal.format,
    seats: seats.map((seat) => ({ ...seat })),
    dealerSeatId,
    manoSeatId: deal.manoSeatId,
    activeSeatId: deal.manoSeatId,
    handNumber: 1,
    trickNumber: 1,
    handComplete: false,
    hands: deal.hands,
    dealtHands: Object.fromEntries(
      Object.entries(deal.hands).map(([seatId, hand]) => [
        seatId,
        hand.map((card) => ({ ...card })),
      ]),
    ),
    handStartScore: { A: 0, B: 0 },
    vira: deal.vira,
    played: [],
    trickResults: [],
    pardaStacks: {},
    florDeclarations: [],
    truco: createTrucoState(),
    envido: createEnvidoState(),
    priority: { active: 'play', suspendedTruco: null },
    match: {
      target,
      score: { A: 0, B: 0 },
      gamesToWin,
      gameWins: { A: 0, B: 0 },
      gameNumber: 1,
      gameComplete: false,
      winner: null,
      complete: false,
    },
    connection: 'online',
    appliedCommandIds: [],
    rules: { ...rules },
  };
}

export function createTrucoState(): TrucoState {
  return { accepted: 'none', lastRaisedBy: null, pending: null };
}

export function canRaiseTruco(state: TrucoState, team: TeamId) {
  if (state.pending) return state.pending.by !== team && nextTrucoCall(state.pending.call) !== null;
  return nextTrucoCall(state.accepted) !== null && state.lastRaisedBy !== team;
}

export function callTruco(state: TrucoState, by: TeamId): TrucoState {
  if (state.pending) throw new Error('Primero hay que responder el canto pendiente.');
  if (!canRaiseTruco(state, by)) throw new Error('Los aumentos de Truco deben alternar equipos.');
  const call = nextTrucoCall(state.accepted);
  if (!call || call === 'none') throw new Error('No queda otro aumento de Truco.');
  return { ...state, pending: { call, by } };
}

export function answerTruco(
  state: TrucoState,
  by: TeamId,
  answer: 'quiero' | 'no-quiero' | 'raise',
): { state: TrucoState; award: ScoreAward | null } {
  const pending = state.pending;
  if (!pending || pending.by === by) throw new Error('Este equipo no puede responder ese canto.');
  if (answer === 'no-quiero') {
    return {
      state: { ...state, pending: null },
      award: { team: pending.by, amount: trucoRejectedValue(pending.call), reason: 'truco' },
    };
  }

  const accepted: TrucoState = {
    accepted: pending.call,
    lastRaisedBy: pending.by,
    pending: null,
  };
  if (answer === 'quiero') return { state: accepted, award: null };
  const next = nextTrucoCall(pending.call);
  if (!next || next === 'none') throw new Error('Vale Juego no admite otro aumento.');
  return {
    state: { accepted: pending.call, lastRaisedBy: pending.by, pending: { call: next, by } },
    award: null,
  };
}

export function trucoHandAward(state: TrucoState, winner: TeamId): ScoreAward {
  return { team: winner, amount: trucoAcceptedValue(state.accepted), reason: 'truco' };
}

export function createEnvidoState(): EnvidoState {
  return { status: 'idle', acceptedStake: 0, pending: null, winner: null };
}

export function faltaValue(score: Record<TeamId, number>, target: number) {
  return Math.max(1, target - Math.max(score.A, score.B));
}

export function callEnvido(
  state: EnvidoState,
  by: TeamId,
  score: Record<TeamId, number>,
  target: number,
  kind: 'envido' | 'falta' = 'envido',
): EnvidoState {
  if (state.status !== 'idle') throw new Error('Ya existe un Envite en esta base.');
  const stake = kind === 'falta' ? faltaValue(score, target) : 2;
  return {
    status: 'pending',
    acceptedStake: 0,
    pending: { by, stake, rejectionAward: 1, kind },
    winner: null,
  };
}

export function raiseEnvido(
  state: EnvidoState,
  by: TeamId,
  score: Record<TeamId, number>,
  target: number,
  kind: 'envido' | 'n-mas' | 'falta',
  amount = 0,
): EnvidoState {
  const pending = state.pending;
  if (!pending || pending.by === by) throw new Error('El Envite debe replicarlo el equipo contrario.');
  if (kind === 'n-mas' && amount < 1) throw new Error('El aumento debe ser positivo.');
  const stake =
    kind === 'falta'
      ? faltaValue(score, target)
      : pending.stake + (kind === 'envido' ? 2 : amount);
  return {
    status: 'pending',
    acceptedStake: pending.stake,
    pending: { by, stake, rejectionAward: pending.stake, kind },
    winner: null,
  };
}

export function answerEnvido(
  state: EnvidoState,
  by: TeamId,
  answer: 'quiero' | 'no-quiero',
): { state: EnvidoState; award: ScoreAward | null } {
  const pending = state.pending;
  if (!pending || pending.by === by) throw new Error('Este equipo no puede responder ese Envite.');
  if (answer === 'no-quiero') {
    return {
      state: { ...state, status: 'resolved', pending: null, winner: pending.by },
      award: { team: pending.by, amount: pending.rejectionAward, reason: 'envido' },
    };
  }
  return {
    state: {
      ...state,
      status: 'accepted',
      acceptedStake: pending.stake,
      pending: null,
    },
    award: null,
  };
}

export function resolveEnvido(state: EnvidoState, winner: TeamId) {
  if (state.status !== 'accepted') throw new Error('El Envite todavía no fue querido.');
  return {
    state: { ...state, status: 'resolved' as const, winner },
    award: { team: winner, amount: state.acceptedStake, reason: 'envido' as const },
  };
}

export function interruptTrucoWithEnvido(priority: CallPriority, pending: TrucoState['pending']) {
  if (priority.active !== 'truco' || !pending) {
    throw new Error('Solo un Envite legal puede interrumpir una respuesta de Truco.');
  }
  return { active: 'envido' as const, suspendedTruco: pending };
}

export function finishPriorityCall(priority: CallPriority): CallPriority {
  if (priority.active !== 'envido' && priority.active !== 'flor') return priority;
  return priority.suspendedTruco
    ? { active: 'truco', suspendedTruco: priority.suspendedTruco }
    : { active: 'play', suspendedTruco: null };
}

export function resolveDeclarationTie(
  hands: Array<{ seatId: SeatId; hand: TrucoCard[] }>,
  vira: TrucoCard,
  manoOrder: readonly SeatId[],
  kind: 'envido' | 'flor',
) {
  const entries = hands
    .map(({ seatId, hand }) => ({
      id: seatId,
      value:
        kind === 'envido'
          ? envidoScore(hand, vira)
          : florScore(hand, vira) === null
            ? null
            : (isFlorReservada(hand, vira) ? 1_000 : 0) + (florScore(hand, vira) ?? 0),
    }))
    .filter((entry): entry is { id: SeatId; value: number } => entry.value !== null);
  return declarationWinner(entries, manoOrder);
}

export function resolveFlor(
  declarations: Array<{ seatId: SeatId; team: TeamId; hand: TrucoCard[]; declared: boolean }>,
  vira: TrucoCard,
  manoOrder: readonly SeatId[],
  pointsPerFlor = 3,
) {
  const valid = declarations.filter(
    (entry) => entry.declared && hasFlor(entry.hand, vira),
  );
  const winnerSeatId = declarationWinner(
    valid.map((entry) => ({
      id: entry.seatId,
      value:
        (isFlorReservada(entry.hand, vira) ? 1_000 : 0) +
        (florScore(entry.hand, vira) ?? -1),
    })),
    manoOrder,
  );
  if (!winnerSeatId) return null;
  const winnerTeam = valid.find((entry) => entry.seatId === winnerSeatId)?.team;
  if (!winnerTeam) return null;
  const alliedFlowers = valid.filter((entry) => entry.team === winnerTeam).length;
  return {
    winnerSeatId,
    winnerTeam,
    points: alliedFlowers * pointsPerFlor,
    scores: Object.fromEntries(
      valid.map((entry) => [entry.seatId, florScore(entry.hand, vira)]),
    ) as Record<SeatId, number>,
  };
}

export function canDeclareFlor({
  mode,
  isPie,
  cardsPlayed,
  announcedALey,
}: {
  mode: 'off' | 'a-ley' | 'por-derecho';
  isPie: boolean;
  cardsPlayed: number;
  announcedALey: boolean;
}) {
  if (mode === 'off') return false;
  if (mode === 'por-derecho') return cardsPlayed === 0;
  if (isPie) return cardsPlayed === 0;
  return cardsPlayed === 0 || (cardsPlayed === 1 && announcedALey);
}

export function applyAwards(match: MatchState, awards: readonly ScoreAward[]): MatchState {
  const ordered = [...awards].sort((a, b) => {
    const priority = { flor: 0, envido: 0, prive: 0, truco: 1 } as const;
    return priority[a.reason] - priority[b.reason];
  });
  const next = {
    ...match,
    gamesToWin: match.gamesToWin ?? 1,
    gameWins: { ...(match.gameWins ?? { A: 0, B: 0 }) },
    gameNumber: match.gameNumber ?? 1,
    gameComplete: match.gameComplete ?? false,
    score: { ...match.score },
  };
  for (const award of ordered) {
    if (next.complete) break;
    if (award.amount === 'game') {
      next.score[award.team] = next.target;
    } else {
      next.score[award.team] += award.amount;
    }
    if (next.score[award.team] >= next.target) {
      next.score[award.team] = next.target;
      next.gameWins[award.team] += 1;
      next.gameComplete = true;
      if (next.gameWins[award.team] >= next.gamesToWin) {
        next.winner = award.team;
        next.complete = true;
      }
      break;
    }
  }
  return next;
}

export function privandoTeams(score: Record<TeamId, number>, target: number) {
  return (['A', 'B'] as TeamId[]).filter((team) => score[team] === target - 1);
}

export function resolvePrive(
  entries: Array<{ seatId: SeatId; team: TeamId; hand: TrucoCard[] }>,
  vira: TrucoCard,
  manoOrder: readonly SeatId[],
) {
  const winnerSeatId = resolveDeclarationTie(entries, vira, manoOrder, 'envido');
  const team = entries.find((entry) => entry.seatId === winnerSeatId)?.team ?? null;
  return team ? { team, amount: 1 as const, reason: 'prive' as const } : null;
}

export function legalActions(context: LegalActionContext): LegalAction[] {
  if (context.matchComplete || context.handComplete) return [];
  const actor = context.seats.find((seat) => seat.id === context.actorSeatId);
  if (!actor) return [];
  const active = context.actorSeatId === context.activeSeatId;
  const actorHasFlor = hasFlor(context.actorHand, context.vira);
  const effectiveFlor = context.florMode !== 'off' && actorHasFlor;
  const actorHasReservada = isFlorReservada(context.actorHand, context.vira);
  const actorDeclaredFlor = context.actorDeclaredFlor === true;

  if (context.priority.active === 'truco' && context.truco.pending) {
    if (context.truco.pending.by === actor.team) return [];
    if (effectiveFlor && !actorDeclaredFlor) {
      return context.opposingFlorDeclared
        ? ['declare-flor', 'call-flor-envida']
        : ['declare-flor'];
    }
    const actions: LegalAction[] = ['answer-quiero', 'answer-no-quiero'];
    if (nextTrucoCall(context.truco.pending.call)) actions.push('raise-truco');
    if (
      context.firstTrick &&
      !context.actorHasPlayedFirstCard &&
      (!effectiveFlor || actorHasReservada)
    ) {
      actions.push('call-envido', 'call-falta');
    }
    return actions;
  }

  if (
    (context.priority.active === 'envido' || context.priority.active === 'flor') &&
    context.envido.pending
  ) {
    if (context.envido.pending.by === actor.team) return [];
    if (
      context.priority.active === 'envido' &&
      effectiveFlor &&
      !actorDeclaredFlor &&
      context.florMode !== 'off'
    ) {
      return ['declare-flor'];
    }
    return ['answer-quiero', 'answer-no-quiero', 'raise-envido'];
  }

  if (!active || context.priority.active !== 'play') return [];
  const actions: LegalAction[] = [
    context.pardaRevealWindow
      ? 'play-stack'
      : 'play-card',
    'fold',
  ];
  if (context.firstTrick && !context.actorHasPlayedFirstCard) {
    if (!context.actorPassedFirst) actions.push('pass-card');
    if (
      context.envido.status === 'idle' &&
      (!effectiveFlor || actorHasReservada)
    ) {
      actions.push('call-envido', 'call-falta');
    }
    if (effectiveFlor && !actorDeclaredFlor) {
      actions.push('declare-flor');
      if (context.opposingFlorDeclared) actions.push('call-flor-envida');
    }
  }
  if (
    canRaiseTruco(context.truco, actor.team) &&
    !(context.pardaRevealWindow && context.pardaMode === 'cerrada')
  ) {
    actions.push('call-truco');
  }
  return [...new Set(actions)];
}

function idForCard(card: TrucoCard) {
  return `${card.rank}-${card.suit}`;
}

function teamForSeat(snapshot: EngineSnapshot, seatId: SeatId) {
  const team = snapshot.seats.find((seat) => seat.id === seatId)?.team;
  if (!team) throw new Error('El asiento no pertenece a la mesa.');
  return team;
}

/** The complete three-card deal remains available for Envite/Flor after cards are played. */
export function dealtHandForSeat(snapshot: EngineSnapshot, seatId: SeatId) {
  const dealt = snapshot.dealtHands?.[seatId];
  if (dealt) return dealt;
  return [
    ...(snapshot.hands[seatId] ?? []),
    ...snapshot.played
      .filter((play) => play.seatId === seatId)
      .map((play) => play.card),
  ];
}

/** One authoritative legal-action projection shared by humans, network actors, and bots. */
export function legalActionsForSnapshot(
  snapshot: EngineSnapshot,
  actorSeatId: SeatId,
  rules: ExecutableRules = snapshot.rules ?? DEFAULT_EXECUTABLE_RULES,
) {
  const actor = snapshot.seats.find((seat) => seat.id === actorSeatId);
  if (!actor) return [];
  const pardaRevealWindow =
    snapshot.trickResults[0]?.parda === true &&
    snapshot.trickNumber === 2 &&
    Object.keys(snapshot.pardaStacks ?? {}).length < snapshot.seats.length;
  const actorHand = dealtHandForSeat(snapshot, actorSeatId);
  const currentHand = snapshot.hands[actorSeatId] ?? [];
  const opposingFlorDeclared = snapshot.florDeclarations.some(
    (seatId) => teamForSeat(snapshot, seatId) !== actor.team,
  );
  return legalActions({
    actorSeatId,
    activeSeatId: snapshot.activeSeatId,
    seats: snapshot.seats,
    firstTrick: snapshot.trickNumber === 1,
    actorHasPlayedFirstCard: snapshot.played.some(
      (play) => play.seatId === actorSeatId,
    ),
    actorHand,
    vira: snapshot.vira,
    florMode: rules.florMode,
    pardaMode: rules.pardaMode,
    pardaEngine: rules.pardaEngine,
    pardaRevealWindow,
    actorDeclaredFlor: snapshot.florDeclarations.includes(actorSeatId),
    opposingFlorDeclared,
    actorPassedFirst:
      currentHand.length > 0 && currentHand.every((card) => card.passed === true),
    truco: snapshot.truco,
    envido: snapshot.envido,
    priority: snapshot.priority,
    matchComplete: snapshot.match.complete,
    handComplete: snapshot.handComplete,
  });
}

function resolvePardaStacks(snapshot: EngineSnapshot) {
  const order = manoOrder(snapshot);
  const topPlays = order.map((seatId) => ({
    seatId,
    team: teamForSeat(snapshot, seatId),
    card: snapshot.pardaStacks[seatId].top,
  }));
  const topResult = resolveTrick(topPlays, snapshot.vira);
  if (!topResult.parda && topResult.winnerTeam && topResult.winningSeatId) {
    return {
      winnerTeam: topResult.winnerTeam,
      winnerSeatId: topResult.winningSeatId,
      result: topResult,
      usedHidden: false,
      hiddenParda: false,
    };
  }

  const topRank = Math.max(
    ...topPlays.map((play) => trucoRank(play.card, snapshot.vira)),
  );
  const contenders = topPlays.filter(
    (play) => trucoRank(play.card, snapshot.vira) === topRank,
  );
  const hiddenRanks = contenders.map((play) => ({
    seatId: play.seatId,
    team: play.team,
    rank: trucoRank(snapshot.pardaStacks[play.seatId].hidden, snapshot.vira),
  }));
  const bestHiddenRank = Math.max(...hiddenRanks.map((entry) => entry.rank));
  const bestHidden = hiddenRanks.filter((entry) => entry.rank === bestHiddenRank);
  const winnerSeatId = order.find((seatId) =>
    bestHidden.some((entry) => entry.seatId === seatId),
  );
  if (!winnerSeatId) throw new Error('No se pudo resolver la parda apilada.');
  const winnerTeam = teamForSeat(snapshot, winnerSeatId);
  return {
    winnerTeam,
    winnerSeatId,
    result: {
      winnerTeam,
      winningSeatId: winnerSeatId,
      parda: false,
      rank: bestHiddenRank,
    } satisfies TrickResult,
    usedHidden: true,
    hiddenParda: new Set(bestHidden.map((entry) => entry.team)).size > 1,
  };
}

function settleDeclaredFlor(
  snapshot: EngineSnapshot,
  rules: ExecutableRules,
  events: string[],
) {
  const entries = snapshot.seats.map((seat) => ({
    seatId: seat.id,
    team: seat.team,
    hand: dealtHandForSeat(snapshot, seat.id),
    declared: hasFlor(dealtHandForSeat(snapshot, seat.id), snapshot.vira),
  }));
  const holders = entries.filter((entry) => entry.declared).map((entry) => entry.seatId);
  snapshot.florDeclarations = [...new Set([...snapshot.florDeclarations, ...holders])];
  const resolution = resolveFlor(entries, snapshot.vira, manoOrder(snapshot), rules.florPoints);
  if (!resolution) throw new Error('No se pudo resolver la Flor declarada.');
  snapshot.envido = { ...createEnvidoState(), status: 'resolved', winner: resolution.winnerTeam };
  snapshot.match = applyAwards(snapshot.match, [
    { team: resolution.winnerTeam, amount: resolution.points, reason: 'flor' },
  ]);
  snapshot.priority = finishPriorityCall(snapshot.priority);
  events.push(
    `La Flor fue para ${resolution.winnerTeam} por ${resolution.points} piedras.`,
  );
  if (snapshot.match.gameComplete) {
    snapshot.handComplete = true;
    events.push(
      snapshot.match.complete
        ? `La Flor cerró la serie: ganó ${resolution.winnerTeam}.`
        : `La Flor cerró el chico para ${resolution.winnerTeam}.`,
    );
  }
}

function opponentOf(team: TeamId): TeamId {
  return team === 'A' ? 'B' : 'A';
}

function requiredAction(command: EngineCommand): LegalAction {
  if (command.type === 'PLAY_CARD') return 'play-card';
  if (command.type === 'PLAY_STACK') return 'play-stack';
  if (command.type === 'PASS_CARDS') return 'pass-card';
  if (command.type === 'FOLD_HAND') return 'fold';
  if (command.type === 'CALL_ENVIDO') {
    return command.amount === 'falta' ? 'call-falta' : 'call-envido';
  }
  if (command.type === 'RAISE_ENVIDO') return 'raise-envido';
  if (command.type === 'DECLARE_FLOR') return 'declare-flor';
  if (command.type === 'CALL_FLOR_ENVIDA') return 'call-flor-envida';
  if (command.type === 'CALL_TRUCO') return 'call-truco';
  if (command.type === 'RAISE_TRUCO') return 'raise-truco';
  return command.answer === 'quiero' ? 'answer-quiero' : 'answer-no-quiero';
}

function manoOrder(snapshot: EngineSnapshot) {
  const start = snapshot.seats.findIndex((seat) => seat.id === snapshot.manoSeatId);
  return Array.from(
    { length: snapshot.seats.length },
    (_, offset) => snapshot.seats[(start + offset) % snapshot.seats.length].id,
  );
}

/**
 * Pure authoritative transition used by online-command validation and local
 * practice. Actor identity is supplied outside the command, so a bot cannot
 * impersonate another seat.
 */
export function transition(
  snapshot: EngineSnapshot,
  actorSeatId: SeatId,
  command: EngineCommand,
  rules: ExecutableRules,
  commandId = `${snapshot.gameVersion}:${actorSeatId}:${command.type}`,
): TransitionResult {
  if (snapshot.appliedCommandIds.includes(commandId)) {
    return { state: snapshot, events: ['Comando duplicado ignorado.'] };
  }
  if (snapshot.connection !== 'online') throw new Error('La mesa está reconectando.');
  if (snapshot.match.complete || snapshot.handComplete) throw new Error('La base ya terminó.');
  if (JSON.stringify(snapshot.rules ?? rules) !== JSON.stringify(rules)) {
    throw new Error('Las reglas firmadas de esta base no pueden cambiar a mitad de juego.');
  }

  const actorTeam = teamForSeat(snapshot, actorSeatId);
  const actionIds = legalActionsForSnapshot(snapshot, actorSeatId, rules);
  const needed = requiredAction(command);
  if (!actionIds.includes(needed)) throw new Error(`Acción ilegal ahora: ${needed}.`);

  const next: EngineSnapshot = {
    ...snapshot,
    gameVersion: snapshot.gameVersion + 1,
    hands: Object.fromEntries(
      Object.entries(snapshot.hands).map(([seatId, hand]) => [
        seatId,
        hand.map((card) => ({ ...card })),
      ]),
    ),
    dealtHands: Object.fromEntries(
      Object.entries(snapshot.dealtHands).map(([seatId, hand]) => [
        seatId,
        hand.map((card) => ({ ...card })),
      ]),
    ),
    handStartScore: { ...snapshot.handStartScore },
    played: snapshot.played.map((play) => ({ ...play, card: { ...play.card } })),
    trickResults: snapshot.trickResults.map((result) => ({ ...result })),
    pardaStacks: Object.fromEntries(
      Object.entries(snapshot.pardaStacks).map(([seatId, stack]) => [
        seatId,
        { top: { ...stack.top }, hidden: { ...stack.hidden } },
      ]),
    ),
    florDeclarations: [...snapshot.florDeclarations],
    truco: {
      ...snapshot.truco,
      pending: snapshot.truco.pending ? { ...snapshot.truco.pending } : null,
    },
    envido: {
      ...snapshot.envido,
      pending: snapshot.envido.pending ? { ...snapshot.envido.pending } : null,
    },
    priority: { ...snapshot.priority },
    match: { ...snapshot.match, score: { ...snapshot.match.score } },
    appliedCommandIds: [...snapshot.appliedCommandIds, commandId].slice(-100),
    rules: { ...snapshot.rules },
  };
  const events: string[] = [];

  if (command.type === 'PLAY_CARD') {
    const hand = next.hands[actorSeatId] ?? [];
    const cardIndex = hand.findIndex((card) => idForCard(card) === command.cardId);
    if (cardIndex < 0) throw new Error('La carta no está en la mano del actor.');
    const [card] = hand.splice(cardIndex, 1);
    if (command.passed && !card.passed) {
      throw new Error('Una carta solo queda pasada mediante la acción de pasar.');
    }
    next.played.push({ actorSeatId, seatId: actorSeatId, team: actorTeam, card } as TrickPlay);
    events.push(`${actorSeatId} jugó ${card.rank} de ${card.suit}.`);

    const trickPlays = next.played.slice((next.trickNumber - 1) * next.seats.length);
    if (trickPlays.length < next.seats.length) {
      const actorIndex = next.seats.findIndex((seat) => seat.id === actorSeatId);
      next.activeSeatId = next.seats[(actorIndex + 1) % next.seats.length].id;
      return { state: next, events };
    }

    const result = resolveTrick(trickPlays, next.vira);
    next.trickResults.push(result);
    const manoTeam = teamForSeat(next, next.manoSeatId);
    const winner = resolveHandWinner(next.trickResults, manoTeam);
    events.push(result.parda ? 'La vuelta quedó parda.' : `La vuelta fue para ${result.winnerTeam}.`);
    if (winner) {
      next.match = applyAwards(next.match, [trucoHandAward(next.truco, winner)]);
      next.handComplete = true;
      next.activeSeatId = result.winningSeatId ?? next.manoSeatId;
      events.push(`La base fue para ${winner}.`);
      if (next.match.complete) events.push(`Serie terminada: ganó ${winner}.`);
      else if (next.match.gameComplete) events.push(`Chico ganado por ${winner}.`);
      return { state: next, events };
    }
    next.trickNumber += 1;
    next.activeSeatId = result.winningSeatId ?? next.manoSeatId;
    return { state: next, events };
  }

  if (command.type === 'PLAY_STACK') {
    const hand = next.hands[actorSeatId] ?? [];
    if (hand.length !== 2 || new Set(command.cardIds).size !== 2) {
      throw new Error('La parda exige exactamente las dos cartas restantes.');
    }
    const top = hand.find((card) => idForCard(card) === command.cardIds[0]);
    const hidden = hand.find((card) => idForCard(card) === command.cardIds[1]);
    if (!top || !hidden) throw new Error('La pila contiene una carta ajena.');
    if (trucoRank(top, next.vira) < trucoRank(hidden, next.vira)) {
      throw new Error('En la parda tradicional la carta mayor debe ir arriba.');
    }
    next.hands[actorSeatId] = [];
    next.pardaStacks[actorSeatId] = {
      top: { ...top },
      hidden: { ...hidden },
    };
    next.played.push({ seatId: actorSeatId, team: actorTeam, card: { ...top } });
    events.push(`${actorSeatId} apiló sus dos cartas con la mayor arriba.`);

    if (Object.keys(next.pardaStacks).length < next.seats.length) {
      const actorIndex = next.seats.findIndex((seat) => seat.id === actorSeatId);
      next.activeSeatId = next.seats[(actorIndex + 1) % next.seats.length].id;
      return { state: next, events };
    }

    const resolution = resolvePardaStacks(next);
    next.trickResults.push(resolution.result);
    next.match = applyAwards(next.match, [
      trucoHandAward(next.truco, resolution.winnerTeam),
    ]);
    next.handComplete = true;
    next.activeSeatId = resolution.winnerSeatId;
    events.push(
      resolution.usedHidden
        ? resolution.hiddenParda
          ? `La tapada también fue parda; manda ${resolution.winnerSeatId} por Mano.`
          : `Se destapó el desempate: la base fue para ${resolution.winnerTeam}.`
        : `La carta de arriba resolvió la base para ${resolution.winnerTeam}.`,
    );
    if (next.match.complete) events.push(`Serie terminada: ganó ${resolution.winnerTeam}.`);
    else if (next.match.gameComplete) events.push(`Chico ganado por ${resolution.winnerTeam}.`);
    return { state: next, events };
  }

  if (command.type === 'PASS_CARDS') {
    next.hands[actorSeatId] = next.hands[actorSeatId].map((card) => ({ ...card, passed: true }));
    events.push(`${actorSeatId} pasó sus tres cartas.`);
    return { state: next, events };
  }

  if (command.type === 'FOLD_HAND') {
    next.match = applyAwards(next.match, [trucoHandAward(next.truco, opponentOf(actorTeam))]);
    next.handComplete = true;
    events.push(`${actorSeatId} se fue al mazo.`);
    return { state: next, events };
  }

  if (command.type === 'CALL_TRUCO') {
    const called = callTruco(next.truco, actorTeam);
    if (called.pending?.call !== command.call) throw new Error('Ese aumento no sigue la escalera.');
    next.truco = called;
    if (next.truco.pending) next.truco.pending.bySeatId = actorSeatId;
    next.priority = { active: 'truco', suspendedTruco: null };
    events.push(`Canto pendiente: ${command.call}.`);
    return { state: next, events };
  }

  if (command.type === 'RAISE_TRUCO') {
    const answered = answerTruco(next.truco, actorTeam, 'raise');
    if (answered.state.pending?.call !== command.call) throw new Error('Ese repique no sigue la escalera.');
    next.truco = answered.state;
    if (next.truco.pending) next.truco.pending.bySeatId = actorSeatId;
    next.priority = { active: 'truco', suspendedTruco: null };
    events.push(`Quiero y ${command.call}.`);
    return { state: next, events };
  }

  if (command.type === 'CALL_ENVIDO') {
    const interrupted = next.priority.active === 'truco';
    next.envido = callEnvido(
      next.envido,
      actorTeam,
      next.match.score,
      next.match.target,
      command.amount === 'falta' ? 'falta' : 'envido',
    );
    if (next.envido.pending) next.envido.pending.bySeatId = actorSeatId;
    next.priority = interrupted
      ? interruptTrucoWithEnvido(next.priority, next.truco.pending)
      : { active: 'envido', suspendedTruco: null };
    events.push(command.amount === 'falta' ? 'Falta Envido.' : 'Envido.');
    return { state: next, events };
  }

  if (command.type === 'RAISE_ENVIDO') {
    next.envido = raiseEnvido(
      next.envido,
      actorTeam,
      next.match.score,
      next.match.target,
      command.amount === 'falta' ? 'falta' : command.amount === 2 ? 'envido' : 'n-mas',
      typeof command.amount === 'number' ? command.amount : 0,
    );
    if (next.envido.pending) next.envido.pending.bySeatId = actorSeatId;
    events.push(command.amount === 'falta' ? 'Quiero y la falta.' : `Quiero y ${command.amount} más.`);
    return { state: next, events };
  }

  if (command.type === 'DECLARE_FLOR') {
    if (!hasFlor(dealtHandForSeat(next, actorSeatId), next.vira)) {
      throw new Error('La mano no tiene Flor.');
    }
    if (!next.florDeclarations.includes(actorSeatId)) next.florDeclarations.push(actorSeatId);
    events.push(command.mode === 'a-ley' ? 'A ley.' : 'Flor tengo.');
    if (next.priority.active === 'truco') {
      next.priority = { active: 'flor', suspendedTruco: next.truco.pending };
    } else if (next.priority.active === 'envido') {
      next.priority = {
        active: 'flor',
        suspendedTruco: next.priority.suspendedTruco,
      };
    }
    settleDeclaredFlor(next, rules, events);
    return { state: next, events };
  }

  if (command.type === 'CALL_FLOR_ENVIDA') {
    if (!hasFlor(dealtHandForSeat(next, actorSeatId), next.vira)) {
      throw new Error('La mano no tiene Flor.');
    }
    if (!next.florDeclarations.includes(actorSeatId)) next.florDeclarations.push(actorSeatId);
    next.envido = callEnvido(next.envido, actorTeam, next.match.score, next.match.target);
    if (next.envido.pending) next.envido.pending.bySeatId = actorSeatId;
    next.priority = { active: 'flor', suspendedTruco: next.truco.pending };
    events.push('Mi Flor envida.');
    return { state: next, events };
  }

  if (command.type === 'ANSWER_CALL') {
    if (next.priority.active === 'truco') {
      const answered = answerTruco(next.truco, actorTeam, command.answer);
      next.truco = answered.state;
      next.priority = { active: 'play', suspendedTruco: null };
      if (answered.award) {
        next.match = applyAwards(next.match, [answered.award]);
        next.handComplete = true;
      }
      events.push(command.answer === 'quiero' ? 'Quiero.' : 'No quiero.');
      return { state: next, events };
    }

    if (next.priority.active === 'envido' || next.priority.active === 'flor') {
      const priorityKind = next.priority.active;
      const answered = answerEnvido(next.envido, actorTeam, command.answer);
      next.envido = answered.state;
      const awards: ScoreAward[] = [];
      if (answered.award) awards.push(answered.award);
      if (command.answer === 'quiero') {
        const entries = next.seats.map((seat) => ({
          seatId: seat.id,
          team: seat.team,
          hand: dealtHandForSeat(next, seat.id),
        }));
        const winnerSeat = resolveDeclarationTie(
          entries,
          next.vira,
          manoOrder(next),
          priorityKind === 'flor' ? 'flor' : 'envido',
        );
        const winnerTeam = entries.find((entry) => entry.seatId === winnerSeat)?.team;
        if (!winnerTeam) throw new Error('No se pudo resolver el canto.');
        const resolution = resolveEnvido(next.envido, winnerTeam);
        next.envido = resolution.state;
        awards.push(resolution.award);
        if (priorityKind === 'flor') {
          const flor = resolveFlor(
            entries.map((entry) => ({ ...entry, declared: hasFlor(entry.hand, next.vira) })),
            next.vira,
            manoOrder(next),
            rules.florPoints,
          );
          if (flor) awards.push({ team: flor.winnerTeam, amount: flor.points, reason: 'flor' });
        }
      }
      next.match = applyAwards(next.match, awards);
      next.priority = finishPriorityCall(next.priority);
      if (next.match.gameComplete) {
        next.handComplete = true;
        next.truco.pending = null;
        next.priority = { active: 'play', suspendedTruco: null };
        events.push(
          next.match.complete
            ? 'El Envite/Flor cerró la serie; el Truco pendiente no suma.'
            : 'El Envite/Flor cerró el chico; el Truco pendiente no suma.',
        );
      }
      events.push(command.answer === 'quiero' ? 'Canto querido y resuelto.' : 'Canto no querido.');
      return { state: next, events };
    }
  }

  throw new Error('Comando reconocido pero sin transición.');
}

export function beginNextHand(
  snapshot: EngineSnapshot,
  deck: readonly TrucoCard[],
): EngineSnapshot {
  if (!snapshot.handComplete || snapshot.match.complete) {
    throw new Error('No corresponde repartir una nueva base.');
  }
  const dealerSeatId = nextDealer(snapshot.seats.map((seat) => seat.id), snapshot.dealerSeatId);
  const deal = dealCards(deck, snapshot.seats, dealerSeatId);
  const match = snapshot.match.gameComplete
    ? {
        ...snapshot.match,
        score: { A: 0, B: 0 },
        gameNumber: snapshot.match.gameNumber + 1,
        gameComplete: false,
      }
    : { ...snapshot.match, score: { ...snapshot.match.score } };
  return {
    ...snapshot,
    gameVersion: snapshot.gameVersion + 1,
    dealerSeatId,
    manoSeatId: deal.manoSeatId,
    activeSeatId: deal.manoSeatId,
    handNumber: snapshot.handNumber + 1,
    trickNumber: 1,
    handComplete: false,
    hands: deal.hands,
    dealtHands: Object.fromEntries(
      Object.entries(deal.hands).map(([seatId, hand]) => [
        seatId,
        hand.map((card) => ({ ...card })),
      ]),
    ),
    handStartScore: { ...match.score },
    vira: deal.vira,
    played: [],
    trickResults: [],
    pardaStacks: {},
    florDeclarations: [],
    truco: createTrucoState(),
    envido: createEnvidoState(),
    priority: { active: 'play', suspendedTruco: null },
    match,
    appliedCommandIds: [...snapshot.appliedCommandIds],
  };
}

export function restartCurrentHand(snapshot: EngineSnapshot): EngineSnapshot {
  return {
    ...snapshot,
    gameVersion: snapshot.gameVersion + 1,
    activeSeatId: snapshot.manoSeatId,
    trickNumber: 1,
    handComplete: false,
    hands: Object.fromEntries(
      Object.entries(snapshot.dealtHands).map(([seatId, hand]) => [
        seatId,
        hand.map((card) => ({ ...card })),
      ]),
    ),
    played: [],
    trickResults: [],
    pardaStacks: {},
    florDeclarations: [],
    truco: createTrucoState(),
    envido: createEnvidoState(),
    priority: { active: 'play', suspendedTruco: null },
    match: {
      ...snapshot.match,
      score: { ...snapshot.handStartScore },
      gameComplete: false,
      winner: null,
      complete: false,
    },
    connection: 'online',
    appliedCommandIds: [...snapshot.appliedCommandIds],
  };
}

export function projectPublic(snapshot: EngineSnapshot) {
  return {
    schema: snapshot.schema,
    gameVersion: snapshot.gameVersion,
    format: snapshot.format,
    seats: snapshot.seats.map((seat) => ({ ...seat })),
    dealerSeatId: snapshot.dealerSeatId,
    manoSeatId: snapshot.manoSeatId,
    activeSeatId: snapshot.activeSeatId,
    handNumber: snapshot.handNumber,
    trickNumber: snapshot.trickNumber,
    handComplete: snapshot.handComplete,
    vira: { ...snapshot.vira },
    played: snapshot.played.map((play) => ({ ...play, card: { ...play.card } })),
    trickResults: snapshot.trickResults.map((result) => ({ ...result })),
    pardaTops: Object.fromEntries(
      Object.entries(snapshot.pardaStacks).map(([seatId, stack]) => [
        seatId,
        { ...stack.top },
      ]),
    ),
    cardCounts: Object.fromEntries(
      snapshot.seats.map((seat) => [seat.id, snapshot.hands[seat.id]?.length ?? 0]),
    ),
    florDeclarations: [...snapshot.florDeclarations],
    truco: {
      ...snapshot.truco,
      pending: snapshot.truco.pending ? { ...snapshot.truco.pending } : null,
    },
    envido: {
      ...snapshot.envido,
      pending: snapshot.envido.pending ? { ...snapshot.envido.pending } : null,
    },
    priority: { ...snapshot.priority },
    match: { ...snapshot.match, score: { ...snapshot.match.score } },
    connection: snapshot.connection,
    rules: { ...snapshot.rules },
  };
}

export function projectPrivate(snapshot: EngineSnapshot, seatId: SeatId) {
  teamForSeat(snapshot, seatId);
  return {
    seatId,
    hand: (snapshot.hands[seatId] ?? []).map((card) => ({ ...card })),
    dealtHand: dealtHandForSeat(snapshot, seatId).map((card) => ({ ...card })),
    pardaStack: snapshot.pardaStacks[seatId]
      ? {
          top: { ...snapshot.pardaStacks[seatId].top },
          hidden: { ...snapshot.pardaStacks[seatId].hidden },
        }
      : null,
  };
}

export function serializeSnapshot(snapshot: EngineSnapshot) {
  return JSON.stringify(snapshot);
}

export function resumeSnapshot(serialized: string): EngineSnapshot {
  const parsed = JSON.parse(serialized) as EngineSnapshot;
  if (parsed.schema !== 1 || !['1v1', '2v2'].includes(parsed.format)) {
    throw new Error('El snapshot de la mesa no es compatible.');
  }
  return {
    ...parsed,
    rules: { ...(parsed.rules ?? DEFAULT_EXECUTABLE_RULES) },
    seats: parsed.seats.map((seat) => ({ ...seat })),
    hands: Object.fromEntries(
      Object.entries(parsed.hands).map(([seat, cards]) => [
        seat,
        cards.map((card) => ({ ...card })),
      ]),
    ),
    dealtHands: Object.fromEntries(
      Object.entries(parsed.dealtHands ?? parsed.hands).map(([seat, cards]) => [
        seat,
        cards.map((card) => ({ ...card })),
      ]),
    ),
    handStartScore: { ...(parsed.handStartScore ?? parsed.match.score) },
    vira: { ...parsed.vira },
    played: parsed.played.map((play) => ({ ...play, card: { ...play.card } })),
    pardaStacks: Object.fromEntries(
      Object.entries(parsed.pardaStacks ?? {}).map(([seat, stack]) => [
        seat,
        { top: { ...stack.top }, hidden: { ...stack.hidden } },
      ]),
    ),
    match: {
      ...parsed.match,
      gamesToWin: parsed.match.gamesToWin ?? 1,
      gameWins: { ...(parsed.match.gameWins ?? { A: 0, B: 0 }) },
      gameNumber: parsed.match.gameNumber ?? 1,
      gameComplete: parsed.match.gameComplete ?? false,
      score: { ...parsed.match.score },
    },
  };
}

export function disconnectSnapshot(snapshot: EngineSnapshot): EngineSnapshot {
  return { ...snapshot, connection: 'disconnected' };
}

export function reconnectSnapshot(snapshot: EngineSnapshot): EngineSnapshot {
  return { ...snapshot, connection: 'online' };
}

export function describeVira(vira: TrucoCard) {
  const { perico, perica } = getPieces(vira);
  const substitution = vira.rank === 10 || vira.rank === 11;
  return {
    perico,
    perica,
    text: `Perico ${perico.rank} y Perica ${perica.rank} de ${vira.suit}.`,
    substitution: substitution
      ? `La vira ocupa el ${vira.rank}; el 12 de ${vira.suit} sustituye esa pieza.`
      : 'El 11 es Perico y el 10 es Perica en la pinta de la vira.',
  };
}
