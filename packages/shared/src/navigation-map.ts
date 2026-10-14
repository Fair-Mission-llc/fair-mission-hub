// =========================================================================
// THE ROLE-CUSTOMIZED NAVIGATION MAP (Sprint 8R Corrected, schema version 91)
//
// The Navigation Guide page (/navigation-guide) is open to every member, but what it shows follows the session:
//   - the sidebar first, regrouped into categories (NAVIGATION_MAP_CATEGORIES: Dashboard, Calendars, Rosters, Vetting,
//     Ledgers, Archives, then Settings, planning and help), holding only the links the reader's own sidebar shows
//     (portalSidebar through navigationGuide, so feature flags and the tenant gate apply);
//   - then the reader's own Active Desks tabs (dashboardTabsFor), then the time limits (navigationTimings, on the page),
//     then the phone tabs the council has on (mobileTabEnabled).
// Depth (navigationMapDepth): a plain member gets 'summary' - one member-worded sentence per link and per tab. Council
// leadership (an Admin, a seated officer, a Super Admin) gets 'full' - the leader wording, the pillar each link sits in,
// and every drawer or section of each desk they hold. Nobody is shown a link or a desk they cannot open.
// =========================================================================
import type { SessionUser } from './contract';
import { deskDrawersFor, type DrawerDeskId } from './desk-drawers';
import { PHONE_TABS, type PhoneTab } from './docs';
import { ALL_FEATURES_ON, mobileTabEnabled, type FeatureFlags, type MobileTab } from './features';
import { isNavigationLeader, navigationGuide } from './navigation-guide';
import { dashboardTabsFor, HOME_UNIVERSAL_CARDS, MEMBER_DESK_SECTIONS, type DashboardTabId } from './officer-desks';
import type { PortalNavItem } from './permissions';
import { SUPER_ADMIN_DESK_FOLDERS } from './super-admin-desk';
import { DEFAULT_TENANT_TYPE, type TenantType } from './tenant';

type Viewer = Pick<SessionUser, 'memberId' | 'councilId' | 'memberType' | 'isOfficer'> & { roles?: readonly string[]; isBudgetDirector?: boolean; username?: string };

/** The sidebar categories, in display order. */
export const NAVIGATION_MAP_CATEGORIES = [
  { id: 'dashboard', label: '🏠 Dashboard' },
  { id: 'calendars', label: '📅 Calendars' },
  { id: 'rosters', label: '👥 Rosters' },
  { id: 'vetting', label: '✅ Vetting' },
  { id: 'ledgers', label: '📒 Ledgers' },
  { id: 'archives', label: '🗄️ Archives' },
  { id: 'settings', label: '⚙️ Settings, planning and help' },
] as const;
export type NavigationMapCategoryId = (typeof NAVIGATION_MAP_CATEGORIES)[number]['id'];

/** The category of every sidebar link (the Record type keeps it complete). */
export const NAVIGATION_ITEM_CATEGORY: Record<PortalNavItem, NavigationMapCategoryId> = {
  home: 'dashboard',
  'member-actions': 'dashboard',
  dashboard: 'dashboard',
  'member-center': 'dashboard',
  'finance/dashboard': 'dashboard',
  'performance/charts': 'dashboard',
  calendar: 'calendars',
  events: 'calendars',
  meetings: 'calendars',
  'meetings/cadence': 'calendars',
  'meetings/live': 'calendars',
  members: 'rosters',
  'supreme-sync': 'rosters',
  elections: 'rosters',
  'elections/appointments': 'rosters',
  'system-settings/affiliations': 'rosters',
  'expenses/audit': 'vetting',
  'finance/treasurer-desk': 'vetting',
  'expenses/authorize': 'vetting',
  'charities/propose': 'vetting',
  'charities/vetting': 'vetting',
  'charities/queue': 'vetting',
  'finance/audit': 'vetting',
  'finance/ledger': 'ledgers',
  'finance/balance-sheet': 'ledgers',
  expenses: 'ledgers',
  'expenses/disbursements': 'ledgers',
  donations: 'ledgers',
  'financials/budget': 'ledgers',
  ledger: 'ledgers',
  'inventory/loaner-library': 'ledgers',
  history: 'archives',
  'system-settings/knowledge-archive': 'archives',
  'lessons-registry': 'archives',
  gallery: 'archives',
  'resources/bulletins': 'archives',
  'governance/bylaws': 'archives',
  'answers/sop': 'archives',
  activities: 'settings',
  'faith-center': 'settings',
  'resources/marketing': 'settings',
  'governance/advisor': 'settings',
  help: 'settings',
  'answers/help': 'settings',
  'system-settings/council-settings': 'settings',
  'council-lookups': 'settings',
  'credentials-vault': 'settings',
  'feature-flags': 'settings',
  'system-settings/global-settings': 'settings',
  councils: 'settings',
  'charities/registry': 'settings',
  lookups: 'settings',
  parishes: 'settings',
  'system-settings/remote-assistance': 'settings',
  'system-settings/impersonate': 'settings',
  'system-settings/feedback': 'settings',
};

/** One sentence per Active Desks tab. */
export const DESK_TAB_SUMMARIES: Record<DashboardTabId, string> = {
  home: "The council's newsletters, the day's verse and feast, your reminders, today's agenda, the prayer list and the month's Top 5 volunteers. Read only.",
  'super-admin': "The platform owner's cockpit: feedback, council access requests and the module switches.",
  'grand-knight': 'Approve and release expenses, review flagged hours, vet charity grants and lead planning and elections.',
  'financial-secretary': 'Issue payment requests, track expense reports, record charity donations and import the roster.',
  treasurer: 'Code sheets to the ledger, settle expense reports, close cash boxes and reconcile the bank.',
  recorder: 'Write and publish the minutes, start the live meeting and keep the motions ledger.',
  historian: 'Keep the diary logs, the monthly newsletters, the meeting photos and the oral histories.',
  member: "Your volunteer work: open shifts and your own shifts side by side, your sheets and the Volunteer Check-In & Service Center. The sidebar's [ 🙋 Member Actions ] link opens it.",
};

/** One sentence per phone tab, and the phone route each one is (features.ts MobileTab). */
export const PHONE_TAB_SUMMARIES: Record<PhoneTab, { summary: string; route: MobileTab }> = {
  Home: { summary: 'Your upcoming shifts and your expense report summary.', route: 'index' },
  Mtgs: { summary: 'Answer meeting invitations and read the agendas.', route: 'meetings' },
  Signup: { summary: 'Find shifts in the next 30 days and sign up.', route: 'shifts' },
  Report: { summary: 'Log hours for a council activity or a shift.', route: 'log' },
  Donate: { summary: 'Record cash, card, QR-code and item donations.', route: 'donate' },
};

export type NavigationMapDepth = 'summary' | 'full';

/** 'full' for council leadership (an Admin, a seated officer or a Super Admin), 'summary' for every other member. */
export const navigationMapDepth = (u: Viewer): NavigationMapDepth => (isNavigationLeader(u) ? 'full' : 'summary');

export interface NavigationMapEntry {
  item: PortalNavItem;
  explanation: string;
  /** The sidebar pillar the link sits in; full depth only. */
  pillar?: string;
}

export interface NavigationMapCategory {
  id: NavigationMapCategoryId;
  label: string;
  entries: NavigationMapEntry[];
}

export interface NavigationMapDesk {
  id: DashboardTabId;
  label: string;
  summary: string;
  /** Every drawer or section of the desk; full depth only (empty for a summary). */
  sections: string[];
}

export interface NavigationMap {
  depth: NavigationMapDepth;
  categories: NavigationMapCategory[];
  desks: NavigationMapDesk[];
  phoneTabs: { tab: PhoneTab; summary: string }[];
}

const DRAWER_DESKS = new Set<DashboardTabId>(['grand-knight', 'financial-secretary', 'treasurer', 'recorder', 'historian']);

function deskSections(u: Viewer, id: DashboardTabId, flags: FeatureFlags, tenant: TenantType): string[] {
  if (id === 'home') return [...HOME_UNIVERSAL_CARDS];
  if (id === 'member') return [...MEMBER_DESK_SECTIONS];
  if (id === 'super-admin') return SUPER_ADMIN_DESK_FOLDERS.map((f) => f.label);
  if (DRAWER_DESKS.has(id)) return deskDrawersFor(u, id as DrawerDeskId, u.councilId, flags, tenant).map((d) => d.title);
  return [];
}

/** The reader's navigation map: their own sidebar by category, their own desk tabs, their council's phone tabs. */
export function navigationGuideMap(u: Viewer, flags: FeatureFlags = ALL_FEATURES_ON, tenant: TenantType = DEFAULT_TENANT_TYPE): NavigationMap {
  const depth = navigationMapDepth(u);
  const full = depth === 'full';
  const guide = navigationGuide(u, flags, tenant);
  const categories: NavigationMapCategory[] = NAVIGATION_MAP_CATEGORIES.map(({ id, label }) => ({
    id,
    label,
    entries: guide.groups.flatMap((g) =>
      g.entries
        .filter((e) => NAVIGATION_ITEM_CATEGORY[e.item] === id)
        .map((e) => (full ? { item: e.item, explanation: e.explanation, pillar: g.label } : { item: e.item, explanation: e.explanation })),
    ),
  })).filter((c) => c.entries.length > 0);
  const desks = dashboardTabsFor(u, u.councilId).map((t) => ({
    id: t.id,
    label: t.label,
    summary: DESK_TAB_SUMMARIES[t.id],
    sections: full ? deskSections(u, t.id, flags, tenant) : [],
  }));
  const phoneTabs = PHONE_TABS.filter((tab) => mobileTabEnabled(PHONE_TAB_SUMMARIES[tab].route, flags)).map((tab) => ({ tab, summary: PHONE_TAB_SUMMARIES[tab].summary }));
  return { depth, categories, desks, phoneTabs };
}
