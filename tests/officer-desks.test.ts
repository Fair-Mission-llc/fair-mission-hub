// Sprint 7J: the tabbed dashboard cockpit and the Officer Desks (schema version 71) - which tabs each seat gets, the URL
// anchors, the Home tab's reminders stream, feast-day tracker and today's agenda, and the page wiring.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildReminderStream,
  DASHBOARD_TABS,
  dashboardTabFromAnchor,
  dashboardTabsFor,
  feastDayTracker,
  portalAreas,
  todaysAgenda,
  type CalendarEntry,
  type NotificationLog,
} from '@kofc/shared';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

const member = (over: { memberType?: 'Member' | 'Admin' | 'Super Admin'; roles?: string[]; councilId?: number } = {}) => ({
  memberId: 7,
  councilId: over.councilId ?? 1,
  memberType: over.memberType ?? ('Member' as const),
  isOfficer: (over.roles ?? []).length > 0,
  roles: over.roles ?? [],
});

const ids = (u: ReturnType<typeof member>, councilId = 1) => dashboardTabsFor(u, councilId).map((t) => t.id);

describe('schema version 71', () => {
  it('records the no-table-change version and bumps the phone database', () => {
    expect(read('Schema.sql')).toContain('(schema version 71)');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (7[1-9]|[8-9]\d);/);
  });
});

describe('dashboard tabs by seat (pure)', () => {
  it('lists Home first and the Member Desk last', () => {
    expect(DASHBOARD_TABS.map((t) => t.id)).toEqual(['home', 'grand-knight', 'financial-secretary', 'treasurer', 'member']);
  });

  it('gives each officer only their own desk', () => {
    expect(ids(member({ roles: ['Grand Knight'] }))).toEqual(['home', 'grand-knight', 'member']);
    expect(ids(member({ roles: ['Financial Secretary'] }))).toEqual(['home', 'financial-secretary', 'member']);
    expect(ids(member({ roles: ['Treasurer'] }))).toEqual(['home', 'treasurer', 'member']);
    expect(ids(member({ roles: ['Recorder'] }))).toEqual(['home', 'member']);
  });

  it("clears a seat only on the officer's own council", () => {
    expect(ids(member({ roles: ['Grand Knight'] }), 2)).toEqual(['home', 'member']);
  });

  it("gives the council's Admins and any Super Admin every desk, as the full desk pages do", () => {
    expect(ids(member({ memberType: 'Admin' }))).toEqual(DASHBOARD_TABS.map((t) => t.id));
    expect(ids(member({ memberType: 'Admin' }), 2)).toEqual(['home', 'member']);
    expect(ids(member({ memberType: 'Super Admin' }), 2)).toEqual(DASHBOARD_TABS.map((t) => t.id));
  });

  it('opens the tab a URL anchor names, falling back to Home for an unknown or uncleared one', () => {
    const tabs = dashboardTabsFor(member({ roles: ['Treasurer'] }), 1);
    expect(dashboardTabFromAnchor('#treasurer', tabs)).toBe('treasurer');
    expect(dashboardTabFromAnchor('Member', tabs)).toBe('member');
    expect(dashboardTabFromAnchor('#grand-knight', tabs)).toBe('home');
    expect(dashboardTabFromAnchor('', tabs)).toBe('home');
    expect(dashboardTabFromAnchor(null, tabs)).toBe('home');
  });
});

describe('live actionable reminders (pure)', () => {
  const alert = (id: number, priority: NotificationLog['Priority'], sentAt: string, read = 0): NotificationLog => ({
    id,
    CouncilID: 1,
    TargetMemberID: 7,
    Title: `Alert ${id}`,
    MessageBody: `Body ${id}`,
    Priority: priority,
    SentAt: sentAt,
    IsRead: read,
  });

  it('puts waiting desk queues first, then unread alerts by priority and newest', () => {
    const stream = buildReminderStream({
      alerts: [alert(1, 'Low', '2026-10-10 10:00:00'), alert(2, 'High', '2026-10-01 10:00:00'), alert(3, 'High', '2026-10-05 10:00:00'), alert(4, 'Medium', '2026-10-11 10:00:00', 1)],
      queues: { writtenOrder: 2, ledgerCoding: 0, counterSignature: 1 },
    });
    expect(stream.map((r) => r.key)).toEqual(['desk-fs', 'desk-gk', 'alert-3', 'alert-2', 'alert-1']);
    expect(stream[0]).toMatchObject({ href: '/expenses/audit', priority: 'High', detail: '2 expense sheets wait for your signature.' });
    expect(stream[1].detail).toBe('1 expense sheet waits for your signature.');
    expect(stream[2]).toMatchObject({ title: 'Alert 3', detail: 'Body 3', href: null });
  });

  it('skips desks the reader is not cleared for, alerts read in this view, and stops at the limit', () => {
    const alerts = Array.from({ length: 12 }, (_, i) => alert(i + 1, 'Medium', `2026-10-${String(i + 1).padStart(2, '0')} 09:00:00`));
    expect(buildReminderStream({ alerts, readIds: new Set([12]) })).toHaveLength(8);
    expect(buildReminderStream({ alerts, readIds: new Set([12]) })[0].key).toBe('alert-11');
    expect(buildReminderStream({ alerts: [], queues: {} })).toEqual([]);
  });
});

describe('feast day tracker and today agenda (pure)', () => {
  it("reads today's line and the coming liturgical days without national holidays", () => {
    const tracker = feastDayTracker('2026-10-12');
    expect(tracker.today.text).toMatch(/^Today: /);
    expect(tracker.upcoming.every((o) => o.kind !== 'holiday')).toBe(true);
    const allSaints = tracker.upcoming.find((o) => o.date === '2026-11-01');
    expect(allSaints?.daysAway).toBe(20);
    expect(tracker.upcoming.every((o) => o.daysAway >= 1 && o.daysAway <= 30)).toBe(true);
  });

  it("keeps only today's entries, all-day events before timed meetings", () => {
    const event = (id: number, startDate: string, endDate: string, title: string): CalendarEntry =>
      ({ kind: 'event', id, title, startDate, endDate, startTime: null, endTime: null, location: '', event: {} }) as unknown as CalendarEntry;
    const meeting = (id: number, startTime: string, title: string): CalendarEntry =>
      ({ kind: 'meeting', id, title, startDate: '2026-10-12', endDate: '2026-10-12', startTime, endTime: null, location: '', meeting: {} }) as unknown as CalendarEntry;
    const rows = todaysAgenda(
      [meeting(1, '19:00:00', 'Business Meeting'), event(2, '2026-10-10', '2026-10-14', 'Food Drive'), event(3, '2026-10-13', '2026-10-13', 'Tomorrow'), meeting(4, '07:30:00', 'Officers Breakfast')],
      '2026-10-12',
    );
    expect(rows.map((r) => r.title)).toEqual(['Food Drive', 'Officers Breakfast', 'Business Meeting']);
  });
});

describe('Sprint 7J screens', () => {
  it('turns /dashboard into the tabbed cockpit and keeps the Executive Summary on Home', () => {
    const page = read('apps/web/app/dashboard/page.tsx');
    expect(page).toContain('dashboardTabsFor(user, scope.councilId)');
    expect(page).toContain('useDashboardTab(tabs)');
    expect(page).toContain('<HomeWidgets');
    expect(page).toContain('<ExecutiveSummary councilId={scope.councilId} />');
    for (const desk of ['<GrandKnightDesk', '<FinancialSecretaryDesk', '<TreasurerDesk', '<MemberDesk']) expect(page).toContain(desk);
  });

  it('builds the four Home widgets and the desk queues from the existing desk reads', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    for (const title of ['Bible Verse of the Day', 'Live Actionable Reminders', 'Liturgical Feast Day Tracker', "Today's Event Agenda"]) expect(desks).toContain(title);
    expect(desks).toContain('db.expenses.listAuthorizationQueue');
    expect(desks).toContain('db.expenses.listTreasurerQueue');
    expect(desks).toContain('/templates/roster_import_template.xlsx');
    expect(desks).toContain('db.members.sweepInactive');
    // The desks summarize; the signatures stay on the full desk pages behind their own gates.
    expect(desks).not.toMatch(/grandKnightAuthorizeOrder|treasurerLedgerAudit|financialSecretaryAuditOrder/);
  });

  it('leaves the left sidebar intact', () => {
    expect(read('packages/shared/src/permissions.ts')).toContain("items: ['member-center', 'dashboard', 'performance/charts', 'history', 'ledger', 'lessons-registry']");
  });
});

describe('Sprint 7J Extension 2 global workspace tabs and root redirect', () => {
  it('moves the phone database to 72 and records the change', () => {
    expect(read('Schema.sql')).toContain('(schema version 72)');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (7[2-9]|[8-9]\d);/);
    expect(read('docs/ARCHITECTURAL_HISTORY.md')).toContain('| 72 | 7J Ext 2 |');
  });

  it('renders the tab row in the portal frame for dashboard readers, not on the dashboard page', () => {
    const shell = read('apps/web/components/Shell.tsx');
    expect(shell).toContain("portalAreas(user, features, tenantType).includes('dashboard') ? <WorkspaceTabs user={user} />");
    expect(read('apps/web/app/dashboard/page.tsx')).not.toContain('<Tabs');
    const tabs = read('apps/web/components/WorkspaceTabs.tsx');
    expect(tabs).toContain('dashboardTabsFor(user, user.councilId)');
    expect(tabs).toContain('href={`/dashboard#${tab.anchor}`}');
    expect(tabs).toMatch(/sticky top-0/);
  });

  it('sends the portal root to /dashboard, or the member hub when the seat lacks it', () => {
    const root = read('apps/web/app/page.tsx');
    expect(root).toContain("redirect(portalAreas(user, features, tenantType).includes('dashboard') ? '/dashboard' : '/member-actions')");
  });

  it('gives plain members no dashboard, so they stay on the member hub', () => {
    const plain = { memberId: 1, councilId: 1, memberType: 'Member' as const, isOfficer: false };
    const officer = { ...plain, isOfficer: true, roles: ['Grand Knight'] };
    expect(portalAreas(plain)).not.toContain('dashboard');
    expect(portalAreas(officer)).toContain('dashboard');
  });
});
