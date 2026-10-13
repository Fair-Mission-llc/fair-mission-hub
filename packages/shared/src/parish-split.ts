// =========================================================================
// PARAMETRIC PARISH SPLITS (Sprint 8M Core, schema 83)
//
// A council may owe its parish a share of what a fundraiser collects (the parking lot is the parish's). Three Council
// columns make the split each council's own setting, edited under System Settings > Council Wide Settings by the
// Council Wide Settings editors (councils.setParishSplitSettings):
//   - parish_split_enabled (DEFAULT 0) switches the engine on;
//   - parish_split_percentage (DEFAULT 50.00) is the parish's share, from 0.01 to 100.00;
//   - parish_split_gl_line_id is the general ledger line (a Revenue or Expense account of the council) the
//     share is charged to. The split cannot be on without one: the page will not save, and the drivers refuse
//     PARISH_SPLIT_GL_LINE_REQUIRED.
// The Parish Fundraiser Revenue Split Console on the Treasurer Desk (finance.getParishSplitConsole) totals each event's
// live collections - its money donations, physical items left out - and applies the percentage. The Treasurer's
// '[ 📋 Issue Church Disbursement Request ]' (finance.issueChurchDisbursementRequest) holds the share, less what was
// already requested for the event, as a PENDING payment request against the GL line: the council's liability to the
// parish. It waits on the Financial Secretary Desk until the Financial Secretary types the check number and records the
// payment (finance.recordChurchDisbursementPayment), which posts a debit to the GL line and a credit to the cash account.
// The Treasurer who issued a request may not also pay it. Drivers load rows, call these helpers, then only store.
// =========================================================================
import { isPhysicalPropertyAccount } from './audits';
import { cleanJournalDate, compareGLAccounts, isBankAccount, type CleanJournalLine } from './finance';
import { assertText, BusinessRuleError, toIsoDate, type MemberWriteActor } from './rules';
import type { Council, Event, GLAccount, ParishDisbursementRequest } from './types';

export const PARISH_SPLIT_CONSOLE_TITLE = '⛪ Parish Fundraiser Revenue Split Console';
export const ISSUE_CHURCH_DISBURSEMENT_LABEL = '[ 📋 Issue Church Disbursement Request ]';
export const CHURCH_DISBURSEMENT_QUEUE_TITLE = '⛪ Church Disbursement Requests';
export const RECORD_CHURCH_PAYMENT_LABEL = 'Record Payment Made';
export const PARISH_SPLIT_SETTINGS_TITLE = 'Parish Fundraiser Split';

export const DEFAULT_PARISH_SPLIT_PERCENTAGE = 50;
export const PARISH_SPLIT_MIN_PERCENTAGE = 0.01;
export const PARISH_SPLIT_MAX_PERCENTAGE = 100;

/** The front-end gate's text: shown, and the save refused, while the split is on with no GL line chosen. */
export const PARISH_SPLIT_GL_LINE_REQUIRED_TEXT = 'Choose the general ledger line the parish share is charged to before you switch the split on.';

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

// ---- settings ---------------------------------------------------------------------------------------------------

export interface ParishSplitSettings {
  parish_split_enabled: number;
  parish_split_percentage: number;
  parish_split_gl_line_id: number | null;
}

/** councils.setParishSplitSettings' input: any of the three; a field left out keeps its stored value. */
export interface ParishSplitSettingsInput {
  enabled?: boolean;
  percentage?: number;
  glLineId?: number | null;
}

/** The council's stored split settings, with the column defaults filled in. */
export function parishSplitSettings(council: Partial<Pick<Council, keyof ParishSplitSettings>> | null | undefined): ParishSplitSettings {
  return {
    parish_split_enabled: council?.parish_split_enabled === 1 ? 1 : 0,
    parish_split_percentage: council?.parish_split_percentage ?? DEFAULT_PARISH_SPLIT_PERCENTAGE,
    parish_split_gl_line_id: council?.parish_split_gl_line_id ?? null,
  };
}

/**
 * A GL line the parish share may be charged to: a Revenue account (Sprint 8M Extension - the share is taken back out of the
 * fundraiser's revenue, a contra-revenue debit) or an Expense account, never a virtual goal.
 */
export const PARISH_SPLIT_LINE_TYPES: readonly GLAccount['AccountType'][] = ['Revenue', 'Expense'];
export const isParishSplitLine = (account: Pick<GLAccount, 'AccountType' | 'IsVirtualGoal'>): boolean =>
  PARISH_SPLIT_LINE_TYPES.includes(account.AccountType) && account.IsVirtualGoal !== 1;

/** The council's GL lines the settings card offers, in chart order. */
export const parishSplitLineOptions = (accounts: readonly GLAccount[], councilId: number): GLAccount[] =>
  accounts.filter((a) => a.CouncilID === councilId && isParishSplitLine(a)).sort(compareGLAccounts);

/** The front-end validation gate: the message to show while the split is on without a GL line, else null. */
export const parishSplitGateMessage = (enabled: boolean, glLineId: number | null | undefined): string | null =>
  enabled && (glLineId === null || glLineId === undefined) ? PARISH_SPLIT_GL_LINE_REQUIRED_TEXT : null;

/** A percentage from 0.01 to 100 with at most two decimal places, else INVALID_INPUT. */
export function cleanParishSplitPercentage(value: unknown): number {
  const ok =
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= PARISH_SPLIT_MIN_PERCENTAGE &&
    value <= PARISH_SPLIT_MAX_PERCENTAGE &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
  if (!ok) {
    throw invalid(`The parish share must be a percentage from ${PARISH_SPLIT_MIN_PERCENTAGE} to ${PARISH_SPLIT_MAX_PERCENTAGE} with at most two decimals; received ${String(value)}.`, {
      field: 'parish_split_percentage',
    });
  }
  return Math.round((value as number) * 100) / 100;
}

/**
 * councils.setParishSplitSettings: merges `input` over the stored settings and checks the result. The GL line must be
 * one of parishSplitLineOptions (INVALID_INPUT), and the split may be on only with a GL line
 * (PARISH_SPLIT_GL_LINE_REQUIRED) - checked on the merged result, so switching on and choosing the line can be one save.
 */
export function cleanParishSplitSettings(input: unknown, current: ParishSplitSettings, accounts: readonly GLAccount[], councilId: number): ParishSplitSettings {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw invalid('Send the parish split settings to save.');
  const known = ['enabled', 'percentage', 'glLineId'];
  const keys = Object.keys(input);
  for (const key of keys) if (!known.includes(key)) throw invalid(`The parish split has no setting "${key}".`, { field: key });
  if (keys.length === 0) throw invalid('Send at least one parish split setting to save.');
  const raw = input as ParishSplitSettingsInput;
  const next = { ...current };
  if ('enabled' in raw) {
    if (typeof raw.enabled !== 'boolean') throw invalid('The parish split must be on (true) or off (false).', { field: 'parish_split_enabled' });
    next.parish_split_enabled = raw.enabled ? 1 : 0;
  }
  if ('percentage' in raw) next.parish_split_percentage = cleanParishSplitPercentage(raw.percentage);
  if ('glLineId' in raw) {
    const id = raw.glLineId;
    if (id === null || id === undefined) next.parish_split_gl_line_id = null;
    else {
      const line = parishSplitLineOptions(accounts, councilId).find((a) => a.id === id);
      if (!line) {
        throw invalid(`Ledger account ${JSON.stringify(id)} is not a revenue or expense line of council ${councilId}, so the parish share cannot be charged to it.`, {
          field: 'parish_split_gl_line_id',
        });
      }
      next.parish_split_gl_line_id = line.id;
    }
  }
  if (next.parish_split_enabled === 1 && next.parish_split_gl_line_id === null) {
    throw new BusinessRuleError('PARISH_SPLIT_GL_LINE_REQUIRED', PARISH_SPLIT_GL_LINE_REQUIRED_TEXT, { councilId });
  }
  return next;
}

// ---- the split ----------------------------------------------------------------------------------------------------

/** The parish's share of `gross` at `percentage`, rounded to the cent. */
export const parishShare = (gross: number, percentage: number): number => Math.round((Math.round(gross * 100) * percentage) / 100) / 100;

/** One event's line on the console. */
export interface ParishSplitEventRow {
  eventId: number;
  eventName: string;
  startDate: string;
  endDate: string;
  /** The event's live money collections: every donation linked to it except physical items. */
  grossCollections: number;
  /** grossCollections at the council's percentage. */
  share: number;
  /** What earlier Church Disbursement Requests for the event already hold, PENDING or PAID. */
  alreadyRequested: number;
  /** share less alreadyRequested, never below 0: what the next request would hold. */
  available: number;
}

/** A donation as the console counts it; `isItem` marks a physical-item gift (an estimated value, not money). */
export interface ParishSplitDonation {
  EventID?: number | null;
  DonationAmount: number;
  isItem: boolean;
}

/** The console's rows: the council's events with money collections or earlier requests, newest first. */
export function buildParishSplitRows(
  events: readonly Pick<Event, 'id' | 'EventName' | 'StartDate' | 'EndDate'>[],
  donations: readonly ParishSplitDonation[],
  requests: readonly Pick<ParishDisbursementRequest, 'event_id' | 'amount'>[],
  percentage: number,
): ParishSplitEventRow[] {
  const cents = new Map<number, number>();
  for (const d of donations) {
    if (d.isItem || d.EventID == null) continue;
    cents.set(d.EventID, (cents.get(d.EventID) ?? 0) + Math.round(d.DonationAmount * 100));
  }
  const requested = new Map<number, number>();
  for (const r of requests) requested.set(r.event_id, (requested.get(r.event_id) ?? 0) + Math.round(r.amount * 100));
  return events
    .filter((e) => (cents.get(e.id) ?? 0) > 0 || requested.has(e.id))
    .map((e) => {
      const grossCollections = (cents.get(e.id) ?? 0) / 100;
      const share = parishShare(grossCollections, percentage);
      const alreadyRequested = (requested.get(e.id) ?? 0) / 100;
      return {
        eventId: e.id,
        eventName: e.EventName,
        startDate: String(e.StartDate).slice(0, 10),
        endDate: String(e.EndDate).slice(0, 10),
        grossCollections,
        share,
        alreadyRequested,
        available: Math.max(0, Math.round((share - alreadyRequested) * 100) / 100),
      };
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || a.eventName.localeCompare(b.eventName));
}

/** A request with the names the desks show. */
export interface ParishDisbursementDetail {
  request: ParishDisbursementRequest;
  eventName: string;
  glAccountName: string;
  requestedByName: string;
  paidByName: string;
}

/** finance.getParishSplitConsole's answer. */
export interface ParishSplitConsole {
  settings: ParishSplitSettings;
  /** The GL lines the split may be charged to (parishSplitLineOptions), for the settings card. */
  lineOptions: GLAccount[];
  /** The designated GL line, or null while none is chosen. */
  glLine: GLAccount | null;
  events: ParishSplitEventRow[];
  /** Every Church Disbursement Request of the council, pending first, then newest first. */
  requests: ParishDisbursementDetail[];
}

/** Pending first, then newest first. */
export const compareParishDisbursements = (a: ParishDisbursementRequest, b: ParishDisbursementRequest): number =>
  (a.status === 'PENDING' ? 0 : 1) - (b.status === 'PENDING' ? 0 : 1) || b.requested_at.localeCompare(a.requested_at) || b.id - a.id;

/** What finance.issueChurchDisbursementRequest stores, besides the council, actor and time. */
export interface PlannedChurchDisbursement {
  event_id: number;
  gross_collections: number;
  split_percentage: number;
  amount: number;
  gl_account_id: number;
}

/**
 * finance.issueChurchDisbursementRequest: the next request for `eventId`. PARISH_SPLIT_DISABLED while the split is off,
 * PARISH_SPLIT_GL_LINE_REQUIRED without a GL line, INVALID_INPUT for an event with no collections or nothing left to
 * request.
 */
export function planChurchDisbursementRequest(settings: ParishSplitSettings, rows: readonly ParishSplitEventRow[], eventId: unknown, councilId: number): PlannedChurchDisbursement {
  if (settings.parish_split_enabled !== 1) {
    throw new BusinessRuleError('PARISH_SPLIT_DISABLED', `The parish split is off for council ${councilId}; switch it on under Council Wide Settings first.`, { councilId });
  }
  if (settings.parish_split_gl_line_id === null) throw new BusinessRuleError('PARISH_SPLIT_GL_LINE_REQUIRED', PARISH_SPLIT_GL_LINE_REQUIRED_TEXT, { councilId });
  if (typeof eventId !== 'number' || !Number.isInteger(eventId) || eventId < 1) throw invalid(`Choose the fundraiser to split; received ${JSON.stringify(eventId)}.`, { field: 'eventId' });
  const row = rows.find((r) => r.eventId === eventId);
  if (!row) throw invalid(`Event ${eventId} has no collections of council ${councilId} to split.`, { eventId });
  if (row.available <= 0) {
    throw invalid(`"${row.eventName}"'s parish share of ${row.share.toFixed(2)} is already requested in full.`, { eventId, share: row.share, alreadyRequested: row.alreadyRequested });
  }
  return {
    event_id: row.eventId,
    gross_collections: row.grossCollections,
    split_percentage: settings.parish_split_percentage,
    amount: row.available,
    gl_account_id: settings.parish_split_gl_line_id,
  };
}

/** finance.recordChurchDisbursementPayment's input. */
export interface ChurchDisbursementPaymentInput {
  CheckNumber: string;
  /** YYYY-MM-DD; today when left out. */
  PayoutDate?: string | null;
}

/**
 * finance.recordChurchDisbursementPayment: the balanced posting for a PENDING request - a debit to its GL line and a
 * credit to the council's first cash account, both carrying the check number and the event. ILLEGAL_STATE_TRANSITION
 * for a request already paid, DUAL_SIGNATURE_CONFLICT for the Treasurer who issued it, INVALID_INPUT for a blank check
 * number, a future date or a council with no cash account.
 */
export function planChurchDisbursementPayment(
  request: ParishDisbursementRequest,
  actor: MemberWriteActor,
  input: ChurchDisbursementPaymentInput,
  accounts: readonly GLAccount[],
  eventName: string,
  now: Date,
): { lines: CleanJournalLine[]; checkNumber: string; paidAt: string } {
  if (request.status !== 'PENDING') {
    throw new BusinessRuleError('ILLEGAL_STATE_TRANSITION', `Church Disbursement Request ${request.id} is already paid (check ${request.check_number ?? '?'}).`, {
      requestId: request.id,
      status: request.status,
    });
  }
  if (request.requested_by_member_id === actor.memberId) {
    throw new BusinessRuleError('DUAL_SIGNATURE_CONFLICT', `Member ${actor.memberId} issued Church Disbursement Request ${request.id}, so another officer must pay it.`, {
      requestId: request.id,
    });
  }
  if (typeof input !== 'object' || input === null) throw invalid('Type the check number.');
  const checkNumber = assertText(input.CheckNumber, 'Check number', 50);
  // Today in local time when left out (toTimestamp is UTC, which reads as tomorrow on an evening in the Americas).
  const paidAt = cleanJournalDate(input.PayoutDate ?? toIsoDate(now), now, 'Payment date');
  if (paidAt.slice(0, 10) > toIsoDate(now)) throw invalid('The payment date cannot be in the future.', { paidAt });
  const own = accounts.filter((a) => a.CouncilID === request.council_id).sort(compareGLAccounts);
  const line = own.find((a) => a.id === request.gl_account_id);
  if (!line) throw invalid(`Ledger account ${request.gl_account_id} is no longer an account of council ${request.council_id}.`, { field: 'gl_account_id' });
  const cash = own.find((a) => isBankAccount(a) && !isPhysicalPropertyAccount(a));
  if (!cash) throw invalid(`Council ${request.council_id} has no cash account to pay the parish from.`, { councilId: request.council_id });
  const base = {
    Description: `Church disbursement: ${request.split_percentage}% parish share of ${eventName}`.slice(0, 255),
    DateLogged: paidAt,
    LinkedEventID: request.event_id,
    LinkedMeetingID: null,
    CheckNumber: checkNumber,
  };
  return {
    lines: [
      { ...base, GLAccountID: line.id, DebitAmount: request.amount, CreditAmount: 0 },
      { ...base, GLAccountID: cash.id, DebitAmount: 0, CreditAmount: request.amount },
    ],
    checkNumber,
    paidAt,
  };
}

/** Puts the desks' names on `requests` (pending first, then newest first). A missing name reads as its id. */
export function describeParishDisbursements(
  requests: readonly ParishDisbursementRequest[],
  eventNames: ReadonlyMap<number, string>,
  accountNames: ReadonlyMap<number, string>,
  memberNames: ReadonlyMap<number, string>,
): ParishDisbursementDetail[] {
  return [...requests].sort(compareParishDisbursements).map((request) => ({
    request: { ...request },
    eventName: eventNames.get(request.event_id) ?? `Event ${request.event_id}`,
    glAccountName: accountNames.get(request.gl_account_id) ?? `Account ${request.gl_account_id}`,
    requestedByName: memberNames.get(request.requested_by_member_id) ?? `Member ${request.requested_by_member_id}`,
    paidByName: request.paid_by_member_id == null ? '' : (memberNames.get(request.paid_by_member_id) ?? `Member ${request.paid_by_member_id}`),
  }));
}

/** finance.getParishSplitConsole, from the council's rows as the driver loaded them. */
export function buildParishSplitConsole(
  councilId: number,
  council: Partial<Pick<Council, keyof ParishSplitSettings>>,
  accounts: readonly GLAccount[],
  events: readonly Pick<Event, 'id' | 'EventName' | 'StartDate' | 'EndDate'>[],
  donations: readonly ParishSplitDonation[],
  requests: readonly ParishDisbursementRequest[],
  memberNames: ReadonlyMap<number, string>,
): ParishSplitConsole {
  const settings = parishSplitSettings(council);
  return {
    settings,
    lineOptions: parishSplitLineOptions(accounts, councilId),
    glLine: accounts.find((a) => a.id === settings.parish_split_gl_line_id) ?? null,
    events: buildParishSplitRows(events, donations, requests, settings.parish_split_percentage),
    requests: describeParishDisbursements(
      requests,
      new Map(events.map((e) => [e.id, e.EventName])),
      new Map(accounts.map((a) => [a.id, a.AccountName])),
      memberNames,
    ),
  };
}
