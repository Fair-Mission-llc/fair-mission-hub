// Sprint 11 Revision 10.0: electron-builder's afterPack hook (electron-builder.json). extraResources never copies a
// folder named node_modules, but the portal's standalone server needs its own (next, react and the rest Next traced).
// This copies apps/web/.next/standalone/node_modules into the packed app's resources/portal before the installer or
// portable .exe is made from it.
// Sprint 11 Revision 15.0: the copy skips files the running server never reads (source maps, type declarations, build
// caches and any test framework folder), the same pruning electron-builder.json applies to extraResources.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const PRUNED_DIRS = new Set(['.cache', '__tests__', 'vitest', '@vitest']);
const PRUNED_FILE = /(\.map|\.d\.ts|\.tsbuildinfo)$/;

/** False for a path the packed server does not need. */
function keep(file) {
  const name = path.basename(file);
  if (PRUNED_DIRS.has(name)) return false;
  return !PRUNED_FILE.test(name);
}

exports.default = async function afterPack(context) {
  const source = path.join(__dirname, '..', 'web', '.next', 'standalone', 'node_modules');
  if (!fs.existsSync(source)) throw new Error(`afterPack: ${source} is missing; run the standalone portal build first.`);
  const resources =
    context.electronPlatformName === 'darwin'
      ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
      : path.join(context.appOutDir, 'resources');
  const target = path.join(resources, 'portal', 'node_modules');
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true, dereference: true, filter: keep });
  console.log(`  • afterPack copied the portal's node_modules to ${path.relative(process.cwd(), target)}`);
};
