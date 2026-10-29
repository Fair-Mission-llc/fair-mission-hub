// Sprint 8F (schema version 77): Annual Council Goals, the Shared Equipment Library, the colour-coded calendar and
// the year-over-year trends.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BRAND,
  buildCouncilGoalsProgress,
  buildCouncilTrends,
  buildLoanerLibrary,
  buildTrendYear,
  canLendCouncilAssets,
  canSetCouncilGoals,
  cleanCouncilGoalTargets,
  cleanTrendYears,
  contrastRatio,
  countNewMembers,
  defaultTrendYears,
  fiscalMonths,
  isLoanOverdue,
  MISSION_AREA_CALENDAR_CLASS,
  MISSION_AREA_COLORS,
  missionAreaOfCategoryId,
  navigationGuide,
  planAssetLoanChange,
  portalAreas,
  portalSidebar,
  type CouncilAssetsInventory,
  type MonthlySummary,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER, rawInsert } from './helpers';
import { readOfficerManuals } from './support/officer-manuals';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

const month = (year: number, m: number, raised: number, hours: number): MonthlySummary =>
  ({
    councilId: 1,
    year,
    month: m,
    fromDate: '',
    toDate: '',
    laborHours: { events: hours, activities: 0, total: hours },
    uniqueMembers: 0,
    finances: { spend: 0, expenses: 0, charitableGiving: 0, cash: raised, electronic: 0, raised, net: raised },
    outreach: { attendees: 0, events: 0 },
    highlights: [],
  }) as MonthlySummary;

const asset = (over: Partial<CouncilAssetsInventory> = {}): CouncilAssetsInventory => ({
  id: 5,
  council_id: 1,
  asset_name: 'PA system',
  purchase_date: '2024-01-01 00:00:00',
  cost_basis: 900,
  current_status: 'ACTIVE',
  is_loanable: 0,
  loan_status: 'AVAILABLE',
  ...over,
});

describe('schema version 77', () => {
  it('adds CouncilGoals and the loan columns and bumps the phone database', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('(schema version 77)');
    expect(schema).toContain('CREATE TABLE [CouncilGoals]');
    for (const col of ['fundraising_target', 'new_members_target', 'hours_target', 'rosaries_target', 'adorations_target', 'confessions_target']) {
      expect(schema).toContain(`[${col}]`);
    }
    expect(schema).toContain("ALTER TABLE [CouncilAssetsInventory] ADD [is_loanable] INT NOT NULL DEFAULT 0;");
    expect(schema).toContain("ALTER TABLE [CouncilAssetsInventory] ADD [loan_status] VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE';");
    expect(schema).toContain('ALTER TABLE [CouncilAssetsInventory] ADD [borrower_name] VARCHAR(255) NULL;');
    expect(schema).toContain('ALTER TABLE [CouncilAssetsInventory] ADD [borrower_council] VARCHAR(255) NULL;');
    expect(schema).toContain('ALTER TABLE [CouncilAssetsInventory] ADD [expected_return_date] DATE NULL;');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (7[7-9]|[8-9]\d|\d{3});/);
    expect(read('docs/ARCHITECTURAL_HISTORY.md')).toContain('| 77 | 8F |');
  });
});

describe('annual goals (pure)', () => {
  it('validates the six targets', () => {
    expect(cleanCouncilGoalTargets({ fundraising_target: 1000.5, hours_target: 12.25, rosaries_target: 3 })).toEqual({
      fundraising_target: 1000.5,
      new_members_target: 0,
      hours_target: 12.25,
      rosaries_target: 3,
      adorations_target: 0,
      confessions_target: 0,
    });
    expect(() => cleanCouncilGoalTargets({ hours_target: 1.1 })).toThrow(/steps of 0.25/);
    expect(() => cleanCouncilGoalTargets({ new_members_target: 2.5 })).toThrow();
    expect(() => cleanCouncilGoalTargets({ bogus: 1 })).toThrow(/no target/);
    expect(() => cleanCouncilGoalTargets({ fundraising_target: -1 })).toThrow();
  });

  it('measures the year from its months, joins and devotions', () => {
    const months = fiscalMonths('2026-2027').map(({ year, month: m }) => month(year, m, m === 9 ? 1500 : 0, m === 10 ? 40 : 0));
    const progress = buildCouncilGoalsProgress({
      councilId: 1,
      fraternalYear: '2026-2027',
      goals: { id: 1, council_id: 1, fraternal_year: '2026-2027', fundraising_target: 3000, new_members_target: 4, hours_target: 0, rosaries_target: 10, adorations_target: 5, confessions_target: 2 },
      months,
      newMembers: 1,
      devotions: { rosaries: 12, adorations: 1, confessions: 0, contributors: 3 },
    });
    expect(progress.metrics.map((m) => [m.key, m.actual, m.percent])).toEqual([
      ['fundraising_target', 1500, 50],
      ['new_members_target', 1, 25],
      ['hours_target', 40, null],
      ['rosaries_target', 12, 120],
      ['adorations_target', 1, 20],
      ['confessions_target', 0, 0],
    ]);
    expect(progress.fromDate).toBe('2026-07-01');
  });

  it('drops the devotional wheels for a white-label council', () => {
    const progress = buildCouncilGoalsProgress({ councilId: 1, fraternalYear: '2026-2027', goals: null, months: [], newMembers: 0, devotions: null });
    expect(progress.metrics.map((m) => m.key)).toEqual(['fundraising_target', 'new_members_target', 'hours_target']);
    expect(progress.spiritual).toBe(false);
  });

  it('counts joins inside the fraternal year only', () => {
    const members = [
      { CouncilID: 1, DateJoinedCouncil: '2026-07-01' },
      { CouncilID: 1, DateJoinedCouncil: '2027-06-30' },
      { CouncilID: 1, DateJoinedCouncil: '2026-06-30' },
      { CouncilID: 2, DateJoinedCouncil: '2026-08-01' },
      { CouncilID: 1, DateJoinedCouncil: null },
    ];
    expect(countNewMembers(members, 1, '2026-2027')).toBe(2);
  });

  it('lets the GK, DGK, Admins and Super Admins set targets', () => {
    const u = (memberType: string, roles: string[] = [], councilId = 1) => ({ memberId: 9, councilId, memberType, isOfficer: roles.length > 0, roles }) as never;
    expect(canSetCouncilGoals(u('Member', ['Grand Knight']), 1)).toBe(true);
    expect(canSetCouncilGoals(u('Member', ['Deputy Grand Knight']), 1)).toBe(true);
    expect(canSetCouncilGoals(u('Admin'), 1)).toBe(true);
    expect(canSetCouncilGoals(u('Super Admin', [], 2), 1)).toBe(true);
    expect(canSetCouncilGoals(u('Member', ['Treasurer']), 1)).toBe(false);
    expect(canSetCouncilGoals(u('Member', ['Grand Knight'], 2), 1)).toBe(false);
  });
});

describe('year-over-year trends (pure)', () => {
  it('runs the fiscal months from July and defaults to three years', () => {
    expect(fiscalMonths('2026-2027')[0]).toEqual({ year: 2026, month: 7 });
    expect(fiscalMonths('2026-2027')[11]).toEqual({ year: 2027, month: 6 });
    expect(defaultTrendYears(new Date(2026, 9, 12))).toEqual(['2026-2027', '2025-2026', '2024-2025']);
    expect(cleanTrendYears(['2024-2025', '2026-2027', '2024-2025'])).toEqual(['2026-2027', '2024-2025']);
    expect(() => cleanTrendYears([])).toThrow();
    expect(() => cleanTrendYears(['2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026'])).toThrow();
  });

  it('totals each year and compares the newest with the one before', () => {
    const year = (fy: string, raised: number, hours: number) =>
      buildTrendYear(
        fy,
        fiscalMonths(fy).map(({ year: y, month: m }) => month(y, m, m === 12 ? raised : 0, m === 12 ? hours : 0)),
      );
    const trends = buildCouncilTrends(1, [year('2025-2026', 1000, 50), year('2026-2027', 1500, 40)]);
    expect(trends.years.map((y) => y.fraternalYear)).toEqual(['2026-2027', '2025-2026']);
    expect(trends.years[0].months[5]).toMatchObject({ label: 'Dec', raised: 1500, hours: 40 });
    expect(trends.change).toEqual({ raisedPercent: 50, hoursPercent: -20 });
  });
});

describe('the loaner library (pure)', () => {
  const today = '2026-10-12';
  it('lists, pauses, resumes, checks out and returns an item', () => {
    expect(planAssetLoanChange(asset(), { action: 'list' }, today)).toMatchObject({ is_loanable: 1, loan_status: 'AVAILABLE' });
    const listed = asset({ is_loanable: 1 });
    expect(planAssetLoanChange(listed, { action: 'pause' }, today)).toEqual({ loan_status: 'UNAVAILABLE' });
    expect(planAssetLoanChange(asset({ is_loanable: 1, loan_status: 'UNAVAILABLE' }), { action: 'resume' }, today)).toEqual({ loan_status: 'AVAILABLE' });
    expect(
      planAssetLoanChange(listed, { action: 'check-out', borrower_name: ' Mark ', borrower_council: 'Council 2042', expected_return_date: '2026-10-20' }, today),
    ).toEqual({ loan_status: 'CHECKED_OUT', borrower_name: 'Mark', borrower_council: 'Council 2042', expected_return_date: '2026-10-20' });
    expect(planAssetLoanChange(asset({ is_loanable: 1, loan_status: 'CHECKED_OUT', borrower_name: 'Mark' }), { action: 'return' }, today)).toEqual({
      loan_status: 'AVAILABLE',
      borrower_name: null,
      borrower_council: null,
      expected_return_date: null,
    });
  });

  it('refuses clicks the state does not allow', () => {
    const out = asset({ is_loanable: 1, loan_status: 'CHECKED_OUT' });
    expect(() => planAssetLoanChange(out, { action: 'unlist' }, today)).toThrow(/log its return/);
    expect(() => planAssetLoanChange(out, { action: 'pause' }, today)).toThrow();
    expect(() => planAssetLoanChange(asset(), { action: 'check-out', borrower_name: 'A', borrower_council: 'B', expected_return_date: '2026-10-20' }, today)).toThrow(/not in the loaner library/);
    expect(() => planAssetLoanChange(asset({ current_status: 'DISPOSED' }), { action: 'list' }, today)).toThrow(/ACTIVE/);
    expect(() => planAssetLoanChange(asset({ is_loanable: 1 }), { action: 'check-out', borrower_name: 'A', borrower_council: 'B', expected_return_date: '2026-10-01' }, today)).toThrow(/today or later/);
    expect(() => planAssetLoanChange(asset({ is_loanable: 1 }), { action: 'return' }, today)).toThrow(/not checked out/);
  });

  it('shows only listed ACTIVE items, available first, with overdue flags and no cost', () => {
    const rows = [
      asset({ id: 1, is_loanable: 1, loan_status: 'CHECKED_OUT', expected_return_date: '2026-10-01' }),
      asset({ id: 2, is_loanable: 1, asset_name: 'Tent' }),
      asset({ id: 3, is_loanable: 0 }),
      asset({ id: 4, is_loanable: 1, current_status: 'LOST' }),
      asset({ id: 6, is_loanable: 1, council_id: 2, asset_name: 'Grill', loan_status: 'UNAVAILABLE' }),
    ];
    const lib = buildLoanerLibrary(rows, [{ id: 1, CouncilNumber: 15295, CouncilName: "St. Mary's" }, { id: 2, CouncilNumber: 2042, CouncilName: 'St. Anthony' }], today);
    expect(lib.map((e) => [e.assetId, e.loanStatus, e.overdue])).toEqual([
      [2, 'AVAILABLE', false],
      [1, 'CHECKED_OUT', true],
      [6, 'UNAVAILABLE', false],
    ]);
    expect(lib[0]).not.toHaveProperty('cost_basis');
    expect(isLoanOverdue(asset({ loan_status: 'CHECKED_OUT', expected_return_date: '2026-10-12' }), today)).toBe(false);
  });

  it('lets only the GK, DGK and Super Admins lend', () => {
    const u = (memberType: string, roles: string[] = [], councilId = 1) => ({ memberId: 9, councilId, memberType, isOfficer: roles.length > 0, roles }) as never;
    expect(canLendCouncilAssets(u('Member', ['Grand Knight']), 1)).toBe(true);
    expect(canLendCouncilAssets(u('Member', ['Deputy Grand Knight']), 1)).toBe(true);
    expect(canLendCouncilAssets(u('Super Admin', [], 2), 1)).toBe(true);
    expect(canLendCouncilAssets(u('Admin'), 1)).toBe(false);
    expect(canLendCouncilAssets(u('Member', ['Trustee 1']), 1)).toBe(false);
  });
});

describe.each(drivers)('goals, trends and loans in the $name driver', ({ make }) => {
  it('saves goals and measures them against the monthly summaries', async () => {
    const db = await make();
    // Sprints 8G/8H: the tests' today (2026-09-20) is past the 2026-2027 goals' July 1 lock, so the next year is set.
    const empty = await db.reports.getCouncilGoals(MEMBER.superAdmin, 1, '2027-2028');
    expect(empty.goals).toBeNull();
    expect(empty.metrics.every((m) => m.target === 0 && m.percent === null)).toBe(true);
    const saved = await db.reports.setCouncilGoals(MEMBER.admin, 1, '2027-2028', {
      fundraising_target: 10000,
      new_members_target: 5,
      hours_target: 100,
      rosaries_target: 50,
      adorations_target: 20,
      confessions_target: 10,
    });
    expect(saved).toMatchObject({ council_id: 1, fraternal_year: '2027-2028', fundraising_target: 10000, updated_by_member_id: MEMBER.admin });
    const again = await db.reports.setCouncilGoals(MEMBER.superAdmin, 1, '2027-2028', {
      fundraising_target: 20000,
      new_members_target: 5,
      hours_target: 100,
      rosaries_target: 50,
      adorations_target: 20,
      confessions_target: 10,
    });
    expect(again.id).toBe(saved.id);
    const progress = await db.reports.getCouncilGoals(MEMBER.superAdmin, 1, '2027-2028');
    const raised = (await Promise.all(fiscalMonths('2027-2028').map(({ year, month: m }) => db.reports.monthlySummary(1, year, m)))).reduce(
      (s, x) => s + x.finances.raised,
      0,
    );
    const fundraising = progress.metrics.find((m) => m.key === 'fundraising_target')!;
    expect(fundraising.target).toBe(20000);
    expect(fundraising.actual).toBeCloseTo(raised, 2);
    expect(progress.spiritual).toBe(true);
  });

  it('keeps the goals and trends from plain members and the targets from non-leaders', async () => {
    const db = await make();
    await expectRule(db.reports.getCouncilGoals(MEMBER.member, 1, '2026-2027'), 'ADMIN_REQUIRED');
    await expectRule(db.reports.yearOverYearTrends(MEMBER.member, 1, ['2026-2027']), 'ADMIN_REQUIRED');
    await expectRule(db.reports.setCouncilGoals(MEMBER.member, 1, '2026-2027', { fundraising_target: 1 } as never), 'GRAND_KNIGHT_REQUIRED');
    await expectRule(db.reports.getCouncilGoals(MEMBER.superAdmin, 1, '2026'), 'INVALID_INPUT');
  });

  it('compares fraternal years month by month', async () => {
    const db = await make();
    const trends = await db.reports.yearOverYearTrends(MEMBER.admin, 1, ['2025-2026', '2026-2027']);
    expect(trends.years.map((y) => y.fraternalYear)).toEqual(['2026-2027', '2025-2026']);
    expect(trends.years[0].months).toHaveLength(12);
    expect(trends.years[0].months.map((m) => m.label).slice(0, 2)).toEqual(['Jul', 'Aug']);
  });

  it('lends an asset across councils and lists it in the shared directory', async () => {
    const db = await make();
    const other = rawInsert(db, 'Council', { CouncilNumber: 2042, CouncilName: 'St. Anthony Council', State: 'OR' });
    const id = rawInsert(db, 'CouncilAssetsInventory', { council_id: 1, asset_name: 'PA system', purchase_date: '2024-01-01 00:00:00', cost_basis: 900, current_status: 'ACTIVE' });
    const fresh = await db.expenses.getAssetRecord(MEMBER.superAdmin, id);
    expect(fresh).toMatchObject({ is_loanable: 0, loan_status: 'AVAILABLE' });
    await expectRule(db.expenses.updateAssetLoan(MEMBER.admin, id, { action: 'list' }), 'GRAND_KNIGHT_REQUIRED');
    await db.expenses.updateAssetLoan(MEMBER.superAdmin, id, { action: 'list' });
    expect((await db.expenses.listLoanerLibrary(MEMBER.member)).map((e) => [e.assetId, e.loanStatus])).toEqual([[id, 'AVAILABLE']]);
    const out = await db.expenses.updateAssetLoan(MEMBER.superAdmin, id, {
      action: 'check-out',
      borrower_name: 'Mark Delgado',
      borrower_council: 'St. Anthony Council 2042',
      expected_return_date: '2026-09-30',
    });
    expect(out).toMatchObject({ loan_status: 'CHECKED_OUT', borrower_name: 'Mark Delgado', expected_return_date: '2026-09-30' });
    await expectRule(db.expenses.updateAssetLoan(MEMBER.superAdmin, id, { action: 'unlist' }), 'ILLEGAL_STATE_TRANSITION');
    const back = await db.expenses.updateAssetLoan(MEMBER.superAdmin, id, { action: 'return' });
    expect(back).toMatchObject({ loan_status: 'AVAILABLE', borrower_name: null, borrower_council: null, expected_return_date: null });
    expect(other).toBeGreaterThan(1);
    await expectRule(db.expenses.updateAssetLoan(MEMBER.superAdmin, 9999, { action: 'list' }), 'RECORD_NOT_FOUND');
  });
});

describe('the colour-coded calendar', () => {
  it('maps each event category to its mission area class', () => {
    const categories = [
      { id: 1, SupremeMissionArea: 'Faith' },
      { id: 2, SupremeMissionArea: 'Community' },
      { id: 3, SupremeMissionArea: null },
    ];
    expect(missionAreaOfCategoryId(1, categories)).toBe('Faith');
    expect(missionAreaOfCategoryId(2, categories)).toBe('Community');
    expect(missionAreaOfCategoryId(3, categories)).toBeNull();
    expect(missionAreaOfCategoryId(null, categories)).toBeNull();
    expect(MISSION_AREA_CALENDAR_CLASS).toEqual({
      Faith: 'calendar-mission-faith',
      Community: 'calendar-mission-community',
      Family: 'calendar-mission-family',
      Life: 'calendar-mission-life',
    });
  });

  it('paints Faith gold, Community blue, Family green and Life red, each readable', () => {
    expect(MISSION_AREA_COLORS.faith).toBe(BRAND.gold);
    expect(MISSION_AREA_COLORS.family).toBe(BRAND.green);
    expect(MISSION_AREA_COLORS.life).toBe(BRAND.red);
    expect(contrastRatio(BRAND.navy, MISSION_AREA_COLORS.faith)).toBeGreaterThanOrEqual(4.5);
    for (const c of [MISSION_AREA_COLORS.community, MISSION_AREA_COLORS.family, MISSION_AREA_COLORS.life]) {
      expect(contrastRatio(BRAND.white, c)).toBeGreaterThanOrEqual(4.5);
    }
    const css = read('apps/web/app/globals.css');
    for (const cls of Object.values(MISSION_AREA_CALENDAR_CLASS)) expect(css).toContain(`.${cls}`);
    const page = read('apps/web/app/calendar/page.tsx');
    expect(page).toContain('missionAreaOfCategoryId');
    expect(page).toContain('MISSION_AREA_CALENDAR_CLASS');
  });
});

describe('the portal pages', () => {
  const seat = (over: { memberType?: string; roles?: string[] } = {}) => ({
    memberId: 7,
    councilId: 1,
    memberType: (over.memberType ?? 'Member') as 'Member',
    isOfficer: (over.roles ?? []).length > 0,
    roles: over.roles ?? [],
  });

  it('opens the loaner library to every member from the Resources pillar', () => {
    expect(portalAreas(seat())).toContain('inventory/loaner-library');
    const resources = portalSidebar(seat()).find((g) => g.id === 'resources')!;
    expect(resources.entries.map((e) => e.item)).toContain('inventory/loaner-library');
    expect(navigationGuide(seat()).groups.some((g) => g.entries.some((e) => e.item === 'inventory/loaner-library'))).toBe(true);
    expect(read('apps/web/app/inventory/loaner-library/page.tsx')).toContain('LoanerLibraryDirectory');
    expect(read('apps/web/components/LoanerLibraryParts.tsx')).toContain('listLoanerLibrary');
  });

  it('puts the lending controls on the Grand Knight Desk', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).toContain('LoanerLibraryManager');
    expect(read('apps/web/components/LoanerLibraryParts.tsx')).toContain('updateAssetLoan');
  });

  it('draws the goals wheels and YOY trends on the Executive Dashboard', () => {
    const page = read('apps/web/app/executive-dashboard/page.tsx');
    expect(page).toContain('GoalsProgressCenter');
    expect(page).toContain('YearOverYearTrends');
    expect(read('apps/web/components/GoalsParts.tsx')).toContain('Annual Council Goals Progress Center');
    expect(read('apps/web/app/api/analytics/trends/route.ts')).toContain('yearOverYearTrends');
  });

  it('documents the sprint in the admin guide', () => {
    const guide = readOfficerManuals();
    expect(guide).toContain('Annual Council Goals Progress Center');
    expect(guide).toContain('Shared Equipment Library');
    expect(guide).toContain('Year-over-Year Trends');
  });
});
