// =========================================================================
// THE TABBED DASHBOARD AND THE OFFICER DESKS (Sprint 7J, schema version 71)
// Pure helpers behind /dashboard's tab row: which tabs a reader gets, the URL anchor of each tab, and the Home tab's
// widgets - the live actionable reminders stream, the feast-day tracker and today's agenda.
//
// Home is every dashboard reader's. Each Officer Desk is cleared by the same gate as the full desk page it summarizes,
// so a tab never shows a queue its reader could not open:
//   - Grand Knight Desk        canOpenExpenseAuthorizeDesk (the Voucher Release queue at /expenses/authorize)
//   - Financial Secretary Desk canOpenExpenseAuditDesk     (the written-order queue at /expenses/audit, the roster imports)
//   - Treasurer Desk           canOpenTreasurerDesk        (the Ledger Line Coder queue at /finance/treasurer-desk)
//   - Member Desk              every dashboard reader      (their own expense sheets and coming shifts)
// The sidebar is not changed: every desk page stays reachable from it.
//
// Sprint 8A (schema version 73): the tab row is titled Active Desks. Home becomes a no-scroll cockpit of status
// badges, so the work it used to hold moves onto two more desks:
//   - Oversight Desk           canReviewVolunteerQuarantine (the Volunteer Time Quarantine Desk; for a Super Admin also
//                                                           the Inbound Council Mail Center)
//   - Reports Desk             every dashboard reader      (the full Executive Summary, roadmap and personnel audits)
// landingRouteFor names where the portal root sends a signed-in reader.
//
// Sprint 8B (schema version 74): two seat desks (recorder-historian.ts):
//   - Recorder Desk            canOpenRecorderDesk         (the Meeting Minutes Entry Desk and the live meeting launch)
//   - Historian Desk           canOpenHistorianDesk        (the Digital Fraternal Annals Scrapbook)
// A Council Historian without an officer seat or Admin keys opens /dashboard for the Historian Desk alone: Home and
// the Reports Desk stay with the executive readers (isHistorianDeskOnly).
//
// Sprint 8C (schema version 75): the Reports Desk is dismantled. Its Executive Summary - the month's charts, the ledger
// table, budget and mission tracking and the no-show audit - merges into Home, the Executive Dashboard's own canvas, in a
// frame that scrolls inside itself so Home still fits one screen. The Shifts Awaiting Hours audit consolidates onto the
// Oversight Desk, which every executive-audit reader now opens (canOpenOversightDesk); the Volunteer Time Quarantine
// stays with its own reviewers inside it. The sidebar's Executive Dashboard link always opens Home
// (EXECUTIVE_DASHBOARD_HOME_HREF), and each Home status badge names the desk row it opens (DESK_FOCUS_TARGETS).
//
// Sprint 8D/8E (schema version 76): Home holds only the universal cards (HOME_UNIVERSAL_CARDS) - the Bible Verse of the
// Day, the Live Actionable Reminders, the Liturgical Feast Day Tracker, Today's Event Agenda, the Open Volunteer Shifts
// signup grid and the Top 5 Fraternal Volunteers leaderboard of the month - in one screen with no scrolling. The desk
// status badges move to the top of the Oversight Desk. The Executive Summary leaves Home for its own page,
// /executive-dashboard (EXECUTIVE_DASHBOARD_HREF), the sidebar's Executive Dashboard link.
//
// Sprint 8L (schema version 82): Omnipresent Officer Desks. Every advanced module a seat works in is mounted as a folder
// at the top of its Active Desk (DESK_MODULES), so the desks never send anyone to the sidebar for it. Each folder is
// cleared by the module's own portal area, exactly as its full page is. Home gains a seventh universal card, the
// Community Prayer Request List (COMMUNITY_PRAYER_CARD_TITLE), over the council's open prayer intentions; like the verse
// and the feast tracker it is Faith Center content.
// =========================================================================
import type { CalendarEntry, SessionUser, ShiftFeedItem } from './contract';
import { observancesBetween, liturgicalBanner, type Observance } from './liturgical';
import type { FeatureFlags } from './features';
import {
  type PortalArea,
  canOpenExpenseAuditDesk,
  canOpenExpenseAuthorizeDesk,
  canOpenTreasurerDesk,
  canReviewVolunteerQuarantine,
  canViewExecutiveAudits,
  isAdmin,
  portalAreas,
} from './permissions';
import { addDays } from './planning';
import { isShiftFull, visibleFeed } from './presentation';
import { canOpenHistorianDesk, canOpenRecorderDesk } from './recorder-historian';
import { isPlatformOwner, SUPER_ADMIN_DESK_TITLE } from './super-admin-desk';
import type { TenantType } from './tenant';
import type { NotificationLog } from './types';

type Actor = Pick<SessionUser, 'memberId' | 'councilId' | 'memberType' | 'isOfficer'> & { roles?: readonly string[]; username?: string };

export type DashboardTabId = 'home' | 'grand-knight' | 'financial-secretary' | 'treasurer' | 'recorder' | 'historian' | 'oversight' | 'member' | 'super-admin';

export interface DashboardTab {
  id: DashboardTabId;
  label: string;
  /** The URL fragment that opens the tab: /dashboard#<anchor>. */
  anchor: string;
}

/** Every tab, in the order the tab row shows them. */
export const DASHBOARD_TABS: readonly DashboardTab[] = [
  { id: 'home', label: 'Home', anchor: 'home' },
  { id: 'grand-knight', label: 'Grand Knight Desk', anchor: 'grand-knight' },
  { id: 'financial-secretary', label: 'Financial Secretary Desk', anchor: 'financial-secretary' },
  { id: 'treasurer', label: 'Treasurer Desk', anchor: 'treasurer' },
  { id: 'recorder', label: 'Recorder Desk', anchor: 'recorder' },
  { id: 'historian', label: 'Historian Desk', anchor: 'historian' },
  { id: 'oversight', label: 'Oversight Desk', anchor: 'oversight' },
  { id: 'member', label: 'Member Desk', anchor: 'member' },
  // Sprint 8O: the platform owner's own cockpit (super-admin-desk.ts isPlatformOwner), drawn last and apart.
  { id: 'super-admin', label: SUPER_ADMIN_DESK_TITLE, anchor: 'super-admin' },
];

/**
 * Sprint 8B: a Council Historian who holds no officer seat and no Admin keys. Their seat opens /dashboard for the
 * Historian Desk only (and their own Member Desk), never Home's council figures.
 */
export const isHistorianDeskOnly = (u: Actor): boolean => !isAdmin(u) && !u.isOfficer && canOpenHistorianDesk(u, u.councilId);

/**
 * The Oversight Desk (Sprint 8C): the Volunteer Time Quarantine's reviewers (canReviewVolunteerQuarantine) and every
 * executive-audit reader (canViewExecutiveAudits), who find the Shifts Awaiting Hours audit there. The quarantine queue
 * and the Inbound Council Mail Center keep their own gates inside the desk.
 */
export const canOpenOversightDesk = (u: Actor, councilId: number): boolean =>
  canReviewVolunteerQuarantine(u, councilId) || canViewExecutiveAudits(u, councilId);

/**
 * The tabs this reader gets on the council's dashboard: Home and Member always (Home not for a Historian-only reader),
 * each other desk by its gate. Sprint 8C: the Reports Desk merged into Home.
 */
export function dashboardTabsFor(u: Actor, councilId: number): DashboardTab[] {
  const executive = !isHistorianDeskOnly(u);
  const cleared: Record<DashboardTabId, boolean> = {
    home: executive,
    'grand-knight': canOpenExpenseAuthorizeDesk(u, councilId),
    'financial-secretary': canOpenExpenseAuditDesk(u, councilId),
    treasurer: canOpenTreasurerDesk(u, councilId),
    recorder: canOpenRecorderDesk(u, councilId),
    historian: canOpenHistorianDesk(u, councilId),
    oversight: canOpenOversightDesk(u, councilId),
    member: true,
    'super-admin': isPlatformOwner(u),
  };
  return DASHBOARD_TABS.filter((t) => cleared[t.id]);
}

/** The tab a URL fragment ('#treasurer' or 'treasurer') names, when the reader has it; otherwise their first tab (Home). */
export function dashboardTabFromAnchor(hash: string | null | undefined, tabs: readonly DashboardTab[]): DashboardTabId {
  const anchor = String(hash ?? '').replace(/^#/, '').trim().toLowerCase();
  return tabs.find((t) => t.anchor === anchor)?.id ?? tabs[0]?.id ?? 'home';
}

/** The title of the frame's tab row (Sprint 8A). */
export const ACTIVE_DESKS_TITLE = 'Active Desks';

/**
 * Where the sidebar's Executive Dashboard link goes. Sprint 8C sent it to the Home landing deck (/dashboard#home); since
 * Sprint 8D/8E it is the Executive Summary's own page, off the Active Desks.
 */
export const EXECUTIVE_DASHBOARD_HREF = '/executive-dashboard';

/**
 * The cards on Home (Sprint 8D/8E), in display order - nothing else sits there. The verse and the feast tracker are Faith
 * Center content, so a council with the Faith Center off (or a white-label tenant) sees the other four.
 */
export const HOME_UNIVERSAL_CARDS = [
  'Bible Verse of the Day',
  'Live Actionable Reminders',
  'Liturgical Feast Day Tracker',
  "Today's Event Agenda",
  'Open Volunteer Shifts',
  'Top 5 Fraternal Volunteers',
  'Community Prayer Request List',
] as const;

/** The Home card over the council's open prayer intentions (Sprint 8L). */
export const COMMUNITY_PRAYER_CARD_TITLE = '📿 Community Prayer Request List';

/** One module folder mounted on an Active Desk (Sprint 8L): its title, the portal area that clears it, and its desk row. */
export interface DeskModuleSpec {
  desk: DashboardTabId;
  title: string;
  /** One line shown on the closed folder. */
  summary: string;
  /** The module's own portal area: the folder shows only to readers who may open it (portalAreas). */
  area: PortalArea;
  /** The DeskRow id, so a link can bring the folder into view. */
  rowId: string;
}

/** Every module folder on the Active Desks (Sprint 8L), in display order per desk. */
export const DESK_MODULES: readonly DeskModuleSpec[] = [
  { desk: 'grand-knight', title: 'Charitable Grant Requests Vetting Board', summary: 'Claim, question and advance charity grant requests', area: 'charities/vetting', rowId: 'module-vetting-board' },
  { desk: 'grand-knight', title: 'Constitutional Advisor Panels', summary: 'Ask a parliamentary or bylaws question', area: 'governance/advisor', rowId: 'module-advisor' },
  { desk: 'grand-knight', title: 'Connected Councils', summary: 'Invite and answer nearby councils', area: 'system-settings/affiliations', rowId: 'module-connected-councils' },
  { desk: 'financial-secretary', title: 'Semiannual Audit Form 1295 Center', summary: "The Trustees' step-by-step audit and the Form 1295 PDF", area: 'finance/audit', rowId: 'module-form-1295' },
  { desk: 'financial-secretary', title: 'Charity Check Issuance Console', summary: 'Pay approved charity requests and gifts by check', area: 'charities/queue', rowId: 'module-charity-checks' },
  { desk: 'treasurer', title: 'Annual Budget vs Actuals Ledger Grid', summary: 'Budgeted vs actual spend and the YOY variance analyzer', area: 'finance/dashboard', rowId: 'module-budget-vs-actuals' },
  { desk: 'treasurer', title: 'Bank Statement Match-Window', summary: 'Match a bank statement CSV against the ledger', area: 'finance/dashboard', rowId: 'module-bank-match' },
  { desk: 'recorder', title: 'Council Resolutions and Motions Ledger', summary: "Every motion of this fraternal year's meetings and its result", area: 'meetings', rowId: 'module-motions-ledger' },
  { desk: 'historian', title: 'Google Drive Media Gallery Sync Board', summary: 'Upload, tag and file photos to the Drive media vault', area: 'gallery', rowId: 'module-media-gallery' },
];

/** The module folders of one desk, in display order. */
export const deskModulesFor = (desk: DashboardTabId): DeskModuleSpec[] => DESK_MODULES.filter((m) => m.desk === desk);

/**
 * A desk status badge's queue (Sprint 8A badges; Sprint 8C names the desk row each one opens). Sprint 8D/8E: the badges
 * sit at the top of the Oversight Desk, no longer on Home.
 */
export type DeskBadgeKey = 'vouchers' | 'orders' | 'coding' | 'minutes' | 'quarantine' | 'access' | 'hours' | 'mine';

/**
 * Sprint 8C click-through badges: the Active Desk each Home badge switches to and the id of the workspace row on that desk
 * it scrolls to and highlights.
 */
export const DESK_FOCUS_TARGETS: Record<DeskBadgeKey, { anchor: DashboardTabId; rowId: string }> = {
  vouchers: { anchor: 'grand-knight', rowId: 'desk-row-voucher-release' },
  orders: { anchor: 'financial-secretary', rowId: 'desk-row-written-orders' },
  coding: { anchor: 'treasurer', rowId: 'desk-row-ledger-coding' },
  minutes: { anchor: 'recorder', rowId: 'desk-row-minutes' },
  quarantine: { anchor: 'oversight', rowId: 'desk-row-quarantine' },
  access: { anchor: 'oversight', rowId: 'desk-row-mail-center' },
  hours: { anchor: 'oversight', rowId: 'desk-row-awaiting-hours' },
  mine: { anchor: 'member', rowId: 'desk-row-my-sheets' },
};

/**
 * Where the portal root (/) sends a signed-in reader (Sprint 8A): anyone holding an officer seat or Admin keys, and
 * anyone else whose seat opens the dashboard, lands on the /dashboard Active Desks hub; plain members keep the member hub.
 */
export function landingRouteFor(u: Actor, flags?: FeatureFlags, tenant?: TenantType): '/dashboard' | '/member-actions' {
  if (isAdmin(u) || u.isOfficer) return '/dashboard';
  return portalAreas(u, flags, tenant).includes('dashboard') ? '/dashboard' : '/member-actions';
}

// ---- the Member Desk cards (Sprint 8C) ---------------------------------------------------------------

/** How far ahead the Member Desk's Open Shifts Needing Volunteers card looks: the phone Signup Desk's 30 days. */
export const MEMBER_DESK_OPEN_SHIFT_DAYS = 30;

/**
 * The '🚗 Open Shifts Needing Volunteers' card: shifts from today through `MEMBER_DESK_OPEN_SHIFT_DAYS` days on, at events
 * linked to the member's councils, that are still short of their minimum volunteers and that the member does not hold
 * yet - the pilot's parish parking fundraiser rows among them. Soonest first, as the shift feed orders them.
 */
export function memberDeskOpenShifts(feed: readonly ShiftFeedItem[], today: string, days: number = MEMBER_DESK_OPEN_SHIFT_DAYS): ShiftFeedItem[] {
  const through = addDays(today, days);
  return visibleFeed(feed, { councilId: 'all', showLocked: false, hideSignedUp: true }).filter(
    (item) => !isShiftFull(item.shift) && item.shift.ShiftDate.slice(0, 10) >= today && item.shift.ShiftDate.slice(0, 10) <= through,
  );
}

// ---- the live actionable reminders stream ----------------------------------------------------------

/** How many reminders the Home widget lists; the alert bell keeps the full log. */
export const REMINDER_STREAM_LIMIT = 8;

export interface ActionableReminder {
  key: string;
  title: string;
  detail: string;
  /** 'High' first, then 'Medium', then 'Low'. */
  priority: 'High' | 'Medium' | 'Low';
  /** Where the reader acts on it, or null for an alert with nowhere to go. */
  href: string | null;
}

/** The sheets waiting at each signature, for the desks the reader is cleared for (undefined: not cleared). */
export interface DeskQueueCounts {
  writtenOrder?: number;
  ledgerCoding?: number;
  counterSignature?: number;
}

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 } as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The Home tab's reminders: one line for each cleared desk with sheets waiting, then the reader's unread alerts, newest
 * first. Desk lines come first because they need a signature; the list stops at `limit`.
 */
export function buildReminderStream(
  input: { alerts: readonly NotificationLog[]; readIds?: ReadonlySet<number>; queues?: DeskQueueCounts },
  limit: number = REMINDER_STREAM_LIMIT,
): ActionableReminder[] {
  const out: ActionableReminder[] = [];
  const q = input.queues ?? {};
  const desk = (count: number | undefined, key: string, title: string, href: string) => {
    if (count && count > 0) out.push({ key, title, detail: `${plural(count, 'expense sheet waits', 'expense sheets wait')} for your signature.`, priority: 'High', href });
  };
  desk(q.writtenOrder, 'desk-fs', 'Verify & sign expense orders', '/expenses/audit');
  desk(q.ledgerCoding, 'desk-treasurer', 'Categorize & lock expenses to the ledger', '/finance/treasurer-desk');
  desk(q.counterSignature, 'desk-gk', 'Release approved expenses for payment', '/expenses/authorize');
  const unread = input.alerts
    .filter((a) => !a.IsRead && !(input.readIds?.has(a.id) ?? false))
    .slice()
    .sort((a, b) => PRIORITY_ORDER[a.Priority] - PRIORITY_ORDER[b.Priority] || String(b.SentAt).localeCompare(String(a.SentAt)) || b.id - a.id);
  for (const a of unread) out.push({ key: `alert-${a.id}`, title: a.Title, detail: a.MessageBody, priority: a.Priority, href: null });
  return out.slice(0, Math.max(0, limit));
}

// ---- the liturgical feast-day tracker ----------------------------------------------------------------

/** How far ahead the tracker looks for feasts and holy days. */
export const FEAST_TRACKER_DAYS = 30;

export interface FeastDayTracker {
  /** Today's line, as the phone banner prints it. */
  today: { text: string; holyDayOfObligation: boolean; note: string | null };
  /** The coming liturgical days (national holidays left out), soonest first, with how many days away. */
  upcoming: (Observance & { daysAway: number })[];
}

const dayNumber = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000;

export function feastDayTracker(today: string, days: number = FEAST_TRACKER_DAYS): FeastDayTracker {
  const upcoming = observancesBetween(addDays(today, 1), addDays(today, days))
    .filter((o) => o.kind !== 'holiday')
    .map((o) => ({ ...o, daysAway: dayNumber(o.date) - dayNumber(today) }));
  return { today: liturgicalBanner(today), upcoming };
}

// ---- today's event agenda ----------------------------------------------------------------------------

/** The calendar entries that fall on `today` (multi-day events included), timed meetings by start time after all-day events. */
export function todaysAgenda(entries: readonly CalendarEntry[], today: string): CalendarEntry[] {
  return entries
    .filter((e) => e.startDate <= today && e.endDate >= today)
    .slice()
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.title.localeCompare(b.title) || a.id - b.id);
}
