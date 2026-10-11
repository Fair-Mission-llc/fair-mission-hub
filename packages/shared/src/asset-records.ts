// =========================================================================
// ASSET RECORD DETAILS AND THE APPROVAL REDIRECT (Sprint 6P)
// Pure helpers behind expenses.getAssetRecord, getAssetRecordForExpense and updateAssetRecord. When the Grand Knight
// approves a sheet marked is_long_term_asset, the workflow engine writes its CouncilAssetsInventory row
// (planExpenseAssetConversion) and the web desk goes straight to the asset form (assetFormPath), where the name and
// cost basis are already filled in and the approver adds the serial number, storage location and notes.
// =========================================================================
import type { AssetRecordChanges } from './contract';
import { DEPUTY_GRAND_KNIGHT_ROLE, GRAND_KNIGHT_ROLE, TRUSTEE_ROLE_NAMES } from './elections';
import { assertMayAuditCouncilExpenses, assertText, BusinessRuleError, mayAuditCouncilExpenses, type MemberWriteActor } from './rules';
import type { CouncilAssetsInventory, CouncilAssetStatus, ExpenseReport } from './types';
import { ASSET_NAME_MAX_LENGTH, COUNCIL_ASSET_STATUSES } from './workflow';

/** Longest serial_number (VARCHAR(100)). */
export const ASSET_SERIAL_MAX_LENGTH = 100;
/** Longest storage_location (VARCHAR(255)). */
export const ASSET_LOCATION_MAX_LENGTH = 255;
/** Longest notes (TEXT, capped by the rules layer). */
export const ASSET_NOTES_MAX_LENGTH = 4000;

/** Longest photo_url (VARCHAR(2000), Sprint 7F). */
export const ASSET_PHOTO_URL_MAX_LENGTH = 2000;

const ASSET_CHANGE_FIELDS: readonly (keyof AssetRecordChanges)[] = ['asset_name', 'current_status', 'serial_number', 'storage_location', 'notes'];

/** A trimmed optional text, null when blank. */
function optionalText(value: unknown, label: string, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const text = assertText(value, label, maxLength, false);
  return text === '' ? null : text;
}

/** Validates an asset form's changes. Unknown fields, a blank name, an unknown status or an over-long text: INVALID_INPUT. */
export function cleanAssetRecordChanges(input: AssetRecordChanges): AssetRecordChanges {
  for (const key of Object.keys(input ?? {})) {
    if (!ASSET_CHANGE_FIELDS.includes(key as keyof AssetRecordChanges)) {
      throw new BusinessRuleError('INVALID_INPUT', `An asset record has no editable field "${key}".`, { field: key });
    }
  }
  const out: AssetRecordChanges = {};
  if (input.asset_name !== undefined) out.asset_name = assertText(input.asset_name, 'Asset name', ASSET_NAME_MAX_LENGTH);
  if (input.current_status !== undefined) {
    if (!(COUNCIL_ASSET_STATUSES as readonly string[]).includes(input.current_status)) {
      throw new BusinessRuleError('INVALID_INPUT', `Asset status must be one of ${COUNCIL_ASSET_STATUSES.join(', ')}; received ${JSON.stringify(input.current_status)}.`, {
        status: input.current_status,
      });
    }
    out.current_status = input.current_status;
  }
  if (input.serial_number !== undefined) out.serial_number = optionalText(input.serial_number, 'Serial number', ASSET_SERIAL_MAX_LENGTH);
  if (input.storage_location !== undefined) out.storage_location = optionalText(input.storage_location, 'Storage location', ASSET_LOCATION_MAX_LENGTH);
  if (input.notes !== undefined) out.notes = optionalText(input.notes, 'Notes', ASSET_NOTES_MAX_LENGTH);
  return out;
}

/**
 * Sprint 7F Extension: an asset's photo_url - normally the portal path of an image saved on the server
 * (/api/media/assets/<council>/<file>), or an http(s) link, a Drive file id or null. Never script or data links:
 * INVALID_INPUT, as for an over-long value.
 */
export function cleanAssetPhotoUrl(value: unknown): string | null {
  const photo = optionalText(value, 'Asset photo', ASSET_PHOTO_URL_MAX_LENGTH);
  if (photo !== null && /^\s*(javascript|vbscript|data|blob):/i.test(photo)) {
    throw new BusinessRuleError('INVALID_INPUT', 'An asset photo must be an uploaded file or a web link.', { field: 'photo_url' });
  }
  return photo;
}

/** The council's Active Grand Knight: the officer whose approval creates the asset row. */
const isCouncilGrandKnight = (actor: MemberWriteActor, councilId: number): boolean =>
  actor.active && actor.councilId === councilId && (actor.roles ?? []).includes(GRAND_KNIGHT_ROLE);

/**
 * Reading and completing the council's asset records (Sprint 6P): the expense leadership (an Active Admin, Financial
 * Secretary or Treasurer of the council, or any Active Super Admin; assertMayAuditCouncilExpenses), and the council's
 * Active Grand Knight, who lands on the asset form after approving. ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED otherwise.
 */
export function assertMayManageCouncilAssets(actor: MemberWriteActor, councilId: number, action: string): void {
  if (isCouncilGrandKnight(actor, councilId)) return;
  assertMayAuditCouncilExpenses(actor, councilId, action);
}

/** assertMayManageCouncilAssets as a yes/no. */
export const mayManageCouncilAssets = (actor: MemberWriteActor, councilId: number): boolean =>
  isCouncilGrandKnight(actor, councilId) || mayAuditCouncilExpenses(actor, councilId);

/**
 * Sprint 7F Extension: the officers who look after the council's property besides the asset managers - its Deputy Grand
 * Knight and its three Trustees. They may read the inventory and add photos, not change the other details.
 */
export const ASSET_PHOTO_OFFICER_ROLES: readonly string[] = [DEPUTY_GRAND_KNIGHT_ROLE, ...TRUSTEE_ROLE_NAMES];

const isCouncilPropertyOfficer = (actor: MemberWriteActor, councilId: number): boolean =>
  actor.active && actor.councilId === councilId && (actor.roles ?? []).some((r) => ASSET_PHOTO_OFFICER_ROLES.includes(r));

/** Reading the inventory and adding photos: the asset managers, plus the council's Active Deputy Grand Knight and Trustees. */
export const mayAttachAssetPhoto = (actor: MemberWriteActor, councilId: number): boolean =>
  mayManageCouncilAssets(actor, councilId) || isCouncilPropertyOfficer(actor, councilId);

/** mayAttachAssetPhoto as an assertion: ADMIN_REQUIRED or COUNCIL_ACCESS_DENIED, as assertMayManageCouncilAssets. */
export function assertMayAttachAssetPhoto(actor: MemberWriteActor, councilId: number, action: string): void {
  if (isCouncilPropertyOfficer(actor, councilId)) return;
  assertMayManageCouncilAssets(actor, councilId, action);
}

/** RECORD_NOT_FOUND unless the asset row exists. */
export function requireAssetRecord<T extends CouncilAssetsInventory>(row: T | null | undefined, assetId: number): T {
  if (!row) throw new BusinessRuleError('RECORD_NOT_FOUND', `Asset record ${assetId} does not exist.`, { assetId });
  return row;
}

/** The web asset form for one record. */
export const assetFormPath = (assetId: number): string => `/expenses/assets?asset=${assetId}`;

/** True when an approved sheet created an asset row, so the desk should open the asset form next. */
export const opensAssetForm = (report: Pick<ExpenseReport, 'Status'> & { is_long_term_asset?: number }): boolean =>
  report.is_long_term_asset === 1 && (report.Status === 'Approved' || report.Status === 'Reimbursed');
