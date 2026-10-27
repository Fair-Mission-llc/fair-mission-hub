// POST /api/auth/webauthn/login { id, clientDataJSON, authenticatorData, signature } - 'Sign in with FaceID' (Sprint 10
// Revision 5.0, services/server/webauthn.ts). The server checks the signed answer against the stored public key, re-reads
// the member from its own data and sets the session cookie exactly as a password sign-in does; it answers { user }. 401
// when the answer fails a check or the passkey was retired (a new login, or the council switched biometric sign-in off).
// Each attempt needs a fresh one-time challenge and the device's own face or fingerprint check, so there is no password
// to guess.
import { NextResponse } from 'next/server';
import { describeError } from '@kofc/shared';
import { publicOrigin } from '@/services/server/calendar-token';
import { portalSessionSecret } from '@/services/server/secrets';
import { memberDirectory } from '@/services/server/session';
import { secureCookies, sessionClaimsFor, sessionCookieHeader, signSessionToken } from '@/services/server/session-token';
import { passkeySessionUser, verifyPasskeyAssertion } from '@/services/server/webauthn';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  let passkey;
  try {
    passkey = await verifyPasskeyAssertion(body ?? {}, publicOrigin(req));
  } catch (err) {
    return NextResponse.json({ signedIn: false, message: describeError(err) }, { status: 401 });
  }
  const found = await passkeySessionUser(passkey);
  if (!found) {
    return NextResponse.json({ signedIn: false, message: 'FaceID sign-in is no longer set up for this account. Sign in with your password.' }, { status: 401 });
  }
  const platform = await (await memberDirectory()).councils.getPlatformSettings();
  const claims = sessionClaimsFor(found.user, found.active, new Date(), platform.user_session_expiry_hours * 60 * 60);
  const res = NextResponse.json({ signedIn: true, user: found.user });
  res.headers.set('Set-Cookie', sessionCookieHeader(await signSessionToken(claims, portalSessionSecret()), secureCookies()));
  console.info(`[webauthn] member ${found.user.memberId} signed in with FaceID.`);
  return res;
}
