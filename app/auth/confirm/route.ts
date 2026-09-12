import { NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth/server';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const auth = await serverAuth();
  if (
    auth &&
    token_hash &&
    (type === 'signup' ||
      type === 'email_change' ||
      type === 'recovery' ||
      type === 'email')
  ) {
    const { error } = await auth.auth.verifyOtp({ token_hash, type });
    if (!error)
      return NextResponse.redirect(
        new URL(
          type === 'recovery' || type === 'email_change'
            ? '/auth/reset-password'
            : '/',
          url.origin,
        ),
      );
  }
  return NextResponse.redirect(new URL('/?auth_error=1', url.origin));
}
