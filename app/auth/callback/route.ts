import { NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth/server';
import { authDestination } from '@/lib/auth/return-path';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  try {
    const auth = await serverAuth();
    if (code && auth) {
      const { error } = await auth.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(
          authDestination(url, url.searchParams.get('reset') === '1'),
        );
    }
  } catch {
    // An unavailable auth service gets the same retry flow as an expired link.
  }
  const retry = authDestination(url);
  retry.searchParams.set('auth_error', '1');
  return NextResponse.redirect(retry);
}
