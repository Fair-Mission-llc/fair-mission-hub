// Sprint 11 Revision 17.0 (schema version 110, unchanged): the unified operational cockpit and the simplified expense
// pipeline - the Super Admin header button, the Held/Past cadence cards and their Customize Agenda & Location drawer,
// the single receipt row, the scrolling bylaws preview, the roster's council gate, the two-part Financial Views
// accordion, the widescreen Activities and Meeting Center tables, and the synchronized page names.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertExpenseSplitTicket,
  blankReceiptRow,
  BYLAWS_PREVIEW_MAX_HEIGHT_PX,
  BYLAWS_PREVIEW_SCROLL_STYLE,
  CADENCE_CARD_BADGES,
  cadenceCardCustomizable,
  cadenceCardStatus,
  CHARITY_VETTING_QUEUE_TITLE,
  cleanExpenseLineItems,
  cleanExpenseReceipts,
  cleanMeetingCustomization,
  CUSTOMIZE_AGENDA_LOCATION_LABEL,
  deskMountsMemberRoster,
  DONATIONS_HISTORY_TITLE,
  FINANCIAL_DASHBOARD_TITLE,
  FINANCIAL_REPORTS_ACCORDION_TITLE,
  GK_EXPENSE_AUTHORIZE_TITLE,
  matchesEveryWord,
  paginateRows,
  PLATFORM_SCHEMA_VERSION,
  receiptRowsFromSheet,
  receiptRowsToSubmission,
  receiptRowTotals,
  FINANCIAL_ACTIONS_ACCORDION_TITLE,
  rosterAddMemberLocked,
  showsSuperAdminHeaderLink,
  sidebarLinkLabel,
  SUPER_ADMIN_HEADER_HREF,
  SUPER_ADMIN_HEADER_LINK_LABEL,
  withGrossTotal,
  withReimbursement,
  WORKSPACE_TABLE_PAGE_SIZE,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER, NOW } from './helpers';

const read = (path: string) => readFileSync(path, 'utf8');
const TODAY = '2026-09-20'; // NOW

describe('0. schema', () => {
  it('stays at version 110', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(111); // Sprint 11 Revision 18.0 moved the platform to schema 111.
  });
});

describe('1. Super Admin header and Recurring Meetings', () => {
  it('draws the Super Admin Desk button for Super Admin sessions only', () => {
    expect(SUPER_ADMIN_HEADER_LINK_LABEL).toBe('Super Admin Desk');
    expect(SUPER_ADMIN_HEADER_HREF).toBe('/super-admin');
    expect(showsSuperAdminHeaderLink({ memberType: 'Super Admin' })).toBe(true);
    expect(showsSuperAdminHeaderLink({ memberType: 'Super Admin' }, true)).toBe(false);
    for (const t of ['Admin', 'Member', 'Officer']) expect(showsSuperAdminHeaderLink({ memberType: t } as never)).toBe(false);
    const shell = read('apps/web/components/Shell.tsx');
    expect(shell).toContain('showsSuperAdminHeaderLink(user, Boolean(impersonator))');
    expect(shell).toContain('{SUPER_ADMIN_HEADER_LINK_LABEL}');
  });

  it('turns an over card into Held or Past by the clock, never Scheduled', () => {
    const at = (iso: string) => new Date(`${iso}`);
    const meeting = { InviteReleaseDate: '2026-09-15' };
    expect(cadenceCardStatus('2026-09-01', meeting, at('2026-09-20T12:00'), '21:30')).toBe('held');
    expect(cadenceCardStatus('2026-09-01', null, at('2026-09-20T12:00'), '21:30')).toBe('past');
    // The same day: over only once the end time has passed.
    expect(cadenceCardStatus('2026-09-20', meeting, at('2026-09-20T21:00'), '21:30')).toBe('released');
    expect(cadenceCardStatus('2026-09-20', meeting, at('2026-09-20T21:31'), '21:30')).toBe('held');
    expect(cadenceCardStatus('2026-10-06', null, at('2026-09-20T12:00'), '21:30')).toBe('scheduled');
    expect(cadenceCardStatus('2026-10-06', { InviteReleaseDate: '2026-10-01' }, at('2026-09-20T12:00'), '21:30')).toBe('hidden');
    expect(CADENCE_CARD_BADGES.held).toBe('Held');
    expect(CADENCE_CARD_BADGES.past).toBe('Past');
    expect(CADENCE_CARD_BADGES.scheduled).toBe('Scheduled');
    expect(cadenceCardCustomizable('released')).toBe(true);
    expect(cadenceCardCustomizable('hidden')).toBe(true);
    for (const s of ['held', 'past', 'scheduled'] as const) expect(cadenceCardCustomizable(s)).toBe(false);
  });

  it('puts the Customize Agenda & Location drawer on upcoming cards', () => {
    expect(CUSTOMIZE_AGENDA_LOCATION_LABEL).toBe('Customize Agenda & Location');
    const page = read('apps/web/app/meetings/cadence/page.tsx');
    expect(page).toContain('cadenceCardStatus(date, meeting, now, end)');
    expect(page).toContain('<CustomizeMeetingDrawer');
    expect(page).toContain('db.meetings.customizeAgendaAndLocation(');
  });

  it('cleans the drawer input', () => {
    expect(cleanMeetingCustomization({ Agenda: ' 1. Prayer ', Location: ' Hall ' })).toEqual({ Agenda: '1. Prayer', Location: 'Hall' });
    expect(() => cleanMeetingCustomization({ Agenda: '', Location: '  ' })).toThrow(/Location is required/);
    expect(() => cleanMeetingCustomization({ Agenda: '', Location: 'x'.repeat(101) })).toThrow(/at most 100/);
  });
});

describe.each(drivers)('$name driver: meetings.customizeAgendaAndLocation', (d) => {
  it('saves one upcoming meeting, refuses a past one and a plain member', async () => {
    const db = await d.make();
    const { created } = await db.meetings.populateAnnualCadence(MEMBER.admin, 1, 1, '2026-2027');
    const upcoming = created.find((m) => m.Date > TODAY)!;
    const past = created.find((m) => m.Date < TODAY)!;
    const saved = await db.meetings.customizeAgendaAndLocation(MEMBER.admin, upcoming.id, { Agenda: '1. Opening prayer', Location: 'Knights Hall' });
    expect(saved).toMatchObject({ id: upcoming.id, Agenda: '1. Opening prayer', Location: 'Knights Hall' });
    expect(await db.meetings.get(upcoming.id)).toMatchObject({ Location: 'Knights Hall' });
    await expectRule(db.meetings.customizeAgendaAndLocation(MEMBER.admin, past.id, { Agenda: '', Location: 'Hall' }), 'MEETING_ALREADY_HELD');
    await expectRule(db.meetings.customizeAgendaAndLocation(MEMBER.admin, 99999, { Agenda: '', Location: 'Hall' }), 'MEETING_NOT_FOUND');
    await expect(db.meetings.customizeAgendaAndLocation(MEMBER.member, upcoming.id, { Agenda: '', Location: 'Elsewhere' })).rejects.toThrow();
    expect(await db.meetings.get(upcoming.id)).toMatchObject({ Location: 'Knights Hall' });
    expect(NOW.getFullYear()).toBe(2026);
  });
});

describe('2. the single receipt row', () => {
  it('defaults Reimbursement Requested to the gross total until the member types their own', () => {
    let row = withGrossTotal(blankReceiptRow(TODAY), '42.50');
    expect(row.Reimbursement).toBe('42.50');
    row = withGrossTotal(row, '50.00');
    expect(row.Reimbursement).toBe('50.00');
    row = withReimbursement(row, '30.00');
    row = withGrossTotal(row, '60.00');
    expect(row).toMatchObject({ GrossTotal: '60.00', Reimbursement: '30.00', ReimbursementEdited: true });
    row = withReimbursement(row, '');
    expect(row).toMatchObject({ Reimbursement: '60.00', ReimbursementEdited: false });
  });

  it('becomes one receipt, a council line and a personal remainder that satisfy the split-ticket rule', () => {
    const rows = [
      { ...withGrossTotal(blankReceiptRow(TODAY), '100.00'), Merchant: 'Costco', Description: 'Pancake supplies', receipt_file_url: 'https://x/r1.pdf' },
      { ...withReimbursement(withGrossTotal(blankReceiptRow(TODAY), '80.00'), '50.00'), Merchant: 'Target', Description: 'Coffee', receipt_file_url: 'https://x/r2.pdf' },
      blankReceiptRow(TODAY),
    ];
    const { receipts, items } = receiptRowsToSubmission(rows);
    expect(receipts).toEqual([
      { merchant_name: 'Costco', gross_total: 100, receipt_file_url: 'https://x/r1.pdf' },
      { merchant_name: 'Target', gross_total: 80, receipt_file_url: 'https://x/r2.pdf' },
    ]);
    expect(items.map((i) => [i.Amount, i.receipt_index, i.is_personal_exclusion ?? 0, i.VendorName])).toEqual([
      [100, 0, 0, 'Costco'],
      [50, 1, 0, 'Target'],
      [30, 1, 1, 'Target'],
    ]);
    const cleanReceipts = cleanExpenseReceipts(receipts, 'Submitted', 0);
    const cleanItems = cleanExpenseLineItems(items, 'Submitted', NOW, cleanReceipts.length);
    expect(() => assertExpenseSplitTicket(cleanReceipts, cleanItems, 'Submitted')).not.toThrow();
    expect(receiptRowTotals(rows)).toEqual({ gross: 180, reimbursed: 150, personal: 30 });
  });

  it('refuses a reimbursement above the gross total or a gross total that is not a number', () => {
    const over = { ...withReimbursement(withGrossTotal(blankReceiptRow(TODAY), '10.00'), '12.00'), Merchant: 'A', Description: 'B' };
    expect(() => receiptRowsToSubmission([over])).toThrow(/Reimbursement Requested/);
    expect(() => receiptRowsToSubmission([{ ...blankReceiptRow(TODAY), Merchant: 'A', GrossTotal: 'ten' }])).toThrow(/Gross Total Amount/);
  });

  it('reads a stored sheet back into rows', () => {
    const rows = receiptRowsFromSheet(
      [{ id: 7, merchant_name: 'Target', gross_total: 80, receipt_file_url: 'f' }],
      [
        { DateOfExpense: '2026-09-01', Amount: 50, VendorName: 'Target', ExpenseDescription: 'Coffee', receipt_id: 7, is_personal_exclusion: 0 },
        { DateOfExpense: '2026-09-01', Amount: 30, VendorName: 'Target', ExpenseDescription: 'Personal', receipt_id: 7, is_personal_exclusion: 1 },
        { DateOfExpense: '2026-09-02', Amount: 12, VendorName: 'Gas', ExpenseDescription: 'Fuel', receipt_id: null },
      ],
      TODAY,
    );
    expect(rows).toEqual([
      { DateOfExpense: '2026-09-01', Merchant: 'Target', Description: 'Coffee', GrossTotal: '80', Reimbursement: '50', ReimbursementEdited: true, receipt_file_url: 'f' },
      { DateOfExpense: '2026-09-02', Merchant: 'Gas', Description: 'Fuel', GrossTotal: '12', Reimbursement: '12', ReimbursementEdited: false, receipt_file_url: '' },
    ]);
  });

  it('drops the itemisation grid, the Personal checkboxes and the charity link from the form', () => {
    const page = read('apps/web/app/expenses/page.tsx');
    expect(page).toContain('receiptRowsToSubmission(rows)');
    expect(page).toContain('REIMBURSEMENT_REQUESTED_LABEL');
    expect(page).not.toContain('Link to Vetted Charity Request');
    expect(page).not.toContain('listLinkableCharitableRequests');
    expect(page).not.toContain('caption="Line items"');
    expect(page).not.toMatch(/is personal, not for the council/);
  });

  it('scrolls the bylaws preview inside a fixed height', () => {
    expect(BYLAWS_PREVIEW_MAX_HEIGHT_PX).toBe(500);
    expect(BYLAWS_PREVIEW_SCROLL_STYLE).toEqual({ overflowY: 'scroll', maxHeight: '500px' });
    expect(read('apps/web/app/governance/bylaws/page.tsx')).toContain('style={BYLAWS_PREVIEW_SCROLL_STYLE}');
  });
});

describe('3. roster gate, Financial Views and widescreen tables', () => {
  it('locks Add Member while the picker reads All councils', () => {
    expect(rosterAddMemberLocked(true, null)).toBe(true);
    expect(rosterAddMemberLocked(true, 4)).toBe(false);
    expect(rosterAddMemberLocked(false, null)).toBe(false);
    const dir = read('apps/web/components/modules/MemberRosterDirectory.tsx');
    expect(dir).toContain('const addLocked = rosterAddMemberLocked(picker, councilId);');
    expect(dir).toContain('disabled={addLocked}');
  });

  it('splits the accordion into reports and registries, with plain link text', () => {
    // Sprint 11 Revision 17.5: the registries half is now the separate Financial Actions accordion.
    expect(FINANCIAL_REPORTS_ACCORDION_TITLE).toBe('FINANCIAL REPORTS');
    expect(FINANCIAL_ACTIONS_ACCORDION_TITLE).toBe('FINANCIAL ACTIONS');
    expect(sidebarLinkLabel('Council Roster')).toBe('Council Roster');
    expect(sidebarLinkLabel('Council Asset Management')).toBe('Council Asset Management');
    const sidebar = read('apps/web/components/Sidebar.tsx');
    expect(sidebar).toContain('FINANCIAL_REPORT_ITEMS');
    expect(sidebar).toContain('FINANCIAL_ACTION_ITEMS');
    expect(sidebar).not.toContain('plainNavLabel(');
    expect(sidebar).not.toContain('endorsementLink(');
  });

  it('pages and searches the workspace tables', () => {
    expect(WORKSPACE_TABLE_PAGE_SIZE).toBe(15);
    expect(matchesEveryWord('Monthly Meeting Parish Hall', 'hall monthly')).toBe(true);
    expect(matchesEveryWord('Monthly Meeting', 'monthly social')).toBe(false);
    expect(matchesEveryWord('anything', '  ')).toBe(true);
    const rows = Array.from({ length: 32 }, (_, i) => i);
    expect(paginateRows(rows, 0)).toEqual({ shown: rows.slice(0, 15), page: 0, pages: 3 });
    expect(paginateRows(rows, 9).page).toBe(2);
    expect(paginateRows([], 3)).toEqual({ shown: [], page: 0, pages: 1 });
    expect(read('apps/web/app/meetings/page.tsx')).toContain('<PagedTableControls id="meeting-center-search"');
    const activities = read('apps/web/app/activities/page.tsx');
    expect(activities).toContain('<PagedTableControls id="activity-history-search"');
    expect(activities).toContain('pageSize={WORKSPACE_TABLE_PAGE_SIZE}');
    expect(read('apps/web/components/RecordGrid.tsx')).toContain('paginateRows(shown, page, pageSize)');
  });
});

describe('4. synchronized names', () => {
  it('uses the new page titles', () => {
    expect(GK_EXPENSE_AUTHORIZE_TITLE).toBe('GK Expense Authorize');
    expect(CHARITY_VETTING_QUEUE_TITLE).toBe('Charity Vetting Queue');
    expect(FINANCIAL_DASHBOARD_TITLE).toBe('Financial Dashboard');
    expect(DONATIONS_HISTORY_TITLE).toBe('Donations History');
    expect(read('apps/web/components/modules/ApprovedExpenseSigning.tsx')).toContain('{GK_EXPENSE_AUTHORIZE_TITLE}');
    const vetting = read('apps/web/components/modules/CharityVettingBoard.tsx');
    expect(vetting).toContain('{CHARITY_VETTING_QUEUE_TITLE}');
    expect(vetting).toContain('<HelpTip text={CHARITY_VETTING_QUEUE_HELP}');
    expect(vetting).not.toContain('Four-Eyes Principle: a Knight Shepherd');
    expect(read('apps/web/components/modules/DonationRecords.tsx')).toContain('{DONATIONS_HISTORY_TITLE}</PageTitle>');
    for (const f of ['ApprovedExpenseSigning', 'CharityVettingBoard', 'DonationRecords']) {
      expect(read(`apps/web/components/modules/${f}.tsx`)).not.toMatch(/>\s*(Grand Knight Authorization Desk|Pooled Vetting Desk|Donations)\s*</);
    }
  });

  it('strips the Financial Dashboard corner links and quick actions', () => {
    const page = read('apps/web/app/finance/dashboard/page.tsx');
    expect(page).toContain('{FINANCIAL_DASHBOARD_TITLE}');
    expect(page).not.toContain('title="Quick actions"');
    expect(page).not.toContain('Trustee audit desk');
    expect(page).not.toContain('<Link');
  });

  it('drops the duplicate My requests panel and keeps the reply thread on the Member Desk', () => {
    const propose = read('apps/web/app/charities/propose/page.tsx');
    expect(propose).not.toContain('title={`My requests');
    expect(read('apps/web/components/DashboardDesks.tsx')).toContain("<RequestThreadButtons request={request} types={['MORE_INFO']}");
  });

  it('puts the endorsements folder inside the Charitable Grants Registry as a tab', () => {
    const registry = read('apps/web/components/modules/CharityCheckConsole.tsx');
    expect(registry).toContain("{ id: 'endorsements', label: CHARITY_ENDORSEMENT_FOLDER_TITLE }");
    expect(registry).toContain('<CharityEndorsementDesk');
  });

  it('never mounts the roster on the Financial Secretary Desk', () => {
    expect(deskMountsMemberRoster('financial-secretary')).toBe(false);
    expect(deskMountsMemberRoster('grand-knight')).toBe(true);
    expect(deskMountsMemberRoster('member')).toBe(true);
    const desks = read('apps/web/components/DashboardDesks.tsx');
    const fs = desks.slice(desks.indexOf('export function FinancialSecretaryDesk'), desks.indexOf('export function TreasurerDesk'));
    expect(fs).not.toContain('<MemberRosterDirectory');
  });
});
