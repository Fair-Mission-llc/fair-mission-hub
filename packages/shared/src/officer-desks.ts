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
// =========================================================================
import type { CalendarEntry, SessionUser } from './contract';
import { observancesBetween, liturgicalBanner, type Observance } from './liturgical';
import { canOpenExpenseAuditDesk, canOpenExpenseAuthorizeDesk, canOpenTreasurerDesk } from './permissions';
import { addDays } from './planning';
import type { NotificationLog } from './types';

type Actor = Pick<SessionUser, 'memberId' | 'councilId' | 'memberType' | 'isOfficer'> & { roles?: readonly string[] };

export type DashboardTabId = 'home' | 'grand-knight' | 'financial-secretary' | 'treasurer' | 'member';

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
  { id: 'member', label: 'Member Desk', anchor: 'member' },
];

/** The tabs this reader gets on the council's dashboard: Home and the Member Desk always, each officer desk by its gate. */
export function dashboardTabsFor(u: Actor, councilId: number): DashboardTab[] {
  const cleared: Record<DashboardTabId, boolean> = {
    home: true,
    'grand-knight': canOpenExpenseAuthorizeDesk(u, councilId),
    'financial-secretary': canOpenExpenseAuditDesk(u, councilId),
    treasurer: canOpenTreasurerDesk(u, councilId),
    member: true,
  };
  return DASHBOARD_TABS.filter((t) => cleared[t.id]);
}

/** The tab a URL fragment ('#treasurer' or 'treasurer') names, when the reader has it; otherwise Home. */
export function dashboardTabFromAnchor(hash: string | null | undefined, tabs: readonly DashboardTab[]): DashboardTabId {
  const anchor = String(hash ?? '').replace(/^#/, '').trim().toLowerCase();
  return tabs.find((t) => t.anchor === anchor)?.id ?? 'home';
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
  desk(q.counterSignature, 'desk-gk', 'Release vouchers for payment', '/expenses/authorize');
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
