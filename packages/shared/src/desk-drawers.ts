// Sprint 8P Stage 2 - Zero-Traverse Action Drawers on the Grand Knight and Financial Secretary Desks. Each desk is a
// "desk blotter": a grid of drawer handles, one per module the reader's seat clears. A handle slides its module out as a
// right-hand drawer over the desk, so the work - signing, verifying, looking up - happens in place with no link to
// another page. Two handles carry the Alert Boundary Accent, a red glowing border, while work waits on the reader's own
// signature: the Grand Knight's Approved Expenses drawer while a sheet the reader may counter-sign sits in the release
// queue (gkSignatureAlert), and the Financial Secretary's Payment Requests drawer while a sheet the reader may verify and
// sign waits for its payment request (fsPaymentRequestAlert). Every drawer ends with '[ 🔀 Back to Desk Blotter ]', and a
// module that must still open another page (the asset form after a long-term asset is released) leaves the same anchor
// in the portal frame to come straight back.
import type { ExpenseReportDetail, SessionUser } from './contract';
import { canRespondToAffiliation } from './council-affiliations';
import { canSetCouncilGoals } from './council-goals';
import { awaitsWrittenOrder } from './expenses';
import type { FeatureFlags } from './features';
import { canLendCouncilAssets } from './loaner-library';
import { DESK_FOCUS_TARGETS, type DashboardTabId } from './officer-desks';
import { canManageBudgetForecast, expenseCounterSignBlock, expenseOrderBlock, portalAreas, type PortalArea } from './permissions';
import type { TenantType } from './tenant';

type Actor = Pick<SessionUser, 'memberId' | 'councilId' | 'memberType' | 'isOfficer'> & { roles?: readonly string[] };

/** The safety anchor at the foot of every drawer and in the portal frame after a deep traverse. */
export const BACK_TO_DESK_BLOTTER_LABEL = '[ 🔀 Back to Desk Blotter ]';
/** The accessible name of a handle's Alert Boundary Accent. */
export const ALERT_BOUNDARY_LABEL = 'Waiting for your signature';
/** How often an alerting desk re-reads its signature queue, so the accent lights while the desk stays open. */
export const DESK_ALERT_POLL_MS = 30_000;
/** The sessionStorage key that remembers the desk a drawer deep-traversed from. */
export const DESK_RETURN_STORAGE_KEY = 'kofc.deskReturn';

/** Who sees a drawer besides its portal area (when it has one). */
export type DeskDrawerGate = 'loaner-library' | 'planning' | 'affiliations' | 'always';

export type DeskDrawerId =
  | 'approved-expenses'
  | 'vetting-board'
  | 'advisor'
  | 'connected-councils'
  | 'affiliation-invites'
  | 'loaner-library'
  | 'planning-budgeting'
  | 'election-tracker'
  | 'knowledge-archive'
  | 'payment-requests'
  | 'er-routing-track'
  | 'donation-records'
  | 'church-disbursements'
  | 'form-1295'
  | 'charity-checks'
  | 'roster-imports';

export interface DeskDrawerSpec {
  desk: Extract<DashboardTabId, 'grand-knight' | 'financial-secretary'>;
  id: DeskDrawerId;
  title: string;
  /** One line on the closed handle. */
  summary: string;
  /** The module's own portal area: the handle shows only to readers who may open it. */
  area?: PortalArea;
  /** Otherwise (or as well) the seat rule that clears it. */
  gate?: DeskDrawerGate;
  /** The DeskRow id, so a badge or link can bring the handle into view (and open it). */
  rowId: string;
  /** True for the drawer whose handle carries the Alert Boundary Accent. */
  alerts?: boolean;
}

/** Every drawer on the two desks, in display order (Sprint 8P Stage 2). */
export const DESK_DRAWERS: readonly DeskDrawerSpec[] = [
  { desk: 'grand-knight', id: 'approved-expenses', title: 'Approved Expenses', summary: 'Counter-sign and release sheets for payment', area: 'expenses/authorize', rowId: DESK_FOCUS_TARGETS.vouchers.rowId, alerts: true },
  { desk: 'grand-knight', id: 'vetting-board', title: 'Charitable Grant Requests Vetting Board', summary: 'Claim, question and advance charity grant requests', area: 'charities/vetting', rowId: 'module-vetting-board' },
  { desk: 'grand-knight', id: 'planning-budgeting', title: 'Planning & Budgeting Workflow', summary: 'Goals, the June review, the July 1 lock and the budget vote', gate: 'planning', rowId: 'drawer-planning-budgeting' },
  { desk: 'grand-knight', id: 'election-tracker', title: 'Council Election Tracker', summary: 'Seats, nominations and the ballot', area: 'elections', rowId: 'drawer-election-tracker' },
  { desk: 'grand-knight', id: 'loaner-library', title: 'Shared Loaner Library', summary: 'List, lend and check in council assets', gate: 'loaner-library', rowId: 'grand-knight-loaner-library' },
  { desk: 'grand-knight', id: 'affiliation-invites', title: 'Affiliation Invites', summary: 'Accept or decline invites from nearby councils', gate: 'affiliations', rowId: 'grand-knight-affiliations' },
  { desk: 'grand-knight', id: 'connected-councils', title: 'Connected Councils', summary: 'Invite and answer nearby councils', area: 'system-settings/affiliations', rowId: 'module-connected-councils' },
  { desk: 'grand-knight', id: 'advisor', title: 'Constitutional Advisor Panels', summary: 'Ask a parliamentary or bylaws question', area: 'governance/advisor', rowId: 'module-advisor' },
  { desk: 'grand-knight', id: 'knowledge-archive', title: 'Operations Knowledge Archive', summary: "Search every council's signed operating notes", area: 'system-settings/knowledge-archive', rowId: 'drawer-gk-knowledge-archive' },
  { desk: 'financial-secretary', id: 'payment-requests', title: 'Payment Requests', summary: 'Verify and sign the written order on each sheet', area: 'expenses/audit', rowId: DESK_FOCUS_TARGETS.orders.rowId, alerts: true },
  { desk: 'financial-secretary', id: 'er-routing-track', title: 'Expense Report (ER) Routing Track', summary: 'Every open sheet and the signature it waits for', area: 'expenses/queue', rowId: 'drawer-er-routing-track' },
  { desk: 'financial-secretary', id: 'donation-records', title: 'Charitable Donation Records', summary: 'Record, check and correct council donations', area: 'donations', rowId: 'drawer-donation-records' },
  { desk: 'financial-secretary', id: 'church-disbursements', title: 'Church Disbursement Requests', summary: "Record the check for the parish's share", gate: 'always', rowId: 'financial-secretary-church-disbursements' },
  { desk: 'financial-secretary', id: 'charity-checks', title: 'Charity Check Issuance Console', summary: 'Pay approved charity requests and gifts by check', area: 'charities/queue', rowId: 'module-charity-checks' },
  { desk: 'financial-secretary', id: 'form-1295', title: 'Semiannual Audit Form 1295 Center', summary: "The Trustees' step-by-step audit and the Form 1295 PDF", area: 'finance/audit', rowId: 'module-form-1295' },
  { desk: 'financial-secretary', id: 'roster-imports', title: 'Excel Roster Imports', summary: 'The roster template and the Supreme roster sync', gate: 'always', rowId: 'drawer-roster-imports' },
  { desk: 'financial-secretary', id: 'knowledge-archive', title: 'Operations Knowledge Archive', summary: "Search every council's signed operating notes", area: 'system-settings/knowledge-archive', rowId: 'drawer-fs-knowledge-archive' },
];

function clearedBy(u: Actor, spec: DeskDrawerSpec, councilId: number, areas: ReadonlySet<string>): boolean {
  if (spec.area && !areas.has(spec.area)) return false;
  switch (spec.gate) {
    case 'loaner-library':
      return canLendCouncilAssets(u, councilId);
    case 'planning':
      return canSetCouncilGoals(u, councilId) || canManageBudgetForecast(u, councilId);
    case 'affiliations':
      return canRespondToAffiliation(u, councilId);
    default:
      return true;
  }
}

/** The drawers of one desk the reader may open, in display order. */
export function deskDrawersFor(
  u: Actor,
  desk: DeskDrawerSpec['desk'],
  councilId: number,
  flags?: FeatureFlags,
  tenant?: TenantType,
): DeskDrawerSpec[] {
  const areas = new Set<string>(portalAreas(u, flags, tenant));
  return DESK_DRAWERS.filter((d) => d.desk === desk && clearedBy(u, d, councilId, areas));
}

/** The Grand Knight's accent: a sheet in the release queue that this reader may counter-sign right now. */
export const gkSignatureAlert = (u: Actor, queue: readonly Pick<ExpenseReportDetail, 'report'>[]): boolean =>
  queue.some((d) => expenseCounterSignBlock(u, d.report) === null);

/** The Financial Secretary's accent: a sheet waiting for its payment request that this reader may verify and sign. */
export const fsPaymentRequestAlert = (u: Actor, queue: readonly Pick<ExpenseReportDetail, 'report'>[]): boolean =>
  queue.some((d) => awaitsWrittenOrder(d.report) && expenseOrderBlock(u, d.report) === null);
