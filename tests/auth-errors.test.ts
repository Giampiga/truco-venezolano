import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authErrorMessage } from '../lib/auth/browser.ts';

void test('auth errors distinguish unavailable sign-in from incorrect credentials and keep provider details private', () => {
  assert.match(authErrorMessage({ code: 'invalid_credentials' }), /contraseña/);
  assert.match(authErrorMessage({ code: 'provider_disabled' }), /habilitada/);
  assert.match(
    authErrorMessage({ code: 'anonymous_provider_disabled' }),
    /Truquito/,
  );
  assert.match(
    authErrorMessage({ code: 'identity_already_exists' }),
    /no se transfieren/,
  );
  assert.match(authErrorMessage({ code: 'same_password' }), /diferente/);
  const failure = authErrorMessage({ message: 'private provider details' });
  assert.equal(failure, authErrorMessage(null));
  assert.ok(!failure.includes('private provider details'));
});
