import { identity, json, failure } from '@/lib/server/identity';
import { getDb } from '@/lib/server/db';
export async function GET(request: Request) {
  try {
    const viewer = await identity(request);
    const profile = viewer.registered
      ? await getDb()
          .prepare('SELECT handle, name FROM profiles WHERE user_id = ?')
          .bind(viewer.id)
          .first()
      : null;
    return json({ registered: viewer.registered, profile }, 200, viewer.cookie);
  } catch (error) {
    return failure(error);
  }
}
