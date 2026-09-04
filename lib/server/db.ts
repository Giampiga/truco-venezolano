import { env } from 'cloudflare:workers';
export function getDb(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error('La conexión de las salas no está disponible.');
  return db;
}
export function getVoiceEnv() {
  return env as unknown as {
    LIVEKIT_URL?: string;
    LIVEKIT_API_KEY?: string;
    LIVEKIT_API_SECRET?: string;
  };
}
