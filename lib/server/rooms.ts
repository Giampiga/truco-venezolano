import { getDb } from './db';
import {
  applyRoomAction,
  RoomError,
  type StoredRoom,
  type RoomAction,
} from '../room-model.ts';
export async function readRoom(id: string) {
  const row = await getDb()
    .prepare(
      'SELECT data FROM rooms WHERE (id = ? OR code = ?) AND updated_at > ?',
    )
    .bind(id, id.toUpperCase(), Date.now() - 48 * 3600_000)
    .first<{ data: string }>();
  if (!row)
    throw new RoomError('No encontramos esa mesa. Revisa el código.', 404);
  return JSON.parse(row.data) as StoredRoom;
}
export async function mutateRoom(
  id: string,
  userId: string,
  action: RoomAction,
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const previous = await readRoom(id);
    const profile = await getDb()
      .prepare('SELECT handle, name FROM profiles WHERE user_id = ?')
      .bind(userId)
      .first<{ handle: string; name: string }>();
    const member = previous.members.find((m) => m.userId === userId);
    if (member && profile) {
      member.handle = profile.handle;
      member.name = profile.name;
    }
    if (action?.type === 'join' && profile)
      action = { type: 'join', name: profile.name };
    let next: StoredRoom;
    try {
      next = applyRoomAction(previous, userId, action);
    } catch (error) {
      if (error instanceof RoomError) throw error;
      throw new RoomError(
        error instanceof Error ? error.message : 'Jugada inválida.',
      );
    }
    if (next === previous) return next;
    const result = await getDb()
      .prepare(
        'UPDATE rooms SET data = ?, revision = ?, status = ?, owner_id = ?, updated_at = ? WHERE id = ? AND revision = ?',
      )
      .bind(
        JSON.stringify(next),
        next.revision,
        next.closed ? 'closed' : next.engine ? 'playing' : 'waiting',
        next.hostId,
        Date.now(),
        previous.id,
        previous.revision,
      )
      .run();
    if (result.meta.changes === 1) return next;
  }
  throw new RoomError('La mesa está ocupada. Vuelve a intentarlo.', 409);
}
