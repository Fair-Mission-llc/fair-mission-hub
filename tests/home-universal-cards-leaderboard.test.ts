// Sprint 8D/8E (schema version 76): Home keeps only the universal cards, the desk status badges move to the Oversight
// Desk, the Executive Summary moves to its own /executive-dashboard page, and the month's Top 5 Fraternal Volunteers.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCouncilEngagement,
  COUNCIL_HISTORIAN_ROLE,
  EXECUTIVE_DASHBOARD_HREF,
  HOME_UNIVERSAL_CARDS,
  LEADERBOARD_SIZE,
  navigationGuide,
  portalAreas,
  portalSidebar,
  type ServiceLogRow,
} from '@kofc/shared';
import { drivers, MEMBER } from './helpers';
import { readOfficerManuals } from './support/officer-manuals';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;

const seat = (over: { memberType?: 'Member' | 'Admin' | 'Super Admin'; roles?: string[] } = {}) => ({
  memberId: 7,
  councilId: OWN,
  memberType: over.memberType ?? ('Member' as const),
  isOfficer: (over.roles ?? []).length > 0,
  roles: over.roles ?? [],
});

const sidebarItems = (u: ReturnType<typeof seat>) => portalSidebar(u).flatMap((g) => g.entries.map((e) => e.item));

describe('schema version 76', () => {
  it('records the no-table-change version and bumps the phone database', () => {
    expect(read('Schema.sql')).toContain('(schema version 76)');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (7[6-9]|[8-9]\d|\d{3});/);
    expect(read('docs/ARCHITECTURAL_HISTORY.md')).toContain('| 76 | 8D/8E |');
  });
});

describe("the month's Top 5 Fraternal Volunteers (pure)", () => {
  const log = (MemberID: number, Hours: number, date: string): ServiceLogRow => ({ MemberID, Hours, date, eventId: 1 });
  const members = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({
    id,
    CouncilID: id === 7 ? 2 : 1,
    StatusID: id === 6 ? 3 : 1,
    MemberFirstName: `F${id}`,
    MemberLastName: `L${id}`,
  }));
  const logs = [
    log(1, 40, '2026-08-15'), // all-time leader, nothing this month
    log(2, 6, '2026-09-02'),
    log(3, 6, '2026-09-03'),
    log(4, 3, '2026-09-10'),
    log(4, 1.5, '2026-09-29'),
    log(5, 2, '2026-09-30'),
    log(8, 1, '2026-09-01'),
    log(8, 0.25, '2026-09-01'),
    log(1, 0.5, '2026-09-11'),
    log(6, 50, '2026-09-04'), // Former member: never ranked
    log(7, 60, '2026-09-05'), // another council's member who served here: never ranked
    log(5, 9, '2026-10-01'), // next month
  ];
  const card = buildCouncilEngagement({ councilId: 1, year: 2026, month: 9, fromDate: '2026-09-01', toDate: '2026-09-30', logs, members, activeStatusId: 1 });

  it("ranks the council's Active members by the month's hours only, five at most, ties sharing a rank", () => {
    expect(card.monthlyLeaderboard.map((l) => [l.rank, l.memberId, l.hours])).toEqual([
      [1, 2, 6],
      [1, 3, 6],
      [3, 4, 4.5],
      [4, 5, 2],
      [5, 8, 1.25],
    ]);
    expect(card.monthlyLeaderboard).toHaveLength(LEADERBOARD_SIZE);
    expect(card.monthlyLeaderboard[0]).toMatchObject({ firstName: 'F2', lastName: 'L2' });
  });

  it('leaves the all-time leaderboard unchanged beside it', () => {
    expect(card.leaderboard[0]).toMatchObject({ rank: 1, memberId: 1, hours: 40.5 });
    expect(card.leaderboard.map((l) => l.memberId)).not.toContain(6);
    expect(card.leaderboard.map((l) => l.memberId)).not.toContain(7);
  });

  it('is empty for a month nobody served', () => {
    const quiet = buildCouncilEngagement({ councilId: 1, year: 2026, month: 7, fromDate: '2026-07-01', toDate: '2026-07-31', logs, members, activeStatusId: 1 });
    expect(quiet.monthlyLeaderboard).toEqual([]);
    expect(quiet.leaderboard.length).toBeGreaterThan(0);
  });
});

describe.each(drivers)('the monthly leaderboard from the database ($name driver)', ({ make }) => {
  it("ranks the month's logged hours from the time ledgers", async () => {
    const db = await make();
    await db.activityTime.logHours(MEMBER.member, 1, 2, '2026-09-19');
    const card = await db.reports.councilEngagement(MEMBER.admin, OWN, 2026, 9);
    expect(card.monthlyLeaderboard.length).toBeLessThanOrEqual(LEADERBOARD_SIZE);
    expect(card.monthlyLeaderboard.find((l) => l.memberId === MEMBER.member)?.hours).toBeGreaterThanOrEqual(2);
    const hours = card.monthlyLeaderboard.map((l) => l.hours);
    expect(hours).toEqual([...hours].sort((a, b) => b - a));
    // A month with no logs ranks nobody.
    expect((await db.reports.councilEngagement(MEMBER.admin, OWN, 2019, 1)).monthlyLeaderboard).toEqual([]);
  });
});

describe('Home holds only the universal cards', () => {
  it('names the seven read-only cards in display order (Sprint 8S: reminders and prayers back, read only)', () => {
    expect(HOME_UNIVERSAL_CARDS).toEqual([
      'Latest Council Newsletters & Bulletins', // Sprint 8Q
      'Bible Verse of the Day',
      'Live Actionable Reminders',
      'Liturgical Feast Day Tracker',
      'Upcoming Event Agenda',
      'Top 5 Fraternal Volunteers',
      'Community Prayer Request List',
    ]);
  });

  it('renders the seven cards and nothing else in the Home grid', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    const grid = desks.slice(desks.indexOf('export function HomeWidgets('), desks.indexOf('// ---- the Officer Desks'));
    const rendered = [...grid.matchAll(/<([A-Z]\w+) /g)].map((m) => m[1]);
    // Sprint 10 Revision 4.0: an open Advisory Panel invitation leads Home; it renders nothing without one.
    expect(rendered).toEqual(['AdvisoryInviteCard', 'LatestBulletinsFeed', 'VerseOfTheDay', 'ReminderStream', 'FeastDayTracker', 'UpcomingEventAgenda', 'TopVolunteersCard', 'CommunityPrayerCard']);
    // Sprint 8P Stage 1: wide tiles - two across, three across on very wide screens with the faith cards.
    expect(grid).toContain("faithOn ? '2xl:grid-cols-3' : '2xl:grid-cols-2'");
    expect(desks).toContain('title={`Top ${LEADERBOARD_SIZE} Fraternal Volunteers`}');
    // Sprint 8P Stage 1: no fixed height and no inner scroll; the card grows and the page scrolls.
    const card = desks.slice(desks.indexOf('function HomeCard('), desks.indexOf('const shortDay'));
    expect(card).toContain('min-h-80');
    expect(card).not.toMatch(/ h-60 |overflow-y-auto/);
  });

  it('builds the leaderboard card in high contrast from the monthly ledger read', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    const card = desks.slice(desks.indexOf('function TopVolunteersCard('), desks.indexOf('export function HomeWidgets('));
    expect(card).toContain('db.reports.councilEngagement(user.memberId, councilId, year, month)');
    expect(card).toContain('monthlyLeaderboard');
    expect(card).toContain('tone="navy"');
    expect(desks).toContain("'border-4 border-gold bg-navy text-white'");
  });

  it('keeps the one-click sign-up on the Member Desk only (Sprint 8R Corrected)', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks.match(/useOpenShiftSignup\(user\)/g)).toHaveLength(1);
    expect(desks).toContain('db.events.signupForShift(user.memberId, shiftId)');
  });

  it('keeps the badges, the ribbon and the Executive Summary off Home', () => {
    const page = read('apps/web/app/dashboard/page.tsx');
    const home = page.slice(page.indexOf('function HomeDesk('), page.indexOf('function Dashboard('));
    expect(home).toContain('<HomeWidgets user={user} councilId={councilId} faithOn={faithOn} />');
    // The code below the header comment (which tells the page's history) names none of them.
    const code = page.slice(page.indexOf("\nimport "));
    for (const gone of ['DeskStatusBadges', 'RoadmapRibbon', 'ExecutiveSummary', 'overflow-y-auto']) expect(code).not.toContain(gone);
  });

  it('retires the desk status badge strip with the Oversight Desk (Sprint 8P Stage 3)', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).not.toContain('function DeskStatusBadges');
    expect(desks).not.toContain('<DeskStatusBadges');
    expect(desks).not.toContain('export function OversightDesk(');
  });
});

describe('the Executive Dashboard page', () => {
  it('serves the whole Executive Summary at /executive-dashboard behind the dashboard area', () => {
    expect(EXECUTIVE_DASHBOARD_HREF).toBe('/executive-dashboard');
    const page = read('apps/web/app/executive-dashboard/page.tsx');
    expect(page).toContain('<RequireArea area="dashboard">');
    expect(page).toContain('isAdmin(user) || canViewExecutiveDashboard(user, scope.councilId) || canOpenHistorianDesk(user, scope.councilId)');
    for (const part of ['<RoadmapRibbon', '<FraternalRoadmap', '<Scorecards s={s} compact />', '<EngagementCards', '<MissionTracking', '<BudgetTracking', '<NoShowAudit']) {
      expect(page).toContain(part);
    }
    // Sprint 10 Revision 1.0: no monthly financial ledger table and no Top 5 leaderboard on this page.
    expect(page).not.toContain('title="Financial ledger"');
    expect(page).toContain('showLeaderboard={false}');
  });

  it('links the sidebar Executive Dashboard to the page for executive readers and the Council Historian', () => {
    expect(read('apps/web/components/Sidebar.tsx')).toContain('href: EXECUTIVE_DASHBOARD_HREF');
    expect(sidebarItems(seat({ roles: ['Grand Knight'] }))).toContain('dashboard');
    expect(sidebarItems(seat({ memberType: 'Admin' }))).toContain('dashboard');
    expect(sidebarItems(seat({ memberType: 'Super Admin' }))).toContain('dashboard');
    expect(sidebarItems(seat())).not.toContain('dashboard');
    // Sprint 8E Extension: the appointed Council Historian, even without an officer seat, gets the link.
    const historian = { ...seat({ roles: [COUNCIL_HISTORIAN_ROLE] }), isOfficer: false };
    expect(portalAreas(historian)).toContain('dashboard');
    expect(sidebarItems(historian)).toContain('dashboard');
  });

  it('describes the page in the Navigation Guide', () => {
    const entry = navigationGuide(seat({ roles: ['Grand Knight'] }))
      .groups.flatMap((g) => g.entries)
      .find((e) => e.item === 'dashboard');
    expect(entry?.explanation).toContain('Executive Summary');
    expect(entry?.explanation).not.toContain('status badges');
  });
});

describe('the guides', () => {
  it('walk through the six-card Home, the badges on the Oversight Desk and the Executive Dashboard page', () => {
    const admin = readOfficerManuals();
    expect(admin).toContain('**Home** holds seven large cards, and nothing else.');
    expect(admin).toContain('| **Top 5 Fraternal Volunteers** |');
    // Sprint 8P Stage 3: the badge strip and the Oversight Desk are gone.
    expect(admin).toContain('The portal has no status badge strip and no **Oversight Desk**.');
    expect(admin).toContain('### 14.11 Read the Executive Dashboard page');
    expect(admin).toContain('`/executive-dashboard`');
    expect(admin).not.toContain('**Executive Summary** frame');
    expect(admin).not.toContain('On **Home**, the');
  });
});
