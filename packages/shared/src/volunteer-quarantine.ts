// =========================================================================
// VOLUNTEER TIME QUARANTINE (Sprint 7B, schema 61)
// Pure rules behind the over-reporting guards on eventTime.logHours, activityTime.logHours and
// activityTime.addQuarterHour, and behind the leadership clearance desk (volunteerQuarantine.*). Drivers load rows, call
// these, then only store.
//
// A regular member's time entry is held in VolunteerQuarantine (clearance_status PENDING) instead of EventTime or
// ActivityTime when any of these hold (the numbers are the defaults; since Sprint 7C each council sets its own on
// Council Wide Settings - Council.quarantine_max_daily_activities, quarantine_max_single_hours, max_shift_padding_hours):
//   - 5/5 activity rule: the entry would be the member's sixth (or later) distinct activity that day - shifts by
//     ShiftDate, council activities by ActivityDate, and their own entries already held for review that day;
//   - 5/5 hours rule: it would put more than 5.0 hours against one activity that day (a shift, or the sum of the day's
//     entries against one council activity);
//   - +1 hour shift padding gate: it reports more than 1.0 hour over the shift's scheduled StartTime-EndTime length.
// Held hours are never in EventTime or ActivityTime, so every hours total - council summaries, the canonization shield,
// the leaderboards - leaves them out without a filter. Clearing an entry (APPROVED) writes it to EventTime or
// ActivityTime; deleting it (REJECTED) keeps the row as the audit trail and its hours never count. Since Sprint 9
// Revision 1.1 a reviewer's reject returns the entry to the member as DRAFT with a required reason instead of deleting
// it; the member corrects the hours and resubmits it to PENDING (see "returned for correction" below).
//
// Exempt, so their entries always log directly: Admins and Super Admins (member type), holders of an elected office or
// a Trustee seat, and, for a shift, the owner of the shift's event. Reviewers: the council's Grand Knight and Deputy
// Grand Knight, its Admins and any Super Admin, all Active.
// The Council flag feature_volunteer_quarantine switches the guards and the desk off together.
// =========================================================================
import { ELECTED_ROLE_NAMES, TRUSTEE_ROLE_NAMES } from './elections';
import {
  BusinessRuleError,
  describeActor,
  hasAdminRights,
  hasSuperAdminRights,
  holdsExecutiveRole,
  SecurityPrivilegeError,
  type MemberWriteActor,
} from './rules';
import {
  DEFAULT_MAX_SHIFT_PADDING_HOURS,
  DEFAULT_QUARANTINE_MAX_DAILY_ACTIVITIES,
  DEFAULT_QUARANTINE_MAX_SINGLE_HOURS,
  type CouncilWideSettings,
} from './council-settings';
import type { VolunteerQuarantine, VolunteerQuarantineActivityType, VolunteerQuarantineStatus } from './types';

export const QUARANTINE_ACTIVITY_TYPES = ['SHIFT', 'MANUAL'] as const satisfies readonly VolunteerQuarantineActivityType[];
export const QUARANTINE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'DRAFT'] as const satisfies readonly VolunteerQuarantineStatus[];
/** Default: more distinct activities than this in one day sends the entry to review (quarantine_max_daily_activities). */
export const QUARANTINE_DAILY_ACTIVITY_LIMIT = DEFAULT_QUARANTINE_MAX_DAILY_ACTIVITIES;
/** Default: more hours than this against one activity in one day sends the entry to review (quarantine_max_single_hours). */
export const QUARANTINE_SINGLE_ACTIVITY_HOURS_LIMIT = DEFAULT_QUARANTINE_MAX_SINGLE_HOURS;
/** Default: a shift report may run this many hours over the scheduled length before review (max_shift_padding_hours). */
export const SHIFT_PADDING_ALLOWANCE_HOURS = DEFAULT_MAX_SHIFT_PADDING_HOURS;

/** The three guard limits of one council (council-settings.ts councilWideSettings). */
export type QuarantineLimits = Pick<CouncilWideSettings, 'quarantine_max_daily_activities' | 'quarantine_max_single_hours' | 'max_shift_padding_hours'>;

export const DEFAULT_QUARANTINE_LIMITS: QuarantineLimits = {
  quarantine_max_daily_activities: QUARANTINE_DAILY_ACTIVITY_LIMIT,
  quarantine_max_single_hours: QUARANTINE_SINGLE_ACTIVITY_HOURS_LIMIT,
  max_shift_padding_hours: SHIFT_PADDING_ALLOWANCE_HOURS,
};
/** VolunteerQuarantine.quarantine_reason is VARCHAR(500). */
export const QUARANTINE_REASON_MAX_LENGTH = 500;

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---- exemption ------------------------------------------------------------------------------------------------

/** Who is logging: their member type, the Role names they hold and, for a shift, whether they own its event. */
export interface QuarantineLogger {
  memberType: string | undefined;
  roles: readonly string[];
  ownsEvent?: boolean;
}

/** Offices whose holders are exempt: every elected office and the three Trustee seats (elected by the council too). */
export const QUARANTINE_EXEMPT_ROLE_NAMES: readonly string[] = [...ELECTED_ROLE_NAMES, ...TRUSTEE_ROLE_NAMES];

/** An Admin, Super Admin, elected officer or Trustee - or the owner of the shift's event - logs without the guards. */
export function isQuarantineExempt(logger: QuarantineLogger): boolean {
  if (logger.memberType === 'Admin' || logger.memberType === 'Super Admin') return true;
  if (logger.ownsEvent) return true;
  return logger.roles.some((r) => QUARANTINE_EXEMPT_ROLE_NAMES.includes(r));
}

// ---- the guards -----------------------------------------------------------------------------------------------

/** A day's activity, keyed by kind and id, so a shift and a council activity with the same id stay apart. */
export const quarantineActivityKey = (type: VolunteerQuarantineActivityType, activityId: number): string => `${type}:${activityId}`;

export interface QuarantineCheck {
  activityType: VolunteerQuarantineActivityType;
  activityId: number;
  /** The hours this entry reports (for the rapid-tap tracker, the one 15-minute tap). */
  hours: number;
  /** SHIFT only: the shift's scheduled length (shiftDefaultLengthHours). */
  scheduledHours?: number | null;
  /**
   * MANUAL only: hours the member already has against this activity that day, logged or held for review, outside this
   * entry. A shift has one entry per member, so its count is the entry alone.
   */
  otherHoursSameActivity?: number;
  /**
   * quarantineActivityKey of every activity the member already has that day - logged or held for review - not counting
   * an entry this one replaces.
   */
  dayActivityKeys: ReadonlySet<string>;
}

/** "5.0 hours", "1.0 hour", "0.25 hours". */
const hoursText = (h: number): string => `${h.toFixed(Number.isInteger(h * 10) ? 1 : 2)} hour${h === 1 ? '' : 's'}`;

/**
 * Why the entry must be held for review; an empty list means it logs directly. The caller has already decided the
 * logger is not exempt and the council's flag is on. `limits` are the council's own (Sprint 7C, Council Wide Settings);
 * left out, the defaults.
 */
export function quarantineReasons(check: QuarantineCheck, limits: QuarantineLimits = DEFAULT_QUARANTINE_LIMITS): string[] {
  const reasons: string[] = [];
  const key = quarantineActivityKey(check.activityType, check.activityId);
  const maxActivities = limits.quarantine_max_daily_activities;
  if (!check.dayActivityKeys.has(key) && check.dayActivityKeys.size >= maxActivities) {
    reasons.push(
      `More than ${maxActivities} ${maxActivities === 1 ? 'activity' : 'activities'} in one day: this is activity ${check.dayActivityKeys.size + 1} reported for the day.`,
    );
  }
  const dayHours = round2(check.hours + (check.activityType === 'MANUAL' ? (check.otherHoursSameActivity ?? 0) : 0));
  if (dayHours > limits.quarantine_max_single_hours) {
    reasons.push(`More than ${hoursText(limits.quarantine_max_single_hours)} against one activity: ${dayHours} hours reported for the day.`);
  }
  if (check.activityType === 'SHIFT' && check.scheduledHours != null) {
    const ceiling = round2(check.scheduledHours + limits.max_shift_padding_hours);
    if (check.hours > ceiling) {
      reasons.push(
        `More than ${hoursText(limits.max_shift_padding_hours)} over the scheduled shift: ${check.hours} hours reported against a ` +
          `${check.scheduledHours}-hour shift (limit ${ceiling}).`,
      );
    }
  }
  return reasons;
}

/** The reasons as one VARCHAR(500) value. */
export const quarantineReasonText = (reasons: readonly string[]): string => reasons.join(' ').slice(0, QUARANTINE_REASON_MAX_LENGTH);

// ---- the clearance desk ---------------------------------------------------------------------------------------

/** May review the council's held entries: its Active Grand Knight, Deputy Grand Knight or Admins, or an Active Super Admin. */
export function mayReviewQuarantine(actor: MemberWriteActor, councilId: number): boolean {
  if (hasSuperAdminRights(actor)) return true;
  if (actor.councilId !== councilId) return false;
  return hasAdminRights(actor) || (actor.active && holdsExecutiveRole(actor.roles));
}

/** Rejects ADMIN_REQUIRED for anyone else, COUNCIL_ACCESS_DENIED for leaders of another council. */
export function assertMayReviewQuarantine(actor: MemberWriteActor, councilId: number): void {
  if (mayReviewQuarantine(actor, councilId)) return;
  const leader = hasAdminRights(actor) || (actor.active && holdsExecutiveRole(actor.roles));
  if (leader) {
    throw new SecurityPrivilegeError(
      'COUNCIL_ACCESS_DENIED',
      `Member ${actor.memberId} reviews volunteer time only for their own council (${actor.councilId}), not council ${councilId}.`,
      { actorId: actor.memberId, councilId },
    );
  }
  throw new SecurityPrivilegeError(
    'ADMIN_REQUIRED',
    `Only the Grand Knight, Deputy Grand Knight or an Admin reviews held volunteer time; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, actorType: actor.memberType ?? null, councilId },
  );
}

/** A decision is made once: only a PENDING row may be cleared or deleted (QUARANTINE_STATUS_CONFLICT). */
export function assertQuarantinePending(row: Pick<VolunteerQuarantine, 'id' | 'clearance_status'>): void {
  if (row.clearance_status === 'PENDING') return;
  throw new BusinessRuleError(
    'QUARANTINE_STATUS_CONFLICT',
    `Held time entry ${row.id} was already decided (${row.clearance_status}).`,
    { quarantineId: row.id, status: row.clearance_status },
  );
}

/** One held entry on the desk, with what a reviewer needs to judge it. */
export interface QuarantineDeskEntry {
  row: VolunteerQuarantine;
  memberName: string;
  /** "Event - Shift" for a shift, the activity name for a council activity. */
  activityLabel: string;
  /** The member's own notes on the entry, if any. */
  description: string | null;
}

/** The names the desk shows, looked up by the driver. */
export interface QuarantineDeskLookups {
  members: ReadonlyMap<number, { MemberFirstName: string; MemberLastName: string }>;
  shifts: ReadonlyMap<number, { ShiftName: string; EventName: string }>;
  activities: ReadonlyMap<number, { ActivityName: string }>;
}

/** The desk's rows: oldest first, so the longest wait is on top. */
export function buildQuarantineDesk(rows: readonly VolunteerQuarantine[], lookups: QuarantineDeskLookups): QuarantineDeskEntry[] {
  return [...rows]
    .sort((a, b) => a.date_logged.localeCompare(b.date_logged) || a.id - b.id)
    .map((row) => {
      const m = lookups.members.get(row.user_id);
      let activityLabel: string;
      if (row.activity_type === 'SHIFT') {
        const shift = lookups.shifts.get(row.activity_id);
        activityLabel = shift ? `${shift.EventName} - ${shift.ShiftName}` : `Shift ${row.activity_id}`;
      } else {
        activityLabel = lookups.activities.get(row.activity_id)?.ActivityName ?? `Activity ${row.activity_id}`;
      }
      return {
        row,
        memberName: m ? `${m.MemberFirstName} ${m.MemberLastName}` : `Member ${row.user_id}`,
        activityLabel,
        description: row.notes?.trim() ? row.notes : null,
      };
    });
}

// ---- returned for correction (Sprint 9 Revision 1.1) ---------------------------------------------------------
// A reviewer's reject no longer deletes the entry: it goes back to the member as DRAFT with a required reason. Schema
// 97 has no column for the reason, so it is stored in quarantine_reason behind QUARANTINE_RETURN_PREFIX (the guard
// text it replaces is computed again when the member resubmits). cleared_time_id is cleared; reviewed_by_member_id
// and reviewed_at record who returned it and when. The member corrects the hours on the phone and resubmits, which
// sends the entry back to PENDING for review.

/** Marks quarantine_reason as a reviewer's return reason. */
export const QUARANTINE_RETURN_PREFIX = 'Returned for correction: ';
/** The longest return reason that still fits VARCHAR(500) behind the prefix. */
export const QUARANTINE_RETURN_REASON_MAX_LENGTH = QUARANTINE_REASON_MAX_LENGTH - QUARANTINE_RETURN_PREFIX.length;
/** The label of the reviewer's required text field. */
export const QUARANTINE_RETURN_REASON_LABEL = 'Reason for returning time report (required)';

/** The trimmed reason; RETURN_REASON_REQUIRED when blank, INVALID_INPUT when longer than the column allows. */
export function cleanReturnReason(reason: string | null | undefined): string {
  const text = (reason ?? '').trim();
  if (!text) {
    throw new BusinessRuleError('RETURN_REASON_REQUIRED', 'Give the member a reason for returning the time report.', {});
  }
  if (text.length > QUARANTINE_RETURN_REASON_MAX_LENGTH) {
    throw new BusinessRuleError(
      'INVALID_INPUT',
      `The reason for returning the time report is ${text.length} characters; the limit is ${QUARANTINE_RETURN_REASON_MAX_LENGTH}.`,
      { length: text.length, max: QUARANTINE_RETURN_REASON_MAX_LENGTH },
    );
  }
  return text;
}

/** The quarantine_reason value a return stores. */
export const quarantineReturnText = (reason: string): string => `${QUARANTINE_RETURN_PREFIX}${cleanReturnReason(reason)}`;

/** The reviewer's reason on a DRAFT entry, or null for any other entry. */
export function quarantineReturnReason(row: Pick<VolunteerQuarantine, 'clearance_status' | 'quarantine_reason'>): string | null {
  if (row.clearance_status !== 'DRAFT' || !row.quarantine_reason.startsWith(QUARANTINE_RETURN_PREFIX)) return null;
  return row.quarantine_reason.slice(QUARANTINE_RETURN_PREFIX.length);
}

/** quarantine_reason for a resubmitted entry: the guards it still breaks, if any. */
export const quarantineResubmitText = (reasons: readonly string[]): string =>
  quarantineReasonText(['Resubmitted after correction.', ...(reasons.length ? reasons : ['No limit is broken now.'])]);

/** Only the member who logged it may resubmit; anyone else gets RECORD_NOT_FOUND, so another member's entry stays hidden. */
export function assertOwnsQuarantine(actorId: number, row: Pick<VolunteerQuarantine, 'id' | 'user_id'>): void {
  if (row.user_id === actorId) return;
  throw new BusinessRuleError('RECORD_NOT_FOUND', `No returned time entry with id ${row.id}.`, { quarantineId: row.id });
}

/** Only a DRAFT entry may be resubmitted (QUARANTINE_STATUS_CONFLICT). */
export function assertQuarantineDraft(row: Pick<VolunteerQuarantine, 'id' | 'clearance_status'>): void {
  if (row.clearance_status === 'DRAFT') return;
  throw new BusinessRuleError(
    'QUARANTINE_STATUS_CONFLICT',
    `Time entry ${row.id} is ${row.clearance_status}, not returned for correction, so it cannot be resubmitted.`,
    { quarantineId: row.id, status: row.clearance_status },
  );
}

/** One of the member's own entries returned for correction, as the phone's Report Hours screen shows it. */
export interface ReturnedTimeEntry extends QuarantineDeskEntry {
  /** The reviewer's explanation. */
  returnReason: string;
  /** Who returned it, or null when unknown. */
  returnedByName: string | null;
}

/** The member's DRAFT rows with labels and reasons, oldest first. Rows without a return reason are left out. */
export function buildReturnedEntries(rows: readonly VolunteerQuarantine[], lookups: QuarantineDeskLookups): ReturnedTimeEntry[] {
  return buildQuarantineDesk(
    rows.filter((r) => quarantineReturnReason(r) !== null),
    lookups,
  ).map((entry) => {
    const reviewer = entry.row.reviewed_by_member_id != null ? lookups.members.get(entry.row.reviewed_by_member_id) : undefined;
    return {
      ...entry,
      returnReason: quarantineReturnReason(entry.row)!,
      returnedByName: reviewer ? `${reviewer.MemberFirstName} ${reviewer.MemberLastName}` : null,
    };
  });
}

// ---- results --------------------------------------------------------------------------------------------------

/** What a time log returns when the entry was held for review instead of logged. */
export interface QuarantinedHours {
  quarantined: VolunteerQuarantine;
}

/** Whether a logHours / addQuarterHour result was held for review. */
export const isQuarantinedHours = (result: object): result is QuarantinedHours => 'quarantined' in result;

/** What the logging screens tell a member whose entry was held. */
export const quarantinedHoursMessage = (held: Pick<VolunteerQuarantine, 'hours_reported' | 'quarantine_reason'>): string =>
  `${held.hours_reported} hours sent to leadership review before they count toward your totals. ${held.quarantine_reason}`;
