// /api/council/payment-qr - payment QR code images for a council's donation methods (Sprint 10 Revision 5.0,
// file-repository.ts). The Standard Bank Accounts drawer's '📁 Upload QR Code Image' posts here; the browser then saves
// the returned link in CouncilDonationMethod.DonationMethodURL with lookups.saveCouncilSpecific.
//
//   POST multipart { councilId, file }   files the image and answers { url }. A council with its own repository
//                                         (OneDrive / SharePoint, Dropbox Business, Local Network Server) keeps it there
//                                         ('Payment QR Codes', a /api/file-repository link); a Google Drive council keeps
//                                         it on the portal server beside the hub data, served by GET below.
//   GET ?file=c<council>/<name>          serves a portal-server image to a signed-in member of that council (or a
//                                         Super Admin), so the phone can show it to a donor.
// Only the members who keep the council's donation methods upload (assertMayManageCouncilLookups): 401 without a session,
// 403 otherwise; 400 for a missing council or file, 413 over PAYMENT_QR_MAX_BYTES, 415 for anything but PNG, JPEG or WebP.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import {
  assertMayManageCouncilLookups,
  describeError,
  parsePaymentQrServerUrl,
  PAYMENT_QR_MAX_BYTES,
  PAYMENT_QR_ROUTE,
  PAYMENT_QR_TYPES,
  paymentQrServerUrl,
} from '@kofc/shared';
import { fileIntoRepository } from '@/services/server/file-repository';
import { hubDataDir } from '@/services/server/hub/hub-vault';
import { readPortalSession, requirePortalSession } from '@/services/server/session';

export const runtime = 'nodejs';

const qrDir = (councilId: number) => join(/*turbopackIgnore: true*/ hubDataDir(), 'payment-qr', `c${councilId}`);
const message = (text: string, status: number) => NextResponse.json({ message: text }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const councilId = Number(form?.get('councilId'));
  const file = form?.get('file');
  if (!Number.isInteger(councilId) || councilId <= 0 || !(file instanceof File)) return message('Send one image file and the council id.', 400);
  const session = await requirePortalSession(req, (actor) => {
    try {
      assertMayManageCouncilLookups(actor, councilId, 'CouncilDonationMethod', 'upload a payment QR code');
      return true;
    } catch {
      return false;
    }
  });
  if ('denied' in session) return session.denied;
  const ext = PAYMENT_QR_TYPES[(file.type || '').toLowerCase()];
  if (!ext) return message('Upload the QR code as a PNG, JPEG or WebP image.', 415);
  if (file.size === 0) return message('The image is empty.', 400);
  if (file.size > PAYMENT_QR_MAX_BYTES) return message(`The image is larger than ${PAYMENT_QR_MAX_BYTES / (1024 * 1024)} MB.`, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const ref = await fileIntoRepository(councilId, { folder: 'Payment_QR_Codes', prefix: 'qr', originalName: `code.${ext}`, bytes });
    if (ref) return NextResponse.json({ url: ref }, { status: 201 });
    const name = `qr-${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;
    await mkdir(qrDir(councilId), { recursive: true });
    await writeFile(join(/*turbopackIgnore: true*/ qrDir(councilId), name), bytes);
    console.info(`[payment-qr] member ${session.claims.memberId} uploaded a QR code for council ${councilId}: ${name}`);
    return NextResponse.json({ url: paymentQrServerUrl(councilId, name) }, { status: 201 });
  } catch (err) {
    console.error('[payment-qr] upload failed:', describeError(err));
    return message('The QR code could not be saved. Check the File Repository Mode settings and try again.', 502);
  }
}

export async function GET(req: Request) {
  const claims = await readPortalSession(req);
  if (!claims) return message('Sign in again: there is no portal session on the server.', 401);
  const parts = parsePaymentQrServerUrl(`${PAYMENT_QR_ROUTE}?file=${new URL(req.url).searchParams.get('file') ?? ''}`);
  if (!parts) return message('No such QR code.', 404);
  if (parts.councilId !== claims.councilId && claims.memberType !== 'Super Admin') return message("That QR code belongs to another council.", 403);
  const path = join(/*turbopackIgnore: true*/ qrDir(parts.councilId), parts.fileName);
  if (!existsSync(path)) return message('No such QR code.', 404);
  const type = parts.fileName.endsWith('.png') ? 'image/png' : parts.fileName.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return new Response(new Uint8Array(await readFile(path)), { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
}
