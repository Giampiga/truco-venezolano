import { getDb } from './db';
import { projectRoom, type StoredRoom } from '../room-model.ts';
export type Profile = { handle: string; name: string; bio: string };
export async function profileRoom(room: StoredRoom, userId: string) {
  const result = projectRoom(room, userId);
  const rows = await getDb()
    .prepare(
      `SELECT user_id, handle, name FROM profiles WHERE user_id IN (${room.members.map(() => '?').join(',')})`,
    )
    .bind(...room.members.map((m) => m.userId))
    .all<{ user_id: string; handle: string; name: string }>();
  for (const member of result.members) {
    const stored = room.members.find((m) => m.seatId === member.seatId)!;
    const profile = rows.results.find((p) => p.user_id === stored.userId);
    member.handle = profile?.handle;
    if (profile) member.name = profile.name;
  }
  return result;
}
