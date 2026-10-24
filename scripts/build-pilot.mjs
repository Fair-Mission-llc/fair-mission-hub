#!/usr/bin/env node
// npm run build:pilot (Sprint 9 Revision 4.0): builds the web portal as the room pilot's hub. NEXT_PUBLIC_DATA_DRIVER=hub
// is baked into the build, so every browser that opens the portal works on the hub laptop's persistent vault
// (packages/backend/data/central-hub-vault.db) through /api/sync/replicate, and the server's own routes use it too.
// Then `npm run dev:pilot` serves the build. A plain `npm run build:web` stays the single-browser demo (memory driver).
// Sprint 9 Master Hardening Pass: before compiling, it writes sbom.json, the CycloneDX software bill of materials of
// the exact package tree (scripts/generate-sbom.mjs). A failed SBOM stops the build, so no pilot build goes out without one.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeSbom } from './generate-sbom.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(root, 'apps', 'web');
const nextBin = createRequire(join(web, 'package.json')).resolve('next/dist/bin/next');

try {
  console.log(writeSbom(root));
} catch (err) {
  console.error(`[sbom] ${err.message}`);
  process.exit(1);
}

const child = spawn(process.execPath, [nextBin, 'build', web], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_DATA_DRIVER: 'hub' },
});
child.on('exit', (code) => process.exit(code ?? 1));
