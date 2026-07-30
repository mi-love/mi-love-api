import { Socket } from 'socket.io';

/**
 * Extract JWT from Socket.IO handshake.
 * Web clients usually send Authorization header; React Native must use
 * handshake.auth because extraHeaders are not applied to the WS transport.
 *
 * Supported:
 * - handshake.headers.authorization: "Bearer <token>"
 * - handshake.auth.authorization: "Bearer <token>"
 * - handshake.auth.token: raw access token
 */
export function extractSocketToken(client: Socket): string | undefined {
  const fromHeader = normalizeBearer(
    client.handshake.headers?.authorization as string | undefined,
  );
  if (fromHeader) return fromHeader;

  const auth = client.handshake.auth as
    | { token?: string; authorization?: string; access_token?: string }
    | undefined;

  if (!auth || typeof auth !== 'object') {
    return undefined;
  }

  const fromAuthBearer = normalizeBearer(auth.authorization);
  if (fromAuthBearer) return fromAuthBearer;

  const raw = auth.token || auth.access_token;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().replace(/^"|"$/g, '');
  }

  return undefined;
}

function normalizeBearer(value?: string): string | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const trimmed = value.trim().replace(/^"|"$/g, '');
  if (!trimmed) return undefined;

  if (/^Bearer\s+/i.test(trimmed)) {
    const token = trimmed.replace(/^Bearer\s+/i, '').trim();
    return token || undefined;
  }

  // Allow raw token in Authorization field
  return trimmed;
}
