// GET /api/calendar/sync?token=<feed token> - one member's personal calendar feed (Sprint 9 Revision 2.0), as a
// read-only iCalendar document (text/calendar) that Google Calendar, Apple Calendar and Outlook subscribe to.
//
// A calendar app sends no cookie, so the token is the only key (services/server/calendar-token.ts). It names one member,
// and the feed holds only that member's own schedule (calendar-feed.ts buildCalendarFeed): the shifts they signed up
// for - each with its event's name and location - and the meetings they are invited to, from 30 days ago onward.
// 404 for a missing, malformed or forged token, or a member who is gone; 403 for a member who is no longer Active.
//
// The route reads memberDirectory(). On a pilot hub build (Sprint 9 Revision 4.0) that is the persistent vault file,
// packages/backend/data/central-hub-vault.db, which every phone and browser writes to, so each sign-up - past shifts
// included, from 30 days back - is in the feed and stays there across hub restarts (Sprint 9 Revision 5.0 test in
// tests/hub-sync.test.ts). On a plain demo build it is the server's in-memory copy, which does not see sign-ups made
// only in a browser tab.
import {
  buildCalendarFeed,
  calendarFeedStart,
  CALENDAR_FEED_NAME,
  toIsoDate,
  type CalendarFeedMeeting,
} from '@kofc/shared';
import { verifyCalendarToken } from '@/services/server/calendar-token';
import { calendarFeedSecret } from '@/services/server/secrets';
import { memberDirectory } from '@/services/server/session';

export const runtime = 'nodejs';

const plain = (status: number, message: string) =>
  new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function GET(req: Request) {
  const memberId = await verifyCalendarToken(new URL(req.url).searchParams.get('token'), calendarFeedSecret());
  if (memberId === null) return plain(404, 'This calendar link is not valid. Copy a new link from the Calendar page of the portal.');
  try {
    const db = await memberDirectory();
    const [member, statuses] = await Promise.all([db.members.get(memberId), db.lookups.list('MemberStatus')]);
    if (!member) return plain(404, 'This calendar link is not valid. Copy a new link from the Calendar page of the portal.');
    if (member.StatusID !== statuses.find((s) => s.Status === 'Active')?.id) {
      return plain(403, 'This calendar link belongs to a membership that is not active.');
    }
    const now = new Date();
    const fromDate = calendarFeedStart(toIsoDate(now));
    const [shifts, upcoming] = await Promise.all([
      db.events.listMemberShifts(memberId, { fromDate }),
      db.meetings.listUpcoming(member.CouncilID, { memberId, fromDate }),
    ]);
    const meetings: CalendarFeedMeeting[] = await Promise.all(
      upcoming.map(async (meeting) => ({
        meeting,
        response: (await db.meetings.listInvites(meeting.id)).find((i) => i.MemberID === memberId)?.ResponseStatus,
      })),
    );
    const body = buildCalendarFeed({ memberId, shifts, meetings, now, calendarName: CALENDAR_FEED_NAME });
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="kofc-my-schedule.ics"',
        // Calendar apps poll; each fetch must see today's sign-ups, and no shared cache may keep one member's schedule.
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch {
    return plain(500, 'The calendar feed could not be built. Try again later.');
  }
}
