// POST /api/assets/photo - an asset photo upload (Sprint 7F Extension; Google Drive since Extension 2). Multipart form:
// `file` (one image), `councilId` and `assetName`. The caller's portal session must belong to someone cleared for that
// council's inventory (mayAttachAssetPhoto: the asset managers - now including the Deputy Grand Knight - and the
// Trustees). The image goes to the council's shared drive under
//   Fraternal Enterprise Suite / Assets / <asset name>   (assetDriveFolderName)
// and the answer is its Drive file id { saved: true, fileId }, which the browser stores with expenses.setAssetPhoto.
// Unlike /api/drive-vault, the uploader need not be an Admin. With the council's Drive switched off the route answers
// 503 and saves nothing: there is no local fallback, so a stored photo is always a persistent Drive file.
// Sprint 10 Revision 3.1: when the council keeps its files on a Local Network Server, the upload is written there first
// (fileIntoRepository) and the answer carries the portal link to store; Google Drive is not touched.
import { NextResponse } from 'next/server';
import { assertDriveVaultUpload, assetDriveFolderName, describeError, mayAttachAssetPhoto } from '@kofc/shared';
import { councilDriveCredentials, councilDriveOffReason, driveVaultClient } from '@/services/server/credentials-vault';
import { fileIntoRepository } from '@/services/server/file-repository';
import { requirePortalSession } from '@/services/server/session';

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const councilId = Number(form?.get('councilId'));
  const file = form?.get('file');
  if (!Number.isInteger(councilId) || councilId <= 0 || !(file instanceof File)) {
    return NextResponse.json({ saved: false, message: 'Send one image file and the council id.' }, { status: 400 });
  }
  const session = await requirePortalSession(req, (actor) => mayAttachAssetPhoto(actor, councilId), { saved: false });
  if ('denied' in session) return session.denied;

  try {
    assertDriveVaultUpload({ kind: 'asset', name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size });
  } catch (err) {
    return NextResponse.json({ saved: false, message: describeError(err) }, { status: 400 });
  }
  // Sprint 10 Revision 3.1: the council's Local Network Server, when it keeps its files there.
  try {
    const ref = await fileIntoRepository(councilId, { folder: 'Assets', prefix: 'asset', originalName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    if (ref) return NextResponse.json({ saved: true, fileId: ref });
  } catch (err) {
    console.error('[file-repository] network share write failed:', describeError(err));
    return NextResponse.json({ saved: false, message: 'The council file server did not accept the file. Check the server network address and the service account.' }, { status: 502 });
  }

  const creds = councilDriveCredentials(councilId);
  if (!creds) return NextResponse.json({ saved: false, message: councilDriveOffReason(councilId) }, { status: 503 });

  const folder = assetDriveFolderName(form?.get('assetName'));
  try {
    const fileId = await driveVaultClient(creds).upload('asset', { name: file.name, mimeType: file.type, data: new Uint8Array(await file.arrayBuffer()) }, folder);
    console.info(`[assets] member ${session.claims.memberId} filed a photo of "${folder}" for council ${councilId}: ${fileId}`);
    return NextResponse.json({ saved: true, fileId });
  } catch (err) {
    console.error('[assets] Drive upload failed:', describeError(err));
    return NextResponse.json({ saved: false, message: 'Google Drive did not accept the photo. Try again later.' }, { status: 502 });
  }
}
