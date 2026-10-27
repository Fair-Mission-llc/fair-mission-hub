// =========================================================================
// ONE ACCOUNTS LEDGER (Sprint 11 Revision 2.1, schema version 103)
//
// A council's accounts live in one table, its chart of accounts (GLAccount). The old AccountOwners table is gone; its
// columns now sit on GLAccount: the name members see (account_display_name), who to call about the account (contact
// name, number, email), the holder's EIN, and the ownership_type.
//
// Sprint 11 Revision 2.2 (schema 103, no version change): ownership_type is one of three non-denominational tokens -
// 'INTERNAL_OPERATING' (DEFAULT, the chapter's or council's own operating money), 'PARENT_ORGANIZATION' (the umbrella
// institution, e.g. the parish or the core facility) or 'AFFILIATED_ENTITY' (an independent local group, partner
// non-profit or auxiliary sub-chapter). Both external tokens engage the shield: a payment method linked to such an
// account records its gifts as externally held (PARISH or THIRD_PARTY on the method and the donation snapshot), so they
// stay off the batch coder and the council's operating books; the account keeps its own name (account_display_name).
// Labels follow the tenant (accountOwnershipLabel): a Knights of Columbus council reads Council / Parish / Affiliated Entity.
//
// The Account Owners Matrix (Council Wide Settings > Standard Bank Accounts) lists and keeps the council's money accounts:
// its non-virtual Asset accounts that are not clearing accounts (isCouncilAccount). Adding a row there adds an Asset
// account to the chart. The council's Active Admins and any Active Super Admin keep it (assertMayManageCouncilAccounts).
// The Council Lookups payment method picker offers the same accounts, and a payment method linked to an account takes
// its owner from the account's ownership_type (paymentMethodOwner), so an external account's gifts are held outside the
// council and stay off the Treasurer's batch coder.
//
// Revenue splits may also send a share to an ACTIVE affiliated council. That share is posted inside the council's own
// ledger, to a 'Due to Sister Council' Liability clearing account (GLAccount.due_to_council_id = the sister council),
// which the driver creates on first use. Nothing is ever written to the sister council's books.
// =========================================================================
import { DEFAULT_ACCOUNT_OWNER_ENTITY, accountOwnerEntityOf, type AccountOwnerEntity } from './account-ownership';
import { DEFAULT_TENANT_TYPE, isFraternalTenant, type TenantType } from './tenant';
import { GL_ACCOUNT_NAME_MAX_LENGTH } from './finance';
import { cleanEinNumber } from './maintenance';
import { assertMayMaintainCouncilRecords, assertText, BusinessRuleError, optionalText, type MemberWriteActor } from './rules';
import type { GLAccount } from './types';

export const ACCOUNT_OWNERS_MATRIX_TITLE = 'Account Owners Matrix';
export const ACCOUNT_DISPLAY_NAME_MAX_LENGTH = 150;
export const ACCOUNT_CONTACT_NAME_MAX_LENGTH = 100;
export const ACCOUNT_CONTACT_NUMBER_MAX_LENGTH = 50;
export const ACCOUNT_CONTACT_EMAIL_MAX_LENGTH = 100;

/** GLAccount.ownership_type: the three universal classifications an account may hold. */
export type AccountOwnershipType = 'INTERNAL_OPERATING' | 'PARENT_ORGANIZATION' | 'AFFILIATED_ENTITY';
export const ACCOUNT_OWNERSHIP_TYPES: readonly AccountOwnershipType[] = ['INTERNAL_OPERATING', 'PARENT_ORGANIZATION', 'AFFILIATED_ENTITY'];
export const DEFAULT_ACCOUNT_OWNERSHIP_TYPE: AccountOwnershipType = 'INTERNAL_OPERATING';

/** The neutral labels a white-label (GENERIC) tenant sees. */
export const ACCOUNT_OWNERSHIP_LABELS: Record<AccountOwnershipType, string> = {
  INTERNAL_OPERATING: 'Internal Operating',
  PARENT_ORGANIZATION: 'Parent Organization',
  AFFILIATED_ENTITY: 'Affiliated Entity',
};
/** The labels a Knights of Columbus council sees. */
export const FRATERNAL_ACCOUNT_OWNERSHIP_LABELS: Record<AccountOwnershipType, string> = {
  INTERNAL_OPERATING: 'Council',
  PARENT_ORGANIZATION: 'Parish',
  AFFILIATED_ENTITY: 'Affiliated Entity',
};

/** An ownership token in the active tenant's vocabulary (KOFC when no tenant is given). */
export function accountOwnershipLabel(type: AccountOwnershipType, tenant: TenantType = DEFAULT_TENANT_TYPE): string {
  return (isFraternalTenant(tenant) ? FRATERNAL_ACCOUNT_OWNERSHIP_LABELS : ACCOUNT_OWNERSHIP_LABELS)[type];
}

/** The payment-method owner each classification records (the CouncilDonationMethod / Donation snapshot tokens). */
export const OWNERSHIP_OWNER_ENTITY: Record<AccountOwnershipType, AccountOwnerEntity> = {
  INTERNAL_OPERATING: 'COUNCIL',
  PARENT_ORGANIZATION: 'PARISH',
  AFFILIATED_ENTITY: 'THIRD_PARTY',
};

/** True for PARENT_ORGANIZATION and AFFILIATED_ENTITY: the account's money is external and the shield isolates it. */
export const isShieldedOwnership = (type: string | null | undefined): boolean => type === 'PARENT_ORGANIZATION' || type === 'AFFILIATED_ENTITY';
export const ACCOUNT_OWNERSHIP_COLUMN_LABEL = 'Owned by';

/** The chart-of-accounts type of every account the matrix adds. */
export const COUNCIL_ACCOUNT_TYPE = 'Asset' as const;

/** One of the council's money accounts, as the matrix and the payment method picker see it. */
export type CouncilAccount = GLAccount & { ownership_type: AccountOwnershipType };

/** councils.saveCouncilAccount's input: `id` changes that account, no id adds an Asset account. */
export interface CouncilAccountInput {
  id?: number | null;
  /** The ledger name (GLAccount.AccountName), unique in the council's chart. */
  AccountName: string;
  account_display_name?: string | null;
  contact_name?: string | null;
  contact_number?: string | null;
  contact_email?: string | null;
  ein_number?: string | null;
  ownership_type: AccountOwnershipType;
}

/** The columns the matrix writes. */
export type CleanCouncilAccount = Required<Omit<CouncilAccountInput, 'id'>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isAccountOwnershipType = (value: unknown): value is AccountOwnershipType =>
  typeof value === 'string' && (ACCOUNT_OWNERSHIP_TYPES as readonly string[]).includes(value);

/** The ownership classification: exactly one of ACCOUNT_OWNERSHIP_TYPES, else INVALID_INPUT naming the field. */
export function cleanOwnershipType(value: unknown): AccountOwnershipType {
  if (isAccountOwnershipType(value)) return value;
  throw new BusinessRuleError('INVALID_INPUT', `An account is classified ${ACCOUNT_OWNERSHIP_TYPES.join(', ')}; received ${JSON.stringify(value ?? null)}.`, {
    field: 'ownership_type',
    allowed: [...ACCOUNT_OWNERSHIP_TYPES],
  });
}

/** The input, trimmed and checked; INVALID_INPUT names the field. The EIN is stored as 'NN-NNNNNNN' (cleanEinNumber). */
export function cleanCouncilAccount(input: CouncilAccountInput): CleanCouncilAccount {
  if (input === null || typeof input !== 'object') throw new BusinessRuleError('INVALID_INPUT', 'Send the account as an object.', {});
  const email = optionalText(input.contact_email, 'Contact email', ACCOUNT_CONTACT_EMAIL_MAX_LENGTH);
  if (email !== null && !EMAIL.test(email)) throw new BusinessRuleError('INVALID_INPUT', `"${email}" is not an email address.`, { field: 'contact_email' });
  return {
    AccountName: assertText(input.AccountName, 'Ledger account name', GL_ACCOUNT_NAME_MAX_LENGTH),
    account_display_name: optionalText(input.account_display_name, 'Name members see', ACCOUNT_DISPLAY_NAME_MAX_LENGTH),
    contact_name: optionalText(input.contact_name, 'Contact name', ACCOUNT_CONTACT_NAME_MAX_LENGTH),
    contact_number: optionalText(input.contact_number, 'Contact number', ACCOUNT_CONTACT_NUMBER_MAX_LENGTH),
    contact_email: email,
    ein_number: cleanEinNumber(input.ein_number),
    ownership_type: cleanOwnershipType(input.ownership_type),
  };
}

/** Who reads and keeps a council's accounts matrix: its Active Admins and any Active Super Admin. */
export function assertMayManageCouncilAccounts(actor: MemberWriteActor, councilId: number): void {
  assertMayMaintainCouncilRecords(actor, councilId, "keep the council's accounts");
}

/** A money account of the council: a non-virtual Asset account that is not a sister-council clearing account. */
export const isCouncilAccount = (a: Pick<GLAccount, 'AccountType' | 'IsVirtualGoal' | 'due_to_council_id'>): boolean =>
  a.AccountType === COUNCIL_ACCOUNT_TYPE && Number(a.IsVirtualGoal) !== 1 && a.due_to_council_id == null;

/** The account's ownership, INTERNAL_OPERATING for a row without a known classification. */
export const accountOwnershipOf = (a: Pick<GLAccount, 'ownership_type'> | null | undefined): AccountOwnershipType =>
  isAccountOwnershipType(a?.ownership_type) ? a.ownership_type : DEFAULT_ACCOUNT_OWNERSHIP_TYPE;

/** The name members see: the display name, else the ledger name. */
export const councilAccountLabel = (a: Pick<GLAccount, 'AccountName' | 'account_display_name'>): string => (a.account_display_name ?? '').trim() || a.AccountName;

/** A second account with the same ledger name in one council's chart is refused. */
export function assertAccountNameFree(rows: readonly Pick<GLAccount, 'id' | 'AccountName'>[], name: string, id: number | null | undefined): void {
  const taken = rows.find((r) => r.AccountName.toLowerCase() === name.toLowerCase() && r.id !== id);
  if (taken) throw new BusinessRuleError('INVALID_INPUT', `The council's chart already has an account named "${taken.AccountName}".`, { field: 'AccountName' });
}

/**
 * The owner a payment method records on its donations: the linked account's ownership_type when it has one (read from
 * the accounts table at that moment), else the method's own stored owner (COUNCIL by default).
 */
export function paymentMethodOwner(
  link: { account_owner_entity?: string | null } | null | undefined,
  account: Pick<GLAccount, 'ownership_type'> | null | undefined,
): AccountOwnerEntity {
  if (account) return OWNERSHIP_OWNER_ENTITY[accountOwnershipOf(account)];
  return link ? accountOwnerEntityOf(link) : DEFAULT_ACCOUNT_OWNER_ENTITY;
}

/**
 * Every column that points at a GLAccount (Schema.sql foreign keys; a test keeps this list in step). An account any of
 * them still names cannot be deleted (RECORD_IN_USE) - deletes never cascade.
 */
export const GL_ACCOUNT_REFERENCES: readonly { table: string; column: string; noun: string }[] = [
  { table: 'Council', column: 'parish_split_gl_line_id', noun: 'council setting' },
  { table: 'Donation', column: 'revenue_gl_account_id', noun: 'donation' },
  { table: 'CouncilDonationMethod', column: 'account_id', noun: 'payment method' },
  { table: 'ExpenseReport', column: 'general_ledger_account_id', noun: 'payment request' },
  { table: 'GLAccount', column: 'ParentAccountID', noun: 'sub-account' },
  { table: 'JournalEntry', column: 'GLAccountID', noun: 'journal entry' },
  { table: 'ParishDisbursementRequest', column: 'gl_account_id', noun: 'parish disbursement' },
  { table: 'GLAccountSplitAllocation', column: 'source_gl_account_id', noun: 'split profile' },
  { table: 'GLAccountSplitAllocation', column: 'destination_gl_account_id', noun: 'split share' },
];

/** RECORD_IN_USE naming what still points at the account. */
export function accountInUseError(account: Pick<GLAccount, 'id' | 'AccountName'>, noun: string): BusinessRuleError {
  return new BusinessRuleError('RECORD_IN_USE', `${account.AccountName} is still used by a ${noun}, so it stays. Only an unused account can be deleted.`, {
    id: account.id,
    usedBy: noun,
  });
}

// --- Sister-council revenue shares --------------------------------------------------------------------------------

export const DUE_TO_SISTER_COUNCIL_PREFIX = 'Due to Sister Council';

/** The clearing account's ledger name for one sister council. */
export const dueToSisterCouncilName = (sister: { CouncilNumber: number | string }): string => `${DUE_TO_SISTER_COUNCIL_PREFIX} - Council ${sister.CouncilNumber}`;

/** A 'Due to Sister Council' Liability clearing account. */
export const isSisterCouncilClearingAccount = (a: Pick<GLAccount, 'AccountType' | 'due_to_council_id'>): boolean =>
  a.AccountType === 'Liability' && a.due_to_council_id != null;

/** One affiliated council a split may send a share to (finance.listSplitSisterCouncils). */
export interface SplitSisterCouncil {
  councilId: number;
  label: string;
  /** The council's clearing account for it, once one exists. */
  clearingAccountId: number | null;
}

/** INVALID_INPUT when a share names a council that is not an ACTIVE affiliate of the council. */
export function assertActiveSisterCouncil(activePartners: ReadonlySet<number>, councilId: number, sisterId: unknown): number {
  if (typeof sisterId !== 'number' || !Number.isInteger(sisterId) || sisterId === councilId || !activePartners.has(sisterId)) {
    throw new BusinessRuleError('INVALID_INPUT', `Council ${JSON.stringify(sisterId)} is not an active affiliate of council ${councilId}, so it cannot receive a share.`, {
      field: 'destinations',
      affiliatedCouncilId: sisterId,
    });
  }
  return sisterId;
}
