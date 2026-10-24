// Sprint 9 Revision 4.0: the pilot hub - one persistent vault on the hub laptop's disk that every device works on
// through /api/sync/replicate (hub-sync.ts, services/server/hub/*).
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertHubCallAllowed,
  BusinessRuleError,
  createHubDataService,
  decodeHubError,
  encodeHubError,
  HUB_ACTOR_FIRST_METHODS,
  HUB_PUBLIC_METHODS,
  HUB_VAULT_RELATIVE_PATH,
  SecurityPrivilegeError,
  toIsoDate,
  type HubCall,
} from '@kofc/shared';
import { SqliteDataService, type SqliteModule } from '../apps/mobile/services/drivers/sqlite';
import { createNodeSqlite, HUB_VAULT_FILE } from '../apps/web/services/server/hub/node-sqlite';
import { hubDataDir, hubModeOn } from '../apps/web/services/server/hub/hub-vault';
import { GET as replicateGet, POST as replicatePost } from '../apps/web/app/api/sync/replicate/route';
import { GET as photoGet, POST as photoPost } from '../apps/web/app/api/sync/photo/route';
import { GET as calendarGet } from '../apps/web/app/api/calendar/sync/route';
import { signCalendarToken } from '../apps/web/services/server/calendar-token';
import { calendarFeedSecret } from '../apps/web/services/server/secrets';
import { expectRule } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
/** Best effort: on Windows a vault file still open in this process cannot be deleted; the OS temp folder clears it later. */
const removeQuietly = (dir: string) => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // still open
  }
};
const NOW = () => new Date('2026-10-24T15:00:00Z');

/** Every DataService method whose first parameter is actorId, read from contract.ts. */
function actorFirstMethodsInContract(): string[] {
  const source = read('packages/shared/src/contract.ts');
  const body = source.slice(source.indexOf('export interface DataService'));
  const out: string[] = [];
  let ns: string | null = null;
  for (const line of body.split(/\r?\n/)) {
    let m: RegExpExecArray | null;
    if ((m = /^ {2}([a-zA-Z]+): \{$/.exec(line))) ns = m[1];
    else if (/^ {2}\};?$/.test(line)) ns = null;
    else if (/^\}/.test(line)) break;
    else if (ns && (m = /^ {4}([a-zA-Z]+)\(\s*actorId\b/.exec(line))) out.push(`${ns}.${m[1]}`);
  }
  return out.sort();
}

const vaultService = (dir: string) =>
  new SqliteDataService({ sqlite: createNodeSqlite(dir) as unknown as SqliteModule, persistent: true, ballotSecret: 'test-secret', now: NOW, log: () => {} });

describe('hub call rules', () => {
  it('knows every method that names its caller first', () => {
    expect([...HUB_ACTOR_FIRST_METHODS].sort()).toEqual(actorFirstMethodsInContract());
    expect(HUB_ACTOR_FIRST_METHODS.size).toBeGreaterThan(150);
  });

  it('lets only sign-in style calls through without a session, and only as the signed-in member after', () => {
    const me = { memberId: 3 };
    const call = (method: string, ...args: unknown[]): HubCall => ({ method, args });
    for (const method of HUB_PUBLIC_METHODS) expect(() => assertHubCallAllowed(call(method), null)).not.toThrow();
    expect(() => assertHubCallAllowed(call('donations.list', 1), null)).toThrow(expect.objectContaining({ code: 'HUB_SESSION_REQUIRED' }));
    expect(() => assertHubCallAllowed(call('donations.record', 3, {}), me)).not.toThrow();
    expect(() => assertHubCallAllowed(call('donations.record', 2, {}), me)).toThrow(expect.objectContaining({ code: 'HUB_IDENTITY_MISMATCH' }));
    expect(() => assertHubCallAllowed(call('eventTime.logHours', 2, 9, 4), me)).toThrow(expect.objectContaining({ code: 'HUB_IDENTITY_MISMATCH' }));
    expect(() => assertHubCallAllowed(call('messages.send', { senderId: 2, text: 'x' }), me)).toThrow(expect.objectContaining({ code: 'HUB_IDENTITY_MISMATCH' }));
    expect(() => assertHubCallAllowed(call('messages.setRead', 10, 2, true), me)).toThrow(expect.objectContaining({ code: 'HUB_IDENTITY_MISMATCH' }));
    // A read about someone else stays a read, judged inside the data service.
    expect(() => assertHubCallAllowed(call('events.listMemberShifts', 2), me)).not.toThrow();
    // A view-as session reads only.
    expect(() => assertHubCallAllowed(call('donations.list', 1), { memberId: 3, impersonatorId: 1 })).not.toThrow();
    expect(() => assertHubCallAllowed(call('donations.record', 3, {}), { memberId: 3, impersonatorId: 1 })).toThrow(
      expect.objectContaining({ code: 'VIEW_AS_READ_ONLY' }),
    );
    // Nothing but '<namespace>.<method>' is reachable.
    for (const method of ['reset', 'open', 'donations', '__proto__.x', 'donations.record.call', 'Donations.list']) {
      expect(() => assertHubCallAllowed(call(method), me)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    }
  });

  it('rebuilds business rule errors on the device', async () => {
    const back = decodeHubError(encodeHubError(new SecurityPrivilegeError('ADMIN_REQUIRED', 'no', { a: 1 })));
    expect(back).toBeInstanceOf(SecurityPrivilegeError);
    expect(back).toMatchObject({ code: 'ADMIN_REQUIRED', message: 'no', details: { a: 1 } });
    expect(decodeHubError(encodeHubError(new BusinessRuleError('INVALID_INPUT', 'bad', {})))).toBeInstanceOf(BusinessRuleError);
    // The device-side service is an ordinary DataService that forwards every call.
    const seen: HubCall[] = [];
    const db = createHubDataService(async (c) => {
      seen.push(c);
      if (c.method === 'init') return { ok: true, result: undefined };
      return c.method === 'donations.list' ? { ok: true, result: [{ id: 7 }] } : { ok: false, error: encodeHubError(new BusinessRuleError('RECORD_NOT_FOUND', 'gone', {})) };
    });
    expect(await db.donations.list(1)).toEqual([{ id: 7 }]);
    await expectRule(db.donations.remove(3, 9), 'RECORD_NOT_FOUND');
    await db.init();
    expect(seen.map((c) => c.method)).toEqual(['donations.list', 'donations.remove', 'init']);
  });
});

describe('the vault on disk', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'kofc-hub-vault-'));
  });
  afterAll(() => removeQuietly(dir));

  it('keeps every record across restarts and never wipes itself', async () => {
    const first = vaultService(dir);
    const typeId = (await first.donations.listTypes(1))[0].id;
    const check = (await first.donations.listMethods(1)).find((m) => m.kind === 'check')!;
    const gift = await first.donations.record(2, { CouncilID: 1, DonationMethodID: check.method.id, DonationTypeID: typeId, DonationAmount: 75, CheckNumber: '3301' });
    await first.donations.attachDepositPhoto(2, gift.id, '/api/sync/photo?name=deposit-2-1-abc.jpg');
    expect(existsSync(join(dir, HUB_VAULT_FILE))).toBe(true);
    await expect(first.reset()).rejects.toThrow(/never reset/);

    // A second process opening the same file - the next pilot session - sees it all.
    const second = vaultService(dir);
    expect((await second.donations.list(1)).find((d) => d.id === gift.id)).toMatchObject({ DonationAmount: 75, CheckNumber: '3301' });
    expect(await second.donations.listAttachments(2, gift.id)).toHaveLength(1);

    // A vault from another schema version is refused and left untouched, not rebuilt.
    const raw = new DatabaseSync(join(dir, HUB_VAULT_FILE));
    raw.exec('PRAGMA user_version = 97;');
    raw.close();
    await expect(vaultService(dir).init()).rejects.toThrow(/database version 97.*never wiped/);
    const check2 = new DatabaseSync(join(dir, HUB_VAULT_FILE));
    expect((check2.prepare('SELECT COUNT(*) AS n FROM [Donation] WHERE [id] = ?').get(gift.id) as { n: number }).n).toBe(1);
    check2.exec('PRAGMA user_version = 99;');
    check2.close();
  });

  it('refuses to delete the vault file', async () => {
    await expect(createNodeSqlite(dir).deleteDatabaseAsync('kofc.db')).rejects.toThrow(/never deletes central-hub-vault\.db/);
  });

  it('lives at packages/backend/data/central-hub-vault.db unless HUB_VAULT_DIR moves it', () => {
    expect(HUB_VAULT_RELATIVE_PATH).toBe('packages/backend/data/central-hub-vault.db');
    expect(hubDataDir({}).replace(/\\/g, '/')).toMatch(/packages\/backend\/data$/);
    expect(hubDataDir({ HUB_VAULT_DIR: dir })).toBe(dir);
    expect(read('.gitignore')).toContain('packages/backend/data/*');
  });
});

describe('/api/sync/replicate and /api/sync/photo', () => {
  let dir: string;
  const saved = { driver: process.env.NEXT_PUBLIC_DATA_DRIVER, vault: process.env.HUB_VAULT_DIR };
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'kofc-hub-route-'));
    process.env.NEXT_PUBLIC_DATA_DRIVER = 'hub';
    process.env.HUB_VAULT_DIR = dir;
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_DATA_DRIVER = saved.driver;
    process.env.HUB_VAULT_DIR = saved.vault;
    removeQuietly(dir);
  });

  const post = (call: HubCall, cookie?: string) =>
    replicatePost(new Request('http://hub/api/sync/replicate', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(call) }));

  it('signs a device in, runs its calls as that member only, and refuses the rest', async () => {
    expect(hubModeOn()).toBe(true);
    expect(await (await replicateGet()).json()).toMatchObject({ hub: true, schemaVersion: 99 });

    const signIn = await post({ method: 'auth.signIn', args: ['testmember@kofc.org', 'dev-pass-secure-9912'] });
    const cookie = signIn.headers.get('set-cookie')!.split(';')[0];
    const member = ((await signIn.json()) as { result: { memberId: number } }).result.memberId;
    expect(cookie).toMatch(/^kofc_portal_session=/);
    expect(((await (await post({ method: 'auth.signIn', args: ['testmember@kofc.org', 'wrong'] })).json()) as { result: unknown }).result).toBeNull();

    const typeId = ((await (await post({ method: 'donations.listTypes', args: [1] }, cookie)).json()) as { result: { id: number }[] }).result[0].id;
    const methods = ((await (await post({ method: 'donations.listMethods', args: [1] }, cookie)).json()) as { result: { kind: string; method: { id: number } }[] }).result;
    const cash = methods.find((m) => m.kind === 'cash')!;
    const gift = { CouncilID: 1, DonationMethodID: cash.method.id, DonationTypeID: typeId, DonationAmount: 20 };
    const recorded = await post({ method: 'donations.record', args: [member, gift] }, cookie);
    expect(recorded.status).toBe(200);
    expect(((await recorded.json()) as { ok: boolean; result: { RecordedBy: number } }).result.RecordedBy).toBe(member);

    expect((await post({ method: 'donations.record', args: [member + 1, gift] }, cookie)).status).toBe(403);
    expect((await post({ method: 'donations.list', args: [1] })).status).toBe(401);
    expect((await post({ method: 'reset', args: [] }, cookie)).status).toBe(400);
    // A business rule refusal is an ordinary answer the device rebuilds.
    const refused = (await (await post({ method: 'donations.attachDepositPhoto', args: [member, 99999, 'x'] }, cookie)).json()) as { ok: boolean; error: { code: string } };
    expect(refused).toMatchObject({ ok: false, error: { code: 'RECORD_NOT_FOUND' } });
  });

  it('keeps check photos beside the vault and serves them only to a signed-in device', async () => {
    const signIn = await post({ method: 'auth.signIn', args: ['testmember@kofc.org', 'dev-pass-secure-9912'] });
    const cookie = signIn.headers.get('set-cookie')!.split(';')[0];
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 0xff, 0xd9]);
    const upload = (headers: Record<string, string>) => photoPost(new Request('http://hub/api/sync/photo', { method: 'POST', headers, body: jpeg }));
    expect((await upload({ 'Content-Type': 'image/jpeg' })).status).toBe(401);
    expect((await upload({ 'Content-Type': 'text/plain', cookie })).status).toBe(415);
    const stored = await upload({ 'Content-Type': 'image/jpeg', cookie });
    expect(stored.status).toBe(201);
    const { path } = (await stored.json()) as { path: string };
    expect(path).toMatch(/^\/api\/sync\/photo\?name=deposit-3-\d+-[0-9a-f]{16}\.jpg$/);
    expect(existsSync(join(dir, 'photos', path.split('name=')[1]))).toBe(true);
    const back = await photoGet(new Request(`http://hub${path}`, { headers: { cookie } }));
    expect(back.status).toBe(200);
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(jpeg);
    expect((await photoGet(new Request(`http://hub${path}`))).status).toBe(401);
    expect((await photoGet(new Request('http://hub/api/sync/photo?name=..%2F..%2Fsecret.jpg', { headers: { cookie } }))).status).toBe(404);
  });

  it('builds the personal calendar feed from the vault file (Sprint 9 Revision 5.0)', async () => {
    // Another connection to the same file - as after a hub restart - adds a shift and signs the member up for it.
    const today = toIsoDate(new Date());
    const other = vaultService(dir);
    const event = await other.events.create(
      { EventName: 'Vault Walk-in Supper', EventDescription: '', OwnerID: 2, StartDate: today, EndDate: today, Location: 'Hall', CategoryID: 1 },
      [1],
    );
    const shift = await other.events.createShift({
      ShiftName: 'Serving line', ShiftDescription: '', ShiftDate: today, StartTime: '17:00:00', EndTime: '19:00:00', EventID: event.id, MinNumberVolunteers: 1,
    });
    await other.events.signupForShift(3, shift.id);

    const res = await calendarGet(new Request(`http://hub/api/calendar/sync?token=${await signCalendarToken(3, calendarFeedSecret())}`));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Vault Walk-in Supper');
    expect(read('apps/web/app/api/calendar/sync/route.ts')).toContain('memberDirectory');
  });

  it('answers 404 while the portal is not a hub build', async () => {
    process.env.NEXT_PUBLIC_DATA_DRIVER = 'memory';
    try {
      expect((await post({ method: 'donations.list', args: [1] })).status).toBe(404);
    } finally {
      process.env.NEXT_PUBLIC_DATA_DRIVER = 'hub';
    }
  });
});

describe('pilot hub wiring', () => {
  it('builds, serves and bundles the hub', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['build:pilot']).toBe('node scripts/build-pilot.mjs');
    expect(pkg.scripts['dev:mobile:pilot']).toBe('node scripts/start-mobile-pilot.mjs');
    expect(read('scripts/build-pilot.mjs')).toContain("NEXT_PUBLIC_DATA_DRIVER: 'hub'");
    expect(read('scripts/start-mobile-pilot.mjs')).toContain("EXPO_PUBLIC_DATA_DRIVER: 'hub'");
    expect(read('apps/web/next.config.ts')).toContain("'expo-sqlite': './services/server/hub/shims/expo-sqlite.ts'");
    expect(read('apps/web/services/db.ts')).toContain('createHubDataService(fetchHubTransport(\'\'))');
    expect(read('apps/mobile/services/db.ts')).toContain('createHubDataService(fetchHubTransport(HUB_URL))');
    // The vault file and its photos never go into git.
    expect(read('.gitignore')).toContain('!packages/backend/data/.gitkeep');
  });
});
