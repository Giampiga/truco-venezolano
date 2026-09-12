import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authDestination, authReturnPath } from '../lib/auth/return-path.ts';

void test('sign-in and password recovery retain room invitations without open redirects', () => {
  assert.equal(authReturnPath('/?mesa=ab12cd'), '/?mesa=AB12CD');
  for (const value of [
    null,
    '//other.test',
    '/\\other.test',
    'https://other.test',
    '/auth/callback',
    '/?mesa=bad',
    '/ ?mesa=AB12CD',
  ])
    assert.equal(authReturnPath(value), '/');
  const url = new URL(
    'https://truco.test/auth/callback?next=%2F%3Fmesa%3DAB12CD',
  );
  assert.equal(authDestination(url).href, 'https://truco.test/?mesa=AB12CD');
  assert.equal(authDestination(url, true).pathname, '/auth/reset-password');
  assert.equal(
    authDestination(url, true).searchParams.get('next'),
    '/?mesa=AB12CD',
  );
});
