// =========================================================================
// THE FRATERNAL PLANNING & BUDGETING WORKFLOW (Sprints 8G/8H, schema version 78)
//
// Each fraternal year (July 1 - June 30) is planned in the two months before it starts:
//   Draft    May 1 - May 31     the Annual Council Goals and the budget lines are drafted;
//   Review   June 1 - June 30   leadership reviews both and marks each one Reviewed;
//   Lock     July 1             the year starts: the goals become read-only for good (no override, not even a Super
//                              Admin's) and the budget figures lock as Finalized (budget.ts assertBudgetYearWritable);
//   Vote     July 1 - July 10   the council's final budget vote (budget.approveAndFinalizeEntireBudget) is recorded by
//                              July 10; afterwards BUDGET_VOTE_DEADLINE_PASSED unless a Super Admin overrides it.
//
// budget_status ('DRAFT', 'REVIEWED', 'LOCKED'; rules layer, no CHECK) is stored on CouncilGoals and on each
// CouncilBudgetForecast line. Edits leave it alone; "Mark reviewed" writes REVIEWED (reports.markCouncilGoalsReviewed,
// budget.markBudgetYearReviewed); the council's vote writes LOCKED on every line. A goals row reads as LOCKED from July
// 1 of its year whatever is stored (goalsPlanningStatusOf), so the lock needs no scheduler. A budget year reads as
// LOCKED once any line is Approved or LOCKED (budgetPlanningStatusOf), which also covers lines approved before schema 78.
//
// The dates are local midnight, as the budget's drafting window (budget.ts).
// =========================================================================
import { assertFraternalYear } from './budget';
import { BusinessRuleError, hasSuperAdminRights, toIsoDate, type MemberWriteActor } from './rules';
import type { BudgetWriteOptions } from './contract';
import type { CouncilBudgetForecast, CouncilGoals, PlanningStatus } from './types';

export const PLANNING_STATUSES: readonly PlanningStatus[] = ['DRAFT', 'REVIEWED', 'LOCKED'];

export const PLANNING_STATUS_LABELS: Record<PlanningStatus, string> = {
  DRAFT: 'Draft',
  REVIEWED: 'Reviewed',
  LOCKED: 'Locked',
};

/** Where a fraternal year's planning stands on a given day. */
export type PlanningPhase = 'NOT_OPEN' | 'DRAFT' | 'REVIEW' | 'VOTE' | 'CLOSED';

/** 0-based months and the vote's last day. */
export const PLANNING_DRAFT_MONTH = 4; // May
export const PLANNING_REVIEW_MONTH = 5; // June
export const PLANNING_LOCK_MONTH = 6; // July
export const BUDGET_VOTE_DEADLINE_DAY = 10; // July 10

const startYear = (fraternalYear: string): number => Number(assertFraternalYear(fraternalYear).slice(0, 4));

/** The year's four planning dates, as YYYY-MM-DD. */
export function planningDates(fraternalYear: string): { draftOpens: string; reviewOpens: string; lockDate: string; voteDeadline: string } {
  const y = startYear(fraternalYear);
  return {
    draftOpens: toIsoDate(new Date(y, PLANNING_DRAFT_MONTH, 1)),
    reviewOpens: toIsoDate(new Date(y, PLANNING_REVIEW_MONTH, 1)),
    lockDate: toIsoDate(new Date(y, PLANNING_LOCK_MONTH, 1)),
    voteDeadline: toIsoDate(new Date(y, PLANNING_LOCK_MONTH, BUDGET_VOTE_DEADLINE_DAY)),
  };
}

/** NOT_OPEN before May 1, DRAFT in May, REVIEW in June, VOTE July 1-10, CLOSED from July 11. */
export function planningPhaseOf(fraternalYear: string, today: Date): PlanningPhase {
  const y = startYear(fraternalYear);
  if (today < new Date(y, PLANNING_DRAFT_MONTH, 1)) return 'NOT_OPEN';
  if (today < new Date(y, PLANNING_REVIEW_MONTH, 1)) return 'DRAFT';
  if (today < new Date(y, PLANNING_LOCK_MONTH, 1)) return 'REVIEW';
  if (today < new Date(y, PLANNING_LOCK_MONTH, BUDGET_VOTE_DEADLINE_DAY + 1)) return 'VOTE';
  return 'CLOSED';
}

/** True from July 1 of the year's first calendar year: its goals are read-only for good. */
export const councilGoalsLocked = (fraternalYear: string, today: Date): boolean => today >= new Date(startYear(fraternalYear), PLANNING_LOCK_MONTH, 1);

/**
 * The July 1 goals lock: every CouncilGoals write for the year rejects COUNCIL_GOALS_LOCKED once its July 1 has come.
 * It is absolute - no Super Admin override lifts it.
 */
export function assertCouncilGoalsWritable(fraternalYear: string, today: Date): void {
  if (!councilGoalsLocked(fraternalYear, today)) return;
  throw new BusinessRuleError(
    'COUNCIL_GOALS_LOCKED',
    `The ${fraternalYear} council goals locked on July 1, ${startYear(fraternalYear)}, when the fraternal year began; they are read-only.`,
    { fraternalYear },
  );
}

/** A goals row's status: LOCKED from July 1 of its year, otherwise the stored value (DRAFT without one). */
export function goalsPlanningStatusOf(goals: Pick<CouncilGoals, 'budget_status'> | null | undefined, fraternalYear: string, today: Date): PlanningStatus {
  if (councilGoalsLocked(fraternalYear, today)) return 'LOCKED';
  const stored = goals?.budget_status;
  return stored === 'REVIEWED' || stored === 'LOCKED' ? stored : 'DRAFT';
}

/**
 * A budget year's status from its lines: LOCKED once any line is Approved or LOCKED (the council voted), REVIEWED
 * when every line is REVIEWED, otherwise DRAFT (including a year with no lines).
 */
export function budgetPlanningStatusOf(lines: readonly Pick<CouncilBudgetForecast, 'BudgetStatus' | 'budget_status'>[]): PlanningStatus {
  if (lines.some((l) => l.BudgetStatus === 'Approved' || l.budget_status === 'LOCKED')) return 'LOCKED';
  return lines.length > 0 && lines.every((l) => l.budget_status === 'REVIEWED') ? 'REVIEWED' : 'DRAFT';
}

/** Marking the goals Reviewed: a saved row (INVALID_INPUT), not locked, not already Reviewed (ILLEGAL_STATE_TRANSITION). */
export function assertGoalsReviewable(goals: Pick<CouncilGoals, 'budget_status'> | null | undefined, fraternalYear: string, today: Date): void {
  assertCouncilGoalsWritable(fraternalYear, today);
  if (!goals) throw new BusinessRuleError('INVALID_INPUT', `No ${fraternalYear} council goals are saved yet; set the targets before marking them reviewed.`, { fraternalYear });
  if (goalsPlanningStatusOf(goals, fraternalYear, today) !== 'DRAFT') {
    throw new BusinessRuleError('ILLEGAL_STATE_TRANSITION', `The ${fraternalYear} council goals are already marked reviewed.`, { fraternalYear });
  }
}

/** Marking the budget year Reviewed: lines to review (INVALID_INPUT) still in DRAFT (ILLEGAL_STATE_TRANSITION). */
export function assertBudgetYearReviewable(fraternalYear: string, lines: readonly Pick<CouncilBudgetForecast, 'BudgetStatus' | 'budget_status'>[]): void {
  if (lines.length === 0) throw new BusinessRuleError('INVALID_INPUT', `The ${fraternalYear} budget has no lines to review.`, { fraternalYear });
  const status = budgetPlanningStatusOf(lines);
  if (status !== 'DRAFT') {
    throw new BusinessRuleError('ILLEGAL_STATE_TRANSITION', `The ${fraternalYear} budget is already ${PLANNING_STATUS_LABELS[status].toLowerCase()}.`, { fraternalYear, status });
  }
}

/**
 * The final vote's deadline: approveAndFinalizeEntireBudget is accepted through July 10 of the year's first calendar
 * year. From July 11 it rejects BUDGET_VOTE_DEADLINE_PASSED, unless an Active Super Admin passes superAdminOverride.
 */
export function assertBudgetVoteOpen(fraternalYear: string, today: Date, actor: MemberWriteActor, options: BudgetWriteOptions = {}): void {
  if (planningPhaseOf(fraternalYear, today) !== 'CLOSED') return;
  if (options.superAdminOverride === true && hasSuperAdminRights(actor)) return;
  throw new BusinessRuleError(
    'BUDGET_VOTE_DEADLINE_PASSED',
    `The ${fraternalYear} budget vote had to be recorded by July ${BUDGET_VOTE_DEADLINE_DAY}, ${startYear(fraternalYear)}; ask a Super Admin to record it now.`,
    { fraternalYear },
  );
}

// ---- the status banner ----------------------------------------------------------------------------------------------

export type PlanningStepState = 'done' | 'current' | 'upcoming';

export interface PlanningStep {
  key: Exclude<PlanningPhase, 'NOT_OPEN' | 'CLOSED'> | 'LOCK';
  label: string;
  when: string;
  detail: string;
  state: PlanningStepState;
}

/** The Fraternal Planning & Budgeting Workflow banner for one year. */
export interface PlanningWorkflow {
  fraternalYear: string;
  phase: PlanningPhase;
  dates: ReturnType<typeof planningDates>;
  steps: PlanningStep[];
  goalsStatus: PlanningStatus;
  budgetStatus: PlanningStatus;
  goalsLocked: boolean;
  /** True July 1-10 while the budget is not yet voted. */
  voteOpen: boolean;
  /** One plain sentence on what happens now. */
  headline: string;
}

export function buildPlanningWorkflow(input: { fraternalYear: string; today: Date; goalsStatus: PlanningStatus; budgetStatus: PlanningStatus }): PlanningWorkflow {
  const fraternalYear = assertFraternalYear(input.fraternalYear);
  const phase = planningPhaseOf(fraternalYear, input.today);
  const dates = planningDates(fraternalYear);
  const y = startYear(fraternalYear);
  const currentIndex = phase === 'NOT_OPEN' ? -1 : phase === 'DRAFT' ? 0 : phase === 'REVIEW' ? 1 : phase === 'VOTE' ? 3 : 4;
  const stateOf = (i: number): PlanningStepState => (i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming');
  const goalsLocked = councilGoalsLocked(fraternalYear, input.today);
  const voted = input.budgetStatus === 'LOCKED';
  const steps: PlanningStep[] = [
    { key: 'DRAFT', label: 'Draft', when: `May 1 - 31, ${y}`, detail: 'Draft the council goals and the budget lines.', state: stateOf(0) },
    { key: 'REVIEW', label: 'Review', when: `June 1 - 30, ${y}`, detail: 'Leadership reviews the goals and the budget and marks each reviewed.', state: stateOf(1) },
    {
      key: 'LOCK',
      label: 'Lock',
      when: `July 1, ${y}`,
      detail: 'The year begins: the goals become read-only and the budget figures lock.',
      state: goalsLocked ? 'done' : 'upcoming',
    },
    {
      key: 'VOTE',
      label: 'Final vote',
      when: `By July ${BUDGET_VOTE_DEADLINE_DAY}, ${y}`,
      detail: 'The council votes the budget; the vote locks every line.',
      state: voted ? 'done' : stateOf(3),
    },
  ];
  const headline =
    phase === 'NOT_OPEN'
      ? `Planning for ${fraternalYear} opens May 1, ${y}. Goals may be set early; they lock on July 1.`
      : phase === 'DRAFT'
        ? `Drafting is open: set the ${fraternalYear} goals and draft the budget by May 31.`
        : phase === 'REVIEW'
          ? `Review month: check the ${fraternalYear} goals and budget and mark each reviewed before July 1.`
          : phase === 'VOTE'
            ? voted
              ? `The ${fraternalYear} goals are locked and the council has voted the budget.`
              : `The ${fraternalYear} goals are locked. Record the council's budget vote by July ${BUDGET_VOTE_DEADLINE_DAY}.`
            : voted
              ? `The ${fraternalYear} plan is complete: goals locked July 1 and the budget voted.`
              : `The ${fraternalYear} goals are locked and the budget vote deadline (July ${BUDGET_VOTE_DEADLINE_DAY}) has passed; a Super Admin can still record it.`;
  return {
    fraternalYear,
    phase,
    dates,
    steps,
    goalsStatus: input.goalsStatus,
    budgetStatus: input.budgetStatus,
    goalsLocked,
    voteOpen: phase === 'VOTE' && !voted,
    headline,
  };
}
