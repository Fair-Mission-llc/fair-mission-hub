// Personal calendar feed links (Sprint 9 Revision 2.0): the token in /api/calendar/sync?token=... that tells the server
// whose schedule to send. A calendar app fetches the feed with no cookie and no sign-in, so the link itself is the key:
//
//   <member id>.<base64url(HMAC-SHA256(secret, 'kofc-calendar-feed:v1:<member id>'))>
//
// Only the server can mint one (the secret is services/server/secrets.ts calendarFeedSecret), and a token opens one
// member's own read-only schedule, nothing else. Schema 97 has no table for it, so a token does not expire and cannot be
// revoked one by one: changing CALENDAR_FEED_SECRET (or, when it is not set, PORTAL_SESSION_SECRET) retires every link.
// Pure Web Crypto, like session-token.ts, so the route and the unit tests share it.

const encoder = new TextEncoder();
const PURPOSE = 'kofc-calendar-feed:v1:';

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signature(memberId: number, secret: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(`${PURPOSE}${memberId}`))));
}

/** Compares two strings in time that does not depend on where they differ. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The feed token for one member. */
export async function signCalendarToken(memberId: number, secret: string): Promise<string> {
  return `${memberId}.${await signature(memberId, secret)}`;
}

/** The member id a token was minted for, or null for a malformed or forged token. */
export async function verifyCalendarToken(token: string | null | undefined, secret: string): Promise<number | null> {
  const m = /^([1-9]\d{0,9})\.([A-Za-z0-9_-]{43})$/.exec((token ?? '').trim());
  if (!m) return null;
  const memberId = Number(m[1]);
  if (!Number.isSafeInteger(memberId)) return null;
  return sameText(m[2], await signature(memberId, secret)) ? memberId : null;
}

/** The feed path for a token. */
export const calendarFeedPath = (token: string): string => `/api/calendar/sync?token=${encodeURIComponent(token)}`;

/**
 * The origin a calendar app should call: the request's own, or the proxy's forwarded host and protocol when the
 * portal runs behind one.
 */
export function publicOrigin(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host') || url.host;
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || url.protocol.replace(/:$/, '');
  return `${proto}://${host}`;
}
