import { requireRegistered } from '@/lib/server/identity';
import { profileRoom } from '@/lib/server/profiles';
import { getDb, getVoiceEnv } from '@/lib/server/db';
import { voiceConfigured } from '@/lib/voice-token';
import {
  assertSameOrigin,
  body,
  failure,
  identity,
  json,
} from '@/lib/server/identity';
import {
  newRoom,
  roomSummary,
  RoomError,
  validateConfig,
  type StoredRoom,
} from '@/lib/room-model';

export async function GET() {
  try {
    if (
      !process.env.DATABASE_URL &&
      !(
        process.env.NODE_ENV !== 'production' &&
        process.env.TRUCO_LOCAL_DATABASE
      )
    )
      throw new RoomError(
        'El salón en línea aún no está disponible. Mientras tanto, puedes practicar con Truquito.',
        503,
      );
    const rows = await getDb()
      .prepare(
        "SELECT data FROM rooms WHERE status = 'waiting' AND is_private = 0 AND updated_at > ? ORDER BY updated_at DESC LIMIT 40",
      )
      .bind(Date.now() - 15 * 60_000)
      .all<{ data: string }>();
    return json(
      {
        rooms: rows.results.map((row) =>
          roomSummary(JSON.parse(row.data) as StoredRoom),
        ),
        voiceAvailable: voiceConfigured(getVoiceEnv()),
      },
      200,
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
    if (config.ranked) requireRegistered(viewer);
    const profile = await getDb()
      .prepare('SELECT name FROM profiles WHERE user_id = ?')
      .bind(viewer.id)
      .first<{ name: string }>();
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
        profile?.name ?? payload.name,
        config,
      );
      const result = await getDb()
        .prepare(
          `INSERT INTO rooms (id, code, owner_id, is_private, status, revision, updated_at, data)
          SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM rooms WHERE owner_id = ? AND status != 'closed' AND updated_at > ?) < 3 ON CONFLICT DO NOTHING`,
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
          viewer.id,
          Date.now() - 48 * 3600_000,
        )
        .run();
      if (result.meta.changes === 1)
        return json(await profileRoom(room, viewer.id), 201, viewer.cookie);
      const existing = await getDb()
        .prepare(
          "SELECT COUNT(*) AS n FROM rooms WHERE owner_id = ? AND status != 'closed' AND updated_at > ?",
        )
        .bind(viewer.id, Date.now() - 48 * 3600_000)
        .first<{ n: number }>();
      if ((existing?.n ?? 0) >= 3)
        throw new RoomError(
          'Ya tienes tres mesas abiertas. Cierra una antes de crear otra.',
          429,
        );
    }
    throw new RoomError('No se pudo crear el código. Inténtalo otra vez.', 503);
  } catch (error) {
    return failure(error);
  }
}
