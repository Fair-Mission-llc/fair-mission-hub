// Sprint 11 Revision 13.0: the pilot hub's central sync handshake (shared pilot-sync.ts).
//
// SERVER ONLY. The simulated central database is one SQLite file (simulated-central.db) built by the same data layer
// as the vault, holding every tenant council. It stands in for the production multi-tenant database until the remote
// driver exists; it is created from the seed the first time it is needed and kept after that, so changes made in it
// carry into the next new vault. When hubService (hub-vault.ts) creates a new vault and PILOT_SYNC_COUNCIL names a
// council, syncVaultFromCentral pulls that council's roster, logged hours and module switches into it, inside one
// transaction, and writes the receipt beside the vault. An existing vault is never synced over.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  CENTRAL_VAULT_FILE,
  cleanPilotSyncCouncil,
  isPilotPersonaEmail,
  isPilotSyncedCouncilColumn,
  PILOT_CENTRAL_DIR_ENV,
  PILOT_SYNC_COUNCIL_ENV,
  PILOT_SYNC_RECEIPT_FILE,
  type PilotSyncCount,
  type PilotSyncReceipt,
} from '@kofc/shared';
import { SqliteDataService, type SqliteModule } from '../../../../mobile/services/drivers/sqlite';
import { createNodeSqlite } from './node-sqlite';

if (typeof window !== 'undefined') {
  throw new Error('services/server/hub/central-sync.ts was loaded in a browser. The hub vault lives on the server only.');
}

type Env = Record<string, string | undefined>;
type Row = Record<string, string | number | null>;

/** The folder of the simulated central database: PILOT_CENTRAL_DIR, else the vault's own folder. */
export const centralDataDir = (vaultDir: string, env: Env = process.env): string =>
  env[PILOT_CENTRAL_DIR_ENV]?.trim() ? resolve(/*turbopackIgnore: true*/ env[PILOT_CENTRAL_DIR_ENV]!.trim()) : vaultDir;

export const centralVaultPath = (vaultDir: string, env: Env = process.env): string =>
  join(/*turbopackIgnore: true*/ centralDataDir(vaultDir, env), CENTRAL_VAULT_FILE);

/** The council a new vault syncs, from PILOT_SYNC_COUNCIL; null means no handshake (tests, the desktop build). */
export const pilotSyncCouncil = (env: Env = process.env): number | null => cleanPilotSyncCouncil(env[PILOT_SYNC_COUNCIL_ENV]);

/** Opens the simulated central database once, creating it from the seed when it does not exist yet, then closes it. */
export async function ensureSimulatedCentral(dir: string): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const central = new SqliteDataService({
    sqlite: createNodeSqlite(dir, CENTRAL_VAULT_FILE) as unknown as SqliteModule,
    persistent: true,
    presentationData: true,
    ballotSecret: 'simulated-central',
    log: () => {},
  });
  try {
    await central.init();
  } finally {
    await central.close();
  }
  return join(/*turbopackIgnore: true*/ dir, CENTRAL_VAULT_FILE);
}

const columnsOf = (db: DatabaseSync, table: string): string[] =>
  (db.prepare(`PRAGMA table_info([${table}])`).all() as { name: string }[]).map((c) => c.name);

const blank = (): PilotSyncCount => ({ added: 0, updated: 0, skipped: 0 });

/** Adds a row the vault lacks, or refreshes the one it has with the same id; a row that does not fit is skipped. */
function upsert(vault: DatabaseSync, table: string, columns: string[], row: Row, count: PilotSyncCount): void {
  const values = columns.map((c) => row[c] ?? null);
  try {
    const exists = vault.prepare(`SELECT 1 AS hit FROM [${table}] WHERE id = ?`).get(row.id);
    if (exists) {
      const set = columns.filter((c) => c !== 'id');
      vault.prepare(`UPDATE [${table}] SET ${set.map((c) => `[${c}] = ?`).join(', ')} WHERE id = ?`).run(...set.map((c) => row[c] ?? null), row.id);
      count.updated++;
    } else {
      vault.prepare(`INSERT INTO [${table}] (${columns.map((c) => `[${c}]`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`).run(...values);
      count.added++;
    }
  } catch {
    count.skipped++; // e.g. the hours of a shift the vault does not have
  }
}

/**
 * Pulls one council's slice from the central file into the vault file: Member rows (pilot personas kept as they are),
 * their EventTime and ActivityTime hours, and the Council switches and settings. Runs in one transaction on the vault.
 * Throws when either file does not hold the council.
 */
export function pullTenantSlice(centralPath: string, vaultPath: string, councilNumber: number, now = new Date()): PilotSyncReceipt {
  const central = new DatabaseSync(centralPath, { readOnly: true });
  const vault = new DatabaseSync(vaultPath);
  try {
    vault.exec('PRAGMA foreign_keys = ON;');
    const source = central.prepare('SELECT * FROM [Council] WHERE CouncilNumber = ?').get(councilNumber) as Row | undefined;
    if (!source) throw new Error(`The simulated central database has no council ${councilNumber}.`);
    const target = vault.prepare('SELECT id FROM [Council] WHERE CouncilNumber = ?').get(councilNumber) as { id: number } | undefined;
    if (!target) throw new Error(`The hub vault has no council ${councilNumber} to sync into.`);

    const receipt: PilotSyncReceipt = {
      councilNumber,
      councilName: String(source.CouncilName ?? ''),
      syncedAt: now.toISOString(),
      members: blank(),
      eventHours: blank(),
      activityHours: blank(),
      councilSettings: [],
      personasKept: 0,
    };
    const shared = (table: string) => {
      const inVault = new Set(columnsOf(vault, table));
      return columnsOf(central, table).filter((c) => inVault.has(c));
    };

    vault.exec('BEGIN');
    try {
      // 1. The council's module switches and tenant settings.
      const settings = shared('Council').filter(isPilotSyncedCouncilColumn);
      if (settings.length) {
        vault.prepare(`UPDATE [Council] SET ${settings.map((c) => `[${c}] = ?`).join(', ')} WHERE id = ?`).run(...settings.map((c) => source[c] ?? null), target.id);
      }
      receipt.councilSettings = settings;

      // 2. The roster. A central member of another council in the vault under the same id is skipped, never moved.
      const memberColumns = shared('Member');
      const members = central.prepare('SELECT * FROM [Member] WHERE CouncilID = ? ORDER BY id').all(source.id) as Row[];
      const synced: number[] = [];
      for (const m of members) {
        if (isPilotPersonaEmail(String(m.Email ?? ''))) {
          receipt.personasKept++;
          continue;
        }
        const held = vault.prepare('SELECT CouncilID FROM [Member] WHERE id = ?').get(m.id) as { CouncilID: number } | undefined;
        if (held && held.CouncilID !== target.id) {
          receipt.members.skipped++;
          continue;
        }
        upsert(vault, 'Member', memberColumns, { ...m, CouncilID: target.id }, receipt.members);
        synced.push(Number(m.id));
      }

      // 3. The logged hours of those members.
      if (synced.length) {
        const ids = synced.map(() => '?').join(', ');
        for (const [table, count] of [
          ['EventTime', receipt.eventHours],
          ['ActivityTime', receipt.activityHours],
        ] as const) {
          const columns = shared(table);
          for (const row of central.prepare(`SELECT * FROM [${table}] WHERE MemberID IN (${ids}) ORDER BY id`).all(...synced) as Row[]) {
            upsert(vault, table, columns, row, count);
          }
        }
      }
      vault.exec('COMMIT');
    } catch (err) {
      vault.exec('ROLLBACK');
      throw err;
    }
    return receipt;
  } finally {
    central.close();
    vault.close();
  }
}

export const syncReceiptPath = (vaultDir: string): string => join(/*turbopackIgnore: true*/ vaultDir, PILOT_SYNC_RECEIPT_FILE);

/** The receipt of the handshake that filled this vault, or null when it was never synced. */
export function readSyncReceipt(vaultDir: string): PilotSyncReceipt | null {
  const file = syncReceiptPath(vaultDir);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as PilotSyncReceipt;
  } catch {
    return null;
  }
}

/** The handshake for a vault that was just created: ensures the central file, pulls the slice, writes the receipt. */
export async function syncVaultFromCentral(vaultDir: string, vaultPath: string, councilNumber: number, env: Env = process.env): Promise<PilotSyncReceipt> {
  const centralPath = await ensureSimulatedCentral(centralDataDir(vaultDir, env));
  const receipt = pullTenantSlice(centralPath, vaultPath, councilNumber);
  writeFileSync(syncReceiptPath(vaultDir), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}
