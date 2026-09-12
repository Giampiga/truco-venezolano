import assert from 'node:assert/strict';
import test from 'node:test';
import { tablePosition } from '../lib/table-seats.ts';

void test('table seats and rotating mano stay relative to every viewer', () => {
  const seats = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  for (let viewer = 0; viewer < seats.length; viewer++) {
    assert.deepEqual(
      seats.map((_, offset) =>
        tablePosition(seats, seats[(viewer + offset) % 4].id, seats[viewer].id),
      ),
      ['bottom', 'right', 'top', 'left'],
    );
  }
  assert.equal(tablePosition(seats.slice(0, 2), 'b', 'a'), 'top');
  assert.equal(tablePosition(seats.slice(0, 2), 'a', 'a'), 'bottom');
  assert.equal(tablePosition(seats, 'missing', 'a'), undefined);
});
