import { identity, json, failure } from '@/lib/server/identity';
import { readRanking } from '@/lib/server/ranking';
export async function GET(request: Request) {
  try {
    const viewer = await identity(request);
    const format =
      new URL(request.url).searchParams.get('format') === '2v2' ? '2v2' : '1v1';
    return json(await readRanking(viewer.id, format), 200, viewer.cookie);
  } catch (error) {
    return failure(error);
  }
}
