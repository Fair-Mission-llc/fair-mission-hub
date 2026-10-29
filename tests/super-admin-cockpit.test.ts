// Sprint 8O: Super Admin cockpit and account ownership splits (schema 85) - the account_owner_entity gate on the payment
// method editor, parish-held gifts kept out of the batch coder (Sprint 10 Revision 3.2 removed the parish split console
// and its settlement credit), the Administrative Feedback Loops behind an ADMIN guard, and the platform owner's Platform Management.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_OWNER_ENTITIES,
  accountOwnerEntityOf,
  accountOwnerGateMessage,
  buildBatchCodingQueue,
  canOpenAdministrativeFeedback,
  cleanAccountOwnerEntity,
  dashboardTabsFor,
  isParishHeldDonation,
  isPlatformOwner,
  PLATFORM_OWNER_USERNAMES,
  portalAreas,
  SUPER_ADMIN_DESK_FOLDERS,
  SUPER_ADMIN_DESK_TITLE,
  type DataService,
  type Donation,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { drivers, expectRule } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const PASSWORD = 'dev-pass-secure-9912';
const OWN = 1;
const PARKING_EVENT = 9;
const PILOT_DAY = new Date(2026, 9, 12, 19, 0, 0);

describe('account ownership codes', () => {
  it('takes only COUNCIL, PARISH or THIRD_PARTY, named explicitly', () => {
    expect(ACCOUNT_OWNER_ENTITIES).toEqual(['COUNCIL', 'PARISH', 'THIRD_PARTY']);
    for (const owner of ACCOUNT_OWNER_ENTITIES) expect(cleanAccountOwnerEntity(owner)).toBe(owner);
    for (const bad of [undefined, null, '', 'council', 'CHURCH', 3]) {
      expect(() => cleanAccountOwnerEntity(bad), String(bad)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    }
    // A row stored before Sprint 8O reads as the column default.
    expect(accountOwnerEntityOf({})).toBe('COUNCIL');
    expect(accountOwnerEntityOf({ account_owner_entity: 'PARISH' })).toBe('PARISH');
  });

  it("holds the drawer's save while any row's owner is blank", () => {
    expect(accountOwnerGateMessage(['COUNCIL', 'PARISH'])).toBeNull();
    expect(accountOwnerGateMessage(['COUNCIL', ''])).toMatch(/Choose who owns the account/);
    expect(accountOwnerGateMessage([undefined])).not.toBeNull();
  });

  it('treats only electronic gifts through a parish- or third-party-owned account as held outside the council', () => {
    expect(isParishHeldDonation('qr', 'PARISH')).toBe(true);
    expect(isParishHeldDonation('card', 'PARISH')).toBe(true);
    expect(isParishHeldDonation('cash', 'PARISH')).toBe(false);
    expect(isParishHeldDonation('qr', 'COUNCIL')).toBe(false);
    expect(isParishHeldDonation('qr', 'THIRD_PARTY')).toBe(true);
    expect(isParishHeldDonation('cash', 'THIRD_PARTY')).toBe(false);
    expect(isParishHeldDonation('qr', undefined)).toBe(false);
  });
});

describe('parish-held gifts', () => {
  it('keeps parish-held gifts out of the batch coder', () => {
    const donation = (id: number): Donation =>
      ({ id, CouncilID: OWN, DonationDate: '2026-10-11', DonationAmount: 10, DonationMethodID: 5, DonationTypeID: 1 }) as Donation;
    const queue = buildBatchCodingQueue(
      OWN,
      [
        { donation: donation(1), methodName: 'Venmo', kind: 'qr', eventName: null, accountOwner: 'PARISH' },
        { donation: donation(2), methodName: 'Venmo', kind: 'qr', eventName: null, accountOwner: 'COUNCIL' },
        { donation: donation(3), methodName: 'Zelle', kind: 'qr', eventName: null },
      ],
      [],
    );
    expect(queue.rows.map((r) => r.donation.id)).toEqual([2, 3]);
  });
});

describe.each(drivers)('$name driver: account ownership splits', (d) => {
  async function makePilot(): Promise<DataService> {
    const now = () => new Date(PILOT_DAY);
    if (d.name === 'memory') {
      const db = new MemoryDataService({ now, presentationData: true });
      await db.init();
      return db;
    }
    openDatabases.length = 0;
    const db = new SqliteDataService({ now, presentationData: true });
    await db.init();
    return db;
  }
  const signIn = async (db: DataService, user: string) => (await db.auth.signIn(`${user}@stmarys.org`, PASSWORD))!.memberId;

  /** Records a Venmo gift for the parking event; it takes the owner snapshot of the moment (Sprint 8O Extension). */
  async function giveByVenmo(db: DataService, memberId: number, amount: number) {
    const methods = await db.donations.listMethods(OWN);
    const venmo = methods.find((o) => o.method.DonationMethod === 'Venmo')!.method.id;
    const typeId = (await db.donations.listTypes(OWN))[0]!.id;
    return db.donations.record(memberId, { CouncilID: OWN, EventID: PARKING_EVENT, DonationMethodID: venmo, DonationTypeID: typeId, DonationAmount: amount });
  }

  /** Sets the council's Venmo profile's owner, as the payment method editor saves it. */
  async function setVenmoOwner(db: DataService, actorId: number, owner: 'COUNCIL' | 'PARISH') {
    const methods = await db.donations.listMethods(OWN);
    const venmo = methods.find((o) => o.method.DonationMethod === 'Venmo')!;
    const links = await db.lookups.listCouncilSpecific(actorId, OWN, 'CouncilDonationMethod');
    const link = links.find((l) => l.DonationMethodID === venmo.method.id)!;
    await db.lookups.saveCouncilSpecific(actorId, OWN, 'CouncilDonationMethod', [
      { id: link.id, DonationMethodID: link.DonationMethodID, DonationMethodURL: link.DonationMethodURL ?? null, account_owner_entity: owner },
    ]);
  }

  /** Marks the council's Venmo profile as the parish's account, as the payment method editor saves it. */
  async function venmoToParish(db: DataService, actorId: number) {
    const methods = await db.donations.listMethods(OWN);
    const venmo = methods.find((o) => o.method.DonationMethod === 'Venmo')!;
    const links = await db.lookups.listCouncilSpecific(actorId, OWN, 'CouncilDonationMethod');
    const link = links.find((l) => l.DonationMethodID === venmo.method.id)!;
    await expectRule(
      db.lookups.saveCouncilSpecific(actorId, OWN, 'CouncilDonationMethod', [{ id: link.id, DonationMethodID: link.DonationMethodID, DonationMethodURL: link.DonationMethodURL ?? null }]),
      'INVALID_INPUT',
    );
    const saved = await db.lookups.saveCouncilSpecific(actorId, OWN, 'CouncilDonationMethod', [
      { id: link.id, DonationMethodID: link.DonationMethodID, DonationMethodURL: link.DonationMethodURL ?? null, account_owner_entity: 'PARISH' },
    ]);
    expect(saved.find((l) => l.id === link.id)?.account_owner_entity).toBe('PARISH');
    return venmo.method.id;
  }

  it('stores COUNCIL by default and refuses an unknown owner', async () => {
    const db = await makePilot();
    const treasurer = await signIn(db, 'treasurer_user');
    const links = await db.lookups.listCouncilSpecific(treasurer, OWN, 'CouncilDonationMethod');
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((l) => l.account_owner_entity === 'COUNCIL')).toBe(true);
    await expectRule(
      db.lookups.saveCouncilSpecific(treasurer, OWN, 'CouncilDonationMethod', [{ id: links[0]!.id, DonationMethodID: links[0]!.DonationMethodID, account_owner_entity: 'CHURCH' }]),
      'INVALID_INPUT',
    );
  });

  it('never offers or codes a parish-held donation in the batch coder', async () => {
    const db = await makePilot();
    const treasurer = await signIn(db, 'treasurer_user');
    const before = await db.finance.getBatchCodingQueue(treasurer, OWN);
    await venmoToParish(db, treasurer);
    const held = await giveByVenmo(db, treasurer, 40);

    // The Venmo gifts recorded before the switch keep their COUNCIL snapshot and stay in the coder.
    const after = await db.finance.getBatchCodingQueue(treasurer, OWN);
    expect(after.rows.map((r) => r.donation.id)).toEqual(before.rows.map((r) => r.donation.id));
    await expectRule(db.finance.batchCodeDonations(treasurer, OWN, { donationIds: [held.id], revenueAccountId: after.revenueAccounts[0]!.id }), 'INVALID_INPUT');
  });

  it('freezes the owner snapshot when the donation is recorded, so a later lookup change never rewrites it', async () => {
    const db = await makePilot();
    const treasurer = await signIn(db, 'treasurer_user');
    const asCouncil = await giveByVenmo(db, treasurer, 10);
    expect(asCouncil.historical_account_owner_entity).toBe('COUNCIL');
    await setVenmoOwner(db, treasurer, 'PARISH');
    const asParish = await giveByVenmo(db, treasurer, 20);
    expect(asParish.historical_account_owner_entity).toBe('PARISH');

    // Turning the method back to the council changes no stored snapshot.
    await setVenmoOwner(db, treasurer, 'COUNCIL');
    const history = await db.donations.listHistory(OWN, PARKING_EVENT);
    const owners = new Map(history.entries.map((r) => [r.donation.id, r.donation.historical_account_owner_entity]));
    expect(owners.get(asCouncil.id)).toBe('COUNCIL');
    expect(owners.get(asParish.id)).toBe('PARISH');

    // An edit that keeps the method keeps the snapshot; a move to another method stamps that method's owner now.
    const kept = await db.donations.update(treasurer, asParish.id, { DonationAmount: 25 });
    expect(kept.historical_account_owner_entity).toBe('PARISH');
    const zelle = (await db.donations.listMethods(OWN)).find((o) => o.method.DonationMethod === 'Zelle')!.method.id;
    const moved = await db.donations.update(treasurer, asParish.id, { DonationMethodID: zelle });
    expect(moved.historical_account_owner_entity).toBe('COUNCIL');
    // The owner is never taken from the caller.
    await expectRule(db.donations.update(treasurer, asCouncil.id, { historical_account_owner_entity: 'PARISH' } as never), 'INVALID_INPUT');
  });
});

describe('Administrative Feedback Loops', () => {
  const actor = (memberType: string, extra: Record<string, unknown> = {}) =>
    ({ memberId: 5, councilId: OWN, memberType, isOfficer: false, roles: [], ...extra }) as Parameters<typeof portalAreas>[0];

  it('opens the page to Admin clearance and above only', () => {
    expect(canOpenAdministrativeFeedback(actor('Admin'))).toBe(true);
    expect(canOpenAdministrativeFeedback(actor('Super Admin'))).toBe(true);
    expect(canOpenAdministrativeFeedback(actor('Member'))).toBe(false);
    expect(canOpenAdministrativeFeedback(actor('Member', { isOfficer: true, roles: ['Grand Knight'] }))).toBe(false);
    expect(portalAreas(actor('Admin'))).toContain('system-settings/feedback');
    expect(portalAreas(actor('Member'))).not.toContain('system-settings/feedback');
  });

  it('strips the feedback form off the help center and guards the new page', () => {
    const help = read('apps/web/app/help/page.tsx');
    expect(help).not.toContain('db.feedback');
    expect(help).not.toContain('FeedbackForm');
    const page = read('apps/web/app/system-settings/feedback/page.tsx');
    expect(page).toContain('<RequireArea area="system-settings/feedback">');
    expect(page).toContain('AdminFeedbackForm');
    expect(read('apps/web/components/Sidebar.tsx')).toContain("label: 'Administrative Feedback Loops'");
    // No phone screen sends feedback.
    expect(read('apps/mobile/app/(app)/settings.tsx')).not.toContain('feedback.submit');
  });
});

describe('Platform Management', () => {
  const owner = { memberId: 1, councilId: OWN, memberType: 'Super Admin' as const, isOfficer: false, roles: [], username: PLATFORM_OWNER_USERNAMES[0]! };

  it("mounts only for the platform owner's own Super Admin session", () => {
    expect(isPlatformOwner(owner)).toBe(true);
    // Sprint 8O Extension: the developer's own local sign-in, while it is a Super Admin.
    expect(PLATFORM_OWNER_USERNAMES).toContain('tim');
    expect(isPlatformOwner({ ...owner, username: 'tim' })).toBe(true);
    expect(isPlatformOwner({ ...owner, username: 'tim', memberType: 'Admin' })).toBe(false);
    expect(isPlatformOwner({ ...owner, username: 'timothy' })).toBe(false);
    expect(isPlatformOwner({ ...owner, username: owner.username.toUpperCase() })).toBe(true);
    expect(isPlatformOwner({ ...owner, username: 'another.super@kofc.org' })).toBe(false);
    expect(isPlatformOwner({ ...owner, memberType: 'Admin' })).toBe(false);
    expect(isPlatformOwner({ ...owner, username: undefined })).toBe(false);
    expect(dashboardTabsFor(owner, OWN)[1]).toMatchObject({ id: 'super-admin', label: SUPER_ADMIN_DESK_TITLE });
    expect(dashboardTabsFor({ ...owner, username: 'another.super@kofc.org' }, OWN).map((t) => t.id)).not.toContain('super-admin');
  });

  it('holds the three top horizontal action folders', () => {
    expect(SUPER_ADMIN_DESK_TITLE).toBe('Platform Management');
    expect(SUPER_ADMIN_DESK_FOLDERS.map((f) => f.label)).toEqual([
      '[ 📥 Feedback Communication Center ]',
      '[ 🔑 Council Access Request Approval Queue ]',
      '[ 🛠️ System Feature Flag Control Panel ]',
    ]);
    const desk = read('apps/web/components/SuperAdminDesk.tsx');
    expect(desk).toContain('isPlatformOwner(user)');
    for (const part of ['<FeedbackInbox', '<InboundMailCenter', '<FeatureFlagControlPanel']) expect(desk).toContain(part);
    expect(read('apps/web/app/dashboard/page.tsx')).toContain("shown === 'super-admin'");
  });
});

describe('Sprint 8O: schema 85 and the split console', () => {
  it('bumps the phone database to 86 and records both releases', () => {
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (8[6-9]|9\d|\d{3});/);
    expect(read('Schema.sql')).toContain('(schema version 86)');
    expect(read('Schema.sql')).toContain("ALTER TABLE [Donation] ADD [historical_account_owner_entity] VARCHAR(20) NOT NULL DEFAULT 'COUNCIL'");
    const schema = read('Schema.sql');
    expect(schema).toContain('(schema version 85)');
    expect(schema).toContain("ALTER TABLE [CouncilDonationMethod] ADD [account_owner_entity] VARCHAR(20) NOT NULL DEFAULT 'COUNCIL'");
    expect(schema).toContain("CHECK ([account_owner_entity] IN ('COUNCIL', 'PARISH', 'THIRD_PARTY'))");
    expect(schema).toContain("ALTER TABLE [ParishDisbursementRequest] ADD [settlement_method] VARCHAR(20) NOT NULL DEFAULT 'CHECK'");
  });

  it('keeps the account owner gate after the parish split console was removed (Sprint 10 Revision 3.2)', () => {
    expect(existsSync(join(__dirname, '..', 'apps/web/components/ParishSplitParts.tsx'))).toBe(false);
    expect(read('apps/web/components/modules/CouncilLookupTables.tsx')).toContain('accountOwnerGateMessage');
  });
});
