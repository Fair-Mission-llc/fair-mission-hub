// Sprint 11 Revision 13.0 (schema stays 110): the room pilot hub pulls its council's live slice - roster, logged hours,
// module switches and parent organization - from the simulated central database when it creates a new vault, and the
// screens read those synced rows (feature switches, the KofC / secular split, the leaderboard behind the merit badges).
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CENTRAL_VAULT_FILE,
  cleanPilotSyncCouncil,
  councilFeatureFlags,
  councilTenantType,
  DEFAULT_PILOT_SYNC_COUNCIL,
  isPilotSyncedCouncilColumn,
  PILOT_PERSONA_EMAILS,
  PILOT_SYNC_RECEIPT_FILE,
  PLATFORM_SCHEMA_VERSION,
  type PilotSyncReceipt,
} from '@kofc/shared';
import { ensureSimulatedCentral, pilotSyncCouncil, readSyncReceipt } from '../apps/web/services/server/hub/central-sync';
import { hubService } from '../apps/web/services/server/hub/hub-vault';
import { HUB_VAULT_FILE } from '../apps/web/services/server/hub/node-sqlite';
import { PILOT_PERSONA_EMAILS as PHONE_PERSONAS } from '../apps/mobile/services/onboarding';
import { MEMBER } from './helpers';

const read = (path: string) => readFileSync(path, 'utf8');
const removeQuietly = (dir: string) => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // a connection may still hold the file on Windows
  }
};

const NEW_MEMBER_ID = 9001;
const NEW_HOURS_ID = 90001;

describe('1. the handshake rules', () => {
  it('keeps schema 110 and names its files and switch', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(110);
    expect(CENTRAL_VAULT_FILE).toBe('simulated-central.db');
    expect(PILOT_SYNC_RECEIPT_FILE).toBe('hub-sync-receipt.json');
    expect(DEFAULT_PILOT_SYNC_COUNCIL).toBe(15295);
    expect(pilotSyncCouncil({ PILOT_SYNC_COUNCIL: '15295' })).toBe(15295);
    expect(pilotSyncCouncil({})).toBeNull();
    expect(cleanPilotSyncCouncil('abc')).toBeNull();
    expect(cleanPilotSyncCouncil(-4)).toBeNull();
  });

  it('copies the module switches and the tenant settings, nothing else of the Council row', () => {
    for (const c of ['flag_mobile_elections', 'feature_photo_gallery', 'parent_organization', 'tenant_type']) expect(isPilotSyncedCouncilColumn(c)).toBe(true);
    for (const c of ['CouncilName', 'base_dues_rate', 'ein_number']) expect(isPilotSyncedCouncilColumn(c)).toBe(false);
  });

  it('shares one persona list between the phone and the hub', () => {
    expect(PHONE_PERSONAS).toBe(PILOT_PERSONA_EMAILS);
    expect(PILOT_PERSONA_EMAILS).toHaveLength(7);
  });
});

describe('2. a new vault pulls its council from the simulated central database', () => {
  let central: string;
  let vaultDir: string;
  let receipt: PilotSyncReceipt;
  const env = () => ({ HUB_VAULT_DIR: vaultDir, PILOT_CENTRAL_DIR: central, PILOT_SYNC_COUNCIL: '15295' });

  beforeAll(async () => {
    central = mkdtempSync(join(tmpdir(), 'kofc-central-'));
    vaultDir = mkdtempSync(join(tmpdir(), 'kofc-hub-synced-'));
    // The "production" side changes after the seed: a new brother with logged hours, a premium switch turned on, a
    // persona's name edited, and the council moved to a secular parent organization.
    const path = await ensureSimulatedCentral(central);
    const db = new DatabaseSync(path);
    const council = db.prepare('SELECT id FROM Council WHERE CouncilNumber = 15295').get() as { id: number };
    const template = db.prepare("SELECT * FROM Member WHERE CouncilID = ? AND Email NOT LIKE '%@stmarys.org' ORDER BY id LIMIT 1").get(council.id) as Record<string, unknown>;
    const cols = Object.keys(template);
    const row = { ...template, id: NEW_MEMBER_ID, Email: 'live.sync@example.org', MemberFirstName: 'Live', MemberLastName: 'Synced' };
    db.prepare(`INSERT INTO Member (${cols.map((c) => `[${c}]`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...(cols.map((c) => row[c as keyof typeof row]) as never[]));
    const activity = db.prepare('SELECT id FROM Activities WHERE CouncilID = ? ORDER BY id LIMIT 1').get(council.id) as { id: number };
    const today = new Date().toISOString().slice(0, 10);
    db.prepare('INSERT INTO ActivityTime (id, MemberID, ActivityID, ActivityDate, Hours, ActivityNotes) VALUES (?, ?, ?, ?, ?, ?)').run(NEW_HOURS_ID, NEW_MEMBER_ID, activity.id, today, 500, 'synced');
    db.prepare("UPDATE Council SET feature_photo_gallery = 1, parent_organization = 'SECULAR_CHARITY', tenant_type = 'GENERIC' WHERE id = ?").run(council.id);
    db.prepare("UPDATE Member SET MemberLastName = 'EditedCentrally' WHERE Email = 'gk_user@stmarys.org'").run();
    db.close();

    await hubService(env());
    receipt = readSyncReceipt(vaultDir)!;
  });
  afterAll(() => {
    removeQuietly(vaultDir);
    removeQuietly(central);
  });

  it('writes a receipt beside the vault', () => {
    expect(existsSync(join(vaultDir, HUB_VAULT_FILE))).toBe(true);
    expect(existsSync(join(central, CENTRAL_VAULT_FILE))).toBe(true);
    expect(receipt).toMatchObject({ councilNumber: 15295, councilName: "St. Mary's Cathedral Council", personasKept: 7 });
    expect(receipt.members.added).toBe(1);
    expect(receipt.members.updated).toBeGreaterThan(0);
    expect(receipt.activityHours.added).toBe(1);
    expect(receipt.councilSettings).toEqual(expect.arrayContaining(['feature_photo_gallery', 'parent_organization', 'tenant_type']));
  });

  it('brings in the new brother and his hours, and leaves the pilot personas as the seed made them', async () => {
    const db = await hubService(env());
    const added = await db.members.getByEmail('live.sync@example.org');
    expect(added).toMatchObject({ id: NEW_MEMBER_ID, MemberLastName: 'Synced' });
    expect((await db.members.getByEmail('gk_user@stmarys.org'))?.MemberLastName).not.toBe('EditedCentrally');
    const vault = new DatabaseSync(join(vaultDir, HUB_VAULT_FILE), { readOnly: true });
    expect(vault.prepare('SELECT Hours FROM ActivityTime WHERE id = ?').get(NEW_HOURS_ID)).toEqual({ Hours: 500 });
    vault.close();
  });

  it('drives the feature switches and the secular split from the synced Council row', async () => {
    const db = await hubService(env());
    const council = await db.councils.get(1);
    expect(councilFeatureFlags(council).feature_photo_gallery).toBe(true);
    expect(councilTenantType(council)).toBe('GENERIC'); // Form 1728 popups hidden, corporate matrices shown
  });

  it('ranks the synced hours on the leaderboard behind the merit badges', async () => {
    const db = await hubService(env());
    const now = new Date();
    const card = await db.reports.councilEngagement(MEMBER.superAdmin, 1, now.getFullYear(), now.getMonth() + 1);
    expect(card.leaderboard[0]).toMatchObject({ memberId: NEW_MEMBER_ID });
  });
});

describe('3. an existing vault is never synced over', () => {
  let central: string;
  let vaultDir: string;
  let other: string;
  beforeAll(() => {
    central = mkdtempSync(join(tmpdir(), 'kofc-central-'));
    vaultDir = mkdtempSync(join(tmpdir(), 'kofc-hub-kept-'));
    other = mkdtempSync(join(tmpdir(), 'kofc-hub-other-'));
  });
  afterAll(() => {
    for (const d of [vaultDir, other, central]) removeQuietly(d);
  });

  it('opens an existing vault as it is, with no receipt and no central file', async () => {
    await hubService({ HUB_VAULT_DIR: vaultDir }); // made with no council named: the seed only
    await hubService({ HUB_VAULT_DIR: other }); // switch away so the next call reopens the first folder
    await hubService({ HUB_VAULT_DIR: vaultDir, PILOT_CENTRAL_DIR: central, PILOT_SYNC_COUNCIL: '15295' });
    expect(readSyncReceipt(vaultDir)).toBeNull();
    expect(existsSync(join(central, CENTRAL_VAULT_FILE))).toBe(false);
  });
});

describe('4. the launcher and the archive', () => {
  it('dev:pilot names the council, calls the handshake and prints the receipt', () => {
    const launcher = read('scripts/start-pilot.mjs');
    expect(launcher).toContain("let council = '15295';");
    expect(launcher).toContain("PILOT_SYNC_COUNCIL: council");
    expect(launcher).toContain('/api/sync/replicate?handshake=1');
    expect(launcher).toContain('--no-sync');
    expect(launcher).toContain('[pilot] Live data: council');
  });

  it('the hub route opens the vault on handshake and reports the receipt', () => {
    const route = read('apps/web/app/api/sync/replicate/route.ts');
    expect(route).toContain("searchParams.get('handshake') === '1'");
    expect(route).toContain('sync: hub ? readSyncReceipt(hubDataDir()) : null');
  });

  it('hub:archive moves the receipt with its vault and keeps the central file', () => {
    const archive = read('scripts/hub-archive.mjs');
    expect(archive).toContain("'hub-sync-receipt.json'");
    expect(archive).not.toContain("'simulated-central.db'");
  });
});
