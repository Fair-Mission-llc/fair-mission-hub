// /api/auth/two-factor (Sprint 11 Revision 12.0): the second sign-in step for Admins and Super Admins.
//   GET                       { sms, email } - which code channels this server can send with (no secrets)
//   POST { challenge, code }  checks the code against the challenge from POST /api/auth/session and, when it is right,
//                             sets the session cookie. Wrong codes: 401 with the tries left; too many or expired: 429/401.
import { NextResponse } from 'next/server';
import { portalSessionSecret } from '@/services/server/secrets';
import { memberDirectory } from '@/services/server/session';
import { secureCookies, sessionClaimsFor, sessionCookieHeader, signSessionToken } from '@/services/server/session-token';
import { twoFactorDelivery, verifyTwoFactorChallenge } from '@/services/server/two-factor';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(twoFactorDelivery());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { challenge?: unknown; code?: unknown } | null;
  const verdict = verifyTwoFactorChallenge(body?.challenge, body?.code);
  if (!verdict.ok) return NextResponse.json({ signedIn: false, message: verdict.message }, { status: verdict.status });
  const platform = await (await memberDirectory()).councils.getPlatformSettings();
  const claims = sessionClaimsFor(verdict.user, verdict.active, new Date(), platform.user_session_expiry_hours * 60 * 60);
  const res = NextResponse.json({ signedIn: true, user: verdict.user });
  res.headers.set('Set-Cookie', sessionCookieHeader(await signSessionToken(claims, portalSessionSecret()), secureCookies()));
  console.info(`[two-factor] member ${verdict.user.memberId} finished signing in with a ${verdict.user.memberType} sign-in code.`);
  return res;
}
