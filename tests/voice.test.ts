import assert from 'node:assert/strict';
import test from 'node:test';
import { voiceConfigured, voiceToken } from '../lib/voice-token.ts';
import { drainVoiceRevocations } from '../lib/server/voice.ts';
import { DEFAULT_CONFIG, newRoom } from '../lib/room-model.ts';

void test('voice JWT has a valid signature and room-scoped microphone-only grants', async () => {
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
void test('voice cannot claim connection readiness with missing or insecure configuration', async () => {
  const credentials = {
    LIVEKIT_URL: 'wss://voice.test',
    LIVEKIT_API_KEY: 'k',
    LIVEKIT_API_SECRET: 's',
  };
  assert.equal(voiceConfigured(credentials), true);
  for (const url of ['', 'not a URL', 'http://voice.test', 'ws://voice.test']) {
    const invalid = { ...credentials, LIVEKIT_URL: url };
    assert.equal(voiceConfigured(invalid), false);
    await assert.rejects(voiceToken(invalid, 'room', 'p0', 'Ana'));
  }
  assert.equal(
    voiceConfigured({ ...credentials, LIVEKIT_API_SECRET: '' }),
    false,
  );
  assert.equal(voiceConfigured({}), false);
  await assert.rejects(voiceToken({}, 'room', 'p0', 'Ana'));
});

void test('camera grant is opt-in and never permits screen sharing', async () => {
  const result = await voiceToken(
    {
      LIVEKIT_URL: 'wss://voice.example.test',
      LIVEKIT_API_KEY: 'key',
      LIVEKIT_API_SECRET: 'secret',
    },
    'room',
    'member',
    'Ana',
    100,
    true,
  );
  const claims = JSON.parse(
    Buffer.from(result.token.split('.')[1], 'base64url').toString(),
  );
  assert.deepEqual(claims.video.canPublishSources, ['microphone', 'camera']);
});

void test('unconfigured media preserves revocations without accessing the database', async () => {
  const keys = [
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'DATABASE_URL',
    'TRUCO_LOCAL_DATABASE',
  ];
  const previous = keys.map((key) => process.env[key]);
  const room = newRoom('room', 'ROOM01', 'user', 'Ana', DEFAULT_CONFIG);
  room.voiceRevocations = ['departed-member'];
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(await drainVoiceRevocations(room), room);
    process.env.LIVEKIT_URL = 'wss://voice.test';
    process.env.LIVEKIT_API_KEY = 'key';
    assert.equal(await drainVoiceRevocations(room), room);
    process.env.LIVEKIT_API_SECRET = 'secret';
    process.env.LIVEKIT_URL = 'invalid endpoint';
    assert.equal(await drainVoiceRevocations(room), room);
    assert.deepEqual(room.voiceRevocations, ['departed-member']);
    assert.equal(room.revision, 0);
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
});
