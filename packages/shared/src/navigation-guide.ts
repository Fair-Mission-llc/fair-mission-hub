// =========================================================================
// NAVIGATION GUIDE (Sprint 7C Extension)
//
// The "Navigation Explained" help page (/navigation-guide), pinned above the sidebar pillars for every member. It reads
// the signed-in member's type and Role names, works out the same sidebar the portal draws (portalSidebar, so the feature
// flags and the tenant gate apply too), and explains each visible link in one plain-English sentence.
//
// The guide never lists a link the viewer cannot open, so an ordinary member's guide carries no administrative or
// financial desks. A few links that everyone sees read differently for council leadership (an Admin, a seated officer or
// a Super Admin), who can do more there; an ordinary member always gets the member wording.
//
// Sprint 7E: the guide also lists the time limits that apply to the viewer right now (navigationTimings): their own
// council's settings and the platform's, read live, so the page never quotes a fixed number. Council leadership also
// sees the settings saved for future features, marked as not used yet.
// =========================================================================
import {
  COUNCIL_WIDE_SETTING_NAMES,
  COUNCIL_WIDE_SETTING_RULES,
  councilWideSettings,
  formatSettingValue,
  PLATFORM_SETTING_NAMES,
  PLATFORM_SETTING_RULES,
  platformSettings,
  SETTING_GROUPS,
  type SettingGroupId,
  type SettingRule,
} from './council-settings';
import type { SessionUser } from './contract';
import { ALL_FEATURES_ON, type FeatureFlags } from './features';
import { isAdmin, isSuperAdmin, portalAreas, portalSidebar, type PortalNavGroup, type PortalNavItem } from './permissions';
import { DEFAULT_TENANT_TYPE, type TenantType } from './tenant';
import type { Council, PlatformSettings } from './types';

type Viewer = Pick<SessionUser, 'memberId' | 'councilId' | 'memberType' | 'isOfficer'> & { roles?: readonly string[]; isBudgetDirector?: boolean };

/** What a link does: `member` for everyone, `leader` (when given) instead for council leadership. */
export interface NavigationExplanation {
  member: string;
  leader?: string;
}

/** One plain-English sentence per sidebar link. */
export const NAVIGATION_EXPLANATIONS: Record<PortalNavItem, NavigationExplanation> = {
  'meetings/live': { member: 'Runs a council meeting live: the agenda, member check-ins, secret ballots and the hand-vote recorder.' },
  'meetings/cadence': { member: "Sets the council's standing meeting pattern and builds the year's meeting calendar." },
  meetings: {
    member: 'Shows upcoming meetings. Answer your invitations here and read the minutes after a meeting.',
    leader: 'Shows upcoming meetings. Schedule a meeting, send invitations, answer your own and read or file the minutes.',
  },
  elections: { member: 'Nominates a brother Knight for an elected council office.' },
  'elections/appointments': { member: "Shows the Grand Knight's appointed positions and fills the empty seats." },
  'governance/bylaws': {
    member: "Reads the council's own bylaws, article by article.",
    leader: "Reads the council's own bylaws, article by article. The keepers of the bylaws edit them here.",
  },
  'governance/advisor': { member: 'Answers a parliamentary question with a citation from the bylaws or the baseline rules.' },
  activities: { member: "Keeps the council's list of standing activities, such as ushering or the food drive." },
  'member-actions': { member: 'Your home page: your shifts, sign-ups, the member roster and your logged service hours.' },
  events: { member: 'Plans an event: its dates, shifts, sign-up targets and linked councils.' },
  calendar: { member: 'Shows every event, shift and meeting on a monthly calendar.' },
  'faith-center': { member: "Shows today's feast day, the daily Bible verse and the Council Prayer Intentions List." },
  'finance/ledger': { member: 'Shows the chart of accounts and every posting to the general ledger.' },
  'finance/balance-sheet': { member: "Shows the council's assets against its liabilities and equity." },
  'finance/dashboard': { member: 'Shows account balances, transfers between accounts and the bank statement checks.' },
  'finance/audit': { member: 'The semiannual Trustee audit: Trustees check the ledger lines, then sign and lock the audit.' },
  'finance/treasurer-desk': { member: 'The Treasurer assigns each ordered expense report to a budget line and a ledger account.' },
  expenses: { member: 'Files your own expense reports with receipts and shows where each report is in the approval steps.' },
  'expenses/disbursements': { member: 'Pays fully signed expense reports by check.' },
  'expenses/audit': { member: 'The Financial Secretary checks each submitted expense report and issues the written order.' },
  'expenses/authorize': { member: 'The Grand Knight counter-signs each ordered expense report.' },
  'charities/vetting': { member: 'Claims, checks and moves forward the charity grant requests that members bring to the council.' },
  'charities/propose': { member: 'Brings a charity or organization to the council for a grant and follows the request to its decision.' },
  'charities/queue': { member: 'Pays approved charity grants by check.' },
  donations: { member: 'Records the donations the council receives and lists past donations.' },
  'financials/budget': {
    member: "Reads the council's annual budget.",
    leader: "Reads the council's annual budget. Budget keepers draft it from May 1 to June 30 and approve it.",
  },
  'member-center': { member: "Shows the council's volunteers, hours, devotions and Top 5 leaderboard, and your own impact card." },
  dashboard: { member: "Opens the Home desk: leadership's status badges and the Executive Summary of Faith in Action work, monthly hours, members and funds." },
  'performance/charts': { member: 'Charts membership growth and council service hours by month.' },
  history: { member: "Shows each year's officers, the council's achievements and the recorded oral histories. Record your own story here." },
  ledger: {
    member: 'Shows the results of past events: funds raised, hours and lessons learned.',
    leader: 'Shows the results of past events and records them: funds raised, hours and lessons learned.',
  },
  'lessons-registry': { member: 'Searches the lessons learned that councils recorded after their events.' },
  gallery: { member: 'Shows event photos and slideshows. Add your own photos here.' },
  'resources/bulletins': { member: "Opens the council's Google Drive files and the reports the portal prepares." },
  'resources/marketing': { member: 'Turns an event into a printable flyer with photos from past events.' },
  help: { member: 'Searches answers from the user manuals and sends feedback.' },
  'answers/help': { member: 'Type what you want to do and see the steps from the member guide.' },
  'answers/sop': { member: "Reads the council's standard operating procedures." },
  councils: { member: 'Adds, edits and deletes councils and their registration details.' },
  'feature-flags': { member: "Switches each council's optional modules on and off." },
  'system-settings/global-settings': {
    member:
      "Sets each council's base dues rate and organization type, and the settings every council shares: the meeting invitation lead time, the sign-in length, and the recording and character limits.",
  },
  'system-settings/remote-assistance': {
    member: 'Shows the screens officers and Admins share when they click Request Remote Officer Assistance, so you can guide them.',
  },
  'system-settings/impersonate': {
    member: 'Finds any member in any council by typing a name, or by opening a council, then a role group. Click View as to see the portal as that member, read-only.',
  },
  'system-settings/council-settings': {
    member:
      "Sets the council's own numbers in three cards: the expense filing window, the volunteer time limits and logging window, and the hours reminder timing. Click (i) beside a field for what it does.",
  },
  members: { member: "Keeps the council's member roster: member types, roles and skills." },
  'supreme-sync': { member: 'Checks and files the Supreme Council reports (Forms 1728 and 1295) and syncs the roster.' },
  'council-lookups': { member: "Keeps the council's own lists: activities, donation types, payment methods and agenda templates." },
  'credentials-vault': { member: "Connects the council's email account and Google Drive." },
  'charities/registry': { member: 'Searches the shared list of charities and adds new ones.' },
  lookups: { member: 'Keeps the lists every council shares, such as categories and member types.' },
  parishes: { member: 'Keeps the parishes linked to the council and their pastors.' },
};

/** The links in the header bar, which every member has: they are not in the sidebar, so the guide lists them apart. */
export const TOP_BAR_EXPLANATIONS: Record<'messages' | 'distribution-lists' | 'profile', string> = {
  messages: 'Messaging menu: your message threads, team messages and council alerts.',
  'distribution-lists': 'Messaging menu: your own lists of members to message together, and the council-wide lists.',
  profile: 'Your name menu: your photo, biography, contact details and skills.',
};

export type NavigationPersona = 'Super Admin' | 'Council Admin' | 'Council Officer' | 'Member';

/** Council leadership for the guide's wording: an Admin, a seated officer or a Super Admin. */
export const isNavigationLeader = (u: Viewer): boolean => isAdmin(u) || u.isOfficer;

/** The viewer's persona, read from the member type and then the officer Role flag. */
export function navigationPersona(u: Viewer): NavigationPersona {
  if (isSuperAdmin(u)) return 'Super Admin';
  if (u.memberType === 'Admin') return 'Council Admin';
  if (u.isOfficer) return 'Council Officer';
  return 'Member';
}

const PERSONA_SUMMARY: Record<NavigationPersona, string> = {
  'Super Admin': 'You see every page, including the settings that every council shares.',
  'Council Admin': "You see the member pages and your council's leadership, finance and setup pages.",
  'Council Officer': 'You see the member pages and the leadership pages that your office uses.',
  Member: 'You see the pages every member uses. Leadership pages are not shown to you.',
};

export interface NavigationGuideEntry {
  item: PortalNavItem;
  explanation: string;
}

export interface NavigationGuideGroup extends Pick<PortalNavGroup, 'id' | 'label'> {
  entries: NavigationGuideEntry[];
}

export interface NavigationGuide {
  persona: NavigationPersona;
  /** The Role names the viewer holds, sorted, e.g. ['Grand Knight']. */
  roles: string[];
  summary: string;
  groups: NavigationGuideGroup[];
  topBar: { item: keyof typeof TOP_BAR_EXPLANATIONS; explanation: string }[];
}

/** One live time limit on the guide (Sprint 7E). */
export interface NavigationTimingLine {
  name: string;
  label: string;
  /** The value with its unit, e.g. '30 days'. */
  value: string;
  /** What it does, in one sentence (the setting's hint). */
  hint: string;
  group: SettingGroupId;
  groupTitle: string;
  /** 'council' for the viewer's council's own setting, 'platform' for one every council shares. */
  scope: 'council' | 'platform';
  inUse: boolean;
}

/** The time limits shown to everyone: the ones a member meets when logging time, filing expenses or answering invitations. */
const MEMBER_TIMINGS = new Set<string>([
  'er_submission_window_days',
  'volunteer_logging_window_days',
  'reminder_delay_days',
  'reminder_cadence_days',
  'cadence_invitation_horizon_days',
  'user_session_expiry_hours',
]);

/** Settings in days or hours: the guide's time limits. */
const isTiming = (unit: string) => unit === 'days' || unit === 'hours';

/**
 * The time limits in force for `u` (Sprint 7E), from their council's stored settings and the platform row, read live.
 * Every member sees the ones they meet themselves; council leadership sees every timing setting, including those saved
 * for future features (inUse false).
 */
export function navigationTimings(
  u: Viewer,
  council: Partial<Council> | null | undefined,
  platform: Partial<PlatformSettings> | null | undefined,
): NavigationTimingLine[] {
  const leader = isNavigationLeader(u);
  const councilValues = councilWideSettings(council);
  const platformValues = platformSettings(platform);
  const lines: NavigationTimingLine[] = [];
  const add = (name: string, rule: SettingRule, value: number, scope: 'council' | 'platform') => {
    if (!isTiming(rule.unit) || (!leader && !MEMBER_TIMINGS.has(name))) return;
    lines.push({
      name,
      label: rule.label,
      value: formatSettingValue(rule, value),
      hint: rule.hint,
      group: rule.group,
      groupTitle: SETTING_GROUPS[rule.group].title,
      scope,
      inUse: rule.inUse,
    });
  };
  for (const name of COUNCIL_WIDE_SETTING_NAMES) add(name, COUNCIL_WIDE_SETTING_RULES[name], councilValues[name], 'council');
  for (const name of PLATFORM_SETTING_NAMES) add(name, PLATFORM_SETTING_RULES[name], platformValues[name], 'platform');
  // In use first, then by card, keeping the settings' own order inside a card.
  const order = (l: NavigationTimingLine) => (l.inUse ? 0 : 10) + ['financial', 'operations', 'reminders', 'security', 'limits'].indexOf(l.group);
  return lines.map((l, i) => ({ l, i })).sort((a, b) => order(a.l) - order(b.l) || a.i - b.i).map(({ l }) => l);
}

/** The guide for `u`: their own sidebar, pillar by pillar, each link with its explanation, then the header links. */
export function navigationGuide(u: Viewer, flags: FeatureFlags = ALL_FEATURES_ON, tenant: TenantType = DEFAULT_TENANT_TYPE): NavigationGuide {
  const leader = isNavigationLeader(u);
  const persona = navigationPersona(u);
  const allowed = new Set<string>(portalAreas(u, flags, tenant));
  return {
    persona,
    roles: [...(u.roles ?? [])].sort(),
    summary: PERSONA_SUMMARY[persona],
    groups: portalSidebar(u, flags, tenant).map(({ id, label, entries }) => ({
      id,
      label,
      entries: entries.map(({ item }) => {
        const text = NAVIGATION_EXPLANATIONS[item];
        return { item, explanation: (leader && text.leader) || text.member };
      }),
    })),
    topBar: (Object.keys(TOP_BAR_EXPLANATIONS) as (keyof typeof TOP_BAR_EXPLANATIONS)[])
      .filter((item) => allowed.has(item))
      .map((item) => ({ item, explanation: TOP_BAR_EXPLANATIONS[item] })),
  };
}
