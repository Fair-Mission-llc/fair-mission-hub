// Rebuilding every manual's PDF on the server (Sprint 11 Revision 2.0): the Admin Desk's 'Regenerate Manuals On-Demand'
// button (POST /api/admin/regenerate-manuals) and the nightly job (apps/web/instrumentation.ts) both call
// regenerateAllManuals, which runs `py scripts/compile_all_manuals.py` - every role book, the member and the
// infrastructure guides, then the pilot kit - without a shell and with a time limit. One run at a time: a second call
// while one is running joins it. The last run's outcome is kept in memory for the desk to show (manualRegenerationStatus).
import { join } from 'node:path';
import { describeError, NIGHTLY_MANUAL_REBUILD_ENV, nextNightlyManualRebuild, type ManualRegenerationStatus, type ManualRegenerationTrigger } from '@kofc/shared';
import { pythonCommand, repoRoot, runPythonScript } from '@/services/server/reportlab';

/** The full run lays out five guides with screen captures plus the pilot kit. */
const REGENERATION_TIMEOUT_MS = 10 * 60_000;

interface RegenerationState {
  current: Promise<ManualRegenerationStatus> | null;
  status: Omit<ManualRegenerationStatus, 'nextNightlyRun'>;
  nightlyTimer: ReturnType<typeof setTimeout> | null;
  nextNightly: Date | null;
}

// Kept on globalThis so a development reload of this module does not start a second nightly timer.
const store = globalThis as typeof globalThis & { __kofcManualRegeneration?: RegenerationState };
const state: RegenerationState = (store.__kofcManualRegeneration ??= {
  current: null,
  status: { running: false, trigger: null, startedAt: null, finishedAt: null, ok: null, message: null },
  nightlyTimer: null,
  nextNightly: null,
});

export function manualRegenerationStatus(): ManualRegenerationStatus {
  return { ...state.status, nextNightlyRun: state.nextNightly ? state.nextNightly.toISOString() : null };
}

/** Starts a rebuild of every manual, or joins the one already running; resolves with the finished status. */
export function regenerateAllManuals(trigger: ManualRegenerationTrigger): Promise<ManualRegenerationStatus> {
  if (state.current) return state.current;
  state.status = { running: true, trigger, startedAt: new Date().toISOString(), finishedAt: null, ok: null, message: null };
  const root = repoRoot();
  state.current = runPythonScript(pythonCommand(), join(root, 'scripts', 'compile_all_manuals.py'), [], REGENERATION_TIMEOUT_MS)
    .then(() => ({ ok: true, message: 'Every manual was rebuilt.' }))
    .catch((err: unknown) => {
      const detail = (err as { stderr?: string }).stderr || describeError(err);
      console.error(`[manuals] ${trigger} rebuild failed:`, detail);
      const missing = /No module named|ENOENT|not recognized|not found/i.test(detail);
      return {
        ok: false,
        message: missing
          ? 'Python with ReportLab is not installed on the server (pip install -r scripts/requirements.txt).'
          : 'The manuals could not be rebuilt. The server log has the details.',
      };
    })
    .then(({ ok, message }) => {
      state.status = { ...state.status, running: false, finishedAt: new Date().toISOString(), ok, message };
      state.current = null;
      if (ok) console.log(`[manuals] ${trigger} rebuild finished`);
      return manualRegenerationStatus();
    });
  return state.current;
}

/** Schedules the nightly rebuild (once per server process); KOFC_NIGHTLY_MANUALS=off turns it off. */
export function startNightlyManualRebuild(now: () => Date = () => new Date()): void {
  if (state.nightlyTimer || process.env[NIGHTLY_MANUAL_REBUILD_ENV] === 'off') return;
  const arm = () => {
    const next = nextNightlyManualRebuild(now());
    state.nextNightly = next;
    state.nightlyTimer = setTimeout(() => {
      void regenerateAllManuals('nightly').finally(arm);
    }, Math.max(1_000, next.getTime() - now().getTime()));
    // The timer must never keep the server process alive on its own.
    state.nightlyTimer.unref?.();
  };
  arm();
}
