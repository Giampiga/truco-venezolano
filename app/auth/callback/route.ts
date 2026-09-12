import { NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth/server';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const auth = await serverAuth();
  if (code && auth) {
    const { error } = await auth.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          url.searchParams.get('reset') === '1' ? '/auth/reset-password' : '/',
          url.origin,
        ),
      );
  }
  return NextResponse.redirect(new URL('/?auth_error=1', url.origin));
}
