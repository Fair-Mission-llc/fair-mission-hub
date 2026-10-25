// =========================================================================
// ACCOUNT OWNERS MATRIX (Sprint 10 Revision 3.1, schema version 101)
//
// AccountOwners holds the electronic accounts a council keeps - Venmo, Zelle, Zeffy, the parish ParishSoft account - and
// who to call about each: the contact's name, phone number and email, and the account holder's EIN. Every row belongs to
// one council (council_id), so a council sees and edits only its own rows. The Account Owners Matrix sits in the
// Standard Bank Accounts drawer of Council Wide Settings. The council's Active Admins and any Active Super Admin keep it
// (assertMayManageAccountOwners, the assertMayMaintainCouncilRecords rule); the drivers check every read and write.
// =========================================================================
import { cleanEinNumber } from './maintenance';
import { assertMayMaintainCouncilRecords, assertText, BusinessRuleError, optionalText, type MemberWriteActor } from './rules';

export const ACCOUNT_OWNERS_MATRIX_TITLE = 'Account Owners Matrix';
export const ACCOUNT_NAME_MAX_LENGTH = 150;
export const ACCOUNT_CONTACT_NAME_MAX_LENGTH = 100;
export const ACCOUNT_CONTACT_NUMBER_MAX_LENGTH = 50;
export const ACCOUNT_CONTACT_EMAIL_MAX_LENGTH = 100;

/** One row of AccountOwners. */
export interface AccountOwner {
  id: number;
  council_id: number;
  account_name: string;
  contact_name: string | null;
  contact_number: string | null;
  contact_email: string | null;
  ein_number: string | null;
}

/** councils.saveAccountOwner's input: `id` updates that row, no id adds one. */
export interface AccountOwnerInput {
  id?: number | null;
  account_name: string;
  contact_name?: string | null;
  contact_number?: string | null;
  contact_email?: string | null;
  ein_number?: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The input, trimmed and checked; INVALID_INPUT names the field. The EIN is stored as 'NN-NNNNNNN' (cleanEinNumber). */
export function cleanAccountOwner(input: AccountOwnerInput): Omit<AccountOwner, 'id' | 'council_id'> {
  if (input === null || typeof input !== 'object') throw new BusinessRuleError('INVALID_INPUT', 'Send the account owner as an object.', {});
  const email = optionalText(input.contact_email, 'Contact email', ACCOUNT_CONTACT_EMAIL_MAX_LENGTH);
  if (email !== null && !EMAIL.test(email)) throw new BusinessRuleError('INVALID_INPUT', `"${email}" is not an email address.`, { field: 'contact_email' });
  return {
    account_name: assertText(input.account_name, 'Account name', ACCOUNT_NAME_MAX_LENGTH),
    contact_name: optionalText(input.contact_name, 'Contact name', ACCOUNT_CONTACT_NAME_MAX_LENGTH),
    contact_number: optionalText(input.contact_number, 'Contact number', ACCOUNT_CONTACT_NUMBER_MAX_LENGTH),
    contact_email: email,
    ein_number: cleanEinNumber(input.ein_number),
  };
}

/** Who reads and keeps a council's account owners: its Active Admins and any Active Super Admin. */
export function assertMayManageAccountOwners(actor: MemberWriteActor, councilId: number): void {
  assertMayMaintainCouncilRecords(actor, councilId, "keep the council's account owners");
}

/** A second row with the same account name in one council is refused (the unique index, in words). */
export function assertAccountNameFree(rows: readonly Pick<AccountOwner, 'id' | 'account_name'>[], name: string, id: number | null | undefined): void {
  const taken = rows.find((r) => r.account_name.toLowerCase() === name.toLowerCase() && r.id !== id);
  if (taken) throw new BusinessRuleError('INVALID_INPUT', `The council already has an account named "${taken.account_name}".`, { field: 'account_name' });
}
