import { getDb } from './db';
import { serverAuth } from '../auth/server';
import { RoomError, cleanName } from '../room-model.ts';
export async function identity(request: Request) {
  // Local guest identities are compiled out of production builds.
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.TRUCO_LOCAL_TEST_AUTH === '1'
  ) {
    const existing = request.headers
      .get('cookie')
      ?.match(/(?:^|;\s*)truco_dev=([a-f0-9-]{36})(?:;|$)/)?.[1];
    const id = existing ?? crypto.randomUUID();
    return {
      id,
      registered: request.headers.get('x-truco-test-guest') !== '1',
      cookie: existing
        ? null
        : `truco_dev=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`,
    };
  }
  const auth = await serverAuth();
  const { data, error } = auth
    ? await auth.auth.getUser()
    : { data: { user: null }, error: null };
  if (
    error &&
    ((error.status ?? 0) >= 500 || error.name === 'AuthRetryableFetchError')
  )
    throw error;
  if (data.user) {
    const registered =
      !data.user.is_anonymous && !!data.user.email_confirmed_at;
    if (
      registered &&
      !(await getDb()
        .prepare('SELECT user_id FROM profiles WHERE user_id = ?')
        .bind(data.user.id)
        .first())
    ) {
      let name = 'Jugador';
      try {
        name = cleanName(data.user.user_metadata?.display_name);
      } catch {
        /* A missing or invalid display name uses the default. */
      }
      await getDb()
        .prepare(
          "INSERT INTO profiles (user_id, handle, name, bio) VALUES (?, ?, ?, '') ON CONFLICT DO NOTHING",
        )
        .bind(
          data.user.id,
          `jugador_${data.user.id.replaceAll('-', '').slice(0, 12)}`,
          name,
        )
        .run();
    }
    return { id: data.user.id, cookie: null, registered };
  }
  throw new RoomError('Inicia sesión o entra como invitado para jugar.', 401);
}
export function requireRegistered(viewer: { registered: boolean }) {
  if (!viewer.registered)
    throw new RoomError(
      'Necesitas una cuenta con correo confirmado para usar esta función.',
      403,
    );
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    throw new RoomError('Origen no permitido.', 403);
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    throw new RoomError('Origen no permitido.', 403);
}
export function json(value: unknown, status = 200, cookie?: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(JSON.stringify(value), { status, headers });
}
export async function body(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new RoomError('Se requiere JSON.', 415);
  if (Number(request.headers.get('content-length')) > 8192)
    throw new RoomError('Solicitud demasiado grande.', 413);
  if (!request.body) throw new RoomError('Solicitud vacía.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      throw new RoomError('Solicitud demasiado grande.', 413);
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(text);
  } catch {
    throw new RoomError('JSON inválido.');
  }
}
export function failure(error: unknown) {
  if (error instanceof RoomError)
    return json({ error: error.message }, error.status);
  console.error(
    'Room request failed',
    error instanceof Error ? error.message : 'Unknown error',
  );
  return json(
    { error: 'No se pudo actualizar la mesa. Inténtalo de nuevo.' },
    503,
  );
}
