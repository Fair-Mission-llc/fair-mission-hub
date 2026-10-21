// Sprint 8S Revision 2 (schema version 95): Council Wide Settings held to its two accordions with no text spill, the
// Expense Report (ER) and Charitable Donation Workflow drawers on the Financial Secretary and Treasurer Desks, and the
// Grand Knight's '[ 🗳️ Council Election Workflow ]' in the Planning & Budgeting Workflow's step layout.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildElectionWorkflow,
  buildExpenseWorkflow,
  CHARITABLE_DONATION_WORKFLOW_TITLE,
  COUNCIL_ELECTION_WORKFLOW_TITLE,
  COUNCIL_SETTINGS_CABINET_TABS,
  DESK_DRAWERS,
  deskDrawersFor,
  electionPhaseOf,
  erWorkflowAlert,
  EXPENSE_REPORT_WORKFLOW_TITLE,
  PLATFORM_SCHEMA_VERSION,
  type BallotSeat,
  type ExpenseReport,
} from '@kofc/shared';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const seat = (roles: string[], memberType: 'Member' | 'Admin' | 'Super Admin' = 'Member', memberId = 7) => ({ memberId, councilId: OWN, memberType, isOfficer: roles.length > 0, roles });
const FS = seat(['Financial Secretary']);
const TREASURER = seat(['Treasurer']);
const GK = seat(['Grand Knight']);
const ids = (u: ReturnType<typeof seat>, desk: Parameters<typeof deskDrawersFor>[1]) => deskDrawersFor(u, desk, OWN).map((d) => d.id);

const sheet = (id: number, over: Partial<ExpenseReport> = {}) => ({
  report: { id, CouncilID: OWN, SubmitterMemberID: 50, Status: 'Submitted', FinancialSecretaryMemberID: null, TreasurerMemberID: null, GrandKnightMemberID: null, ...over } as unknown as ExpenseReport,
});
const NEEDS_ORDER = sheet(1);
const NEEDS_CODING = sheet(2, { FinancialSecretaryMemberID: 60 });
const NEEDS_GK = sheet(3, { FinancialSecretaryMemberID: 60, TreasurerMemberID: 61 });
const PAYABLE = sheet(4, { Status: 'Approved', FinancialSecretaryMemberID: 60, TreasurerMemberID: 61, GrandKnightMemberID: 62 });

const ballotSeat = (roleId: number, roleName: string, over: { up?: 0 | 1; midYear?: 0 | 1; open?: boolean; nominees?: number } = {}): BallotSeat =>
  ({
    roleId,
    roleName,
    ballot: { CouncilID: OWN, RoleID: roleId, IsUpForElection: over.up ?? 1, IsMidYearElection: over.midYear ?? 0, NominationsCloseAt: null },
    fraternalYear: '2027-2028',
    nominationsOpen: over.open ?? false,
    holder: null,
    nominees: Array.from({ length: over.nominees ?? 0 }, (_, i) => ({ nomination: { id: i + 1 } })),
  }) as unknown as BallotSeat;

describe('1. Council Wide Settings: two accordions, no text spill', () => {
  const page = read('apps/web/app/system-settings/council-settings/page.tsx');
  const parts = read('apps/web/components/FeatureDeploymentParts.tsx');

  it('keeps exactly the four flat cabinet tabs (Sprint 8S Revision 10.1, was two accordions)', () => {
    expect(COUNCIL_SETTINGS_CABINET_TABS.map((t) => t.label)).toEqual(['Standard Bank Accounts', 'Global Revenue Splits', 'User Access & Roster Control', 'System Flags & Toggles']);
    expect(page.match(/^ {8}'[a-z-]+': \(/gm)).toEqual(["        'bank-accounts': (", "        'revenue-splits': (", "        'access-roster': (", "        'flags-toggles': ("]);
    for (const t of COUNCIL_SETTINGS_CABINET_TABS) expect(t.label, t.id).not.toMatch(/[^\x20-\x7E]/);
  });

  it('lets each bucket body shrink and wrap, and gives the matrix columns floor widths', () => {
    expect(parts).toContain("SETTINGS_CABINET_CANVAS_CLASS = 'min-w-0 break-words'");
    expect(parts).toContain('<div className={SETTINGS_CABINET_CANVAS_CLASS}>');
    expect(parts.match(/<Td className=\{FEATURE_MATRIX_COLUMN_CLASSES\[\d\]\}>/g)).toHaveLength(3);
    expect(read('apps/web/components/ui.tsx')).toContain('flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2');
  });

  it('moved the phone database to 95 (96 since Sprint 8S Revision 3)', () => {
    expect(read('Schema.sql')).toContain('(schema version 95)');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (9[5-9]|\d{3});/);
    expect(PLATFORM_SCHEMA_VERSION).toBeGreaterThanOrEqual(95);
    expect(read('docs/ARCHITECTURAL_HISTORY.md')).toContain('| 95 | 8S Revision 2 |');
  });
});

describe('2. the ER and donation workflow drawers on both finance desks', () => {
  it('mounts both drawers on the Financial Secretary and Treasurer Desks as passive reference folders, Treasurer money drawers still first', () => {
    for (const desk of ['financial-secretary', 'treasurer'] as const) {
      const titles = DESK_DRAWERS.filter((d) => d.desk === desk).map((d) => d.title);
      expect(titles).toEqual(expect.arrayContaining([EXPENSE_REPORT_WORKFLOW_TITLE, CHARITABLE_DONATION_WORKFLOW_TITLE]));
      // Sprint 8S Revision 10.4: the workflow trackers sit in the Reference Workflows block and never light.
      const workflows = DESK_DRAWERS.filter((d) => d.desk === desk && d.id.endsWith('-workflow'));
      expect(workflows.every((d) => d.cabinet === 'reference' && !d.alerts)).toBe(true);
    }
    expect(EXPENSE_REPORT_WORKFLOW_TITLE).toBe('Expense Report (ER) Workflow');
    expect(CHARITABLE_DONATION_WORKFLOW_TITLE).toBe('Charitable Donation Workflow');
    expect(ids(FS, 'financial-secretary')).toEqual(expect.arrayContaining(['er-workflow', 'donation-workflow']));
    expect(ids(TREASURER, 'treasurer').slice(0, 3)).toEqual(['ledger-coder', 'er-settlement', 'charity-matches']);
    expect(ids(TREASURER, 'treasurer').slice(-3)).toEqual(['er-workflow', 'donation-workflow', 'planning-budgeting']);
    expect(ids(seat([]), 'treasurer')).not.toContain('er-workflow');
  });

  it('counts the sheets at each signature and puts the reader on their own step', () => {
    const queue = [NEEDS_ORDER, NEEDS_CODING, NEEDS_CODING, NEEDS_GK, PAYABLE];
    const fs = buildExpenseWorkflow('financial-secretary', queue);
    expect(fs.steps.map((s) => s.count)).toEqual([1, 2, 1, 1]);
    expect(fs.steps.map((s) => s.yours)).toEqual([true, false, false, false]);
    expect(fs.steps[0].state).toBe('current');
    expect(fs.waiting).toBe(1);
    const t = buildExpenseWorkflow('treasurer', queue);
    expect(t.steps[1].state).toBe('current');
    expect(t.waiting).toBe(3);
    const idle = buildExpenseWorkflow('financial-secretary', [NEEDS_GK]);
    expect(idle.steps.map((s) => s.state)).toEqual(['done', 'done', 'current', 'done']);
    expect(idle.headline).toContain('Nothing waits on you');
    expect(buildExpenseWorkflow('treasurer', null).waiting).toBeNull();
  });

  it('lights the ER drawer by the desk signature rules', () => {
    expect(erWorkflowAlert(FS, 'financial-secretary', [NEEDS_ORDER])).toBe(true);
    expect(erWorkflowAlert(FS, 'financial-secretary', [NEEDS_CODING])).toBe(false);
    expect(erWorkflowAlert(TREASURER, 'treasurer', [NEEDS_CODING])).toBe(true);
    expect(erWorkflowAlert(TREASURER, 'treasurer', [NEEDS_GK])).toBe(false);
  });

  it('keeps both drawers read only on both desks (Sprint 8S Revision 10.6)', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).toContain('<ExpenseReportWorkflow desk="financial-secretary"');
    expect(desks).toContain('<ExpenseReportWorkflow desk="treasurer"');
    // Sprint 8S Revision 3: the donation drawer became the outgoing charity pipeline (tests/outgoing-charity-old-business.test.ts).
    expect(desks).toContain("useCharityPipeline(user, councilId, 'financial-secretary'");
    expect(desks).toContain("useCharityPipeline(user, councilId, 'treasurer'");
    // Sprint 8S Revision 10.6: the reference drawers mount no working module; each step names its working folder.
    const parts = read('apps/web/components/FinanceWorkflowParts.tsx');
    for (const mounted of ['<PaymentRequestDesk />', '<LedgerLineCoder />', '<ExpenseSettlement />', '<ExpenseRoutingTrack />', '<CharityCheckConsole />']) {
      expect(parts).not.toContain(mounted);
    }
    expect(parts).toContain('EXPENSE_WORKFLOW_WORK_FOLDERS[desk]');
  });
});

describe('3. the Council Election Workflow', () => {
  it('renames the Grand Knight drawer', () => {
    expect(COUNCIL_ELECTION_WORKFLOW_TITLE).toBe('[ 🗳️ Council Election Workflow ]');
    expect(DESK_DRAWERS.find((d) => d.id === 'election-workflow')).toMatchObject({ desk: 'grand-knight', title: COUNCIL_ELECTION_WORKFLOW_TITLE, area: 'elections' });
    expect(DESK_DRAWERS.some((d) => (d.id as string) === 'election-tracker' || d.title === 'Council Election Tracker')).toBe(false);
    expect(ids(GK, 'grand-knight')).toContain('election-workflow');
    expect(existsSync(join(__dirname, '..', 'apps/web/components/modules/ElectionTracker.tsx'))).toBe(false);
  });

  it('steps through the ballot, May nominations, the June vote and the July 1 term', () => {
    expect(['2027-03-01', '2027-05-10', '2027-06-10', '2027-07-02', '2027-10-01'].map((d) => electionPhaseOf(new Date(`${d}T12:00:00`)))).toEqual([
      'BALLOT',
      'NOMINATIONS',
      'ELECTION',
      'TERM',
      'CLOSED',
    ]);
    const ballot = [ballotSeat(1, 'Grand Knight', { open: true, nominees: 2 }), ballotSeat(2, 'Deputy Grand Knight', { open: true }), ballotSeat(3, 'Warden', { up: 0 })];
    const flow = buildElectionWorkflow({ today: new Date('2027-05-10T12:00:00'), electedSeats: 3, ballot });
    expect(flow.steps.map((s) => [s.key, s.state])).toEqual([
      ['BALLOT', 'done'],
      ['NOMINATIONS', 'current'],
      ['ELECTION', 'upcoming'],
      ['TERM', 'upcoming'],
    ]);
    expect([flow.onBallot, flow.nominated]).toEqual([2, 1]);
    expect(flow.headline).toBe('Nominations are open until May 31: 1 of 2 open offices have a nominee.');
  });

  it('leads with a mid-year election when one is open', () => {
    const flow = buildElectionWorkflow({ today: new Date('2027-10-01T12:00:00'), electedSeats: 3, ballot: [ballotSeat(4, 'Recorder', { midYear: 1, open: true })] });
    expect(flow.midYear.map((b) => b.roleName)).toEqual(['Recorder']);
    expect(flow.headline).toMatch(/^Mid-year election open for Recorder\./);
  });

  it('draws the election and planning drawers with the same workflow parts', () => {
    const election = read('apps/web/components/modules/ElectionWorkflow.tsx');
    const planning = read('apps/web/components/PlanningWorkflowParts.tsx');
    for (const part of ['<WorkflowActionBar', '<WorkflowStepRow', '<WorkflowWheels', 'stepsWheel(flow.steps)']) {
      expect(election).toContain(part);
      expect(planning).toContain(part);
    }
    expect(read('apps/web/components/DashboardDesks.tsx')).toContain('<CouncilElectionWorkflow />');
    expect(read('apps/web/app/elections/page.tsx')).toContain('@/components/modules/ElectionWorkflow');
  });
});
