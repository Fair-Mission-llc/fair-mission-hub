// /api/sync/photo - check photos on the pilot hub (Sprint 9 Revision 4.0). A phone in hub mode uploads the deposit
// photo it just took (POST, the JPEG or PNG bytes as the body) and stores the answer's `path`
// ('/api/sync/photo?name=<file>') in TransactionAttachments.file_path, so the photo lives beside the vault
// (packages/backend/data/photos/) and outlasts the phone and the session. GET ?name= serves it back.
// Both need a portal session (a check photo shows bank details): 401 without one, 403 in a view-as session for POST.
// 413 over HUB_PHOTO_MAX_BYTES, 415 for anything but JPEG or PNG, 404 for an unknown name or while hub mode is off.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { HUB_PHOTO_ROUTE } from '@kofc/shared';
import { hubDataDir, hubModeOn } from '@/services/server/hub/hub-vault';
import { readPortalSession } from '@/services/server/session';

export const runtime = 'nodejs';

/** The largest photo the hub takes: a compressed phone photo is well under 2 MB. */
const HUB_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const NAME = /^[a-z0-9-]+\.(jpg|png)$/;
const photosDir = () => join(/*turbopackIgnore: true*/ hubDataDir(), 'photos');
const message = (text: string, status: number) => NextResponse.json({ message: text }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  if (!hubModeOn()) return message('This portal is not running as the pilot hub.', 404);
  const claims = await readPortalSession(req);
  if (!claims) return message('Sign in again: the hub has no session for this device.', 401);
  if (claims.impersonatorId !== undefined) return message('You are viewing the portal as another member, so nothing can be saved.', 403);
  const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const extension = TYPES[type];
  if (!extension) return message('Send the photo as image/jpeg or image/png.', 415);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length === 0) return message('The photo is empty.', 400);
  if (bytes.length > HUB_PHOTO_MAX_BYTES) return message(`The photo is larger than ${HUB_PHOTO_MAX_BYTES / (1024 * 1024)} MB.`, 413);
  const name = `deposit-${claims.memberId}-${Date.now()}-${randomBytes(8).toString('hex')}.${extension}`;
  mkdirSync(photosDir(), { recursive: true });
  writeFileSync(join(/*turbopackIgnore: true*/ photosDir(), name), bytes);
  return NextResponse.json({ path: `${HUB_PHOTO_ROUTE}?name=${name}` }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) {
  if (!hubModeOn()) return message('This portal is not running as the pilot hub.', 404);
  if (!(await readPortalSession(req))) return message('Sign in again: the hub has no session for this device.', 401);
  const name = new URL(req.url).searchParams.get('name') ?? '';
  const file = join(/*turbopackIgnore: true*/ photosDir(), name);
  if (!NAME.test(name) || !existsSync(file)) return message('No such photo on the hub.', 404);
  return new Response(readFileSync(file), {
    headers: { 'Content-Type': name.endsWith('.png') ? 'image/png' : 'image/jpeg', 'Cache-Control': 'private, max-age=3600' },
  });
}
