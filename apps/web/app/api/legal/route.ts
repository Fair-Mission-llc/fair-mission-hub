// GET /api/legal?notice=<terms|privacy> (Sprint 11 Revision 1.0): the Markdown text of the platform's Terms of Service or
// Privacy Policy, read from docs/legal/ (LEGAL_DOCUMENT_FILES, effective October 26, 2026). The notices are public, like
// the sign-in footer that names them, so no session is needed. 400 for another notice, 404 when the file is missing.
import { NextResponse } from 'next/server';
import { isLegalDocumentId, LEGAL_DOCUMENT_FILES, LEGAL_DOCUMENTS_EFFECTIVE_DATE } from '@kofc/shared';
import { readDocsFile } from '@/lib/docs-files';

export const runtime = 'nodejs';
// Sprint 11 Revision 15.5: read the file from disk on every request, in development and in the built pilot alike, so an
// edited Terms or Privacy Policy shows without a rebuild.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const notice = new URL(req.url).searchParams.get('notice');
  if (!isLegalDocumentId(notice)) return NextResponse.json({ message: 'Name the notice: terms or privacy.' }, { status: 400 });
  const file = LEGAL_DOCUMENT_FILES[notice]!;
  const markdown = await readDocsFile(file);
  if (markdown === null) return NextResponse.json({ message: `docs/${file} could not be read.` }, { status: 404 });
  return NextResponse.json({ notice, effective: LEGAL_DOCUMENTS_EFFECTIVE_DATE, markdown }, { headers: { 'Cache-Control': 'no-store' } });
}
