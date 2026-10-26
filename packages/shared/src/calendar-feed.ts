// =========================================================================
// PERSONAL CALENDAR FEED (Sprint 9 Revision 2.0)
// Pure rules behind GET /api/calendar/sync: one member's own schedule as a read-only iCalendar (RFC 5545) document that
// Google Calendar, Apple Calendar and Outlook subscribe to and refresh by themselves.
//
// What goes in, and nothing else:
//   - every shift the member signed up for (EventSignup), named "<event> - <shift>" at the event's location; a shift
//     marked as a no-show is left out;
//   - every meeting the member is invited to whose invitation is released (meetings.listUpcoming with memberId), unless
//     they answered Declined.
// Times are floating local times (no time zone, no 'Z'), so each calendar shows them at the same clock time the council
// set. A multi-day meeting, or a meeting with no start time, is an all-day entry. A shift that ends at or before its
// start time ends the next day. Escaping and line folding are notifications.ts escapeIcsText / foldIcsLine. UIDs
// are stable per sign-up and per invitation, so a refresh updates entries in place.
// =========================================================================
import type { MemberShift } from './contract';
import { escapeIcsText, foldIcsLine } from './notifications';
import type { Meeting, MeetingResponseStatus } from './types';

/** The feed's product id (PRODID) and the UID domain. */
export const CALENDAR_FEED_PRODUCT_ID = '-//Fraternal Council Archives™//Personal Schedule 1.0//EN';
export const CALENDAR_FEED_UID_DOMAIN = 'kofc-tracking-platform';
/** The calendar name members see in their calendar app. */
export const CALENDAR_FEED_NAME = 'Knights of Columbus - My Schedule';
/** How often a calendar app should fetch the feed again (REFRESH-INTERVAL and X-PUBLISHED-TTL). */
export const CALENDAR_FEED_REFRESH = 'PT1H';
/** How far back the feed reaches, so last month's shifts stay on the calendar. */
export const CALENDAR_FEED_LOOKBACK_DAYS = 30;
/** The card title on the web calendar page. */
export const CALENDAR_SYNC_CARD_TITLE = '🗓️ Sync with Your Phone Calendar';

/** One invited meeting and the member's answer to the invitation, if known. */
export interface CalendarFeedMeeting {
  meeting: Meeting;
  response?: MeetingResponseStatus;
}

export interface CalendarFeedInput {
  memberId: number;
  shifts: readonly MemberShift[];
  meetings: readonly CalendarFeedMeeting[];
  /** The time of the request, for DTSTAMP. */
  now: Date;
  /** Calendar name; CALENDAR_FEED_NAME by default. */
  calendarName?: string;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** 'YYYY-MM-DD' plus `days`, as 'YYYY-MM-DD'. */
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 'YYYY-MM-DD' -> 'YYYYMMDD'. */
const icsDate = (date: string): string => date.replace(/-/g, '');

/** 'HH:MM[:SS]' -> 'HHMMSS', or null when it is not a clock time. */
function icsClock(time: string | null | undefined): string | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec((time ?? '').trim());
  if (!m) return null;
  return `${pad(Number(m[1]))}${m[2]}${m[3] ?? '00'}`;
}

/** A floating local date-time: 'YYYYMMDDTHHMMSS'. */
const icsLocal = (date: string, clock: string): string => `${icsDate(date)}T${clock}`;

/** A UTC timestamp: 'YYYYMMDDTHHMMSSZ'. */
export function icsUtcStamp(now: Date): string {
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

interface FeedEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  /** Sort key and DTSTART/DTEND lines. */
  sortKey: string;
  timing: string[];
}

/** DTSTART/DTEND for a timed entry on `date`; an end at or before the start rolls to the next day. */
function timedSpan(date: string, start: string, end: string | null): string[] {
  const endClock = end ?? start;
  const endDate = end !== null && end <= start ? addDays(date, 1) : date;
  return [`DTSTART:${icsLocal(date, start)}`, `DTEND:${icsLocal(endDate, endClock)}`];
}

/** DTSTART/DTEND for an all-day entry from `first` through `last` inclusive (DTEND is the day after). */
const allDaySpan = (first: string, last: string): string[] => [
  `DTSTART;VALUE=DATE:${icsDate(first)}`,
  `DTEND;VALUE=DATE:${icsDate(addDays(last < first ? first : last, 1))}`,
];

const joinText = (...parts: (string | null | undefined)[]): string =>
  parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join('\n\n');

function shiftEvent(memberId: number, item: MemberShift): FeedEvent {
  const { shift, event, signup } = item;
  const start = icsClock(shift.StartTime);
  const end = icsClock(shift.EndTime);
  return {
    uid: `shift-signup-${signup.id}-member-${memberId}@${CALENDAR_FEED_UID_DOMAIN}`,
    summary: `${event.EventName} - ${shift.ShiftName}`,
    description: joinText('Volunteer shift you signed up for.', shift.ShiftDescription, event.EventDescription),
    location: event.Location ?? '',
    sortKey: `${shift.ShiftDate}T${start ?? '000000'}`,
    timing: start ? timedSpan(shift.ShiftDate, start, end) : allDaySpan(shift.ShiftDate, shift.ShiftDate),
  };
}

function meetingEvent(memberId: number, meeting: Meeting): FeedEvent {
  const start = icsClock(meeting['Time Start']);
  const end = icsClock(meeting['Time End']);
  const multiDay = meeting.IsMultiDay === 1 && !!meeting.EndDate;
  return {
    uid: `meeting-${meeting.id}-member-${memberId}@${CALENDAR_FEED_UID_DOMAIN}`,
    summary: meeting['Meeting Name'],
    description: joinText('Council meeting you are invited to.', meeting['Meeting Description']),
    location: meeting.Location ?? '',
    sortKey: `${meeting.Date}T${multiDay ? '000000' : (start ?? '000000')}`,
    timing: multiDay || !start ? allDaySpan(meeting.Date, multiDay ? meeting.EndDate! : meeting.Date) : timedSpan(meeting.Date, start, end),
  };
}

/** The entries the feed carries, soonest first: shifts not marked no-show, meetings not declined. */
function feedEvents(input: CalendarFeedInput): FeedEvent[] {
  const shifts = input.shifts.filter((s) => s.signup.NoShow !== 1).map((s) => shiftEvent(input.memberId, s));
  const meetings = input.meetings.filter((m) => m.response !== 'Declined').map((m) => meetingEvent(input.memberId, m.meeting));
  return [...shifts, ...meetings].sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.uid.localeCompare(b.uid));
}

/** The whole VCALENDAR document, CRLF line ends, folded lines. */
export function buildCalendarFeed(input: CalendarFeedInput): string {
  const stamp = icsUtcStamp(input.now);
  const name = input.calendarName ?? CALENDAR_FEED_NAME;
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${CALENDAR_FEED_PRODUCT_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(name)}`,
    `X-WR-CALDESC:${escapeIcsText('Your volunteer shifts and council meetings. Read-only: change them in the KofC portal or phone app.')}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${CALENDAR_FEED_REFRESH}`,
    `X-PUBLISHED-TTL:${CALENDAR_FEED_REFRESH}`,
  ];
  for (const e of feedEvents(input)) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      ...e.timing,
      `SUMMARY:${escapeIcsText(e.summary)}`,
      ...(e.description ? [`DESCRIPTION:${escapeIcsText(e.description)}`] : []),
      ...(e.location.trim() ? [`LOCATION:${escapeIcsText(e.location.trim())}`] : []),
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/** The first day the feed covers: CALENDAR_FEED_LOOKBACK_DAYS before `today` ('YYYY-MM-DD'). */
export const calendarFeedStart = (today: string): string => addDays(today, -CALENDAR_FEED_LOOKBACK_DAYS);

/** The webcal:// form of a feed URL, which Apple Calendar and Outlook open as a subscription in one tap. */
export const webcalUrl = (feedUrl: string): string => feedUrl.replace(/^https?:\/\//i, 'webcal://');
