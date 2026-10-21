// Sprint 8P Stage 2 - Zero-Traverse Action Drawers on the Grand Knight and Financial Secretary Desks. Each desk is a
// "desk blotter": a grid of drawer handles, one per module the reader's seat clears. A handle slides its module out as a
// right-hand drawer over the desk, so the work - signing, verifying, looking up - happens in place with no link to
// another page. A handle carries the Alert Boundary Accent, a red glowing border, while work waits on the reader's own
// signature or a compliance warning is open. Every drawer ends with '[ 🔀 Back to Desk Blotter ]', and a module that must
// still open another page (the asset form after a long-term asset is released) leaves the same anchor in the portal frame
// to come straight back.
//
// Sprint 8P Stage 3 - Universal Desk Drawers: the Treasurer, Recorder and Historian Desks become blotters too, so the
// Sprint 8L <details> folders are gone from every desk (DESK_MODULES still names those modules; each is a drawer now).
// The standalone Oversight Desk is dissolved: the Flagged Hours Review, Shifts Awaiting Hours and the Inbound Council Mail
// Center are Grand Knight Desk drawers that light up while they hold work, and the Operations Knowledge Archive drawer
// carries the entry form for its writers. A 'featured' drawer (the Recorder's Historical Meeting Minutes Archive) spans
// the top row of its blotter. The Member Desk keeps plain panels, no drawers.
//
// Sprint 8S Revision 2 (desk-workflows.ts): the Financial Secretary and Treasurer Desks each carry the Expense Report (ER)
// Workflow and Charitable Donation Workflow drawers, lit while work waits on the reader's own step, and the Grand
// Knight's Council Election Tracker is now '[ 🗳️ Council Election Workflow ]' (id 'election-workflow').
// Sprint 8S Revision 3: the Charitable Donation Workflow tracks OUTGOING charity checks (charity-pipeline.ts) and also
// sits on the Grand Knight Desk, for the GK and DGK's compliance endorsement (gate 'charity-endorsement').
// Sprint 8S Revision 7 - the Left Dual-Cabinet Rail: every blotter is now a split-view console, a 25% left filing spine
// of flat folder links beside a 75% right Desk Blotter stage where the chosen folder's module opens in place. The spine's
// top is the Dynamic Priority Float: every folder whose Alert Boundary Accent is lit floats there, red-bordered. The
// high-density desks (Financial Secretary and Treasurer) then stack two cabinet blocks, '[ 📥 Inbound Operations ]' and
// '[ 📤 Outbound Operations ]' (each drawer's `cabinet`); the leaner desks list their folders flat. No folder nests.
// Sprint 8S Revision 8: the Grand Knight Desk gains the '[ 📈 Council Goals & Targets ]' folder (gate 'council-goals'):
// the Star Council objectives - Membership Intake, Charitable Dollars and Volunteer Hours - against the year's targets.
import type { DiaryEntryDetail, ExpenseReportDetail, LegacyYear, SessionUser } from './contract';
import type { Meeting } from './types';
import { canEndorseCharityRequest } from './charity-pipeline';
import { CHARITABLE_DONATION_WORKFLOW_TITLE, COUNCIL_ELECTION_WORKFLOW_TITLE, EXPENSE_REPORT_WORKFLOW_TITLE, type FinanceWorkflowDesk } from './desk-workflows';
import { canRespondToAffiliation } from './council-affiliations';
import { canReadCouncilGoals, canSetCouncilGoals } from './council-goals';
import { awaitsTreasurerCoding, awaitsWrittenOrder, isPayableExpenseReport } from './expenses';
import type { FeatureFlags } from './features';
import { canLendCouncilAssets } from './loaner-library';
import { DESK_FOCUS_TARGETS, type DashboardTabId } from './officer-desks';
import {
  canManageBudgetForecast,
  canPayExpenseReport,
  canReviewVolunteerQuarantine,
  canViewExecutiveAudits,
  expenseCounterSignBlock,
  expenseLedgerCodeBlock,
  expenseOrderBlock,
  isSuperAdmin,
  portalAreas,
  type PortalArea,
} from './permissions';
import type { TenantType } from './tenant';

type Actor = Pick<SessionUser, 'memberId' | 'councilId' | 'memberType' | 'isOfficer'> & { roles?: readonly string[] };

/** The safety anchor at the foot of every drawer and in the portal frame after a deep traverse. */
export const BACK_TO_DESK_BLOTTER_LABEL = '[ 🔀 Back to Desk Blotter ]';
/** The accessible name of a handle's Alert Boundary Accent when work waits on the reader's signature. */
export const ALERT_BOUNDARY_LABEL = 'Waiting for your signature';
/** How often an alerting desk re-reads its queues, so the accent lights while the desk stays open. */
export const DESK_ALERT_POLL_MS = 30_000;
/** The sessionStorage key that remembers the desk a drawer deep-traversed from. */
export const DESK_RETURN_STORAGE_KEY = 'kofc.deskReturn';
/** Sprint 8S Revision 8: the Grand Knight Desk folder of the Star Council objectives. */
export const COUNCIL_GOALS_FOLDER_TITLE = '[ 📈 Council Goals & Targets ]';
/** The one name of the operating-notes archive and its entry form, on every desk, page and guide (Sprint 8P Stage 3). */
export const OPERATIONS_KNOWLEDGE_ARCHIVE_TITLE = 'Operations Knowledge Archive';

/** Who sees a drawer besides its portal area (when it has one). */
export type DeskDrawerGate = 'loaner-library' | 'planning' | 'council-goals' | 'affiliations' | 'quarantine' | 'executive-audits' | 'super-admin' | 'charity-endorsement' | 'always';

/** The desks built as blotters: every officer desk. Home, the Member Desk and the Super Admin Desk are not. */
export type DrawerDeskId = Extract<DashboardTabId, 'grand-knight' | 'financial-secretary' | 'treasurer' | 'recorder' | 'historian'>;

export type DeskDrawerId =
  | 'approved-expenses'
  | 'flagged-hours'
  | 'shifts-awaiting-hours'
  | 'access-requests'
  | 'vetting-board'
  | 'advisor'
  | 'connected-councils'
  | 'affiliation-invites'
  | 'loaner-library'
  | 'planning-budgeting'
  | 'council-goals'
  | 'election-workflow'
  | 'er-workflow'
  | 'donation-workflow'
  | 'knowledge-archive'
  | 'payment-requests'
  | 'er-routing-track'
  | 'donation-records'
  | 'church-disbursements'
  | 'form-1295'
  | 'charity-checks'
  | 'roster-imports'
  | 'ledger-coder'
  | 'er-settlement'
  | 'charity-matches'
  | 'cash-box-audit'
  | 'batch-coder'
  | 'budget-vs-actuals'
  | 'bank-match'
  | 'parish-split'
  | 'minutes-archive'
  | 'live-meeting'
  | 'minutes-entry'
  | 'motions-ledger'
  | 'diary-logs'
  | 'bulletins'
  | 'meeting-photos'
  | 'oral-histories'
  | 'media-gallery';

export interface DeskDrawerSpec {
  desk: DrawerDeskId;
  id: DeskDrawerId;
  title: string;
  /** One line on the closed handle. */
  summary: string;
  /** The module's own portal area: the handle shows only to readers who may open it. */
  area?: PortalArea;
  /** Otherwise (or as well) the seat rule that clears it. */
  gate?: DeskDrawerGate;
  /** The DeskRow id, so a link can bring the handle into view (and open it). */
  rowId: string;
  /** True for a drawer whose handle can carry the Alert Boundary Accent. */
  alerts?: boolean;
  /** Sprint 8P Stage 3: a prioritized drawer, drawn across the whole top row of its blotter (first on the spine since 8S Rev 7). */
  featured?: boolean;
  /** Sprint 8S Revision 7: the cabinet block it files under on a high-density desk (CABINET_DESKS). */
  cabinet?: DeskCabinetId;
}

/** Sprint 8S Revision 7: the two cabinet blocks of a high-density desk's spine. */
export type DeskCabinetId = 'inbound' | 'outbound';
export const DESK_CABINET_LABELS: Readonly<Record<DeskCabinetId, string>> = {
  inbound: '[ 📥 Inbound Operations ]',
  outbound: '[ 📤 Outbound Operations ]',
};
/** The heading of the spine's Dynamic Priority Float. */
export const PRIORITY_FLOAT_LABEL = 'Priority: waiting on you';
/** The high-density desks whose spines stack the two cabinet blocks; every other desk lists its folders flat. */
export const CABINET_DESKS: readonly DrawerDeskId[] = ['financial-secretary', 'treasurer'];

export interface DeskSpineSection {
  /** 'priority' for the float, a cabinet id, or 'folders' for a lean desk's flat list. */
  id: 'priority' | DeskCabinetId | 'folders';
  /** The section heading ('' for a lean desk's flat list). */
  label: string;
  drawers: DeskDrawerSpec[];
}

/**
 * Sprint 8S Revision 7: the left filing spine of one desk, top to bottom. First the Dynamic Priority Float - every
 * drawer `isAlert` lights, in display order - then, on a CABINET_DESKS desk, the Inbound and Outbound cabinet blocks, or
 * on a lean desk one flat list. A floated drawer is not repeated below, and empty sections are left out. Every section
 * is a flat list: no folder nests inside another.
 */
export function deskSpineSections(desk: DrawerDeskId, drawers: readonly DeskDrawerSpec[], isAlert: (spec: DeskDrawerSpec) => boolean = () => false): DeskSpineSection[] {
  const floated = drawers.filter((d) => isAlert(d));
  const rest = drawers.filter((d) => !floated.includes(d));
  const sections: DeskSpineSection[] = [{ id: 'priority', label: PRIORITY_FLOAT_LABEL, drawers: floated }];
  if (CABINET_DESKS.includes(desk)) {
    sections.push(
      { id: 'inbound', label: DESK_CABINET_LABELS.inbound, drawers: rest.filter((d) => d.cabinet !== 'outbound') },
      { id: 'outbound', label: DESK_CABINET_LABELS.outbound, drawers: rest.filter((d) => d.cabinet === 'outbound') },
    );
  } else {
    sections.push({ id: 'folders', label: '', drawers: rest });
  }
  return sections.filter((s) => s.drawers.length > 0);
}

const ARCHIVE = OPERATIONS_KNOWLEDGE_ARCHIVE_TITLE;
/** Sprint 8S Revision 3: the Charitable Donation Workflow follows money going OUT to charities. */
const CHARITY_PIPELINE_SUMMARY = 'Charity request › FS/GK endorsement › Treasurer check';
const ARCHIVE_SUMMARY = "Search every council's signed operating notes";

/** Every drawer on the officer desks, in display order per desk (Sprints 8P Stage 2 and Stage 3). */
export const DESK_DRAWERS: readonly DeskDrawerSpec[] = [
  // ---- Grand Knight Desk (and the Deputy's)
  { desk: 'grand-knight', id: 'approved-expenses', title: 'Approved Expenses', summary: 'Counter-sign and release sheets for payment', area: 'expenses/authorize', rowId: DESK_FOCUS_TARGETS.vouchers.rowId, alerts: true },
  { desk: 'grand-knight', id: 'flagged-hours', title: 'Flagged Hours Review', summary: 'Approve or reject time entries held for review', gate: 'quarantine', rowId: DESK_FOCUS_TARGETS.quarantine.rowId, alerts: true },
  { desk: 'grand-knight', id: 'shifts-awaiting-hours', title: 'Shifts Awaiting Hours', summary: 'Volunteers who served but have not logged time', gate: 'executive-audits', rowId: DESK_FOCUS_TARGETS.hours.rowId, alerts: true },
  { desk: 'grand-knight', id: 'access-requests', title: 'Inbound Council Mail Center', summary: 'Access requests from councils not yet on the platform', gate: 'super-admin', rowId: DESK_FOCUS_TARGETS.access.rowId, alerts: true },
  { desk: 'grand-knight', id: 'vetting-board', title: 'Charitable Grant Requests Vetting Board', summary: 'Claim, question and advance charity grant requests', area: 'charities/vetting', rowId: 'module-vetting-board' },
  { desk: 'grand-knight', id: 'donation-workflow', title: CHARITABLE_DONATION_WORKFLOW_TITLE, summary: CHARITY_PIPELINE_SUMMARY, area: 'charities/vetting', gate: 'charity-endorsement', rowId: 'drawer-gk-donation-workflow', alerts: true },
  { desk: 'grand-knight', id: 'council-goals', title: COUNCIL_GOALS_FOLDER_TITLE, summary: 'Star Council objectives: members, charitable dollars, hours', gate: 'council-goals', rowId: 'drawer-council-goals' },
  { desk: 'grand-knight', id: 'planning-budgeting', title: 'Planning & Budgeting Workflow', summary: 'Goals, the June review, the July 1 lock and the budget vote', gate: 'planning', rowId: 'drawer-planning-budgeting' },
  { desk: 'grand-knight', id: 'election-workflow', title: COUNCIL_ELECTION_WORKFLOW_TITLE, summary: 'The ballot, May nominations, the June vote and the July 1 term', area: 'elections', rowId: 'drawer-election-workflow' },
  { desk: 'grand-knight', id: 'loaner-library', title: 'Shared Loaner Library', summary: 'List, lend and check in council assets', gate: 'loaner-library', rowId: 'grand-knight-loaner-library' },
  { desk: 'grand-knight', id: 'affiliation-invites', title: 'Affiliation Invites', summary: 'Accept or decline invites from nearby councils', gate: 'affiliations', rowId: 'grand-knight-affiliations' },
  { desk: 'grand-knight', id: 'connected-councils', title: 'Connected Councils', summary: 'Invite and answer nearby councils', area: 'system-settings/affiliations', rowId: 'module-connected-councils' },
  { desk: 'grand-knight', id: 'advisor', title: 'Constitutional Advisor Panels', summary: 'Ask a parliamentary or bylaws question', area: 'governance/advisor', rowId: 'module-advisor' },
  { desk: 'grand-knight', id: 'knowledge-archive', title: ARCHIVE, summary: ARCHIVE_SUMMARY, area: 'system-settings/knowledge-archive', rowId: 'drawer-gk-knowledge-archive' },
  // ---- Financial Secretary Desk
  { desk: 'financial-secretary', id: 'payment-requests', title: 'Payment Requests', summary: 'Verify and sign the written order on each sheet', area: 'expenses/audit', rowId: DESK_FOCUS_TARGETS.orders.rowId, alerts: true, cabinet: 'inbound' },
  { desk: 'financial-secretary', id: 'er-workflow', title: EXPENSE_REPORT_WORKFLOW_TITLE, summary: 'Every signature step of a sheet, worked in place', area: 'expenses/queue', rowId: 'drawer-fs-er-workflow', alerts: true, cabinet: 'inbound' },
  { desk: 'financial-secretary', id: 'donation-workflow', title: CHARITABLE_DONATION_WORKFLOW_TITLE, summary: CHARITY_PIPELINE_SUMMARY, area: 'charities/queue', rowId: 'drawer-fs-donation-workflow', alerts: true, cabinet: 'outbound' },
  { desk: 'financial-secretary', id: 'er-routing-track', title: 'Expense Report (ER) Routing Track', summary: 'Every open sheet and the signature it waits for', area: 'expenses/queue', rowId: 'drawer-er-routing-track', cabinet: 'inbound' },
  { desk: 'financial-secretary', id: 'donation-records', title: 'Charitable Donation Records', summary: 'Record, check and correct council donations', area: 'donations', rowId: 'drawer-donation-records', cabinet: 'inbound' },
  { desk: 'financial-secretary', id: 'church-disbursements', title: 'Church Disbursement Requests', summary: "Record the check for the parish's share", gate: 'always', rowId: 'financial-secretary-church-disbursements', cabinet: 'outbound' },
  { desk: 'financial-secretary', id: 'charity-checks', title: 'Charity Check Issuance Console', summary: 'Pay approved charity requests and gifts by check', area: 'charities/queue', rowId: 'module-charity-checks', cabinet: 'outbound' },
  { desk: 'financial-secretary', id: 'form-1295', title: 'Semiannual Audit Form 1295 Center', summary: "The Trustees' step-by-step audit and the Form 1295 PDF", area: 'finance/audit', rowId: 'module-form-1295', cabinet: 'outbound' },
  { desk: 'financial-secretary', id: 'roster-imports', title: 'Excel Roster Imports', summary: 'The roster template and the Supreme roster sync', gate: 'always', rowId: 'drawer-roster-imports', cabinet: 'inbound' },
  { desk: 'financial-secretary', id: 'knowledge-archive', title: ARCHIVE, summary: ARCHIVE_SUMMARY, area: 'system-settings/knowledge-archive', rowId: 'drawer-fs-knowledge-archive', cabinet: 'inbound' },
  // ---- Treasurer Desk
  { desk: 'treasurer', id: 'ledger-coder', title: 'Ledger Line Coder', summary: 'Give each signed sheet its budget line and ledger account', area: 'finance/treasurer-desk', rowId: DESK_FOCUS_TARGETS.coding.rowId, alerts: true, cabinet: 'inbound' },
  { desk: 'treasurer', id: 'er-settlement', title: 'Expense Report (ER) Settlement', summary: 'Pay fully signed sheets by check', area: 'expenses/disbursements', rowId: 'drawer-er-settlement', alerts: true, cabinet: 'outbound' },
  { desk: 'treasurer', id: 'charity-matches', title: 'Charitable Contribution Matches', summary: 'Match approved charity requests and gifts to their checks', area: 'charities/queue', rowId: 'drawer-charity-matches', alerts: true, cabinet: 'outbound' },
  { desk: 'treasurer', id: 'er-workflow', title: EXPENSE_REPORT_WORKFLOW_TITLE, summary: 'Every signature step of a sheet, worked in place', area: 'expenses/queue', rowId: 'drawer-treasurer-er-workflow', alerts: true, cabinet: 'inbound' },
  { desk: 'treasurer', id: 'donation-workflow', title: CHARITABLE_DONATION_WORKFLOW_TITLE, summary: CHARITY_PIPELINE_SUMMARY, area: 'charities/queue', rowId: 'drawer-treasurer-donation-workflow', alerts: true, cabinet: 'outbound' },
  { desk: 'treasurer', id: 'planning-budgeting', title: 'Planning & Budgeting Workflow', summary: 'Goals, the June review, the July 1 lock and the budget vote', gate: 'planning', rowId: 'drawer-treasurer-planning-budgeting', cabinet: 'inbound' },
  { desk: 'treasurer', id: 'cash-box-audit', title: 'Cash Box Audit Closure Panel', summary: 'Count each concluded event’s cash box and log any variance', gate: 'always', rowId: 'treasurer-cash-box-audit', cabinet: 'inbound' },
  { desk: 'treasurer', id: 'batch-coder', title: 'High-Volume Batch Transaction Coder', summary: 'Code many electronic donations to one Revenue line', gate: 'always', rowId: 'treasurer-batch-coder', cabinet: 'inbound' },
  { desk: 'treasurer', id: 'budget-vs-actuals', title: 'Annual Budget vs Actuals Ledger Grid', summary: 'Budgeted vs actual spend and the YOY variance analyzer', area: 'finance/dashboard', rowId: 'module-budget-vs-actuals', cabinet: 'inbound' },
  { desk: 'treasurer', id: 'bank-match', title: 'Bank Statement Match-Window', summary: 'Match a bank statement CSV against the ledger', area: 'finance/dashboard', rowId: 'module-bank-match', cabinet: 'inbound' },
  { desk: 'treasurer', id: 'parish-split', title: 'Parish Fundraiser Revenue Split Console', summary: "Issue the parish's share of fundraiser revenue", gate: 'always', rowId: 'treasurer-parish-split', cabinet: 'outbound' },
  // ---- Recorder Desk
  { desk: 'recorder', id: 'minutes-archive', title: 'Historical Meeting Minutes Archive', summary: "Read every meeting's published minutes before you open the session", gate: 'always', rowId: 'drawer-minutes-archive', featured: true },
  { desk: 'recorder', id: 'minutes-entry', title: 'Meeting Minutes Entry Desk', summary: 'The business calendar, the minutes countdown and the editor', gate: 'always', rowId: DESK_FOCUS_TARGETS.minutes.rowId, alerts: true },
  { desk: 'recorder', id: 'live-meeting', title: 'Start Live Meeting Sequence', summary: 'Open the live console and show the check-in PIN', gate: 'always', rowId: 'drawer-live-meeting' },
  { desk: 'recorder', id: 'motions-ledger', title: 'Council Resolutions and Motions Ledger', summary: "Every motion of this fraternal year's meetings and its result", area: 'meetings', rowId: 'module-motions-ledger' },
  // ---- Historian Desk
  { desk: 'historian', id: 'diary-logs', title: 'Fraternal Diary Entry Logs', summary: "Read the council's diary entries by year, author or word", gate: 'always', rowId: 'drawer-diary-logs' },
  { desk: 'historian', id: 'bulletins', title: 'Monthly Newsletters', summary: 'Write one text newsletter a month', gate: 'always', rowId: 'drawer-bulletins' },
  { desk: 'historian', id: 'meeting-photos', title: 'Meeting Photos', summary: "File each meeting's photo to the Drive media vault", gate: 'always', rowId: 'drawer-meeting-photos' },
  { desk: 'historian', id: 'oral-histories', title: 'Oral History Recordings', summary: 'Listen to testimonials and record your own', gate: 'always', rowId: 'drawer-oral-histories' },
  { desk: 'historian', id: 'media-gallery', title: 'Google Drive Media Gallery Sync Board', summary: 'Upload, tag and file photos to the Drive media vault', area: 'gallery', rowId: 'module-media-gallery' },
];

function clearedBy(u: Actor, spec: DeskDrawerSpec, councilId: number, areas: ReadonlySet<string>): boolean {
  if (spec.area && !areas.has(spec.area)) return false;
  switch (spec.gate) {
    case 'loaner-library':
      return canLendCouncilAssets(u, councilId);
    case 'planning':
      return canSetCouncilGoals(u, councilId) || canManageBudgetForecast(u, councilId);
    case 'council-goals':
      return canReadCouncilGoals(u, councilId);
    case 'affiliations':
      return canRespondToAffiliation(u, councilId);
    case 'quarantine':
      return canReviewVolunteerQuarantine(u, councilId);
    case 'executive-audits':
      return canViewExecutiveAudits(u, councilId);
    case 'super-admin':
      return isSuperAdmin(u);
    case 'charity-endorsement':
      return canEndorseCharityRequest(u, councilId);
    default:
      return true;
  }
}

/** The drawers of one desk the reader may open, in display order. */
export function deskDrawersFor(u: Actor, desk: DrawerDeskId, councilId: number, flags?: FeatureFlags, tenant?: TenantType): DeskDrawerSpec[] {
  const areas = new Set<string>(portalAreas(u, flags, tenant));
  return DESK_DRAWERS.filter((d) => d.desk === desk && clearedBy(u, d, councilId, areas));
}

type Sheet = Pick<ExpenseReportDetail, 'report'>;

/** The Grand Knight's accent: a sheet in the release queue that this reader may counter-sign right now. */
export const gkSignatureAlert = (u: Actor, queue: readonly Sheet[]): boolean => queue.some((d) => expenseCounterSignBlock(u, d.report) === null);

/** The Financial Secretary's accent: a sheet waiting for its payment request that this reader may verify and sign. */
export const fsPaymentRequestAlert = (u: Actor, queue: readonly Sheet[]): boolean =>
  queue.some((d) => awaitsWrittenOrder(d.report) && expenseOrderBlock(u, d.report) === null);

/** Sprint 8P Stage 3, the Treasurer's Ledger Line Coder accent: a sheet in the coding queue this reader may code. */
export const treasurerCodingAlert = (u: Actor, queue: readonly Sheet[]): boolean => queue.some((d) => expenseLedgerCodeBlock(u, d.report) === null);

/** Sprint 8P Stage 3, the ER Settlement accent: a fully signed sheet this reader may pay by check. */
export const erSettlementAlert = (u: Actor, queue: readonly Sheet[]): boolean =>
  queue.some((d) => isPayableExpenseReport(d.report) && canPayExpenseReport(u, d.report));

/** The sheets of the council queue the ER Settlement drawer counts: fully signed and waiting for their check. */
export const payableSheets = <T extends Sheet>(queue: readonly T[]): T[] => queue.filter((d) => isPayableExpenseReport(d.report));

/**
 * Sprint 8S Revision 2, the Expense Report (ER) Workflow accent: on the Financial Secretary Desk a sheet whose payment
 * request this reader may sign; on the Treasurer Desk a sheet this reader may code or pay. The council queue holds every
 * stage, so only sheets awaiting coding go to treasurerCodingAlert (which assumes the Treasurer's own queue).
 */
export const erWorkflowAlert = (u: Actor, desk: FinanceWorkflowDesk, queue: readonly Sheet[]): boolean =>
  desk === 'financial-secretary'
    ? fsPaymentRequestAlert(u, queue)
    : treasurerCodingAlert(u, queue.filter((d) => awaitsTreasurerCoding(d.report))) || erSettlementAlert(u, queue);


// ---- the Recorder's Historical Meeting Minutes Archive and the Historian's Fraternal Diary Entry Logs (Stage 3) ----

/** The lower-case words of a reader's search box. */
const searchWords = (query: string): string[] => query.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** A meeting has minutes to read: published text, or an uploaded minutes file. */
export const hasArchivedMinutes = (m: Pick<Meeting, 'minutes_text' | 'minutes_published_at' | 'MinutesURL' | 'GoogleDriveMinutesURL'>): boolean =>
  (!!m.minutes_published_at && !!m.minutes_text?.trim()) || !!m.MinutesURL?.trim() || !!m.GoogleDriveMinutesURL?.trim();

/**
 * The Historical Meeting Minutes Archive: the council's meetings held on or before `today` whose minutes can be read
 * (hasArchivedMinutes), newest first, narrowed to those whose name, date or minutes contain every word of `query`.
 * Drafts never show: unpublished minutes text stays on the Meeting Minutes Entry Desk.
 */
export function minutesArchiveRows<T extends Meeting>(meetings: readonly T[], today: string, query = ''): T[] {
  const words = searchWords(query);
  return meetings
    .filter((m) => String(m.Date).slice(0, 10) <= today && hasArchivedMinutes(m))
    .filter((m) => {
      const hay = `${m['Meeting Name']} ${m.Date} ${m.minutes_published_at ? (m.minutes_text ?? '') : ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => String(b.Date).localeCompare(String(a.Date)) || b.id - a.id);
}

/**
 * The Fraternal Diary Entry Logs: every diary entry of the council's Team Legacy matrix, newest first, narrowed to one
 * fraternal year ('' for all) and to entries whose text or author contains every word of `query`.
 */
export function diaryLogRows(years: readonly Pick<LegacyYear, 'fraternalYear' | 'diary'>[], fraternalYear = '', query = ''): DiaryEntryDetail[] {
  const words = searchWords(query);
  return years
    .filter((y) => !fraternalYear || y.fraternalYear === fraternalYear)
    .flatMap((y) => y.diary)
    .filter((d) => {
      const hay = `${d.entry.diary_text} ${d.authorFirstName} ${d.authorLastName} ${d.entry.entry_date}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => b.entry.entry_date.localeCompare(a.entry.entry_date) || b.entry.id - a.entry.id);
}
