// Sprint 8S Revision 10.6: the pilot's Parish Parking Event follows the calendar.
//
// Seed.sql dates the event 2026-10-10 to 2026-10-31 with six weekend shifts. On any other pilot day the phone's
// Collect tab would find no event at the gate, so Member Alpha could not open the on-device configuration drawer.
// When the presentation data loads, both drivers move the event, its shifts, its donations and the time entries held
// against its shifts by the same whole number of weeks, so today always falls in the week after the event's first
// weekend - the day the pilot scripts are written for: the first weekend's collections are behind, two more weekends
// are ahead, and a Saturday shift is still on a Saturday.

import { addDays, daysBetween } from './planning';
import { toIsoDate } from './rules';

/** The seeded pilot fundraiser that follows the calendar. */
export const PILOT_PARKING_EVENT_NAME = 'Parish Parking Event';

/**
 * The days (a multiple of 7, 0 when no move is needed) to add to every date of the pilot parking event so that
 * `today` is 2-8 days after its first day (its first Saturday): from the Monday after the first weekend through the
 * second weekend. The seeded window runs three weeks, so today is always inside it.
 */
export function pilotTimelineOffsetDays(eventStartDate: string, today: Date): number {
  const sinceStart = daysBetween(eventStartDate, toIsoDate(today));
  const weeks = Math.floor((sinceStart - 2) / 7);
  return weeks === 0 ? 0 : weeks * 7;
}

/** `date` (YYYY-MM-DD, or YYYY-MM-DD HH:MM:SS) moved by `days`, keeping any time part. */
export function shiftSeedDate(date: string, days: number): string {
  if (days === 0) return date;
  return addDays(date.slice(0, 10), days) + date.slice(10);
}
