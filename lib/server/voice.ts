import { signLiveKitToken, voiceConfigured } from '../voice-token.ts';
import type { StoredRoom } from '../room-model.ts';
import { getDb, getVoiceEnv } from './db.ts';

// Revocations are persisted with membership changes. A transient voice outage
// leaves this queue intact; subsequent room reads retry it.
export async function drainVoiceRevocations(
  room: StoredRoom,
): Promise<StoredRoom> {
  const ids = room.voiceRevocations ?? [];
  if (!ids.length) return room;
  const env = getVoiceEnv();
  if (!voiceConfigured(env)) return room;
  const url = new URL(env.LIVEKIT_URL);
  url.protocol = 'https:';
  url.pathname = '/twirp/livekit.RoomService/RemoveParticipant';
  url.search = '';
  const now = Math.floor(Date.now() / 1000);
  const token = await signLiveKitToken(env.LIVEKIT_API_SECRET, {
    iss: env.LIVEKIT_API_KEY,
    nbf: now - 5,
    exp: now + 60,
    video: { roomAdmin: true, room: `truco-${room.id}` },
  });
  try {
    await Promise.all(
      [...new Set(ids)].map(async (identity) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ room: `truco-${room.id}`, identity }),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
          const error = (await response.json()) as { code?: string };
          if (error.code !== 'not_found')
            throw new Error('LiveKit participant revocation failed');
        }
      }),
    );
  } catch {
    console.error('Voice revocation queued for retry');
    return room;
  }
  const next = { ...room, voiceRevocations: [], revision: room.revision + 1 };
  const result = await getDb()
    .prepare(
      'UPDATE rooms SET data = ?, revision = ? WHERE id = ? AND revision = ?',
    )
    .bind(JSON.stringify(next), next.revision, room.id, room.revision)
    .run();
  return result.meta.changes === 1 ? next : room;
}
