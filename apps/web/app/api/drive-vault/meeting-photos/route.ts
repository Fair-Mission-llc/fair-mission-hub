// POST /api/drive-vault/meeting-photos - the Historian Desk's photo upload (Sprint 8B). Takes multipart form data { file }
// (an image of a parish event or meeting), files it in the council's Google Drive vault under
// Fraternal Enterprise Suite / Media / Meeting_Photos and answers { archived: true, fileId }. The desk then writes that id
// to the meeting with meetings.setMeetingPhoto.
//
// Unlike /api/drive-vault (Admins only), the council's Council Historian may file here too, so the route admits the
// portal session of anyone who keeps the scrapbook (mayKeepScrapbook: the Active Historian, Admins, Super Admins): 401
// without a session, 403 otherwise. Live uploads still need the council's Drive credentials AND DRIVE_VAULT_LIVE=1;
// otherwise the route answers 503 { archived: false } and the desk keeps the photo as a browser blob link.
import { NextResponse } from 'next/server';
import { assertDriveVaultUpload, describeError, MEETING_PHOTO_DRIVE_FOLDER, mayKeepScrapbook } from '@kofc/shared';
import { councilDriveCredentials, councilDriveOffReason, driveVaultClient } from '@/services/server/credentials-vault';
import { requirePortalSession } from '@/services/server/session';

export async function POST(req: Request) {
  const session = await requirePortalSession(req, (actor) => mayKeepScrapbook(actor, actor.councilId), { archived: false });
  if ('denied' in session) return session.denied;

  let file: File;
  try {
    const form = await req.formData();
    const entry = form.get('file');
    if (!(entry instanceof File)) throw new Error('Attach the photo as "file".');
    file = entry;
    assertDriveVaultUpload({ kind: 'media', name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size });
  } catch (err) {
    return NextResponse.json({ archived: false, message: describeError(err) }, { status: 400 });
  }

  const creds = councilDriveCredentials(session.claims.councilId);
  if (!creds) return NextResponse.json({ archived: false, message: councilDriveOffReason(session.claims.councilId) }, { status: 503 });

  try {
    const fileId = await driveVaultClient(creds).upload('media', { name: file.name, mimeType: file.type, data: new Uint8Array(await file.arrayBuffer()) }, MEETING_PHOTO_DRIVE_FOLDER);
    console.log(`[drive-vault] member ${session.claims.memberId} filed a meeting photo: ${fileId}`);
    return NextResponse.json({ archived: true, fileId });
  } catch (err) {
    console.error('[drive-vault] meeting photo upload failed:', describeError(err));
    return NextResponse.json({ archived: false, message: 'Google Drive did not accept the photo. Try again later.' }, { status: 502 });
  }
}
