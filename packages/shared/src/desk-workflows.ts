// =========================================================================
// SPRINT 8S REVISION 2 - WORKFLOW DRAWERS ON THE FINANCE DESKS AND THE COUNCIL ELECTION WORKFLOW (schema version 95)
//
// Three step-by-step workflows share the layout of the Fraternal Planning & Budgeting Workflow drawer
// (planning-workflow.ts): a highlighted action bar with one plain sentence on what happens now, a row of numbered steps
// with the current one picked out in gold, and progress wheels.
//
//   Expense Report (ER) Workflow      Financial Secretary and Treasurer Desks. The four signatures a sheet collects -
//                                     the FS payment request, the Treasurer's ledger coding, the GK counter-signature
//                                     and the check - each step counting the council's sheets that wait on it. The
//                                     reader's own steps are marked; the drawer mounts the in-place action modules.
//   Charitable Donation Workflow      the same two desks and, since Sprint 8S Revision 3, the Grand Knight Desk. It
//                                     tracks OUTGOING charity money (charity-pipeline.ts): Member Charity Request ->
//                                     FS/GK Compliance Endorsement -> Treasurer Check Settlement. (In Revision 2 it
//                                     tracked incoming gifts; those stay on the batch coder and cash box drawers.)
//   Council Election Workflow         Grand Knight Desk. The ballot (before May 1), nominations (May), the election
//                                     (June) and the new term (July 1), over the nominations grid.
//
// The alert rules are the desks' own (desk-drawers.ts): a drawer lights only while work waits on the reader.
// =========================================================================
import type { BallotSeat, ExpenseReportDetail } from './contract';
import { awaitsCounterSignature, awaitsTreasurerCoding, awaitsWrittenOrder, isPayableExpenseReport } from './expenses';
import { NOMINATION_MONTH } from './elections';
import type { PlanningStepState } from './planning-workflow';

/** One numbered step of a workflow drawer. */
export interface WorkflowStep {
  key: string;
  label: string;
  when: string;
  detail: string;
  state: PlanningStepState;
  /** The items waiting at this step, or null when the reader cannot see them. */
  count?: number | null;
  /** True when the reader signs or acts at this step. */
  yours?: boolean;
}

export const EXPENSE_REPORT_WORKFLOW_TITLE = 'Expense Report (ER) Workflow';
export const CHARITABLE_DONATION_WORKFLOW_TITLE = 'Charitable Donation Workflow';
export const COUNCIL_ELECTION_WORKFLOW_TITLE = '[ 🗳️ Council Election Workflow ]';

/** The two finance desks that carry the ER and donation workflow drawers. */
export type FinanceWorkflowDesk = 'financial-secretary' | 'treasurer';

// ---- the Expense Report (ER) Workflow ------------------------------------------------------------------------------

export type ExpenseWorkflowStepKey = 'payment-request' | 'ledger-coding' | 'gk-approval' | 'check';

type Sheet = Pick<ExpenseReportDetail, 'report'>;

const EXPENSE_STEPS: readonly { key: ExpenseWorkflowStepKey; label: string; when: string; detail: string; wait: (s: Sheet) => boolean }[] = [
  { key: 'payment-request', label: 'Payment request', when: 'Financial Secretary', detail: 'Verify the receipts and sign the written order.', wait: (s) => awaitsWrittenOrder(s.report) },
  { key: 'ledger-coding', label: 'Ledger coding', when: 'Treasurer', detail: 'Give the sheet its budget line and ledger account.', wait: (s) => awaitsTreasurerCoding(s.report) },
  { key: 'gk-approval', label: 'GK approval', when: 'Grand Knight', detail: 'Counter-sign the sheet and release it for payment.', wait: (s) => awaitsCounterSignature(s.report) },
  { key: 'check', label: 'Check issued', when: 'Treasurer', detail: 'Pay the fully signed sheet by check.', wait: (s) => isPayableExpenseReport(s.report) },
];

/** Sprint 8S Revision 10.6: the step a sheet waits at (label and who acts), or null once it is paid or closed. */
export function expenseWorkflowStepOf(sheet: Sheet): { key: ExpenseWorkflowStepKey; label: string; when: string } | null {
  const step = EXPENSE_STEPS.find((s) => s.wait(sheet));
  return step ? { key: step.key, label: step.label, when: step.when } : null;
}

/** Sprint 8S Revision 10.6: the working folders where each finance desk does its own ER steps (the reference drawer is read only). */
export const EXPENSE_WORKFLOW_WORK_FOLDERS: Record<FinanceWorkflowDesk, string> = {
  'financial-secretary': 'the Auditing & Return Queue folder',
  treasurer: 'the Ledger Line Coder and Expense Report (ER) Settlement folders',
};

/** The steps each finance desk acts on. */
export const EXPENSE_WORKFLOW_DESK_STEPS: Record<FinanceWorkflowDesk, readonly ExpenseWorkflowStepKey[]> = {
  'financial-secretary': ['payment-request'],
  treasurer: ['ledger-coding', 'check'],
};

/**
 * The ER Workflow for one desk over the council queue (expenses.listCouncilQueue; null while it loads or when it is
 * refused). The current step is the reader's first own step with a sheet waiting, else the earliest step with one.
 */
export function buildExpenseWorkflow(desk: FinanceWorkflowDesk, queue: readonly Sheet[] | null): { steps: WorkflowStep[]; waiting: number | null; headline: string } {
  const counts = EXPENSE_STEPS.map((s) => (queue ? queue.filter(s.wait).length : null));
  const own = EXPENSE_WORKFLOW_DESK_STEPS[desk];
  const ownIndex = EXPENSE_STEPS.findIndex((s, i) => own.includes(s.key) && (counts[i] ?? 0) > 0);
  const current = ownIndex >= 0 ? ownIndex : counts.findIndex((c) => (c ?? 0) > 0);
  const steps = EXPENSE_STEPS.map((s, i): WorkflowStep => ({
    key: s.key,
    label: s.label,
    when: s.when,
    detail: s.detail,
    count: counts[i],
    yours: own.includes(s.key),
    state: i === current ? 'current' : counts[i] === 0 ? 'done' : 'upcoming',
  }));
  const waiting = queue ? own.reduce((sum, key) => sum + (counts[EXPENSE_STEPS.findIndex((s) => s.key === key)] ?? 0), 0) : null;
  const headline =
    queue === null
      ? 'Loading the council’s expense sheets…'
      : waiting
        ? `${waiting} sheet${waiting === 1 ? '' : 's'} wait${waiting === 1 ? 's' : ''} on your step. Work ${waiting === 1 ? 'it' : 'them'} in ${EXPENSE_WORKFLOW_WORK_FOLDERS[desk]}.`
        : current >= 0
          ? `Nothing waits on you. ${counts[current]} sheet${counts[current] === 1 ? '' : 's'} wait${counts[current] === 1 ? 's' : ''} at ${steps[current].label} (${steps[current].when}).`
          : 'Every sheet is paid. Nothing waits in the expense workflow.';
  return { steps, waiting, headline };
}

// ---- the Council Election Workflow ---------------------------------------------------------------------------------

export type ElectionPhase = 'BALLOT' | 'NOMINATIONS' | 'ELECTION' | 'TERM' | 'CLOSED';

/** BALLOT January-April, NOMINATIONS in May, ELECTION in June, TERM in July (the new term begins), CLOSED August-December. */
export function electionPhaseOf(today: Date): ElectionPhase {
  const m = today.getMonth();
  if (m < NOMINATION_MONTH) return 'BALLOT';
  if (m === NOMINATION_MONTH) return 'NOMINATIONS';
  if (m === NOMINATION_MONTH + 1) return 'ELECTION';
  if (m === NOMINATION_MONTH + 2) return 'TERM';
  return 'CLOSED';
}

export interface ElectionWorkflow {
  phase: ElectionPhase;
  steps: WorkflowStep[];
  /** Elected offices on this cycle's ballot, of all elected offices. */
  onBallot: number;
  electedSeats: number;
  /** Ballot seats with at least one nomination this term. */
  nominated: number;
  /** Ballot seats running a mid-year election now. */
  midYear: BallotSeat[];
  headline: string;
}

/** The Council Election Workflow for the elected seats' ballot rows (elections.listBallotConfig) on `today`. */
export function buildElectionWorkflow(input: { today: Date; electedSeats: number; ballot: readonly BallotSeat[] }): ElectionWorkflow {
  const phase = electionPhaseOf(input.today);
  const y = input.today.getFullYear();
  const onBallotRows = input.ballot.filter((b) => b.ballot.IsUpForElection === 1);
  const midYear = input.ballot.filter((b) => b.ballot.IsMidYearElection === 1 && b.nominationsOpen);
  const nominated = onBallotRows.filter((b) => b.nominees.length > 0).length;
  const index: Record<ElectionPhase, number> = { BALLOT: 0, NOMINATIONS: 1, ELECTION: 2, TERM: 3, CLOSED: 4 };
  const at = index[phase];
  const stateOf = (i: number): PlanningStepState => (i < at ? 'done' : i === at ? 'current' : 'upcoming');
  const steps: WorkflowStep[] = [
    { key: 'BALLOT', label: 'Open the ballot', when: `Before May 1, ${y}`, detail: 'Admins put each elected office up for election.', state: stateOf(0), count: onBallotRows.length },
    { key: 'NOMINATIONS', label: 'Nominations', when: `May 1 - 31, ${y}`, detail: 'Any active member nominates a brother Knight for an open office.', state: stateOf(1), count: nominated },
    { key: 'ELECTION', label: 'Election', when: `June ${y}`, detail: 'The council votes on the nominees at a business meeting.', state: stateOf(2) },
    { key: 'TERM', label: 'New term', when: `July 1, ${y}`, detail: 'The term begins; the Grand Knight concludes the year so the chairs move.', state: stateOf(3) },
  ];
  const headline = midYear.length
    ? `Mid-year election open for ${midYear.map((b) => b.roleName).join(', ')}. Nominations close at the time shown on the seat.`
    : phase === 'BALLOT'
      ? `${onBallotRows.length} of ${input.electedSeats} elected offices are on the ${y} ballot. Nominations open May 1.`
      : phase === 'NOMINATIONS'
        ? `Nominations are open until May 31: ${nominated} of ${onBallotRows.length} open offices have a nominee.`
        : phase === 'ELECTION'
          ? `Nominations closed. Hold the council's vote at a June business meeting; the new term begins July 1.`
          : phase === 'TERM'
            ? 'The new term has begun. Conclude the fraternal year so the officers move to their chairs.'
            : `The ${y} election cycle is complete. The next ballot opens in the new year.`;
  return { phase, steps, onBallot: onBallotRows.length, electedSeats: input.electedSeats, nominated, midYear, headline };
}
