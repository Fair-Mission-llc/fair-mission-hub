// GET /api/manuals?manual=<treasurer|financial-secretary|executive|admin> (Sprint 9 Master Hardening Pass): one role manual's
// task workflows for the 'How do I…' search on its officer desk header (components/DeskManualHeader.tsx). The server
// reads the manual's Markdown from docs/ and answers { key, title, tasks } - the parsed Goal, Start point, Steps,
// Expected result and Common problems of each task, never the raw file. Every signed-in member may read a manual; the
// desk itself decides who sees the header. 401 without a portal session, 400 for an unknown manual, 404 when the
// Markdown file is missing.
// Sprint 11 Revision 2.0: 'admin' serves the Administration Manual for the Admin Desk.
import { NextResponse } from 'next/server';
import { ADMIN_MANUAL_KEY, deskManual, isDeskManualKey, roleManualTasks } from '@kofc/shared';
import { readDocsFile } from '@/lib/docs-files';
import { requirePortalSession } from '@/services/server/session';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await requirePortalSession(req, () => true);
  if ('denied' in session) return session.denied;
  const key = new URL(req.url).searchParams.get('manual');
  if (!isDeskManualKey(key)) return NextResponse.json({ message: 'Name the manual: treasurer, financial-secretary, executive or admin.' }, { status: 400 });
  // The Administration Manual covers the server, its ports and firewall: Admins and Super Admins only.
  if (key === ADMIN_MANUAL_KEY && session.actor.memberType !== 'Admin' && session.actor.memberType !== 'Super Admin') return NextResponse.json({ message: 'The Administration Manual is for Admins and Super Admins.' }, { status: 403 });
  const manual = deskManual(key);
  const markdown = await readDocsFile(manual.markdown);
  if (markdown === null) return NextResponse.json({ message: `docs/${manual.markdown} could not be read.` }, { status: 404 });
  return NextResponse.json({ key, title: manual.title, tasks: roleManualTasks(markdown) }, { headers: { 'Cache-Control': 'no-store' } });
}
