// Sprints 8G/8H (schema version 78): the Fraternal Planning & Budgeting Workflow, the July 1 goals lock, bilateral
// council affiliations and the loaner library's dual feature flags.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  activeAffiliatePartners,
  assertAffiliationRequestable,
  assertBudgetVoteOpen,
  assertCouncilGoalsWritable,
  assertGoalsReviewable,
  budgetPlanningStatusOf,
  buildAffiliationDirectory,
  buildLoanerLibrary,
  buildPlanningWorkflow,
  BusinessRuleError,
  canOpenAffiliationsDesk,
  canRespondToAffiliation,
  canManageAffiliations,
  cleanDistrictNumber,
  councilGoalsLocked,
  distanceMiles,
  goalsPlanningStatusOf,
  planAffiliationResponse,
  planningDates,
  planningPhaseOf,
  portalAreas,
  visibleInLoanerLibrary,
  type Council,
  type CouncilAffiliations,
  type CouncilAssetsInventory,
  type DataService,
  type MemberWriteActor,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { openDatabases } from './shims/expo-sqlite';
import { drivers, expectRule, MEMBER, rawInsert, type DriverUnderTest } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

const code = (fn: () => unknown): string => {
  try {
    fn();
    return 'ok';
  } catch (err) {
    return err instanceof BusinessRuleError ? err.code : String(err);
  }
};

const writer = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({ memberId: 9, councilId: 1, memberType: 'Member', active: true, roles: [], ...over });

const portalUser = (memberType: 'Super Admin' | 'Admin' | 'Member', roles: string[] = [], councilId = 1) => ({
  memberId: 9,
  councilId,
  memberType,
  isOfficer: roles.length > 0,
  roles,
});

const council = (id: number, over: Partial<Council> = {}): Council =>
  ({ id, CouncilNumber: 1000 + id, CouncilName: `Council ${id}`, State: 'OR', ...over }) as Council;

const link = (id: number, from: number, to: number, status: CouncilAffiliations['status'], over: Partial<CouncilAffiliations> = {}): CouncilAffiliations => ({
  id,
  requesting_council_id: from,
  target_council_id: to,
  status,
  requested_at: `2026-09-0${id} 10:00:00`,
  ...over,
});

/** A driver whose clock reads `at` (the shared helpers fix 2026-09-20). */
async function makeAt(d: DriverUnderTest, at: Date): Promise<DataService> {
  const now = () => new Date(at);
  if (d.name === 'memory') {
    const db = new MemoryDataService({ now });
    await db.init();
    return db;
  }
  openDatabases.length = 0;
  const db = new SqliteDataService({ now });
  await db.init();
  return db;
}

describe('schema version 78', () => {
  it('adds the affiliation table, the council columns and budget_status, and bumps the phone database', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('(schema version 78)');
    expect(schema).toContain('ALTER TABLE [Council] ADD [is_loaner_library_enabled] INT NOT NULL DEFAULT 0;');
    expect(schema).toContain('ALTER TABLE [Council] ADD [district_number] INT NULL;');
    expect(schema).toContain('CREATE TABLE [CouncilAffiliations]');
    for (const col of ['requesting_council_id', 'target_council_id', 'status', 'date_established']) expect(schema).toContain(`[${col}]`);
    expect(schema).toContain("ALTER TABLE [CouncilGoals] ADD [budget_status] VARCHAR(20) NOT NULL DEFAULT 'DRAFT';");
    expect(schema).toContain("ALTER TABLE [CouncilBudgetForecast] ADD [budget_status] VARCHAR(20) NOT NULL DEFAULT 'DRAFT';");
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (7[8-9]|[8-9]\d);/);
    expect(read('docs/ARCHITECTURAL_HISTORY.md')).toContain('| 78 | 8G/8H |');
  });
});

describe('the planning workflow (pure)', () => {
  const Y = '2027-2028';
  it('runs Draft in May, Review in June, the lock on July 1 and the vote through July 10', () => {
    expect(planningDates(Y)).toEqual({ draftOpens: '2027-05-01', reviewOpens: '2027-06-01', lockDate: '2027-07-01', voteDeadline: '2027-07-10' });
    expect(planningPhaseOf(Y, new Date(2027, 3, 30, 23, 59))).toBe('NOT_OPEN');
    expect(planningPhaseOf(Y, new Date(2027, 4, 1))).toBe('DRAFT');
    expect(planningPhaseOf(Y, new Date(2027, 5, 1))).toBe('REVIEW');
    expect(planningPhaseOf(Y, new Date(2027, 6, 1))).toBe('VOTE');
    expect(planningPhaseOf(Y, new Date(2027, 6, 10, 23, 59))).toBe('VOTE');
    expect(planningPhaseOf(Y, new Date(2027, 6, 11))).toBe('CLOSED');
  });

  it('locks the goals for good from July 1, with no override', () => {
    expect(councilGoalsLocked(Y, new Date(2027, 5, 30, 23, 59))).toBe(false);
    expect(councilGoalsLocked(Y, new Date(2027, 6, 1))).toBe(true);
    expect(code(() => assertCouncilGoalsWritable(Y, new Date(2027, 5, 30)))).toBe('ok');
    expect(code(() => assertCouncilGoalsWritable(Y, new Date(2027, 6, 1)))).toBe('COUNCIL_GOALS_LOCKED');
    expect(goalsPlanningStatusOf({ budget_status: 'REVIEWED' }, Y, new Date(2027, 5, 2))).toBe('REVIEWED');
    expect(goalsPlanningStatusOf({ budget_status: 'DRAFT' }, Y, new Date(2027, 6, 1))).toBe('LOCKED');
    expect(goalsPlanningStatusOf(null, Y, new Date(2027, 4, 2))).toBe('DRAFT');
    expect(code(() => assertGoalsReviewable(null, Y, new Date(2027, 5, 2)))).toBe('INVALID_INPUT');
    expect(code(() => assertGoalsReviewable({ budget_status: 'REVIEWED' }, Y, new Date(2027, 5, 2)))).toBe('ILLEGAL_STATE_TRANSITION');
    expect(code(() => assertGoalsReviewable({ budget_status: 'DRAFT' }, Y, new Date(2027, 6, 2)))).toBe('COUNCIL_GOALS_LOCKED');
  });

  it('closes the budget vote after July 10 unless a Super Admin overrides', () => {
    expect(code(() => assertBudgetVoteOpen(Y, new Date(2027, 6, 10, 20), writer()))).toBe('ok');
    expect(code(() => assertBudgetVoteOpen(Y, new Date(2027, 6, 11), writer({ memberType: 'Admin' }), { superAdminOverride: true }))).toBe('BUDGET_VOTE_DEADLINE_PASSED');
    expect(code(() => assertBudgetVoteOpen(Y, new Date(2027, 6, 11), writer({ memberType: 'Super Admin' }), { superAdminOverride: true }))).toBe('ok');
  });

  it('reads the budget year status from its lines', () => {
    expect(budgetPlanningStatusOf([])).toBe('DRAFT');
    expect(budgetPlanningStatusOf([{ BudgetStatus: 'Proposed', budget_status: 'REVIEWED' }, { BudgetStatus: 'Proposed', budget_status: 'DRAFT' }])).toBe('DRAFT');
    expect(budgetPlanningStatusOf([{ BudgetStatus: 'Proposed', budget_status: 'REVIEWED' }])).toBe('REVIEWED');
    // A year approved before schema 78 has no LOCKED rows but still reads as locked.
    expect(budgetPlanningStatusOf([{ BudgetStatus: 'Approved', budget_status: 'DRAFT' }])).toBe('LOCKED');
  });

  it('builds the banner with the current step', () => {
    const june = buildPlanningWorkflow({ fraternalYear: Y, today: new Date(2027, 5, 10), goalsStatus: 'DRAFT', budgetStatus: 'REVIEWED' });
    expect(june.phase).toBe('REVIEW');
    expect(june.steps.map((s) => [s.key, s.state])).toEqual([
      ['DRAFT', 'done'],
      ['REVIEW', 'current'],
      ['LOCK', 'upcoming'],
      ['VOTE', 'upcoming'],
    ]);
    expect(june.goalsLocked).toBe(false);
    const july = buildPlanningWorkflow({ fraternalYear: Y, today: new Date(2027, 6, 3), goalsStatus: 'LOCKED', budgetStatus: 'REVIEWED' });
    expect(july.voteOpen).toBe(true);
    expect(july.steps.find((s) => s.key === 'VOTE')?.state).toBe('current');
    expect(july.headline).toContain('July 10');
    const voted = buildPlanningWorkflow({ fraternalYear: Y, today: new Date(2027, 6, 3), goalsStatus: 'LOCKED', budgetStatus: 'LOCKED' });
    expect(voted.voteOpen).toBe(false);
    expect(voted.steps.every((s) => s.state === 'done')).toBe(true);
  });
});

describe('bilateral affiliations (pure)', () => {
  const home = council(1, { meeting_latitude: 45.5231, meeting_longitude: -122.6765, district_number: 5 });

  it('measures miles between meeting points', () => {
    expect(distanceMiles({ latitude: 45.5231, longitude: -122.6765 }, { latitude: 45.5231, longitude: -122.6765 })).toBe(0);
    // Portland to Salem is about 44 miles as the crow flies.
    expect(distanceMiles({ latitude: 45.5231, longitude: -122.6765 }, { latitude: 44.9429, longitude: -123.0351 })).toBeCloseTo(44, 0);
  });

  it('lists same-state councils nearest first, then in district order', () => {
    const councils = [
      home,
      council(2, { meeting_latitude: 44.9429, meeting_longitude: -123.0351, district_number: 7 }), // Salem
      council(3, { meeting_latitude: 45.4312, meeting_longitude: -122.7715, district_number: 5 }), // Tigard
      council(4, { district_number: 5 }), // no point, same district
      council(5, { district_number: 2 }), // no point
      council(6, { State: 'WA', meeting_latitude: 45.6387, meeting_longitude: -122.6615 }), // Vancouver, WA
    ];
    const dir = buildAffiliationDirectory(home, councils, [link(1, 3, 1, 'ACTIVE', { date_established: '2026-08-14' }), link(2, 2, 1, 'PENDING')]);
    expect(dir.sortedByDistance).toBe(true);
    expect(dir.entries.map((e) => e.councilId)).toEqual([3, 2, 4, 5]);
    expect(dir.entries[0]).toMatchObject({ sameDistrict: true, link: { status: 'ACTIVE', direction: 'incoming', dateEstablished: '2026-08-14' } });
    expect(dir.incoming.map((e) => e.councilId)).toEqual([2]);

    const noPoint = buildAffiliationDirectory(council(1, { district_number: 5 }), councils, []);
    expect(noPoint.sortedByDistance).toBe(false);
    expect(noPoint.entries.map((e) => e.councilId)).toEqual([3, 4, 5, 2]);
    expect(noPoint.entries.every((e) => e.distanceMiles === null)).toBe(true);
  });

  it('takes invites inside the state, one open row per pair', () => {
    const rows = [link(1, 2, 1, 'DECLINED'), link(2, 1, 3, 'PENDING'), link(3, 4, 1, 'ACTIVE')];
    expect(code(() => assertAffiliationRequestable(council(1), council(2), rows))).toBe('ok'); // declined pairs may try again
    expect(code(() => assertAffiliationRequestable(council(3), council(1), rows))).toBe('AFFILIATION_CONFLICT');
    expect(code(() => assertAffiliationRequestable(council(1), council(4), rows))).toBe('AFFILIATION_CONFLICT');
    expect(code(() => assertAffiliationRequestable(council(1), council(5, { State: 'wa' }), rows))).toBe('AFFILIATION_OUT_OF_STATE');
    expect(code(() => assertAffiliationRequestable(council(1), council(5, { State: ' or ' }), rows))).toBe('ok');
    expect(code(() => assertAffiliationRequestable(council(1), council(1), rows))).toBe('INVALID_INPUT');
  });

  it('answers only a pending invite', () => {
    expect(planAffiliationResponse({ id: 1, status: 'PENDING' }, 'ACCEPT', '2026-09-20')).toEqual({ status: 'ACTIVE', date_established: '2026-09-20' });
    expect(planAffiliationResponse({ id: 1, status: 'PENDING' }, 'DECLINE', '2026-09-20')).toEqual({ status: 'DECLINED', date_established: null });
    expect(code(() => planAffiliationResponse({ id: 1, status: 'ACTIVE' }, 'ACCEPT', '2026-09-20'))).toBe('ILLEGAL_STATE_TRANSITION');
    expect(code(() => planAffiliationResponse({ id: 1, status: 'PENDING' }, 'MAYBE' as never, '2026-09-20'))).toBe('INVALID_INPUT');
  });

  it('keeps district numbers whole and in range', () => {
    expect(cleanDistrictNumber('')).toBeNull();
    expect(cleanDistrictNumber(null)).toBeNull();
    expect(cleanDistrictNumber(' 12 ')).toBe(12);
    expect(code(() => cleanDistrictNumber(0))).toBe('INVALID_INPUT');
    expect(code(() => cleanDistrictNumber(2.5))).toBe('INVALID_INPUT');
  });

  it('lets Admins, the GK and DGK send invites and only the GK seat answer them', () => {
    expect(canManageAffiliations(portalUser('Admin'), 1)).toBe(true);
    expect(canManageAffiliations(portalUser('Member', ['Grand Knight']), 1)).toBe(true);
    expect(canManageAffiliations(portalUser('Member', ['Deputy Grand Knight']), 1)).toBe(true);
    expect(canManageAffiliations(portalUser('Member', ['Treasurer']), 1)).toBe(false);
    expect(canManageAffiliations(portalUser('Admin'), 2)).toBe(false);
    expect(canManageAffiliations(portalUser('Super Admin'), 2)).toBe(true);
    expect(canRespondToAffiliation(portalUser('Admin'), 1)).toBe(false);
    expect(canRespondToAffiliation(portalUser('Member', ['Grand Knight']), 1)).toBe(true);
    expect(canRespondToAffiliation(portalUser('Member', ['Grand Knight'], 2), 1)).toBe(false);
    expect(canOpenAffiliationsDesk(portalUser('Member'))).toBe(false);
    expect(portalAreas(portalUser('Member', ['Grand Knight']))).toContain('system-settings/affiliations');
    expect(portalAreas(portalUser('Member'))).not.toContain('system-settings/affiliations');
  });
});

describe('the loaner library dual feature flags (pure)', () => {
  const asset = (id: number, councilId: number): CouncilAssetsInventory => ({
    id,
    council_id: councilId,
    asset_name: `Item ${id}`,
    purchase_date: '2024-01-01 00:00:00',
    cost_basis: 100,
    current_status: 'ACTIVE',
    is_loanable: 1,
    loan_status: 'AVAILABLE',
  });
  const councils = (homeOn: number, otherOn: number) => [council(1, { is_loaner_library_enabled: homeOn }), council(2, { is_loaner_library_enabled: otherOn }), council(3, { is_loaner_library_enabled: 1 })];

  it('shows a brother council item only to an ACTIVE affiliate when both councils share', () => {
    const partners = activeAffiliatePartners([link(1, 2, 1, 'ACTIVE'), link(2, 1, 3, 'PENDING')], 1);
    expect([...partners]).toEqual([2]);
    const viewer = { councilId: 1, partners };
    const ids = (homeOn: number, otherOn: number) => buildLoanerLibrary([asset(1, 1), asset(2, 2), asset(3, 3)], councils(homeOn, otherOn), '2026-09-20', viewer).map((e) => e.assetId);
    expect(ids(1, 1)).toEqual([1, 2]); // council 3 is only pending
    expect(ids(1, 0)).toEqual([1]);
    expect(ids(0, 1)).toEqual([1]);
    expect(ids(0, 0)).toEqual([1]); // own items always show
    const byId = new Map(councils(1, 1).map((c) => [c.id, c]));
    expect(visibleInLoanerLibrary(3, viewer, byId)).toBe(false);
    const entries = buildLoanerLibrary([asset(1, 1), asset(2, 2)], councils(1, 1), '2026-09-20', viewer);
    expect(entries.map((e) => e.homeCouncil)).toEqual([true, false]);
  });
});

describe.each(drivers)('planning, affiliations and shared loans in the $name driver', (d) => {
  it('locks the current year goals and plans the next', async () => {
    const db = await d.make(); // 2026-09-20
    await expectRule(
      db.reports.setCouncilGoals(MEMBER.superAdmin, 1, '2026-2027', { fundraising_target: 1 } as never),
      'COUNCIL_GOALS_LOCKED',
    );
    const locked = await db.reports.getCouncilGoals(MEMBER.admin, 1, '2026-2027');
    expect(locked).toMatchObject({ planningStatus: 'LOCKED', locked: true });

    await expectRule(db.reports.markCouncilGoalsReviewed(MEMBER.admin, 1, '2027-2028'), 'INVALID_INPUT');
    await db.reports.setCouncilGoals(MEMBER.admin, 1, '2027-2028', { fundraising_target: 30000 } as never);
    expect(await db.reports.getCouncilGoals(MEMBER.admin, 1, '2027-2028')).toMatchObject({ planningStatus: 'DRAFT', locked: false });
    await expectRule(db.reports.markCouncilGoalsReviewed(MEMBER.member, 1, '2027-2028'), 'GRAND_KNIGHT_REQUIRED');
    expect(await db.reports.markCouncilGoalsReviewed(MEMBER.admin, 1, '2027-2028')).toMatchObject({ budget_status: 'REVIEWED' });
    await expectRule(db.reports.markCouncilGoalsReviewed(MEMBER.admin, 1, '2027-2028'), 'ILLEGAL_STATE_TRANSITION');

    const july = await makeAt(d, new Date(2027, 6, 2, 9, 0, 0));
    await expectRule(july.reports.setCouncilGoals(MEMBER.superAdmin, 1, '2027-2028', { fundraising_target: 1 } as never), 'COUNCIL_GOALS_LOCKED');
    expect(await july.reports.getCouncilGoals(MEMBER.admin, 1, '2027-2028')).toMatchObject({ planningStatus: 'LOCKED', locked: true });
  });

  it('marks the budget reviewed in the window and locks it with the vote', async () => {
    const db = await makeAt(d, new Date(2027, 5, 10, 19, 0, 0));
    await expectRule(db.budget.markBudgetYearReviewed(MEMBER.admin, 1, '2027-2028'), 'INVALID_INPUT');
    await db.budget.addCustomBudgetLine(MEMBER.admin, 1, { FraternalYear: '2027-2028', LineItemName: 'Liability insurance', ProposedBudgetAmount: 1200 });
    await expectRule(db.budget.markBudgetYearReviewed(MEMBER.member, 1, '2027-2028'), 'ADMIN_REQUIRED');
    const reviewed = await db.budget.markBudgetYearReviewed(MEMBER.admin, 1, '2027-2028');
    expect(reviewed.lines.map((l) => l.budget_status)).toEqual(['REVIEWED']);
    expect(budgetPlanningStatusOf(reviewed.lines)).toBe('REVIEWED');
    await expectRule(db.budget.markBudgetYearReviewed(MEMBER.admin, 1, '2027-2028'), 'ILLEGAL_STATE_TRANSITION');
    const voted = await db.budget.approveAndFinalizeEntireBudget(MEMBER.admin, 1, '2027-2028');
    expect(voted.lines.map((l) => [l.BudgetStatus, l.budget_status])).toEqual([['Approved', 'LOCKED']]);
    await expectRule(db.budget.markBudgetYearReviewed(MEMBER.admin, 1, '2027-2028'), 'BUDGET_YEAR_APPROVED');

    const outside = await d.make(); // September: the 2027-2028 window is not open
    await outside.budget.addCustomBudgetLine(MEMBER.superAdmin, 1, { FraternalYear: '2027-2028', LineItemName: 'Hall rental', ProposedBudgetAmount: 300 }, { superAdminOverride: true });
    await expectRule(outside.budget.markBudgetYearReviewed(MEMBER.admin, 1, '2027-2028'), 'BUDGET_WINDOW_NOT_OPEN');
  });

  it('runs the handshake inside the state', async () => {
    const db = await d.make();
    const near = rawInsert(db, 'Council', { CouncilNumber: 2042, CouncilName: 'St. Anthony Council', State: 'OR', district_number: 5 });
    const far = rawInsert(db, 'Council', { CouncilNumber: 3112, CouncilName: 'Holy Redeemer Council', State: 'OR' });
    const wa = rawInsert(db, 'Council', { CouncilNumber: 4419, CouncilName: 'St. Patrick Council', State: 'WA' });

    const directory = await db.councils.listAffiliationDirectory(MEMBER.admin, 1);
    const ids = directory.entries.map((e) => e.councilId);
    expect(ids[0]).toBe(near); // the only council with a district number leads the district order
    expect(ids).toContain(far);
    expect(ids).not.toContain(wa);
    expect(directory.sortedByDistance).toBe(false);
    await expectRule(db.councils.listAffiliationDirectory(MEMBER.member, 1), 'GRAND_KNIGHT_REQUIRED');
    await expectRule(db.councils.listAffiliationDirectory(MEMBER.admin, near), 'COUNCIL_ACCESS_DENIED');

    const sent = await db.councils.requestAffiliation(MEMBER.admin, 1, near);
    expect(sent).toMatchObject({ requesting_council_id: 1, target_council_id: near, status: 'PENDING', requested_by_member_id: MEMBER.admin });
    expect(sent.date_established ?? null).toBeNull();
    await expectRule(db.councils.requestAffiliation(MEMBER.admin, 1, near), 'AFFILIATION_CONFLICT');
    await expectRule(db.councils.requestAffiliation(MEMBER.superAdmin, near, 1), 'AFFILIATION_CONFLICT');
    await expectRule(db.councils.requestAffiliation(MEMBER.admin, 1, wa), 'AFFILIATION_OUT_OF_STATE');
    await expectRule(db.councils.requestAffiliation(MEMBER.admin, 1, 1), 'INVALID_INPUT');
    await expectRule(db.councils.requestAffiliation(MEMBER.member, 1, far), 'GRAND_KNIGHT_REQUIRED');
    await expectRule(db.councils.requestAffiliation(MEMBER.admin, 1, 9999), 'RECORD_NOT_FOUND');

    // The target council's Grand Knight answers; council 1's Admin cannot.
    await expectRule(db.councils.respondToAffiliation(MEMBER.admin, sent.id, 'ACCEPT'), 'GRAND_KNIGHT_REQUIRED');
    const accepted = await db.councils.respondToAffiliation(MEMBER.superAdmin, sent.id, 'ACCEPT');
    expect(accepted).toMatchObject({ status: 'ACTIVE', date_established: '2026-09-20', responded_by_member_id: MEMBER.superAdmin });
    await expectRule(db.councils.respondToAffiliation(MEMBER.superAdmin, sent.id, 'DECLINE'), 'ILLEGAL_STATE_TRANSITION');
    await expectRule(db.councils.respondToAffiliation(MEMBER.superAdmin, 9999, 'ACCEPT'), 'RECORD_NOT_FOUND');

    const invite = await db.councils.requestAffiliation(MEMBER.superAdmin, far, 1);
    const after = await db.councils.listAffiliationDirectory(MEMBER.admin, 1);
    expect(after.incoming.map((e) => [e.councilId, e.link?.affiliationId])).toEqual([[far, invite.id]]);
    expect(after.entries.find((e) => e.councilId === near)?.link).toMatchObject({ status: 'ACTIVE', direction: 'outgoing' });
    expect(d.count(db, 'CouncilAffiliations')).toBe(2);
  });

  it('shares a brother council item only when both councils switch the library on', async () => {
    const db = await d.make();
    const other = rawInsert(db, 'Council', { CouncilNumber: 2042, CouncilName: 'St. Anthony Council', State: 'OR' });
    const own = rawInsert(db, 'CouncilAssetsInventory', { council_id: 1, asset_name: 'PA system', purchase_date: '2024-01-01 00:00:00', cost_basis: 900, current_status: 'ACTIVE', is_loanable: 1 });
    const theirs = rawInsert(db, 'CouncilAssetsInventory', { council_id: other, asset_name: 'Griddle', purchase_date: '2024-01-01 00:00:00', cost_basis: 800, current_status: 'ACTIVE', is_loanable: 1 });
    const seen = async () => (await db.expenses.listLoanerLibrary(MEMBER.member)).map((e) => e.assetId);

    expect((await db.councils.get(1))?.is_loaner_library_enabled).toBe(0);
    expect(await seen()).toEqual([own]);
    const invite = await db.councils.requestAffiliation(MEMBER.admin, 1, other);
    await db.councils.respondToAffiliation(MEMBER.superAdmin, invite.id, 'ACCEPT');
    expect(await seen()).toEqual([own]); // affiliated, but neither council shares yet

    await expectRule(db.councils.setLoanerLibraryEnabled(MEMBER.member, 1, true), 'ADMIN_REQUIRED');
    await expectRule(db.councils.setLoanerLibraryEnabled(MEMBER.admin, other, true), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.councils.setLoanerLibraryEnabled(MEMBER.admin, 1, 1 as never), 'INVALID_INPUT');
    expect(await db.councils.setLoanerLibraryEnabled(MEMBER.admin, 1, true)).toMatchObject({ is_loaner_library_enabled: 1 });
    expect(await seen()).toEqual([own]); // the other council still has it off
    await db.councils.setLoanerLibraryEnabled(MEMBER.superAdmin, other, true);
    const both = await db.expenses.listLoanerLibrary(MEMBER.member);
    expect(both.map((e) => [e.assetId, e.homeCouncil]).sort((a, b) => Number(a[0]) - Number(b[0]))).toEqual([
      [own, true],
      [theirs, false],
    ]);
    await db.councils.setLoanerLibraryEnabled(MEMBER.admin, 1, false);
    expect(await seen()).toEqual([own]);
  });

  it('keeps a council with affiliation rows from being deleted', async () => {
    const db = await d.make();
    const other = rawInsert(db, 'Council', { CouncilNumber: 2042, CouncilName: 'St. Anthony Council', State: 'OR' });
    await db.councils.requestAffiliation(MEMBER.admin, 1, other);
    await expectRule(db.councils.remove(MEMBER.superAdmin, other), 'RECORD_IN_USE');
  });
});

describe('the portal pages', () => {
  it('leads Council Wide Settings with the planning banner and the sharing switch', () => {
    const page = read('apps/web/app/system-settings/council-settings/page.tsx');
    expect(page).toContain('FraternalPlanningWorkflow');
    expect(page).toContain('LoanerLibrarySharingCard');
    const parts = read('apps/web/components/PlanningWorkflowParts.tsx');
    expect(parts).toContain('markCouncilGoalsReviewed');
    expect(parts).toContain('markBudgetYearReviewed');
    expect(parts).toContain('GoalTargetBlocks');
    expect(read('apps/web/components/GoalsParts.tsx')).toContain('p.locked');
  });

  it('serves the affiliations desk and answers invites on the Grand Knight Desk', () => {
    expect(read('apps/web/app/system-settings/affiliations/page.tsx')).toContain('area="system-settings/affiliations"');
    const parts = read('apps/web/components/AffiliationsParts.tsx');
    expect(parts).toContain('requestAffiliation');
    expect(parts).toContain('respondToAffiliation');
    expect(read('apps/web/components/DashboardDesks.tsx')).toContain('IncomingAffiliationInvites');
    expect(read('apps/web/components/Sidebar.tsx')).toContain("'system-settings/affiliations'");
    expect(read('apps/web/app/councils/page.tsx')).toContain('district_number');
  });

  it('documents the sprint in the admin guide', () => {
    const guide = read('docs/ADMIN_USER_GUIDE.md');
    expect(guide).toContain('Fraternal Planning & Budgeting Workflow');
    expect(guide).toContain('Bilateral Fraternal Affiliations');
    expect(guide).toContain('July 10');
  });
});
