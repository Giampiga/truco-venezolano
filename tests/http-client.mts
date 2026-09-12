import assert from 'node:assert/strict';

export const origin = process.env.TRUCO_TEST_URL ?? 'http://localhost:3013';
assert.ok(
  ['localhost', '127.0.0.1'].includes(new URL(origin).hostname),
  'Integration checks only run against a local test server.',
);

export function client() {
  let cookie = '';
  return async (path: string, payload?: unknown, status = 200) => {
    const response = await fetch(origin + path, {
      method: payload === undefined ? 'GET' : 'POST',
      headers: {
        Cookie: cookie,
        Origin: origin,
        'Content-Type': 'application/json',
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    cookie = response.headers.get('set-cookie')?.split(';')[0] ?? cookie;
    // Each scenario asserts the real JSON response instead of mocking the API.
    const data = await response.json();
    assert.equal(response.status, status, `${path}: ${JSON.stringify(data)}`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return data;
  };
}
