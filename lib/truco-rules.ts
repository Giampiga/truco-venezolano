export type Suit = 'espadas' | 'bastos' | 'oros' | 'copas';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export type TrucoCard = {
  rank: Rank;
  suit: Suit;
  passed?: boolean;
};

export type TrucoCall = 'none' | 'truco' | 'retruco' | 'vale-nueve' | 'vale-juego';

export const RULE_PRESETS = {
  oriental: {
    id: 'oriental',
    label: 'Oriental clásico',
    players: 4,
    teams: '2 contra 2',
    targetStones: 24,
    flor: 'A ley',
    parda: 'Venezolana abierta',
    reservedFlor: 'Condicionada',
    passedCards: true,
    endgame: 'Cantando y prive',
    signals: 'Públicas',
  },
  rapida: {
    id: 'rapida',
    label: 'Mesa rápida',
    players: 4,
    teams: '2 contra 2',
    targetStones: 12,
    flor: 'Sin flor',
    parda: 'Venezolana cerrada',
    reservedFlor: 'No aplica',
    passedCards: true,
    endgame: 'Primero a 12',
    signals: 'Públicas',
  },
} as const;

export function sameCard(a: TrucoCard, b: TrucoCard) {
  return a.rank === b.rank && a.suit === b.suit;
}

export function getPieces(vira: TrucoCard) {
  const pericoRank: Rank = vira.rank === 11 ? 12 : 11;
  const pericaRank: Rank = vira.rank === 10 ? 12 : 10;

  return {
    perico: { rank: pericoRank, suit: vira.suit } as TrucoCard,
    perica: { rank: pericaRank, suit: vira.suit } as TrucoCard,
  };
}

export function trucoRank(card: TrucoCard, vira: TrucoCard) {
  if (card.passed) return 0;

  const { perico, perica } = getPieces(vira);
  if (sameCard(card, perico)) return 100;
  if (sameCard(card, perica)) return 99;
  if (card.rank === 1 && card.suit === 'espadas') return 98;
  if (card.rank === 1 && card.suit === 'bastos') return 97;
  if (card.rank === 7 && card.suit === 'espadas') return 96;
  if (card.rank === 7 && card.suit === 'oros') return 95;
  if (card.rank === 3) return 90;
  if (card.rank === 2) return 89;
  if (card.rank === 1) return 88;
  if (card.rank === 12) return 80;
  if (card.rank === 11) return 79;
  if (card.rank === 10) return 78;
  if (card.rank === 7) return 77;
  if (card.rank === 6) return 76;
  if (card.rank === 5) return 75;
  return 74;
}

function numericValue(card: TrucoCard) {
  return card.rank < 10 ? card.rank : 0;
}

export function envidoScore(hand: TrucoCard[], vira: TrucoCard) {
  const { perico, perica } = getPieces(vira);
  const hasPerico = hand.some((card) => sameCard(card, perico));
  const hasPerica = hand.some((card) => sameCard(card, perica));

  if (hasPerico && hasPerica) return 39;

  if (hasPerico || hasPerica) {
    const piece = hasPerico ? perico : perica;
    const base = hasPerico ? 30 : 29;
    const bestOther = Math.max(
      0,
      ...hand.filter((card) => !sameCard(card, piece)).map(numericValue),
    );
    return base + bestOther;
  }

  const suitedTotals = (['espadas', 'bastos', 'oros', 'copas'] as Suit[])
    .map((suit) =>
      hand
        .filter((card) => card.suit === suit)
        .map(numericValue)
        .sort((a, b) => b - a),
    )
    .filter((values) => values.length >= 2)
    .map((values) => 20 + values[0] + values[1]);

  return Math.max(0, ...suitedTotals, ...hand.map(numericValue));
}

export function hasFlor(hand: TrucoCard[], vira: TrucoCard) {
  if (hand.length !== 3) return false;
  if (hand.every((card) => card.suit === hand[0].suit)) return true;

  const { perico, perica } = getPieces(vira);
  const pieceIndexes = hand
    .map((card, index) =>
      sameCard(card, perico) || sameCard(card, perica) ? index : -1,
    )
    .filter((index) => index >= 0);

  return pieceIndexes.some((pieceIndex) => {
    const others = hand.filter((_, index) => index !== pieceIndex);
    return others[0].suit === others[1].suit;
  });
}

export function nextTrucoCall(call: TrucoCall): TrucoCall | null {
  const ladder: TrucoCall[] = ['none', 'truco', 'retruco', 'vale-nueve', 'vale-juego'];
  const next = ladder.indexOf(call) + 1;
  return next < ladder.length ? ladder[next] : null;
}

export function trucoAcceptedValue(call: TrucoCall) {
  return {
    none: 1,
    truco: 3,
    retruco: 6,
    'vale-nueve': 9,
    'vale-juego': Number.POSITIVE_INFINITY,
  }[call];
}

export function trucoRejectedValue(call: TrucoCall) {
  return {
    none: 0,
    truco: 1,
    retruco: 3,
    'vale-nueve': 6,
    'vale-juego': 9,
  }[call];
}
