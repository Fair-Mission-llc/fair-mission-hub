// The pilot hub's vault (Sprint 9 Revision 4.0): the council's one shared database for a room pilot, a SQLite file on
// the hub laptop's disk (packages/backend/data/central-hub-vault.db), opened by the phone data layer itself
// (SqliteDataService) so the hub runs exactly the rules a phone runs.
//
// SERVER ONLY. Hub mode is on when the portal was built with NEXT_PUBLIC_DATA_DRIVER=hub (npm run build:pilot). Then:
//   - the file is created and seeded on first use and never wiped (the `persistent` option): it keeps and adds to every
//     record, meeting log and check photo from every session; a stop or restart loses nothing already answered;
//   - the folder also holds the ballot secret (hub-ballot-secret.txt), so secret ballots stay valid across sessions,
//     and the check photos (photos/);
//   - every call runs alone, one after another (serialized): the data layer runs its transactions on one connection,
//     so two devices' saves never interleave;
//   - memberDirectory() (session.ts) is this vault, so sign-in, the calendar feed and the other server routes see what
//     every device saved.
// HUB_VAULT_DIR moves the folder (the tests use a temporary one).
// Sprint 11 Revision 13.0: a vault created while PILOT_SYNC_COUNCIL is set (npm run dev:pilot sets it) is filled from the
// simulated central database right after its seed: that council's roster, logged hours and module switches
// (central-sync.ts). An existing vault is never synced over.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { HUB_DATA_DRIVER, HUB_VAULT_RELATIVE_PATH, isHubMethodName, type DataService, type HubCall } from '@kofc/shared';
import { SqliteDataService, type SqliteModule } from '../../../../mobile/services/drivers/sqlite';
import { deliverServerEmail } from '../notify';
import { createNodeSqlite, HUB_VAULT_FILE } from './node-sqlite';
import { pilotSyncCouncil, syncVaultFromCentral } from './central-sync';

if (typeof window !== 'undefined') {
  throw new Error('services/server/hub/hub-vault.ts was loaded in a browser. The hub vault lives on the server only.');
}

type Env = Record<string, string | undefined>;

/**
 * Hub mode: the portal was built for a room pilot (NEXT_PUBLIC_DATA_DRIVER=hub). The literal process.env read is the
 * one Next bakes into the build; `env`, when given, is read instead (tests).
 */
export const hubModeOn = (env?: Env): boolean =>
  ((env ? env.NEXT_PUBLIC_DATA_DRIVER : process.env.NEXT_PUBLIC_DATA_DRIVER) ?? '').trim() === HUB_DATA_DRIVER;

/** The repository root: the nearest folder above the server's working folder that holds apps/ and packages/. */
function repositoryRoot(start = process.cwd()): string {
  let dir = resolve(/*turbopackIgnore: true*/ start);
  for (;;) {
    // turbopackIgnore: these paths are found at run time on the hub laptop, not bundled.
    if (existsSync(join(/*turbopackIgnore: true*/ dir, 'apps')) && existsSync(join(/*turbopackIgnore: true*/ dir, 'packages'))) return dir;
    const up = dirname(dir);
    if (up === dir) return resolve(/*turbopackIgnore: true*/ start);
    dir = up;
  }
}

/** The folder that holds the vault, its ballot secret and the check photos. */
export const hubDataDir = (env: Env = process.env): string =>
  env.HUB_VAULT_DIR?.trim() ? resolve(/*turbopackIgnore: true*/ env.HUB_VAULT_DIR.trim()) : dirname(join(/*turbopackIgnore: true*/ repositoryRoot(), HUB_VAULT_RELATIVE_PATH));

/** The vault file's full path. */
export const hubVaultPath = (env: Env = process.env): string => join(/*turbopackIgnore: true*/ hubDataDir(env), HUB_VAULT_FILE);

/** The ballot secret, made once and kept beside the vault so every session hashes ballots the same way. */
function ballotSecret(dir: string): string {
  const file = join(/*turbopackIgnore: true*/ dir, 'hub-ballot-secret.txt');
  if (existsSync(file)) {
    const kept = readFileSync(file, 'utf8').trim();
    if (kept) return kept;
  }
  const secret = randomBytes(32).toString('hex');
  writeFileSync(file, `${secret}\n`, { mode: 0o600 });
  return secret;
}

let opened: { dir: string; service: SqliteDataService; ready: Promise<void> } | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Runs `task` after every call before it has finished, so the vault sees one call at a time. */
export function onHub<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/** The vault's data service, opened (and on first use created and seeded) once per process. */
export async function hubService(env: Env = process.env): Promise<SqliteDataService> {
  const dir = hubDataDir(env);
  if (!opened || opened.dir !== dir) {
    mkdirSync(dir, { recursive: true });
    const vaultPath = join(/*turbopackIgnore: true*/ dir, HUB_VAULT_FILE);
    const fresh = !existsSync(vaultPath);
    const council = fresh ? pilotSyncCouncil(env) : null;
    const service = new SqliteDataService({
      sqlite: createNodeSqlite(dir) as unknown as SqliteModule,
      persistent: true,
      presentationData: true,
      ballotSecret: ballotSecret(dir),
      sendEmail: deliverServerEmail,
      log: () => {},
    });
    const open = async () => {
      await service.init();
      if (council === null) return;
      try {
        const receipt = await syncVaultFromCentral(dir, vaultPath, council, env);
        console.info(
          `[hub] synced council ${receipt.councilNumber} from the simulated central database: ${receipt.members.added + receipt.members.updated} members, ` +
            `${receipt.eventHours.added + receipt.eventHours.updated + receipt.activityHours.added + receipt.activityHours.updated} hour entries, ${receipt.councilSettings.length} switches.`,
        );
      } catch (err) {
        // The vault still opens with its seed; the launcher reports that no receipt was written.
        console.warn(`[hub] the central sync handshake for council ${council} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    opened = { dir, service, ready: onHub(open) };
  }
  const current = opened;
  try {
    await current.ready;
  } catch (err) {
    if (opened === current) opened = null; // let the next call try again, e.g. after the vault file was fixed
    throw err;
  }
  return current.service;
}

/** The vault as a DataService whose every method call waits its turn (onHub). */
export async function serializedHub(env: Env = process.env): Promise<DataService> {
  const service = await hubService(env);
  return new Proxy(service as DataService, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'object' || value === null || Object.getPrototypeOf(value) !== Object.prototype) return value;
      return new Proxy(value as Record<string, unknown>, {
        get(ns, method, nsReceiver) {
          const fn = Reflect.get(ns, method, nsReceiver);
          if (typeof fn !== 'function') return fn;
          return (...args: unknown[]) => onHub(() => (fn as (...a: unknown[]) => Promise<unknown>).apply(ns, args));
        },
      });
    },
  });
}

/**
 * Runs one device call on the vault. Only the service's own namespaces and their own methods are reachable, so a
 * call cannot reach the service's internals (open, reset) or anything inherited. INVALID_INPUT-style Error for the rest.
 */
export async function callHub(call: HubCall, env: Env = process.env): Promise<unknown> {
  const service = await hubService(env);
  if (call.method === 'init') return undefined;
  if (!isHubMethodName(call.method)) throw new Error(`"${call.method}" is not a hub method.`);
  const [ns, method] = call.method.split('.') as [string, string];
  const namespace = Object.prototype.hasOwnProperty.call(service, ns) ? (service as unknown as Record<string, unknown>)[ns] : undefined;
  const fn =
    typeof namespace === 'object' && namespace !== null && Object.prototype.hasOwnProperty.call(namespace, method)
      ? (namespace as Record<string, unknown>)[method]
      : undefined;
  if (typeof fn !== 'function') throw new Error(`The hub has no method "${call.method}".`);
  return onHub(() => (fn as (...a: unknown[]) => Promise<unknown>).apply(namespace, call.args));
}
