import assert from 'node:assert/strict';
import test from 'node:test';
import { eloDelta } from '../lib/rating.ts';
void test('Elo rewards upsets and changes both teams by the same amount', () => {
  assert.equal(eloDelta(1000, 1000), 16);
  assert.equal(eloDelta(800, 1200), 29);
  assert.equal(eloDelta(1200, 800), 3);
  assert.equal(eloDelta(0, 3000), 32);
});
