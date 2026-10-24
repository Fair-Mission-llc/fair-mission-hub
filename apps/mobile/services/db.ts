// =========================================================================
// THE ONLY DATA-ACCESS ENTRY POINT FOR THE MOBILE APP.
// Screens and components import `db` from here and nothing else that touches
// data. Which driver backs it is decided in one place, below.
//
//   EXPO_PUBLIC_DATA_DRIVER=sqlite  (default)  local expo-sqlite database
//   EXPO_PUBLIC_DATA_DRIVER=remote             production Azure SQL, via drivers/remote.ts
//   EXPO_PUBLIC_DATA_DRIVER=hub                Sprint 9 Revision 4.0: the room pilot's hub laptop at EXPO_PUBLIC_HUB_URL
//                                              (npm run dev:mobile:pilot) - nothing is kept on the phone
// =========================================================================
import { createHubDataService, fetchHubTransport, HUB_DATA_DRIVER, type DataService } from '@kofc/shared';
import { createRemoteDataService } from './drivers/remote';
import { SqliteDataService } from './drivers/sqlite';

/** Sprint 9 Revision 4.0: the hub laptop's address, e.g. http://10.0.0.167:3000 (hub mode only). */
export const HUB_URL = (process.env.EXPO_PUBLIC_HUB_URL ?? '').replace(/\/+$/, '');
/** Whether this build works on the pilot hub instead of the phone's own database. */
export const HUB_MODE = (process.env.EXPO_PUBLIC_DATA_DRIVER ?? 'sqlite') === HUB_DATA_DRIVER;

function createDataService(): DataService {
  const driver = process.env.EXPO_PUBLIC_DATA_DRIVER ?? 'sqlite';
  switch (driver) {
    case 'sqlite':
      // A new database is loaded with Seed.sql's presentation data (Sprint 5Z-1) so no screen or chart starts blank.
      return new SqliteDataService({ presentationData: true });
    case 'remote':
      return createRemoteDataService();
    case HUB_DATA_DRIVER:
      return createHubDataService(fetchHubTransport(HUB_URL));
    default:
      throw new Error(`Unknown EXPO_PUBLIC_DATA_DRIVER "${driver}" (expected "sqlite", "remote" or "hub")`);
  }
}

export const db: DataService = createDataService();

export type { DataService } from '@kofc/shared';
