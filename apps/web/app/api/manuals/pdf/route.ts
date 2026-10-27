// GET /api/manuals/pdf?manual=<treasurer|financial-secretary|executive|admin> (Sprint 9 Master Hardening Pass): the compiled
// print edition of one role manual (docs/<NAME>.pdf, written by py scripts/compile_all_manuals.py), streamed to the
// browser to open in a new tab. The officer desk header links here and copies this link. 401 without a portal session,
// 400 for an unknown manual, 404 when the PDF has not been compiled yet.
// Sprint 11 Revision 2.0: 'admin' serves the Administration Manual for the Admin Desk.
// Sprint 11 Revision 4.1: 'quickstart' serves the Quick-Start Intake Guide (the Setup Wizard's last step), Admins only.
import { NextResponse } from 'next/server';
import { ADMIN_MANUAL_KEY, deskManual, isDeskManualKey, QUICK_START_GUIDE } from '@kofc/shared';
import { readDocsBytes } from '@/lib/docs-files';
import { requirePortalSession } from '@/services/server/session';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await requirePortalSession(req, () => true);
  if ('denied' in session) return session.denied;
  const key = new URL(req.url).searchParams.get('manual');
  const isAdmin = session.actor.memberType === 'Admin' || session.actor.memberType === 'Super Admin';
  if (key === QUICK_START_GUIDE.key) {
    if (!isAdmin) return NextResponse.json({ message: 'The Quick-Start Intake Guide is for Admins and Super Admins.' }, { status: 403 });
    return pdfResponse(QUICK_START_GUIDE.pdf);
  }
  if (!isDeskManualKey(key)) return NextResponse.json({ message: 'Name the manual: treasurer, financial-secretary, executive or admin.' }, { status: 400 });
  // The Administration Manual covers the server, its ports and firewall: Admins and Super Admins only.
  if (key === ADMIN_MANUAL_KEY && !isAdmin) return NextResponse.json({ message: 'The Administration Manual is for Admins and Super Admins.' }, { status: 403 });
  return pdfResponse(deskManual(key).pdf);
}

async function pdfResponse(file: string): Promise<Response> {
  const pdf = await readDocsBytes(file);
  if (pdf === null) {
    return NextResponse.json({ message: `docs/${file} is not compiled yet. Run py scripts/compile_all_manuals.py.` }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${file}"`,
      'Cache-Control': 'no-store',
    },
  });
}
