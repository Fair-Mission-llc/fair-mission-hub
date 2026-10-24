// GET /api/manuals?manual=<treasurer|financial-secretary|executive> (Sprint 9 Master Hardening Pass): one role manual's
// task workflows for the 'How do I…' search on its officer desk header (components/DeskManualHeader.tsx). The server
// reads the manual's Markdown from docs/ and answers { key, title, tasks } - the parsed Goal, Start point, Steps,
// Expected result and Common problems of each task, never the raw file. Every signed-in member may read a manual; the
// desk itself decides who sees the header. 401 without a portal session, 400 for an unknown manual, 404 when the
// Markdown file is missing.
import { NextResponse } from 'next/server';
import { isRoleManualKey, ROLE_MANUALS, roleManualTasks } from '@kofc/shared';
import { readDocsFile } from '@/lib/docs-files';
import { requirePortalSession } from '@/services/server/session';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await requirePortalSession(req, () => true);
  if ('denied' in session) return session.denied;
  const key = new URL(req.url).searchParams.get('manual');
  if (!isRoleManualKey(key)) return NextResponse.json({ message: 'Name the manual: treasurer, financial-secretary or executive.' }, { status: 400 });
  const manual = ROLE_MANUALS[key];
  const markdown = await readDocsFile(manual.markdown);
  if (markdown === null) return NextResponse.json({ message: `docs/${manual.markdown} could not be read.` }, { status: 404 });
  return NextResponse.json({ key, title: manual.title, tasks: roleManualTasks(markdown) }, { headers: { 'Cache-Control': 'no-store' } });
}
