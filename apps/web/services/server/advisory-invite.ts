// Advisory Panel invitation links (Sprint 10 Revision 3.2, advisory-panel.ts). The token in
// /advisory-panel/accept?token=... names the invited member, the inviter and the expiry, signed by the server:
//
//   <member id>.<inviter id>.<expiry, unix seconds>.<base64url(HMAC-SHA256(secret, 'kofc-advisory-invite:v1:m:i:e'))>
//
// Only the server can mint one (the session key, services/server/secrets.ts portalSessionSecret), and a token is good
// only for the member it names, only until it expires, and only while its inviter is still an Active Super Admin (the
// accept route gives the role in the inviter's name). There is no table (the schema stays at 101), so a token cannot be
// revoked one by one before it expires; accepting twice changes nothing. Pure Web Crypto, like calendar-token.ts.
const encoder = new TextEncoder();
const PURPOSE = 'kofc-advisory-invite:v1:';

export interface AdvisoryInviteClaims {
  memberId: number;
  inviterId: number;
  /** Unix seconds. */
  expires: number;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signature(c: AdvisoryInviteClaims, secret: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(`${PURPOSE}${c.memberId}:${c.inviterId}:${c.expires}`))));
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signAdvisoryInvite(claims: AdvisoryInviteClaims, secret: string): Promise<string> {
  return `${claims.memberId}.${claims.inviterId}.${claims.expires}.${await signature(claims, secret)}`;
}

/** The claims of a genuine, unexpired token; null for a malformed, forged or expired one. */
export async function verifyAdvisoryInvite(token: string | null | undefined, secret: string, now: Date = new Date()): Promise<AdvisoryInviteClaims | null> {
  const m = /^([1-9]\d{0,9})\.([1-9]\d{0,9})\.(\d{9,11})\.([A-Za-z0-9_-]{43})$/.exec((token ?? '').trim());
  if (!m) return null;
  const claims = { memberId: Number(m[1]), inviterId: Number(m[2]), expires: Number(m[3]) };
  if (claims.expires * 1000 <= now.getTime()) return null;
  return sameText(m[4]!, await signature(claims, secret)) ? claims : null;
}
