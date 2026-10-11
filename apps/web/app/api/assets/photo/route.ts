// POST /api/assets/photo - an asset photo upload (Sprint 7F Extension). Multipart form: `file` (one image) and
// `councilId`. The caller's portal session must belong to someone cleared for that council's inventory
// (mayAttachAssetPhoto: the asset managers, the Deputy Grand Knight, the Trustees). The image is checked by its bytes
// (JPEG, PNG, GIF, WebP or HEIC, at most 10 MB), saved on the server's disk (services/server/asset-media.ts) and the
// answer is its portal path { saved: true, path }, which the browser stores with expenses.setAssetPhoto.
import { NextResponse } from 'next/server';
import { mayAttachAssetPhoto } from '@kofc/shared';
import { ASSET_PHOTO_MAX_BYTES, saveAssetPhoto, sniffAssetImage } from '@/services/server/asset-media';
import { requirePortalSession } from '@/services/server/session';

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const councilId = Number(form?.get('councilId'));
  const file = form?.get('file');
  if (!Number.isInteger(councilId) || councilId <= 0 || !(file instanceof Blob)) {
    return NextResponse.json({ saved: false, message: 'Send one image file and the council id.' }, { status: 400 });
  }
  const session = await requirePortalSession(req, (actor) => mayAttachAssetPhoto(actor, councilId), { saved: false });
  if ('denied' in session) return session.denied;
  if (file.size > ASSET_PHOTO_MAX_BYTES) return NextResponse.json({ saved: false, message: 'The photo is larger than 10 MB.' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffAssetImage(bytes);
  if (!kind) return NextResponse.json({ saved: false, message: 'The file is not a JPEG, PNG, GIF, WebP or HEIC image.' }, { status: 400 });
  const path = await saveAssetPhoto(councilId, bytes, kind.ext);
  console.info(`[assets] member ${session.claims.memberId} saved an asset photo for council ${councilId}: ${path}`);
  return NextResponse.json({ saved: true, path });
}
