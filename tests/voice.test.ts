import assert from 'node:assert/strict';
import test from 'node:test';
import { voiceToken } from '../lib/voice-token.ts';

test('voice JWT has a valid signature and room-scoped microphone-only grants', async () => {
  const credentials = {
    LIVEKIT_URL: 'wss://voice.example.test',
    LIVEKIT_API_KEY: 'test-key',
    LIVEKIT_API_SECRET: 'test-secret-at-least-32-characters',
  };
  const result = await voiceToken(
    credentials,
    'room-id',
    'p2',
    'José',
    1_000_000,
  );
  const [head, body, signature] = result.token.split('.');
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
  assert.equal(claims.iss, 'test-key');
  assert.equal(claims.sub, 'p2');
  assert.equal(claims.name, 'José');
  assert.equal(claims.exp, 1_000_300);
  assert.equal(claims.video.room, 'truco-room-id');
  assert.deepEqual(claims.video.canPublishSources, ['microphone']);
  assert.equal(claims.video.canPublishData, false);
  assert.equal(claims.video.roomAdmin, undefined);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(credentials.LIVEKIT_API_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  assert.equal(
    await crypto.subtle.verify(
      'HMAC',
      key,
      Buffer.from(signature, 'base64url'),
      new TextEncoder().encode(`${head}.${body}`),
    ),
    true,
  );
  assert.equal(result.token.includes(credentials.LIVEKIT_API_SECRET), false);
});
test('voice cannot claim connection readiness with missing or insecure configuration', async () => {
  await assert.rejects(voiceToken({}, 'room', 'p0', 'Ana'));
  await assert.rejects(
    voiceToken(
      {
        LIVEKIT_URL: 'http://voice.test',
        LIVEKIT_API_KEY: 'k',
        LIVEKIT_API_SECRET: 's',
      },
      'room',
      'p0',
      'Ana',
    ),
  );
});
