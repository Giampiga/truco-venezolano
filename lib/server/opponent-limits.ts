import { getDb } from './db';
export const opponentPair = (a: string, b: string) => [a, b].sort().join(':');
export async function cappedOpponentPairs(userIds: string[], now = Date.now()) {
  const rows = await getDb()
    .prepare(`SELECT a.value->>'userId' AS a, b.value->>'userId' AS b
    FROM ranked_results r, jsonb_array_elements(r.data::jsonb) a, jsonb_array_elements(r.data::jsonb) b
    WHERE r.rated = 1 AND r.created_at > ?
    AND a.value->>'userId' IN (${userIds.map(() => '?').join(',')})
    AND a.value->>'won' != b.value->>'won'
    GROUP BY a, b HAVING COUNT(*) >= 3`)
    .bind(now - 86400_000, ...userIds)
    .all<{ a: string; b: string }>();
  return new Set(rows.results.map((r) => opponentPair(r.a, r.b)));
}
