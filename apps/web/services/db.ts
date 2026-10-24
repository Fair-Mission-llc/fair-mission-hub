// =========================================================================
// THE ONLY DATA-ACCESS ENTRY POINT FOR THE WEB APP.
// Pages and components import `db` from here and nothing else that touches
// data. Which driver backs it is decided in one place, below.
//
//   NEXT_PUBLIC_DATA_DRIVER=memory  (default)  in-memory mock, seeded from Seed.sql
//   NEXT_PUBLIC_DATA_DRIVER=remote             production Azure SQL, via drivers/remote.ts
//   NEXT_PUBLIC_DATA_DRIVER=hub                Sprint 9 Revision 4.0: the room pilot's hub laptop - every call goes to
//                                              /api/sync/replicate and runs on its persistent vault (npm run build:pilot)
//
// The memory driver is client-side state: import `db` only from client
// components ("use client"); each browser tab gets its own copy.
// =========================================================================
import { createHubDataService, fetchHubTransport, guardViewAsWrites, HUB_DATA_DRIVER, type DataService } from '@kofc/shared';
import { postAlchemerViaServer } from './alchemer-transport';
import { sendEmailViaServer } from './email-transport';
import { MemoryDataService } from './drivers/memory';
import { createRemoteDataService } from './drivers/remote';

/** Which driver backs `db`. Demo-only controls (the budget's June simulator) appear only on the in-memory mock. */
export const DATA_DRIVER = process.env.NEXT_PUBLIC_DATA_DRIVER ?? 'memory';

function createDataService(): DataService {
  const driver = DATA_DRIVER;
  switch (driver) {
    case 'memory':
      // Supreme reports and email go through the server routes, which hold the Alchemer and SendGrid credentials. The demo council is loaded
      // with Seed.sql's presentation data (Sprint 5Z-1) so no screen or chart starts blank.
      return new MemoryDataService({ postAlchemer: postAlchemerViaServer, sendEmail: sendEmailViaServer, presentationData: true });
    case 'remote':
      return createRemoteDataService();
    case HUB_DATA_DRIVER:
      // The portal and the hub are the same server, so the calls go to this origin with the session cookie.
      return createHubDataService(fetchHubTransport(''));
    default:
      throw new Error(`Unknown NEXT_PUBLIC_DATA_DRIVER "${driver}" (expected "memory", "remote" or "hub")`);
  }
}

let viewAsActive = false;

/**
 * Sprint 7F: while a Super Admin views the portal as another member (lib/session.tsx impersonate), every data-service
 * method that is not a read rejects VIEW_AS_READ_ONLY, so nothing is saved in that member's name.
 */
export function setViewAsMode(on: boolean): void {
  viewAsActive = on;
}

export const db: DataService = guardViewAsWrites(createDataService(), () => viewAsActive);

export type { DataService } from '@kofc/shared';
