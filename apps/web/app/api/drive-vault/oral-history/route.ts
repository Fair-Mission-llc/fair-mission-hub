// POST /api/drive-vault/oral-history - files an Oral History Testimonial in the council's Google Drive vault (Sprint 6K).
// Takes multipart form data { file } (an audio/* recording from the Team Legacy dashboard's MediaRecorder), files it under
// Fraternal Enterprise Suite / Oral Histories and answers { archived: true, fileId }. The page then writes only that id
// to CouncilSpiritualDiary.audio_asset_url through history.addDiaryEntry.
//
// Unlike /api/drive-vault (Admins only), every Active member may record a testimonial, so the route admits any Active
// member's portal session: 401 without one, 403 for an inactive member. Live uploads still need the council's Drive
// credentials AND DRIVE_VAULT_LIVE=1; otherwise the route answers 503 { archived: false } and the page keeps the
// recording as a browser blob link.
// Sprint 10 Revision 3.1: when the council keeps its files on a Local Network Server, the upload is written there first
// (fileIntoRepository) and the answer carries the portal link to store; Google Drive is not touched.
import { NextResponse } from 'next/server';
import { assertDriveVaultUpload, describeError } from '@kofc/shared';
import { councilDriveCredentials, councilDriveOffReason, driveVaultClient } from '@/services/server/credentials-vault';
import { fileIntoRepository } from '@/services/server/file-repository';
import { requirePortalSession } from '@/services/server/session';

export async function POST(req: Request) {
  const session = await requirePortalSession(req, (actor) => actor.active, { archived: false });
  if ('denied' in session) return session.denied;

  let file: File;
  try {
    const form = await req.formData();
    const entry = form.get('file');
    if (!(entry instanceof File)) throw new Error('Attach the recording as "file".');
    file = entry;
    assertDriveVaultUpload({ kind: 'oral_history', name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size });
  } catch (err) {
    return NextResponse.json({ archived: false, message: describeError(err) }, { status: 400 });
  }

  // Sprint 10 Revision 3.1: the council's Local Network Server, when it keeps its files there.
  try {
    const ref = await fileIntoRepository(session.claims.councilId, { folder: 'Oral_Histories', prefix: 'oral-history', originalName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    if (ref) return NextResponse.json({ archived: true, fileId: ref });
  } catch (err) {
    console.error('[file-repository] network share write failed:', describeError(err));
    return NextResponse.json({ archived: false, message: 'The council file server did not accept the file. Check the server network address and the service account.' }, { status: 502 });
  }

  const creds = councilDriveCredentials(session.claims.councilId);
  if (!creds) return NextResponse.json({ archived: false, message: councilDriveOffReason(session.claims.councilId) }, { status: 503 });

  try {
    const fileId = await driveVaultClient(creds).upload('oral_history', { name: file.name, mimeType: file.type, data: new Uint8Array(await file.arrayBuffer()) });
    console.log(`[drive-vault] member ${session.claims.memberId} filed an oral history testimonial: ${fileId}`);
    return NextResponse.json({ archived: true, fileId });
  } catch (err) {
    console.error('[drive-vault] oral history upload failed:', describeError(err));
    return NextResponse.json({ archived: false, message: 'Google Drive did not accept the recording. Try again later.' }, { status: 502 });
  }
}
