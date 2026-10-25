// POST /api/drive-vault - the portal's file ingestion route for the Google Drive archival vault (Sprint 6D).
// Takes multipart form data { kind: 'minutes' | 'voucher' | 'media' | 'flyer', file, folder? }, files it under
// Fraternal Enterprise Suite / Minutes | Vouchers | Media | Flyers in the council's shared drive and answers { fileId }.
// Sprint 6C: a media upload may name its event's folder (`folder`, the event name), filing it under Media / <event name>.
// The screen then stores only that id in the record's link column.
//
// The Drive credentials live only on the server (services/server/secrets.ts), never in the browser bundle. Sprint 6Y:
// the private key is looked up per council at runtime - the council's GOOGLE_DRIVE_PRIVATE_KEY from the Centralized
// Encrypted Credentials Vault when it has one, else the server's own (services/server/credentials-vault.ts).
//
// Sprint 6Z-Engine-Upgrade: the route now checks the caller's portal session (services/server/session.ts) BEFORE it
// reads the form: 401 without a session, 403 unless the session is an Active Admin or Super Admin (the same members
// whose uploads the screens send here). Live uploads still need the credentials AND DRIVE_VAULT_LIVE=1; otherwise the
// route answers 503 { archived: false } and the screen keeps the file as a browser blob link.
// Sprint 10 Revision 3.1/3.2: when the council keeps its files with OneDrive / SharePoint, Dropbox Business or a Local
// Network Server, the upload is filed there first (fileIntoRepository) and the answer carries the portal link to store;
// Google Drive is not touched.
import { NextResponse } from 'next/server';
import { assertDriveVaultUpload, cleanDriveVaultSubfolder, describeError, hasAdminRights, type FileRepositoryFolder } from '@kofc/shared';
import { councilDriveCredentials, councilDriveOffReason, driveVaultClient } from '@/services/server/credentials-vault';
import { fileIntoRepository } from '@/services/server/file-repository';
import { requirePortalSession } from '@/services/server/session';

/** The network share folder for each document kind. */
const DRIVE_KIND_FOLDER: Record<string, FileRepositoryFolder> = { minutes: 'Minutes', voucher: 'Vouchers', media: 'Media', flyer: 'Flyers' };

export async function POST(req: Request) {
  const session = await requirePortalSession(req, hasAdminRights, { archived: false });
  if ('denied' in session) return session.denied;

  let kind;
  let file: File;
  let folder: string | null;
  try {
    const form = await req.formData();
    const entry = form.get('file');
    if (!(entry instanceof File)) throw new Error('Attach the file as "file".');
    file = entry;
    kind = assertDriveVaultUpload({ kind: form.get('kind'), name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size });
    folder = kind === 'media' ? cleanDriveVaultSubfolder(form.get('folder')) : null;
  } catch (err) {
    return NextResponse.json({ archived: false, message: describeError(err) }, { status: 400 });
  }

  // Sprint 10 Revision 3.1: the council's file repository (OneDrive / SharePoint, Dropbox Business or a Local Network
  // Server since Revision 3.2), when it keeps its files there.
  try {
    const ref = await fileIntoRepository(session.claims.councilId, { folder: DRIVE_KIND_FOLDER[kind] ?? 'Media', prefix: 'doc', originalName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    if (ref) return NextResponse.json({ archived: true, fileId: ref });
  } catch (err) {
    console.error('[file-repository] repository write failed:', describeError(err));
    return NextResponse.json({ archived: false, message: 'The council file repository did not accept the file. Check the File Repository Mode settings and the key saved in the Credentials Vault.' }, { status: 502 });
  }

  const creds = councilDriveCredentials(session.claims.councilId);
  if (!creds) return NextResponse.json({ archived: false, message: councilDriveOffReason(session.claims.councilId) }, { status: 503 });

  try {
    const fileId = await driveVaultClient(creds).upload(kind, { name: file.name, mimeType: file.type, data: new Uint8Array(await file.arrayBuffer()) }, folder);
    console.log(`[drive-vault] member ${session.claims.memberId} filed a ${kind} upload: ${fileId}`);
    return NextResponse.json({ archived: true, fileId });
  } catch (err) {
    console.error('[drive-vault] upload failed:', describeError(err));
    return NextResponse.json({ archived: false, message: 'Google Drive did not accept the file. Try again later.' }, { status: 502 });
  }
}
