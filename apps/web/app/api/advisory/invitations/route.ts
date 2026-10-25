// POST /api/advisory/invitations { memberId } - the platform owner invites a member of any council to the Application
// Advisory Panel (Sprint 10 Revision 3.2). The server reads the member from its own data copy, mints a signed invitation
// link good for ADVISORY_INVITE_DAYS (advisory-invite.ts) and emails it to the member's address on file
// (deliverServerEmail: SendGrid when live, otherwise logged). The browser chooses only the member, never the address or
// the text. 401 without a session, 403 unless the session is the platform owner's own (isPlatformOwner), 404 for an
// unknown member, 409 for a member who is already a panelist.
import { NextResponse } from 'next/server';
import {
  ADVISORY_INVITE_ACCEPT_PATH,
  ADVISORY_INVITE_DAYS,
  ADVISORY_PANELIST_ROLE,
  advisoryInviteEmail,
  buildSendGridMailRequest,
  councilLabel,
  isPlatformOwner,
  NOTIFICATION_SENDER,
} from '@kofc/shared';
import { signAdvisoryInvite } from '@/services/server/advisory-invite';
import { publicOrigin } from '@/services/server/calendar-token';
import { deliverServerEmail } from '@/services/server/notify';
import { portalSessionSecret } from '@/services/server/secrets';
import { memberDirectory, requirePortalSession } from '@/services/server/session';

export async function POST(req: Request) {
  const session = await requirePortalSession(req, (actor, claims) => actor.active && isPlatformOwner({ memberType: actor.memberType as never, username: claims.username }));
  if ('denied' in session) return session.denied;
  const payload = (await req.json().catch(() => null)) as { memberId?: unknown } | null;
  const memberId = payload?.memberId;
  if (typeof memberId !== 'number' || !Number.isInteger(memberId) || memberId <= 0) return NextResponse.json({ message: 'Name the member as memberId.' }, { status: 400 });

  const db = await memberDirectory();
  const member = await db.members.get(memberId);
  if (!member) return NextResponse.json({ message: `No member with id ${memberId}.` }, { status: 404 });
  if ((await db.members.listRoles(memberId)).some((r) => r.Role === ADVISORY_PANELIST_ROLE)) {
    return NextResponse.json({ message: `${member.MemberFirstName} ${member.MemberLastName} is already a panelist.` }, { status: 409 });
  }
  const [council, inviter] = await Promise.all([db.councils.get(member.CouncilID), db.members.get(session.claims.memberId)]);
  const expires = Math.floor(Date.now() / 1000) + ADVISORY_INVITE_DAYS * 86_400;
  const token = await signAdvisoryInvite({ memberId, inviterId: session.claims.memberId, expires }, portalSessionSecret());
  const link = `${publicOrigin(req)}${ADVISORY_INVITE_ACCEPT_PATH}?token=${encodeURIComponent(token)}`;
  const expiresOn = new Date(expires * 1000).toISOString().slice(0, 10);
  await deliverServerEmail(
    buildSendGridMailRequest(
      advisoryInviteEmail({
        to: member.Email,
        memberName: `${member.MemberFirstName} ${member.MemberLastName}`,
        inviterName: inviter ? `${inviter.MemberFirstName} ${inviter.MemberLastName}` : 'The platform owner',
        councilLabel: council ? councilLabel(council) : `council ${member.CouncilID}`,
        link,
        expiresOn,
        from: NOTIFICATION_SENDER,
      }),
    ),
  );
  console.info(`[advisory] platform owner ${session.claims.memberId} invited member ${memberId} to the Advisory Panel (until ${expiresOn}).`);
  return NextResponse.json({ sent: true, name: `${member.MemberFirstName} ${member.MemberLastName}`, expiresOn });
}
