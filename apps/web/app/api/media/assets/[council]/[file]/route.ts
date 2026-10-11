// GET /api/media/assets/<council>/<file> - an asset photo saved by /api/assets/photo (Sprint 7F Extension), for any
// signed-in member with a portal session. The file name must be a stored UUID name (no paths), and the bytes must still
// be an accepted image, so nothing else on the disk can be read through this route.
import { NextResponse } from 'next/server';
import { readAssetPhoto } from '@/services/server/asset-media';
import { readPortalSession } from '@/services/server/session';

export async function GET(req: Request, { params }: { params: Promise<{ council: string; file: string }> }) {
  if (!(await readPortalSession(req))) return NextResponse.json({ message: 'Sign in to see asset photos.' }, { status: 401 });
  const { council, file } = await params;
  const photo = await readAssetPhoto(council, file);
  if (!photo) return NextResponse.json({ message: 'No such photo.' }, { status: 404 });
  return new NextResponse(Buffer.from(photo.bytes), {
    headers: { 'Content-Type': photo.type, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
  });
}
