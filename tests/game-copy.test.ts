import assert from 'node:assert/strict';
import test from 'node:test';
import { manoAnnouncement, gameEventText, actionLabels, pendingCanto } from '../lib/game-copy.ts';
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


test('pending canto explains the active wager and suspended truco', () => {
  const state = { handComplete: false, priority: { active: 'envido', suspendedTruco: { call: 'truco', by: 'A' } }, truco: { accepted: 'none', lastRaisedBy: null, pending: { call: 'truco', by: 'A' } }, envido: { status: 'pending', acceptedStake: 2, pending: { by: 'B', bySeatId: 'opponent', stake: 7, rejectionAward: 2, kind: 'n-mas' }, winner: null } } as const;
  assert.match(pendingCanto(state)!.label, /7 puntos/);
  assert.match(pendingCanto(state)!.reject, /2 puntos/);
  assert.equal(pendingCanto(state)!.bySeatId, 'opponent');
  assert.equal(pendingCanto(state)!.suspended, 'Truco');
  assert.equal(pendingCanto({ ...state, handComplete: true }), null);
  assert.equal(pendingCanto({ ...state, priority: { active: 'play', suspendedTruco: null } }), null);
  assert.match(pendingCanto({ ...state, priority: { active: 'truco', suspendedTruco: null } })!.accept, /3 puntos/);
});
