import { getDb } from '@/lib/server/db';
import { identity, assertSameOrigin, body, json, failure } from '@/lib/server/identity';
import { RoomError, cleanName } from '@/lib/room-model';
export async function GET(request: Request) {
  try {
    const viewer = await identity(request);
    const rows = await getDb().prepare('SELECT rowid AS id, author, handle, message, at, user_id = ? AS own FROM global_messages ORDER BY at DESC, id DESC LIMIT 80').bind(viewer.id).all();
    return json({messages: rows.results.reverse()}, 200, viewer.cookie);
  } catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const viewer = await identity(request);
    const input = await body(request);
    if (!input || typeof input.text !== 'string' || input.text.length > 300 || typeof input.id !== 'string' || !/^[a-f0-9-]{36}$/.test(input.id)) throw new RoomError('Mensaje inválido. Máximo 300 caracteres.');
    const message = input.text.replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (!message) throw new RoomError('Escribe un mensaje.');
    const db = getDb();
    const id = `${viewer.id}:${input.id}`;
    if (await db.prepare('SELECT id FROM global_messages WHERE id = ?').bind(id).first()) return json({ok:true}, 200, viewer.cookie);
    const profile = await db.prepare('SELECT name, handle FROM profiles WHERE user_id = ?').bind(viewer.id).first<{name:string;handle:string}>();
    const now = Date.now();
    const result = await db.prepare('INSERT OR IGNORE INTO global_messages (id, user_id, author, handle, message, at) SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM global_messages WHERE user_id = ? AND at > ?)').bind(id, viewer.id, profile?.name ?? cleanName(input.name), profile?.handle ?? null, message, now, viewer.id, now - 3000).run();
    if (!result.meta.changes) throw new RoomError('Espera 3 segundos antes de enviar otro mensaje.', 429);
    await db.prepare('DELETE FROM global_messages WHERE id IN (SELECT id FROM global_messages ORDER BY at DESC, id DESC LIMIT -1 OFFSET 200)').run();
    return json({ok:true}, 200, viewer.cookie);
  } catch (e) { return failure(e); }
}
