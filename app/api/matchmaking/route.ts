import {
  identity,
  json,
  failure,
  assertSameOrigin,
  body,
} from '@/lib/server/identity';
import { matchmaking } from '@/lib/server/matchmaking';
import { RoomError } from '@/lib/room-model';
export async function GET(request: Request) {
  try {
    const viewer = await identity(request);
    return json(
      await matchmaking(viewer.id, { type: 'status' }),
      200,
      viewer.cookie,
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const viewer = await identity(request);
    const input = await body(request);
    if (!input || !['join', 'poll', 'cancel'].includes(input.type))
      throw new RoomError('Acción de búsqueda inválida.');
    return json(await matchmaking(viewer.id, input), 200, viewer.cookie);
  } catch (error) {
    return failure(error);
  }
}
