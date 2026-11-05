import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SETUP_TTL = 60 * 60;
export const SETUP_COOKIE = 'studio-invite-setup';
type SetupContext = { userId: string; sessionId: string; tokenDigest: string; expires: number };

export function tokenDigest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function signSetupContext(userId: string, sessionId: string, token: string, secret: string, now = Date.now()) {
  if (!secret || !userId || !sessionId || !token) throw new Error('Setup context is unavailable.');
  const payload = Buffer.from(JSON.stringify({ userId, sessionId, tokenDigest: tokenDigest(token), expires: now + SETUP_TTL * 1000 })).toString('base64url');
  return payload + '.' + createHmac('sha256', secret).update('invite-setup:' + payload).digest('base64url');
}

export function readSetupContext(value: string, secret: string, now = Date.now()): SetupContext | null {
  if (!secret || !value || value.length > 2048) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = createHmac('sha256', secret).update('invite-setup:' + payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const ctx = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SetupContext;
    return typeof ctx.userId === 'string' && !!ctx.userId && typeof ctx.sessionId === 'string' && !!ctx.sessionId
      && typeof ctx.tokenDigest === 'string' && typeof ctx.expires === 'number' && ctx.expires > now ? ctx : null;
  } catch { return null; }
}

export function matchesSetupContext(ctx: SetupContext | null, userId: string, sessionId: string, token = '') {
  return !!ctx && ctx.userId === userId && ctx.sessionId === sessionId && (!token || ctx.tokenDigest === tokenDigest(token));
}
