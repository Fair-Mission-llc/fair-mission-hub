// /api/auth/session - the portal's server session (Sprint 6Z-Engine-Upgrade).
//   POST   { username, password }  checks the credentials on the server and sets the HttpOnly session cookie
//   GET                            answers who the cookie belongs to (401 without one)
//   DELETE                         clears the cookie (sign-out)
//   PATCH                          Sprint 10 Revision 4.0: re-reads the member's roles from the server's data and re-issues
//                                  the cookie with them (after accepting an Advisory Panel invitation). The browser
//                                  sends nothing: the roles always come from the data, never from the request.
// The browser's own sign-in (the memory driver) runs alongside; this cookie is what the Drive vault, Supreme and email
// routes trust. Five failed attempts for one username within 15 minutes are refused with 429.
import { NextResponse } from 'next/server';
import { memberDirectory, readPortalSession, requirePortalSession, signInOnServer, signOutCookie } from '@/services/server/session';
import { portalSessionSecret } from '@/services/server/secrets';
import { PORTAL_SESSION_COOKIE, secureCookies, sessionCookieHeader, signSessionToken } from '@/services/server/session-token';

/** Longest username or password read; anything longer is refused before hashing. */
const MAX_FIELD_LENGTH = 256;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  const { username, password } = body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password || username.length > MAX_FIELD_LENGTH || password.length > MAX_FIELD_LENGTH) {
    return NextResponse.json({ signedIn: false, message: 'Send a username and password.' }, { status: 400 });
  }
  const outcome = await signInOnServer(username, password);
  if (!outcome.ok) return NextResponse.json({ signedIn: false, message: outcome.message }, { status: outcome.status });
  const res = NextResponse.json({ signedIn: true, memberId: outcome.user.memberId });
  res.headers.set('Set-Cookie', outcome.cookie);
  return res;
}

export async function GET(req: Request) {
  const claims = await readPortalSession(req);
  if (!claims) return NextResponse.json({ signedIn: false }, { status: 401 });
  return NextResponse.json({
    signedIn: true,
    memberId: claims.memberId,
    councilId: claims.councilId,
    memberType: claims.memberType,
    roles: claims.roles,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  });
}

export async function PATCH(req: Request) {
  const session = await requirePortalSession(req, (actor) => actor.active, { signedIn: true });
  if ('denied' in session) return session.denied;
  const held = await (await memberDirectory()).members.listRoles(session.claims.memberId);
  const roles = held.map((r) => r.Role);
  const token = await signSessionToken({ ...session.claims, roles, isOfficer: held.some((r) => r.Officer === 1) }, portalSessionSecret());
  const res = NextResponse.json({ signedIn: true, roles });
  res.headers.set('Set-Cookie', sessionCookieHeader(token, secureCookies(), PORTAL_SESSION_COOKIE));
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ signedIn: false });
  res.headers.set('Set-Cookie', signOutCookie());
  return res;
}
