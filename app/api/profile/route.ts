import { readHistory } from '@/lib/server/history';
import { requireRegistered } from '@/lib/server/identity';
import { getDb } from '@/lib/server/db';
import {
  identity,
  assertSameOrigin,
  body,
  json,
  failure,
} from '@/lib/server/identity';
import { RoomError, cleanName } from '@/lib/room-model';
import type { Profile } from '@/lib/server/profiles';
export async function GET(request: Request) {
  try {
    const viewer = await identity(request);
    requireRegistered(viewer);
    const db = getDb();
    const me = await db
      .prepare(
        'SELECT handle, name, bio, created_at FROM profiles WHERE user_id = ?',
      )
      .bind(viewer.id)
      .first<Profile>();
    const handle = new URL(request.url).searchParams.get('handle');
    const found = handle
      ? await db
          .prepare('SELECT handle, name, bio FROM profiles WHERE handle = ?')
          .bind(handle.toLowerCase())
          .first<Profile>()
      : null;
    const friends = await db
      .prepare(
        `SELECT p.handle, p.name, p.bio, f.status, f.sender = ? AS outgoing FROM friendships f JOIN profiles p ON p.user_id = CASE WHEN f.sender = ? THEN f.recipient ELSE f.sender END WHERE f.sender = ? OR f.recipient = ? LIMIT 200`,
      )
      .bind(viewer.id, viewer.id, viewer.id, viewer.id)
      .all();
    const params = new URL(request.url).searchParams;
    const mode = ['ranked', 'casual'].includes(params.get('mode') ?? '')
      ? params.get('mode')!
      : 'all';
    const offset = Math.min(
      10000,
      Math.max(0, Math.trunc(Number(params.get('offset')) || 0)),
    );
    const history = await readHistory(viewer.id, mode, offset);
    const ratings = await db
      .prepare(
        'SELECT format, rating, peak, games, wins FROM ratings WHERE user_id = ?',
      )
      .bind(viewer.id)
      .all();
    const stats = await db
      .prepare(
        'SELECT mode, count(*)::int AS games, count(*) FILTER (WHERE won)::int AS wins FROM match_history WHERE user_id = ? GROUP BY mode',
      )
      .bind(viewer.id)
      .all();
    return json(
      {
        me,
        found,
        friends: friends.results,
        history,
        ratings: ratings.results,
        stats: stats.results,
      },
      200,
      viewer.cookie,
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const viewer = await identity(request);
    requireRegistered(viewer);
    const input = await body(request);
    if (!input || typeof input !== 'object')
      throw new RoomError('Solicitud inválida.');
    const db = getDb();
    if (input.type === 'save') {
      const handle =
        typeof input.handle === 'string'
          ? input.handle.toLowerCase().trim()
          : '';
      if (!/^[a-z0-9_]{3,20}$/.test(handle))
        throw new RoomError(
          'El usuario debe tener entre 3 y 20 letras, números o guiones bajos.',
        );
      if (typeof input.bio !== 'string' || input.bio.length > 160)
        throw new RoomError('La biografía admite hasta 160 caracteres.');
      const name = cleanName(input.name);
      const existing = await db
        .prepare('SELECT user_id FROM profiles WHERE handle = ?')
        .bind(handle)
        .first<{ user_id: string }>();
      if (existing && existing.user_id !== viewer.id)
        throw new RoomError('Ese usuario ya está ocupado.', 409);
      try {
        await db
          .prepare(
            'INSERT INTO profiles (user_id, handle, name, bio) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET handle = excluded.handle, name = excluded.name, bio = excluded.bio',
          )
          .bind(viewer.id, handle, name, input.bio.trim())
          .run();
      } catch (e) {
        if (String(e).toLowerCase().includes('unique'))
          throw new RoomError('Ese usuario ya está ocupado.', 409);
        throw e;
      }
    } else {
      if (
        !['request', 'accept', 'remove'].includes(input.type) ||
        typeof input.handle !== 'string'
      )
        throw new RoomError('Acción inválida.');
      const me = await db
        .prepare('SELECT user_id FROM profiles WHERE user_id = ?')
        .bind(viewer.id)
        .first();
      if (!me) throw new RoomError('Crea tu perfil antes de agregar amigos.');
      const other = await db
        .prepare('SELECT user_id FROM profiles WHERE handle = ?')
        .bind(input.handle.toLowerCase())
        .first<{ user_id: string }>();
      if (!other || other.user_id === viewer.id)
        throw new RoomError('Elige el perfil de otro jugador.');
      const pair = [viewer.id, other.user_id].sort().join(':');
      if (input.type === 'request') {
        const count = await db
          .prepare(
            'SELECT count(*) AS n FROM friendships WHERE sender = ? OR recipient = ?',
          )
          .bind(viewer.id, viewer.id)
          .first<{ n: number }>();
        if ((count?.n ?? 0) >= 200)
          throw new RoomError(
            'Has alcanzado el límite de 200 amigos y solicitudes.',
          );
        await db
          .prepare(
            "INSERT INTO friendships (pair, sender, recipient, status) VALUES (?, ?, ?, 'pending') ON CONFLICT DO NOTHING",
          )
          .bind(pair, viewer.id, other.user_id)
          .run();
      } else if (input.type === 'accept') {
        const result = await db
          .prepare(
            "UPDATE friendships SET status = 'accepted' WHERE pair = ? AND recipient = ? AND status = 'pending'",
          )
          .bind(pair, viewer.id)
          .run();
        if (!result.meta.changes)
          throw new RoomError(
            'No hay una solicitud pendiente para aceptar.',
            409,
          );
      } else
        await db
          .prepare(
            'DELETE FROM friendships WHERE pair = ? AND (sender = ? OR recipient = ?)',
          )
          .bind(pair, viewer.id, viewer.id)
          .run();
    }
    return json({ ok: true }, 200, viewer.cookie);
  } catch (e) {
    return failure(e);
  }
}
