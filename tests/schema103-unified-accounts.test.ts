// Sprint 11 Revision 2.1 (schema 103): one accounts ledger. AccountOwners is merged into GLAccount; payment methods link
// to a money account (account_id) and take its COUNCIL / PARISH owner, so a Parish account's gifts stay off the batch
// coder; a revenue split may send a share to an ACTIVE affiliate through a 'Due to Sister Council' clearing account
// in the council's own ledger, with nothing written to the other council. The sidebar's hidden strip keeps the legal tabs.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cleanOwnershipType,
  dueToSisterCouncilName,
  GL_ACCOUNT_REFERENCES,
  isCouncilAccount,
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

describe('schema 103: one accounts ledger', () => {
  it('drops AccountOwners and puts its columns and the binary owner on GLAccount', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(106); // Sprint 11 Revision 7.0 moved the platform to schema 106.
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toContain('const SCHEMA_VERSION = 106;');
    expect(TABLES.AccountOwners).toBeUndefined();
    const gl = TABLES.GLAccount.columns;
    expect(gl.map((c) => c.name)).toEqual(
      expect.arrayContaining(['account_display_name', 'contact_name', 'contact_number', 'contact_email', 'ein_number', 'ownership_type', 'due_to_council_id']),
    );
    expect(gl.find((c) => c.name === 'ownership_type')).toMatchObject({ notNull: true, allowed: ['INTERNAL_OPERATING', 'PARENT_ORGANIZATION', 'AFFILIATED_ENTITY'] });
    expect(TABLES.GLAccount.foreignKeys).toContainEqual({ column: 'due_to_council_id', refTable: 'Council', refColumn: 'id' });
    const methods = TABLES.CouncilDonationMethod;
    expect(methods.columns.map((c) => c.name)).not.toContain('account_owner_id');
    expect(methods.foreignKeys).toContainEqual({ column: 'account_id', refTable: 'GLAccount', refColumn: 'id' });
  });

  it('lists every column that points at a GLAccount, so no account delete can orphan a row', () => {
    const fromSchema = Object.entries(TABLES).flatMap(([table, meta]) =>
      meta.foreignKeys.filter((fk) => fk.refTable === 'GLAccount').map((fk) => `${table}.${fk.column}`),
    );
    expect(GL_ACCOUNT_REFERENCES.map((r) => `${r.table}.${r.column}`).sort()).toEqual(fromSchema.sort());
  });

  it('holds ownership to the three universal classifications and lets a linked account decide a method owner', () => {
    expect(cleanOwnershipType('PARENT_ORGANIZATION')).toBe('PARENT_ORGANIZATION');
    for (const bad of ['COUNCIL', 'PARISH', 'THIRD_PARTY', 'parent_organization', '', null, undefined]) expect(() => cleanOwnershipType(bad), String(bad)).toThrow();
    expect(paymentMethodOwner({ account_owner_entity: 'COUNCIL' }, { ownership_type: 'PARENT_ORGANIZATION' })).toBe('PARISH');
    expect(paymentMethodOwner({ account_owner_entity: 'THIRD_PARTY' }, null)).toBe('THIRD_PARTY');
    expect(isCouncilAccount({ AccountType: 'Asset', IsVirtualGoal: 0, due_to_council_id: null })).toBe(true);
    expect(isCouncilAccount({ AccountType: 'Asset', IsVirtualGoal: 1, due_to_council_id: null })).toBe(false);
    expect(isCouncilAccount({ AccountType: 'Revenue', IsVirtualGoal: 0, due_to_council_id: null })).toBe(false);
    expect(dueToSisterCouncilName({ CouncilNumber: 3311 })).toBe('Due to Sister Council - Council 3311');
  });

  it('teaches the generator DROP TABLE and leaves no AccountOwners code behind', () => {
    expect(read('Schema.sql')).toContain('DROP TABLE [AccountOwners];');
    expect(read('scripts/gen-db-assets.mjs')).toContain('DROP TABLE');
    for (const file of ['apps/web/services/drivers/memory.ts', 'apps/mobile/services/drivers/sqlite.ts', 'apps/web/components/modules/CouncilLookupTables.tsx']) {
      expect(read(file), file).not.toMatch(/\[AccountOwners\]|rows\('AccountOwners'\)|listAccountOwners/);
    }
    expect(read('apps/web/components/modules/CouncilLookupTables.tsx')).toContain('db.councils.listCouncilAccounts(');
  });

  it('keeps the arrows and puts the legal documents on the hidden strip as vertical tabs', () => {
    const sidebar = read('apps/web/components/Sidebar.tsx');
    expect(sidebar).not.toContain('M4 6h16M4 12h16M4 18h16');
    expect(sidebar).toContain('{collapsed ? SIDEBAR_SHOW_GLYPH : SIDEBAR_HIDE_GLYPH}');
    expect(sidebar).toContain('<ul aria-label="Legal documents"');
    expect(sidebar).toContain('[writing-mode:vertical-rl]');
  });
});

describe.each(drivers)('$name driver: schema 103 accounts and sister-council shares', (d) => {
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

  it('turns a payment method parish-held when its account is a Parish account, and keeps those gifts off the batch coder', async () => {
    const db = await makePilot();
    const admin = await signIn(db, 'testsuperadmin@kofc.org');
    const treasurer = await signIn(db, 'treasurer_user@stmarys.org');
    const account = await db.councils.saveCouncilAccount(admin, OWN, { AccountName: 'Parish Venmo', ownership_type: 'PARENT_ORGANIZATION', contact_name: 'Parish Office' });
    expect(account).toMatchObject({ CouncilID: OWN, AccountType: 'Asset', ownership_type: 'PARENT_ORGANIZATION' });

    const venmo = (await db.donations.listMethods(OWN)).find((o) => o.method.DonationMethod === 'Venmo')!.method.id;
    const link = (await db.lookups.listCouncilSpecific(admin, OWN, 'CouncilDonationMethod')).find((l) => l.DonationMethodID === venmo)!;
    const [saved] = (
      await db.lookups.saveCouncilSpecific(admin, OWN, 'CouncilDonationMethod', [
        { id: link.id, DonationMethodID: venmo, DonationMethodURL: link.DonationMethodURL ?? null, account_owner_entity: 'COUNCIL', account_identity_label: '', lookup_status: 'Active', account_id: account.id },
      ])
    ).filter((r) => r.id === link.id);
    // The account's owner wins over the row's, and the name members see falls back to the account.
    expect(saved).toMatchObject({ account_id: account.id, account_owner_entity: 'PARISH', account_identity_label: 'Parish Venmo' });

    const typeId = (await db.donations.listTypes(OWN))[0]!.id;
    const gift = await db.donations.record(treasurer, { CouncilID: OWN, EventID: PARKING_EVENT, DonationMethodID: venmo, DonationTypeID: typeId, DonationAmount: 30 });
    expect(gift.historical_account_owner_entity).toBe('PARISH');
    const queue = await db.finance.getBatchCodingQueue(treasurer, OWN);
    expect(queue.rows.map((r) => r.donation.id)).not.toContain(gift.id);
    await expectRule(db.finance.batchCodeDonations(treasurer, OWN, { donationIds: [gift.id], revenueAccountId: queue.revenueAccounts[0]!.id }), 'INVALID_INPUT');

    // Moving the account back to the council moves the linked method with it (not the stored gift).
    await db.councils.saveCouncilAccount(admin, OWN, { id: account.id, AccountName: 'Parish Venmo', ownership_type: 'INTERNAL_OPERATING' });
    const relinked = (await db.lookups.listCouncilSpecific(admin, OWN, 'CouncilDonationMethod')).find((l) => l.id === link.id)!;
    expect(relinked.account_owner_entity).toBe('COUNCIL');
    // A linked account, or one with postings, cannot be deleted; nor can a non-money account through the matrix.
    await expectRule(db.councils.removeCouncilAccount(admin, OWN, account.id), 'RECORD_IN_USE');
    await expectRule(db.councils.removeCouncilAccount(admin, OWN, queue.revenueAccounts[0]!.id), 'RECORD_NOT_FOUND');
  });

  it("routes a split share to a 'Due to Sister Council' account in its own ledger, writing nothing to the sister council", async () => {
    const db = await makePilot();
    const superAdmin = await signIn(db, 'testsuperadmin@kofc.org');
    const treasurer = await signIn(db, 'treasurer_user@stmarys.org');
    const home = (await db.councils.get(OWN))!;
    // The pilot already has an affiliate; pick a same-state council that is not one yet.
    const already = new Set((await db.finance.listSplitSisterCouncils(treasurer, OWN)).map((c) => c.councilId));
    const sister = (await db.councils.list()).find((c) => c.id !== OWN && c.State === home.State && !already.has(c.id))!;
    expect(sister).toBeDefined();

    const queue = await db.finance.getBatchCodingQueue(treasurer, OWN);
    const split = queue.revenueAccounts[0]!;
    const local = queue.revenueAccounts.find((a) => a.id !== split.id)!;
    const share = { destinations: [{ destinationAccountId: local.id, percentage: 60 }, { destinationAccountId: 0, affiliatedCouncilId: sister.id, percentage: 40 }] };

    // Not yet an affiliate: refused, and no clearing account appears.
    await expectRule(db.finance.setGLSplitProfile(treasurer, OWN, split.id, share), 'INVALID_INPUT');
    expect((await db.finance.listSplitSisterCouncils(treasurer, OWN)).map((c) => c.councilId)).not.toContain(sister.id);

    const sent = await db.councils.requestAffiliation(superAdmin, OWN, sister.id);
    await db.councils.respondToAffiliation(superAdmin, sent.id, 'ACCEPT');
    const sisterChartBefore = JSON.stringify(await db.finance.listChartOfAccounts(superAdmin, sister.id));

    const profiles = await db.finance.setGLSplitProfile(treasurer, OWN, split.id, share);
    const sisterRow = (await db.finance.listSplitSisterCouncils(treasurer, OWN)).find((c) => c.councilId === sister.id);
    expect(sisterRow).toMatchObject({ councilId: sister.id, clearingAccountId: expect.any(Number) });
    const clearingId = sisterRow!.clearingAccountId!;
    expect(profiles.find((p) => p.accountId === split.id)!.destinations).toEqual([
      expect.objectContaining({ destinationAccountId: local.id, percentage: 60 }),
      expect.objectContaining({ destinationAccountId: clearingId, percentage: 40, destinationAccountName: dueToSisterCouncilName(sister) }),
    ]);
    const chart = await db.finance.listChartOfAccounts(superAdmin, OWN);
    const flat = JSON.stringify(chart);
    expect(flat).toContain(dueToSisterCouncilName(sister));

    // A posting to the split account credits the clearing liability with its share - in this council's books only.
    const lines = await db.finance.logDoubleEntryTransaction(superAdmin, [
      { GLAccountID: queue.depositAccount!.id, DebitAmount: 100, Description: 'Joint fish fry' },
      { GLAccountID: split.id, CreditAmount: 100, Description: 'Joint fish fry' },
    ]);
    expect(lines.filter((l) => l.CreditAmount > 0).map((l) => [l.GLAccountID, l.CreditAmount])).toEqual([
      [local.id, 60],
      [clearingId, 40],
    ]);
    expect(lines.every((l) => l.CouncilID === OWN)).toBe(true);
    expect(JSON.stringify(await db.finance.listChartOfAccounts(superAdmin, sister.id))).toBe(sisterChartBefore);

    // Saving again reuses the same clearing account.
    await db.finance.setGLSplitProfile(treasurer, OWN, split.id, share);
    expect((await db.finance.listSplitSisterCouncils(treasurer, OWN)).find((c) => c.councilId === sister.id)!.clearingAccountId).toBe(clearingId);
  });
});
