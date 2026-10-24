// Sprint 9 Revision 4.0: expo-sqlite for the pilot hub's server bundle (next.config.ts resolveAlias, tsconfig paths).
// The hub always hands the phone data layer its own SQLite module (node-sqlite.ts, the `sqlite` option), so these
// defaults only refuse.
import type { SQLiteDatabase } from '../node-sqlite';

export type { SQLiteDatabase };

const NOT_ON_SERVER = 'expo-sqlite is not available on the server: pass the hub vault adapter (services/server/hub/node-sqlite.ts).';

export async function openDatabaseAsync(_name: string): Promise<SQLiteDatabase> {
  throw new Error(NOT_ON_SERVER);
}
export async function deleteDatabaseAsync(_name: string): Promise<void> {
  throw new Error(NOT_ON_SERVER);
}
export async function backupDatabaseAsync(_options: { sourceDatabase: SQLiteDatabase; destDatabase: SQLiteDatabase }): Promise<void> {
  throw new Error(NOT_ON_SERVER);
}
