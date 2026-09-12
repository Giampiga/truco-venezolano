import postgres from 'postgres';

type Rows = { rows: Record<string, unknown>[]; changes: number };
type Query = (sql: string, values: unknown[]) => Promise<Rows>;
const database = globalThis as typeof globalThis & {
  trucoSql?: ReturnType<typeof postgres>;
};
function connection() {
  if (!process.env.DATABASE_URL)
    throw new Error('Falta configurar DATABASE_URL.');
  return (database.trucoSql ??= postgres(process.env.DATABASE_URL, {
    prepare: false,
    ssl: true,
    max: 3,
    types: { bigint: { to: 20, from: [20], serialize: String, parse: Number } },
  }));
}
const local = () =>
  process.env.NODE_ENV !== 'production' && !!process.env.TRUCO_LOCAL_DATABASE;
const query: Query = async (sql, values) => {
  if (local()) {
    const db = await (await import('./local-db')).localDb();
    const result = await db.query<Record<string, unknown>>(sql, values);
    return { rows: result.rows, changes: result.affectedRows ?? 0 };
  }
  const result = await connection().unsafe(sql, values as never[]);
  return { rows: [...result], changes: result.count };
};
class Statement {
  values: unknown[] = [];
  sql: string;
  constructor(sql: string) {
    let index = 0;
    // Queries use positional placeholders only; never interpolate user input.
    this.sql = sql.replace(/\?/g, () => `$${++index}`);
  }
  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }
  async all<T = Record<string, unknown>>() {
    return { results: (await query(this.sql, this.values)).rows as T[] };
  }
  async first<T = Record<string, unknown>>() {
    return (await this.all<T>()).results[0] ?? null;
  }
  async run() {
    return (await getDb().batch([this]))[0];
  }
}
export function getDb() {
  return {
    prepare: (sql: string) => new Statement(sql),
    async batch(statements: Statement[]) {
      if (local()) {
        const db = await (await import('./local-db')).localDb();
        return db.transaction(async (tx) => {
          const results = [];
          for (const statement of statements) {
            const result = await tx.query(statement.sql, statement.values);
            results.push({ meta: { changes: result.affectedRows ?? 0 } });
          }
          return results;
        });
      }
      return connection().begin(async (tx) => {
        // ponytail: serialize writes for rating/queue claims; use per-player locks when write throughput requires it.
        await tx`SELECT pg_advisory_xact_lock(748261)`;
        const results = [];
        for (const statement of statements) {
          const rows = await tx.unsafe(
            statement.sql,
            statement.values as never[],
          );
          results.push({ meta: { changes: rows.count } });
        }
        return results;
      });
    },
  };
}
export function getVoiceEnv() {
  return {
    LIVEKIT_URL: process.env.LIVEKIT_URL,
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
  };
}
