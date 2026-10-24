// =========================================================================
// DEPOSIT PHOTOS (Sprint 9 Revision 3.0, schema 98)
// Pure rules behind donations.attachDepositPhoto / listAttachments and the phone's '📸 Attach Deposit Photo' button.
// When a collector records a Cash or Check donation on the Donate tab, they may photograph the cash or the check
// before it goes into the deposit bag. The phone compresses the shot (DEPOSIT_PHOTO_QUALITY), copies it into the app's
// media folder and stores one TransactionAttachments row per photo: the donation, the file path and when it was taken.
//
// Who: anyone with the right to change the donation (rules.ts assertMayChangeDonation) - the member who recorded it,
// the owner of its event, the council's Financial Secretary or Treasurer, an Admin of its council or a Super Admin.
// The same right reads the photos back, because a check photo shows the donor's bank details. A photo is not added
// once the event's collection session is concluded (assertCollectionOpen). Only Cash and Check donations take one.
// =========================================================================
import { BusinessRuleError } from './rules';
import type { DonationMethodKind } from './contract';

/** The button on the phone's Cash and Check donation forms. */
export const DEPOSIT_PHOTO_TITLE = '📸 Attach Deposit Photo';
/** The donation method kinds that take a deposit photo. */
export const DEPOSIT_PHOTO_METHOD_KINDS: readonly DonationMethodKind[] = ['cash', 'check'];
/**
 * JPEG quality the phone camera saves a deposit photo at (0-1; other photos use 0.8): the compression that keeps files
 * small while a check stays readable.
 */
export const DEPOSIT_PHOTO_QUALITY = 0.5;
/** TransactionAttachments.file_path is VARCHAR(500). */
export const ATTACHMENT_PATH_MAX_LENGTH = 500;

/** Whether a donation of this method kind may carry a deposit photo. */
export const takesDepositPhoto = (kind: DonationMethodKind): boolean => DEPOSIT_PHOTO_METHOD_KINDS.includes(kind);

/** INVALID_INPUT unless the donation was taken in cash or by check. */
export function assertDepositPhotoMethod(kind: DonationMethodKind, donationId: number): void {
  if (takesDepositPhoto(kind)) return;
  throw new BusinessRuleError('INVALID_INPUT', `Donation ${donationId} was not taken in cash or by check, so it takes no deposit photo.`, {
    donationId,
    kind,
  });
}

/** The trimmed file path; INVALID_INPUT when blank or longer than the column allows. */
export function cleanAttachmentPath(filePath: string | null | undefined): string {
  const path = (filePath ?? '').trim();
  if (!path) throw new BusinessRuleError('INVALID_INPUT', 'Take the deposit photo first: no file path was given.', {});
  if (path.length > ATTACHMENT_PATH_MAX_LENGTH) {
    throw new BusinessRuleError('INVALID_INPUT', `The photo's file path is ${path.length} characters; the limit is ${ATTACHMENT_PATH_MAX_LENGTH}.`, {
      length: path.length,
      max: ATTACHMENT_PATH_MAX_LENGTH,
    });
  }
  return path;
}
