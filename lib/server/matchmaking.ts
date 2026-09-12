import { profileRoom } from '@/lib/server/profiles';
import { getDb } from './db';
import {
  cleanName,
  DEFAULT_CONFIG,
  newRoom,
  applyRoomAction,
  RoomError,
  projectRoom,
  type StoredRoom,
} from '../room-model.ts';
import { cappedOpponentPairs, opponentPair } from './opponent-limits';

type Ticket = {
  user_id: string;
  ticket: string;
  name: string;
  format: '1v1' | '2v2';
  rating: number;
  joined_at: number;
  seen_at: number;
  room_id: string | null;
};
async function currentTicket(userId: string) {
  return getDb()
    .prepare('SELECT * FROM matchmaking_queue WHERE user_id = ?')
    .bind(userId)
    .first<Ticket>();
}
async function assignment(ticket: Ticket) {
  if (!ticket.room_id) return null;
  const row = await getDb()
    .prepare('SELECT data FROM rooms WHERE id = ?')
    .bind(ticket.room_id)
    .first<{ data: string }>();
  if (!row) return null;
  const room = JSON.parse(row.data) as StoredRoom;
  if (
    room.closed ||
    room.engine?.match.complete ||
    !room.members.some((m) => m.userId === ticket.user_id && !m.left)
  )
    return null;
  return profileRoom(room, ticket.user_id);
}
export async function matchmaking(
  userId: string,
  action: { type: string; name?: unknown; format?: unknown },
) {
  const db = getDb();
  const now = Date.now();
  let ticket = await currentTicket(userId);
  if (ticket?.room_id) {
    const room = await assignment(ticket);
    if (room) return { status: 'matched', room };
    await db
      .prepare('DELETE FROM matchmaking_queue WHERE user_id = ? AND ticket = ?')
      .bind(userId, ticket.ticket)
      .run();
    ticket = null;
  }
  if (
    action.type === 'join' &&
    ticket &&
    !ticket.room_id &&
    ticket.seen_at < now - 90_000
  ) {
    await db
      .prepare(
        'DELETE FROM matchmaking_queue WHERE user_id = ? AND ticket = ? AND room_id IS NULL AND seen_at < ?',
      )
      .bind(userId, ticket.ticket, now - 90_000)
      .run();
    ticket = await currentTicket(userId);
    if (ticket?.room_id) {
      const room = await assignment(ticket);
      if (room) return { status: 'matched', room };
    }
  }
  if (action.type === 'cancel') {
    await db
      .prepare(
        'DELETE FROM matchmaking_queue WHERE user_id = ? AND room_id IS NULL',
      )
      .bind(userId)
      .run();
    // Cancellation and assignment race atomically: a completed pairing wins.
    const latest = await currentTicket(userId);
    const room = latest && (await assignment(latest));
    return room ? { status: 'matched', room } : { status: 'idle' };
  }
  if (action.type === 'join') {
    if (!['1v1', '2v2'].includes(action.format as string))
      throw new RoomError('Elige duelo o parejas.');
    const profile = await db.prepare('SELECT name FROM profiles WHERE user_id = ?').bind(userId).first<{name:string}>();
    const name = profile?.name ?? cleanName(action.name);
    if (ticket && ticket.format !== action.format)
      throw new RoomError(
        'Cancela la búsqueda antes de cambiar de formato.',
        409,
      );
    const old = await db
      .prepare('SELECT rating FROM ratings WHERE id = ?')
      .bind(`${action.format}:${userId}`)
      .first<{ rating: number }>();
    await db
      .prepare(`INSERT INTO matchmaking_queue (user_id, ticket, name, format, rating, joined_at, seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO NOTHING`)
      .bind(
        userId,
        crypto.randomUUID(),
        name,
        action.format,
        old?.rating ?? 1000,
        now,
        now,
      )
      .run();
    ticket = await currentTicket(userId);
  }
  if (
    !ticket ||
    (!ticket.room_id && ticket.seen_at < now - 90_000 && action.type !== 'join')
  )
    return { status: 'idle' };
  if (action.type === 'status')
    return {
      status: 'searching',
      format: ticket.format,
      since: ticket.joined_at,
    };
  if (ticket.seen_at < now - 90_000) {
    await db
      .prepare(
        'UPDATE matchmaking_queue SET joined_at = ?, ticket = ? WHERE user_id = ? AND room_id IS NULL',
      )
      .bind(now, crypto.randomUUID(), userId)
      .run();
  }
  await db
    .prepare(
      'UPDATE matchmaking_queue SET seen_at = ? WHERE user_id = ? AND room_id IS NULL',
    )
    .bind(now, userId)
    .run();
  ticket = await currentTicket(userId);
  if (!ticket) return { status: 'idle' };
  if (ticket.room_id)
    return { status: 'matched', room: await assignment(ticket) };
  const range = Math.min(
    600,
    150 + Math.floor((now - ticket.joined_at) / 30_000) * 50,
  );
  const candidates = await db
    .prepare(
      `SELECT * FROM matchmaking_queue WHERE format = ? AND room_id IS NULL AND seen_at >= ? AND user_id != ? AND ABS(rating - ?) <= ? ORDER BY ABS(rating - ?), joined_at LIMIT 30`,
    )
    .bind(
      ticket.format,
      now - 90_000,
      userId,
      ticket.rating,
      range,
      ticket.rating,
    )
    .all<Ticket>();
  const capped = await cappedOpponentPairs([
    userId,
    ...candidates.results.map((t) => t.user_id),
  ]);
  let group: Ticket[] | null = null;
  // ponytail: bound search to 30 live candidates; widen the pool when queue volume requires it.
  for (let i = 0; i < candidates.results.length && !group; i++) {
    if (ticket.format === '1v1') {
      if (!capped.has(opponentPair(userId, candidates.results[i].user_id)))
        group = [ticket, candidates.results[i]];
    } else {
      for (let j = i + 1; j < candidates.results.length && !group; j++) {
        for (let k = j + 1; k < candidates.results.length && !group; k++) {
          const sorted = [
            ticket,
            candidates.results[i],
            candidates.results[j],
            candidates.results[k],
          ].sort((a, b) => b.rating - a.rating);
          const seats = [sorted[0], sorted[1], sorted[3], sorted[2]];
          if (
            !seats.some((a, x) =>
              seats.some(
                (b, y) =>
                  x % 2 !== y % 2 &&
                  capped.has(opponentPair(a.user_id, b.user_id)),
              ),
            )
          )
            group = seats;
        }
      }
    }
  }
  if (group) {
    const id = crypto.randomUUID();
    const code = crypto
      .randomUUID()
      .replaceAll('-', '')
      .slice(0, 6)
      .toUpperCase();
    let room = newRoom(
      id,
      code,
      group[0].user_id,
      group[0].name,
      {
        ...DEFAULT_CONFIG,
        name: `Competitiva ${ticket.format}`,
        format: ticket.format,
        ranked: true,
        isPrivate: true,
        camera: true,
      },
      now,
    );
    for (const member of group.slice(1))
      room = applyRoomAction(
        room,
        member.user_id,
        { type: 'join', name: member.name },
        now,
      );
    const checks = group
      .map(
        () =>
          'EXISTS (SELECT 1 FROM matchmaking_queue WHERE user_id = ? AND ticket = ? AND room_id IS NULL AND seen_at >= ?)',
      )
      .join(' AND ');
    await db.batch([
      db
        .prepare(
          `INSERT INTO rooms (id, code, owner_id, is_private, status, revision, updated_at, data) SELECT ?, ?, ?, 1, 'waiting', ?, ?, ? WHERE ${checks} ON CONFLICT DO NOTHING`,
        )
        .bind(
          id,
          code,
          room.hostId,
          room.revision,
          now,
          JSON.stringify(room),
          ...group.flatMap((t) => [t.user_id, t.ticket, now - 90_000]),
        ),
      ...group.map((t) =>
        db
          .prepare(
            'UPDATE matchmaking_queue SET room_id = ? WHERE user_id = ? AND ticket = ? AND EXISTS (SELECT 1 FROM rooms WHERE id = ?)',
          )
          .bind(id, t.user_id, t.ticket, id),
      ),
    ]);
  }
  const latest = await currentTicket(userId);
  if (!latest) return { status: 'idle' };
  const room = await assignment(latest);
  return room
    ? { status: 'matched', room }
    : { status: 'searching', format: latest.format, since: latest.joined_at };
}
