// Sprint 8C (schema version 75): the Council Dashboard rename, the Reports Desk merged into Home, the Deputy Grand Knight's
// full parity with the Grand Knight, the left-nav cleanup, the click-through desk badges and the Member Desk cards.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DESK_DRAWERS,
  deskDrawersFor,
  canAppointOfficers,
  canEditLiveAgenda,
  canManageAgendaTemplates,
  canManageCouncilCadence,
  canOpenCouncilLookups,
  canOpenExpenseAuthorizeDesk,
  canReviewVolunteerQuarantine,
  DASHBOARD_TABS,
  dashboardTabsFor,
  DESK_FOCUS_TARGETS,
  EXECUTIVE_DASHBOARD_HREF,
  expenseCounterSignBlock,
  GRAND_KNIGHT_AUTHORITY_ROLE_NAMES,
  holdsGrandKnightAuthority,
  holdsGrandKnightSeat,
  mayAppointOfficers,
  mayAuthorizeExpenseOrder,
  mayConcludeFraternalYear,
  mayEditLiveAgenda,
  mayManageAgendaTemplates,
  mayManageMeetingGeofence,
  MEMBER_DESK_OPEN_SHIFT_DAYS,
  memberDeskOpenShifts,
  navigationGuide,
  PORTAL_NAV_GROUPS,
  portalAreas,
  portalSidebar,
  type DataService,
  type ShiftFeedItem,
} from '@kofc/shared';
import type { MemoryDataService } from '../apps/web/services/drivers/memory';
import { drivers, MEMBER, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';
import { readOfficerManuals } from './support/officer-manuals';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const OTHER = 2;

const seat = (over: { memberType?: 'Member' | 'Admin' | 'Super Admin'; roles?: string[]; councilId?: number; isOfficer?: boolean } = {}) => ({
  memberId: 7,
  councilId: over.councilId ?? OWN,
  memberType: over.memberType ?? ('Member' as const),
  isOfficer: over.isOfficer ?? (over.roles ?? []).length > 0,
  roles: over.roles ?? [],
});

const actor = (over: { roles?: string[]; councilId?: number; active?: boolean; memberId?: number } = {}) => ({
  memberId: over.memberId ?? 7,
  councilId: over.councilId ?? OWN,
  memberType: 'Member',
  active: over.active ?? true,
  roles: over.roles ?? [],
  officer: true,
});

const GK = seat({ roles: ['Grand Knight'] });
const DGK = seat({ roles: ['Deputy Grand Knight'] });

describe('schema version 75', () => {
  it('records the no-table-change version and bumps the phone database', () => {
    expect(read('Schema.sql')).toContain('(schema version 75)');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (7[5-9]|[8-9]\d);/);
    expect(read('docs/ARCHITECTURAL_HISTORY.md')).toContain('| 75 | 8C |');
  });
});

describe('the Council Dashboard rename', () => {
  it('names the old Shared Member Center the Council Dashboard on the web and the phone', () => {
    expect(read('apps/web/components/Sidebar.tsx')).toContain("label: 'Council Dashboard'");
    expect(read('apps/web/app/member-center/page.tsx')).toMatch(/>\s*Council Dashboard\s*</);
    expect(read('apps/mobile/app/(app)/member-center.tsx')).toMatch(/>\s*Council Dashboard\s*</);
    expect(read('apps/mobile/app/(app)/index.tsx')).toContain('<Section title="Council Dashboard">');
    expect(read('apps/mobile/app/(app)/_layout.tsx')).toContain("tab('Council Dashboard')");
    for (const path of [
      'apps/web/components/Sidebar.tsx',
      'apps/web/app/member-center/page.tsx',
      'apps/web/components/DashboardDesks.tsx',
      'apps/mobile/app/(app)/index.tsx',
      'apps/mobile/app/(app)/member-center.tsx',
      'apps/mobile/app/(app)/_layout.tsx',
    ]) {
      // Only history notes may still name it.
      expect(read(path).replace(/named the Shared Member Center until Sprint 8C|the Shared Member Center until Sprint 8C/g, '')).not.toMatch(/Shared Member Center|Member Center\b/);
    }
  });

  it('keeps the guides on the new name', () => {
    for (const text of [readOfficerManuals(), read('docs/MEMBER_USER_GUIDE.md')]) {
      expect(text).toContain('Council Dashboard');
      expect(text).not.toContain('Shared Member Center');
      expect(text).not.toContain('Reports Desk');
      // The page keeps its own title; only the sidebar path is gone.
      expect(text).not.toContain('Sidebar → Finances → **Leadership Auditing Queue**');
    }
    const admin = readOfficerManuals();
    expect(admin).toContain('**[ 🚗 Open Shifts Needing Volunteers ]**');
    expect(admin).toContain('**[ 📥 My Charity Requests ]**');
    expect(admin).toContain('**Canonization Rank Benchmarks** card');
    expect(admin).toContain('The Deputy Grand Knight (DGK) has the same access as the Grand Knight (GK).');
  });
});

describe('the Reports Desk merged into Home', () => {
  it('drops the Reports Desk tab for every reader', () => {
    expect(DASHBOARD_TABS.map((t) => t.id)).not.toContain('reports');
    for (const u of [GK, DGK, seat({ memberType: 'Admin' }), seat({ memberType: 'Super Admin' }), seat({ roles: ['Treasurer'] })]) {
      expect(dashboardTabsFor(u, OWN).map((t) => t.id)).not.toContain('reports');
    }
  });

  // Sprint 8D/8E moved the Executive Summary off Home onto its own page (/executive-dashboard).
  it('keeps the Executive Summary - charts, ledger table and budget tracking - whole on the Executive Dashboard page', () => {
    const page = read('apps/web/app/executive-dashboard/page.tsx');
    expect(page).toContain('<ExecutiveSummary councilId={scope.councilId} />');
    expect(read('apps/web/app/dashboard/page.tsx')).not.toContain('<ExecutiveSummary');
    const summary = page.slice(page.indexOf('function ExecutiveSummary('));
    for (const part of ['<Scorecards s={s} compact />', '<EngagementCards', '<BudgetTracking', '<MissionTracking', 'title="Financial ledger"', '<NoShowAudit']) expect(summary).toContain(part);
    // Sprint 8P Stage 3: the Shifts Awaiting Hours audit is back here for every executive-audit reader.
    expect(page).toContain('<AwaitingHours councilId={councilId} />');
    expect(page).not.toContain("shown === 'reports'");
  });

  // Sprint 8D/8E: the link opens the Executive Summary's own page instead of resetting the Active Desks to Home.
  it('points the sidebar Executive Dashboard link at the Executive Summary page', () => {
    expect(EXECUTIVE_DASHBOARD_HREF).toBe('/executive-dashboard');
    const sidebar = read('apps/web/components/Sidebar.tsx');
    expect(sidebar).toContain('href: EXECUTIVE_DASHBOARD_HREF');
    expect(sidebar).not.toContain('<DeskLink anchor="home"');
  });
});

describe("the Deputy Grand Knight's full parity with the Grand Knight", () => {
  it('names both seats as holding the Grand Knight authority', () => {
    expect(GRAND_KNIGHT_AUTHORITY_ROLE_NAMES).toEqual(['Grand Knight', 'Deputy Grand Knight']);
    expect(holdsGrandKnightAuthority(['Deputy Grand Knight'])).toBe(true);
    expect(holdsGrandKnightAuthority(['Treasurer', 'Recorder'])).toBe(false);
    expect(holdsGrandKnightSeat(DGK)).toBe(true);
  });

  it('opens every Grand Knight screen to the Deputy Grand Knight of the same council', () => {
    for (const u of [GK, DGK]) {
      expect(canOpenExpenseAuthorizeDesk(u, OWN)).toBe(true);
      expect(canManageAgendaTemplates(u, OWN)).toBe(true);
      expect(canManageCouncilCadence(u, OWN)).toBe(true);
      expect(canOpenCouncilLookups(u)).toBe(true);
      expect(canAppointOfficers(u)).toBe(true);
      expect(canEditLiveAgenda(u, { CouncilID: OWN })).toBe(true);
      expect(canReviewVolunteerQuarantine(u, OWN)).toBe(true);
      expect(portalAreas(u)).toEqual(expect.arrayContaining(['expenses/authorize', 'meetings/cadence', 'elections/appointments', 'council-lookups']));
      expect(dashboardTabsFor(u, OWN).map((t) => t.id)).toEqual(['home', 'grand-knight', 'member']);
    }
    // Parity stops at the council line.
    expect(canOpenExpenseAuthorizeDesk(seat({ roles: ['Deputy Grand Knight'], councilId: OTHER }), OWN)).toBe(false);
    expect(canManageAgendaTemplates(seat({ roles: ['Deputy Grand Knight'], councilId: OTHER }), OWN)).toBe(false);
    // The same sidebar as the Grand Knight.
    expect(portalSidebar(DGK)).toEqual(portalSidebar(GK));
  });

  it('lets the Deputy Grand Knight sign, appoint, conclude, keep agendas and set the meeting check-in', () => {
    const dgk = actor({ roles: ['Deputy Grand Knight'] });
    expect(mayAuthorizeExpenseOrder(dgk, OWN)).toBe(true);
    expect(mayAppointOfficers(dgk, OWN, 99)).toBe(true);
    expect(mayConcludeFraternalYear(dgk, OWN, 99)).toBe(true);
    expect(mayManageAgendaTemplates(dgk, OWN)).toBe(true);
    expect(mayEditLiveAgenda(dgk, { id: 1, CouncilID: OWN })).toBe(true);
    expect(mayManageMeetingGeofence(dgk, OWN)).toBe(true);
    for (const outside of [actor({ roles: ['Deputy Grand Knight'], councilId: OTHER }), actor({ roles: ['Deputy Grand Knight'], active: false })]) {
      expect(mayAuthorizeExpenseOrder(outside, OWN)).toBe(false);
      expect(mayAppointOfficers(outside, OWN, 99)).toBe(false);
      expect(mayConcludeFraternalYear(outside, OWN, 99)).toBe(false);
      expect(mayManageMeetingGeofence(outside, OWN)).toBe(false);
    }
    // A Treasurer still holds none of it.
    const treasurer = actor({ roles: ['Treasurer'] });
    expect([mayAuthorizeExpenseOrder(treasurer, OWN), mayAppointOfficers(treasurer, OWN, 99), mayManageMeetingGeofence(treasurer, OWN)]).toEqual([false, false, false]);
  });

  it('keeps the separation-of-duties guards: never their own sheet, never one they ordered or coded', () => {
    const sheet = { CouncilID: OWN, SubmitterMemberID: 50, FinancialSecretaryMemberID: 51, TreasurerMemberID: 52 };
    expect(expenseCounterSignBlock(DGK, sheet)).toBeNull();
    expect(expenseCounterSignBlock(DGK, { ...sheet, SubmitterMemberID: DGK.memberId })).toBe('own-report');
    expect(expenseCounterSignBlock(DGK, { ...sheet, FinancialSecretaryMemberID: DGK.memberId })).toBe('collusion');
    expect(expenseCounterSignBlock(DGK, { ...sheet, TreasurerMemberID: DGK.memberId })).toBe('collusion');
  });
});

/** Seats `memberId` as the Deputy Grand Knight in the driver's own store. */
function grantRole(d: DriverUnderTest, db: DataService, memberId: number, role: string): void {
  if (d.name === 'memory') {
    const store = (db as MemoryDataService).debugStore;
    store.insert('MemberRoles', { RoleID: store.rows('Role').find((r) => r.Role === role)!.id, MemberID: memberId });
  } else {
    openDatabases.at(-1)!.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) SELECT [id], ? FROM [Role] WHERE [Role] = ?').run(memberId, role);
  }
}

describe.each(drivers)('Deputy Grand Knight parity ($name)', (d) => {
  it('sets the meeting check-in and PIN and reads the Grand Knight Authorization Desk', async () => {
    const db = await d.make();
    grantRole(d, db, MEMBER.member, 'Deputy Grand Knight');
    const fence = await db.councils.setMeetingGeofence(MEMBER.member, OWN, { radiusMeters: 120, pinToken: '4821' });
    expect(fence).toMatchObject({ radiusMeters: 120 });
    expect(Array.isArray(await db.expenses.listAuthorizationQueue(MEMBER.member, OWN))).toBe(true);
    expect(await db.councils.setDuesRate(MEMBER.member, OWN, 44)).toMatchObject({ id: OWN, base_dues_rate: 44 });
  });
});

describe('the left navigation cleanup', () => {
  it('removes the Leadership Auditing Queue from every sidebar but keeps its page for its readers', () => {
    expect(PORTAL_NAV_GROUPS.flatMap((g) => g.items as string[])).not.toContain('expenses/queue');
    const admin = seat({ memberType: 'Admin' });
    expect(portalAreas(admin)).toContain('expenses/queue');
    expect(portalSidebar(admin).flatMap((g) => g.entries.map((e) => e.item as string))).not.toContain('expenses/queue');
    expect(navigationGuide(admin).groups.flatMap((g) => g.entries.map((e) => e.item as string))).not.toContain('expenses/queue');
    // Sprint 8P Stage 2: the Financial Secretary Desk opens it in place as the ER Routing Track drawer.
    expect(DESK_DRAWERS.find((d) => d.id === 'er-routing-track')).toMatchObject({ desk: 'financial-secretary', area: 'expenses/queue' });
    expect(read('apps/web/components/DashboardDesks.tsx')).toContain('<ExpenseRoutingTrack />');
  });

  it('locks the Inbound Council Mail Center drawer to global Super Admins', () => {
    // Sprint 8P Stage 3: a Grand Knight Desk drawer gated 'super-admin'.
    expect(DESK_DRAWERS.find((d) => d.id === 'access-requests')).toMatchObject({ desk: 'grand-knight', gate: 'super-admin' });
    expect(deskDrawersFor(seat({ memberType: 'Admin' }), 'grand-knight', OWN).map((d) => d.id)).not.toContain('access-requests');
    expect(deskDrawersFor(seat({ memberType: 'Super Admin' }), 'grand-knight', OWN).map((d) => d.id)).toContain('access-requests');
  });
});

describe('the click-through desk badges', () => {
  it('names an Active Desk and a workspace row for every badge', () => {
    const tabIds = DASHBOARD_TABS.map((t) => t.anchor);
    for (const [key, target] of Object.entries(DESK_FOCUS_TARGETS)) {
      expect(tabIds, key).toContain(target.anchor);
      expect(target.rowId).toMatch(/^desk-row-/);
    }
    expect(DESK_FOCUS_TARGETS.vouchers.anchor).toBe('grand-knight');
    // Sprint 8P Stage 3: the Oversight Desk is dissolved; its audits are Grand Knight Desk drawers.
    expect(DESK_FOCUS_TARGETS.quarantine.anchor).toBe('grand-knight');
    expect(DESK_FOCUS_TARGETS.hours.anchor).toBe('grand-knight');
    expect(DESK_FOCUS_TARGETS.access.anchor).toBe('grand-knight');
    expect(new Set(Object.values(DESK_FOCUS_TARGETS).map((t) => t.rowId)).size).toBe(Object.keys(DESK_FOCUS_TARGETS).length);
  });

  it('draws every row target on its desk and passes it through the badge link', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    // Sprint 8P Stage 2: the GK and FS targets are drawer handles (desk-drawers.ts), whose rows the blotter draws.
    const drawerRows = new Set(DESK_DRAWERS.map((d) => d.rowId));
    for (const [key, target] of Object.entries(DESK_FOCUS_TARGETS)) {
      if (drawerRows.has(target.rowId)) continue;
      expect(desks).toContain(`<DeskRow id={DESK_FOCUS_TARGETS.${key}.rowId}`);
    }
    expect(drawerRows).toContain(DESK_FOCUS_TARGETS.vouchers.rowId);
    expect(drawerRows).toContain(DESK_FOCUS_TARGETS.orders.rowId);
    expect(read('apps/web/components/DeskDrawers.tsx')).toContain('<DeskRow id={spec.rowId}');
    const tabs = read('apps/web/components/WorkspaceTabs.tsx');
    expect(tabs).toContain('if (rowId) focusDeskRow(rowId);');
    expect(tabs).toContain('row.scrollIntoView(');
  });

  it('dissolves the Oversight Desk into Grand Knight Desk drawers, the quarantine staying with its reviewers (Sprint 8P Stage 3)', () => {
    expect(DASHBOARD_TABS.map((t) => t.id as string)).not.toContain('oversight');
    const gkDrawers = deskDrawersFor(seat({ roles: ['Grand Knight'] }), 'grand-knight', OWN).map((d) => d.id);
    expect(gkDrawers).toEqual(expect.arrayContaining(['flagged-hours', 'shifts-awaiting-hours']));
    expect(gkDrawers).not.toContain('access-requests');
    expect(canReviewVolunteerQuarantine(seat({ roles: ['Treasurer'] }), OWN)).toBe(false);
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).toContain('<AwaitingHours councilId={councilId} />');
    expect(desks).toContain('<FlaggedHoursDrawer user={user} councilId={councilId} />');
  });
});

const feedItem = (id: number, date: string, signed: number, min: number, over: Partial<ShiftFeedItem> = {}): ShiftFeedItem =>
  ({
    shift: { id, ShiftName: `Lot attendants ${id}`, ShiftDate: date, MinNumberVolunteers: min, NumberVolunteersSignedUp: signed, IsAllHands: 0 },
    event: { id: 9, EventName: 'Parish Parking Event' },
    councilIds: [OWN],
    isSignedUp: false,
    ...over,
  }) as unknown as ShiftFeedItem;

describe('the Member Desk cards', () => {
  it('lists the short-handed shifts in the next 30 days the member does not hold yet', () => {
    expect(MEMBER_DESK_OPEN_SHIFT_DAYS).toBe(30);
    const feed = [
      feedItem(1, '2026-10-10', 0, 2), // past
      feedItem(2, '2026-10-17', 1, 2), // short by one
      feedItem(3, '2026-10-18', 2, 2), // full
      feedItem(4, '2026-10-24', 0, 2, { isSignedUp: true }), // already theirs
      feedItem(5, '2026-10-25', 0, 2),
      feedItem(6, '2026-12-01', 0, 2), // beyond 30 days
    ];
    expect(memberDeskOpenShifts(feed, '2026-10-12').map((i) => i.shift.id)).toEqual([2, 5]);
  });

  it('shows the open shifts card with one-click sign-up and the charity requests card with its tracking steps', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).toContain('[ 🚗 Open Shifts Needing Volunteers ]');
    expect(desks).toContain('db.events.signupForShift(user.memberId, shiftId)');
    expect(desks).toContain('[ 📥 My Charity Requests ]');
    expect(desks).toContain('db.charities.listMyCharitableRequests(user.memberId)');
    expect(desks).toContain('<TrackingSteps request={request} />');
    expect(desks).toContain('{flags.flag_charity_proposals ? <MyCharityRequestsCard user={user} /> : null}');
  });

  it('shows the Canonization Rank benchmarks read-only outside System Settings', () => {
    const engagement = read('apps/web/components/EngagementParts.tsx');
    const cards = engagement.slice(engagement.indexOf('export function EngagementCards('));
    expect(cards).toContain('<RankThresholdsInfo council={council.data} />');
    expect(cards).not.toContain('<ThresholdEditor');
    expect(cards).not.toContain('setRankThresholds');
    const settings = read('apps/web/app/system-settings/council-settings/page.tsx');
    expect(settings).toContain('<RankThresholdsCard council={council}');
    // No other page edits them.
    for (const path of ['apps/web/app/dashboard/page.tsx', 'apps/web/app/member-center/page.tsx', 'apps/web/components/DashboardDesks.tsx']) {
      expect(read(path)).not.toMatch(/RankThresholdsCard|setRankThresholds/);
    }
  });
});
