// Sprint 9 Revision 2.0: personal calendar feeds - the iCalendar builder (calendar-feed.ts), the signed feed token
// (services/server/calendar-token.ts) and the two routes, /api/calendar/link and /api/calendar/sync.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCalendarFeed,
  CALENDAR_SYNC_CARD_TITLE,
  calendarFeedStart,
  toIsoDate,
  webcalUrl,
  type Event,
  type EventSignup,
  type Meeting,
  type MemberShift,
  type Shift,
} from '@kofc/shared';
import { GET as linkGet } from '../apps/web/app/api/calendar/link/route';
import { GET as syncGet } from '../apps/web/app/api/calendar/sync/route';
import { signCalendarToken, verifyCalendarToken } from '../apps/web/services/server/calendar-token';
import { calendarFeedSecret } from '../apps/web/services/server/secrets';
import { memberDirectory, signInOnServer } from '../apps/web/services/server/session';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const NOW = new Date(Date.UTC(2026, 9, 24, 15, 30, 0));

const event = (over: Partial<Event> = {}): Event =>
  ({ id: 7, EventName: 'Fish Fry', EventDescription: 'Lenten dinner', OwnerID: 1, StartDate: '2026-11-06', EndDate: '2026-11-06', Location: 'Parish Hall, Room 2', CategoryID: 1, ...over }) as Event;
const shift = (over: Partial<Shift> = {}): Shift =>
  ({ id: 40, ShiftName: 'Fryer', ShiftDescription: 'Bring an apron', ShiftDate: '2026-11-06', StartTime: '17:00:00', EndTime: '20:30:00', EventID: 7, MinNumberVolunteers: 2, NumberVolunteersSignedUp: 1, ...over }) as Shift;
const signup = (over: Partial<EventSignup> = {}): EventSignup => ({ id: 900, ShiftID: 40, MemberID: 3, NoShow: 0, ...over }) as EventSignup;
const item = (s: Partial<Shift> = {}, su: Partial<EventSignup> = {}, e: Partial<Event> = {}): MemberShift => ({
  shift: shift(s),
  signup: signup(su),
  event: event(e),
  hoursLogged: null,
});
const meeting = (over: Partial<Meeting> = {}): Meeting =>
  ({ id: 12, CouncilID: 1, 'Meeting Name': 'Business Meeting', 'Meeting Description': 'Monthly session', Date: '2026-11-10', 'Time Start': '19:00:00', 'Time End': '21:00:00', Location: 'K of C Hall', MeetingType: 1, ...over }) as Meeting;

/** The VEVENT blocks of a feed, unfolded, as lists of lines. */
function vevents(ics: string): string[][] {
  const lines = ics.replace(/\r\n /g, '').split('\r\n');
  const out: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') current = [];
    else if (line === 'END:VEVENT') {
      out.push(current!);
      current = null;
    } else if (current) current.push(line);
  }
  return out;
}
const field = (ev: string[], name: string) => ev.find((l) => l.startsWith(`${name}:`) || l.startsWith(`${name};`));

describe('calendar feed builder', () => {
  it('writes a read-only VCALENDAR with CRLF lines no longer than 75 octets', () => {
    const ics = buildCalendarFeed({ memberId: 3, shifts: [item({ ShiftDescription: 'x'.repeat(200) })], meetings: [], now: NOW });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('METHOD:PUBLISH');
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT1H');
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it('writes a shift with its event name, floating local times, description and escaped location', () => {
    const [ev] = vevents(buildCalendarFeed({ memberId: 3, shifts: [item()], meetings: [], now: NOW }));
    expect(field(ev, 'UID')).toBe('UID:shift-signup-900-member-3@kofc-tracking-platform');
    expect(field(ev, 'DTSTAMP')).toBe('DTSTAMP:20261024T153000Z');
    expect(field(ev, 'DTSTART')).toBe('DTSTART:20261106T170000');
    expect(field(ev, 'DTEND')).toBe('DTEND:20261106T203000');
    expect(field(ev, 'SUMMARY')).toBe('SUMMARY:Fish Fry - Fryer');
    expect(field(ev, 'DESCRIPTION')).toContain('Bring an apron\\n\\nLenten dinner');
    expect(field(ev, 'LOCATION')).toBe('LOCATION:Parish Hall\\, Room 2');
  });

  it('rolls an overnight shift to the next day and leaves out no-shows and declined meetings', () => {
    const ics = buildCalendarFeed({
      memberId: 3,
      shifts: [item({ StartTime: '22:00:00', EndTime: '02:00:00' }), item({ id: 41 }, { id: 901, NoShow: 1 })],
      meetings: [{ meeting: meeting(), response: 'Declined' }, { meeting: meeting({ id: 13 }), response: 'Accepted' }, { meeting: meeting({ id: 14 }) }],
      now: NOW,
    });
    const events = vevents(ics);
    expect(events.map((e) => field(e, 'UID'))).toEqual([
      'UID:shift-signup-900-member-3@kofc-tracking-platform',
      'UID:meeting-13-member-3@kofc-tracking-platform',
      'UID:meeting-14-member-3@kofc-tracking-platform',
    ]);
    expect(field(events[0], 'DTEND')).toBe('DTEND:20261107T020000');
  });

  it('writes a multi-day meeting as an all-day span through its last day', () => {
    const [ev] = vevents(
      buildCalendarFeed({ memberId: 3, shifts: [], meetings: [{ meeting: meeting({ IsMultiDay: 1, Date: '2026-11-30', EndDate: '2026-12-02', 'Time Start': '', 'Time End': '' }) }], now: NOW }),
    );
    expect(field(ev, 'DTSTART')).toBe('DTSTART;VALUE=DATE:20261130');
    expect(field(ev, 'DTEND')).toBe('DTEND;VALUE=DATE:20261203');
  });

  it('starts 30 days back and offers the webcal form', () => {
    expect(calendarFeedStart('2026-10-24')).toBe('2026-09-24');
    expect(webcalUrl('https://portal.example.org/api/calendar/sync?token=a')).toBe('webcal://portal.example.org/api/calendar/sync?token=a');
    expect(webcalUrl('http://10.0.0.5:3000/x')).toBe('webcal://10.0.0.5:3000/x');
  });
});

describe('calendar feed token', () => {
  const SECRET = 'calendar-test-secret-0123456789abcdef';

  it('round-trips a member id and refuses forged, altered or malformed tokens', async () => {
    const token = await signCalendarToken(3, SECRET);
    expect(token).toMatch(/^3\.[A-Za-z0-9_-]{43}$/);
    expect(await verifyCalendarToken(token, SECRET)).toBe(3);
    expect(await verifyCalendarToken(token, `${SECRET}x`)).toBeNull();
    expect(await verifyCalendarToken(token.replace(/^3\./, '4.'), SECRET)).toBeNull();
    for (const bad of [null, '', '3', '3.', '0.abc', 'abc.def', `${token}x`]) expect(await verifyCalendarToken(bad, SECRET)).toBeNull();
  });

  it('uses CALENDAR_FEED_SECRET when set, else the session secret', () => {
    const own = 'c'.repeat(40);
    const session = 's'.repeat(40);
    expect(calendarFeedSecret({ CALENDAR_FEED_SECRET: own, PORTAL_SESSION_SECRET: session })).toBe(own);
    expect(calendarFeedSecret({ CALENDAR_FEED_SECRET: 'short', PORTAL_SESSION_SECRET: session })).toBe(session);
  });
});

async function cookieFor(username: string): Promise<string> {
  const outcome = await signInOnServer(username, 'dev-pass-secure-9912');
  if (!outcome.ok) throw new Error(`${username} could not sign in: ${outcome.message}`);
  return outcome.cookie.split(';')[0];
}

describe('/api/calendar/link and /api/calendar/sync', () => {
  it('gives a signed-in member their own link, and nobody else one', async () => {
    expect((await linkGet(new Request('http://localhost/api/calendar/link'))).status).toBe(401);
    const res = await linkGet(new Request('http://localhost/api/calendar/link', { headers: { cookie: await cookieFor('testmember@kofc.org') } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; webcalUrl: string };
    expect(body.url).toMatch(/^http:\/\/localhost\/api\/calendar\/sync\?token=3\./);
    expect(body.webcalUrl).toBe(body.url.replace('http://', 'webcal://'));
    // Behind a proxy, the link names the public host.
    const proxied = await linkGet(
      new Request('http://localhost/api/calendar/link', {
        headers: { cookie: await cookieFor('testmember@kofc.org'), 'x-forwarded-host': 'portal.example.org', 'x-forwarded-proto': 'https' },
      }),
    );
    expect(((await proxied.json()) as { url: string }).url).toMatch(/^https:\/\/portal\.example\.org\/api\/calendar\/sync\?token=3\./);
  });

  it("serves text/calendar holding exactly the member's own shifts and invited meetings", async () => {
    const db = await memberDirectory();
    const fromDate = calendarFeedStart(toIsoDate(new Date()));
    // A future shift the member signs up for on the server copy, so the feed has at least one shift to show.
    const shifts = await db.events.listShiftFeed({ memberId: 3, councilIds: [1], fromDate, toDate: '2099-12-31' });
    for (const s of shifts.filter((f) => !f.isSignedUp && f.shift.ShiftDate >= toIsoDate(new Date()))) {
      const added = await db.events.signupForShift(3, s.shift.id).then(
        () => true,
        () => false, // closed or full: try the next one
      );
      if (added) break;
    }

    const { url } = (await (await linkGet(new Request('http://localhost/api/calendar/link', { headers: { cookie: await cookieFor('testmember@kofc.org') } }))).json()) as {
      url: string;
    };
    const res = await syncGet(new Request(url));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
    const ics = await res.text();
    expect(ics).toContain('BEGIN:VCALENDAR');

    const mine = await db.events.listMemberShifts(3, { fromDate });
    const meetings = await db.meetings.listUpcoming(1, { memberId: 3, fromDate });
    const expectedShiftUids = mine.filter((s) => s.signup.NoShow !== 1).map((s) => `UID:shift-signup-${s.signup.id}-member-3@kofc-tracking-platform`);
    const uids = vevents(ics).map((e) => field(e, 'UID')!);
    expect(expectedShiftUids.length).toBeGreaterThan(0);
    for (const uid of expectedShiftUids) expect(uids).toContain(uid);
    expect(uids.filter((u) => u.startsWith('UID:shift-')).sort()).toEqual([...expectedShiftUids].sort());
    // Every meeting in the feed is one the member is invited to.
    const invited = new Set(meetings.map((m) => m.id));
    for (const uid of uids.filter((u) => u.startsWith('UID:meeting-'))) expect(invited.has(Number(/meeting-(\d+)-/.exec(uid)![1]))).toBe(true);
    expect(uids.every((u) => u.includes('-member-3@'))).toBe(true);
  });

  it('answers 404 for a missing or forged token', async () => {
    expect((await syncGet(new Request('http://localhost/api/calendar/sync'))).status).toBe(404);
    const forged = await signCalendarToken(3, 'not-the-server-secret-0123456789abcdef');
    const res = await syncGet(new Request(`http://localhost/api/calendar/sync?token=${forged}`));
    expect(res.status).toBe(404);
    expect(await res.text()).toMatch(/not valid/);
  });

  it('puts the sync card on the Calendar page', () => {
    expect(CALENDAR_SYNC_CARD_TITLE).toBe('🗓️ Sync with Your Phone Calendar');
    expect(read('apps/web/app/calendar/page.tsx')).toContain('<CalendarSyncCard />');
    const card = read('apps/web/components/CalendarSyncCard.tsx');
    expect(card).toContain('CALENDAR_SYNC_CARD_TITLE');
    expect(card).toContain('readOnly');
    expect(card).not.toMatch(/services\/server/);
  });
});
