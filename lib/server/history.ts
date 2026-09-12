import { getDb } from './db';
import { settleRanking } from './ranking';
import type { StoredRoom } from '../room-model';
function historyEntries(room: StoredRoom) {
  const engine = room.engine;
  if (!engine?.match.complete || !engine.match.winner) return [];
  return room.members.map((member) => {
    const team = engine.seats.find((seat) => seat.id === member.seatId)!.team;
    const other = team === 'A' ? 'B' : 'A';
    return {
      userId: member.userId,
      won: team === engine.match.winner,
      opponents: room.members
        .filter(
          (m) => engine.seats.find((s) => s.id === m.seatId)?.team === other,
        )
        .map((m) => m.name)
        .join(' y '),
      score:
        engine.match.gamesToWin === 2
          ? `${engine.match.gameWins[team]}–${engine.match.gameWins[other]} chicos`
          : `${engine.match.score[team]}–${engine.match.score[other]}`,
    };
  });
}
export async function saveHistory(room: StoredRoom) {
  const entries = historyEntries(room);
  if (!entries.length) return;
  const db = getDb();
  await db.batch(
    entries.map((e) =>
      db
        .prepare(`INSERT INTO match_history (room_id, user_id, mode, format, at, won, opponents, score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`)
        .bind(
          room.id,
          e.userId,
          room.config.ranked ? 'ranked' : 'casual',
          room.config.format,
          Date.now(),
          e.won,
          e.opponents,
          e.score,
        ),
    ),
  );
}
export async function readHistory(
  userId: string,
  mode: string,
  offset: number,
) {
  const db = getDb();
  // Recover results if a request ended after the room write but before the history write.
  const pending = await db
    .prepare(`SELECT r.data FROM rooms r WHERE r.data::jsonb#>>'{engine,match,complete}' = 'true'
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(r.data::jsonb->'members') m WHERE m.value->>'userId' = ?)
    AND (NOT EXISTS (SELECT 1 FROM match_history h WHERE h.room_id = r.id AND h.user_id = ?) OR (r.data::jsonb#>>'{config,ranked}' = 'true' AND NOT EXISTS (SELECT 1 FROM ranked_results x WHERE x.room_id = r.id))) LIMIT 20`)
    .bind(userId, userId)
    .all<{ data: string }>();
  for (const row of pending.results) { const room = JSON.parse(row.data) as StoredRoom; await saveHistory(room); await settleRanking(room); }
  const rows = await db
    .prepare(`SELECT h.room_id, h.mode, h.format, h.at, h.won, h.opponents, h.score,
    (e.value->>'delta')::int AS delta, (e.value->>'rating')::int AS rating, r.rated
    FROM match_history h LEFT JOIN ranked_results r ON r.room_id = h.room_id
    LEFT JOIN LATERAL jsonb_array_elements(r.data::jsonb) e ON e.value->>'userId' = h.user_id
    WHERE h.user_id = ? AND (? = 'all' OR h.mode = ?) ORDER BY h.at DESC, h.room_id DESC LIMIT 21 OFFSET ?`)
    .bind(userId, mode, mode, offset)
    .all();
  return { matches: rows.results.slice(0, 20), more: rows.results.length > 20 };
}
