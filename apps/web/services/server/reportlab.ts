// Running the repository's ReportLab scripts from app/api routes (Sprint 6N's Form 1295 report; Sprint 7H's custom user
// guides). The interpreter is FORM_1295_PYTHON, else the `py` launcher on Windows (Phase 7I: `python` there is often the
// Microsoft Store stub) and `python3` elsewhere. Scripts run without a shell, asynchronously, with a time limit; inputs
// go in files, never on the command line. Nothing is ever sent to a printer: the routes answer with the PDF's bytes.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { NextResponse } from 'next/server';
import { describeError } from '@kofc/shared';

/** The repository root: the nearest folder up from the server's working directory that holds Schema.sql. */
export function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'Schema.sql')) && existsSync(join(dir, 'scripts'))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return process.cwd();
}

export const pythonCommand = (): string => process.env.FORM_1295_PYTHON || (process.platform === 'win32' ? 'py' : 'python3');

/** Runs `script` with `args`; rejects with the script's stderr attached. */
export function runPythonScript(python: string, script: string, args: readonly string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(python, [script, ...args], { timeout: timeoutMs, windowsHide: true }, (err, _stdout, stderr) => {
      if (err) reject(Object.assign(err, { stderr: String(stderr ?? '') }));
      else resolve();
    });
  });
}

/** The answer for a failed run: 503 when Python or ReportLab is missing, else 500. `what` names the document. */
export function scriptFailureAnswer(logTag: string, what: string, err: unknown): NextResponse {
  const detail = (err as { stderr?: string }).stderr || describeError(err);
  console.error(`[${logTag}] ${what} script failed:`, detail);
  const missing = /No module named|ENOENT|not recognized|not found/i.test(detail);
  return NextResponse.json(
    {
      message: missing
        ? `The server cannot compile the ${what}: Python with ReportLab is not installed (pip install -r scripts/requirements.txt).`
        : `The ${what} could not be compiled. Try again, or ask an Admin to check the server log.`,
    },
    { status: missing ? 503 : 500 },
  );
}
