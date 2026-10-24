#!/usr/bin/env node
// npm run hub:archive (Sprint 9 Revision 4.0): starts the next pilot session on a fresh hub vault without losing the
// last one. It moves central-hub-vault.db (with its -wal and -shm files), its ballot secret, its check photos and its
// backups from packages/backend/data/ into packages/backend/data/archive/<date and time>/. Nothing is deleted. The next
// `npm run dev:pilot` then creates a new vault from the seed data, so the scripted pilot records are fresh again.
// Without this step the vault keeps adding to the same records, session after session.
// Stop `npm run dev:pilot` first: the running hub holds the vault file open. HUB_VAULT_DIR moves the folder, as for the hub.
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.env.HUB_VAULT_DIR?.trim() ? resolve(process.env.HUB_VAULT_DIR.trim()) : join(root, 'packages', 'backend', 'data');
const ENTRIES = ['central-hub-vault.db', 'central-hub-vault.db-wal', 'central-hub-vault.db-shm', 'hub-ballot-secret.txt', 'photos', 'backups'];

const running = await fetch('http://127.0.0.1:3000/api/sync/replicate')
  .then((r) => r.json())
  .then((s) => s?.hub === true)
  .catch(() => false);
if (running) {
  console.error('[hub] The hub is running. Stop npm run dev:pilot (Ctrl+C) first, then run npm run hub:archive again.');
  process.exit(1);
}

const present = ENTRIES.filter((name) => existsSync(join(dir, name)));
if (!present.includes('central-hub-vault.db')) {
  console.log(`[hub] No vault in ${dir}. The next npm run dev:pilot creates a fresh one.`);
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = join(dir, 'archive', stamp);
mkdirSync(target, { recursive: true });
for (const name of present) renameSync(join(dir, name), join(target, name));
console.log(`[hub] Archived the vault to ${target}. The next npm run dev:pilot starts a fresh vault from the seed data.`);
