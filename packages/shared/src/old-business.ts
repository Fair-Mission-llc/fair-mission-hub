// =========================================================================
// SPRINT 8S REVISION 3 - THE AUTOMATED OLD BUSINESS ENGINE (schema version 96)
//
// The council's unfinished projects carry from one month's minutes into the next meeting with no copy-paste.
//
//   Where the items come from   the PUBLISHED minutes (Meeting.minutes_published_at set) of the council's meetings held
//                               in the calendar month before the reference date. An unresolved item is a minutes line
//                               written as an open checkbox, '- [ ] Seal the teak furniture'; a ticked '- [x]' line is
//                               resolved and stays behind. The same text twice (any capitals) counts once.
//   Home                        the '[ 📅 Upcoming Event Agenda ]' card lists them, read only, as council priorities
//                               (meetings.listOldBusiness for today).
//   Start Live Meeting          meetings.launchLiveMeeting reads them for the launched meeting's date and, while that
//                               meeting's minutes are unpublished and hold no Old Business block yet, writes them at the
//                               top of its minutes draft as open checkboxes under OLD_BUSINESS_HEADING. The Recorder ticks
//                               them off in the drawer; whatever stays open carries again next month.
// =========================================================================
import type { Meeting } from './types';

/** The heading the launch writes above the carried items in the minutes draft. */
export const OLD_BUSINESS_HEADING = '# Old Business (carried from last month)';
/** The Home card's title (Sprint 8S Revision 3; "Today's Event Agenda" until then). */
export const UPCOMING_EVENT_AGENDA_TITLE = '[ 📅 Upcoming Event Agenda ]';
/** How many days the Home card's agenda looks ahead, today included. */
export const UPCOMING_AGENDA_DAYS = 7;
/** The longest item text kept, so a runaway line cannot flood the card or the draft. */
export const OLD_BUSINESS_ITEM_MAX_LENGTH = 200;

/** An open checkbox line: '- [ ] text' or '* [ ] text', indented or not. */
const OPEN_ITEM = /^\s*[-*]\s+\[ \]\s+(.+?)\s*$/;
/** Any checkbox line, open or ticked, with its mark. */
const CHECKBOX_LINE = /^(\s*[-*]\s+\[)([ xX])(\]\s+)(.+?)\s*$/;

/** The open checkbox items of one minutes text, in order. */
export function openMinutesItems(minutesText: string | null | undefined): string[] {
  return (minutesText ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => OPEN_ITEM.exec(line)?.[1]?.slice(0, OLD_BUSINESS_ITEM_MAX_LENGTH) ?? null)
    .filter((t): t is string => t !== null && t.trim() !== '');
}

/** The first and last day ('YYYY-MM-DD') of the calendar month before the month of `isoDate`. */
export function previousMonthRange(isoDate: string): { from: string; to: string } {
  const y = Number(isoDate.slice(0, 4));
  const m = Number(isoDate.slice(5, 7)); // 1-12
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const mm = String(pm).padStart(2, '0');
  return { from: `${py}-${mm}-01`, to: `${py}-${mm}-${String(last).padStart(2, '0')}` };
}

/** One unresolved item and the meeting whose minutes carry it. */
export interface OldBusinessItem {
  text: string;
  meetingId: number;
  meetingName: string;
  meetingDate: string;
}

type MinutesMeeting = Pick<Meeting, 'id' | 'CouncilID' | 'Date' | 'minutes_text' | 'minutes_published_at'> & { 'Meeting Name': string };

/**
 * The unresolved items for a reference date: the open checkbox lines of the council's published minutes from the
 * previous calendar month, oldest meeting first, each text once.
 */
export function oldBusinessItems(meetings: readonly MinutesMeeting[], councilId: number, asOfDate: string): OldBusinessItem[] {
  const { from, to } = previousMonthRange(asOfDate);
  const seen = new Set<string>();
  const items: OldBusinessItem[] = [];
  const held = meetings
    .filter((m) => m.CouncilID === councilId && !!m.minutes_published_at)
    .filter((m) => {
      const d = String(m.Date).slice(0, 10);
      return d >= from && d <= to;
    })
    .sort((a, b) => String(a.Date).localeCompare(String(b.Date)) || a.id - b.id);
  for (const m of held) {
    for (const text of openMinutesItems(m.minutes_text)) {
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ text, meetingId: m.id, meetingName: m['Meeting Name'], meetingDate: String(m.Date).slice(0, 10) });
    }
  }
  return items;
}

/** The Old Business block the launch writes: the heading and one open checkbox per item. */
export const oldBusinessBlock = (items: readonly Pick<OldBusinessItem, 'text'>[]): string => [OLD_BUSINESS_HEADING, ...items.map((i) => `- [ ] ${i.text}`)].join('\n');

/**
 * The minutes draft with the carried items at the top, or null when nothing changes: no items, the draft already holds
 * the Old Business block, or the result would pass `maxLength`.
 */
export function withOldBusiness(draft: string | null | undefined, items: readonly Pick<OldBusinessItem, 'text'>[], maxLength: number): string | null {
  const text = draft ?? '';
  if (items.length === 0 || text.includes(OLD_BUSINESS_HEADING)) return null;
  const next = text.trim() ? `${oldBusinessBlock(items)}\n\n${text}` : oldBusinessBlock(items);
  return next.length <= maxLength ? next : null;
}

/** One checkbox line of a minutes text, for the drawer's tick boxes. */
export interface MinutesCheckbox {
  /** The line's index in the text split on '\n'. */
  line: number;
  text: string;
  done: boolean;
}

/** Every checkbox line of a minutes text, open or ticked. */
export function minutesCheckboxes(text: string): MinutesCheckbox[] {
  return text.split('\n').flatMap((raw, line) => {
    const m = CHECKBOX_LINE.exec(raw);
    return m ? [{ line, text: m[4], done: m[2] !== ' ' }] : [];
  });
}

/** The minutes text with the checkbox on `line` ticked (done) or opened again. Other lines are untouched. */
export function setMinutesCheckbox(text: string, line: number, done: boolean): string {
  const lines = text.split('\n');
  const m = CHECKBOX_LINE.exec(lines[line] ?? '');
  if (!m) return text;
  lines[line] = `${m[1]}${done ? 'x' : ' '}${m[3]}${m[4]}`;
  return lines.join('\n');
}
