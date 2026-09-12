import assert from 'node:assert/strict';
import test from 'node:test';
import { roomRequest, RoomRequestError } from '../hooks/use-room.ts';

void test('room transport preserves HTTP status for JSON and proxy errors', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response('<h1>Unauthorized</h1>', { status: 401 });
    await assert.rejects(
      roomRequest('/api/rooms/example'),
      (error: unknown) =>
        error instanceof RoomRequestError &&
        error.status === 401 &&
        error.message.includes('Vuelve a intentarlo'),
    );
    globalThis.fetch = async () =>
      Response.json({ error: 'La mesa está cerrada.' }, { status: 410 });
    await assert.rejects(
      roomRequest('/api/rooms/example'),
      (error: unknown) =>
        error instanceof RoomRequestError &&
        error.status === 410 &&
        error.message === 'La mesa está cerrada.',
    );
    globalThis.fetch = async () => new Response('not json');
    await assert.rejects(
      roomRequest('/api/rooms/example'),
      /respuesta inválida/,
    );
    globalThis.fetch = async () => Response.json({ revision: 2 });
    assert.deepEqual(await roomRequest('/api/rooms/example'), { revision: 2 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
