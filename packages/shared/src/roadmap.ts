// =========================================================================
// THE ANNUAL FRATERNAL ROADMAP AND THE THREE-SIGNATURE FLOW (Sprint 7G)
//
// Every spring a council runs the same three steps to hand over to its next fraternal year (July 1 - June 30):
//   1. Nominations - May 1 through May 31 (elections.ts NOMINATION_MONTH);
//   2. Elections   - by June 30, recorded when the year is concluded (elections.concludeFraternalYear);
//   3. Budget lock - by July 10: the council votes the coming year's budget Approved (budget.approveAndFinalizeEntireBudget).
// A cycle is named by its calendar year: cycle 2027 elects and budgets the 2027-2028 fraternal year.
//
// A milestone is complete when the database shows it:
//   - nominations: an OfficerNominations row for the term year, or the elections step complete;
//   - elections:   a CouncilLeadershipHistory row for the term year (a seat filled for that year);
//   - budget lock: the term year's current budget lines read 'Approved' (budgetStatusOf).
// The next milestone not yet complete and not yet due is 'upcoming' (the gold border on the dashboard); one past its due
// date and not complete is 'overdue' (red), and elections.dispatchRoadmapAlerts pushes an alert to council leadership,
// once per milestone and cycle per leader.
//
// The three-signature flow is the expense sheet's path after submission (treasurer-desk.ts): the Financial Secretary's
// written order, the Treasurer's ledger coding and the Grand Knight's counter-signature, then the check.
// =========================================================================
import { ALERT_TITLE_MAX_LENGTH } from './push';
import { BusinessRuleError, describeActor, hasAdminRights, hasSuperAdminRights, SecurityPrivilegeError, toIsoDate, type MemberWriteActor } from './rules';
import type { BudgetLineStatus, ExpenseReport } from './types';

export type RoadmapMilestoneId = 'nominations' | 'elections' | 'budget_lock';
export type RoadmapMilestoneStatus = 'complete' | 'upcoming' | 'overdue' | 'scheduled';

/** One step of the cycle, as the dashboard draws it. */
export interface RoadmapMilestone {
  id: RoadmapMilestoneId;
  title: string;
  /** e.g. "May 1 - May 31". */
  windowLabel: string;
  /** YYYY-MM-DD, local: the first and last day of the step. */
  opensOn: string;
  dueOn: string;
  status: RoadmapMilestoneStatus;
  /** What the database shows, in one sentence. */
  detail: string;
}

/** The three-signature flow's live counts: the council's Submitted and Approved sheets by the signature they wait for. */
export interface SignatureFlowCounts {
  awaitingFinancialSecretary: number;
  awaitingTreasurer: number;
  awaitingGrandKnight: number;
  awaitingCheck: number;
}

/** elections.getFraternalRoadmap's answer. */
export interface FraternalRoadmap {
  councilId: number;
  /** The calendar year of the cycle, e.g. 2027. */
  cycleYear: number;
  /** The fraternal year the cycle elects and budgets, e.g. '2027-2028'. */
  termYear: string;
  /** In order: nominations, elections, budget lock. */
  milestones: RoadmapMilestone[];
  signatureFlow: SignatureFlowCounts;
}

/** elections.dispatchRoadmapAlerts' answer. */
export interface RoadmapAlertSweep {
  cycleYear: number;
  overdue: RoadmapMilestoneId[];
  /** Leaders alerted now, one NotificationLog row each per overdue milestone; leaders alerted before are skipped. */
  alertsSent: number;
  recipientIds: number[];
}

/** The day each step ends: May 31, June 30 and July 10 of the cycle year. */
export const ROADMAP_DUE_DATES: Readonly<Record<RoadmapMilestoneId, { month: number; day: number }>> = {
  nominations: { month: 4, day: 31 },
  elections: { month: 5, day: 30 },
  budget_lock: { month: 6, day: 10 },
};
/** The day each step opens. */
const ROADMAP_OPEN_DATES: Readonly<Record<RoadmapMilestoneId, { month: number; day: number }>> = {
  nominations: { month: 4, day: 1 },
  elections: { month: 5, day: 1 },
  budget_lock: { month: 6, day: 1 },
};
export const ROADMAP_MILESTONE_TITLES: Readonly<Record<RoadmapMilestoneId, string>> = {
  nominations: 'Nominations',
  elections: 'Elections',
  budget_lock: 'Budget Lock',
};
export const ROADMAP_MILESTONE_IDS: readonly RoadmapMilestoneId[] = ['nominations', 'elections', 'budget_lock'];
/** The roadmap keeps showing a cycle for this many days after its budget lock before it moves to next year's. */
export const ROADMAP_GRACE_DAYS = 30;
/** The seats an overdue milestone alerts, besides the council's Admins. */
export const ROADMAP_ALERT_ROLE_NAMES = ['Grand Knight', 'Deputy Grand Knight', 'Financial Secretary', 'Treasurer'] as const;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const dateOf = (year: number, at: { month: number; day: number }) => new Date(year, at.month, at.day);
const label = (at: { month: number; day: number }) => `${MONTH_NAMES[at.month]} ${at.day}`;

/** The fraternal year a cycle elects and budgets: cycle 2027 fills '2027-2028'. */
export const roadmapTermYear = (cycleYear: number): string => `${cycleYear}-${cycleYear + 1}`;

/** The cycle the dashboard opens on: this year's until ROADMAP_GRACE_DAYS after its July 10 lock, then next year's. */
export function roadmapCycleYear(today: Date): number {
  const y = today.getFullYear();
  const lock = dateOf(y, ROADMAP_DUE_DATES.budget_lock);
  const rollover = new Date(lock.getFullYear(), lock.getMonth(), lock.getDate() + ROADMAP_GRACE_DAYS + 1);
  return today >= rollover ? y + 1 : y;
}

/** Rejects INVALID_INPUT unless the cycle is a four-digit year from 2000 to 2100. */
export function assertRoadmapCycleYear(cycleYear: unknown): number {
  if (typeof cycleYear === 'number' && Number.isInteger(cycleYear) && cycleYear >= 2000 && cycleYear <= 2100) return cycleYear;
  throw new BusinessRuleError('INVALID_INPUT', `The roadmap year must be a whole year from 2000 to 2100; received ${JSON.stringify(cycleYear)}.`, {
    field: 'cycleYear',
  });
}

/** What the database shows for the cycle's term year. */
export interface RoadmapEvidence {
  nominationCount: number;
  leadershipTermCount: number;
  budgetStatus: BudgetLineStatus | null;
}

/**
 * The cycle's three milestones on `today`. A step is overdue from the day after its due date (local midnight); the first
 * step that is neither complete nor overdue is 'upcoming', later ones 'scheduled'.
 */
export function buildRoadmapMilestones(cycleYear: number, today: Date, evidence: RoadmapEvidence): RoadmapMilestone[] {
  const term = roadmapTermYear(cycleYear);
  const electionsDone = evidence.leadershipTermCount > 0;
  const done: Record<RoadmapMilestoneId, boolean> = {
    nominations: evidence.nominationCount > 0 || electionsDone,
    elections: electionsDone,
    budget_lock: evidence.budgetStatus === 'Approved',
  };
  const detail: Record<RoadmapMilestoneId, string> = {
    nominations:
      evidence.nominationCount > 0
        ? `${evidence.nominationCount} nomination${evidence.nominationCount === 1 ? '' : 's'} recorded for ${term}.`
        : electionsDone
          ? `The ${term} officers are seated.`
          : `No nomination recorded for ${term} yet.`,
    elections: electionsDone ? `The ${term} officers are seated.` : `No officer is seated for ${term} yet.`,
    budget_lock:
      evidence.budgetStatus === 'Approved'
        ? `The ${term} budget is approved and locked.`
        : evidence.budgetStatus === null
          ? `No ${term} budget lines yet.`
          : `The ${term} budget is still ${evidence.budgetStatus}.`,
  };
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let upcomingTaken = false;
  return ROADMAP_MILESTONE_IDS.map((id) => {
    const due = dateOf(cycleYear, ROADMAP_DUE_DATES[id]);
    let status: RoadmapMilestoneStatus;
    if (done[id]) status = 'complete';
    else if (todayStart > due) status = 'overdue';
    else if (!upcomingTaken) {
      status = 'upcoming';
      upcomingTaken = true;
    } else status = 'scheduled';
    return {
      id,
      title: ROADMAP_MILESTONE_TITLES[id],
      windowLabel: `${label(ROADMAP_OPEN_DATES[id])} - ${label(ROADMAP_DUE_DATES[id])}`,
      opensOn: toIsoDate(dateOf(cycleYear, ROADMAP_OPEN_DATES[id])),
      dueOn: toIsoDate(due),
      status,
      detail: detail[id],
    };
  });
}

/** The council's Submitted and Approved sheets counted by the signature each waits for. */
export function countSignatureFlow(
  reports: readonly Pick<ExpenseReport, 'Status' | 'FinancialSecretaryApprovedAt' | 'TreasurerReviewedAt'>[],
): SignatureFlowCounts {
  const out: SignatureFlowCounts = { awaitingFinancialSecretary: 0, awaitingTreasurer: 0, awaitingGrandKnight: 0, awaitingCheck: 0 };
  for (const r of reports) {
    if (r.Status === 'Approved') out.awaitingCheck += 1;
    else if (r.Status !== 'Submitted') continue;
    else if (!r.FinancialSecretaryApprovedAt) out.awaitingFinancialSecretary += 1;
    else if (!r.TreasurerReviewedAt) out.awaitingTreasurer += 1;
    else out.awaitingGrandKnight += 1;
  }
  return out;
}

/** The push alert for an overdue milestone. The title is the de-duplication key: one alert per leader per milestone and cycle. */
export function roadmapAlertPayload(milestone: Pick<RoadmapMilestone, 'id' | 'title' | 'dueOn' | 'detail'>, cycleYear: number): { title: string; body: string } {
  const title = `Overdue: ${milestone.title} ${cycleYear}`.slice(0, ALERT_TITLE_MAX_LENGTH);
  const body =
    `The ${milestone.title} step of the ${cycleYear} fraternal roadmap was due ${milestone.dueOn} and is not recorded as done. ${milestone.detail} ` +
    'Open the Executive Dashboard to see the Annual Fraternal Roadmap.';
  return { title, body };
}

/** Reading the roadmap: any Active member of the council, or an Active Super Admin. */
export function assertMayReadRoadmap(actor: MemberWriteActor, councilId: number): void {
  if (hasSuperAdminRights(actor) || (actor.active && actor.councilId === councilId)) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Only active members of council ${councilId} can read its fraternal roadmap; member ${actor.memberId} is ${describeActor(actor)} of council ${actor.councilId}.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
  );
}

/**
 * Sending the overdue-milestone alerts: the council's Active Admins and officers (the Executive Dashboard's readers),
 * or an Active Super Admin. The text is fixed, so this is wider than notifications.dispatchHighPriorityAlert.
 */
export function assertMayDispatchRoadmapAlerts(actor: MemberWriteActor, councilId: number): void {
  if (hasSuperAdminRights(actor)) return;
  if (!(hasAdminRights(actor) || (actor.active && actor.officer === true))) {
    throw new SecurityPrivilegeError(
      'ADMIN_REQUIRED',
      `Only an active Admin or officer of the council, or a Super Admin, can send roadmap alerts; member ${actor.memberId} is ${describeActor(actor)}.`,
      { actorId: actor.memberId, councilId },
    );
  }
  if (actor.councilId === councilId) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Member ${actor.memberId} of council ${actor.councilId} cannot send roadmap alerts for council ${councilId}.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
  );
}
