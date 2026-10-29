#!/usr/bin/env node
// npm run dev:pilot (Sprint 9 Revision 1.2; launcher since Sprint 9 Revision 2.1): serves the built web portal on every
// network address of this computer, port 3000, for a Wi-Fi pilot - the same as `next start apps/web -H 0.0.0.0 -p 3000`.
//
// Pilot devices reach the portal at http://<this computer's IP>:3000, plain http, where a browser drops a Secure
// cookie. So this launcher sets PORTAL_ALLOW_HTTP_COOKIES=1 (apps/web/services/server/session-token.ts secureCookies):
// the session cookie then travels over http. It stays HttpOnly and SameSite=Strict. Never use this launcher on a
// server that is reachable from the internet.
//
// Sprint 9 Revision 4.0: build with `npm run build:pilot` first. That build makes this laptop the pilot hub: every
// device works on packages/backend/data/central-hub-vault.db, which keeps every record across sessions. With a plain
// `npm run build:web` build each browser keeps its own copy instead: once the server answers, this launcher asks it
// (GET /api/sync/replicate) and says which kind of build it is serving.
//
// Sprint 11 Revision 13.0: the launcher sets PILOT_SYNC_COUNCIL (council 15295, or --council <number>; --no-sync leaves it
// unset) and, once the server answers, calls GET /api/sync/replicate?handshake=1. A hub with no vault yet then creates it
// and pulls that council's roster, logged hours and module switches from the simulated central database
// (packages/backend/data/simulated-central.db, made from the seed the first time). An existing vault is never synced
// over: run npm run hub:archive first for a fresh pull. The launcher prints the handshake receipt.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(root, 'apps', 'web');
const nextBin = createRequire(join(web, 'package.json')).resolve('next/dist/bin/next');

/** --council <number> and --no-sync are the launcher's own; everything else goes to next start. */
const args = process.argv.slice(2);
let council = '15295';
const councilAt = args.indexOf('--council');
if (councilAt >= 0) {
  council = args[councilAt + 1] ?? '';
  args.splice(councilAt, 2);
  if (!/^[1-9]\d*$/.test(council)) {
    console.error('[pilot] --council needs a council number, e.g. --council 15295.');
    process.exit(2);
  }
}
const noSync = args.includes('--no-sync');
if (noSync) args.splice(args.indexOf('--no-sync'), 1);

console.warn('[pilot] PORTAL_ALLOW_HTTP_COOKIES=1: session cookies work over plain http on this Wi-Fi. Use for local pilots only.');

const child = spawn(process.execPath, [nextBin, 'start', web, '-H', '0.0.0.0', '-p', '3000', ...args], {
  stdio: 'inherit',
  env: { ...process.env, PORTAL_ALLOW_HTTP_COOKIES: '1', ...(noSync ? {} : { PILOT_SYNC_COUNCIL: council }) },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));

/** Once the server answers, say whether it is the pilot hub. */
async function reportMode() {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const status = await fetch('http://127.0.0.1:3000/api/sync/replicate?handshake=1')
      .then((r) => r.json())
      .catch(() => null);
    if (!status) continue;
    if (status.hub) {
      const lan = Object.values(networkInterfaces())
        .flat()
        .find((a) => a && a.family === 'IPv4' && !a.internal)?.address;
      console.warn(`[pilot] Hub mode: every device works on ${status.vault}. Portal: http://${lan ?? '<this laptop IP>'}:3000`);
      const r = status.sync;
      if (r) {
        const hours = r.eventHours.added + r.eventHours.updated + r.activityHours.added + r.activityHours.updated;
        console.warn(
          `[pilot] Live data: council ${r.councilNumber} (${r.councilName}) synced from the simulated central database at ${r.syncedAt}: ` +
            `${r.members.added} members added, ${r.members.updated} refreshed, ${hours} hour entries, ${r.councilSettings.length} switches; ` +
            `${r.personasKept} pilot personas kept.`,
        );
      } else if (noSync) {
        console.warn('[pilot] --no-sync: the vault holds its seed and what devices saved.');
      } else {
        console.warn('[pilot] No sync receipt: this vault existed before the launch (it is never synced over) or the handshake failed (see the server log). Run npm run hub:archive for a fresh pull.');
      }
    } else {
      console.warn('[pilot] WARNING: not a hub build - each browser keeps its own copy and nothing is kept. Run npm run build:pilot first.');
    }
    return;
  }
}
void reportMode();
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
