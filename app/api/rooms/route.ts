import { getDb, getVoiceEnv } from '@/lib/server/db';
import {
  assertSameOrigin,
  body,
  failure,
  identity,
  json,
} from '@/lib/server/identity';
import {
  newRoom,
  projectRoom,
  roomSummary,
  RoomError,
  validateConfig,
  type StoredRoom,
} from '@/lib/room-model';

export async function GET(request: Request) {
  try {
    const viewer = await identity(request);
    const rows = await getDb()
      .prepare(
        "SELECT data FROM rooms WHERE status = 'waiting' AND is_private = 0 AND updated_at > ? ORDER BY updated_at DESC LIMIT 40",
      )
      .bind(Date.now() - 15 * 60_000)
      .all<{ data: string }>();
    const voice = getVoiceEnv();
    return json(
      {
        rooms: rows.results.map((row) =>
          roomSummary(JSON.parse(row.data) as StoredRoom),
        ),
        voiceAvailable: !!(
          voice.LIVEKIT_URL &&
          voice.LIVEKIT_API_KEY &&
          voice.LIVEKIT_API_SECRET
        ),
      },
      200,
      viewer.cookie,
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const viewer = await identity(request);
    const payload = await body(request);
    if (!payload || typeof payload !== 'object')
      throw new RoomError('Solicitud inválida.');
    const config = validateConfig(payload.config);
    const existing = await getDb()
      .prepare(
        "SELECT id FROM rooms WHERE owner_id = ? AND status != 'closed' AND updated_at > ? LIMIT 3",
      )
      .bind(viewer.id, Date.now() - 48 * 3600_000)
      .all();
    if (existing.results.length >= 3)
      throw new RoomError(
        'Ya tienes tres mesas abiertas. Cierra una antes de crear otra.',
        429,
      );
    for (let attempt = 0; attempt < 3; attempt++) {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const code = Array.from(
        crypto.getRandomValues(new Uint8Array(6)),
        (b) => alphabet[b % alphabet.length],
      ).join('');
      const room = newRoom(
        crypto.randomUUID(),
        code,
        viewer.id,
        payload.name,
        config,
      );
      const result = await getDb()
        .prepare(
          'INSERT OR IGNORE INTO rooms (id, code, owner_id, is_private, status, revision, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          room.id,
          code,
          viewer.id,
          Number(config.isPrivate),
          'waiting',
          0,
          Date.now(),
          JSON.stringify(room),
        )
        .run();
      if (result.meta.changes === 1)
        return json(projectRoom(room, viewer.id), 201, viewer.cookie);
    }
    throw new RoomError('No se pudo crear el código. Inténtalo otra vez.', 503);
  } catch (error) {
    return failure(error);
  }
}
