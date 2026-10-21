// Sprint 8R (schema version 91): every member lands on the universal Home tab, the Member Actions page folded into
// Home's Volunteer Check-In & Service Center, the guides' collapsible left-navigation maps and the insulated root
// tsconfig.json stub.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALL_FEATURES_ON,
  EXPENSE_CODED_BY_TREASURER_LABEL,
  EXPENSE_RECORDED_BY_FS_LABEL,
  expenseStatusBadge,
  MEMBER_ACTIONS_HREF,
  MEMBER_ACTIONS_HUB_HEADING,
  MEMBER_ACTIONS_NAV_LABEL,
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
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (9[1-9]);/);
    expect(PLATFORM_SCHEMA_VERSION).toBeGreaterThanOrEqual(91);
    expect(read('docs/ARCHITECTURAL_HISTORY.md')).toContain('| 91 | 8R |');
  });
});

describe('the universal Home landing', () => {
  it('lands every reader on Home and gives every reader the Home tab first', () => {
    expect(HOME_LANDING_ROUTE).toBe('/dashboard#home');
    for (const u of READERS) {
      expect(landingRouteFor(u)).toBe('/dashboard#home');
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
  it('restores the standalone /member-actions page (Sprint 8S Revision: only the Volunteer Center)', () => {
    const page = read('apps/web/app/member-actions/page.tsx');
    expect(page).toContain('<RequireArea area="member-actions">');
    expect(page).toContain('<VolunteerCenter />');
    expect(page).not.toContain('<MemberDesk');
    expect(page).toContain('<PageTitle>{MEMBER_ACTIONS_HUB_HEADING}</PageTitle>');
    expect(read('apps/web/app/calendar/page.tsx')).toContain('<Link href="/member-actions"');
    // A view-as session opens on Home with the anchor, like a sign-in.
    for (const file of ['apps/web/app/members/page.tsx', 'apps/web/app/system-settings/impersonate/page.tsx']) expect(read(file)).toContain("router.push('/dashboard#home')");
  });

  it('keeps the twin shift trackers on the Member Desk and the Volunteer Center off it (Sprint 8S Revision)', () => {
    expect(VOLUNTEER_CENTER_TITLE).toBe('🙋 Volunteer Check-In & Service Center');
    const desks = read('apps/web/components/DashboardDesks.tsx');
    const memberDesk = desks.slice(desks.indexOf('export function MemberDesk('));
    const trackers = memberDesk.indexOf('aria-label="Shift trackers" className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2"');
    expect(trackers).toBeGreaterThan(-1);
    expect(memberDesk.indexOf('<OpenShiftsCard user={user} />')).toBeGreaterThan(trackers);
    expect(memberDesk.slice(0, memberDesk.indexOf('\n}\n'))).not.toContain('<VolunteerCenter');
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
    // Sprint 8S Revision: the sidebar link reads plain 'Member Actions Hub'.
    for (const guide of [admin, read('docs/MEMBER_USER_GUIDE.md')]) {
      expect(guide).toContain('**Member Actions Hub**');
      expect(guide).not.toContain('[ 🙋 Member Actions ]');
    }
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
    expect(rendered).toEqual(['LatestBulletinsFeed', 'VerseOfTheDay', 'ReminderStream', 'FeastDayTracker', 'UpcomingEventAgenda', 'TopVolunteersCard', 'CommunityPrayerCard']);
    // Sprint 8S Corrected: the prayer card's Praying Hands (in PrayerRequestRow) is the one button on Home.
    for (const card of ['VerseOfTheDay', 'FeastDayTracker', 'UpcomingEventAgenda', 'TopVolunteersCard', 'ReminderStream', 'CommunityPrayerCard']) {
      const start = desks.indexOf(`function ${card}(`);
      const body = desks.slice(start, desks.indexOf('\n}\n', start));
      expect(body, card).not.toMatch(/<Button|onClick=/);
    }
    expect(desks).not.toContain('function OpenShiftsHomeCard(');
  });

  it('restores the Member Desk: twin shift trackers on top, then the volunteer tools', () => {
    expect(MEMBER_DESK_SECTIONS.slice(0, 2)).toEqual(['🚗 Open Shifts Needing Volunteers', 'My shifts']);
    expect(MEMBER_DESK_SECTIONS).not.toContain(VOLUNTEER_CENTER_TITLE);
    const desks = read('apps/web/components/DashboardDesks.tsx');
    const memberDesk = desks.slice(desks.indexOf('export function MemberDesk('));
    const top = memberDesk.slice(memberDesk.indexOf('aria-label="Shift trackers"'), memberDesk.indexOf('</div>'));
    expect(top).toContain('<OpenShiftsCard user={user} />');
    expect(top).toContain('<Panel className="h-full" title={`My shifts: next');
    expect(memberDesk).not.toContain('<CommunityPrayerCard');
    expect(memberDesk).not.toContain('<ReminderStream');
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
    expect(map.phoneTabs.map((t) => t.tab)).toEqual(['Home', 'Mtgs', 'Signup', 'Report', 'Collect']);
  });

  it('unlocks the full depth for officers and Super Admins', () => {
    const gk = navigationGuideMap(grandKnight);
    expect(gk.depth).toBe('full');
    expect(gk.categories.flatMap((c) => c.entries).every((e) => typeof e.pillar === 'string')).toBe(true);
    const desk = gk.desks.find((d) => d.id === 'grand-knight')!;
    expect(desk.sections).toEqual(expect.arrayContaining(['Approved Expenses', '[ 🗳️ Council Election Workflow ]']));
    expect(gk.desks.find((d) => d.id === 'member')!.sections).toEqual([...MEMBER_DESK_SECTIONS]);
    const sa = navigationGuideMap(superAdmin);
    expect(sa.depth).toBe('full');
    expect(sa.categories.flatMap((c) => c.entries.map((e) => e.item as string))).toContain('system-settings/global-settings');
    expect(sa.desks.map((d) => d.id)).toContain('super-admin');
  });

  it('follows the feature flags for the phone tabs', () => {
    expect(navigationGuideMap(plain, { ...ALL_FEATURES_ON, flag_fundraising_inflow: false }).phoneTabs.map((t) => t.tab)).not.toContain('Collect');
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

// ---- Sprint 8S ---------------------------------------------------------------------------------------------

describe('Sprint 8S: the Member Actions sidebar link and the read-only Home cards', () => {
  it('moves the phone database to 92', () => {
    expect(read('Schema.sql')).toContain('(schema version 92)');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (9[2-9]);/);
    expect(PLATFORM_SCHEMA_VERSION).toBeGreaterThanOrEqual(92);
    expect(read('docs/ARCHITECTURAL_HISTORY.md')).toContain('| 92 | 8S |');
  });

  it("gives every member 'Member Actions Hub' right after Home (Sprint 8S Revision: no emoji)", () => {
    expect(MEMBER_ACTIONS_NAV_LABEL).toBe('Member Actions Hub');
    expect(MEMBER_ACTIONS_HREF).toBe('/member-actions');
    expect(portalAreaHref('member-actions')).toBe(MEMBER_ACTIONS_HREF);
    for (const u of READERS) {
      const faith = portalSidebar(u).find((g) => g.id === 'faith')!.entries.map((e) => e.item as string);
      expect(faith.indexOf('member-actions')).toBe(faith.indexOf('home') + 1);
    }
    const sidebar = read('apps/web/components/Sidebar.tsx');
    expect(sidebar).toContain("'member-actions': { href: '/member-actions', label: 'Member Actions Hub'");
    expect(sidebar).toContain("home: { href: '/dashboard#home', label: 'Home'");
    expect(dashboardTabsFor(plain, 1).map((t) => t.anchor)).toContain('member');
    expect(NAVIGATION_ITEM_CATEGORY['member-actions']).toBe('dashboard');
    expect(navigationGuideMap(plain).categories[0].entries.map((e) => e.item)).toEqual(expect.arrayContaining(['home', 'member-actions']));
  });

  it('keeps the Home reminders read only and gives the prayer card only its Praying Hands (Sprint 8S Corrected)', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    const block = (card: string) => {
      const start = desks.indexOf(`function ${card}(`);
      return desks.slice(start, desks.indexOf('\n}\n', start));
    };
    expect(block('ReminderStream')).not.toMatch(/<Link|<Button|onClick=/);
    expect(block('ReminderStream')).toContain('Read only.');
    expect(block('CommunityPrayerCard')).not.toMatch(/<Link/);
    expect(block('CommunityPrayerCard')).toContain('<PrayerRequestRow key={item.intention.id} user={user} item={item} />');
    const row = block('PrayerRequestRow');
    expect(row).toContain('db.prayers.pray(user.memberId, item.intention.id)');
    expect(row).toContain('{PRAYING_HANDS_LABEL}');
    expect(row).not.toMatch(/<Link/);
    expect(MEMBER_DESK_SECTIONS).not.toContain('Live Actionable Reminders');
  });
});

// ---- Sprint 8S Corrected -----------------------------------------------------------------------------------

describe('Sprint 8S Corrected: forced Home logins', () => {
  it('moves the phone database to 93', () => {
    expect(read('Schema.sql')).toContain('(schema version 93)');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (9[3-9]);/);
    expect(PLATFORM_SCHEMA_VERSION).toBeGreaterThanOrEqual(93);
    expect(read('docs/ARCHITECTURAL_HISTORY.md')).toContain('| 93 | 8S Corrected |');
  });

  it('lands every sign-in on /dashboard#home, whatever tab the browser remembers', () => {
    const session = read('apps/web/lib/session.tsx');
    expect(session).toContain('if (found) router.replace(HOME_LANDING_ROUTE);');
    expect(read('apps/web/app/page.tsx')).toContain('redirect(landingRouteFor(user, features, tenantType))');
    // The URL anchor wins over the remembered tab.
    expect(read('apps/web/components/WorkspaceTabs.tsx')).toContain('window.location.hash || readLastTab()');
    expect(dashboardTabsFor(plain, 1)[0].anchor).toBe(HOME_LANDING_ROUTE.split('#')[1]);
  });
});

// ---- Sprint 8S Revision ------------------------------------------------------------------------------------

describe('Sprint 8S Revision: Member Actions Hub, plain expense tags and the phone schema guard', () => {
  it('moved the phone database to 94 (95 since Sprint 8S Revision 2)', () => {
    expect(read('Schema.sql')).toContain('(schema version 94)');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (9[4-9]|\d{3});/);
    expect(PLATFORM_SCHEMA_VERSION).toBeGreaterThanOrEqual(94);
    expect(read('docs/ARCHITECTURAL_HISTORY.md')).toContain('| 94 | 8S Revision |');
  });

  it('heads the hub with one master heading over the four-tab Volunteer Center', () => {
    expect(MEMBER_ACTIONS_HUB_HEADING).toBe('[ 🙋 Member Actions Hub ]');
    expect(MEMBER_ACTIONS_NAV_LABEL).not.toMatch(/\p{Extended_Pictographic}/u);
    const vc = read('apps/web/components/VolunteerCenter.tsx');
    expect(vc).toContain('aria-label={VOLUNTEER_CENTER_TITLE}');
    expect(vc).not.toContain('<h2');
  });

  it('labels the FS and Treasurer stages in plain English', () => {
    expect(expenseStatusBadge({ Status: 'Submitted', RejectionReason: null, FinancialSecretaryMemberID: 2 }).label).toBe(EXPENSE_RECORDED_BY_FS_LABEL);
    expect(expenseStatusBadge({ Status: 'Submitted', RejectionReason: null, FinancialSecretaryMemberID: 2, TreasurerMemberID: 5 }).label).toBe(EXPENSE_CODED_BY_TREASURER_LABEL);
    expect([EXPENSE_RECORDED_BY_FS_LABEL, EXPENSE_CODED_BY_TREASURER_LABEL]).toEqual(['RECORDED BY FS', 'CODED BY TREASURER']);
    for (const file of ['packages/shared/src/expenses.ts', 'docs/ADMIN_USER_GUIDE.md', 'docs/MEMBER_USER_GUIDE.md']) {
      expect(read(file)).not.toMatch(/'Order Issued'|'Ledger Coded'|\*\*Order Issued\*\*|\*\*Ledger Coded\*\*/);
    }
  });

  it('renders Council Wide Settings as only its filing cabinet (Sprint 8S Revision 10.1, was two accordions)', () => {
    const page = read('apps/web/app/system-settings/council-settings/page.tsx');
    const panels = page.slice(page.indexOf('function SettingsPanels('), page.indexOf('function CouncilWideSettings('));
    const body = panels.slice(panels.indexOf('return ('));
    const topLevel = [...body.matchAll(/^ {4}<(\w+)/gm)].map((m) => m[1]);
    expect(topLevel).toEqual(['SettingsCabinet']);
    expect(page).not.toContain('<SettingsBucket');
  });

  it('rebuilds a phone database whose columns drift from the generated schema, after a backup', () => {
    const generated = read('apps/mobile/services/generated/schema.sqlite.ts');
    expect(generated).toContain('export const TABLE_COLUMNS');
    const donation = generated.slice(generated.indexOf('"Donation": ['), generated.indexOf(']', generated.indexOf('"Donation": [')));
    expect(donation).toContain('"revenue_gl_account_id"');
    const driver = read('apps/mobile/services/drivers/sqlite.ts');
    expect(driver).toContain('if (version >= SCHEMA_VERSION && (await this.columnsMatch(db))) {');
    expect(driver.indexOf('await this.backupDatabase(db);')).toBeLessThan(driver.indexOf('await SQLite.deleteDatabaseAsync(DB_NAME);\n    const fresh'));
    expect(driver).toContain('SQLite.backupDatabaseAsync({ sourceDatabase: db, destDatabase: dest })');
  });
});
