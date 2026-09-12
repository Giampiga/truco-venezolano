// Only the lobby and its room invitation are valid post-auth destinations.
export function authReturnPath(value: string | null) {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value))
    return '/';
  const url = new URL(value, 'https://truco.invalid');
  const code = url.searchParams.get('mesa')?.toUpperCase();
  return url.pathname === '/' && code && /^[A-Z0-9]{6}$/.test(code)
    ? `/?mesa=${code}`
    : '/';
}

export function authDestination(url: URL, password = false) {
  const next = authReturnPath(url.searchParams.get('next'));
  return new URL(
    password ? `/auth/reset-password?next=${encodeURIComponent(next)}` : next,
    url.origin,
  );
}
