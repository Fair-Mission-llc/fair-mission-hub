// GET /api/calendar/link - the signed-in member's own personal calendar feed link (Sprint 9 Revision 2.0), for the
// '🗓️ Sync with Your Phone Calendar' card on the Calendar page. Only the server holds the signing secret, so the browser
// asks here for { url, webcalUrl }. The member comes from the portal session cookie, never from the request.
// 401 without a portal session; 403 while a Super Admin views the portal as another member, because a feed link is a
// lasting key to that member's schedule.
import { NextResponse } from 'next/server';
import { webcalUrl } from '@kofc/shared';
import { calendarFeedPath, publicOrigin, signCalendarToken } from '@/services/server/calendar-token';
import { calendarFeedSecret } from '@/services/server/secrets';
import { requirePortalSession } from '@/services/server/session';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await requirePortalSession(req, () => true);
  if ('denied' in session) return session.denied;
  if (session.claims.impersonatorId !== undefined) {
    return NextResponse.json({ message: 'A calendar link is not given out while you view the portal as another member.' }, { status: 403 });
  }
  const token = await signCalendarToken(session.claims.memberId, calendarFeedSecret());
  const url = `${publicOrigin(req)}${calendarFeedPath(token)}`;
  return NextResponse.json({ url, webcalUrl: webcalUrl(url) }, { headers: { 'Cache-Control': 'no-store' } });
}
