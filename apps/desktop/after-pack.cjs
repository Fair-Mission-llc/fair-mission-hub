// Sprint 11 Revision 10.0: electron-builder's afterPack hook (electron-builder.json). extraResources never copies a
// folder named node_modules, but the portal's standalone server needs its own (next, react and the rest Next traced).
// This copies apps/web/.next/standalone/node_modules into the packed app's resources/portal before the installer or
// portable .exe is made from it.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  const source = path.join(__dirname, '..', 'web', '.next', 'standalone', 'node_modules');
  if (!fs.existsSync(source)) throw new Error(`afterPack: ${source} is missing; run the standalone portal build first.`);
  const resources =
    context.electronPlatformName === 'darwin'
      ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
      : path.join(context.appOutDir, 'resources');
  const target = path.join(resources, 'portal', 'node_modules');
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true, dereference: true });
  console.log(`  • afterPack copied the portal's node_modules to ${path.relative(process.cwd(), target)}`);
};
