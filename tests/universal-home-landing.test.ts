// Sprint 8R (schema version 91): every member lands on the universal Home tab, the Member Actions page folded into
// Home's Volunteer Check-In & Service Center, the guides' collapsible left-navigation maps and the insulated root
// tsconfig.json stub.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALL_FEATURES_ON,
  dashboardTabsFor,
  HOME_UNIVERSAL_CARDS,
  MEMBER_DESK_SECTIONS,
  NAVIGATION_ITEM_CATEGORY,
  NAVIGATION_MAP_CATEGORIES,
  navigationGuideMap,
  PORTAL_NAV_GROUPS,
  HOME_LANDING_ROUTE,
  landingRouteFor,
  PLATFORM_SCHEMA_VERSION,
  portalAreaHref,
  portalAreas,
  portalSidebar,
  VOLUNTEER_CENTER_TITLE,
} from '@kofc/shared';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const plain = { memberId: 3, councilId: 1, memberType: 'Member' as const, isOfficer: false };
const READERS = [
  plain,
  { ...plain, isOfficer: true, roles: ['Recorder'] },
  { ...plain, roles: ['Council Historian'] },
  { ...plain, memberType: 'Admin' as const },
  { ...plain, memberType: 'Super Admin' as const },
];

/** The <details> blocks of a part of a guide, in order, with whether each starts open. */
function detailsBlocks(markdown: string): { open: boolean; summary: string }[] {
  const out: { open: boolean; summary: string }[] = [];
  const lines = markdown.split(/\r?\n/).map((l) => l.trim());
  lines.forEach((line, i) => {
    const tag = /^<details( open)?>$/.exec(line);
    if (tag) out.push({ open: Boolean(tag[1]), summary: /^<summary>(.*)<\/summary>$/.exec(lines[i + 1] ?? '')?.[1] ?? '' });
  });
  return out;
}

describe('schema version 91', () => {
  it('moves the phone database to 91 with no table change', () => {
    expect(read('Schema.sql')).toContain('(schema version 91)');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toContain('const SCHEMA_VERSION = 91;');
    expect(PLATFORM_SCHEMA_VERSION).toBe(91);
    expect(read('docs/ARCHITECTURAL_HISTORY.md')).toContain('| 91 | 8R |');
  });
});

describe('the universal Home landing', () => {
  it('lands every reader on Home and gives every reader the Home tab first', () => {
    expect(HOME_LANDING_ROUTE).toBe('/dashboard');
    for (const u of READERS) {
      expect(landingRouteFor(u)).toBe('/dashboard');
      expect(portalAreas(u)[0]).toBe('home');
      expect(dashboardTabsFor(u, 1)[0].id).toBe('home');
    }
    expect(portalAreaHref('home')).toBe('/dashboard');
    expect(portalAreas(plain)).not.toContain('dashboard');
  });

  it('lists Home in the Faith In Action pillar of every sidebar', () => {
    for (const u of READERS) {
      expect(portalSidebar(u).find((g) => g.id === 'faith')!.entries.map((e) => e.item)).toContain('home');
    }
  });

  it('gates /dashboard on the home area and shows the desk row to every member', () => {
    expect(read('apps/web/app/dashboard/page.tsx')).toContain('<RequireArea area="home">');
    expect(read('apps/web/components/Shell.tsx')).toContain("includes('home') ? <WorkspaceTabs user={user} />");
    expect(read('apps/web/app/page.tsx')).toContain('redirect(landingRouteFor(user, features, tenantType))');
  });
});

describe('Member Actions folded into Home', () => {
  it('deletes the route and leaves no link to it', () => {
    expect(existsSync(join(__dirname, '..', 'apps/web/app/member-actions'))).toBe(false);
    for (const file of [
      'apps/web/components/Sidebar.tsx',
      'apps/web/components/DashboardDesks.tsx',
      'apps/web/app/calendar/page.tsx',
      'apps/web/app/members/page.tsx',
      'apps/web/app/system-settings/impersonate/page.tsx',
      'packages/shared/src/permissions.ts',
      'packages/shared/src/navigation-guide.ts',
    ]) {
      expect(read(file), file).not.toMatch(/['"`]\/?member-actions['"`]/);
    }
  });

  it('puts the Volunteer Center on the Member Desk, under the twin shift trackers (Sprint 8R Corrected)', () => {
    expect(VOLUNTEER_CENTER_TITLE).toBe('🙋 Volunteer Check-In & Service Center');
    const desks = read('apps/web/components/DashboardDesks.tsx');
    const memberDesk = desks.slice(desks.indexOf('export function MemberDesk('));
    const trackers = memberDesk.indexOf('aria-label="Shift trackers" className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2"');
    expect(trackers).toBeGreaterThan(-1);
    expect(memberDesk.indexOf('<OpenShiftsCard user={user} />')).toBeGreaterThan(trackers);
    expect(memberDesk.indexOf('<VolunteerCenter />')).toBeGreaterThan(memberDesk.indexOf('<OpenShiftsCard user={user} />'));
    expect(memberDesk.indexOf('<ReminderStream user={user}')).toBeGreaterThan(trackers);
    const vc = read('apps/web/components/VolunteerCenter.tsx');
    expect(vc).toContain("export const VOLUNTEER_CENTER_ID = 'volunteer-center';");
    for (const tab of ['My active shifts', 'Registration desk', 'Fraternal roster', 'Hour ledger']) expect(vc).toContain(`label: '${tab}'`);
  });
});

describe('the collapsible left-navigation guides', () => {
  const admin = read('docs/ADMIN_USER_GUIDE.md');
  const part2 = admin.slice(admin.indexOf('## 2. Left navigation map'), admin.indexOf('## 3. Module feature flags'));

  it('maps the left navigation by category before the desks and the phone tabs', () => {
    expect(admin).toContain('2. [Left navigation map](#2-left-navigation-map)');
    const order = ['🏠 Dashboard', '📅 Calendars', '👥 Rosters', '✅ Vetting', '📒 Ledgers', '🗄️ Archives', '🗂️ The desk tabs', '⏱️ The time windows', '📱 The five phone tabs'].map((t) =>
      part2.indexOf(`<summary>${t}`),
    );
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('opens only the overview, in both guides', () => {
    for (const blocks of [detailsBlocks(part2), detailsBlocks(read('docs/MEMBER_USER_GUIDE.md'))]) {
      expect(blocks.length).toBeGreaterThan(5);
      expect(blocks[0]).toEqual({ open: true, summary: '📍 Overview — read this first' });
      expect(blocks.slice(1).every((b) => !b.open)).toBe(true);
    }
    // Multi-tiered: some categories hold nested blocks.
    expect(part2).toMatch(/<summary>✅ Vetting<\/summary>\s+<details>\s+<summary>Expense signatures<\/summary>/);
    expect((part2.match(/<details/g) ?? []).length).toBe((part2.match(/<\/details>/g) ?? []).length);
  });

  it('prints each block under a bookmarked summary heading', () => {
    const pdf = read('scripts/admin_guide_pdf.py');
    expect(pdf).toContain("DETAILS_TAG = re.compile(r'</?details(\\s+open)?>', re.IGNORECASE)");
    expect(pdf).toContain("story.append(Heading(text, st['summary'], 2,");
  });

  it('documents Home as everyone\'s landing page with the Volunteer Center', () => {
    expect(admin).toContain('After you sign in, the portal opens on the **Home** tab. This is true for every member, officer, Admin and Super Admin.');
    expect(admin).not.toContain('Member Actions Hub');
    expect(read('docs/MEMBER_USER_GUIDE.md')).not.toContain('Member Actions Hub');
  });
});

describe('the root tsconfig.json stub', () => {
  it('is ignored by git', () => {
    expect(read('.gitignore')).toMatch(/^\/tsconfig\.json\s*$/m);
  });
});

// ---- Sprint 8R Corrected -----------------------------------------------------------------------------------

describe('the purely informational Home (Sprint 8R Corrected)', () => {
  it('renders only informational cards, none of which carries a workflow button', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    const grid = desks.slice(desks.indexOf('export function HomeWidgets('), desks.indexOf('// ---- the Officer Desks'));
    const rendered = [...grid.matchAll(/<([A-Z]\w+) /g)].map((m) => m[1]);
    expect(rendered).toEqual(['LatestBulletinsFeed', 'VerseOfTheDay', 'FeastDayTracker', 'TodaysAgenda', 'TopVolunteersCard']);
    expect(HOME_UNIVERSAL_CARDS).toEqual(['Latest Council Newsletters & Bulletins', 'Bible Verse of the Day', 'Liturgical Feast Day Tracker', "Today's Event Agenda", 'Top 5 Fraternal Volunteers']);
    for (const card of ['VerseOfTheDay', 'FeastDayTracker', 'TodaysAgenda', 'TopVolunteersCard']) {
      const start = desks.indexOf(`function ${card}(`);
      const body = desks.slice(start, desks.indexOf('\n}\n', start));
      expect(body, card).not.toMatch(/<Button|onClick=/);
    }
    expect(desks).not.toContain('function OpenShiftsHomeCard(');
  });

  it('restores the Member Desk: twin shift trackers on top, then the volunteer tools', () => {
    expect(MEMBER_DESK_SECTIONS.slice(0, 2)).toEqual(['🚗 Open Shifts Needing Volunteers', 'My shifts']);
    expect(MEMBER_DESK_SECTIONS.at(-1)).toBe(VOLUNTEER_CENTER_TITLE);
    const desks = read('apps/web/components/DashboardDesks.tsx');
    const memberDesk = desks.slice(desks.indexOf('export function MemberDesk('));
    const top = memberDesk.slice(memberDesk.indexOf('aria-label="Shift trackers"'), memberDesk.indexOf('</div>'));
    expect(top).toContain('<OpenShiftsCard user={user} />');
    expect(top).toContain('<Panel className="h-full" title={`My shifts: next');
    expect(memberDesk).toContain('<CommunityPrayerCard user={user} councilId={user.councilId} />');
    expect(dashboardTabsFor(plain, 1).map((t) => t.id)).toEqual(['home', 'member']);
  });
});

describe('the role-customized navigation map (Sprint 8R Corrected)', () => {
  const grandKnight = { ...plain, isOfficer: true, roles: ['Grand Knight'] };
  const superAdmin = { ...plain, memberType: 'Super Admin' as const, username: 'testsuperadmin@kofc.org' };

  it('files every sidebar link in a category, sidebar categories first', () => {
    expect(NAVIGATION_MAP_CATEGORIES.map((c) => c.label).slice(0, 6)).toEqual(['🏠 Dashboard', '📅 Calendars', '👥 Rosters', '✅ Vetting', '📒 Ledgers', '🗄️ Archives']);
    for (const item of PORTAL_NAV_GROUPS.flatMap((g) => g.items)) expect(NAVIGATION_ITEM_CATEGORY[item]).toBeDefined();
  });

  it('gives a plain member summaries of their own paths only', () => {
    const map = navigationGuideMap(plain);
    expect(map.depth).toBe('summary');
    const items = map.categories.flatMap((c) => c.entries.map((e) => e.item as string));
    expect(items).toEqual(expect.arrayContaining(['home', 'calendar']));
    for (const desk of ['expenses/audit', 'expenses/authorize', 'finance/ledger', 'councils', 'system-settings/council-settings']) expect(items).not.toContain(desk);
    expect(map.categories.flatMap((c) => c.entries).every((e) => e.pillar === undefined)).toBe(true);
    expect(map.desks.map((d) => [d.id, d.sections])).toEqual([
      ['home', []],
      ['member', []],
    ]);
    expect(map.phoneTabs.map((t) => t.tab)).toEqual(['Home', 'Mtgs', 'Signup', 'Report', 'Donate']);
  });

  it('unlocks the full depth for officers and Super Admins', () => {
    const gk = navigationGuideMap(grandKnight);
    expect(gk.depth).toBe('full');
    expect(gk.categories.flatMap((c) => c.entries).every((e) => typeof e.pillar === 'string')).toBe(true);
    const desk = gk.desks.find((d) => d.id === 'grand-knight')!;
    expect(desk.sections).toEqual(expect.arrayContaining(['Approved Expenses', 'Council Election Tracker']));
    expect(gk.desks.find((d) => d.id === 'member')!.sections).toEqual([...MEMBER_DESK_SECTIONS]);
    const sa = navigationGuideMap(superAdmin);
    expect(sa.depth).toBe('full');
    expect(sa.categories.flatMap((c) => c.entries.map((e) => e.item as string))).toContain('system-settings/global-settings');
    expect(sa.desks.map((d) => d.id)).toContain('super-admin');
  });

  it('follows the feature flags for the phone tabs', () => {
    expect(navigationGuideMap(plain, { ...ALL_FEATURES_ON, flag_fundraising_inflow: false }).phoneTabs.map((t) => t.tab)).not.toContain('Donate');
  });

  it('renders as collapsible blocks with only the overview open', () => {
    const page = read('apps/web/app/navigation-guide/page.tsx');
    expect(page).toContain('navigationGuideMap(user, flags, tenant)');
    expect(page.match(/<MapBlock [^>]*\bopen\b/g)).toEqual(['<MapBlock id="overview" title="📍 Overview" open']);
    expect(page.indexOf('map.categories.map(')).toBeLessThan(page.indexOf('id="desks"'));
    expect(page.indexOf('id="desks"')).toBeLessThan(page.indexOf('id="timings"'));
    expect(page.indexOf('id="timings"')).toBeLessThan(page.indexOf('id="phone"'));
  });
});
