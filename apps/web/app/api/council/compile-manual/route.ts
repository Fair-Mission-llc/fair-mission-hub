// POST /api/council/compile-manual - one council's custom copy of a user guide (Sprint 7H), as a print-ready PDF.
// Takes JSON { guide: one of CUSTOM_MANUAL_KINDS (Sprint 9 Revision 7.1: the three role manuals too), council: { id, number, name }, settings } (the Council Wide Settings the page
// read through the data service; cleanCustomManualPayload range-checks every value). The route reads the guide's
// Markdown from docs/, writes the council's copy (customizeManualMarkdown: the council's numbers in place of the
// defaults, and a settings table up front) to a temporary folder, lays it out with the guides' own ReportLab script
// (scripts/compile_all_manuals.py, images still read from docs/) and answers with the PDF (application/pdf) for the
// browser to download. Phase 7I: a copy is also kept as generated/custom_manuals/<file name> (not tracked by git); nothing
// is saved under docs/, and nothing is sent to a printer.
//
// The audience of the Council Wide Settings page may print (mayCompileCustomManual): the council's Active Admins and
// officers, and Super Admins. 401 without a portal session, 403 otherwise; 400 for a body the cleaner refuses; 503
// when Python or ReportLab is missing on the server (pip install -r scripts/requirements.txt). The interpreter is
// FORM_1295_PYTHON, as for the Form 1295 report. The script runs without a shell, asynchronously, and the copy is handed
// over in a file, never on the command line.
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { cleanCustomManualPayload, customizeManualMarkdown, customManualFileName, CUSTOM_MANUAL_SOURCES, describeError, mayCompileCustomManual, toIsoDate } from '@kofc/shared';
import { pythonCommand, repoRoot, runPythonScript, scriptFailureAnswer } from '@/services/server/reportlab';
import { requirePortalSession } from '@/services/server/session';

export const runtime = 'nodejs';

/** The Administrator guide's screen captures make it the slow one (about 7 seconds); the Form 1295 report gets 60. */
const COMPILE_TIMEOUT_MS = 120_000;

export async function POST(req: Request) {
  const session = await requirePortalSession(req, () => true);
  if ('denied' in session) return session.denied;

  let payload;
  try {
    payload = cleanCustomManualPayload(await req.json());
  } catch (err) {
    return NextResponse.json({ message: describeError(err) }, { status: 400 });
  }
  if (!mayCompileCustomManual(session.actor, payload.council.id)) {
    return NextResponse.json({ message: "Only the council's Admins and officers, and Super Admins, can print its custom guides." }, { status: 403 });
  }

  const root = repoRoot();
  const manual = CUSTOM_MANUAL_SOURCES[payload.guide];
  const work = await mkdtemp(join(tmpdir(), 'custom-manual-'));
  try {
    const markdown = await readFile(join(root, manual.source), 'utf8');
    const input = join(work, 'guide.md');
    const output = join(work, 'guide.pdf');
    await writeFile(input, customizeManualMarkdown(payload.guide, markdown, payload.council, payload.settings, toIsoDate(new Date())), 'utf8');
    const preparedFor = `${payload.council.name} ${payload.council.number}`;
    try {
      await runPythonScript(
        pythonCommand(),
        join(root, 'scripts', 'compile_all_manuals.py'),
        ['--only', payload.guide, '--input', input, '--output', output, '--base', join(root, 'docs'), '--prepared-for', preparedFor],
        COMPILE_TIMEOUT_MS,
      );
    } catch (err) {
      return scriptFailureAnswer('custom-manual', 'guide', err);
    }
    const pdf = await readFile(output);
    const fileName = customManualFileName(payload.guide, payload.council.number);
    const keep = join(root, 'generated', 'custom_manuals');
    await mkdir(keep, { recursive: true })
      .then(() => copyFile(output, join(keep, fileName)))
      .catch((err) => console.error(`[custom-manual] could not save generated/custom_manuals/${fileName}:`, describeError(err)));
    console.log(`[custom-manual] member ${session.claims.memberId} compiled the ${payload.guide} guide for council ${payload.council.id}`);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}
