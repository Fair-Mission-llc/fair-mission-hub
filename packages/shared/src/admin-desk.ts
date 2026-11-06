// =========================================================================
// THE ADMIN DESK AND THE SPRINT 11 REVISION 2.0 CALIBRATIONS (schema 102, no table change)
//
// The Admin Desk (/admin-desk) is a council Admin's own workspace (Super Admins included, canOpenAdminDesk).
//
// Sprint 11 Revision 21.5: the desk is one left rail of drawers (ADMIN_DESK_DRAWERS), all closed on landing. The Static
// Top Deck and the control bar are gone:
//   - the Administration Manual and the 'How Do I...' Help Search are file-cabinet drawers (DESK_HANDLE_TONES);
//   - the Council Instance Record and the Practice Sandbox switch moved into Council Wide Settings;
//   - the Setup Wizard drawer shows until the wizard has run, then lives in Council Wide Settings: Council Setup.
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
import { donationMethodKind, methodAcceptsQrCode, SecurityPrivilegeError } from './rules';
import type { FeatureFlagName, FeatureFlags } from './features';

export const ADMIN_DESK_HREF = '/admin-desk';
export const ADMIN_DESK_TITLE = 'Admin Desk';

/**
 * Sprint 11 Revision 21.5: the two kinds of desk handle, told apart by a subtle left-edge color on the Admin Desk rail and
 * the Super Admin Desk spine. A file cabinet holds reference material (manuals, help, records, grouped cabinets); a
 * functional drawer is where work is done.
 */
export type DeskHandleKind = 'cabinet' | 'drawer';

/** The left-edge (and cabinet group) border classes for each kind. Cobalt marks a file cabinet, gold a working drawer. */
export const DESK_HANDLE_TONES: Readonly<Record<DeskHandleKind, { edge: string; group: string }>> = {
  cabinet: { edge: 'border-l-mission-community', group: 'border-mission-community/60 bg-mission-community/5' },
  drawer: { edge: 'border-l-gold', group: 'border-navy' },
};

export type AdminDeskDrawerId =
  | 'setup-wizard'
  | 'admin-manual'
  | 'help-search'
  | 'council-settings'
  | 'council-lookups'
  | 'credentials-vault'
  | 'charities-registry'
  | 'asset-management'
  | 'member-feedback'
  | 'feedback';

export interface AdminDeskDrawer {
  id: AdminDeskDrawerId;
  label: string;
  hint: string;
  kind: DeskHandleKind;
}

/**
 * The Admin Desk's left rail, top to bottom; every drawer starts closed. Sprint 11 Revision 21.5: the Static Top Deck and
 * the control bar are gone. The Administration Manual and the Help Search are file-cabinet drawers; the Council Instance
 * Record and the Practice Sandbox moved into Council Wide Settings. The Setup Wizard drawer shows until the wizard has run
 * once (adminDeskDrawersFor), then lives only in Council Wide Settings: Council Setup.
 */
export const ADMIN_DESK_DRAWERS: readonly AdminDeskDrawer[] = [
  { id: 'setup-wizard', label: 'Setup Wizard', hint: 'First-run council setup', kind: 'drawer' },
  { id: 'admin-manual', label: 'Administration Manual', hint: 'Printed manual and rebuild', kind: 'cabinet' },
  { id: 'help-search', label: "'How Do I...' Help Search", hint: 'Task steps from the manual', kind: 'cabinet' },
  { id: 'council-settings', label: 'Council Wide Settings', hint: 'Accounts, limits, setup and instance record', kind: 'drawer' },
  { id: 'council-lookups', label: 'Council Lookup Tables', hint: 'Activities, donation types, payment methods', kind: 'drawer' },
  { id: 'credentials-vault', label: 'Secure Access Vault', hint: 'Home council email, Drive and file keys', kind: 'drawer' },
  { id: 'charities-registry', label: 'Global Charities Registry', hint: 'Browse, verify and add charities', kind: 'drawer' },
  { id: 'asset-management', label: 'Council Asset Management', hint: 'Capital assets and asset photos', kind: 'drawer' },
  { id: 'member-feedback', label: 'Member Feedback Queue', hint: 'Member tickets, status and chat logs', kind: 'drawer' },
  { id: 'feedback', label: 'Administrative Feedback Loops', hint: 'Note or bug report to the platform owner', kind: 'drawer' },
];

/** Sprint 11 Revision 7.0: the drawers a premium module switch hides when it is off. */
export const ADMIN_DESK_DRAWER_FLAGS: Partial<Record<AdminDeskDrawerId, FeatureFlagName>> = {
  'charities-registry': 'feature_charity_registry',
  'asset-management': 'feature_capital_assets',
};

/** The drawers a council's switches leave on the desk, in order. */
export const adminDeskDrawersFor = (flags: FeatureFlags, { setupWizardDone = false }: { setupWizardDone?: boolean } = {}): AdminDeskDrawer[] =>
  ADMIN_DESK_DRAWERS.filter((d) => {
    if (d.id === 'setup-wizard' && setupWizardDone) return false;
    const flag = ADMIN_DESK_DRAWER_FLAGS[d.id];
    return flag === undefined || flags[flag];
  });

/**
 * Sprint 11 Revision 19.5: the sidebar links that only repeat an Admin Desk drawer (the drawer opens the same module in
 * place). A council Admin's sidebar leaves them out; the Admin Desk link stays. Super Admins, who work across councils,
 * keep every link, and the Navigation Guide still lists them all.
 */
export const ADMIN_DESK_REDUNDANT_NAV_ITEMS = [
  'system-settings/council-settings',
  'council-lookups',
  'credentials-vault',
  'charities/registry',
  'expenses/assets',
  // Sprint 11 Revision 20.0: the Administrative Feedback Loops are the desk's own drawer too.
  'system-settings/feedback',
] as const;

/**
 * Sprint 11 Revision 20.0: the sidebar's own 'Admin Desk' link only looped back to the desk the Active Desks row already
 * opens (showsAdminDeskTab), so every reader who has that tab - council Admins and Super Admins - loses the link.
 */
export const ADMIN_DESK_LINK_LOOP_ITEM = 'admin-desk';

/** Whether the sidebar drops `item` for this reader, because the Admin Desk already holds it (or its tab opens it). */
export const isRedundantAdminDeskNavItem = (memberType: string | undefined, item: string): boolean =>
  (item === ADMIN_DESK_LINK_LOOP_ITEM && (memberType === 'Admin' || memberType === 'Super Admin')) ||
  (memberType === 'Admin' && (ADMIN_DESK_REDUNDANT_NAV_ITEMS as readonly string[]).includes(item));

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

/** A sidebar label with every icon glyph removed and the spaces tidied: '📸 Media & Memory Center' -> 'Media & Memory Center'. */
export const plainNavLabel = (label: string): string => label.replace(ICON_GLYPHS, '').replace(/\s{2,}/g, ' ').trim();

/** Sprint 11 Revision 17.0: a sidebar link as plain words - no icon glyphs and no '[ ... ]' brackets. */
export const sidebarLinkLabel = (label: string): string => plainNavLabel(label.replace(/[[\]]/g, ' '));

/**
 * Sprint 11 Revision 17.6: page titles, panel headings and notice cards read as plain words, like the sidebar - no icon
 * glyphs and no '[ ... ]' brackets: '[ 🚗 Open Shifts Needing Volunteers ] (3)' -> 'Open Shifts Needing Volunteers (3)'.
 */
export const plainTitle = (text: string): string => sidebarLinkLabel(text);

/**
 * The same clean-up for one piece of a longer text (a heading built from text and values). The edges keep their single
 * spaces so 'Total: ' + value still reads 'Total: 4'; a piece that held only an icon becomes empty.
 */
export const plainTextPiece = (text: string): string => {
  const out = text.replace(/[[\]]/g, ' ').replace(ICON_GLYPHS, '').replace(/\s{2,}/g, ' ');
  return out !== text && out.trim() === '' ? '' : out;
};

// ---- Sprint 11 Revision 18.5: the Payment QR Codes card ------------------------------------------------------------

/**
 * The rows the Payment QR Codes card draws: the council's Enabled donation methods (CouncilDonationMethod rows) that are
 * switched Active and take a QR code (methodAcceptsQrCode). Cash, Check, card readers, Physical Items and Inactive
 * methods get no row at all. `nameOf` gives a row's method name (DonationMethod); a row it cannot name gets no row.
 */
export function paymentQrUploadRows<T extends { DonationMethodID: number; lookup_status?: string | null }>(rows: readonly T[], nameOf: (methodId: number) => string | undefined): T[] {
  return rows.filter((r) => {
    const name = nameOf(r.DonationMethodID);
    return name !== undefined && (r.lookup_status ?? 'Active') === 'Active' && methodAcceptsQrCode(name);
  });
}
