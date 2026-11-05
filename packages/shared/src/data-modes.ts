// =========================================================================
// THE THREE-CORE LOCAL DATABASES (Sprint 11 Revision 20.0; seed fixture and testing key Sprint 11 Revision 21.0)
//
// Every desktop installation keeps three separate SQLite files in its vault folder, one per data mode:
//   production  central-hub-vault.db     the council's real records (Production, synced over the WAN)
//   testing     testing-sandbox.db       a practice copy shared by laptops in the same hall (Testing, LAN P2P)
//   training    training-playground.db   a throwaway copy, rebuilt and seeded on every start (Training, offline)
// The desktop shell asks which mode to open at start-up and passes it to the portal server as KOFC_DATA_MODE
// (apps/desktop/main.cjs). The hub vault opens that mode's file (apps/web/services/server/hub/hub-vault.ts). The files
// never mix: a record saved in one mode is never read in another.
//
// Testing mode on a hall Wi-Fi: each save is sent to the other laptops as an encrypted UDP broadcast
// (apps/web/services/server/hub/lan-mesh.ts) and replayed on their testing-sandbox.db. The laptops must share one mesh
// passphrase: KOFC_MESH_PASSPHRASE, or the .testing-key.json file beside the vault, which the server writes with a random
// passphrase on the first testing start (copy it to the other laptops). With no network, testing mode works alone.
//
// Training mode: training-playground.db is deleted and built again on every start, then seeded with a practice
// fraternal universe (seedTrainingPlayground): the ten Practice Sandbox members, its three upcoming fundraisers with
// volunteers signed up, and three cash boxes - cash donations logged today, one box named for each fundraiser. They are
// standalone donations, because an event donation may not be dated before its event starts.
//
// Training Profile Selection Board: the training playground also holds seven generic accounts, one per core seat
// (TRAINING_PROFILES: admin@training for the Council Admin, then the Grand Knight, Financial Secretary, Treasurer,
// Recorder, Council Historian and a plain member), all with the password TRAINING_PASSWORD. In training mode the sign-in
// screen lists them as one-click buttons, and the Admin's sign-in code step is skipped for these accounts only
// (isTrainingProfileUsername). The accounts exist only in training-playground.db.
//
// Banners: Testing mode draws an amber warning banner and Training mode a cobalt blue notice banner across the top of
// every page (dataModeBanner, apps/web/components/DataModeBanner.tsx). Production draws none.
// =========================================================================
import type { DataService } from './contract';
import { isViewAsReadMethod } from './platform-access';
import { isPracticeEventName } from './setup-wizard';
import { TRAINING_SEED } from './training-seed';

export const DATA_MODES = ['production', 'testing', 'training'] as const;
export type DataMode = (typeof DATA_MODES)[number];

/** The server setting that names the data mode. */
export const DATA_MODE_ENV = 'KOFC_DATA_MODE';

/** Each mode's database file, in the vault folder. */
export const DATA_MODE_VAULT_FILES: Readonly<Record<DataMode, string>> = {
  production: 'central-hub-vault.db',
  testing: 'testing-sandbox.db',
  training: 'training-playground.db',
};

export const DATA_MODE_LABELS: Readonly<Record<DataMode, string>> = {
  production: 'Production (WAN)',
  testing: 'Testing (LAN P2P)',
  training: 'Training (Offline Ephemeral)',
};

/** One line per mode for the start-up chooser and the manuals. */
export const DATA_MODE_HINTS: Readonly<Record<DataMode, string>> = {
  production: "The council's real records.",
  testing: 'A practice copy. Laptops in the same hall share it over the Wi-Fi; alone, it is kept on this computer.',
  training: 'A throwaway copy with practice members, events and cash boxes. It starts fresh every time.',
};

/** A mode name read from a setting; anything unknown or blank is Production. */
export function parseDataMode(value: unknown): DataMode {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (DATA_MODES as readonly string[]).includes(v) ? (v as DataMode) : 'production';
}

/** Whether the mode's file is deleted and built again on every start. */
export const isEphemeralDataMode = (mode: DataMode): boolean => mode === 'training';

export interface DataModeBannerSpec {
  mode: Exclude<DataMode, 'production'>;
  tone: 'amber' | 'cobalt';
  title: string;
  text: string;
}

export const TESTING_MODE_BANNER: DataModeBannerSpec = {
  mode: 'testing',
  tone: 'amber',
  title: 'Testing Mode',
  text: 'You are working in the testing sandbox (testing-sandbox.db). Nothing here touches the council’s real records.',
};

export const TRAINING_MODE_BANNER: DataModeBannerSpec = {
  mode: 'training',
  tone: 'cobalt',
  title: 'Training Mode',
  text: 'You are in the training playground (training-playground.db). Practice freely: it starts fresh every time the program opens.',
};

/** The banner across the top of every page, or null in Production. */
export const dataModeBanner = (mode: DataMode): DataModeBannerSpec | null =>
  mode === 'testing' ? TESTING_MODE_BANNER : mode === 'training' ? TRAINING_MODE_BANNER : null;

// ---- the testing LAN mesh -------------------------------------------------------------------------------------------

/** The UDP port the testing mesh broadcasts on. */
export const LAN_MESH_PORT = 41295;
export const LAN_MESH_PASSPHRASE_ENV = 'KOFC_MESH_PASSPHRASE';
/**
 * Sprint 11 Revision 21.0: the testing key file in the vault folder, replacing testing-mesh-passphrase.txt. When testing
 * mode starts with no KOFC_MESH_PASSPHRASE and no key file, the server writes one with a random passphrase
 * (lan-mesh.ts ensureTestingKeyFile). Copy that one file to every laptop in the hall so they share one key.
 */
export const TESTING_KEY_FILE = '.testing-key.json';
/** The shape of TESTING_KEY_FILE. */
export interface TestingKeyFile {
  version: 1;
  passphrase: string;
  createdAt: string;
}
/** The largest encrypted packet the mesh sends; a larger save (a photo) stays on the laptop that made it. */
export const LAN_MESH_MAX_PACKET_BYTES = 60_000;
/** A packet older than this is ignored, so a replayed capture cannot write old saves again. */
export const LAN_MESH_MAX_AGE_MS = 5 * 60_000;
export const LAN_MESH_MIN_PASSPHRASE_LENGTH = 12;

/** One replicated save as it travels (encrypted). */
export interface LanMeshEnvelope {
  v: 1;
  /** The sending laptop's random id for this run. */
  origin: string;
  /** The sender's running count, so a packet heard twice is replayed once. */
  seq: number;
  method: string;
  args: unknown[];
  /** ISO time the save was made. */
  at: string;
}

/** Namespaces never replicated: sign-in and passkeys belong to one laptop. */
const MESH_LOCAL_NAMESPACES = new Set(['auth', 'passkeys']);

/** Whether a successful hub call is a save the testing mesh sends to the other laptops. Reads are never sent. */
export function isMeshReplicatedMethod(method: string): boolean {
  const [ns = '', name = ''] = method.split('.');
  if (!ns || !name || MESH_LOCAL_NAMESPACES.has(ns)) return false;
  return !isViewAsReadMethod(name);
}

/** Checks a decrypted packet's shape; null when it is not a mesh envelope. */
export function readLanMeshEnvelope(value: unknown): LanMeshEnvelope | null {
  if (typeof value !== 'object' || value === null) return null;
  const e = value as Record<string, unknown>;
  if (e.v !== 1 || typeof e.origin !== 'string' || typeof e.seq !== 'number' || typeof e.method !== 'string' || !Array.isArray(e.args) || typeof e.at !== 'string') {
    return null;
  }
  return e as unknown as LanMeshEnvelope;
}

/** Whether a packet stamped `at` is fresh enough to replay at `now`. */
export const isFreshLanMeshEnvelope = (at: string, now: Date, maxAgeMs = LAN_MESH_MAX_AGE_MS): boolean => {
  const t = Date.parse(at);
  return Number.isFinite(t) && Math.abs(now.getTime() - t) <= maxAgeMs;
};

// ---- the Training Profile Selection Board ---------------------------------------------------------------------------

/** The one password every training profile uses. */
export const TRAINING_PASSWORD = 'training';
export const TRAINING_PROFILE_BOARD_TITLE = 'Training Profile Selection Board';

export interface TrainingProfile {
  username: string;
  /** The button's label. */
  label: string;
  firstName: string;
  lastName: string;
  /** 'Admin' or 'Member' (the MemberType row). */
  memberType: 'Admin' | 'Member';
  /** The council seat the account holds (a Role name), or null for none. */
  role: string | null;
}

/** The seven generic training accounts, in board order. */
export const TRAINING_PROFILES: readonly TrainingProfile[] = [
  { username: 'admin@training', label: 'Council Admin', firstName: 'Training', lastName: 'Admin', memberType: 'Admin', role: null },
  { username: 'gk@training', label: 'Grand Knight', firstName: 'Training', lastName: 'Grand Knight', memberType: 'Member', role: 'Grand Knight' },
  { username: 'fs@training', label: 'Financial Secretary', firstName: 'Training', lastName: 'Secretary', memberType: 'Member', role: 'Financial Secretary' },
  { username: 'tr@training', label: 'Treasurer', firstName: 'Training', lastName: 'Treasurer', memberType: 'Member', role: 'Treasurer' },
  { username: 'rec@training', label: 'Recorder', firstName: 'Training', lastName: 'Recorder', memberType: 'Member', role: 'Recorder' },
  { username: 'hist@training', label: 'Council Historian', firstName: 'Training', lastName: 'Historian', memberType: 'Member', role: 'Council Historian' },
  { username: 'mem@training', label: 'Member', firstName: 'Training', lastName: 'Member', memberType: 'Member', role: null },
];

/** Whether a sign-in name is one of the training profiles. */
export const isTrainingProfileUsername = (username: string | null | undefined): boolean =>
  typeof username === 'string' && TRAINING_PROFILES.some((p) => p.username === username.trim().toLowerCase());

/** Training profile member numbers start here (above the Practice Sandbox's). */
export const TRAINING_PROFILE_MEMBER_NUMBER_BASE = 991_000_000;

// ---- the training playground seed -----------------------------------------------------------------------------------

/** The council the playground is built for (Council 15295) and the seeded Council Admin who builds it. */
export const TRAINING_PLAYGROUND_COUNCIL_ID = 1;
export const TRAINING_PLAYGROUND_ADMIN_ID = 2;
/** How far ahead the seed looks for the practice fundraisers. */
const TRAINING_EVENT_WINDOW_DAYS = 60;
/**
 * The cash logged into each training cash box, in dollars: one list per box (one box per practice fundraiser). Sprint 11
 * Revision 21.0: read from the training seed fixture (training-seed.ts, fixtures/training-seed.json).
 */
export const TRAINING_CASH_BOXES: readonly (readonly number[])[] = TRAINING_SEED.cashBoxes.map((b) => b.amounts);

export interface TrainingPlaygroundSeedResult {
  members: number;
  events: number;
  signups: number;
  cashBoxes: number;
  cashDonations: number;
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The Donor name of training cash box `n` (1-based): the fixture's label for it. */
export const trainingCashBoxName = (n: number): string => TRAINING_SEED.cashBoxes[n - 1]?.label ?? `Training Cash Box ${n}`;

/**
 * Seeds a fresh training playground through the data service itself, so every rule a real save runs also runs here:
 * the Practice Sandbox (ten practice members and three upcoming fundraisers with volunteers), then one cash box per
 * fundraiser (TRAINING_CASH_BOXES): standalone cash donations dated today, Donor 'Training Cash Box n', described with the
 * fundraiser's name. Run it on an empty playground only; on one already seeded it adds nothing and reports zeros.
 */
export async function seedTrainingPlayground(
  db: DataService,
  options: { councilId?: number; actorId?: number; today?: Date } = {},
): Promise<TrainingPlaygroundSeedResult> {
  const councilId = options.councilId ?? TRAINING_PLAYGROUND_COUNCIL_ID;
  const actorId = options.actorId ?? TRAINING_PLAYGROUND_ADMIN_ID;
  const out: TrainingPlaygroundSeedResult = { members: 0, events: 0, signups: 0, cashBoxes: 0, cashDonations: 0 };
  const status = await db.councils.getPracticeSandboxStatus(actorId, councilId);
  if (status.active) return out;
  const seeded = await db.councils.seedPracticeSandbox(actorId, councilId);
  Object.assign(out, seeded);

  const today = options.today ?? new Date();
  const through = new Date(today.getTime() + TRAINING_EVENT_WINDOW_DAYS * 86_400_000);
  const shifts = await db.events.listShiftsBetween(isoDay(today), isoDay(through));
  const eventIds = [...new Set(shifts.map((s) => s.EventID))];
  const events = (await Promise.all(eventIds.map((id) => db.events.get(id)))).filter((e) => e !== null && isPracticeEventName(e.EventName));
  events.sort((a, b) => (a!.StartDate ?? '').localeCompare(b!.StartDate ?? '') || a!.id - b!.id);

  const cash = (await db.donations.listMethods(councilId)).find((m) => m.kind === 'cash');
  const types = await db.lookups.listCouncilSpecific(actorId, councilId, 'DonationType');
  if (!cash || types.length === 0) return out;
  for (const [i, event] of events.entries()) {
    const box = TRAINING_CASH_BOXES[i];
    if (!box) break;
    for (const amount of box) {
      await db.donations.record(actorId, {
        CouncilID: councilId,
        EventID: null,
        Donor: trainingCashBoxName(i + 1),
        DonationDesciption: `Cash box for ${event!.EventName}`,
        DonationMethodID: cash.method.id,
        DonationTypeID: types[0]!.id,
        DonationAmount: amount,
        DonationDate: isoDay(today),
      });
      out.cashDonations += 1;
    }
    out.cashBoxes += 1;
  }
  return out;
}
