#!/usr/bin/env node
// npm run build:exe (Sprint 11 Revision 10.0): packages the web portal as an offline desktop executable for trial
// deployments (apps/desktop/main.cjs, electron-builder.json). Each step must pass before the next runs:
//   1. the type-safety gate: npm run typecheck (web and phone);
//   2. the schema gate: the generated database assets must match Schema.sql and Seed.sql (gen-db-assets --check);
//   3. the portal build: next build with the hub data driver baked in (NEXT_PUBLIC_DATA_DRIVER=hub), so the app keeps
//      every record in its SQLite vault, and Next's standalone output (KOFC_DESKTOP_BUILD=1) so it runs without npm;
//   4. the standalone server gets its static assets and public folder (Next leaves them out of standalone);
//   5. electron-builder wraps the Electron shell and the server into dist-desktop/ (a portable .exe on Windows); its
//      afterPack hook (apps/desktop/after-pack.cjs) adds the server's node_modules, which extraResources leaves out.
// Pass --dir to stop at an unpacked folder instead of an installer (quicker for a smoke test).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(root, 'apps', 'web');
const require = createRequire(join(root, 'package.json'));
const nextBin = createRequire(join(web, 'package.json')).resolve('next/dist/bin/next');
const builderCli = require.resolve('electron-builder/cli.js');
// Under `npm run`, npm_execpath is npm's own CLI script, which this Node runs directly (no shell).
const npmCli = process.env.npm_execpath;

function step(label, command, args, env = {}) {
  console.log(`\n[build:exe] ${label}`);
  const shell = command === 'npm' && process.platform === 'win32';
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env }, shell });
  if (result.status !== 0) {
    console.error(`[build:exe] ${label} failed (exit ${result.status ?? result.signal}).`);
    process.exit(result.status ?? 1);
  }
}

step('1/5 type-safety gate', npmCli ? process.execPath : 'npm', [...(npmCli ? [npmCli] : []), 'run', 'typecheck']);
step('2/5 schema gate', process.execPath, [join(root, 'scripts', 'gen-db-assets.mjs'), '--check']);
step('3/5 portal build (standalone, hub driver)', process.execPath, [nextBin, 'build', web], {
  KOFC_DESKTOP_BUILD: '1',
  NEXT_PUBLIC_DATA_DRIVER: 'hub',
  NEXT_TELEMETRY_DISABLED: '1',
});

console.log('\n[build:exe] 4/5 copying static assets into the standalone server');
const standaloneWeb = join(web, '.next', 'standalone', 'apps', 'web');
if (!existsSync(join(standaloneWeb, 'server.js'))) {
  console.error(`[build:exe] ${standaloneWeb}/server.js is missing; the standalone build did not run.`);
  process.exit(1);
}
rmSync(join(standaloneWeb, '.next', 'static'), { recursive: true, force: true });
cpSync(join(web, '.next', 'static'), join(standaloneWeb, '.next', 'static'), { recursive: true });
cpSync(join(web, 'public'), join(standaloneWeb, 'public'), { recursive: true });

const target = process.argv.includes('--dir') ? ['--dir'] : [];
step('5/5 electron-builder', process.execPath, [builderCli, '--config', 'electron-builder.json', ...target]);
console.log('\n[build:exe] done: see dist-desktop/');
