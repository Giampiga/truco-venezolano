export type VoiceCredentials = {
  LIVEKIT_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
};
export function voiceConfigured(
  credentials: VoiceCredentials,
): credentials is Required<VoiceCredentials> {
  const {
    LIVEKIT_URL: url,
    LIVEKIT_API_KEY: key,
    LIVEKIT_API_SECRET: secret,
  } = credentials;
  return !!(
    url &&
    key &&
    secret &&
    URL.canParse(url) &&
    new URL(url).protocol === 'wss:'
  );
}
function base64url(bytes: Uint8Array) {
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
export async function signLiveKitToken(
  secret: string,
  claims: Record<string, unknown>,
) {
  const encoder = new TextEncoder();
  const encode = (value: unknown) =>
    base64url(encoder.encode(JSON.stringify(value)));
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return `${body}.${base64url(new Uint8Array(signature))}`;
}
export async function voiceToken(
  credentials: VoiceCredentials,
  roomId: string,
  seatId: string,
  name: string,
  now = Math.floor(Date.now() / 1000),
  camera = false,
) {
  if (!voiceConfigured(credentials))
    throw new Error(
      'La voz todavía no está disponible en esta mesa. Puedes usar el chat.',
    );
  const {
    LIVEKIT_URL: serverUrl,
    LIVEKIT_API_KEY: key,
    LIVEKIT_API_SECRET: secret,
  } = credentials;
  const token = await signLiveKitToken(secret, {
    iss: key,
    sub: seatId,
    name,
    nbf: now - 5,
    exp: now + 300,
    video: {
      roomJoin: true,
      room: `truco-${roomId}`,
      canPublish: true,
      canPublishSources: camera ? ['microphone', 'camera'] : ['microphone'],
      canSubscribe: true,
      canPublishData: false,
      canUpdateOwnMetadata: false,
    },
  });
  return { serverUrl, token };
}
