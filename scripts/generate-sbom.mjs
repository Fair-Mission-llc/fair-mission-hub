#!/usr/bin/env node
// npm run sbom (Sprint 9 Master Hardening Pass): writes sbom.json, a CycloneDX 1.5 software bill of materials, to the
// repository root. `npm run build:pilot` runs it first on every pilot build (scripts/build-pilot.mjs), so the hub laptop
// always carries an audit-ready list of every package the build was made from.
//
// The list is read from package-lock.json, the exact tree `npm ci` installs, rather than from `npm sbom`: npm's own
// command refuses this repository while the phone app has peer-version mismatches, and on the web workspaces alone it
// labels the portal's runtime packages (next, react) as dev-only extraneous ones. The lockfile gives every package of all
// three workspaces with its version, its registry tarball, its SHA-512 integrity hash and its declared license.
//
// Safety: the script reads two local files and writes one. It opens no network connection, runs no other program and
// executes no package code. It fails closed - exit 1 and no sbom.json change - when the lockfile is missing, is older
// than lockfile version 2, or names a different project than package.json. The file is written to a temporary name
// and renamed into place, so a half-written SBOM never replaces a good one.
//
//   node scripts/generate-sbom.mjs              write <root>/sbom.json
//   node scripts/generate-sbom.mjs --output X   write X instead
import { randomUUID } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The npm package name of a lockfile path: the part after its last 'node_modules/'. */
export function packageNameOf(path) {
  const at = path.lastIndexOf('node_modules/');
  return at < 0 ? null : path.slice(at + 'node_modules/'.length);
}

/** A package URL (purl) for an npm package: the scope's '@' is percent-encoded, as the purl spec requires. */
export function npmPurl(name, version) {
  return `pkg:npm/${name.startsWith('@') ? `%40${name.slice(1)}` : name}@${version}`;
}

/** The hex SHA-512 of an npm integrity string ('sha512-<base64>'), or null for another algorithm. */
export function sha512Hex(integrity) {
  const sri = String(integrity ?? '')
    .split(/\s+/)
    .find((s) => s.startsWith('sha512-'));
  return sri ? Buffer.from(sri.slice('sha512-'.length), 'base64').toString('hex') : null;
}

/** The lockfile path a dependency `name` of the package at `from` resolves to, the way Node walks up node_modules. */
function resolveDependency(packages, from, name) {
  let base = from;
  for (;;) {
    const candidate = base ? `${base}/node_modules/${name}` : `node_modules/${name}`;
    if (packages[candidate]) return candidate;
    if (!base) return null;
    // Climb one package up: 'a/node_modules/b' -> 'a'; a top-level package or a workspace climbs to the root.
    const up = base.lastIndexOf('/node_modules/');
    base = up < 0 ? '' : base.slice(0, up);
  }
}

/**
 * The CycloneDX 1.5 document for a lockfile. Pure: `timestamp` and `serialNumber` are passed in so a test can pin them.
 * Each package appears once per name@version; dev-only packages are scope 'excluded' (build tools, not shipped) with
 * the cdx:npm:package:development property, optional platform packages are 'optional', the rest 'required'.
 */
export function buildCycloneDxBom(lock, rootPackage, { timestamp, serialNumber }) {
  if (!lock || typeof lock !== 'object' || !lock.packages) throw new Error('package-lock.json has no "packages" map.');
  if (!(lock.lockfileVersion >= 2)) throw new Error(`package-lock.json is lockfile version ${lock.lockfileVersion}; version 2 or later is needed. Run npm install.`);
  if (lock.name !== rootPackage.name) throw new Error(`package-lock.json names "${lock.name}", but package.json names "${rootPackage.name}". Run npm install.`);

  const packages = lock.packages;
  const refOf = new Map(); // lockfile path -> bom-ref
  const components = new Map(); // bom-ref -> component
  const rootRef = `${rootPackage.name}@${rootPackage.version}`;
  refOf.set('', rootRef);

  for (const [path, entry] of Object.entries(packages)) {
    if (path === '') continue;
    const target = entry.link ? packages[entry.resolved] : entry;
    const isWorkspace = entry.link || !path.includes('node_modules/');
    const name = isWorkspace ? (target?.name ?? packages[path]?.name ?? path) : (entry.name ?? packageNameOf(path));
    const version = target?.version ?? entry.version;
    if (!name || !version) continue;
    const ref = `${name}@${version}`;
    refOf.set(path, ref);
    if (components.has(ref)) continue;
    const component = {
      'bom-ref': ref,
      type: isWorkspace ? 'application' : 'library',
      name,
      version,
      scope: entry.dev ? 'excluded' : entry.optional || entry.devOptional ? 'optional' : 'required',
      purl: npmPurl(name, version),
    };
    const license = target?.license ?? entry.license;
    if (typeof license === 'string' && license.trim()) {
      component.licenses = /\s(OR|AND|WITH)\s|[()]/.test(license) ? [{ expression: license.trim() }] : [{ license: { id: license.trim() } }];
    }
    const hex = sha512Hex(entry.integrity);
    if (hex) component.hashes = [{ alg: 'SHA-512', content: hex }];
    if (typeof entry.resolved === 'string' && /^https:\/\//.test(entry.resolved)) {
      component.externalReferences = [{ type: 'distribution', url: entry.resolved }];
    }
    const properties = [];
    if (entry.dev) properties.push({ name: 'cdx:npm:package:development', value: 'true' });
    if (isWorkspace) properties.push({ name: 'cdx:npm:package:workspace', value: 'true' });
    if (properties.length) component.properties = properties;
    components.set(ref, component);
  }

  // The dependency graph: each component's direct dependencies, resolved through node_modules like Node does.
  const graph = new Map([[rootRef, new Set()]]);
  for (const [path, entry] of Object.entries(packages)) {
    if (entry.link) continue;
    const from = refOf.get(path);
    if (!from) continue;
    const deps = { ...entry.dependencies, ...entry.optionalDependencies, ...(path === '' || !path.includes('node_modules/') ? entry.devDependencies : {}) };
    const edges = graph.get(from) ?? new Set();
    for (const name of Object.keys(deps)) {
      const at = resolveDependency(packages, path, name);
      const ref = at ? refOf.get(at) : null;
      if (ref && ref !== from) edges.add(ref);
    }
    graph.set(from, edges);
  }
  // The root depends on its workspaces too.
  for (const ws of lock.packages[''].workspaces ?? rootPackage.workspaces ?? []) {
    const ref = refOf.get(ws);
    if (ref) graph.get(rootRef).add(ref);
  }

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber,
    version: 1,
    metadata: {
      timestamp,
      lifecycles: [{ phase: 'build' }],
      tools: { components: [{ type: 'application', name: 'kofc-generate-sbom', version: '1.0.0', description: 'scripts/generate-sbom.mjs (reads package-lock.json)' }] },
      component: {
        'bom-ref': rootRef,
        type: 'application',
        name: rootPackage.name,
        version: rootPackage.version,
        purl: npmPurl(rootPackage.name, rootPackage.version),
      },
    },
    components: [...components.values()].sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref'])),
    dependencies: [...graph.entries()]
      .map(([ref, deps]) => ({ ref, dependsOn: [...deps].sort() }))
      .sort((a, b) => a.ref.localeCompare(b.ref)),
  };
}

/** Reads the lockfile and package.json under `dir` and writes the SBOM to `output`. Returns a one-line summary. */
export function writeSbom(dir = root, output = join(dir, 'sbom.json')) {
  const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));
  let lock;
  try {
    lock = read('package-lock.json');
  } catch (err) {
    throw new Error(`package-lock.json could not be read (${err.message}). Run npm install first.`);
  }
  const bom = buildCycloneDxBom(lock, read('package.json'), { timestamp: new Date().toISOString(), serialNumber: `urn:uuid:${randomUUID()}` });
  const temp = `${output}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(bom, null, 2)}\n`, 'utf8');
  renameSync(temp, output);
  const shipped = bom.components.filter((c) => c.scope !== 'excluded').length;
  return `[sbom] Wrote ${output}: CycloneDX ${bom.specVersion}, ${bom.components.length} components (${shipped} shipped, ${bom.components.length - shipped} build-only).`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const flag = process.argv.indexOf('--output');
  try {
    console.log(writeSbom(root, flag >= 0 ? resolve(process.argv[flag + 1]) : undefined));
  } catch (err) {
    console.error(`[sbom] ${err.message}`);
    process.exit(1);
  }
}
