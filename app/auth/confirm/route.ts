import { NextResponse } from 'next/server';
import { serverAuth } from '@/lib/auth/server';
import { authDestination } from '@/lib/auth/return-path';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  try {
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
          authDestination(url, type === 'recovery' || type === 'email_change'),
        );
    }
  } catch {
    // Leave a usable retry path when verification is unavailable.
  }
  const retry = authDestination(url);
  retry.searchParams.set('auth_error', '1');
  return NextResponse.redirect(retry);
}
