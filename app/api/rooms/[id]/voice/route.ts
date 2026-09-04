import { getVoiceEnv } from '@/lib/server/db';
import {
  assertSameOrigin,
  failure,
  identity,
  json,
} from '@/lib/server/identity';
import { readRoom } from '@/lib/server/rooms';
import { requireMember, RoomError } from '@/lib/room-model';
import { voiceToken } from '@/lib/voice-token';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const viewer = await identity(request);
    const room = await readRoom((await context.params).id);
    const member = requireMember(room, viewer.id);
    if (room.closed || !room.config.voice)
      throw new RoomError('La voz está desactivada en esta mesa.', 403);
    let result;
    try {
      result = await voiceToken(
        getVoiceEnv(),
        room.id,
        member.voiceId,
        member.name,
      );
    } catch (error) {
      throw new RoomError(
        error instanceof Error ? error.message : 'La voz no está disponible.',
        503,
      );
    }
    return json(result, 200, viewer.cookie);
  } catch (error) {
    return failure(error);
  }
}
