// Sprint 8P Stage 3 (schema version 89): drawers on every officer desk, the Oversight Desk dissolved into Grand Knight
// Desk drawers, the Operations Knowledge Archive lexicon and the side-by-side Member Desk shift trackers.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_TABS,
  DESK_DRAWERS,
  DESK_FOCUS_TARGETS,
  deskDrawersFor,
  diaryLogRows,
  erSettlementAlert,
  minutesArchiveRows,
  OPERATIONS_KNOWLEDGE_ARCHIVE_TITLE,
  payableSheets,
  treasurerCodingAlert,
  type DiaryEntryDetail,
  type ExpenseReport,
  type Meeting,
} from '@kofc/shared';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const seat = (roles: string[], memberType: 'Member' | 'Admin' | 'Super Admin' = 'Member', memberId = 7) => ({ memberId, councilId: OWN, memberType, isOfficer: roles.length > 0, roles });
const ids = (u: ReturnType<typeof seat>, desk: Parameters<typeof deskDrawersFor>[1]) => deskDrawersFor(u, desk, OWN).map((d) => d.id);

const sheet = (over: Partial<ExpenseReport> = {}) => ({
  report: { id: 1, CouncilID: OWN, SubmitterMemberID: 50, Status: 'Submitted', FinancialSecretaryMemberID: 60, TreasurerMemberID: null, GrandKnightMemberID: null, ...over } as unknown as ExpenseReport,
});

describe('drawers on every officer desk', () => {
  it('gives the Treasurer the three alerting money drawers first, beside Planning & Budgeting', () => {
    const treasurer = ids(seat(['Treasurer']), 'treasurer');
    expect(treasurer.slice(0, 3)).toEqual(['ledger-coder', 'er-settlement', 'charity-matches']);
    expect(treasurer).toEqual(expect.arrayContaining(['planning-budgeting', 'cash-box-audit', 'batch-coder', 'budget-vs-actuals', 'bank-match', 'parish-split']));
    for (const id of ['ledger-coder', 'er-settlement', 'charity-matches'] as const) expect(DESK_DRAWERS.find((d) => d.desk === 'treasurer' && d.id === id)?.alerts).toBe(true);
    expect(DESK_DRAWERS.find((d) => d.id === 'er-settlement')?.title).toBe('Expense Report (ER) Settlement');
    expect(DESK_DRAWERS.find((d) => d.id === 'charity-matches')?.title).toBe('Charitable Contribution Matches');
  });

  it('leads the Recorder Desk with the featured Historical Meeting Minutes Archive', () => {
    const recorder = deskDrawersFor(seat(['Recorder']), 'recorder', OWN);
    expect(recorder[0]).toMatchObject({ id: 'minutes-archive', title: 'Historical Meeting Minutes Archive', featured: true });
    expect(recorder.map((d) => d.id)).toEqual(expect.arrayContaining(['minutes-entry', 'live-meeting', 'motions-ledger']));
    expect(DESK_DRAWERS.filter((d) => d.featured).map((d) => d.id)).toEqual(['minutes-archive']);
    // Sprint 8S Revision 7: the featured folder leads the spine (gold-tinted, starred) instead of spanning a grid row.
    expect(read('apps/web/components/DeskDrawers.tsx')).toContain("spec.featured && 'bg-gold/10'");
  });

  it('leads the Historian Desk with the Fraternal Diary Entry Logs reader', () => {
    const historian = DESK_DRAWERS.filter((d) => d.desk === 'historian').map((d) => d.title);
    expect(historian[0]).toBe('Fraternal Diary Entry Logs');
    expect(historian).toEqual(expect.arrayContaining(['Monthly Newsletters', 'Meeting Photos', 'Oral History Recordings', 'Google Drive Media Gallery Sync Board']));
  });

  it('retires the folders and keeps the badge targets on drawer rows', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    for (const desk of ['treasurer', 'recorder', 'historian']) expect(desks).toContain(`desk="${desk}"`);
    expect(desks).not.toContain('<DeskModule ');
    expect(read('apps/web/components/DeskModules.tsx')).not.toContain('export function DeskModule(');
    const rows = new Set(DESK_DRAWERS.map((d) => d.rowId));
    for (const [key, target] of Object.entries(DESK_FOCUS_TARGETS)) if (key !== 'mine') expect(rows, key).toContain(target.rowId);
  });

  it('moves the Treasurer pages into modules the drawers mount', () => {
    expect(read('apps/web/app/finance/treasurer-desk/page.tsx')).toContain("@/components/modules/LedgerLineCoder'");
    expect(read('apps/web/app/expenses/disbursements/page.tsx')).toContain("@/components/modules/ExpenseSettlement'");
    const desks = read('apps/web/components/DashboardDesks.tsx');
    for (const m of ['<LedgerLineCoder />', '<ExpenseSettlement />', '<CharityCheckConsole />', '<PlanningBudgetingDrawer user={user} councilId={councilId} />']) expect(desks).toContain(m);
  });
});

describe('the Treasurer alerts', () => {
  it('lights the Ledger Line Coder for a sheet the reader may code, never the order-writer', () => {
    const t = seat(['Treasurer']);
    expect(treasurerCodingAlert(t, [sheet()])).toBe(true);
    expect(treasurerCodingAlert(t, [sheet({ SubmitterMemberID: 7 })])).toBe(false);
    expect(treasurerCodingAlert(t, [sheet({ FinancialSecretaryMemberID: 7 })])).toBe(false);
    expect(treasurerCodingAlert(seat(['Recorder']), [sheet()])).toBe(false);
  });

  it('lights ER Settlement only for a fully signed sheet the reader may pay', () => {
    const t = seat(['Treasurer']);
    const signed = sheet({ Status: 'Approved', TreasurerMemberID: 61, GrandKnightMemberID: 62 } as Partial<ExpenseReport>);
    expect(payableSheets([sheet(), signed])).toHaveLength(payableSheets([signed]).length);
    expect(erSettlementAlert(t, [sheet()])).toBe(false);
    expect(erSettlementAlert(t, payableSheets([signed]))).toBe(payableSheets([signed]).length > 0);
    expect(erSettlementAlert(seat(['Recorder']), [signed])).toBe(false);
  });
});

describe('the Oversight Desk is dissolved', () => {
  it('drops the tab, the gate and the badge strip', () => {
    expect(DASHBOARD_TABS.map((t) => t.id as string)).not.toContain('oversight');
    expect(read('packages/shared/src/officer-desks.ts')).not.toContain('export const canOpenOversightDesk');
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).not.toContain('export function OversightDesk(');
    expect(desks).not.toContain('export function DeskStatusBadges(');
  });

  it('puts its audits on the Grand Knight Desk as alerting drawers', () => {
    const gk = ids(seat(['Grand Knight']), 'grand-knight');
    expect(gk).toEqual(expect.arrayContaining(['flagged-hours', 'shifts-awaiting-hours']));
    expect(ids(seat([], 'Super Admin'), 'grand-knight')).toContain('access-requests');
    for (const id of ['flagged-hours', 'shifts-awaiting-hours', 'access-requests'] as const) expect(DESK_DRAWERS.find((d) => d.id === id)).toMatchObject({ desk: 'grand-knight', alerts: true });
    for (const key of ['quarantine', 'hours', 'access'] as const) expect(DESK_FOCUS_TARGETS[key].anchor).toBe('grand-knight');
  });

  it('keeps the Shifts Awaiting Hours audit on the Executive Dashboard for every audit reader', () => {
    const page = read('apps/web/app/executive-dashboard/page.tsx');
    expect(page).toContain('<AwaitingHours councilId={councilId} />');
    expect(page).not.toContain('is on the Oversight Desk');
  });
});

describe('the Operations Knowledge Archive lexicon', () => {
  it('uses one name in code, components and guides', () => {
    expect(OPERATIONS_KNOWLEDGE_ARCHIVE_TITLE).toBe('Operations Knowledge Archive');
    expect(readdirSync(join(__dirname, '..', 'apps/web/components'))).not.toContain('KnowledgeVaultParts.tsx');
    const parts = read('apps/web/components/KnowledgeArchiveParts.tsx');
    expect(parts).toContain('export function OperationsKnowledgeArchiveEntryForm(');
    for (const file of [
      'apps/web/components/KnowledgeArchiveParts.tsx',
      'apps/web/components/DashboardDesks.tsx',
      'packages/shared/src/types.ts',
      'packages/shared/src/contract.ts',
      'packages/shared/src/navigation-guide.ts',
      'packages/shared/src/operations-knowledge.ts',
      'docs/ADMIN_USER_GUIDE.md',
      'data_dictionary.md',
    ])
      expect(read(file), file).not.toMatch(/Knowledge Vault|KnowledgeVault/);
    expect(read('apps/web/components/DashboardDesks.tsx')).toContain('<OperationsKnowledgeArchiveEntryForm user={user} councilId={councilId} />');
  });
});

describe('the Member Desk shift trackers', () => {
  it('sets the two trackers side by side at the top, with no drawers', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    const member = desks.slice(desks.indexOf('export function MemberDesk('), desks.indexOf('export function AwaitingHours('));
    const top = member.slice(member.indexOf('aria-label="Shift trackers"'));
    expect(member).toContain('className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2"');
    expect(top.indexOf('<OpenShiftsCard user={user} />')).toBeLessThan(top.indexOf('My shifts: next'));
    expect(top.indexOf('My shifts: next')).toBeLessThan(top.indexOf('<MyCharityRequestsCard'));
    expect(member).not.toContain('<DeskBlotter');
  });
});

describe('the archive and diary readers', () => {
  const meeting = (id: number, date: string, over: Partial<Meeting> = {}) => ({ id, CouncilID: OWN, 'Meeting Name': `Meeting ${id}`, Date: date, ...over }) as Meeting;

  it('lists past meetings with published minutes or a minutes file, newest first, and searches them', () => {
    const rows = minutesArchiveRows(
      [
        meeting(1, '2026-08-03', { minutes_text: 'Budget adopted', minutes_published_at: '2026-08-05 10:00:00' }),
        meeting(2, '2026-09-07', { minutes_text: 'Draft only', minutes_published_at: null }),
        meeting(3, '2026-09-14', { MinutesURL: 'https://example.org/m.pdf' }),
        meeting(4, '2026-11-02', { minutes_text: 'Future', minutes_published_at: '2026-10-01 10:00:00' }),
      ],
      '2026-10-13',
    );
    expect(rows.map((m) => m.id)).toEqual([3, 1]);
    expect(minutesArchiveRows(rows, '2026-10-13', 'budget').map((m) => m.id)).toEqual([1]);
    expect(minutesArchiveRows(rows, '2026-10-13', 'draft')).toEqual([]);
  });

  it('reads the diary newest first, by year and by word', () => {
    const entry = (id: number, date: string, year: string, text: string, first = 'Tom'): DiaryEntryDetail => ({
      entry: { id, council_id: OWN, user_id: 7, entry_date: date, fraternal_year: year, diary_text: text, created_at: `${date} 10:00:00` },
      authorFirstName: first,
      authorLastName: 'Ferris',
    });
    const years = [
      { fraternalYear: '2026-2027', diary: [entry(3, '2026-10-01', '2026-2027', 'Parking lot restriped'), entry(4, '2026-10-05', '2026-2027', 'Rosary at noon', 'David')] },
      { fraternalYear: '2025-2026', diary: [entry(1, '2026-03-01', '2025-2026', 'Fish fry sold out')] },
    ];
    expect(diaryLogRows(years).map((d) => d.entry.id)).toEqual([4, 3, 1]);
    expect(diaryLogRows(years, '2025-2026').map((d) => d.entry.id)).toEqual([1]);
    expect(diaryLogRows(years, '', 'david').map((d) => d.entry.id)).toEqual([4]);
  });
});

describe('docs and phone schema', () => {
  it('moves the phone database to version 89 and documents the stage', () => {
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (89|9\d);/);
    expect(read('Schema.sql')).toContain('(schema version 89)');
    const admin = read('docs/ADMIN_USER_GUIDE.md');
    expect(admin).toContain('### 19.10.1 Read the Historical Meeting Minutes Archive');
    expect(admin).toContain('### 19.12.1 Read the Fraternal Diary Entry Logs');
    expect(admin).toContain('## 22. The Operations Knowledge Archive');
    expect(admin).not.toContain('`/dashboard#oversight` |');
    expect(read('scripts/pilot_kit_pdf.py')).not.toContain("{DESKS} > Oversight Desk");
  });
});
