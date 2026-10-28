// Sprint 11 Revision 2.2 (schema 103, no version change): GLAccount.ownership_type holds three non-denominational
// tokens - INTERNAL_OPERATING (default), PARENT_ORGANIZATION and AFFILIATED_ENTITY. Both external tokens engage the shield
// (their gifts are recorded as PARISH / THIRD_PARTY and stay off the batch coder), the account keeps its own name, and
// the labels follow the tenant: Council / Parish / Affiliated Entity for a Knights of Columbus council.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_OWNERSHIP_TYPES,
  accountOwnershipLabel,
  accountOwnershipOf,
  cleanOwnershipType,
  DEFAULT_ACCOUNT_OWNERSHIP_TYPE,
  isParishHeldDonation,
  isShieldedOwnership,
  OWNERSHIP_OWNER_ENTITY,
  paymentMethodOwner,
  PLATFORM_SCHEMA_VERSION,
  type DataService,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
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

describe('Sprint 11 Revision 2.2: universal ownership classifications', () => {
  it('keeps schema 103 and holds GLAccount.ownership_type to the three tokens', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(107); // Sprint 11 Revision 8.0 moved the platform to schema 107.
    expect(ACCOUNT_OWNERSHIP_TYPES).toEqual(['INTERNAL_OPERATING', 'PARENT_ORGANIZATION', 'AFFILIATED_ENTITY']);
    expect(DEFAULT_ACCOUNT_OWNERSHIP_TYPE).toBe('INTERNAL_OPERATING');
    expect(TABLES.GLAccount.columns.find((c) => c.name === 'ownership_type')).toMatchObject({ notNull: true, allowed: [...ACCOUNT_OWNERSHIP_TYPES] });
    expect(read('Schema.sql')).toContain(
      "ALTER TABLE [GLAccount] ADD [ownership_type] VARCHAR(20) NOT NULL DEFAULT 'INTERNAL_OPERATING' CONSTRAINT [CK_GLAccount_ownership_type] CHECK ([ownership_type] IN ('INTERNAL_OPERATING', 'PARENT_ORGANIZATION', 'AFFILIATED_ENTITY'));",
    );
    for (const t of ACCOUNT_OWNERSHIP_TYPES) expect(cleanOwnershipType(t)).toBe(t);
    for (const bad of ['COUNCIL', 'PARISH', 'internal_operating', 'THIRD_PARTY']) expect(() => cleanOwnershipType(bad), bad).toThrow(/INTERNAL_OPERATING/);
    expect(accountOwnershipOf({ ownership_type: undefined })).toBe('INTERNAL_OPERATING');
  });

  it('shields both external classifications and maps each to a method owner', () => {
    expect(OWNERSHIP_OWNER_ENTITY).toEqual({ INTERNAL_OPERATING: 'COUNCIL', PARENT_ORGANIZATION: 'PARISH', AFFILIATED_ENTITY: 'THIRD_PARTY' });
    expect(ACCOUNT_OWNERSHIP_TYPES.filter(isShieldedOwnership)).toEqual(['PARENT_ORGANIZATION', 'AFFILIATED_ENTITY']);
    for (const t of ACCOUNT_OWNERSHIP_TYPES) {
      const owner = paymentMethodOwner({ account_owner_entity: 'COUNCIL' }, { ownership_type: t });
      expect(owner).toBe(OWNERSHIP_OWNER_ENTITY[t]);
      expect(isParishHeldDonation('qr', owner), t).toBe(isShieldedOwnership(t));
      expect(isParishHeldDonation('cash', owner), t).toBe(false);
    }
  });

  it('labels the tokens in the active tenant vocabulary', () => {
    expect(ACCOUNT_OWNERSHIP_TYPES.map((t) => accountOwnershipLabel(t, 'KOFC'))).toEqual(['Council', 'Parish', 'Affiliated Entity']);
    expect(ACCOUNT_OWNERSHIP_TYPES.map((t) => accountOwnershipLabel(t, 'GENERIC'))).toEqual(['Internal Operating', 'Parent Organization', 'Affiliated Entity']);
    expect(accountOwnershipLabel('PARENT_ORGANIZATION')).toBe('Parish');
    for (const file of ['apps/web/components/AccountOwnersMatrix.tsx', 'apps/web/components/modules/ChartOfAccountsSetup.tsx', 'apps/web/components/modules/CouncilLookupTables.tsx']) {
      const src = read(file);
      expect(src, file).toContain('useTenantType()');
      expect(src, file).toContain('accountOwnershipLabel(');
      expect(src, file).not.toMatch(/ownership_type === 'PARISH'|'COUNCIL' \| 'PARISH'/);
    }
  });

  it('rebuilds a phone database built under the old COUNCIL / PARISH check', () => {
    const src = read('apps/mobile/services/drivers/sqlite.ts');
    expect(src).toContain("SELECT [sql] FROM [sqlite_master] WHERE [type] = 'table' AND [name] = 'GLAccount'");
    expect(src).toContain('`\'${DEFAULT_ACCOUNT_OWNERSHIP_TYPE}\'`');
  });
});

describe.each(drivers)('$name driver: affiliated entity shield', (d) => {
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
  const signIn = async (db: DataService, email: string) => (await db.auth.signIn(email, PASSWORD))!.memberId;

  it('records an Affiliated Entity account as third-party held, keeps its name and keeps its gifts off the batch coder', async () => {
    const db = await makePilot();
    const admin = await signIn(db, 'testsuperadmin@kofc.org');
    const treasurer = await signIn(db, 'treasurer_user@stmarys.org');
    const account = await db.councils.saveCouncilAccount(admin, OWN, {
      AccountName: 'Squires Circle Zelle',
      account_display_name: 'Columbian Squires Circle 5512',
      ownership_type: 'AFFILIATED_ENTITY',
    });
    expect(account).toMatchObject({ ownership_type: 'AFFILIATED_ENTITY', account_display_name: 'Columbian Squires Circle 5512' });
    expect((await db.councils.listCouncilAccounts(admin, OWN)).find((a) => a.id === account.id)?.ownership_type).toBe('AFFILIATED_ENTITY');
    await expectRule(db.councils.saveCouncilAccount(admin, OWN, { AccountName: 'Old token', ownership_type: 'PARISH' as never }), 'INVALID_INPUT');

    const venmo = (await db.donations.listMethods(OWN)).find((o) => o.method.DonationMethod === 'Venmo')!.method.id;
    const link = (await db.lookups.listCouncilSpecific(admin, OWN, 'CouncilDonationMethod')).find((l) => l.DonationMethodID === venmo)!;
    const [saved] = (
      await db.lookups.saveCouncilSpecific(admin, OWN, 'CouncilDonationMethod', [
        { id: link.id, DonationMethodID: venmo, DonationMethodURL: link.DonationMethodURL ?? null, account_owner_entity: 'COUNCIL', account_identity_label: '', lookup_status: 'Active', account_id: account.id },
      ])
    ).filter((r) => r.id === link.id);
    expect(saved).toMatchObject({ account_owner_entity: 'THIRD_PARTY', account_identity_label: 'Columbian Squires Circle 5512' });

    const typeId = (await db.donations.listTypes(OWN))[0]!.id;
    const gift = await db.donations.record(treasurer, { CouncilID: OWN, EventID: PARKING_EVENT, DonationMethodID: venmo, DonationTypeID: typeId, DonationAmount: 25 });
    expect(gift.historical_account_owner_entity).toBe('THIRD_PARTY');
    const queue = await db.finance.getBatchCodingQueue(treasurer, OWN);
    expect(queue.rows.map((r) => r.donation.id)).not.toContain(gift.id);
    await expectRule(db.finance.batchCodeDonations(treasurer, OWN, { donationIds: [gift.id], revenueAccountId: queue.revenueAccounts[0]!.id }), 'INVALID_INPUT');

    // Reclassifying to a parent organization keeps the method shielded under the parish owner.
    await db.councils.saveCouncilAccount(admin, OWN, { id: account.id, AccountName: 'Squires Circle Zelle', ownership_type: 'PARENT_ORGANIZATION' });
    expect((await db.lookups.listCouncilSpecific(admin, OWN, 'CouncilDonationMethod')).find((l) => l.id === link.id)!.account_owner_entity).toBe('PARISH');
  });
});
