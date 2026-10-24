#!/usr/bin/env node
// npm run dev:pilot (Sprint 9 Revision 1.2; launcher since Sprint 9 Revision 2.1): serves the built web portal on every
// network address of this computer, port 3000, for a Wi-Fi pilot - the same as `next start apps/web -H 0.0.0.0 -p 3000`.
//
// Pilot devices reach the portal at http://<this computer's IP>:3000, plain http, where a browser drops a Secure
// cookie. So this launcher sets PORTAL_ALLOW_HTTP_COOKIES=1 (apps/web/services/server/session-token.ts secureCookies):
// the session cookie then travels over http. It stays HttpOnly and SameSite=Strict. Run `npm run build:web` first.
// Never use this launcher on a server that is reachable from the internet.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
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
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
