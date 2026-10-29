// =========================================================================
// THE PILOT HUB'S CENTRAL SYNC HANDSHAKE (Sprint 11 Revision 13.0)
// A room pilot's hub vault (hub-sync.ts) no longer takes a council's roster, logged hours and module switches only from
// the seed. When `npm run dev:pilot` starts a hub whose vault does not exist yet, the hub opens the simulated central
// database - one SQLite file holding every tenant council, standing in for the production multi-tenant database until
// the remote driver exists - and pulls in one council's live slice:
//   - its Member rows (added or refreshed by id; the seven pilot personas below are never touched);
//   - the EventTime and ActivityTime hours of those members;
//   - its Council module switches (flag_* and feature_* columns), parent_organization and tenant_type.
// An existing vault is never overwritten: the handshake runs once, when the vault is created. Nothing the hub already
// holds is deleted, so the pilot scripts' seeded records (the seated runways) stay where the printed scripts expect them.
// The result is a receipt, kept beside the vault (hub-sync-receipt.json) and reported by GET /api/sync/replicate.
// =========================================================================

/** The simulated central database's file, beside the vault unless PILOT_CENTRAL_DIR moves it. */
export const CENTRAL_VAULT_FILE = 'simulated-central.db';
/** The receipt of the last handshake, beside the vault. */
export const PILOT_SYNC_RECEIPT_FILE = 'hub-sync-receipt.json';
/** The environment variable naming the council (its CouncilNumber) whose slice a new vault pulls in. */
export const PILOT_SYNC_COUNCIL_ENV = 'PILOT_SYNC_COUNCIL';
/** The environment variable that moves the simulated central database's folder. */
export const PILOT_CENTRAL_DIR_ENV = 'PILOT_CENTRAL_DIR';
/** The council `npm run dev:pilot` syncs unless `--council <number>` names another. */
export const DEFAULT_PILOT_SYNC_COUNCIL = 15295;
/** The Council columns the handshake copies, besides every flag_* and feature_* column. */
export const PILOT_SYNC_COUNCIL_SETTINGS: readonly string[] = ['parent_organization', 'tenant_type'];

/** Whether a Council column is one the handshake copies. */
export const isPilotSyncedCouncilColumn = (column: string): boolean =>
  /^(flag_|feature_)/.test(column) || PILOT_SYNC_COUNCIL_SETTINGS.includes(column);

/** The council number a handshake asks for: a positive whole number, else null (no handshake). */
export function cleanPilotSyncCouncil(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** One table's count of rows added, refreshed and skipped (a row that does not fit the vault, e.g. a missing shift). */
export interface PilotSyncCount {
  added: number;
  updated: number;
  skipped: number;
}

export interface PilotSyncReceipt {
  councilNumber: number;
  councilName: string;
  /** ISO time of the handshake. */
  syncedAt: string;
  members: PilotSyncCount;
  eventHours: PilotSyncCount;
  activityHours: PilotSyncCount;
  /** The Council columns copied (switches and settings). */
  councilSettings: string[];
  /** Pilot persona rows left as the vault had them. */
  personasKept: number;
}

/**
 * Sprint 8S Revision 10.3: the seven seeded Conference Room Pilot personas (Seed.sql Credentials 28-34) already hold a
 * password, so their email goes straight to the plain email + password sign-in, never the setup-code screen. Sprint 11
 * Revision 13.0: the central handshake never touches their Member rows. Remove this list after the pilot.
 */
export const PILOT_PERSONA_EMAILS: readonly string[] = [
  'gk_user@stmarys.org',
  'fs_user@stmarys.org',
  'treasurer_user@stmarys.org',
  'dgk_user@stmarys.org',
  'historian_user@stmarys.org',
  'member_alpha@stmarys.org',
  'member_beta@stmarys.org',
];

export const isPilotPersonaEmail = (email: string): boolean => PILOT_PERSONA_EMAILS.includes(email.trim().toLowerCase());
