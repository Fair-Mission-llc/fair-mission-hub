// The pilot hub's SQLite (Sprint 9 Revision 4.0): the three expo-sqlite calls the phone data layer makes
// (SqliteModule in apps/mobile/services/drivers/sqlite.ts), over real files in one folder on the hub laptop's disk,
// with node:sqlite.
//
// The phone data layer opens 'kofc.db'; here that name is the vault, central-hub-vault.db. Any other name (a backup
// copy) is a file of that name in a backups/ folder beside it. Deleting the vault is refused: whatever happens, the
// file and its records stay on disk. Every write is committed to the file before the call returns (WAL journal,
// synchronous=FULL), so stopping the server - even pulling the plug - keeps everything saved so far.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';

type Param = string | number | null;

/** The file the phone data layer's 'kofc.db' becomes on the hub. */
export const HUB_VAULT_FILE = 'central-hub-vault.db';
const PHONE_DATABASE_NAME = 'kofc.db';

const plain = <T>(row: unknown): T => ({ ...(row as object) }) as T;

/** The handful of expo-sqlite database calls the phone data layer uses, over one node:sqlite connection. */
export class SQLiteDatabase {
  constructor(readonly raw: DatabaseSync) {}

  async execAsync(sql: string): Promise<void> {
    this.raw.exec(sql);
  }
  async getFirstAsync<T>(sql: string, params: Param[] = []): Promise<T | null> {
    const row = this.raw.prepare(sql).get(...params);
    return row === undefined ? null : plain<T>(row);
  }
  async getAllAsync<T>(sql: string, params: Param[] = []): Promise<T[]> {
    return this.raw.prepare(sql).all(...params).map((r) => plain<T>(r));
  }
  async runAsync(sql: string, params: Param[] = []): Promise<{ changes: number; lastInsertRowId: number }> {
    const res = this.raw.prepare(sql).run(...params);
    return { changes: Number(res.changes), lastInsertRowId: Number(res.lastInsertRowid) };
  }
  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.raw.exec('BEGIN');
    try {
      await task();
      this.raw.exec('COMMIT');
    } catch (err) {
      this.raw.exec('ROLLBACK');
      throw err;
    }
  }
  async closeAsync(): Promise<void> {
    if (this.raw.isOpen) this.raw.close();
  }
}

export interface NodeSqlite {
  openDatabaseAsync(name: string): Promise<SQLiteDatabase>;
  deleteDatabaseAsync(name: string): Promise<void>;
  backupDatabaseAsync(options: { sourceDatabase: SQLiteDatabase; destDatabase: SQLiteDatabase }): Promise<void>;
  /** Where a database name lives on disk. */
  pathOf(name: string): string;
}

/**
 * The SQLite module for a hub whose files live in `dir`. Sprint 11 Revision 13.0: `vaultFile` names the file the phone data
 * layer's 'kofc.db' becomes - the vault by default, or the simulated central database (central-sync.ts).
 */
export function createNodeSqlite(dir: string, vaultFile: string = HUB_VAULT_FILE): NodeSqlite {
  const pathOf = (name: string) =>
    name === PHONE_DATABASE_NAME ? join(/*turbopackIgnore: true*/ dir, vaultFile) : join(/*turbopackIgnore: true*/ dir, 'backups', name);
  return {
    pathOf,
    async openDatabaseAsync(name) {
      const path = pathOf(name);
      mkdirSync(join(/*turbopackIgnore: true*/ path, '..'), { recursive: true });
      const raw = new DatabaseSync(path);
      raw.exec('PRAGMA journal_mode = WAL;');
      raw.exec('PRAGMA synchronous = FULL;');
      return new SQLiteDatabase(raw);
    },
    async deleteDatabaseAsync(name) {
      throw new Error(`The hub never deletes ${name === PHONE_DATABASE_NAME ? vaultFile : name}: its records are kept on disk.`);
    },
    async backupDatabaseAsync({ sourceDatabase, destDatabase }) {
      const target = destDatabase.raw.location();
      await destDatabase.closeAsync();
      if (target) await backup(sourceDatabase.raw, target);
    },
  };
}
