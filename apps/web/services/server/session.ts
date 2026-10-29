// Server-side portal sessions for the app/api routes (Sprint 6Z-Engine-Upgrade).
//
// Until now the portal had no server sessions: the memory driver runs in the browser, so the Drive vault and Supreme
// routes could not tell who was calling. Now sign-in also posts the username and password to /api/auth/session. The
// server checks them against ITS OWN copy of the data (a MemoryDataService seeded from the same Seed.sql, so the same
// logins work), reads the member's type, roles and status there, and answers with an HttpOnly cookie carrying the signed
// claims (session-token.ts). Routes then call requirePortalSession, which trusts only that cookie, never anything the
// browser says about itself.
//
// LIMIT OF THE MOCK: the server's copy does not see what changes in a browser tab (a password reset, a member added and
// registered there, a role or type change). A member whose record exists only in a tab gets no server session, and a
// tab-only promotion is not honoured, until the remote driver puts both sides on one database. Live Drive, SendGrid and
// Supreme actions are refused for them, which fails closed.
import { NextResponse } from 'next/server';
import type { DataService, MemberWriteActor, SessionUser } from '@kofc/shared';
import { MemoryDataService } from '../drivers/memory';
import { hubModeOn, serializedHub } from './hub/hub-vault';
import { deliverServerEmail } from './notify';
import { portalSessionSecret } from './secrets';
import {
  PORTAL_SESSION_COOKIE,
  readCookie,
  secureCookies,
  sessionActor,
  sessionClaimsFor,
  sessionCookieHeader,
  signSessionToken,
  SignInThrottle,
  verifySessionToken,
  type PortalSessionClaims,
} from './session-token';

let directory: MemoryDataService | null = null;
const throttle = new SignInThrottle();

/**
 * The server's own copy of the member data, seeded once per process like the browser's. Sprint 6Z-Email-Proxy: it also
 * holds each council's email gateway, saved through /api/councils/email-gateway and read by the notification route.
 * Sprint 9 Revision 4.0: in hub mode (npm run build:pilot) it is the pilot hub's vault instead (hub/hub-vault.ts), the
 * one database every device works on, so the limit of the mock below does not apply there.
 */
export async function memberDirectory(): Promise<DataService> {
  if (hubModeOn()) return serializedHub();
  // Sprint 7F: the server copy's own email (the council access request notice) goes through deliverServerEmail.
  directory ??= new MemoryDataService({ presentationData: true, log: () => {}, sendEmail: deliverServerEmail });
  await directory.init();
  return directory;
}


/**
 * Sprint 11 Revision 12.0: a successful outcome also carries `active` and the member's phone and email, so the route can
 * ask an Admin or Super Admin for a sign-in code (two-factor.ts) before it sets `cookie`.
 */
export type SignInOutcome =
  | { ok: true; user: SessionUser; cookie: string; active: boolean; contact: { phone: string | null; email: string | null } }
  | { ok: false; status: 401 | 429; message: string };

/** Checks the credentials on the server and, when they are good, mints the session cookie. */
export async function signInOnServer(username: string, password: string, now = new Date()): Promise<SignInOutcome> {
  const key = username.trim().toLowerCase();
  if (throttle.isLocked(key, now.getTime())) return { ok: false, status: 429, message: 'Too many failed sign-ins. Wait 15 minutes and try again.' };
  const db = await memberDirectory();
  const user = await db.auth.signIn(username.trim(), password);
  if (!user) {
    throttle.fail(key, now.getTime());
    return { ok: false, status: 401, message: 'The username or password is not correct.' };
  }
  throttle.clear(key);
  const [member, statuses, platform] = await Promise.all([db.members.get(user.memberId), db.lookups.list('MemberStatus'), db.councils.getPlatformSettings()]);
  const activeId = statuses.find((st) => st.Status === 'Active')?.id;
  // Sprint 7E: the session lasts the platform's user_session_expiry_hours, read from the server's own copy of the data.
  const active = member !== null && member.StatusID === activeId;
  const claims = sessionClaimsFor(user, active, now, platform.user_session_expiry_hours * 60 * 60);
  return {
    ok: true,
    user,
    active,
    contact: { phone: member?.Phone ?? null, email: member?.Email ?? null },
    cookie: sessionCookieHeader(await signSessionToken(claims, portalSessionSecret()), secureCookies()),
  };
}

/** The Set-Cookie header that ends the session. */
export const signOutCookie = (): string => sessionCookieHeader(null, secureCookies());

/** The caller's verified session claims, or null. */
export async function readPortalSession(req: Request, now = new Date()): Promise<PortalSessionClaims | null> {
  return verifySessionToken(readCookie(req.headers.get('cookie'), PORTAL_SESSION_COOKIE), portalSessionSecret(), now);
}

/**
 * The caller's session when `allow` accepts its actor; otherwise the response to send instead: 401 with no valid session,
 * 403 when the member may not do this. `body` adds the route's own failure fields (e.g. { archived: false }).
 */
export async function requirePortalSession(
  req: Request,
  allow: (actor: MemberWriteActor, claims: PortalSessionClaims) => boolean,
  body: Record<string, unknown> = {},
): Promise<{ claims: PortalSessionClaims; actor: MemberWriteActor } | { denied: NextResponse }> {
  const claims = await readPortalSession(req);
  if (!claims) return { denied: NextResponse.json({ ...body, message: 'Sign in again: there is no portal session on the server.' }, { status: 401 }) };
  // Sprint 7F: a Super Admin viewing the portal as another member may read, never change, through these routes.
  if (claims.impersonatorId !== undefined && req.method !== 'GET' && req.method !== 'HEAD') {
    return { denied: NextResponse.json({ ...body, message: 'You are viewing the portal as another member, so nothing can be saved.' }, { status: 403 }) };
  }
  const actor = sessionActor(claims);
  if (!allow(actor, claims)) return { denied: NextResponse.json({ ...body, message: 'Your account may not do this.' }, { status: 403 }) };
  return { claims, actor };
}
