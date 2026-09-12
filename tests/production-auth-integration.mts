import assert from 'node:assert/strict';
const origin = process.env.TRUCO_TEST_URL ?? 'http://localhost:3014';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const response = await fetch(origin + '/api/account', {
  headers: {
    Cookie: `truco_dev=${crypto.randomUUID()}`,
    'oai-authenticated-user-id': 'forged',
    'x-truco-test-guest': '0',
  },
});
assert.equal(
  response.status,
  401,
  'Production must reject development cookies and legacy proxy headers',
);
assert.equal(response.headers.get('cache-control'), 'no-store');
const callback = await fetch(
  origin + '/auth/callback?next=https://example.com',
  { redirect: 'manual' },
);
assert.equal(new URL(callback.headers.get('location')!).origin, origin);
console.log(
  'Production rejects forged dev/legacy identities; callback cannot redirect to an external origin.',
);
