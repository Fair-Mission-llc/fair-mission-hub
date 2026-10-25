// POST /api/advisory/invitations/accept { token } - the invited member accepts an Advisory Panel invitation (Sprint 10
// Revision 3.2). The member must be signed in as the member the token names. The server gives them the panelist role in
// the inviter's name (advisory.setPanelist, so the inviter must still be an Active Super Admin) and re-issues the
// session cookie with the role added, so the panel opens at once. 401 without a session, 403 in a view-as session,
// 400 for a malformed, forged or expired link, 403 when the link belongs to another member or the inviter lost the
// right to designate panelists.
import { NextResponse } from 'next/server';
import { ADVISORY_PANELIST_ROLE, describeError } from '@kofc/shared';
import { verifyAdvisoryInvite } from '@/services/server/advisory-invite';
import { portalSessionSecret } from '@/services/server/secrets';
import { memberDirectory, requirePortalSession } from '@/services/server/session';
import { PORTAL_SESSION_COOKIE, secureCookies, sessionCookieHeader, signSessionToken } from '@/services/server/session-token';

export async function POST(req: Request) {
  const session = await requirePortalSession(req, (actor) => actor.active);
  if ('denied' in session) return session.denied;
  const payload = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const invite = await verifyAdvisoryInvite(typeof payload?.token === 'string' ? payload.token : null, portalSessionSecret());
  if (!invite) return NextResponse.json({ message: 'This invitation link is not valid or has expired. Ask the platform owner for a new one.' }, { status: 400 });
  if (invite.memberId !== session.claims.memberId) {
    return NextResponse.json({ message: 'This invitation was sent to another member. Sign in with your own account.' }, { status: 403 });
  }
  try {
    await (await memberDirectory()).advisory.setPanelist(invite.inviterId, invite.memberId, true);
  } catch (err) {
    return NextResponse.json({ message: describeError(err) }, { status: 403 });
  }
  const roles = session.claims.roles.includes(ADVISORY_PANELIST_ROLE) ? session.claims.roles : [...session.claims.roles, ADVISORY_PANELIST_ROLE];
  const token = await signSessionToken({ ...session.claims, roles }, portalSessionSecret());
  console.info(`[advisory] member ${invite.memberId} accepted the Advisory Panel invitation from member ${invite.inviterId}.`);
  return NextResponse.json({ accepted: true }, { headers: { 'Set-Cookie': sessionCookieHeader(token, secureCookies(), PORTAL_SESSION_COOKIE) } });
}
