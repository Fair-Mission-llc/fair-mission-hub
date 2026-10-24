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
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(root, 'apps', 'web');
const nextBin = createRequire(join(web, 'package.json')).resolve('next/dist/bin/next');

console.warn('[pilot] PORTAL_ALLOW_HTTP_COOKIES=1: session cookies work over plain http on this Wi-Fi. Use for local pilots only.');

const child = spawn(process.execPath, [nextBin, 'start', web, '-H', '0.0.0.0', '-p', '3000', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, PORTAL_ALLOW_HTTP_COOKIES: '1' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));

/** Once the server answers, say whether it is the pilot hub. */
async function reportMode() {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const status = await fetch('http://127.0.0.1:3000/api/sync/replicate')
      .then((r) => r.json())
      .catch(() => null);
    if (!status) continue;
    if (status.hub) {
      const lan = Object.values(networkInterfaces())
        .flat()
        .find((a) => a && a.family === 'IPv4' && !a.internal)?.address;
      console.warn(`[pilot] Hub mode: every device works on ${status.vault}. Portal: http://${lan ?? '<this laptop IP>'}:3000`);
    } else {
      console.warn('[pilot] WARNING: not a hub build - each browser keeps its own copy and nothing is kept. Run npm run build:pilot first.');
    }
    return;
  }
}
void reportMode();
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
