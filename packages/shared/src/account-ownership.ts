// =========================================================================
// MULTI-TENANT ACCOUNT OWNERSHIP CODES (Sprint 8O, schema 85)
//
// Every payment method a council enables (CouncilDonationMethod - an electronic gateway profile such as a card reader,
// a Venmo, Zelle or Zeffy page or a parish giving portal) names who owns the account the money lands in:
// account_owner_entity 'COUNCIL' (DEFAULT), 'PARISH' or 'THIRD_PARTY'. The payment method editor (Council Lookups >
// Enabled donation methods) will not save a row until its owner is chosen: the drivers refuse a missing or unknown
// owner (cleanAccountOwnerEntity, INVALID_INPUT), and the page holds the save while any row is blank.
//
// The owner once fed the Parish Fundraiser Revenue Split Console (removed in Sprint 10 Revision 3.2): an electronic donation given through a
// PARISH-owned method is Revenue Held by Parish, settled against the parish share with no check, and the batch coder
// (cash-audit.ts) leaves it out so it never reaches the council's books.
//
// Sprint 8O Extension (schema 86): each donation keeps a permanent snapshot of its method's owner, stamped by the drivers
// in the same transaction that records it (Donation.historical_account_owner_entity, donationAccountOwner). The split
// console and the batch coder read that snapshot, so changing a method's owner affects only donations recorded after.
// =========================================================================
import { BusinessRuleError } from './rules';

export type AccountOwnerEntity = 'COUNCIL' | 'PARISH' | 'THIRD_PARTY';

/** The three owners, in the order the editor offers them. */
export const ACCOUNT_OWNER_ENTITIES: readonly AccountOwnerEntity[] = ['COUNCIL', 'PARISH', 'THIRD_PARTY'];

/** The column's default: a row saved before Sprint 8O reads as the council's own account. */
export const DEFAULT_ACCOUNT_OWNER_ENTITY: AccountOwnerEntity = 'COUNCIL';

/** The editor's drop-down labels. */
export const ACCOUNT_OWNER_LABELS: Record<AccountOwnerEntity, string> = {
  COUNCIL: 'Council account',
  PARISH: 'Parish account',
  THIRD_PARTY: 'Third-party account',
};

/** The editor's column heading. */
export const ACCOUNT_OWNER_COLUMN_LABEL = 'Account owner';

/**
 * Sprint 9 Revision 6.0 (schema 99): CouncilDonationMethod.account_identity_label - the account's name as the donor sees
 * it in the payment app - its editor heading and length (VARCHAR(100)).
 */
export const ACCOUNT_IDENTITY_LABEL_COLUMN_LABEL = 'Account name donors see';
export const ACCOUNT_IDENTITY_LABEL_MAX_LENGTH = 100;

/** The owner as the phone's QR screen says it: 'the council', 'the parish' or 'a third party'. */
const OWNER_PHRASE: Record<AccountOwnerEntity, string> = { COUNCIL: "the council's", PARISH: "the parish's", THIRD_PARTY: "a third party's" };

/**
 * The line under the phone's QR code: whose account the donor pays (Sprint 9 Revision 6.0). With a label:
 * 'Pays into St. Mary's Cathedral Parish (Parish account)'; without one: 'Pays into the parish's account'.
 */
export function merchantAccountLine(link: { account_owner_entity?: string | null; account_identity_label?: string | null } | null | undefined): string {
  const owner = accountOwnerEntityOf(link);
  const label = (link?.account_identity_label ?? '').trim();
  return label ? `Pays into ${label} (${ACCOUNT_OWNER_LABELS[owner]})` : `Pays into ${OWNER_PHRASE[owner]} account`;
}

/** The front-end validation gate's text: shown, and the save held, while a row has no owner chosen. */
export const ACCOUNT_OWNER_REQUIRED_TEXT = 'Choose who owns the account each payment method pays into (Council, Parish or Third party) before you save.';

export const isAccountOwnerEntity = (value: unknown): value is AccountOwnerEntity =>
  typeof value === 'string' && (ACCOUNT_OWNER_ENTITIES as readonly string[]).includes(value);

/** A stored owner, with the column default for a row that has none. */
export const accountOwnerEntityOf = (link: { account_owner_entity?: string | null } | null | undefined): AccountOwnerEntity =>
  isAccountOwnerEntity(link?.account_owner_entity) ? link.account_owner_entity : DEFAULT_ACCOUNT_OWNER_ENTITY;

/** The strict gate: the owner must be named explicitly as one of the three; INVALID_INPUT otherwise. */
export function cleanAccountOwnerEntity(value: unknown): AccountOwnerEntity {
  if (isAccountOwnerEntity(value)) return value;
  const received = value === undefined || value === null || value === '' ? 'nothing' : JSON.stringify(value);
  throw new BusinessRuleError('INVALID_INPUT', `${ACCOUNT_OWNER_REQUIRED_TEXT} Received ${received}.`, {
    field: 'account_owner_entity',
    allowed: [...ACCOUNT_OWNER_ENTITIES],
  });
}

/** The front-end gate over the editor's rows: the message to show while any row's owner is blank, else null. */
export const accountOwnerGateMessage = (owners: readonly (string | null | undefined)[]): string | null =>
  owners.every(isAccountOwnerEntity) ? null : ACCOUNT_OWNER_REQUIRED_TEXT;

/**
 * Sprint 8O Extension (schema 86): the owner a donation was recorded under - its Donation.historical_account_owner_entity
 * snapshot, never the method's live owner, so a later change to the payment method cannot rewrite a past reconciliation.
 */
export const donationAccountOwner = (donation: { historical_account_owner_entity?: string | null }): AccountOwnerEntity =>
  accountOwnerEntityOf({ account_owner_entity: donation.historical_account_owner_entity });

/** The owner of each payment method a council enabled, keyed by DonationMethodID (methods it never enabled are absent). */
export function accountOwnersByMethod(
  links: readonly { CouncilID: number; DonationMethodID: number; account_owner_entity?: string | null }[],
  councilId: number,
): Map<number, AccountOwnerEntity> {
  return new Map(links.filter((l) => l.CouncilID === councilId).map((l) => [l.DonationMethodID, accountOwnerEntityOf(l)]));
}
