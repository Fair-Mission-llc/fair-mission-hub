// =========================================================================
// GL SPLIT ACCOUNTS (Sprint 9 Revision 6.0, schema 99)
//
// A Split Account is a line of the chart of accounts (GLAccount.is_split_account) that the Treasurer codes to but that
// never holds a balance itself. Its profile (GLAccountSplitAllocation rows) names its destination accounts and the
// percentage of every posting each one receives, adding up to exactly 100.00. When donations are coded to a split
// account on the High-Volume Batch Transaction Coder (finance.batchCodeDonations), the posting's line on the split
// account is replaced by one line per destination (expandSplitJournalLines), so the books show the shares and the
// split account stays at zero. The donations still record the split account as the line they were coded to.
//
// Sprint 9 Revision 6.1: only a Revenue account may be a Split Account (GL_SPLIT_ACCOUNT_TYPE), and the split is applied
// to EVERY posting, not only the batch coder's: each driver's one journal writer (insertJournalLines) passes every
// transaction through expandSplitJournalLines - manual double-entry rows, concluded event and activity revenue, batch
// coding, parish settlements and the rest. A line on a Split Account is replaced, in place, by its destination lines,
// debit or credit alike, so the split account never carries a balance.
//
// Sprint 9 Revision 6.2: no on/off switch - an account is a Split Account exactly when it has destination rows on disk
// (splitAccountIdsOf); saving an empty list ends the split. The batch coder also takes a one-time Event Split Override
// (cleanSplitDestinations, in cash-audit.ts planBatchCoding): its shares replace the line's master rules for that one
// posting and are kept nowhere but in the posted lines.
//
// Rules (cleanGLSplitProfile): the account and every destination belong to the council; a destination has the same
// account type as the split account, is neither the split account itself, another split account nor a virtual goal,
// and appears once; each share is above 0 with at most two decimals, and the shares total 100.00. An account that is
// a destination of another split account cannot become a split account. Only the council's Treasurer or a Super Admin
// changes a profile (finance.setGLSplitProfile, assertMayCodeExpenseLedger); the ledger's readers see the profiles.
// =========================================================================
import { isSisterCouncilClearingAccount } from './council-accounts';
import { BusinessRuleError } from './rules';
import type { CleanJournalLine } from './finance';
import type { GLAccount, GLAccountSplitAllocation } from './types';

/** Sprint 9 Revision 6.1: the only account type that may be a Split Account. */
export const GL_SPLIT_ACCOUNT_TYPE = 'Revenue' as const;

/** True for an account the Treasurer may make a Split Account (or that is one): a Revenue line that is not a virtual goal. */
export const maySplitAccount = (account: Pick<GLAccount, 'AccountType' | 'IsVirtualGoal'>): boolean =>
  account.AccountType === GL_SPLIT_ACCOUNT_TYPE && account.IsVirtualGoal !== 1;

/** The most destinations one split account may have. */
export const GL_SPLIT_MAX_DESTINATIONS = 10;
/** The label the chart of accounts shows on a split account. */
export const GL_SPLIT_ACCOUNT_LABEL = 'Split Account';
/** Sprint 9 Revision 6.2: the batch coder's one-time override control. */
export const OVERRIDE_EVENT_SPLIT_LABEL = '⚖️ Override Event Split';

const cents = (n: number) => Math.round(n * 100);
const dollars = (c: number) => c / 100;
const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

/**
 * One destination of a split account. Sprint 11 Revision 2.1: on input a share may name an ACTIVE affiliated council
 * (affiliatedCouncilId) in place of an account; the driver swaps in that council's 'Due to Sister Council' clearing
 * account (council-accounts.ts) before the checks below, so a stored destination is always an account of the council.
 */
export interface GLSplitDestination {
  destinationAccountId: number;
  affiliatedCouncilId?: number | null;
  /** The share of each posting, as a percentage with at most two decimals. */
  percentage: number;
}

/** A split account and its destinations (finance.listGLSplitProfiles). */
export interface GLSplitProfile {
  accountId: number;
  accountName: string;
  /** Sprint 9 Revision 6.1: the split account's type; postings are split only for 'Revenue'. */
  accountType: GLAccount['AccountType'];
  destinations: (GLSplitDestination & { destinationAccountName: string })[];
}

/**
 * finance.setGLSplitProfile's input: the account's destinations and shares. Sprint 9 Revision 6.2: there is no on/off
 * switch - an account is a Split Account exactly when it has destination rows, so an empty list makes it an ordinary
 * account again.
 */
export interface GLSplitProfileInput {
  destinations: GLSplitDestination[];
}

/**
 * The GLAccount.is_split_account mirror (schema 99, kept because the schema is locked). Since Revision 6.2 the drivers
 * write it from the destination rows on every save and no rule reads it: use splitAccountIdsOf for decisions.
 */
export const isSplitAccount = (account: Pick<GLAccount, 'is_split_account'>): boolean => Number(account.is_split_account ?? 0) === 1;

/** Sprint 9 Revision 6.2: the ids of the accounts that are Split Accounts - those with destination rows on disk. */
export const splitAccountIdsOf = (allocations: readonly Pick<GLAccountSplitAllocation, 'source_gl_account_id'>[]): Set<number> =>
  new Set(allocations.map((a) => a.source_gl_account_id));

/**
 * The shared destination checks of a profile and of a one-time override: each destination is an account of the council,
 * a Revenue account, not a virtual goal, not a Split Account (`splitIds`) and listed once; each share is above 0 and up
 * to 100 with at most two decimals; the shares total exactly 100.00. `forbiddenId` (the split account itself) may not be
 * a destination. `whose` names the profile in messages.
 */
export function cleanSplitDestinations(
  destinations: unknown,
  own: readonly GLAccount[],
  splitIds: ReadonlySet<number>,
  whose: string,
  forbiddenId: number | null,
): GLSplitDestination[] {
  if (!Array.isArray(destinations) || destinations.length === 0) {
    throw invalid(`Give ${whose} at least one destination account and its share.`, { field: 'destinations' });
  }
  if (destinations.length > GL_SPLIT_MAX_DESTINATIONS) {
    throw invalid(`A split may have at most ${GL_SPLIT_MAX_DESTINATIONS} destinations; received ${destinations.length}.`, { field: 'destinations' });
  }
  const seen = new Set<number>();
  const clean: GLSplitDestination[] = [];
  for (const d of destinations as unknown[]) {
    const id = (d as GLSplitDestination | null)?.destinationAccountId;
    const pct = (d as GLSplitDestination | null)?.percentage;
    const target = own.find((a) => a.id === id);
    if (!target) throw invalid(`Destination ${JSON.stringify(id)} is not an account of this council.`, { field: 'destinations', destinationAccountId: id });
    if (target.id === forbiddenId) throw invalid(`${target.AccountName} cannot be its own destination.`, { destinationAccountId: id });
    if (splitIds.has(target.id)) throw invalid(`${target.AccountName} is a Split Account, so it cannot receive a share.`, { destinationAccountId: id });
    if (target.IsVirtualGoal === 1) throw invalid(`${target.AccountName} is a virtual goal, so it cannot receive a share.`, { destinationAccountId: id });
    // Sprint 11 Revision 2.1: a share may also go to a 'Due to Sister Council' clearing account (a Liability).
    if (target.AccountType !== GL_SPLIT_ACCOUNT_TYPE && !isSisterCouncilClearingAccount(target)) {
      throw invalid(`${target.AccountName} is a ${target.AccountType} account; every destination of ${whose} must be a Revenue account or a sister council's clearing account.`, {
        destinationAccountId: id,
      });
    }
    if (seen.has(target.id)) throw invalid(`${target.AccountName} is listed twice.`, { destinationAccountId: id });
    seen.add(target.id);
    if (typeof pct !== 'number' || !Number.isFinite(pct) || pct <= 0 || pct > 100 || Math.abs(cents(pct) - pct * 100) > 1e-6) {
      throw invalid(`The share for ${target.AccountName} must be a percentage above 0 and up to 100, with at most two decimals; received ${JSON.stringify(pct)}.`, {
        destinationAccountId: id,
      });
    }
    clean.push({ destinationAccountId: target.id, percentage: pct });
  }
  const total = clean.reduce((sum, d) => sum + cents(d.percentage), 0);
  if (total !== 10_000) throw invalid(`The shares of ${whose} must add up to 100%; they add up to ${dollars(total)}%.`, { field: 'destinations', total: dollars(total) });
  return clean;
}

/**
 * Checks a profile against the council's chart and allocation rows. Resolves to the destinations to store; an empty
 * list makes the account an ordinary account (allowed for any account). INVALID_INPUT for anything the header rules forbid.
 */
export function cleanGLSplitProfile(
  councilId: number,
  accountId: number,
  input: unknown,
  accounts: readonly GLAccount[],
  allocations: readonly GLAccountSplitAllocation[],
): GLSplitDestination[] {
  const own = accounts.filter((a) => a.CouncilID === councilId);
  const account = own.find((a) => a.id === accountId);
  if (!account) throw invalid(`Account ${JSON.stringify(accountId)} is not an account of council ${councilId}.`, { accountId, councilId });
  const destinations = typeof input === 'object' && input !== null ? (input as GLSplitProfileInput).destinations : undefined;
  if (!Array.isArray(destinations)) throw invalid('List the destination accounts and their shares (an empty list ends the split).', { field: 'destinations' });
  if (destinations.length === 0) return [];
  if (account.AccountType !== GL_SPLIT_ACCOUNT_TYPE) {
    throw invalid(`${account.AccountName} is a ${account.AccountType} account; only Revenue accounts can be Split Accounts.`, { accountId, accountType: account.AccountType });
  }
  if (account.IsVirtualGoal === 1) throw invalid(`${account.AccountName} is a virtual goal, so it cannot be a Split Account.`, { accountId });
  const feeds = allocations.find((a) => a.destination_gl_account_id === accountId && a.source_gl_account_id !== accountId);
  if (feeds) {
    const source = own.find((a) => a.id === feeds.source_gl_account_id);
    throw invalid(`${account.AccountName} receives a share of ${source?.AccountName ?? 'another split account'}, so it cannot be a Split Account itself.`, {
      accountId,
      sourceAccountId: feeds.source_gl_account_id,
    });
  }
  // The account's own rows are replaced by this save, so it does not count as a split account here.
  const splitIds = splitAccountIdsOf(allocations.filter((a) => a.source_gl_account_id !== accountId));
  return cleanSplitDestinations(destinations, own, splitIds, account.AccountName, accountId);
}

/**
 * The split accounts of a council and their destinations, in name order of the split account then the share rows.
 * Sprint 9 Revision 6.2: an account is listed when it has destination rows on disk, whatever the is_split_account mirror says.
 */
export function buildGLSplitProfiles(councilId: number, accounts: readonly GLAccount[], allocations: readonly GLAccountSplitAllocation[]): GLSplitProfile[] {
  const own = accounts.filter((a) => a.CouncilID === councilId);
  const names = new Map(own.map((a) => [a.id, a.AccountName]));
  const splitIds = splitAccountIdsOf(allocations);
  return own
    .filter((a) => splitIds.has(a.id))
    .sort((a, b) => a.AccountName.localeCompare(b.AccountName) || a.id - b.id)
    .map((a) => ({
      accountId: a.id,
      accountName: a.AccountName,
      accountType: a.AccountType,
      destinations: allocations
        .filter((r) => r.source_gl_account_id === a.id)
        .sort((x, y) => x.id - y.id)
        .map((r) => ({ destinationAccountId: r.destination_gl_account_id, destinationAccountName: names.get(r.destination_gl_account_id) ?? '', percentage: Number(r.split_percentage) })),
    }));
}

/**
 * Shares `amount` out by the destinations' percentages, to the cent: each share is rounded, and the last destination
 * takes whatever cent the rounding left, so the shares always add up to `amount`.
 */
export function splitAmount(amount: number, destinations: readonly Pick<GLSplitDestination, 'percentage'>[]): number[] {
  const total = cents(amount);
  const shares = destinations.map((d) => Math.round((total * cents(d.percentage)) / 10_000));
  const rest = total - shares.reduce((sum, c) => sum + c, 0);
  if (shares.length > 0) shares[shares.length - 1] += rest;
  return shares.map(dollars);
}

/**
 * Replaces every line posted to a Revenue split account by one line per destination carrying its share (splitAmount),
 * on the same side, in the line's place. A destination whose share rounds to zero gets no line. Lines on other accounts
 * - and on a split account that is not a Revenue account, which Revision 6.1 no longer allows - pass through unchanged.
 * Destinations are never split accounts, so running the lines through twice changes nothing.
 */
export function expandSplitJournalLines(lines: readonly CleanJournalLine[], profiles: readonly GLSplitProfile[]): CleanJournalLine[] {
  const byAccount = new Map(profiles.filter((p) => p.accountType === GL_SPLIT_ACCOUNT_TYPE).map((p) => [p.accountId, p]));
  const out: CleanJournalLine[] = [];
  for (const line of lines) {
    const profile = byAccount.get(line.GLAccountID);
    if (!profile || profile.destinations.length === 0) {
      out.push(line);
      continue;
    }
    const debit = splitAmount(line.DebitAmount, profile.destinations);
    const credit = splitAmount(line.CreditAmount, profile.destinations);
    profile.destinations.forEach((d, i) => {
      if (debit[i] === 0 && credit[i] === 0) return;
      out.push({
        ...line,
        GLAccountID: d.destinationAccountId,
        DebitAmount: debit[i],
        CreditAmount: credit[i],
        Description: `${line.Description} (${d.percentage}% of ${profile.accountName})`,
      });
    });
  }
  return out;
}
