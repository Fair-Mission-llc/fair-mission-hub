// =========================================================================
// THE ADMIN DESK AND THE SPRINT 11 REVISION 2.0 CALIBRATIONS (schema 102, no table change)
//
// The Admin Desk (/admin-desk) is a council Admin's own workspace (Super Admins included, canOpenAdminDesk).
//
// Sprint 11 Revision 3.0: the desk has two parts.
//   - The Static Top Deck (ADMIN_DESK_TOP_PANELS): three panels in a row at the top of the page. They never collapse.
//       A. Council Instance Identity Record   the home council's name, number, state, EIN and contact (councils.get)
//       B. Administration Manual PDF          the compiled ADMIN_USER_GUIDE.pdf and 'Regenerate Manuals On-Demand'
//       C. 'How Do I...' Local Help Search    the Administration Manual's task workflows (GET /api/manuals?manual=admin)
//   - The left rail of drawers (ADMIN_DESK_DRAWERS), below the deck, all closed on landing. A drawer opens its panel to
//     the right of the rail. In this exact order:
//       1. Council Wide Settings             the /system-settings/council-settings module (Standard Bank Accounts first)
//       2. Council Lookup Tables             the /council-lookups module (Active/Inactive status on every grid)
//       3. Credentials Vault                 pinned to the reader's home council (the server's vault gate says the same)
//       4. Global Charities Registry         the /charities/registry module (verified panel, search and filters)
//       5. Council Asset Management          the /expenses/assets inventory (Trustees add asset photos)
//       6. Administrative Feedback Loops     the note to the platform owner (feedback.submit)
// The server also rebuilds every manual each night (apps/web/instrumentation.ts, nextNightlyManualRebuild).
//
// The rest of this file holds the small pure rules the wave added elsewhere:
//   - monthlyActivityFigures: the Monthly Activity card and the Net Balance tile read the same MonthlySummary figures.
//   - orderPaymentMethodRows: the Check payment method is always row 3 of the Council Lookups payment grid.
//   - canBroadcastToDistributionGroups: the built-in 'All Members' and 'Active Officers' (leadership) lists are for
//     officers, Admins and Super Admins only; the drivers refuse anyone else (assertMayBroadcastToDistributionGroups).
//   - eventAttendeeRecipientIds / canMessageEventAttendees: the calendar's 'Message All Attendants' button.
//   - plainNavLabel: the sidebar draws its labels as plain text, without icon glyphs.
// =========================================================================
import type { MonthlySummary, VolunteerTurnout } from './contract';
import { donationMethodKind, SecurityPrivilegeError } from './rules';
import type { FeatureFlagName, FeatureFlags } from './features';

export const ADMIN_DESK_HREF = '/admin-desk';
export const ADMIN_DESK_TITLE = 'Admin Desk';

export type AdminDeskTopPanelId = 'council-identity' | 'admin-manual' | 'help-search';

export interface AdminDeskTopPanel {
  id: AdminDeskTopPanelId;
  /** 'A', 'B' or 'C', left to right. */
  tier: string;
  label: string;
  hint: string;
}

/** The Static Top Deck's three panels, left to right. They are always open. */
export const ADMIN_DESK_TOP_PANELS: readonly AdminDeskTopPanel[] = [
  { id: 'council-identity', tier: 'A', label: 'Council Instance Identity Record', hint: 'The council this desk works on' },
  { id: 'admin-manual', tier: 'B', label: 'Administration Manual PDF', hint: 'Open the printed Administration Manual, or rebuild every manual now' },
  { id: 'help-search', tier: 'C', label: "'How Do I...' Local Help Search", hint: 'Search the Administration Manual for the steps of a task' },
];

export type AdminDeskDrawerId =
  | 'council-settings'
  | 'council-lookups'
  | 'credentials-vault'
  | 'charities-registry'
  | 'asset-management'
  | 'feedback';

export interface AdminDeskDrawer {
  id: AdminDeskDrawerId;
  label: string;
  hint: string;
}

/** The six Admin Desk drawers below the top deck, top to bottom. Every one starts closed. */
export const ADMIN_DESK_DRAWERS: readonly AdminDeskDrawer[] = [
  { id: 'council-settings', label: 'Council Wide Settings', hint: 'Standard bank accounts, limits, timing, roster control and the feature matrix' },
  { id: 'council-lookups', label: 'Council Lookup Tables', hint: 'Activities, donation types and payment methods, each Active or Inactive' },
  { id: 'credentials-vault', label: 'Credentials Vault', hint: "Your home council's email, Drive and file server keys" },
  { id: 'charities-registry', label: 'Global Charities Registry', hint: 'Browse, filter, verify and add charities' },
  { id: 'asset-management', label: 'Council Asset Management', hint: "The council's capital assets and the Trustees' asset photos" },
  { id: 'feedback', label: 'Administrative Feedback Loops', hint: 'Send a note or bug report to the platform owner' },
];

/** Sprint 11 Revision 7.0: the drawers a premium module switch hides when it is off. */
export const ADMIN_DESK_DRAWER_FLAGS: Partial<Record<AdminDeskDrawerId, FeatureFlagName>> = {
  'charities-registry': 'feature_charity_registry',
  'asset-management': 'feature_capital_assets',
};

/** The drawers a council's switches leave on the desk, in order. */
export const adminDeskDrawersFor = (flags: FeatureFlags): AdminDeskDrawer[] =>
  ADMIN_DESK_DRAWERS.filter((d) => {
    const flag = ADMIN_DESK_DRAWER_FLAGS[d.id];
    return flag === undefined || flags[flag];
  });

export const isAdminDeskDrawerId = (value: unknown): value is AdminDeskDrawerId => ADMIN_DESK_DRAWERS.some((d) => d.id === value);

// ---- manual regeneration -------------------------------------------------------------------------------------------

/** POST starts a rebuild of every manual (Admins and Super Admins); GET reports the last run. */
export const MANUAL_REGENERATION_ROUTE = '/api/admin/regenerate-manuals';
/** The local hour (0-23) of the nightly rebuild. */
export const NIGHTLY_MANUAL_REBUILD_HOUR = 2;
/** Set to 'off' on the server to skip the nightly rebuild. */
export const NIGHTLY_MANUAL_REBUILD_ENV = 'KOFC_NIGHTLY_MANUALS';

export type ManualRegenerationTrigger = 'on-demand' | 'nightly';

export interface ManualRegenerationStatus {
  running: boolean;
  trigger: ManualRegenerationTrigger | null;
  startedAt: string | null;
  finishedAt: string | null;
  ok: boolean | null;
  message: string | null;
  /** ISO time of the next nightly run, or null when the nightly job is off. */
  nextNightlyRun: string | null;
}

/** The next nightly rebuild strictly after `now`: today at NIGHTLY_MANUAL_REBUILD_HOUR, else tomorrow. */
export function nextNightlyManualRebuild(now: Date, hour = NIGHTLY_MANUAL_REBUILD_HOUR): Date {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

// ---- the Executive Dashboard's monthly figures ---------------------------------------------------------------------

export interface MonthlyActivityFigures {
  volunteers: number;
  hours: number;
  raised: number;
  spend: number;
  net: number;
}

/**
 * The figures the Monthly Activity card and the Net Balance tile share. Both read one MonthlySummary, so the money
 * the card shows (`raised`, cash plus electronic) is the same `raised` the Net Balance tile subtracts spend from, and
 * its volunteers and hours are the summary's unique Knights and labor hours.
 */
export function monthlyActivityFigures(summary: Pick<MonthlySummary, 'finances' | 'laborHours' | 'uniqueMembers'>): MonthlyActivityFigures {
  return {
    volunteers: summary.uniqueMembers,
    hours: summary.laborHours.total,
    raised: summary.finances.raised,
    spend: summary.finances.spend,
    net: summary.finances.net,
  };
}

// ---- the Council Lookups payment grid ------------------------------------------------------------------------------

/** The Check payment method's fixed row in the payment methods grid (1-based). */
export const CHECK_PAYMENT_ROW_POSITION = 3;

/**
 * The payment methods grid's row order: the rows as given, with the Check method moved to row CHECK_PAYMENT_ROW_POSITION
 * (or last, when there are fewer rows). `methodName` names a row's method.
 */
export function orderPaymentMethodRows<R>(rows: readonly R[], methodName: (row: R) => string): R[] {
  const at = rows.findIndex((r) => donationMethodKind(methodName(r)) === 'check');
  if (at < 0) return [...rows];
  const rest = rows.filter((_, i) => i !== at);
  rest.splice(Math.min(CHECK_PAYMENT_ROW_POSITION - 1, rest.length), 0, rows[at]!);
  return rest;
}

// ---- the built-in broadcast lists ----------------------------------------------------------------------------------

interface BroadcastActor {
  memberType: string | undefined;
  /** The session's isOfficer, or a driver's `officer` (holds an officer role). */
  isOfficer?: boolean;
  officer?: boolean;
}

const isOfficerActor = (u: BroadcastActor) => u.isOfficer === true || u.officer === true;
const isAdminType = (memberType: string | undefined) => memberType === 'Admin' || memberType === 'Super Admin';

/** The built-in 'All Members' and 'Active Officers' lists: officers, Admins and Super Admins only. */
export const canBroadcastToDistributionGroups = (u: BroadcastActor): boolean => isAdminType(u.memberType) || isOfficerActor(u);

/** messages.send with distributionGroups: refuses (ADMIN_REQUIRED) a sender who is not an officer, Admin or Super Admin. */
export function assertMayBroadcastToDistributionGroups(u: BroadcastActor & { memberId: number }, groups: readonly unknown[] | undefined): void {
  if (!groups?.length || canBroadcastToDistributionGroups(u)) return;
  throw new SecurityPrivilegeError('ADMIN_REQUIRED', `Member ${u.memberId} may not message the council's built-in lists; only officers, Admins and Super Admins can.`, {
    actorId: u.memberId,
  });
}

// ---- 'Message All Attendants' on the calendar ----------------------------------------------------------------------

/** Officers, Admins and Super Admins, and the event's own owner. */
export const canMessageEventAttendees = (u: BroadcastActor & { memberId: number }, event: { OwnerID: number }): boolean =>
  canBroadcastToDistributionGroups(u) || event.OwnerID === u.memberId;

/** Everyone signed up for the event (every shift and day), once each, ascending, without the sender. */
export function eventAttendeeRecipientIds(turnout: readonly Pick<VolunteerTurnout, 'signup'>[], senderId: number): number[] {
  return [...new Set(turnout.map((t) => t.signup.MemberID))].filter((id) => id !== senderId).sort((a, b) => a - b);
}

// ---- the sidebar's plain-text labels -------------------------------------------------------------------------------

/** Pictographs, emoji presentation and their joiners, variation selectors and keycaps, plus the arrows and marks used as icons. */
const ICON_GLYPHS = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\u{1F1E6}-\u{1F1FF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}↗↘→←▸▾⚖✓]/gu;

/** A sidebar label with every icon glyph removed and the spaces tidied: '📸 Council Photo Gallery' -> 'Council Photo Gallery'. */
export const plainNavLabel = (label: string): string => label.replace(ICON_GLYPHS, '').replace(/\s{2,}/g, ' ').trim();
