// =========================================================================
// HIGH-VOLUME BATCH CODING AND CASH BOX AUDIT CLOSURES (Sprint 8N, schema 84)
//
// Three steps close the books on an event's collections:
//   1. A member at the gate taps '[ 🛑 Conclude Event Session & Lock Logs ]' on the phone
//      (events.concludeCollectionSession). The event's collection moves OPEN -> CONCLUDED: the gate intake closes, no
//      phone may log another donation for it, and its donations can no longer be changed (COLLECTION_SESSION_CONCLUDED).
//   2. The Treasurer codes the un-coded electronic donations (card and QR-code methods) to a Revenue ledger line in one
//      action on the High-Volume Batch Transaction Coder (finance.batchCodeDonations). One balanced transaction is posted
//      for the batch - debit the cash account, credit the Revenue line - and every donation in it is stamped with the
//      line and the batch's TransactionID. A coded donation can no longer be changed (DONATION_ALREADY_CODED).
//   3. The Treasurer counts the paper currency and closes the event's cash box audit on the Cash Box Audit Closure Panel
//      (finance.closeCashAudit). The difference between the count and the logged cash is posted as the Over/Short
//      Reconciliation Line against the council's 'Cash Over/Short' ledger line; the phone's Donation rows are never
//      touched. The collection moves to RECONCILED, which nothing leaves.
// The Treasurer's closure also concludes a session no phone concluded, so the audit never waits on a device.
// Drivers load rows, call these helpers, then only store.
// =========================================================================
import type { DonationMethodKind } from './contract';
import { cleanJournalDate, compareGLAccounts, type CleanJournalLine } from './finance';
import { assertMoney, assertText, BusinessRuleError, toIsoDate } from './rules';
import { concludedRevenueAccounts } from './treasurer-desk';
import type { Donation, Event, EventCollectionStatus, GLAccount } from './types';
import { defineWorkflow, nextWorkflowState } from './workflow';

export const CONCLUDE_EVENT_SESSION_LABEL = '[ 🛑 Conclude Event Session & Lock Logs ]';
export const BATCH_CODER_TITLE = '🧮 High-Volume Batch Transaction Coder';
export const SELECT_ALL_UNCODED_LABEL = '[✓ Select All Un-coded Transactions]';
export const BATCH_CODE_BUTTON_LABEL = 'Code selected to this Revenue line';
export const CASH_AUDIT_PANEL_TITLE = '💵 Cash Box Audit Closure Panel';
export const CLOSE_CASH_AUDIT_LABEL = 'Close cash audit & lock';
export const OVER_SHORT_LINE_NAME = 'Over/Short Reconciliation Line';

/** The ledger line every Over/Short Reconciliation Line posts against; the drivers add it to a chart that lacks it. */
export const CASH_OVER_SHORT_ACCOUNT_NAME = 'Cash Over/Short';
export const CASH_OVER_SHORT_ACCOUNT_TYPE: GLAccount['AccountType'] = 'Expense';

/** The donation method kinds the batch coder treats as electronic money. */
export const ELECTRONIC_DONATION_KINDS: readonly DonationMethodKind[] = ['card', 'qr'];

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);
const cents = (n: number) => Math.round(n * 100);
const dollars = (c: number) => c / 100;
const money = (n: number) => `$${n.toFixed(2)}`;

// ---- the collection lifecycle --------------------------------------------------------------------------------------

export const EVENT_COLLECTION_STATUSES: readonly EventCollectionStatus[] = ['OPEN', 'CONCLUDED', 'RECONCILED'];

export type EventCollectionAction = 'conclude' | 'reconcile';

/**
 * Event.collection_status. Concluding a concluded session is a harmless repeat (two phones tapping at once); the
 * Treasurer may reconcile an OPEN collection, which concludes it at the same time. RECONCILED is final.
 */
export const EVENT_COLLECTION_WORKFLOW = defineWorkflow<EventCollectionStatus, EventCollectionAction>({
  name: 'Event collection',
  states: EVENT_COLLECTION_STATUSES,
  initial: 'OPEN',
  terminal: ['RECONCILED'],
  transitions: {
    conclude: { from: ['OPEN', 'CONCLUDED'], to: 'CONCLUDED' },
    reconcile: { from: ['OPEN', 'CONCLUDED'], to: 'RECONCILED' },
  },
  conflictCode: 'ILLEGAL_STATE_TRANSITION',
});

/** The event's collection status; a missing column reads as OPEN. */
export const eventCollectionStatus = (event: Pick<Event, 'collection_status'> | null | undefined): EventCollectionStatus =>
  event?.collection_status ?? EVENT_COLLECTION_WORKFLOW.initial;

/** The collection status to store after `action`; ILLEGAL_STATE_TRANSITION from RECONCILED. */
export const nextCollectionStatus = (event: Pick<Event, 'id' | 'collection_status'>, action: EventCollectionAction): EventCollectionStatus =>
  nextWorkflowState(EVENT_COLLECTION_WORKFLOW, eventCollectionStatus(event), action, `Event ${event.id}'s collection`);

/** True while phones may log donations for the event. */
export const isCollectionOpen = (event: Pick<Event, 'collection_status'> | null | undefined): boolean => eventCollectionStatus(event) === 'OPEN';

/** donations.record, donations.update and donations.remove: COLLECTION_SESSION_CONCLUDED unless the event's collection is OPEN. */
export function assertCollectionOpen(event: Pick<Event, 'id' | 'EventName' | 'collection_status'> | null | undefined, action: string): void {
  if (!event || isCollectionOpen(event)) return;
  throw new BusinessRuleError(
    'COLLECTION_SESSION_CONCLUDED',
    `"${event.EventName}"'s collection session is ${eventCollectionStatus(event).toLowerCase()} and its logs are locked, so you cannot ${action}.`,
    { eventId: event.id, collectionStatus: eventCollectionStatus(event) },
  );
}

/** donations.update and donations.remove: DONATION_ALREADY_CODED once the Treasurer has coded the donation. */
export function assertDonationNotCoded(donation: Pick<Donation, 'id' | 'coding_batch_id' | 'revenue_gl_account_id'>, action: string): void {
  if (donation.coding_batch_id == null && donation.revenue_gl_account_id == null) return;
  throw new BusinessRuleError('DONATION_ALREADY_CODED', `Donation ${donation.id} is coded to the general ledger, so you cannot ${action}.`, {
    donationId: donation.id,
    codingBatchId: donation.coding_batch_id ?? null,
  });
}

/** The stamp events.concludeCollectionSession writes; a repeat keeps the first conclusion's stamp. */
export function planCollectionConclusion(
  event: Pick<Event, 'id' | 'collection_status' | 'collection_concluded_at' | 'collection_concluded_by_member_id'>,
  actorId: number,
  timestamp: string,
): Pick<Event, 'collection_status' | 'collection_concluded_at' | 'collection_concluded_by_member_id' | 'IntakeSessionStatus'> {
  const already = eventCollectionStatus(event) === 'CONCLUDED';
  return {
    collection_status: nextCollectionStatus(event, 'conclude'),
    collection_concluded_at: already && event.collection_concluded_at ? event.collection_concluded_at : timestamp,
    collection_concluded_by_member_id: already && event.collection_concluded_by_member_id != null ? event.collection_concluded_by_member_id : actorId,
    IntakeSessionStatus: 'Inactive',
  };
}

// ---- the High-Volume Batch Transaction Coder ----------------------------------------------------------------------

/** A donation as the coder sees it, with the names the grid shows. */
export interface BatchCodingRow {
  donation: Donation;
  methodName: string;
  kind: DonationMethodKind;
  eventName: string | null;
}

/** finance.getBatchCodingQueue's answer. */
export interface BatchCodingQueue {
  /** The council's un-coded electronic donations, oldest first. */
  rows: BatchCodingRow[];
  uncodedTotal: number;
  /** The Revenue lines the single drop-down offers, in chart order. */
  revenueAccounts: GLAccount[];
  /** The cash account each batch is deposited to, or null when the council has none. */
  depositAccount: GLAccount | null;
}

/** A donation is waiting for the coder when it was given by card or QR code and carries no coding stamp. */
export const isUncodedElectronic = (donation: Pick<Donation, 'coding_batch_id' | 'revenue_gl_account_id'>, kind: DonationMethodKind): boolean =>
  ELECTRONIC_DONATION_KINDS.includes(kind) && donation.coding_batch_id == null && donation.revenue_gl_account_id == null;

/** finance.getBatchCodingQueue from the council's donations (with their method kinds and names) and chart of accounts. */
export function buildBatchCodingQueue(councilId: number, rows: readonly BatchCodingRow[], accounts: readonly GLAccount[]): BatchCodingQueue {
  const waiting = rows
    .filter((r) => r.donation.CouncilID === councilId && isUncodedElectronic(r.donation, r.kind))
    .sort((a, b) => a.donation.DonationDate.localeCompare(b.donation.DonationDate) || a.donation.id - b.donation.id);
  const { revenue, deposit } = concludedRevenueAccounts(accounts, councilId);
  return {
    rows: waiting,
    uncodedTotal: dollars(waiting.reduce((sum, r) => sum + cents(r.donation.DonationAmount), 0)),
    revenueAccounts: revenue,
    depositAccount: deposit[0] ?? null,
  };
}

/** finance.batchCodeDonations' input: the selected donations and the one Revenue line they are coded to. */
export interface BatchCodingInput {
  donationIds: number[];
  revenueAccountId: number;
}

/** finance.batchCodeDonations' answer. */
export interface BatchCodingResult {
  /** The batch posting's TransactionID, stamped on every donation as coding_batch_id. */
  batchId: string;
  donationIds: number[];
  count: number;
  total: number;
  revenueAccountId: number;
  revenueAccountName: string;
}

/**
 * finance.batchCodeDonations: the batch's balanced posting - one debit to the cash account and one credit to the Revenue
 * line for the selected donations' total. `rows` are all of the council's donations. INVALID_INPUT for an empty or
 * repeated selection, a donation of another council or one that is not electronic, a line that is not a Revenue line
 * of the council, or a council with no cash account; DONATION_ALREADY_CODED for a donation coded before.
 */
export function planBatchCoding(
  councilId: number,
  rows: readonly BatchCodingRow[],
  accounts: readonly GLAccount[],
  input: BatchCodingInput,
  now: Date,
): { lines: CleanJournalLine[]; donationIds: number[]; total: number; revenueAccount: GLAccount } {
  if (typeof input !== 'object' || input === null) throw invalid('Choose the donations to code and the Revenue line.');
  const ids = input.donationIds;
  if (!Array.isArray(ids) || ids.length === 0) throw invalid('Select at least one un-coded donation to code.', { field: 'donationIds' });
  const seen = new Set<number>();
  for (const id of ids) {
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) throw invalid(`A donation must be a record id; received ${JSON.stringify(id)}.`, { field: 'donationIds' });
    if (seen.has(id)) throw invalid(`Donation ${id} is selected twice.`, { donationId: id });
    seen.add(id);
  }
  const byId = new Map(rows.map((r) => [r.donation.id, r]));
  const picked: BatchCodingRow[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row || row.donation.CouncilID !== councilId) throw invalid(`Donation ${id} is not a donation of council ${councilId}.`, { donationId: id });
    assertDonationNotCoded(row.donation, 'code it again');
    if (!ELECTRONIC_DONATION_KINDS.includes(row.kind)) {
      throw invalid(`Donation ${id} was given by ${row.methodName}; the batch coder codes only card and QR-code gifts.`, { donationId: id, kind: row.kind });
    }
    picked.push(row);
  }
  const { revenue, deposit } = concludedRevenueAccounts(accounts, councilId);
  const revenueAccount = revenue.find((a) => a.id === input.revenueAccountId);
  if (!revenueAccount) {
    throw invalid(`Account ${JSON.stringify(input.revenueAccountId)} is not a Revenue line of council ${councilId}.`, { field: 'revenueAccountId' });
  }
  const cash = deposit[0];
  if (!cash) throw invalid(`Council ${councilId} has no cash account to deposit the coded donations to.`, { councilId });
  const total = dollars(picked.reduce((sum, r) => sum + cents(r.donation.DonationAmount), 0));
  const eventIds = new Set(picked.map((r) => r.donation.EventID ?? null));
  const base = {
    Description: `Batch coding: ${picked.length} electronic donation${picked.length === 1 ? '' : 's'} to ${revenueAccount.AccountName}`,
    DateLogged: cleanJournalDate(toIsoDate(now), now, 'Date coded'),
    LinkedEventID: eventIds.size === 1 ? [...eventIds][0]! : null,
    LinkedMeetingID: null,
    CheckNumber: null,
  };
  return {
    lines: [
      { ...base, GLAccountID: cash.id, DebitAmount: total, CreditAmount: 0 },
      { ...base, GLAccountID: revenueAccount.id, DebitAmount: 0, CreditAmount: total },
    ],
    donationIds: picked.map((r) => r.donation.id),
    total,
    revenueAccount,
  };
}

// ---- the Cash Box Audit Closure Panel -------------------------------------------------------------------------------

/** The count less the logged cash, to the cent: above 0 the box is over, below 0 it is short. */
export const cashVariance = (loggedCash: number, countedCash: number): number => dollars(cents(countedCash) - cents(loggedCash));

/** 'Over $5.00', 'Short $5.00' or 'Balanced'. */
export const describeCashVariance = (variance: number): string =>
  cents(variance) === 0 ? 'Balanced' : cents(variance) > 0 ? `Over ${money(variance)}` : `Short ${money(-variance)}`;

/** One event's line on the panel. */
export interface CashAuditRow {
  eventId: number;
  eventName: string;
  startDate: string;
  endDate: string;
  collectionStatus: EventCollectionStatus;
  /** The event's Cash donations as the phones logged them. */
  loggedCash: number;
  cashDonationCount: number;
  verifiedCash: number | null;
  variance: number | null;
  discrepancyReason: string | null;
  verifiedByName: string;
  verifiedAt: string | null;
  overShortTransactionId: string | null;
  concludedByName: string;
  concludedAt: string | null;
}

/** The figures the panel shows above the fold. */
export interface CashAuditMetrics {
  awaitingCount: number;
  awaitingLoggedCash: number;
  /** Of the events awaiting the count, those a phone already concluded. */
  concludedAwaitingCount: number;
  reconciledCount: number;
  totalOver: number;
  totalShort: number;
  netVariance: number;
}

/** finance.getCashAuditBoard's answer. */
export interface CashAuditBoard {
  rows: CashAuditRow[];
  metrics: CashAuditMetrics;
  /** The council's Cash Over/Short line, or null until the first discrepancy creates it. */
  overShortAccount: GLAccount | null;
}

/** A donation as the panel counts it. */
export interface CashAuditDonation {
  EventID?: number | null;
  DonationAmount: number;
  kind: DonationMethodKind;
}

/** The council's Cash Over/Short line, if its chart has one. */
export const cashOverShortAccount = (accounts: readonly GLAccount[], councilId: number): GLAccount | null =>
  accounts.find((a) => a.CouncilID === councilId && a.AccountName === CASH_OVER_SHORT_ACCOUNT_NAME) ?? null;

/** finance.getCashAuditBoard: the council's events with logged cash or a closed audit, awaiting ones first. */
export function buildCashAuditBoard(
  councilId: number,
  events: readonly Event[],
  donations: readonly CashAuditDonation[],
  accounts: readonly GLAccount[],
  memberNames: ReadonlyMap<number, string>,
): CashAuditBoard {
  const cash = new Map<number, { c: number; n: number }>();
  for (const d of donations) {
    if (d.kind !== 'cash' || d.EventID == null) continue;
    const t = cash.get(d.EventID) ?? { c: 0, n: 0 };
    cash.set(d.EventID, { c: t.c + cents(d.DonationAmount), n: t.n + 1 });
  }
  const name = (id: number | null | undefined) => (id == null ? '' : (memberNames.get(id) ?? `Member ${id}`));
  const rows = events
    .filter((e) => cash.has(e.id) || e.verified_cash_amount != null)
    .map((e): CashAuditRow => {
      const logged = dollars(cash.get(e.id)?.c ?? 0);
      const verified = e.verified_cash_amount ?? null;
      return {
        eventId: e.id,
        eventName: e.EventName,
        startDate: String(e.StartDate).slice(0, 10),
        endDate: String(e.EndDate).slice(0, 10),
        collectionStatus: eventCollectionStatus(e),
        loggedCash: logged,
        cashDonationCount: cash.get(e.id)?.n ?? 0,
        verifiedCash: verified,
        variance: verified === null ? null : cashVariance(logged, verified),
        discrepancyReason: e.cash_discrepancy_reason ?? null,
        verifiedByName: name(e.cash_verified_by_member_id),
        verifiedAt: e.cash_verified_at ?? null,
        overShortTransactionId: e.cash_over_short_transaction_id ?? null,
        concludedByName: name(e.collection_concluded_by_member_id),
        concludedAt: e.collection_concluded_at ?? null,
      };
    })
    .sort(
      (a, b) =>
        (a.collectionStatus === 'RECONCILED' ? 1 : 0) - (b.collectionStatus === 'RECONCILED' ? 1 : 0) ||
        b.startDate.localeCompare(a.startDate) ||
        a.eventName.localeCompare(b.eventName),
    );
  const awaiting = rows.filter((r) => r.collectionStatus !== 'RECONCILED');
  const variances = rows.map((r) => cents(r.variance ?? 0));
  return {
    rows,
    metrics: {
      awaitingCount: awaiting.length,
      awaitingLoggedCash: dollars(awaiting.reduce((sum, r) => sum + cents(r.loggedCash), 0)),
      concludedAwaitingCount: awaiting.filter((r) => r.collectionStatus === 'CONCLUDED').length,
      reconciledCount: rows.length - awaiting.length,
      totalOver: dollars(variances.filter((v) => v > 0).reduce((a, b) => a + b, 0)),
      totalShort: dollars(-variances.filter((v) => v < 0).reduce((a, b) => a + b, 0)),
      netVariance: dollars(variances.reduce((a, b) => a + b, 0)),
    },
    overShortAccount: cashOverShortAccount(accounts, councilId),
  };
}

/** finance.closeCashAudit's input. */
export interface CashAuditInput {
  eventId: number;
  /** The paper currency physically counted, in dollars. */
  verifiedCashAmount: number;
  /** Why the count differs from the logs; required when it does. */
  discrepancyReason?: string | null;
}

/** The checked closure, before any ledger line is planned. */
export interface CleanCashAudit {
  row: CashAuditRow;
  verified: number;
  variance: number;
  reason: string | null;
}

/**
 * finance.closeCashAudit's checks: INVALID_INPUT for an event with no logged cash on the board, a count that is not an
 * amount, or a discrepancy with no reason; ILLEGAL_STATE_TRANSITION for an audit already closed.
 */
export function cleanCashAudit(board: CashAuditBoard, input: CashAuditInput, councilId: number): CleanCashAudit {
  if (typeof input !== 'object' || input === null) throw invalid('Enter the counted cash for the event.');
  const row = board.rows.find((r) => r.eventId === input.eventId);
  if (!row) throw invalid(`Event ${JSON.stringify(input.eventId)} has no logged cash of council ${councilId} to audit.`, { eventId: input.eventId });
  nextCollectionStatus({ id: row.eventId, collection_status: row.collectionStatus }, 'reconcile');
  const verified = assertMoney(input.verifiedCashAmount, 'Counted cash');
  const variance = cashVariance(row.loggedCash, verified);
  let reason: string | null = null;
  if (input.discrepancyReason !== undefined && input.discrepancyReason !== null && String(input.discrepancyReason).trim() !== '') {
    reason = assertText(input.discrepancyReason, 'Discrepancy reason', 255);
  }
  if (cents(variance) !== 0 && reason === null) {
    throw invalid(`The count is ${describeCashVariance(variance).toLowerCase()} against the logs; say why before you close the audit.`, {
      field: 'discrepancyReason',
      variance,
    });
  }
  return { row, verified, variance, reason };
}

/**
 * The Over/Short Reconciliation Line for a checked closure: none when the count matched; otherwise an overage debits the
 * cash account and credits the Cash Over/Short line, a shortage the reverse. INVALID_INPUT when the council has no cash
 * account or no Cash Over/Short line (the drivers add the line first).
 */
export function planOverShortLines(clean: CleanCashAudit, accounts: readonly GLAccount[], councilId: number, now: Date): CleanJournalLine[] {
  if (cents(clean.variance) === 0) return [];
  const own = accounts.filter((a) => a.CouncilID === councilId).sort(compareGLAccounts);
  const { deposit } = concludedRevenueAccounts(own, councilId);
  const cash = deposit[0];
  if (!cash) throw invalid(`Council ${councilId} has no cash account to adjust.`, { councilId });
  const overShort = cashOverShortAccount(own, councilId);
  if (!overShort) throw invalid(`Council ${councilId} has no ${CASH_OVER_SHORT_ACCOUNT_NAME} line.`, { councilId });
  const amount = Math.abs(clean.variance);
  const base = {
    Description: `${OVER_SHORT_LINE_NAME}: ${clean.row.eventName} - counted ${money(clean.verified)}, logged ${money(clean.row.loggedCash)} (${describeCashVariance(clean.variance)})`,
    DateLogged: cleanJournalDate(toIsoDate(now), now, 'Date counted'),
    LinkedEventID: clean.row.eventId,
    LinkedMeetingID: null,
    CheckNumber: null,
  };
  const over = clean.variance > 0;
  return [
    { ...base, GLAccountID: over ? cash.id : overShort.id, DebitAmount: amount, CreditAmount: 0 },
    { ...base, GLAccountID: over ? overShort.id : cash.id, DebitAmount: 0, CreditAmount: amount },
  ];
}
