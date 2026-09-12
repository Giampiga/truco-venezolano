import { profileRoom } from '@/lib/server/profiles';
import {
  assertSameOrigin,
  body,
  failure,
  identity,
  json,
} from '@/lib/server/identity';
import { mutateRoom, readRoom } from '@/lib/server/rooms';
import { projectRoom, type RoomAction } from '@/lib/room-model';
import { drainVoiceRevocations } from '@/lib/server/voice';
import { settleRanking } from '@/lib/server/ranking';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const viewer = await identity(request);
    const { id } = await context.params;
    const room = await readRoom(id);
    projectRoom(room, viewer.id);
    await settleRanking(room);
    return json(
      await profileRoom(await drainVoiceRevocations(room), viewer.id),
      200,
      viewer.cookie,
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const viewer = await identity(request);
    const { id } = await context.params;
    const action = (await body(request)) as RoomAction;
    const room = await drainVoiceRevocations(
      await mutateRoom(id, viewer.id, action),
    );
    await settleRanking(room);
    return json(
      action.type === 'leave' ? { left: true } : await profileRoom(room, viewer.id),
      200,
      viewer.cookie,
    );
  } catch (error) {
    return failure(error);
  }
}
