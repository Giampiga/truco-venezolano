import { getDb } from './db';
import { cappedOpponentPairs, opponentPair } from './opponent-limits';
import {
  eloDelta,
  INITIAL_RATING,
  type RatingEntry,
  type Ranking,
} from '../rating.ts';
import type { StoredRoom } from '../room-model.ts';

type ResultEntry = {
  userId: string;
  name: string;
  won: boolean;
  delta: number;
  rating: number;
  before: number;
  games: number;
  wins: number;
};
export async function settleRanking(room: StoredRoom) {
  if (
    !room.config.ranked ||
    !room.engine?.match.complete ||
    !room.engine.match.winner
  )
    return;
  const db = getDb();
  for (let attempt = 0; attempt < 4; attempt++) {
    if (
      await db
        .prepare('SELECT room_id FROM ranked_results WHERE room_id = ?')
        .bind(room.id)
        .first()
    )
      return;
    const entries: ResultEntry[] = await Promise.all(
      room.members.map(async (member) => {
        const old = await db
          .prepare('SELECT rating, games, wins FROM ratings WHERE id = ?')
          .bind(`${room.config.format}:${member.userId}`)
          .first<RatingEntry>();
        return {
          userId: member.userId,
          name: member.name,
          won:
            room.engine!.seats.find((s) => s.id === member.seatId)!.team ===
            room.engine!.match.winner,
          delta: 0,
          rating: old?.rating ?? INITIAL_RATING,
          before: old?.rating ?? INITIAL_RATING,
          games: old?.games ?? 0,
          wins: old?.wins ?? 0,
        };
      }),
    );
    const average = (won: boolean) => {
      const team = entries.filter((e) => e.won === won);
      return team.reduce((sum, e) => sum + e.before, 0) / team.length;
    };
    const capped = await cappedOpponentPairs(entries.map((e) => e.userId));
    const rated = !entries.some((a) =>
      entries.some(
        (b) => a.won !== b.won && capped.has(opponentPair(a.userId, b.userId)),
      ),
    );
    const delta = rated ? eloDelta(average(true), average(false)) : 0;
    for (const e of entries) {
      e.delta = e.won ? delta : -delta;
      e.rating += e.delta;
    }
    const token = crypto.randomUUID();
    // Database batches are atomic. The result claims unchanged ratings before any write;
    // a concurrent match either wins this claim or retries from fresh ratings.
    const checks = entries
      .map(() => '(COALESCE((SELECT games FROM ratings WHERE id = ?), 0) = ?)')
      .join(' AND ');
    const opponents = entries
      .filter((e) => e.won)
      .flatMap((a) =>
        entries.filter((e) => !e.won).map((b) => [a.userId, b.userId]),
      );
    const limitChecks = rated
      ? opponents
          .map(
            () =>
              `(SELECT COUNT(*) FROM ranked_results r, jsonb_array_elements(r.data::jsonb) a, jsonb_array_elements(r.data::jsonb) b WHERE r.rated = 1 AND r.created_at > ? AND a.value->>'userId' = ? AND b.value->>'userId' = ? AND a.value->>'won' != b.value->>'won') < 3`,
          )
          .join(' AND ')
      : 'TRUE';
    const claim = db
      .prepare(
        `INSERT INTO ranked_results (room_id, token, format, created_at, data, rated) SELECT ?, ?, ?, ?, ?, ? WHERE ${checks} AND ${limitChecks} ON CONFLICT DO NOTHING`,
      )
      .bind(
        room.id,
        token,
        room.config.format,
        Date.now(),
        JSON.stringify(entries),
        Number(rated),
        ...entries.flatMap((e) => [
          `${room.config.format}:${e.userId}`,
          e.games,
        ]),
        ...(rated
          ? opponents.flatMap(([a, b]) => [Date.now() - 86400_000, a, b])
          : []),
      );
    const results = await db.batch([
      claim,
      ...entries.map((e) =>
        db
          .prepare(`INSERT INTO ratings (id, user_id, format, name, rating, games, wins, peak)
      SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM ranked_results WHERE room_id = ? AND token = ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, rating = excluded.rating, games = excluded.games, wins = excluded.wins, peak = GREATEST(ratings.peak, excluded.rating)`)
          .bind(
            `${room.config.format}:${e.userId}`,
            e.userId,
            room.config.format,
            e.name,
            e.rating,
            e.games + Number(rated),
            e.wins + Number(rated && e.won),
            Math.max(INITIAL_RATING, e.rating),
            room.id,
            token,
          ),
      ),
    ]);
    if (results[0].meta.changes === 1) return;
  }
  throw new Error(
    'El resultado está guardado; el ranking se actualizará al volver a consultar la mesa.',
  );
}
export async function readRanking(
  userId: string,
  format: '1v1' | '2v2',
): Promise<Ranking> {
  const db = getDb();
  // Recover a stored result if a previous request ended between the game and rating writes.
  const pending = await db
    .prepare(`SELECT DISTINCT r.data FROM rooms r, jsonb_array_elements(r.data::jsonb->'members') m
    WHERE r.data::jsonb#>>'{config,ranked}' = 'true' AND r.data::jsonb#>>'{engine,match,complete}' = 'true'
    AND m.value->>'userId' = ? AND NOT EXISTS (SELECT 1 FROM ranked_results x WHERE x.room_id = r.id) LIMIT 10`)
    .bind(userId)
    .all<{ data: string }>();
  for (const row of pending.results)
    await settleRanking(JSON.parse(row.data) as StoredRoom);
  const [you, leaders, history] = await Promise.all([
    db
      .prepare('SELECT name, rating, games, wins FROM ratings WHERE id = ?')
      .bind(`${format}:${userId}`)
      .first<RatingEntry>(),
    db
      .prepare(
        'SELECT name, rating, games, wins FROM ratings WHERE format = ? AND games > 0 ORDER BY rating DESC, games DESC, id LIMIT 20',
      )
      .bind(format)
      .all<RatingEntry>(),
    db
      .prepare(`SELECT r.room_id AS room, r.created_at AS at, r.rated, (e.value->>'won')::boolean AS won, (e.value->>'delta')::int AS delta, (e.value->>'rating')::int AS rating
      FROM ranked_results r, jsonb_array_elements(r.data::jsonb) e WHERE r.format = ? AND e.value->>'userId' = ? ORDER BY r.created_at DESC LIMIT 10`)
      .bind(format, userId)
      .all<Ranking['history'][number]>(),
  ]);
  return { format, you, leaders: leaders.results, history: history.results };
}
