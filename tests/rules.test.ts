import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSpanishDeck,
  envidoScore,
  florScore,
  getPieces,
  hasFlor,
  isFlorReservada,
  nextTrucoCall,
  trucoRank,
  trucoRejectedValue,
  type TrucoCard,
} from '../lib/truco-rules.ts';

const vira: TrucoCard = { rank: 6, suit: 'copas' };

void test('la vira determina Perico y Perica', () => {
  assert.deepEqual(getPieces(vira), {
    perico: { rank: 11, suit: 'copas' },
    perica: { rank: 10, suit: 'copas' },
  });

  assert.deepEqual(getPieces({ rank: 11, suit: 'oros' }), {
    perico: { rank: 12, suit: 'oros' },
    perica: { rank: 10, suit: 'oros' },
  });

  assert.deepEqual(getPieces({ rank: 10, suit: 'espadas' }), {
    perico: { rank: 11, suit: 'espadas' },
    perica: { rank: 12, suit: 'espadas' },
  });
});

void test('la baraja española tiene 40 cartas únicas', () => {
  const deck = createSpanishDeck();
  assert.equal(deck.length, 40);
  assert.equal(
    new Set(deck.map((card) => `${card.rank}-${card.suit}`)).size,
    40,
  );
});

void test('el Perico mata a las piezas fijas y una carta pasada no mata', () => {
  assert.ok(
    trucoRank({ rank: 11, suit: 'copas' }, vira) >
      trucoRank({ rank: 1, suit: 'espadas' }, vira),
  );
  assert.equal(trucoRank({ rank: 1, suit: 'espadas', passed: true }, vira), 0);
});

void test('calcula envido con pieza, pinta y reservada', () => {
  assert.equal(
    envidoScore(
      [
        { rank: 11, suit: 'copas' },
        { rank: 7, suit: 'bastos' },
        { rank: 4, suit: 'oros' },
      ],
      vira,
    ),
    37,
  );
  assert.equal(
    envidoScore(
      [
        { rank: 7, suit: 'bastos' },
        { rank: 4, suit: 'bastos' },
        { rank: 12, suit: 'oros' },
      ],
      vira,
    ),
    31,
  );
  assert.equal(
    envidoScore(
      [
        { rank: 11, suit: 'copas' },
        { rank: 10, suit: 'copas' },
        { rank: 4, suit: 'oros' },
      ],
      vira,
    ),
    39,
  );
});

void test('reconoce la Flor venezolana con una pieza y dos cartas de la misma pinta', () => {
  assert.equal(
    hasFlor(
      [
        { rank: 11, suit: 'copas' },
        { rank: 7, suit: 'bastos' },
        { rank: 4, suit: 'bastos' },
      ],
      vira,
    ),
    true,
  );

  const reservada: TrucoCard[] = [
    { rank: 11, suit: 'copas' },
    { rank: 10, suit: 'copas' },
    { rank: 7, suit: 'oros' },
  ];
  assert.equal(hasFlor(reservada, vira), true);
  assert.equal(isFlorReservada(reservada, vira), true);
  assert.equal(florScore(reservada, vira), 46);
});

void test('usa la escalera venezolana y sus valores de rechazo', () => {
  assert.equal(nextTrucoCall('none'), 'truco');
  assert.equal(nextTrucoCall('truco'), 'retruco');
  assert.equal(nextTrucoCall('retruco'), 'vale-nueve');
  assert.equal(nextTrucoCall('vale-nueve'), 'vale-juego');
  assert.equal(trucoRejectedValue('vale-nueve'), 6);
});
