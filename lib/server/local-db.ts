// Development-only Postgres engine; no external accounts needed for local verification.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
const state = globalThis as typeof globalThis & {
  trucoLocal?: Promise<PGlite>;
};
export function localDb() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Local database is disabled in production.');
  return (state.trucoLocal ??= (async () => {
    const db = new PGlite(process.env.TRUCO_LOCAL_DATABASE);
    const exists = await db.query("SELECT to_regclass('public.rooms') AS name");
    if (!(exists.rows[0] as { name: string | null }).name)
      await db.exec(
        await readFile('supabase/migrations/20260912000000_truco.sql', 'utf8'),
      );
    return db;
  })());
}
