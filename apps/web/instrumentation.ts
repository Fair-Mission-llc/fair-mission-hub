// Runs once when a Next.js server starts (Next.js instrumentation convention). Sprint 11 Revision 2.0: arms the nightly
// rebuild of every manual PDF (services/server/manual-regeneration.ts) on the Node.js server only. Set
// KOFC_NIGHTLY_MANUALS=off to skip it.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startNightlyManualRebuild } = await import('./services/server/manual-regeneration');
  startNightlyManualRebuild();
}
