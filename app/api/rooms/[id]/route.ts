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
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const viewer = await identity(request);
    const { id } = await context.params;
    const room = await readRoom(id);
    projectRoom(room, viewer.id);
    return json(
      projectRoom(await drainVoiceRevocations(room), viewer.id),
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
    return json(
      action.type === 'leave' ? { left: true } : projectRoom(room, viewer.id),
      200,
      viewer.cookie,
    );
  } catch (error) {
    return failure(error);
  }
}
