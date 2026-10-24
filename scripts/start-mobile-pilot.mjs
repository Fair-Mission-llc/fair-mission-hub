#!/usr/bin/env node
// npm run dev:mobile:pilot (Sprint 9 Revision 4.0): the phone bundler for a room pilot. Like `npm run dev:mobile`
// (expo start --offline), but the app it serves works on the pilot hub laptop - EXPO_PUBLIC_DATA_DRIVER=hub and
// EXPO_PUBLIC_HUB_URL=http://<this laptop's Wi-Fi address>:3000 - instead of on a database inside each phone. Run it on
// the hub laptop, after `npm run dev:pilot` is serving a `npm run build:pilot` build.
// Another address: npm run dev:mobile:pilot -- --hub http://10.0.0.20:3000 (or HUB_URL=...).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mobile = join(root, 'apps', 'mobile');
const expoCli = createRequire(join(mobile, 'package.json')).resolve('expo/bin/cli');

const args = process.argv.slice(2);
const hubFlag = args.indexOf('--hub');
const given = hubFlag >= 0 ? args.splice(hubFlag, 2)[1] : process.env.HUB_URL;

/** This laptop's Wi-Fi address: the first private IPv4 address, else the first external one. */
function lanAddress() {
  const all = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
  return all.find((ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) ?? all[0];
}

const hubUrl = (given ?? (lanAddress() ? `http://${lanAddress()}:3000` : '')).replace(/\/+$/, '');
if (!hubUrl) {
  console.error('[pilot] No Wi-Fi address found. Join the room Wi-Fi, or pass --hub http://<hub laptop IP>:3000.');
  process.exit(1);
}
console.warn(`[pilot] Phones will work on the hub at ${hubUrl}. Keep this laptop and every phone on the same Wi-Fi.`);

const child = spawn(process.execPath, [expoCli, 'start', '--offline', ...args], {
  cwd: mobile,
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_DATA_DRIVER: 'hub', EXPO_PUBLIC_HUB_URL: hubUrl },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
