// =========================================================================
// COUNCIL WIDE SETTINGS AND PLATFORM SETTINGS (Sprint 7C, schema 62)
//
// Council Wide Settings are four Council columns that used to be hardcoded numbers:
//   - quarantine_max_daily_activities (DEFAULT 5): more distinct activities than this in one day sends the entry to
//     leadership review (volunteer-quarantine.ts quarantineReasons);
//   - quarantine_max_single_hours (DEFAULT 5.0): more hours than this against one activity in one day sends it to review;
//   - max_shift_padding_hours (DEFAULT 1.0): a shift report may run this many hours over the shift's scheduled length;
//   - inactivity_threshold_days (DEFAULT 365): the inactivity check marks Inactive a member with no logged service in
//     more than this many days (member-lifecycle.ts planInactivitySweep).
// The council's Active Admins and officers (a Role with Officer = 1) edit them on /system-settings/council-settings, and any
// Super Admin for any council (councils.setCouncilWideSettings).
//
// Platform Settings are the universal limits every council shares, kept in the one-row PlatformSettings table and
// edited by Super Admins on /system-settings/global-settings (councils.setPlatformSettings; /lookups before Sprint 7C Ext): the oral history recorder's time cap and the
// character limits of a diary entry and a prayer intention. A limit may not exceed its column's size.
//
// Sprint 7E (schema 64) adds the timing settings. Ten more Council columns:
//   - in use: er_submission_window_days (the expense filing window, expenses.ts), volunteer_logging_window_days (how far
//     back shift and activity time may be logged, rules.ts; it replaces the 3-month and 6-month walls), reminder_delay_days
//     and reminder_cadence_days (the unlogged-hours text reminders, notifications.ts);
//   and shift_signup_lock_hours (since Sprint 7H, how long before an event the phone opens it for gate donations,
//     calendar.ts isEventAtGate);
//   - saved for features that do not exist yet: expense_draft_expiry_days, charity_proposal_voting_days,
//     officer_signature_reminder_days, meeting_minutes_due_days, special_election_notice_days.
// And three more PlatformSettings columns: cadence_invitation_horizon_days (the drip release, meetings.ts) and
// user_session_expiry_hours (the portal's server session, apps/web/services/server) in use; audit_log_retention_days is
// saved for a future purge job. A setting that nothing reads yet is marked `inUse: false`, and the pages say so.
//
// Every setting carries a group (the card it sits in) and a plain-English `help` text, which the pages show in a popup
// behind the (i) button beside the field.
// =========================================================================
import { EXPENSE_SUBMISSION_GRACE_DAYS } from './expenses';
import { DIARY_TEXT_MAX_LENGTH, ORAL_HISTORY_MAX_SECONDS } from './history';
import { CADENCE_INVITE_LEAD_DAYS } from './meetings';
import { HOURS_REMINDER_FIRST_DAY, HOURS_REMINDER_REPEAT_DAYS } from './notifications';
import { PRAYER_INTENTION_MAX_LENGTH } from './prayers';
import {
  BusinessRuleError,
  DEFAULT_VOLUNTEER_LOGGING_WINDOW_DAYS,
  describeActor,
  hasAdminRights,
  hasSuperAdminRights,
  HOURS_STEP,
  SecurityPrivilegeError,
  type MemberWriteActor,
} from './rules';
import type { Council, PlatformSettings } from './types';

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

// ---- council wide settings ------------------------------------------------------------------------------------

export const DEFAULT_QUARANTINE_MAX_DAILY_ACTIVITIES = 5;
export const DEFAULT_QUARANTINE_MAX_SINGLE_HOURS = 5.0;
export const DEFAULT_MAX_SHIFT_PADDING_HOURS = 1.0;
export const DEFAULT_INACTIVITY_THRESHOLD_DAYS = 365;
// Sprint 7E timing defaults for the settings no feature reads yet (the Council column defaults in Schema.sql).
export const DEFAULT_EXPENSE_DRAFT_EXPIRY_DAYS = 90;
export const DEFAULT_CHARITY_PROPOSAL_VOTING_DAYS = 14;
export const DEFAULT_SHIFT_SIGNUP_LOCK_HOURS = 2.0;
export const DEFAULT_OFFICER_SIGNATURE_REMINDER_DAYS = 3;
export const DEFAULT_MEETING_MINUTES_DUE_DAYS = 7;
export const DEFAULT_SPECIAL_ELECTION_NOTICE_DAYS = 60;

/** The Council Wide Settings columns: the four from Sprint 7C, then the ten timing settings from Sprint 7E. */
export const COUNCIL_WIDE_SETTING_NAMES = [
  'quarantine_max_daily_activities',
  'quarantine_max_single_hours',
  'max_shift_padding_hours',
  'inactivity_threshold_days',
  'er_submission_window_days',
  'volunteer_logging_window_days',
  'reminder_delay_days',
  'reminder_cadence_days',
  'expense_draft_expiry_days',
  'charity_proposal_voting_days',
  'shift_signup_lock_hours',
  'officer_signature_reminder_days',
  'meeting_minutes_due_days',
  'special_election_notice_days',
] as const;
export type CouncilWideSettingName = (typeof COUNCIL_WIDE_SETTING_NAMES)[number];
export type CouncilWideSettings = Record<CouncilWideSettingName, number>;

export const COUNCIL_WIDE_SETTING_DEFAULTS: CouncilWideSettings = {
  quarantine_max_daily_activities: DEFAULT_QUARANTINE_MAX_DAILY_ACTIVITIES,
  quarantine_max_single_hours: DEFAULT_QUARANTINE_MAX_SINGLE_HOURS,
  max_shift_padding_hours: DEFAULT_MAX_SHIFT_PADDING_HOURS,
  inactivity_threshold_days: DEFAULT_INACTIVITY_THRESHOLD_DAYS,
  er_submission_window_days: EXPENSE_SUBMISSION_GRACE_DAYS,
  volunteer_logging_window_days: DEFAULT_VOLUNTEER_LOGGING_WINDOW_DAYS,
  reminder_delay_days: HOURS_REMINDER_FIRST_DAY,
  reminder_cadence_days: HOURS_REMINDER_REPEAT_DAYS,
  expense_draft_expiry_days: DEFAULT_EXPENSE_DRAFT_EXPIRY_DAYS,
  charity_proposal_voting_days: DEFAULT_CHARITY_PROPOSAL_VOTING_DAYS,
  shift_signup_lock_hours: DEFAULT_SHIFT_SIGNUP_LOCK_HOURS,
  officer_signature_reminder_days: DEFAULT_OFFICER_SIGNATURE_REMINDER_DAYS,
  meeting_minutes_due_days: DEFAULT_MEETING_MINUTES_DUE_DAYS,
  special_election_notice_days: DEFAULT_SPECIAL_ELECTION_NOTICE_DAYS,
};

export type SettingGroupId = 'financial' | 'operations' | 'reminders' | 'security' | 'limits';

export interface SettingGroup {
  id: SettingGroupId;
  title: string;
  description: string;
}

export const SETTING_GROUPS: Record<SettingGroupId, SettingGroup> = {
  financial: { id: 'financial', title: 'Financial Submissions', description: 'When members may file expense reports and how long money decisions stay open.' },
  operations: {
    id: 'operations',
    title: 'Volunteer & Meeting Operations',
    description: 'The limits on volunteer time, the window for logging it, and the deadlines around shifts, meetings and elections.',
  },
  reminders: { id: 'reminders', title: 'Reminder Cadences', description: 'When the portal sends reminders and releases invitations.' },
  security: { id: 'security', title: 'Sign-in & Records', description: 'How long a portal sign-in lasts and how long records are kept.' },
  limits: { id: 'limits', title: 'Recording & Text Limits', description: 'The longest recording and the longest texts a member may save.' },
};

/** The groups each page shows, in order. */
export const COUNCIL_SETTING_GROUP_ORDER: readonly SettingGroupId[] = ['financial', 'operations', 'reminders'];
export const PLATFORM_SETTING_GROUP_ORDER: readonly SettingGroupId[] = ['reminders', 'security', 'limits'];

/** Shown for a setting that no feature reads yet (`inUse: false`). */
export const SETTING_NOT_IN_USE_TEXT = 'Saved for a future feature. Nothing in the portal uses this number yet.';

/** How each setting is entered: whole numbers or quarter hours, and its range. */
export interface SettingRule {
  label: string;
  hint: string;
  min: number;
  max: number;
  /** Quarter hours (HOURS_STEP), like every hours value; otherwise a whole number. */
  quarterHours?: boolean;
  unit: string;
  /** The card the field sits in (Sprint 7E). */
  group: SettingGroupId;
  /** Where and how the setting changes the portal, in plain English: the (i) popup (Sprint 7E). */
  help: string;
  /** False while no feature reads the setting yet; the pages and the guide then say so. */
  inUse: boolean;
}

export const COUNCIL_WIDE_SETTING_RULES: Record<CouncilWideSettingName, SettingRule> = {
  quarantine_max_daily_activities: {
    label: 'Most activities a member may report in one day',
    hint: 'A report past this number goes to leadership review before it counts.',
    min: 1,
    max: 24,
    unit: 'activities',
    group: 'operations',
    inUse: true,
    help:
      'Used when a member logs time on the phone or on My Service. If one member reports more different activities than this on one day, ' +
      'the new report waits on the Executive Dashboard. The Grand Knight, Deputy Grand Knight or an Admin then approves or rejects it. ' +
      'Admins, elected officers, Trustees and the owner of the event are never held.',
  },
  quarantine_max_single_hours: {
    label: 'Most hours a member may report on one activity in one day',
    hint: 'A report past this number of hours goes to leadership review before it counts.',
    min: 0.25,
    max: 24,
    quarterHours: true,
    unit: 'hours',
    group: 'operations',
    inUse: true,
    help:
      'Used when a member logs time against a council activity. If the hours for one activity on one day go past this number, the report ' +
      'waits on the Executive Dashboard for leadership review. The hours do not count until a leader approves them.',
  },
  max_shift_padding_hours: {
    label: 'Extra hours allowed past a scheduled shift',
    hint: 'A shift report longer than the scheduled shift plus this time goes to leadership review.',
    min: 0,
    max: 8,
    quarterHours: true,
    unit: 'hours',
    group: 'operations',
    inUse: true,
    help:
      'Used when a member reports time for a shift. A member may report the scheduled shift length plus this many hours, for set-up and ' +
      'clean-up. A longer report waits on the Executive Dashboard for leadership review.',
  },
  inactivity_threshold_days: {
    label: 'Days without service before a member counts as inactive',
    hint: 'Check for Inactive Members marks a member Inactive after this many days with no logged service.',
    min: 30,
    max: 3650,
    unit: 'days',
    group: 'operations',
    inUse: true,
    help:
      'Used by the 🔍 Check for Inactive Members button on the member roster. The check marks a plain member Inactive when the member has ' +
      'logged no service for more than this many days. Admins and Super Admins are never marked. Nothing changes until a leader clicks the button.',
  },
  er_submission_window_days: {
    label: 'Days after an event or meeting to submit expenses',
    hint: 'An expense report linked to an event or meeting can be submitted from its first day through this many days after it ends.',
    min: 1,
    max: 365,
    unit: 'days',
    group: 'financial',
    inUse: true,
    help:
      'Used by My Expenses on the web and the Expenses screen on the phone. A report that names an event or a meeting can be submitted from ' +
      'the day the event or meeting starts until this many days after it ends. After that, the event or meeting shows a padlock and drops ' +
      'out of the picker, and the portal refuses the submission. A draft can still be saved at any time. A report that names no event or ' +
      'meeting has no window.',
  },
  volunteer_logging_window_days: {
    label: 'Days back a member may log volunteer time',
    hint: 'Members may log or change shift time and activity time for dates up to this many days ago.',
    min: 7,
    max: 730,
    unit: 'days',
    group: 'operations',
    inUse: true,
    help:
      'Used whenever a member logs or changes hours on the phone or on My Service. Shift time can be reported for shifts up to this many ' +
      'days ago, and activity time for dates up to this many days ago. Older dates are refused. The Shifts Awaiting Hours panel on the ' +
      'Executive Dashboard marks a shift Closed once it is older than this, and the text reminders for it stop.',
  },
  reminder_delay_days: {
    label: 'Days after a shift before the first hours reminder',
    hint: 'A member who worked a shift but logged no hours gets the first text reminder this many days after the shift.',
    min: 1,
    max: 60,
    unit: 'days',
    group: 'reminders',
    inUse: true,
    help:
      'Used by the daily hours reminder. When a member signed up for a shift but has not logged hours, the first text reminder goes out ' +
      'this many days after the shift date. The Shifts Awaiting Hours panel on the Executive Dashboard turns the row red from the same day.',
  },
  reminder_cadence_days: {
    label: 'Days between follow-up hours reminders',
    hint: 'After the first reminder, another goes out every this many days until the hours are logged.',
    min: 1,
    max: 60,
    unit: 'days',
    group: 'reminders',
    inUse: true,
    help:
      'Used by the daily hours reminder. After the first reminder, the member gets one more every this many days while the hours stay ' +
      'unlogged. The reminders stop when the hours are logged or when the shift is older than the volunteer time window.',
  },
  expense_draft_expiry_days: {
    label: 'Days before an unsubmitted expense draft expires',
    hint: 'Meant to clear expense drafts that were never submitted.',
    min: 7,
    max: 730,
    unit: 'days',
    group: 'financial',
    inUse: false,
    help:
      'Meant for a future clean-up of expense drafts that were never submitted. Expense reports have no draft-expiry step today, so this ' +
      'number changes nothing yet. Saved drafts stay until their owner submits or deletes them.',
  },
  charity_proposal_voting_days: {
    label: 'Days a charity proposal stays open for a vote',
    hint: 'Meant to set how long the council has to vote on a charity proposal.',
    min: 1,
    max: 90,
    unit: 'days',
    group: 'financial',
    inUse: false,
    help:
      'Meant for a future voting deadline on charity proposals. Today a vetted proposal goes to the next Monthly meeting at least 10 days ' +
      'away, and the council votes on it there. This number changes nothing yet.',
  },
  shift_signup_lock_hours: {
    label: 'Hours before an event that gate donations open',
    hint: 'How long before an event begins the phone offers it for gate donations.',
    min: 0,
    max: 72,
    quarterHours: true,
    unit: 'hours',
    group: 'operations',
    inUse: true,
    help:
      "The phone's Donate screen offers an event from this many hours before it begins (its first shift, or midnight on its " +
      'start day) until it ends. With 0, an event is offered only once it is under way. Members may still sign up for a shift ' +
      'until it ends.',
  },
  officer_signature_reminder_days: {
    label: 'Days before an officer is reminded to sign an expense report',
    hint: 'Meant to remind the Financial Secretary, Treasurer or Grand Knight about an expense report that waits for them.',
    min: 1,
    max: 60,
    unit: 'days',
    group: 'reminders',
    inUse: false,
    help:
      'Meant for a future reminder to an officer whose signature an expense report waits for. No such reminder is sent today, so this ' +
      'number changes nothing yet. The approval desks still show every waiting report.',
  },
  meeting_minutes_due_days: {
    label: 'Days after a meeting that the minutes are due',
    hint: 'Meant to set when the Recorder must file the minutes.',
    min: 1,
    max: 60,
    unit: 'days',
    group: 'operations',
    inUse: false,
    help: 'Meant for a future due date on meeting minutes. The portal does not track a due date for minutes today, so this number changes nothing yet.',
  },
  special_election_notice_days: {
    label: 'Days of notice before a special election',
    hint: 'Meant to set how much notice members get before a special election.',
    min: 1,
    max: 365,
    unit: 'days',
    group: 'operations',
    inUse: false,
    help:
      'Meant for a future notice period on special elections. Today a mid-year nomination stays open for 14 days, and this number does not ' +
      'change that. This number changes nothing yet.',
  },
};

/** The council's stored settings, with the column defaults for missing values. */
export function councilWideSettings(council: Partial<Pick<Council, CouncilWideSettingName>> | null | undefined): CouncilWideSettings {
  const out = { ...COUNCIL_WIDE_SETTING_DEFAULTS };
  for (const name of COUNCIL_WIDE_SETTING_NAMES) {
    const v = council?.[name];
    if (typeof v === 'number' && Number.isFinite(v)) out[name] = v;
  }
  return out;
}

function cleanSetting(rule: SettingRule, name: string, v: unknown): number {
  const ok =
    typeof v === 'number' &&
    Number.isFinite(v) &&
    v >= rule.min &&
    v <= rule.max &&
    (rule.quarterHours ? Number.isInteger(v / HOURS_STEP) : Number.isInteger(v));
  if (!ok) {
    const kind = rule.quarterHours ? `a multiple of ${HOURS_STEP} hours` : 'a whole number';
    throw invalid(`${rule.label} must be ${kind} from ${rule.min} to ${rule.max.toLocaleString('en-US')}; received ${JSON.stringify(v)}.`, { field: name });
  }
  return v as number;
}

/**
 * councils.setCouncilWideSettings' input: one or more of the settings, each in its range (INVALID_INPUT for a bad
 * value, an unknown field or no field). A field left out keeps its stored value.
 */
export function cleanCouncilWideSettings(input: unknown): Partial<CouncilWideSettings> {
  if (input === null || typeof input !== 'object') throw invalid('Enter at least one council setting.');
  const raw = input as Record<string, unknown>;
  const unknown = Object.keys(raw).filter((k) => !(COUNCIL_WIDE_SETTING_NAMES as readonly string[]).includes(k));
  if (unknown.length > 0) throw invalid(`Unknown council setting: ${unknown.join(', ')}.`, { fields: unknown });
  const out: Partial<CouncilWideSettings> = {};
  for (const name of COUNCIL_WIDE_SETTING_NAMES) {
    if (raw[name] !== undefined) out[name] = cleanSetting(COUNCIL_WIDE_SETTING_RULES[name], name, raw[name]);
  }
  if (Object.keys(out).length === 0) throw invalid('Enter at least one council setting.');
  return out;
}

/** May change the council's Council Wide Settings: its Active Admins and officers, or any Active Super Admin. */
export function mayEditCouncilWideSettings(actor: MemberWriteActor, councilId: number): boolean {
  if (hasSuperAdminRights(actor)) return true;
  if (actor.councilId !== councilId) return false;
  return hasAdminRights(actor) || (actor.active && actor.officer === true);
}

/** Rejects ADMIN_REQUIRED for anyone else, COUNCIL_ACCESS_DENIED for Admins and officers of another council. */
export function assertMayEditCouncilWideSettings(actor: MemberWriteActor, councilId: number): void {
  if (mayEditCouncilWideSettings(actor, councilId)) return;
  if (hasAdminRights(actor) || (actor.active && actor.officer)) {
    throw new SecurityPrivilegeError(
      'COUNCIL_ACCESS_DENIED',
      `Member ${actor.memberId} changes the settings of their own council (${actor.councilId}) only, not council ${councilId}.`,
      { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
    );
  }
  throw new SecurityPrivilegeError(
    'ADMIN_REQUIRED',
    `Only an active Admin or officer of the council, or a Super Admin, can change the Council Wide Settings; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, actorType: actor.memberType ?? null, councilId },
  );
}

// ---- platform settings ----------------------------------------------------------------------------------------

/** The one PlatformSettings row's id. */
export const PLATFORM_SETTINGS_ID = 1;

/** How long a portal sign-in lasts, by default (Sprint 7E: PlatformSettings.user_session_expiry_hours). */
export const DEFAULT_USER_SESSION_EXPIRY_HOURS = 8;
/** Days to keep audit records, by default (Sprint 7E: saved for a future purge job). */
export const DEFAULT_AUDIT_LOG_RETENTION_DAYS = 180;

export const PLATFORM_SETTING_NAMES = [
  'oral_history_max_seconds',
  'diary_text_max_length',
  'prayer_intention_max_length',
  'cadence_invitation_horizon_days',
  'user_session_expiry_hours',
  'audit_log_retention_days',
] as const;
export type PlatformSettingName = (typeof PLATFORM_SETTING_NAMES)[number];

export const PLATFORM_SETTING_DEFAULTS: Omit<PlatformSettings, 'id'> = {
  oral_history_max_seconds: ORAL_HISTORY_MAX_SECONDS,
  diary_text_max_length: DIARY_TEXT_MAX_LENGTH,
  prayer_intention_max_length: PRAYER_INTENTION_MAX_LENGTH,
  cadence_invitation_horizon_days: CADENCE_INVITE_LEAD_DAYS,
  user_session_expiry_hours: DEFAULT_USER_SESSION_EXPIRY_HOURS,
  audit_log_retention_days: DEFAULT_AUDIT_LOG_RETENTION_DAYS,
};

/** Ranges; the character limits stop at their columns' sizes, so a saved value always fits. */
export const PLATFORM_SETTING_RULES: Record<PlatformSettingName, SettingRule> = {
  oral_history_max_seconds: {
    label: 'Oral history recording time limit',
    hint: 'The recorder stops and saves on its own when this time runs out.',
    min: 60,
    max: 3600,
    unit: 'seconds',
    group: 'limits',
    inUse: true,
    help:
      'Used by the oral history recorder on Council History. A recording stops and saves on its own when this many seconds have passed, ' +
      'with a warning in the last minute. Applies to every council.',
  },
  diary_text_max_length: {
    label: 'Diary entry character limit',
    hint: 'The longest spiritual diary entry or testimonial note a member may save.',
    min: 100,
    max: DIARY_TEXT_MAX_LENGTH,
    unit: 'characters',
    group: 'limits',
    inUse: true,
    help:
      'Used by the spiritual diary and the testimonial note on Council History. A longer text is refused. The limit cannot go past 4,000, ' +
      'the size of the database column. Applies to every council.',
  },
  prayer_intention_max_length: {
    label: 'Prayer intention character limit',
    hint: 'The longest prayer intention a member may post.',
    min: 50,
    max: PRAYER_INTENTION_MAX_LENGTH,
    unit: 'characters',
    group: 'limits',
    inUse: true,
    help:
      'Used by the Council Prayer Intentions List in the Faith Center, on the web and the phone. A longer intention is refused. The limit ' +
      'cannot go past 500, the size of the database column. Applies to every council.',
  },
  cadence_invitation_horizon_days: {
    label: 'Days before a scheduled meeting that invitations appear',
    hint: "Invitations to the meetings that Meeting Cadence builds reach members' meeting lists this many days before each meeting.",
    min: 1,
    max: 60,
    unit: 'days',
    group: 'reminders',
    inUse: true,
    help:
      "Used when a council builds its year of meetings on Meeting Cadence. Each meeting's invitations stay hidden from members until this " +
      'many days before the meeting, so a year of invitations does not crowd the phone. The new number applies to meetings built after you ' +
      'save it. Meetings already built keep their release dates. Applies to every council.',
  },
  user_session_expiry_hours: {
    label: 'Hours a portal sign-in lasts',
    hint: 'The portal server ends a sign-in this many hours after it starts.',
    min: 1,
    max: 168,
    unit: 'hours',
    group: 'security',
    inUse: true,
    help:
      'Used by the portal server when a member signs in on the web. The server sign-in that guards Google Drive, email, the Supreme reports ' +
      'and the roster import ends this many hours later, and the member then signs in again. A sign-in that already started keeps its old ' +
      'end time. Applies to every council.',
  },
  audit_log_retention_days: {
    label: 'Days to keep audit records',
    hint: 'Meant to set how long the portal keeps audit records before it clears them.',
    min: 30,
    max: 3650,
    unit: 'days',
    group: 'security',
    inUse: false,
    help:
      'Meant for a future clean-up job that clears old audit records. No such job runs today, so this number changes nothing yet and every ' +
      'record is kept. Applies to every council.',
  },
};

/** The settings of `group` among `names`, in their listed order. */
export const settingsInGroup = <K extends string>(names: readonly K[], rules: Record<K, Pick<SettingRule, 'group'>>, group: SettingGroupId): K[] =>
  names.filter((n) => rules[n].group === group);

/** A setting's value with its unit, e.g. '30 days' or '2 hours'; 1 reads as '1 day'. */
export function formatSettingValue(rule: Pick<SettingRule, 'unit'>, value: number): string {
  const unit = value === 1 ? rule.unit.replace(/ies$/, 'y').replace(/s$/, '') : rule.unit;
  return `${value.toLocaleString('en-US')} ${unit}`;
}

/** The stored row, with the defaults for a missing row or value. */
export function platformSettings(row: Partial<PlatformSettings> | null | undefined): PlatformSettings {
  const out: PlatformSettings = { id: PLATFORM_SETTINGS_ID, ...PLATFORM_SETTING_DEFAULTS };
  for (const name of PLATFORM_SETTING_NAMES) {
    const v = row?.[name];
    if (typeof v === 'number' && Number.isFinite(v)) out[name] = v;
  }
  return out;
}

/** councils.setPlatformSettings' input: one or more whole numbers in range (INVALID_INPUT otherwise). */
export function cleanPlatformSettings(input: unknown): Partial<Omit<PlatformSettings, 'id'>> {
  if (input === null || typeof input !== 'object') throw invalid('Enter at least one platform setting.');
  const raw = input as Record<string, unknown>;
  const unknown = Object.keys(raw).filter((k) => !(PLATFORM_SETTING_NAMES as readonly string[]).includes(k));
  if (unknown.length > 0) throw invalid(`Unknown platform setting: ${unknown.join(', ')}.`, { fields: unknown });
  const out: Partial<Omit<PlatformSettings, 'id'>> = {};
  for (const name of PLATFORM_SETTING_NAMES) {
    if (raw[name] !== undefined) out[name] = cleanSetting(PLATFORM_SETTING_RULES[name], name, raw[name]);
  }
  if (Object.keys(out).length === 0) throw invalid('Enter at least one platform setting.');
  return out;
}

/** Only an Active Super Admin changes the platform settings (SUPER_ADMIN_REQUIRED). */
export function assertMaySetPlatformSettings(actor: MemberWriteActor): void {
  if (hasSuperAdminRights(actor)) return;
  throw new SecurityPrivilegeError(
    'SUPER_ADMIN_REQUIRED',
    `Only an active Super Admin can change the platform settings; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, actorType: actor.memberType ?? null },
  );
}
