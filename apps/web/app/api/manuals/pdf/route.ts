// GET /api/manuals/pdf?manual=<treasurer|financial-secretary|executive> (Sprint 9 Master Hardening Pass): the compiled
// print edition of one role manual (docs/<NAME>.pdf, written by py scripts/compile_all_manuals.py), streamed to the
// browser to open in a new tab. The officer desk header links here and copies this link. 401 without a portal session,
// 400 for an unknown manual, 404 when the PDF has not been compiled yet.
import { NextResponse } from 'next/server';
import { isRoleManualKey, ROLE_MANUALS } from '@kofc/shared';
import { readDocsBytes } from '@/lib/docs-files';
import { requirePortalSession } from '@/services/server/session';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await requirePortalSession(req, () => true);
  if ('denied' in session) return session.denied;
  const key = new URL(req.url).searchParams.get('manual');
  if (!isRoleManualKey(key)) return NextResponse.json({ message: 'Name the manual: treasurer, financial-secretary or executive.' }, { status: 400 });
  const manual = ROLE_MANUALS[key];
  const pdf = await readDocsBytes(manual.pdf);
  if (pdf === null) {
    return NextResponse.json({ message: `docs/${manual.pdf} is not compiled yet. Run py scripts/compile_all_manuals.py.` }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${manual.pdf}"`,
      'Cache-Control': 'no-store',
    },
  });
}
