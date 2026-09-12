import assert from 'node:assert/strict';
import test from 'node:test';
import { manoAnnouncement, gameEventText, actionLabels } from '../lib/game-copy.ts';
test('player messages use second person and Spanish action names', () => {
  assert.equal(manoAnnouncement('Tú', true), 'Eres mano.');
  assert.equal(manoAnnouncement('Truquito', false), 'Truquito es mano.');
  const names = { human: 'Tú', opponent: 'Truquito' };
  assert.equal(gameEventText('human jugó 7 de oros.', names, 'human'), 'Jugaste 7 de oros.');
  assert.equal(gameEventText('human se fue al mazo.', names, 'human'), 'Te fuiste al mazo.');
  assert.equal(gameEventText('human pasó sus tres cartas.', names, 'human'), 'Pasaste tus tres cartas.');
  assert.equal(gameEventText('opponent jugó 7 de oros.', names, 'human'), 'Truquito jugó 7 de oros.');
  assert.equal(actionLabels['raise-envido'], 'Subir el envite');
});
