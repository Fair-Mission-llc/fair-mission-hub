// =========================================================================
// THE 6-TIER MERIT LADDER AND CHARTER MEMBER RECOGNITION (Sprint 11 Revision 6.0, schema 105)
// Replaces the Sprint 7A canonization shield. Pure rules; the drivers load rows, call these and only store.
//
// Metrics are counted inside the current fraternal year (July 1 - June 30) and reset every July 1:
//   hours     EventTime (by ShiftDate) + ActivityTime (by ActivityDate)
//   events    distinct events the member logged a shift at
//   meetings  distinct meetings the member checked in to (LiveAttendance, by CheckedInAt)
//   recruits  members whose recruited_by_member_id is this member and whose join date falls in the year
//
// A member holds the HIGHEST tier they qualify for:
//   TIER_6_LEADERSHIP     an executive office (EXECUTIVE_ROLE_NAMES), 25+ years since the join date, or the Admin switch
//                         (Member.flag_honorary_shield)
//   TIER_5_DISTINGUISHED  tier5 meetings + events + recruits met this year
//   TIER_4_CHAMPION / TIER_3_ANCHOR / TIER_2_ACTIVE   hours + events + meetings met this year
//   TIER_1_NEW            180 days or fewer since the join date
// A member who meets none has no tier (tier null) until they log service this year.
// The join date is Member.join_date (First Degree / Initiation Date), or DateJoinedCouncil when it is not recorded.
//
// Charter members: a join date on or before Council.institution_date + 30 days sets Member.flag_charter_member.
// The rule only ever turns the flag on; an Admin can still mark a charter member by hand.
// =========================================================================
import { currentFraternalYear, fraternalYearBounds } from './budget';
import type { ServiceLogRow } from './member-lifecycle';
import { BusinessRuleError, describeActor, EXECUTIVE_ROLE_NAMES, hasAdminRights, hasSuperAdminRights, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import type { Council, Member } from './types';

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

export type MeritTierId = 'TIER_1_NEW' | 'TIER_2_ACTIVE' | 'TIER_3_ANCHOR' | 'TIER_4_CHAMPION' | 'TIER_5_DISTINGUISHED' | 'TIER_6_LEADERSHIP';

export interface MeritTier {
  id: MeritTierId;
  /** 1 (lowest) to 6 (highest). */
  number: number;
  label: string;
  icon: string;
}

/** The six tiers, lowest first. */
export const MERIT_TIERS: readonly MeritTier[] = [
  { id: 'TIER_1_NEW', number: 1, label: 'New Member', icon: '🌱' },
  { id: 'TIER_2_ACTIVE', number: 2, label: 'Active Knight', icon: '⚔️' },
  { id: 'TIER_3_ANCHOR', number: 3, label: 'Anchor Knight', icon: '⚓' },
  { id: 'TIER_4_CHAMPION', number: 4, label: 'Fraternal Champion', icon: '🏆' },
  { id: 'TIER_5_DISTINGUISHED', number: 5, label: 'Shining Armor Companion', icon: '🛡️' },
  { id: 'TIER_6_LEADERSHIP', number: 6, label: 'Shield Circle / Honorary', icon: '👑' },
];

export const meritTier = (number: number): MeritTier => MERIT_TIERS[number - 1] ?? MERIT_TIERS[0]!;

/** The permanent profile badge of a charter member. */
export const CHARTER_MEMBER_BADGE = '📜 Charter Member';
/** Days after the council's institution date that still count as the organizational charter window. */
export const CHARTER_WINDOW_DAYS = 30;
/** Tier 1 lasts this many days from the join date. */
export const NEW_MEMBER_WINDOW_DAYS = 180;
/** Years since the join date that earn Tier 6. */
export const HONORARY_TENURE_YEARS = 25;

// ---- thresholds -------------------------------------------------------------------------------------------------

export interface LadderMilestone {
  hours: number;
  events: number;
  meetings: number;
}
export interface DistinguishedMilestone {
  meetings: number;
  events: number;
  recruits: number;
}
/** The council's milestones (Council.merit_* columns). */
export interface MeritThresholds {
  tier2: LadderMilestone;
  tier3: LadderMilestone;
  tier4: LadderMilestone;
  tier5: DistinguishedMilestone;
}

export const DEFAULT_MERIT_THRESHOLDS: MeritThresholds = {
  tier2: { hours: 1, events: 1, meetings: 1 },
  tier3: { hours: 20, events: 4, meetings: 4 },
  tier4: { hours: 60, events: 8, meetings: 8 },
  tier5: { meetings: 3, events: 3, recruits: 1 },
};

export const MERIT_THRESHOLD_MAX_HOURS = 10_000;
export const MERIT_THRESHOLD_MAX_COUNT = 1_000;

/** Each milestone's Council column, by tier key and metric. */
export const MERIT_THRESHOLD_COLUMNS = {
  tier2: { hours: 'merit_t2_hours', events: 'merit_t2_events', meetings: 'merit_t2_meetings' },
  tier3: { hours: 'merit_t3_hours', events: 'merit_t3_events', meetings: 'merit_t3_meetings' },
  tier4: { hours: 'merit_t4_hours', events: 'merit_t4_events', meetings: 'merit_t4_meetings' },
  tier5: { meetings: 'merit_t5_meetings', events: 'merit_t5_events', recruits: 'merit_t5_recruits' },
} as const;

type ThresholdColumn = (typeof MERIT_THRESHOLD_COLUMNS)[keyof typeof MERIT_THRESHOLD_COLUMNS][keyof (typeof MERIT_THRESHOLD_COLUMNS)[keyof typeof MERIT_THRESHOLD_COLUMNS]];
export type MeritThresholdColumns = Record<ThresholdColumn, number>;

/** The council's stored milestones, with the defaults for missing values. */
export function councilMeritThresholds(council: Partial<Pick<Council, ThresholdColumn>> | null | undefined): MeritThresholds {
  const out = structuredClone(DEFAULT_MERIT_THRESHOLDS) as unknown as Record<string, Record<string, number>>;
  for (const [tier, cols] of Object.entries(MERIT_THRESHOLD_COLUMNS)) {
    for (const [metric, col] of Object.entries(cols)) {
      const v = council?.[col as ThresholdColumn];
      if (typeof v === 'number') out[tier]![metric] = v;
    }
  }
  return out as unknown as MeritThresholds;
}

/** The Council column values of a cleaned set of milestones. */
export function meritThresholdColumns(t: MeritThresholds): MeritThresholdColumns {
  const out: Record<string, number> = {};
  for (const [tier, cols] of Object.entries(MERIT_THRESHOLD_COLUMNS)) {
    for (const [metric, col] of Object.entries(cols)) out[col] = (t as unknown as Record<string, Record<string, number>>)[tier]![metric]!;
  }
  return out as MeritThresholdColumns;
}

/**
 * councils.setMeritThresholds' input: every milestone a whole number from 0 to the maximum, and Tiers 2 to 4 never
 * asking less than the tier below (INVALID_INPUT).
 */
export function cleanMeritThresholds(input: unknown): MeritThresholds {
  if (input === null || typeof input !== 'object') throw invalid('Enter the milestones for Tiers 2 to 5.');
  const raw = input as Record<string, unknown>;
  const whole = (tier: string, metric: string): number => {
    const group = raw[tier];
    const v = group !== null && typeof group === 'object' ? (group as Record<string, unknown>)[metric] : undefined;
    const max = metric === 'hours' ? MERIT_THRESHOLD_MAX_HOURS : MERIT_THRESHOLD_MAX_COUNT;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > max) {
      throw invalid(`The ${tier.replace('tier', 'Tier ')} ${metric} milestone must be a whole number from 0 to ${max.toLocaleString('en-US')}; received ${JSON.stringify(v)}.`, {
        field: `${tier}.${metric}`,
      });
    }
    return v;
  };
  const ladder = (tier: string): LadderMilestone => ({ hours: whole(tier, 'hours'), events: whole(tier, 'events'), meetings: whole(tier, 'meetings') });
  const clean: MeritThresholds = {
    tier2: ladder('tier2'),
    tier3: ladder('tier3'),
    tier4: ladder('tier4'),
    tier5: { meetings: whole('tier5', 'meetings'), events: whole('tier5', 'events'), recruits: whole('tier5', 'recruits') },
  };
  for (const metric of ['hours', 'events', 'meetings'] as const) {
    if (clean.tier3[metric] < clean.tier2[metric] || clean.tier4[metric] < clean.tier3[metric]) {
      throw invalid(`The ${metric} milestones must not go down from Tier 2 to Tier 4; received ${clean.tier2[metric]}, ${clean.tier3[metric]}, ${clean.tier4[metric]}.`, {
        field: metric,
      });
    }
  }
  return clean;
}

/** councils.setMeritThresholds: an Active Admin of the council or an Active Super Admin. */
export function assertMaySetMeritThresholds(actor: MemberWriteActor, councilId: number): void {
  if (hasSuperAdminRights(actor)) return;
  if (!hasAdminRights(actor)) {
    throw new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Only an active Admin of the council or a Super Admin can set the merit tier milestones; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, councilId },
    );
  }
  if (actor.councilId !== councilId) {
    throw new SecurityPrivilegeError(
      'COUNCIL_ACCESS_DENIED',
      `Admin ${actor.memberId} of council ${actor.councilId} cannot set the merit tier milestones of council ${councilId}.`,
      { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
    );
  }
}

// ---- dates ------------------------------------------------------------------------------------------------------

const ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const isoOf = (d: Date | string): string => (typeof d === 'string' ? d.slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
const addDays = (iso: string, days: number): string => {
  const m = ISO.exec(iso)!;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days)).toISOString().slice(0, 10);
};

/**
 * councils.setMeritThresholds' institution date: undefined keeps the stored one, null or '' clears it, otherwise a real
 * YYYY-MM-DD date not in the future (INVALID_INPUT).
 */
export function cleanInstitutionDate(value: unknown, now: Date): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const m = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  const real = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
  if (!m || !real || real.toISOString().slice(0, 10) !== value) throw invalid(`The institution date must be a YYYY-MM-DD date; received ${JSON.stringify(value)}.`, { field: 'institution_date' });
  if ((value as string) > isoOf(now)) throw invalid(`The institution date ${value as string} cannot be in the future.`, { field: 'institution_date' });
  return value as string;
}

/** The date the ladder measures membership from: join_date, else DateJoinedCouncil; null when neither is a date. */
export function meritJoinDate(member: Partial<Pick<Member, 'join_date' | 'DateJoinedCouncil'>>): string | null {
  for (const v of [member.join_date, member.DateJoinedCouncil]) if (typeof v === 'string' && ISO.test(v)) return v.slice(0, 10);
  return null;
}

/** True when a join date is on or before the council's institution date + CHARTER_WINDOW_DAYS. False when either is missing. */
export function isCharterJoinDate(joinDate: string | null | undefined, institutionDate: string | null | undefined): boolean {
  if (typeof joinDate !== 'string' || !ISO.test(joinDate) || typeof institutionDate !== 'string' || !ISO.test(institutionDate)) return false;
  return joinDate.slice(0, 10) <= addDays(institutionDate.slice(0, 10), CHARTER_WINDOW_DAYS);
}

/**
 * The charter flag a member row should carry once saved: 1 when the row already says so or its join date falls in the
 * charter window, else the row's own value. Never turns a flag off.
 */
export function applyCharterRule<T extends { join_date?: string | null; flag_charter_member?: number | null }>(row: T, institutionDate: string | null | undefined): T {
  if (row.flag_charter_member === 1 || !isCharterJoinDate(row.join_date, institutionDate)) return row;
  return { ...row, flag_charter_member: 1 };
}

// ---- metrics and standing ---------------------------------------------------------------------------------------

export interface MeritMetrics {
  hours: number;
  events: number;
  meetings: number;
  recruits: number;
}

/** A LiveAttendance row as the ladder reads it. */
export interface MeritAttendanceRow {
  MemberID: number;
  MeetingID: number;
  CheckedInAt: string;
}

/** A Member row as the recruit count reads it. */
export type MeritRecruitRow = Pick<Member, 'id'> & Partial<Pick<Member, 'recruited_by_member_id' | 'join_date' | 'DateJoinedCouncil'>>;

/** The member's metrics inside one fraternal year (YYYY-YYYY). */
export function meritYearMetrics(input: {
  memberId: number;
  fraternalYear: string;
  logs: readonly ServiceLogRow[];
  attendance: readonly MeritAttendanceRow[];
  members: readonly MeritRecruitRow[];
}): MeritMetrics {
  const { fromDate, toDate } = fraternalYearBounds(input.fraternalYear);
  const inYear = (d: string | null | undefined) => typeof d === 'string' && d.slice(0, 10) >= fromDate && d.slice(0, 10) <= toDate;
  let hours = 0;
  const events = new Set<number>();
  for (const log of input.logs) {
    if (log.MemberID !== input.memberId || !inYear(log.date)) continue;
    hours += log.Hours;
    if (log.eventId !== null) events.add(log.eventId);
  }
  const meetings = new Set(input.attendance.filter((a) => a.MemberID === input.memberId && inYear(a.CheckedInAt)).map((a) => a.MeetingID));
  const recruits = input.members.filter((m) => m.recruited_by_member_id === input.memberId && m.id !== input.memberId && inYear(meritJoinDate(m))).length;
  return { hours: Math.round(hours * 100) / 100, events: events.size, meetings: meetings.size, recruits };
}

export type HonoraryReason = 'office' | 'tenure' | 'override';

/** What the next ladder tier (2 to 4) still needs; hours rounded up to a quarter hour. */
export interface MeritNextStep {
  tier: MeritTier;
  hoursNeeded: number;
  eventsNeeded: number;
  meetingsNeeded: number;
}

/** Where a member stands on the ladder this fraternal year. */
export interface MeritStanding {
  /** The highest tier held; null when the member qualifies for none yet. */
  tier: MeritTier | null;
  /** Every tier number the member qualifies for, lowest first. */
  qualified: number[];
  fraternalYear: string;
  metrics: MeritMetrics;
  thresholds: MeritThresholds;
  joinDate: string | null;
  /** Why the member holds Tier 6, when they do (office first, then tenure, then the Admin switch). */
  honoraryReason: HonoraryReason | null;
  charterMember: boolean;
  /** The lowest of Tiers 2 to 4 not yet met; null once Tier 4 is met. */
  next: MeritNextStep | null;
}

const meetsLadder = (m: MeritMetrics, t: LadderMilestone) => m.hours >= t.hours && m.events >= t.events && m.meetings >= t.meetings;

/** The member's standing. `today` fixes the fraternal year and the Tier 1 / Tier 6 date windows. */
export function meritStanding(input: {
  member: Partial<Pick<Member, 'join_date' | 'DateJoinedCouncil' | 'flag_honorary_shield' | 'flag_charter_member'>>;
  roles: readonly string[];
  metrics: MeritMetrics;
  thresholds: MeritThresholds;
  today: Date | string;
  fraternalYear?: string;
}): MeritStanding {
  const { metrics: m, thresholds: t } = input;
  const today = isoOf(input.today);
  const joinDate = meritJoinDate(input.member);
  const qualified: number[] = [];
  if (joinDate !== null && joinDate <= today && joinDate >= addDays(today, -NEW_MEMBER_WINDOW_DAYS)) qualified.push(1);
  if (meetsLadder(m, t.tier2)) qualified.push(2);
  if (meetsLadder(m, t.tier3)) qualified.push(3);
  if (meetsLadder(m, t.tier4)) qualified.push(4);
  if (m.meetings >= t.tier5.meetings && m.events >= t.tier5.events && m.recruits >= t.tier5.recruits) qualified.push(5);
  const [ty, tmd] = [Number(today.slice(0, 4)), today.slice(4)];
  const honoraryReason: HonoraryReason | null = input.roles.some((r) => (EXECUTIVE_ROLE_NAMES as readonly string[]).includes(r))
    ? 'office'
    : joinDate !== null && joinDate <= `${ty - HONORARY_TENURE_YEARS}${tmd}`
      ? 'tenure'
      : input.member.flag_honorary_shield === 1
        ? 'override'
        : null;
  if (honoraryReason) qualified.push(6);
  const top = qualified.length ? qualified[qualified.length - 1]! : null;
  const ladderGoal = ([2, 3, 4] as const).find((n) => !qualified.includes(n));
  const goal = ladderGoal === undefined ? null : t[`tier${ladderGoal}`];
  return {
    tier: top === null ? null : meritTier(top),
    qualified,
    fraternalYear: input.fraternalYear ?? currentFraternalYear(typeof input.today === 'string' ? new Date(`${today}T12:00:00`) : input.today),
    metrics: m,
    thresholds: t,
    joinDate,
    honoraryReason,
    charterMember: input.member.flag_charter_member === 1,
    next:
      ladderGoal === undefined || goal === null
        ? null
        : {
            tier: meritTier(ladderGoal),
            hoursNeeded: Math.max(0, Math.ceil((goal.hours - m.hours) * 4 - 1e-9) / 4),
            eventsNeeded: Math.max(0, goal.events - m.events),
            meetingsNeeded: Math.max(0, goal.meetings - m.meetings),
          },
  };
}

/** A one-line description of a standing's badge, for screen readers and plain-text views. */
export function meritBadgeText(s: Pick<MeritStanding, 'tier' | 'honoraryReason'>): string {
  if (!s.tier) return 'No merit tier yet this fraternal year';
  const why = s.honoraryReason === 'office' ? ' (executive office)' : s.honoraryReason === 'tenure' ? ` (${HONORARY_TENURE_YEARS}+ years)` : s.honoraryReason === 'override' ? ' (awarded)' : '';
  return `${s.tier.icon} Tier ${s.tier.number}: ${s.tier.label}${s.tier.number === 6 ? why : ''}`;
}
