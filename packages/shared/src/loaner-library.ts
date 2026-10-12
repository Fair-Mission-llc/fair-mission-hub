// =========================================================================
// THE CROSS-COUNCIL LOANER LIBRARY (Sprint 8F, schema version 77)
//
// A council may lend its long-term assets (CouncilAssetsInventory) to brother councils. Five columns carry the loan:
//   is_loanable           1 while the item is in the shared pool;
//   loan_status           AVAILABLE, CHECKED_OUT or UNAVAILABLE (held out of the pool for now: repairs, own use);
//   borrower_name,        who has the item and for which council, while CHECKED_OUT;
//   borrower_council
//   expected_return_date  when it is due back, while CHECKED_OUT (an item past it is overdue).
//
// The Grand Knight Desk (which the Deputy Grand Knight shares) and the /inventory/loaner-library page let the council's
// Grand Knight or Deputy Grand Knight - or any Super Admin - list an item, pause and resume it, check it out and log its
// return in one click (expenses.updateAssetLoan, planned here by planAssetLoanChange). Every Active member of any
// council reads the shared directory (expenses.listLoanerLibrary): the listed ACTIVE items of every council, never
// their cost, serial number, notes or storage place.
// =========================================================================
import type { SessionUser } from './contract';
import { holdsGrandKnightSeat, isSuperAdmin } from './permissions';
import {
  assertIsoDate,
  assertText,
  BusinessRuleError,
  describeActor,
  hasSuperAdminRights,
  holdsGrandKnightAuthority,
  SecurityPrivilegeError,
  type MemberWriteActor,
} from './rules';
import type { Council, CouncilAssetLoanStatus, CouncilAssetsInventory } from './types';

type Actor = Pick<SessionUser, 'memberId' | 'councilId' | 'memberType' | 'isOfficer'> & { roles?: readonly string[] };

export const ASSET_LOAN_STATUSES: readonly CouncilAssetLoanStatus[] = ['AVAILABLE', 'CHECKED_OUT', 'UNAVAILABLE'];

export const ASSET_LOAN_STATUS_LABELS: Record<CouncilAssetLoanStatus, string> = {
  AVAILABLE: 'Available',
  CHECKED_OUT: 'Checked out',
  UNAVAILABLE: 'Paused',
};

/** Longest borrower_name and borrower_council (VARCHAR(255)). */
export const LOAN_BORROWER_MAX_LENGTH = 255;

/** The page of the shared directory. */
export const LOANER_LIBRARY_HREF = '/inventory/loaner-library';

/** One click on the loan controls. */
export type AssetLoanChange =
  | { action: 'list' }
  | { action: 'unlist' }
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'check-out'; borrower_name: string; borrower_council: string; expected_return_date: string }
  | { action: 'return' };

export type AssetLoanColumns = Pick<CouncilAssetsInventory, 'is_loanable' | 'loan_status' | 'borrower_name' | 'borrower_council' | 'expected_return_date'>;

const AVAILABLE_COLUMNS = { loan_status: 'AVAILABLE' as const, borrower_name: null, borrower_council: null, expected_return_date: null };

const conflict = (message: string, details: Record<string, unknown>) => new BusinessRuleError('ILLEGAL_STATE_TRANSITION', message, details);

/** The asset's loan status, AVAILABLE for a row from before schema 77. */
export const loanStatusOf = (asset: Pick<CouncilAssetsInventory, 'loan_status'>): CouncilAssetLoanStatus => asset.loan_status ?? 'AVAILABLE';

/** True while the item is in the shared pool. */
export const isLoanable = (asset: Pick<CouncilAssetsInventory, 'is_loanable'>): boolean => Number(asset.is_loanable ?? 0) === 1;

/** True for a checked-out item past its expected return date. */
export const isLoanOverdue = (asset: Pick<CouncilAssetsInventory, 'loan_status' | 'expected_return_date'>, today: string): boolean =>
  loanStatusOf(asset) === 'CHECKED_OUT' && typeof asset.expected_return_date === 'string' && asset.expected_return_date.slice(0, 10) < today;

/**
 * The columns one loan click writes. Rules:
 *   list      an ACTIVE item not yet in the pool joins it, AVAILABLE;
 *   unlist    leaves the pool; refused while CHECKED_OUT (log the return first);
 *   pause     AVAILABLE -> UNAVAILABLE;           resume  UNAVAILABLE -> AVAILABLE (ACTIVE items only);
 *   check-out AVAILABLE and listed -> CHECKED_OUT with the borrower, the council and a return date of today or later;
 *   return    CHECKED_OUT -> AVAILABLE, the borrower fields cleared.
 * ILLEGAL_STATE_TRANSITION for a click the item's state does not allow; INVALID_INPUT for a bad borrower or date.
 */
export function planAssetLoanChange(asset: CouncilAssetsInventory, change: AssetLoanChange, today: string): Partial<AssetLoanColumns> {
  const status = loanStatusOf(asset);
  const listed = isLoanable(asset);
  const details = { assetId: asset.id, loanStatus: status, action: change?.action };
  const requireActive = () => {
    if (asset.current_status !== 'ACTIVE') throw conflict(`Asset ${asset.id} is ${asset.current_status}; only an ACTIVE asset can be lent.`, details);
  };
  const requireListed = () => {
    if (!listed) throw conflict(`Asset ${asset.id} is not in the loaner library.`, details);
  };
  switch (change?.action) {
    case 'list':
      requireActive();
      if (listed) throw conflict(`Asset ${asset.id} is already in the loaner library.`, details);
      return { is_loanable: 1, ...AVAILABLE_COLUMNS };
    case 'unlist':
      requireListed();
      if (status === 'CHECKED_OUT') throw conflict(`Asset ${asset.id} is checked out; log its return before taking it out of the library.`, details);
      return { is_loanable: 0, ...AVAILABLE_COLUMNS };
    case 'pause':
      requireListed();
      if (status !== 'AVAILABLE') throw conflict(`Only an available item can be paused; asset ${asset.id} is ${status}.`, details);
      return { loan_status: 'UNAVAILABLE' };
    case 'resume':
      requireListed();
      requireActive();
      if (status !== 'UNAVAILABLE') throw conflict(`Only a paused item can be resumed; asset ${asset.id} is ${status}.`, details);
      return { loan_status: 'AVAILABLE' };
    case 'check-out': {
      requireListed();
      requireActive();
      if (status !== 'AVAILABLE') throw conflict(`Only an available item can be checked out; asset ${asset.id} is ${status}.`, details);
      const borrower_name = assertText(change.borrower_name, 'Borrower name', LOAN_BORROWER_MAX_LENGTH);
      const borrower_council = assertText(change.borrower_council, 'Borrowing council', LOAN_BORROWER_MAX_LENGTH);
      const expected_return_date = assertIsoDate(change.expected_return_date, 'Expected return date');
      if (expected_return_date < today) {
        throw new BusinessRuleError('INVALID_INPUT', `Expected return date must be today or later; received ${expected_return_date}.`, { expected_return_date, today });
      }
      return { loan_status: 'CHECKED_OUT', borrower_name, borrower_council, expected_return_date };
    }
    case 'return':
      if (status !== 'CHECKED_OUT') throw conflict(`Asset ${asset.id} is not checked out.`, details);
      return { ...AVAILABLE_COLUMNS };
    default:
      throw new BusinessRuleError('INVALID_INPUT', `Unknown loan action ${JSON.stringify((change as { action?: unknown })?.action)}.`, {});
  }
}

// ---- access ---------------------------------------------------------------------------------------------------------

/**
 * Lending the council's assets: its Active Grand Knight or Deputy Grand Knight, or any Active Super Admin.
 * GRAND_KNIGHT_REQUIRED, or COUNCIL_ACCESS_DENIED for another council's Grand Knight.
 */
export function assertMayLendCouncilAssets(actor: MemberWriteActor, councilId: number, action: string): void {
  if (hasSuperAdminRights(actor)) return;
  if (actor.active && holdsGrandKnightAuthority(actor.roles)) {
    if (actor.councilId === councilId) return;
    throw new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} in council ${councilId}.`, {
      actorId: actor.memberId,
      actorCouncilId: actor.councilId,
      councilId,
    });
  }
  throw new SecurityPrivilegeError(
    'GRAND_KNIGHT_REQUIRED',
    `Only the council's Grand Knight, Deputy Grand Knight or a Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, councilId },
  );
}

/** The portal's twin of assertMayLendCouncilAssets. */
export const canLendCouncilAssets = (u: Actor, councilId: number): boolean => isSuperAdmin(u) || (u.councilId === councilId && holdsGrandKnightSeat(u));

/** Reading the shared directory: any Active member of any council (NOT_ACTIVE_COUNCIL_MEMBER otherwise). */
export function assertMayBrowseLoanerLibrary(actor: MemberWriteActor): void {
  if (actor.active) return;
  throw new BusinessRuleError('NOT_ACTIVE_COUNCIL_MEMBER', `Member ${actor.memberId} is not active and cannot browse the loaner library.`, { actorId: actor.memberId });
}

// ---- the shared directory ---------------------------------------------------------------------------------------------

/** One listed item as every council sees it: no cost, serial number, notes or storage place. */
export interface LoanerLibraryEntry {
  assetId: number;
  assetName: string;
  photoUrl: string | null;
  councilId: number;
  councilNumber: number | null;
  councilName: string;
  loanStatus: CouncilAssetLoanStatus;
  borrowerName: string | null;
  borrowerCouncil: string | null;
  expectedReturnDate: string | null;
  overdue: boolean;
}

/** The directory: listed ACTIVE items of every council, available first, then by council number and name. */
export function buildLoanerLibrary(
  assets: readonly CouncilAssetsInventory[],
  councils: readonly Pick<Council, 'id' | 'CouncilNumber' | 'CouncilName'>[],
  today: string,
): LoanerLibraryEntry[] {
  const byId = new Map(councils.map((c) => [c.id, c]));
  const rank: Record<CouncilAssetLoanStatus, number> = { AVAILABLE: 0, CHECKED_OUT: 1, UNAVAILABLE: 2 };
  return assets
    .filter((a) => isLoanable(a) && a.current_status === 'ACTIVE')
    .map((a) => {
      const council = byId.get(a.council_id);
      return {
        assetId: a.id,
        assetName: a.asset_name,
        photoUrl: a.photo_url ?? null,
        councilId: a.council_id,
        councilNumber: council?.CouncilNumber ?? null,
        councilName: council?.CouncilName ?? `Council ${a.council_id}`,
        loanStatus: loanStatusOf(a),
        borrowerName: a.borrower_name ?? null,
        borrowerCouncil: a.borrower_council ?? null,
        expectedReturnDate: a.expected_return_date ? a.expected_return_date.slice(0, 10) : null,
        overdue: isLoanOverdue(a, today),
      };
    })
    .sort(
      (x, y) =>
        rank[x.loanStatus] - rank[y.loanStatus] ||
        (x.councilNumber ?? 0) - (y.councilNumber ?? 0) ||
        x.assetName.localeCompare(y.assetName) ||
        x.assetId - y.assetId,
    );
}
