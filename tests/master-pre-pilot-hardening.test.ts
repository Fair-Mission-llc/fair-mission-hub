// Sprint 8S Revision 10.4 Unified (schema version 97): the Treasurer's Chart of Accounts & GL Setup folder, the
// Reference Workflows block on every officer desk, the Financial Secretary's Auditing & Return Queue, the inferred budget
// line on the Ledger Line Coder, the Historian's gallery tagging, the Section 122(b) notice answer, the phone Collect tab
// without the intake overlay, the split-receipt switch and the pilot kit's new Treasurer step.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  adviseQuery,
  CHART_OF_ACCOUNTS_FOLDER_TITLE,
  DESK_CABINET_LABELS,
  DESK_DRAWERS,
  deskDrawersFor,
  deskSpineSections,
  expandSplitExpenseLines,
  FS_AUDIT_FOLDER_TITLE,
  inferExpenseBudgetLine,
  inferredBudgetLabel,
  isVaultHistorian,
  REQUESTED_REIMBURSEMENT_LABEL,
  SPLIT_RECEIPT_TOGGLE_LABEL,
  type CouncilBudgetForecast,
  type DataService,
  type DrawerDeskId,
  type SplitExpenseLineDraft,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { drivers, NOW } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const OWN = 1;
const PASSWORD = 'dev-pass-secure-9912';
const seat = (roles: string[]) => ({ memberId: 7, councilId: OWN, memberType: 'Member', isOfficer: roles.length > 0, roles });

describe('1. the Chart of Accounts & GL Setup folder on the Treasurer Desk', () => {
  it('files the folder under Accounting Configuration and mounts the ledger grid on the blotter', () => {
    expect(DESK_DRAWERS.find((d) => d.id === 'chart-of-accounts')).toMatchObject({ desk: 'treasurer', title: CHART_OF_ACCOUNTS_FOLDER_TITLE, cabinet: 'accounting' });
    expect(CHART_OF_ACCOUNTS_FOLDER_TITLE).toBe('Chart of Accounts & GL Setup');
    expect(DESK_CABINET_LABELS.accounting).toBe('[ 🔧 Accounting Configuration ]');
    const sections = deskSpineSections('treasurer', deskDrawersFor(seat(['Treasurer']), 'treasurer', OWN));
    expect(sections.find((s) => s.id === 'accounting')?.drawers.map((d) => d.id)).toEqual(['chart-of-accounts']);
    expect(read('apps/web/components/DashboardDesks.tsx')).toContain('<ChartOfAccountsSetup memberId={user.memberId} councilId={councilId} />');
    expect(read('apps/web/components/modules/ChartOfAccountsSetup.tsx')).toContain('db.finance.listChartOfAccounts(memberId, councilId)');
  });

  it('keeps the chart off Council Wide Settings', () => {
    for (const file of ['apps/web/components/FeatureDeploymentParts.tsx', 'apps/web/components/SettingsParts.tsx', 'packages/shared/src/feature-deployment.ts'])
      expect(read(file)).not.toMatch(/chart of accounts|listChartOfAccounts/i);
  });
});

describe('2. the Reference Workflows block and the Auditing & Return Queue', () => {
  const SEATS: Record<DrawerDeskId, string[]> = {
    'grand-knight': ['Grand Knight'],
    'financial-secretary': ['Financial Secretary'],
    treasurer: ['Treasurer'],
    recorder: ['Recorder'],
    historian: ['Council Historian'],
  };

  it('ends every officer desk with the passive reference block, which never floats', () => {
    expect(DESK_CABINET_LABELS.reference).toBe('[ 📖 Reference Workflows ]');
    for (const [desk, roles] of Object.entries(SEATS) as [DrawerDeskId, string[]][]) {
      const drawers = deskDrawersFor(seat(roles), desk, OWN);
      const sections = deskSpineSections(desk, drawers, () => true);
      expect(sections[sections.length - 1].id, desk).toBe('reference');
      expect(sections[0].drawers.some((d) => d.cabinet === 'reference'), desk).toBe(false);
    }
    for (const d of DESK_DRAWERS.filter((x) => x.cabinet === 'reference')) expect(d.alerts, d.rowId).toBeFalsy();
  });

  it('maps each workflow tracker to its desks', () => {
    const ref = (desk: DrawerDeskId) => DESK_DRAWERS.filter((d) => d.desk === desk && d.cabinet === 'reference').map((d) => d.id);
    expect(ref('grand-knight')).toEqual(['donation-workflow', 'planning-budgeting', 'election-workflow']);
    expect(ref('financial-secretary')).toEqual(['er-workflow', 'donation-workflow']);
    expect(ref('treasurer')).toEqual(['er-workflow', 'donation-workflow', 'planning-budgeting']);
    expect(ref('recorder')).toEqual(['election-workflow']);
    expect(ref('historian')).toEqual(['election-workflow']);
    expect(read('apps/web/components/DeskDrawers.tsx')).toContain('isReferenceDrawer(spec) ? { ...s, alert: false } : s');
  });

  it("titles the Financial Secretary's audit folder and keeps the sidebar link", () => {
    expect(DESK_DRAWERS.find((d) => d.id === 'payment-requests')).toMatchObject({ title: FS_AUDIT_FOLDER_TITLE, area: 'expenses/audit', cabinet: 'inbound', alerts: true });
    expect(FS_AUDIT_FOLDER_TITLE).toBe('Auditing & Return Queue');
    expect(read('apps/web/components/Sidebar.tsx')).toContain("href: '/expenses/audit'");
  });
});

describe('3. the inferred budget line on the Ledger Line Coder', () => {
  const line = (id: number, LineItemName: string, over: Partial<CouncilBudgetForecast> = {}) =>
    ({ id, CouncilID: OWN, LineItemName, CategoryType: 'Operational', ReferenceSourceID: null, BudgetStatus: 'Approved', budget_version: 1, universal_category: null, ...over }) as CouncilBudgetForecast;
  const LINES = [
    line(1, 'Pancake Breakfasts', { CategoryType: 'Event', ReferenceSourceID: 4, universal_category: 'COMMUNITY_EVENTS' }),
    line(2, 'Miscellaneous Others', { universal_category: 'MISCELLANEOUS' }),
    line(3, 'Cathedral Bulletin Ad', { universal_category: 'ADMINISTRATIVE_OPERATIONS' }),
    line(4, 'Per Capita, Bank Fees, Postage', { universal_category: 'ADMINISTRATIVE_OPERATIONS' }),
    line(5, 'Equipment Purchases', { universal_category: 'CAPITAL_PROJECTS' }),
    line(6, 'Monthly Council Meetings', { universal_category: 'FRATERNAL_ACTIVITIES' }),
    line(7, 'Annual Donation to Pastor', { universal_category: 'CHARITABLE_DONATIONS' }),
  ];
  const loose = { EventID: null, EventName: null, MeetingID: null };
  const acct = (AccountName: string, AccountType = 'Expense') => ({ AccountName, AccountType });

  it('lets the general ledger account decide the line', () => {
    expect(inferExpenseBudgetLine(LINES, acct('Council Operational Costs'), loose)?.LineItemName).toBe('Monthly Council Meetings');
    expect(inferExpenseBudgetLine(LINES, acct('Event Operational Costs'), loose)?.LineItemName).toBe('Miscellaneous Others');
    expect(inferExpenseBudgetLine(LINES, acct('Event Operational Costs'), { ...loose, EventID: 4, EventName: 'Pancake Breakfast' })?.LineItemName).toBe('Pancake Breakfasts');
    expect(inferExpenseBudgetLine(LINES, acct('Charitable Disbursements'), { ...loose, CharityBudgetLineID: 7 })?.LineItemName).toBe('Annual Donation to Pastor');
    expect(inferExpenseBudgetLine(LINES, acct('Charitable Disbursements'), loose)?.LineItemName).toBe('Miscellaneous Others');
    expect(inferExpenseBudgetLine(LINES, acct('Supreme Assessments'), loose)?.LineItemName).toBe('Per Capita, Bank Fees, Postage');
    expect(inferExpenseBudgetLine(LINES, acct('Physical Assets', 'Asset'), loose)?.LineItemName).toBe('Equipment Purchases');
    expect(inferExpenseBudgetLine(LINES, null, loose)).toBeNull();
    expect(inferExpenseBudgetLine([], acct('Council Operational Costs'), loose)).toBeNull();
  });

  it('reads the line out in green instead of a dropdown', () => {
    expect(inferredBudgetLabel({ LineItemName: 'Monthly Council Meetings' })).toBe('[ Inferred Budget: Automatically Mapped to Monthly Council Meetings ]');
    const coder = read('apps/web/components/modules/LedgerLineCoder.tsx');
    expect(coder).not.toContain('<BudgetLinePicker');
    expect(coder).toContain('inferExpenseBudgetLine(budgetLines.lines, account');
    expect(coder).toContain('text-green');
  });
});

describe('4. the Section 122(b) notice answer', () => {
  const empty = { clauses: [] };

  it('answers the pilot question with the 10-day notice and the two-thirds vote', () => {
    const r = adviseQuery(empty, 'How much notice does a motion need?');
    expect(r.answer).toContain('Section 122(b)');
    expect(r.answer).toContain("10 days' previous notice");
    expect(r.answer).toContain('two-thirds (2/3) vote');
    expect(r.authority).toContain('Section 122(b)');
  });

  it('still explains how to make a motion', () => {
    expect(adviseQuery(empty, 'How do I make a motion?').answer).toContain('seconds it');
  });
});

describe('5. the phone Collect tab and the split receipt', () => {
  it('drops the intake switch and overlay, and scrolls to the top after a recorded donation', () => {
    const donate = read('apps/mobile/app/(app)/donate.tsx');
    expect(donate).not.toContain('<IntakeSessionSwitch');
    expect(donate).not.toContain('<GateIntakeOverlay');
    expect(donate).toContain('scrollRef.current?.scrollTo({ y: 0, animated: true });');
    expect(donate).toContain('<Screen scrollRef={scrollRef}');
  });

  it('labels the split switch and asks for one amount', () => {
    expect(SPLIT_RECEIPT_TOGGLE_LABEL).toBe('Split this receipt (Contains personal items)');
    expect(REQUESTED_REIMBURSEMENT_LABEL).toBe('Requested Reimbursement Amount');
    const phone = read('apps/mobile/app/(app)/expenses.tsx');
    expect(phone).not.toContain('Personal, not for the council');
    expect(phone).toContain('label={SPLIT_RECEIPT_TOGGLE_LABEL}');
    expect(phone).toContain('<Field label={REQUESTED_REIMBURSEMENT_LABEL}>');
  });

  it('stores a split receipt as a council line and a personal line', () => {
    const base: SplitExpenseLineDraft = { DateOfExpense: '2026-10-10', Amount: '50.00', VendorName: 'Fred Meyer', ExpenseDescription: 'Chalk and snacks', ReceiptPhotoURL: '', IsPersonal: true, ReceiptIndex: '', RequestedReimbursement: '30' };
    expect(expandSplitExpenseLines([base]).map((l) => [l.Amount, l.IsPersonal])).toEqual([
      ['30.00', false],
      ['20.00', true],
    ]);
    expect(expandSplitExpenseLines([{ ...base, RequestedReimbursement: '50' }]).map((l) => [l.Amount, l.IsPersonal])).toEqual([['50.00', false]]);
    expect(expandSplitExpenseLines([{ ...base, RequestedReimbursement: '0' }]).map((l) => [l.Amount, l.IsPersonal])).toEqual([['50.00', true]]);
    expect(expandSplitExpenseLines([{ ...base, RequestedReimbursement: undefined }]).map((l) => l.IsPersonal)).toEqual([true]);
    expect(expandSplitExpenseLines([{ ...base, IsPersonal: false, RequestedReimbursement: undefined }]).map((l) => l.IsPersonal)).toEqual([false]);
    expect(() => expandSplitExpenseLines([{ ...base, RequestedReimbursement: '' }])).toThrow(/Requested Reimbursement Amount/);
    expect(() => expandSplitExpenseLines([{ ...base, RequestedReimbursement: '60' }])).toThrow(/from 0.00 up to/);
    expect(expandSplitExpenseLines([{ ...base, RequestedReimbursement: '60' }], false).map((l) => l.IsPersonal)).toEqual([true]);
  });
});

describe('6. the pilot kit', () => {
  const kit = read('scripts/pilot_kit_pdf.py');

  it("adds the chart review before the Treasurer's ledger coding and the reports the user named", () => {
    const treasurer = kit.slice(kit.indexOf("key='treasurer'"), kit.indexOf("key='dgk'"));
    const review = treasurer.indexOf('[ 🔧 Accounting Configuration ] › Chart of Accounts & GL Setup');
    expect(review).toBeGreaterThan(0);
    expect(review).toBeLessThan(treasurer.indexOf('Treasurer Desk > Ledger Line Coder'));
    expect(treasurer).toContain('Reports 12 (');
    expect(treasurer).toContain('[ Inferred Budget: Automatically Mapped to');
    expect(treasurer).not.toContain('in Assign Ledger Budget Line Item');
    const fs = kit.slice(kit.indexOf("key='fs'"), kit.indexOf("key='treasurer'"));
    expect(fs).toContain('Auditing & Return Queue');
    expect(fs).toContain('Reports 11 (');
  });
});

describe.each(drivers)('$name driver: the Historian tags the pilot photos', (d) => {
  async function make(): Promise<DataService> {
    const now = () => new Date(NOW);
    if (d.name === 'memory') {
      const db = new MemoryDataService({ now, presentationData: true });
      await db.init();
      return db;
    }
    openDatabases.length = 0;
    const db = new SqliteDataService({ now, presentationData: true });
    await db.init();
    return db;
  }

  it('lets the Council Historian file photos to the Parish Parking Event and the October Business Meeting', async () => {
    const db = await make();
    const historian = (await db.auth.signIn('historian_user@stmarys.org', PASSWORD))!;
    expect(historian.roles).toContain('Council Historian');
    const parking = (await db.events.listByCouncil(OWN)).find((e) => e.EventName === 'Parish Parking Event')!;
    const october = (await db.media.getLibrary(historian.memberId, OWN)).meetings.find((m) => m.name === 'October Business Meeting')!;
    expect(parking).toBeTruthy();
    expect(october).toBeTruthy();
    expect(await db.media.uploadToVault(historian.memberId, { eventId: parking.id, fileUrls: ['lot.jpg'] })).toHaveLength(1);
    expect(await db.media.uploadToVault(historian.memberId, { meetingId: october.id, fileUrls: ['gavel.jpg'] })).toHaveLength(1);

    const alpha = (await db.auth.signIn('member_alpha@stmarys.org', PASSWORD))!;
    await expect(db.media.uploadToVault(alpha.memberId, { eventId: parking.id, fileUrls: ['mine.jpg'] })).rejects.toThrow();
    expect(isVaultHistorian({ active: true, councilId: OWN, roles: ['Council Historian'] }, [2])).toBe(false);
  });

  it('seeds the reports and accounts the scripts name', async () => {
    const db = await make();
    const id = async (email: string) => (await db.auth.signIn(email, PASSWORD))!.memberId;
    const [fs, treasurer] = await Promise.all([id('fs_user@stmarys.org'), id('treasurer_user@stmarys.org')]);
    const fsQueue = (await db.expenses.listCouncilQueue(fs, OWN)).filter((q) => q.report.FinancialSecretaryMemberID == null && q.report.Status === 'Submitted');
    expect(fsQueue.map((q) => q.report.id)).toEqual(expect.arrayContaining([11, 14, 15, 20, 21]));
    expect(fsQueue.find((q) => q.report.id === 11)?.total).toBe(86.4);
    const coding = await db.expenses.listTreasurerQueue(treasurer, OWN);
    expect(coding.map((q) => q.report.id).sort((a, b) => a - b)).toEqual([12, 17, 18, 22]);
    expect(coding.find((q) => q.report.id === 12)?.total).toBe(88.49);
    const chart = await db.finance.listChartOfAccounts(treasurer, OWN);
    const flat = (nodes: typeof chart.accounts): typeof chart.accounts => nodes.flatMap((n) => [n, ...flat(n.children)]);
    expect(flat(chart.accounts).filter((n) => n.account.AccountType === 'Asset').map((n) => n.account.AccountName)).toEqual([
      'Operating Checking',
      'Goal Account #1',
      'Goal Account #2',
      'General Savings',
      'Charity Savings',
      'Physical Assets',
    ]);
  });
});
