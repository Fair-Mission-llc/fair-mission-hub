// =========================================================================
// THE RELATIONAL PARISH MATRIX (Sprint 11 Revision 21.0, schema 113)
//
// Parishes, Pastors and PastorParishMappings replace the old Parish and Pastor tables:
//   - A council keeps any number of parishes (Parishes.council_id) and pastors (Pastors.council_id).
//   - A pastor serves any number of parishes: one PastorParishMappings row per pastor and parish (unique pair).
//   - A council links to one parish, its home parish (Parishes.associated_council_id, unique). Only a parish the council
//     keeps itself can be linked.
//
// Linking a parish provisions the parish's money accounts in that council's General Ledger, in the same transaction
// (parishes.setCouncilAssociation):
//   1. The Account Owner: an Asset account named PARISH_ACCOUNT_PREFIX + the parish name, ownership_type
//      PARENT_ORGANIZATION (the shield: gifts paid into it are the parish's, kept off the council's books), its display
//      name the parish name and its contact number the parish phone. Parishes.gl_account_id points at it.
//   2. Its baseline Asset rows, one per PARISH_BASELINE_ASSET_ACCOUNTS entry, filed under the owner (ParentAccountID).
// Nothing is created twice: the owner the parish already names is reused, then an account of the same name, then the
// baseline rows already filed under the owner. An account of the same name that is not a parish (PARENT_ORGANIZATION)
// Asset account is a conflict the Admin settles by renaming it. Unlinking keeps every account and its history.
// =========================================================================
import { COUNCIL_ACCOUNT_TYPE } from './council-accounts';
import { GL_ACCOUNT_NAME_MAX_LENGTH } from './finance';
import { assertMayMaintainCouncilRecords, BusinessRuleError, type MemberWriteActor } from './rules';
import type { GLAccount, Parish } from './types';

/** The Parish & Pastors page and its manuals' name for the feature. */
export const PARISH_PASTORS_TITLE = 'Parish & Pastors Linkage';
/** The button that links the council to a parish, and the badge a linked parish shows. */
export const LINK_HOME_PARISH_LABEL = 'Link as home parish';
export const UNLINK_HOME_PARISH_LABEL = 'Unlink home parish';
export const HOME_PARISH_BADGE = 'Home parish';

/** Every provisioned account's ledger name starts with this. */
export const PARISH_ACCOUNT_PREFIX = 'Parish - ';

/** The baseline Asset rows filed under a parish's Account Owner: the suffix of each row's name. */
export const PARISH_BASELINE_ASSET_ACCOUNTS: readonly { suffix: string; purpose: string }[] = [
  { suffix: 'Electronic Giving', purpose: "Gifts paid through the parish's own card, QR or online giving portal." },
  { suffix: 'Cash & Check Collections', purpose: 'Cash and checks collected for the parish at joint events.' },
];

/** The ownership token every provisioned account holds. */
export const PARISH_ACCOUNT_OWNERSHIP = 'PARENT_ORGANIZATION' as const;

/** Shortens `name` so `before + name + after` fits a ledger name (GL_ACCOUNT_NAME_MAX_LENGTH). */
function fitName(before: string, name: string, after = ''): string {
  const room = GL_ACCOUNT_NAME_MAX_LENGTH - before.length - after.length;
  const cut = name.length > room ? name.slice(0, Math.max(room, 1)).trimEnd() : name;
  return `${before}${cut}${after}`;
}

/** The Account Owner's ledger name: 'Parish - St. Mary's Cathedral Parish'. */
export const parishOwnerAccountName = (parishName: string): string => fitName(PARISH_ACCOUNT_PREFIX, parishName.trim());

/** A baseline row's ledger name: 'Parish - St. Mary's Cathedral Parish - Electronic Giving'. */
export const parishBaselineAccountName = (parishName: string, suffix: string): string => fitName(PARISH_ACCOUNT_PREFIX, parishName.trim(), ` - ${suffix}`);

/** The GLAccount columns of one provisioned account (the driver adds the id). */
export type ParishLedgerAccountRow = Omit<GLAccount, 'id'> & { ownership_type: typeof PARISH_ACCOUNT_OWNERSHIP };

/** The Account Owner row a parish link creates in `councilId`'s ledger. */
export function parishOwnerAccountRow(parish: Pick<Parish, 'parish_name' | 'phone'>, councilId: number): ParishLedgerAccountRow {
  return {
    CouncilID: councilId,
    AccountName: parishOwnerAccountName(parish.parish_name),
    AccountType: COUNCIL_ACCOUNT_TYPE,
    ParentAccountID: null,
    IsVirtualGoal: 0,
    TargetGoalAmount: 0,
    is_split_account: 0,
    account_display_name: parish.parish_name.trim(),
    contact_name: null,
    contact_number: parish.phone ?? null,
    contact_email: null,
    ein_number: null,
    ownership_type: PARISH_ACCOUNT_OWNERSHIP,
    due_to_council_id: null,
  };
}

/** The baseline row with `suffix`, filed under the owner account `ownerId`. */
export function parishBaselineAccountRow(parish: Pick<Parish, 'parish_name'>, councilId: number, ownerId: number, suffix: string): ParishLedgerAccountRow {
  const name = parish.parish_name.trim();
  return {
    CouncilID: councilId,
    AccountName: parishBaselineAccountName(name, suffix),
    AccountType: COUNCIL_ACCOUNT_TYPE,
    ParentAccountID: ownerId,
    IsVirtualGoal: 0,
    TargetGoalAmount: 0,
    is_split_account: 0,
    account_display_name: `${name} (${suffix})`.slice(0, 150),
    contact_name: null,
    contact_number: null,
    contact_email: null,
    ein_number: null,
    ownership_type: PARISH_ACCOUNT_OWNERSHIP,
    due_to_council_id: null,
  };
}

/** Whether an account can stand as (or under) a parish's Account Owner: a plain PARENT_ORGANIZATION Asset account. */
export const isParishLedgerAccount = (a: Pick<GLAccount, 'AccountType' | 'IsVirtualGoal' | 'due_to_council_id' | 'ownership_type'>): boolean =>
  a.AccountType === COUNCIL_ACCOUNT_TYPE && Number(a.IsVirtualGoal) !== 1 && a.due_to_council_id == null && a.ownership_type === PARISH_ACCOUNT_OWNERSHIP;

/**
 * The account of the council's chart named `name` (ignoring case) that a link may reuse, or null when there is none.
 * An account of that name that is not a parish account is INVALID_INPUT: the Admin renames it first.
 */
export function reusableParishAccount<T extends GLAccount>(accounts: readonly T[], name: string): T | null {
  const hit = accounts.find((a) => a.AccountName.toLowerCase() === name.toLowerCase());
  if (!hit) return null;
  if (!isParishLedgerAccount(hit)) {
    throw new BusinessRuleError('INVALID_INPUT', `The council's chart already has an account named "${hit.AccountName}" that is not a parish account. Rename it, then link the parish again.`, {
      field: 'AccountName',
      accountId: hit.id,
    });
  }
  return hit;
}

/** What parishes.setCouncilAssociation did. */
export interface ParishAssociationResult {
  councilId: number;
  /** The parish now linked to the council, or null after an unlink. */
  parish: Parish | null;
  /** The parish's Account Owner, or null after an unlink. */
  ownerAccount: GLAccount | null;
  /** The baseline Asset rows under the owner, in PARISH_BASELINE_ASSET_ACCOUNTS order. */
  baselineAccounts: GLAccount[];
  /** How many ledger accounts this call created (0 when every account already existed). */
  accountsCreated: number;
}

/** The council's Active Admins and any Active Super Admin link the council to a parish. */
export function assertMayAssociateParish(actor: MemberWriteActor, councilId: number): void {
  assertMayMaintainCouncilRecords(actor, councilId, 'link the council to a parish');
}

/** A council links only to a parish it keeps itself. */
export function assertParishKeptByCouncil(parish: Pick<Parish, 'id' | 'council_id' | 'parish_name'>, councilId: number): void {
  if (parish.council_id === councilId) return;
  throw new BusinessRuleError('INVALID_INPUT', `${parish.parish_name} is kept by another council, so council ${councilId} cannot link to it. Add the parish to this council first.`, {
    parishId: parish.id,
    councilId,
  });
}

/** A parish a council is linked to cannot be moved to another council or deleted until it is unlinked. */
export function linkedParishError(parish: Pick<Parish, 'id' | 'parish_name' | 'associated_council_id'>, action: 'move' | 'delete'): BusinessRuleError {
  return new BusinessRuleError('RECORD_IN_USE', `${parish.parish_name} is a council's home parish. Unlink it before you ${action} it.`, {
    parishId: parish.id,
    associatedCouncilId: parish.associated_council_id ?? null,
  });
}

/** A pastor assignment needs rights over both the pastor's and the parish's council. */
export function assertMayAssignPastor(actor: MemberWriteActor, pastorCouncilId: number, parishCouncilId: number): void {
  assertMayMaintainCouncilRecords(actor, pastorCouncilId, 'assign pastors');
  if (parishCouncilId !== pastorCouncilId) assertMayMaintainCouncilRecords(actor, parishCouncilId, 'assign pastors to that parish');
}

export const noPastorAssignment = (pastorId: number, parishId: number): BusinessRuleError =>
  new BusinessRuleError('RECORD_NOT_FOUND', `Pastor ${pastorId} is not assigned to parish ${parishId}.`, { pastorId, parishId });
