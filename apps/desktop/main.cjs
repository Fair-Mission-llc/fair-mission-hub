// Sprint 11 Revision 10.0: the desktop shell (Electron). `npm run build:exe` packages it with the web portal into one
// offline Windows executable for trial deployments.
//
// On start it runs the portal's Next.js standalone server (built by scripts/build-exe.mjs with the hub data driver)
// inside Electron's own Node runtime (ELECTRON_RUN_AS_NODE), bound to 127.0.0.1 on a free port, and opens it in a
// window. Nothing listens on the network. The data lives in the hub vault, a SQLite file in this computer's user-data
// folder (%APPDATA%/KofC Tracking Platform/vault), so records survive restarts and updates. A session key is made on
// first run and kept beside the vault, so sign-ins survive restarts too. Links to other sites open in the browser.
'use strict';
const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const HOST = '127.0.0.1';
const STARTUP_TIMEOUT_MS = 60_000;
let server = null;

/** The standalone portal: inside the package's resources once installed, else the local build in the repository. */
function portalDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'portal', 'apps', 'web')
    : path.join(__dirname, '..', 'web', '.next', 'standalone', 'apps', 'web');
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, HOST, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/** Resolves once the portal answers on `url`, or rejects after STARTUP_TIMEOUT_MS. */
function waitForPortal(url) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - started > STARTUP_TIMEOUT_MS) reject(new Error(`The portal did not start within ${STARTUP_TIMEOUT_MS / 1000} seconds.`));
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

/** The session key kept beside the vault, made on first run. */
function sessionSecret(dataDir) {
  const file = path.join(dataDir, 'desktop-session.key');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {
    // first run
  }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

async function startPortal() {
  const dir = portalDir();
  const entry = path.join(dir, 'server.js');
  if (!fs.existsSync(entry)) throw new Error(`The portal build is missing (${entry}). Run npm run build:exe.`);
  const dataDir = path.join(app.getPath('userData'), 'vault');
  fs.mkdirSync(dataDir, { recursive: true });
  const port = await freePort();
  const log = fs.createWriteStream(path.join(app.getPath('userData'), 'portal.log'), { flags: 'a' });
  server = spawn(process.execPath, [entry], {
    cwd: dir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      HOSTNAME: HOST,
      PORT: String(port),
      HUB_VAULT_DIR: dataDir,
      PORTAL_SESSION_SECRET: sessionSecret(dataDir),
      // The window talks to the server over plain http on the loopback address, where a Secure cookie is dropped.
      PORTAL_ALLOW_HTTP_COOKIES: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  server.once('exit', (code) => {
    server = null;
    if (!app.isQuitting) {
      dialog.showErrorBox('KofC Tracking Platform', `The portal stopped unexpectedly (exit code ${code}). See portal.log in ${app.getPath('userData')}.`);
      app.quit();
    }
  });
  const url = `http://${HOST}:${port}`;
  await waitForPortal(`${url}/api/sync/replicate`);
  return url;
}

/** GET `url` as JSON. */
function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

/** The vault's PRAGMA user_version, or 0 when there is no vault yet. Read-only; the server has not opened it yet. */
function vaultVersion(dataDir) {
  const file = path.join(dataDir, 'central-hub-vault.db');
  if (!fs.existsSync(file)) return 0;
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare('PRAGMA user_version').get().user_version ?? 0;
  } finally {
    db.close();
  }
}

/**
 * Sprint 11 Revision 11.0: the hub never opens or wipes a vault from an older database version, so after an upgrade the
 * pages would fail. This asks first, then moves the old vault folder aside (vault-archive-<time>) and starts a fresh
 * one. Nothing is deleted. Returns false when the person chose to quit.
 */
async function ensureVaultVersion(url) {
  const dataDir = path.join(app.getPath('userData'), 'vault');
  const { schemaVersion } = await getJson(`${url}/api/sync/replicate`);
  const version = vaultVersion(dataDir);
  if (version === 0 || !schemaVersion || version >= schemaVersion) return true;
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    title: 'KofC Tracking Platform',
    message: `This version needs a new database (version ${schemaVersion}). Your records are in an older one (version ${version}).`,
    detail:
      'Choose "Start a new database" to keep the old records in a dated archive folder and start from the seed records. ' +
      `The archive stays in ${app.getPath('userData')}. Choose "Quit" to keep using the older program.`,
    buttons: ['Start a new database', 'Quit'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return false;
  if (server) {
    const stopped = new Promise((resolve) => server.once('exit', resolve));
    app.isQuitting = true;
    server.kill();
    await stopped;
    app.isQuitting = false;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.renameSync(dataDir, path.join(app.getPath('userData'), `vault-archive-v${version}-${stamp}`));
  return true;
}

async function createWindow() {
  let url = await startPortal();
  if (!(await ensureVaultVersion(url))) {
    app.quit();
    return;
  }
  if (!server) url = await startPortal();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'KofC Tracking Platform',
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.removeMenu();
  win.once('ready-to-show', () => win.show());
  // Only the local portal opens inside the window; anything else goes to the default browser.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (!target.startsWith(url)) void shell.openExternal(target);
    return { action: target.startsWith(url) ? 'allow' : 'deny' };
  });
  win.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(url)) {
      event.preventDefault();
      void shell.openExternal(target);
    }
  });
  await win.loadURL(url);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.on('before-quit', () => {
    app.isQuitting = true;
    if (server) server.kill();
  });
  app.on('window-all-closed', () => app.quit());
  app
    .whenReady()
    .then(createWindow)
    .catch((err) => {
      dialog.showErrorBox('KofC Tracking Platform', String(err && err.message ? err.message : err));
      app.quit();
    });
}
