// =========================================================================
// MULTI-TENANT ACCOUNT OWNERSHIP CODES (Sprint 8O, schema 85)
//
// Every payment method a council enables (CouncilDonationMethod - an electronic gateway profile such as a card reader,
// a Venmo, Zelle or Zeffy page or a parish giving portal) names who owns the account the money lands in:
// account_owner_entity 'COUNCIL' (DEFAULT), 'PARISH' or 'THIRD_PARTY'. The payment method editor (Council Lookups >
// Enabled donation methods) will not save a row until its owner is chosen: the drivers refuse a missing or unknown
// owner (cleanAccountOwnerEntity, INVALID_INPUT), and the page holds the save while any row is blank.
//
// The owner feeds the Parish Fundraiser Revenue Split Console (parish-split.ts): an electronic donation given through a
// PARISH-owned method is Revenue Held by Parish, settled against the parish share with no check, and the batch coder
// (cash-audit.ts) leaves it out so it never reaches the council's books.
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

/** The owner of each payment method a council enabled, keyed by DonationMethodID (methods it never enabled are absent). */
export function accountOwnersByMethod(
  links: readonly { CouncilID: number; DonationMethodID: number; account_owner_entity?: string | null }[],
  councilId: number,
): Map<number, AccountOwnerEntity> {
  return new Map(links.filter((l) => l.CouncilID === councilId).map((l) => [l.DonationMethodID, accountOwnerEntityOf(l)]));
}
