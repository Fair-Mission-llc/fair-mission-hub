// =========================================================================
// ANNUAL COUNCIL GOALS AND YEAR-OVER-YEAR TRENDS (Sprint 8F, schema version 77)
//
// CouncilGoals holds one council's targets for one fraternal year (July 1 - June 30): funds raised, new members, service
// hours, and the three devotional aggregates of the Faith Center tally (rosaries, hours of adoration, confessions). The
// Executive Dashboard's Annual Council Goals Progress Center draws one progress wheel per target, measured from the
// records the portal already keeps:
//   - fundraising  the events' FundsRaised-Cash + FundsRaised-Electronic over the year's twelve months, counted exactly
//                  as reports.monthlySummary counts "raised" (the synced donation rollups);
//   - new members  the council's members whose DateJoinedCouncil falls inside the year;
//   - hours        EventTime + ActivityTime logged on the council's events and activities in the year (laborHours);
//   - devotions    the council members' MemberDevotionals sums. The tally is a running count with no dates, so the
//                  wheels read the council's whole tally, not the year's share. Null for a white-label council.
//
// The comparative trends (reports.yearOverYearTrends, also served by GET /api/analytics/trends) lay the same monthly
// summaries side by side, fraternal year against fraternal year, month by month from July: the revenue split (cash and
// electronic) and the volunteer hours (events and activities).
//
// Access: the goals and trends carry money, so they have the general ledger's readers (assertMayReadGeneralLedger: the
// council's officers, Admins and finance officers, and any Super Admin). The targets are set by the council's Grand Knight
// or Deputy Grand Knight, its Admins, or any Super Admin (assertMaySetCouncilGoals).
//
// Sprints 8G/8H: the goals are drafted in May, reviewed in June and lock for good on July 1 of their year
// (planning-workflow.ts assertCouncilGoalsWritable, COUNCIL_GOALS_LOCKED, no override); the Progress Center then shows
// them as read-only information blocks. CouncilGoals.budget_status carries DRAFT, REVIEWED or LOCKED.
// =========================================================================
import { assertFraternalYear, currentFraternalYear, fraternalYearBounds, previousFraternalYear } from './budget';
import type { MonthlySummary, SessionUser } from './contract';
import type { CouncilDevotionTotals } from './member-lifecycle';
import { councilGoalsLocked, goalsPlanningStatusOf } from './planning-workflow';
import { holdsGrandKnightSeat, isAdmin, isSuperAdmin, canReadGeneralLedger } from './permissions';
import {
  assertInteger,
  assertMayReadGeneralLedger,
  assertMoney,
  BusinessRuleError,
  describeActor,
  hasAdminRights,
  hasSuperAdminRights,
  holdsGrandKnightAuthority,
  HOURS_STEP,
  mayReadGeneralLedger,
  SecurityPrivilegeError,
  type MemberWriteActor,
} from './rules';
import type { CouncilGoals, Member, PlanningStatus } from './types';

type Actor = Pick<SessionUser, 'memberId' | 'councilId' | 'memberType' | 'isOfficer'> & { roles?: readonly string[] };

// ---- targets -----------------------------------------------------------------------------------------------------

/** The six target columns, in the order the Progress Center draws them. */
export const COUNCIL_GOAL_KEYS = [
  'fundraising_target',
  'new_members_target',
  'hours_target',
  'rosaries_target',
  'adorations_target',
  'confessions_target',
] as const;
export type CouncilGoalKey = (typeof COUNCIL_GOAL_KEYS)[number];
export type CouncilGoalTargets = Record<CouncilGoalKey, number>;

/** The devotional targets, drawn only for a Knights of Columbus council. */
export const SPIRITUAL_GOAL_KEYS: readonly CouncilGoalKey[] = ['rosaries_target', 'adorations_target', 'confessions_target'];

export const COUNCIL_GOAL_LABELS: Record<CouncilGoalKey, string> = {
  fundraising_target: 'Funds raised',
  new_members_target: 'New members',
  hours_target: 'Service hours',
  rosaries_target: 'Rosaries',
  adorations_target: 'Hours of adoration',
  confessions_target: 'Confessions',
};

/** The largest target the form accepts, a guard against a typo with extra zeros. */
export const COUNCIL_GOAL_MAX = 10_000_000;

/** No goals saved: every target 0 (a wheel with a 0 target shows "No target set"). */
export const emptyCouncilGoalTargets = (): CouncilGoalTargets => ({
  fundraising_target: 0,
  new_members_target: 0,
  hours_target: 0,
  rosaries_target: 0,
  adorations_target: 0,
  confessions_target: 0,
});

/**
 * Validates a goals form: every one of the six targets, nothing else. Money has at most two decimals, hours are whole
 * multiples of 0.25 (the 15-minute rule), the counts are whole numbers; all are 0 to COUNCIL_GOAL_MAX. INVALID_INPUT otherwise.
 */
export function cleanCouncilGoalTargets(input: unknown): CouncilGoalTargets {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new BusinessRuleError('INVALID_INPUT', 'Council goals must be an object of targets.', {});
  }
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(COUNCIL_GOAL_KEYS as readonly string[]).includes(key)) {
      throw new BusinessRuleError('INVALID_INPUT', `Council goals have no target "${key}".`, { field: key });
    }
  }
  const out = emptyCouncilGoalTargets();
  for (const key of COUNCIL_GOAL_KEYS) {
    const value = record[key] ?? 0;
    const label = COUNCIL_GOAL_LABELS[key];
    let clean: number;
    if (key === 'fundraising_target') clean = assertMoney(value, `${label} target`);
    else if (key === 'hours_target') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value % HOURS_STEP !== 0) {
        throw new BusinessRuleError('INVALID_INPUT', `${label} target must be 0 or more in steps of ${HOURS_STEP}; received ${String(value)}.`, { field: key });
      }
      clean = value;
    } else clean = assertInteger(value, `${label} target`, 0);
    if (clean > COUNCIL_GOAL_MAX) {
      throw new BusinessRuleError('INVALID_INPUT', `${label} target must be at most ${COUNCIL_GOAL_MAX.toLocaleString('en-US')}.`, { field: key });
    }
    out[key] = clean;
  }
  return out;
}

// ---- access --------------------------------------------------------------------------------------------------------

/** Reading the goals and the trends: the general ledger's readers (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED otherwise). */
export function assertMayReadCouncilGoals(actor: MemberWriteActor, councilId: number, action: string): void {
  assertMayReadGeneralLedger(actor, councilId, action);
}

export const mayReadCouncilGoals = (actor: MemberWriteActor, councilId: number): boolean => mayReadGeneralLedger(actor, councilId);

/**
 * Setting the targets: the council's Active Grand Knight or Deputy Grand Knight, an Active Admin of the council, or any
 * Active Super Admin. GRAND_KNIGHT_REQUIRED, or COUNCIL_ACCESS_DENIED for another council's leader.
 */
export function assertMaySetCouncilGoals(actor: MemberWriteActor, councilId: number, action: string): void {
  if (hasSuperAdminRights(actor)) return;
  const leader = actor.active && (hasAdminRights(actor) || holdsGrandKnightAuthority(actor.roles));
  if (leader && actor.councilId === councilId) return;
  if (leader) {
    throw new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} in council ${councilId}.`, {
      actorId: actor.memberId,
      actorCouncilId: actor.councilId,
      councilId,
    });
  }
  throw new SecurityPrivilegeError(
    'GRAND_KNIGHT_REQUIRED',
    `Only the council's Grand Knight, Deputy Grand Knight, Admins or a Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, councilId },
  );
}

/** The portal's twin of assertMayReadCouncilGoals. */
export const canReadCouncilGoals = (u: Actor, councilId: number): boolean => isAdmin(u) || canReadGeneralLedger(u, councilId);

/** The portal's twin of assertMaySetCouncilGoals. */
export const canSetCouncilGoals = (u: Actor, councilId: number): boolean =>
  isSuperAdmin(u) || (u.councilId === councilId && (isAdmin(u) || holdsGrandKnightSeat(u)));

// ---- the fiscal calendar ---------------------------------------------------------------------------------------------

export const FISCAL_MONTH_LABELS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] as const;

/** The twelve calendar months of a fraternal year, July first. */
export function fiscalMonths(fraternalYear: string): { year: number; month: number }[] {
  const start = Number(assertFraternalYear(fraternalYear).slice(0, 4));
  return Array.from({ length: 12 }, (_, i) => (i < 6 ? { year: start, month: 7 + i } : { year: start + 1, month: i - 5 }));
}

// ---- goals progress ---------------------------------------------------------------------------------------------------

export type CouncilGoalUnit = 'money' | 'count' | 'hours';

export interface CouncilGoalMetric {
  key: CouncilGoalKey;
  label: string;
  unit: CouncilGoalUnit;
  actual: number;
  target: number;
  /** actual / target as a whole percent (may pass 100); null with no target set. */
  percent: number | null;
  /** 'spiritual' for the Faith Center tally. */
  group: 'fraternal' | 'spiritual';
}

/** reports.getCouncilGoals: the year's targets beside what the records show. */
export interface CouncilGoalsProgress {
  councilId: number;
  fraternalYear: string;
  fromDate: string;
  toDate: string;
  /** The saved row, or null when the council has set no goals for the year. */
  goals: CouncilGoals | null;
  metrics: CouncilGoalMetric[];
  /** False for a white-label council: no devotional wheels. */
  spiritual: boolean;
  /** Sprints 8G/8H: DRAFT, REVIEWED or LOCKED (goalsPlanningStatusOf). */
  planningStatus: PlanningStatus;
  /** Sprints 8G/8H: true from July 1 of the year - the targets are read-only. */
  locked: boolean;
}

const roundHundredths = (n: number): number => Math.round(n * 100) / 100;

export const goalPercent = (actual: number, target: number): number | null => (target > 0 ? Math.round((actual / target) * 100) : null);

/** Members of the council who joined inside the fraternal year (DateJoinedCouncil). */
export function countNewMembers(members: readonly Pick<Member, 'CouncilID' | 'DateJoinedCouncil'>[], councilId: number, fraternalYear: string): number {
  const { fromDate, toDate } = fraternalYearBounds(fraternalYear);
  return members.filter((m) => m.CouncilID === councilId && typeof m.DateJoinedCouncil === 'string' && m.DateJoinedCouncil.slice(0, 10) >= fromDate && m.DateJoinedCouncil.slice(0, 10) <= toDate)
    .length;
}

/** Builds the Progress Center from the year's twelve monthly summaries, the new-member count and the devotional sums. */
export function buildCouncilGoalsProgress(input: {
  councilId: number;
  fraternalYear: string;
  goals: CouncilGoals | null;
  months: readonly MonthlySummary[];
  newMembers: number;
  /** Null for a white-label council. */
  devotions: CouncilDevotionTotals | null;
  /** Sprints 8G/8H: the data service's clock, for the July 1 lock; without it the stored status is reported. */
  today?: Date;
}): CouncilGoalsProgress {
  const fraternalYear = assertFraternalYear(input.fraternalYear);
  const targets: CouncilGoalTargets = input.goals ? { ...emptyCouncilGoalTargets(), ...pickTargets(input.goals) } : emptyCouncilGoalTargets();
  const raised = roundHundredths(input.months.reduce((sum, m) => sum + m.finances.raised, 0));
  const hours = roundHundredths(input.months.reduce((sum, m) => sum + m.laborHours.total, 0));
  const actuals: Partial<Record<CouncilGoalKey, number>> = { fundraising_target: raised, new_members_target: input.newMembers, hours_target: hours };
  if (input.devotions) {
    actuals.rosaries_target = input.devotions.rosaries;
    actuals.adorations_target = input.devotions.adorations;
    actuals.confessions_target = input.devotions.confessions;
  }
  const unit = (key: CouncilGoalKey): CouncilGoalUnit => (key === 'fundraising_target' ? 'money' : key === 'hours_target' ? 'hours' : 'count');
  const metrics = COUNCIL_GOAL_KEYS.filter((key) => input.devotions !== null || !SPIRITUAL_GOAL_KEYS.includes(key)).map((key) => ({
    key,
    label: COUNCIL_GOAL_LABELS[key],
    unit: unit(key),
    actual: actuals[key] ?? 0,
    target: targets[key],
    percent: goalPercent(actuals[key] ?? 0, targets[key]),
    group: SPIRITUAL_GOAL_KEYS.includes(key) ? ('spiritual' as const) : ('fraternal' as const),
  }));
  const locked = input.today ? councilGoalsLocked(fraternalYear, input.today) : input.goals?.budget_status === 'LOCKED';
  const planningStatus: PlanningStatus = input.today ? goalsPlanningStatusOf(input.goals, fraternalYear, input.today) : (input.goals?.budget_status ?? 'DRAFT');
  return {
    councilId: input.councilId,
    fraternalYear,
    ...fraternalYearBounds(fraternalYear),
    goals: input.goals,
    metrics,
    spiritual: input.devotions !== null,
    planningStatus,
    locked,
  };
}

const pickTargets = (row: CouncilGoals): CouncilGoalTargets =>
  Object.fromEntries(COUNCIL_GOAL_KEYS.map((k) => [k, Number(row[k] ?? 0)])) as CouncilGoalTargets;

// ---- year-over-year trends -----------------------------------------------------------------------------------------

/** The trends compare this many fraternal years by default: the current one and the two before it. */
export const TREND_DEFAULT_YEAR_COUNT = 3;
/** The most fraternal years one request may compare. */
export const TREND_MAX_YEAR_COUNT = 5;

/** The default comparison: the fraternal year `today` falls in and the ones before it, newest first. */
export function defaultTrendYears(today: Date, count = TREND_DEFAULT_YEAR_COUNT): string[] {
  const years = [currentFraternalYear(today)];
  while (years.length < count) years.push(previousFraternalYear(years[years.length - 1]));
  return years;
}

/** 1 to TREND_MAX_YEAR_COUNT distinct fraternal years, newest first. INVALID_INPUT otherwise. */
export function cleanTrendYears(input: unknown): string[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > TREND_MAX_YEAR_COUNT) {
    throw new BusinessRuleError('INVALID_INPUT', `Compare 1 to ${TREND_MAX_YEAR_COUNT} fraternal years.`, { count: Array.isArray(input) ? input.length : null });
  }
  const years = [...new Set(input.map((y) => assertFraternalYear(y)))];
  return years.sort((a, b) => b.localeCompare(a));
}

export interface TrendMonth {
  /** 'Jul' ... 'Jun'. */
  label: string;
  year: number;
  month: number;
  cash: number;
  electronic: number;
  raised: number;
  eventHours: number;
  activityHours: number;
  hours: number;
}

export interface TrendYear {
  fraternalYear: string;
  months: TrendMonth[];
  totals: { cash: number; electronic: number; raised: number; eventHours: number; activityHours: number; hours: number };
}

/** reports.yearOverYearTrends and GET /api/analytics/trends. */
export interface CouncilTrends {
  councilId: number;
  /** Newest first. */
  years: TrendYear[];
  /** The newest year's totals against the year after it in the list, as a whole percent; null without a prior figure. */
  change: { raisedPercent: number | null; hoursPercent: number | null };
}

/** One fraternal year's trend row from its twelve monthly summaries (July first). */
export function buildTrendYear(fraternalYear: string, months: readonly MonthlySummary[]): TrendYear {
  const rows = months.map((m, i) => ({
    label: FISCAL_MONTH_LABELS[i] ?? String(m.month),
    year: m.year,
    month: m.month,
    cash: m.finances.cash,
    electronic: m.finances.electronic,
    raised: m.finances.raised,
    eventHours: m.laborHours.events,
    activityHours: m.laborHours.activities,
    hours: m.laborHours.total,
  }));
  const sum = (pick: (r: TrendMonth) => number) => roundHundredths(rows.reduce((s, r) => s + pick(r), 0));
  return {
    fraternalYear: assertFraternalYear(fraternalYear),
    months: rows,
    totals: {
      cash: sum((r) => r.cash),
      electronic: sum((r) => r.electronic),
      raised: sum((r) => r.raised),
      eventHours: sum((r) => r.eventHours),
      activityHours: sum((r) => r.activityHours),
      hours: sum((r) => r.hours),
    },
  };
}

const changePercent = (current: number, prior: number): number | null => (prior > 0 ? Math.round(((current - prior) / prior) * 100) : null);

export function buildCouncilTrends(councilId: number, years: readonly TrendYear[]): CouncilTrends {
  const sorted = [...years].sort((a, b) => b.fraternalYear.localeCompare(a.fraternalYear));
  const [current, prior] = sorted;
  return {
    councilId,
    years: sorted,
    change: {
      raisedPercent: current && prior ? changePercent(current.totals.raised, prior.totals.raised) : null,
      hoursPercent: current && prior ? changePercent(current.totals.hours, prior.totals.hours) : null,
    },
  };
}

/** Gathers a fraternal year's twelve monthly summaries through `summary` (a driver's reports.monthlySummary). */
export async function collectFiscalMonths(fraternalYear: string, summary: (year: number, month: number) => Promise<MonthlySummary>): Promise<MonthlySummary[]> {
  return Promise.all(fiscalMonths(fraternalYear).map(({ year, month }) => summary(year, month)));
}
