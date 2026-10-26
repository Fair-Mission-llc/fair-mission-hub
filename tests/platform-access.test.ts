// Sprint 7F (Schema 65): council access requests from the sign-in page, CHECK payments in the ledger, asset photos,
// the Super Admin's read-only impersonation and the Co-Watching Remote Assistance desk.
// Sprint 7F Extension (Schema 66): payment methods bound to the DonationMethod lookup by foreign key.
// Sprint 7F Extension 2 (Schema 67): asset photos filed in Google Drive under Assets / <asset name>, the Deputy Grand
// Knight as a full asset manager, and check numbers on Check donations (Donation.CheckNumber), web and phone.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ACCESS_REQUEST_LINK_LABEL,
  DESK_DRAWERS,
  ACCESS_REQUEST_NOTIFY_EMAIL,
  accessRequestEmail,
  assertAccessRequestTransition,
  assertMayImpersonate,
  BusinessRuleError,
  canOpenRemoteAssistanceDesk,
  cleanAccessRequest,
  assetDriveFolderName,
  assertDonationFitsMethod,
  canAttachAssetPhoto,
  canManageCouncilAssets,
  cleanAssetPhotoUrl,
  DONATION_EDITABLE_COLUMNS,
  driveThumbnailUrl,
  driveVaultFolderPath,
  cleanAssetRecordChanges,
  cleanJournalPayment,
  donationFundsBucket,
  donationMethodKind,
  guardViewAsWrites,
  isViewAsReadMethod,
  journalPaymentOptions,
  mayAttachAssetPhoto,
  mayImpersonateMember,
  mayManageCouncilAssets,
  mayRequestRemoteAssistance,
  mayWatchRemoteAssistance,
  portalAreas,
  sanitizeAssistSnapshot,
  sortAccessRequests,
  type MemberWriteActor,
  type SendGridMailRequest,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { photoSrc } from '../apps/web/lib/media';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { SCHEMA_STATEMENTS } from '../apps/mobile/services/generated/schema.sqlite';
import {
  cleanAssistSnapshot,
  closeAssistRequest,
  getAssistRequest,
  listAssistRequests,
  openAssistRequest,
  resetAssistRequests,
  updateAssistSnapshot,
} from '../apps/web/services/server/assist';
import { impersonationClaimsFor, IMPERSONATOR_COOKIE, sessionClaimsFor, sessionCookieHeader, signSessionToken, verifySessionToken } from '../apps/web/services/server/session-token';
import { drivers, expectRule, MEMBER, NOW } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const PARKING_FUNDRAISING = 8; // a Revenue account

const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({ memberId: 9, councilId: OWN, memberType: 'Member', active: true, roles: [], ...over });
const superAdmin = actor({ memberId: 1, memberType: 'Super Admin' });
const admin = actor({ memberId: 2, memberType: 'Admin' });
const officer = actor({ memberId: 5, officer: true, roles: ['Recorder'] });
const member = actor();
const request = { council_name: 'Council 9999 St. Joseph', contact_email: 'gk@stjoseph.org', city: 'Tacoma', state: 'WA' };

describe('Schema 65', () => {
  it('adds the asset photo, the payment method CHECK list and the access requests table, and bumps the phone version', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('Sprint 7F: ONBOARDING GATES, CHECK PAYMENTS AND ASSET PHOTOS (schema version 65)');
    expect(schema).toContain(
      "ALTER TABLE [JournalEntry] ADD [payment_method] VARCHAR(10) NULL CONSTRAINT [CK_JournalEntry_payment_method] CHECK ([payment_method] IN ('CASH', 'CARD', 'CHECK'));",
    );
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (6[5-9]|[7-9]\d|\d{3});/);
    expect(TABLES.CouncilAssetsInventory.columns.find((c) => c.name === 'photo_url')).toMatchObject({ kind: 'text', notNull: false });
    expect(TABLES.CouncilAccessRequests.columns.map((c) => c.name)).toEqual([
      'id',
      'council_name',
      'contact_email',
      'city',
      'state',
      'status',
      'submitted_at',
      'reviewed_by_id',
      'reviewed_at',
    ]);
    expect(TABLES.CouncilAccessRequests.columns.find((c) => c.name === 'status')).toMatchObject({ default: { kind: 'literal', value: 'PENDING' } });
  });
});

describe('Schema 66', () => {
  it('drops the CHECK text column and binds payments to the DonationMethod lookup by foreign key', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('Sprint 7F Extension: RELATIONAL PAYMENT METHODS AND SHARED ASSET PHOTOS (schema version 66)');
    expect(schema).toContain('ALTER TABLE [JournalEntry] DROP CONSTRAINT [CK_JournalEntry_payment_method];');
    expect(schema).toContain('ALTER TABLE [JournalEntry] DROP COLUMN [payment_method];');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (6[6-9]|[7-9]\d|\d{3});/);
    expect(TABLES.JournalEntry.columns.map((c) => c.name)).not.toContain('payment_method');
    expect(TABLES.JournalEntry.columns.find((c) => c.name === 'payment_method_id')).toMatchObject({ kind: 'int', notNull: false });
    expect(TABLES.JournalEntry.foreignKeys).toContainEqual({ column: 'payment_method_id', refTable: 'DonationMethod', refColumn: 'id' });
    const phone = SCHEMA_STATEMENTS.find((s) => s.startsWith('CREATE TABLE IF NOT EXISTS [JournalEntry]'))!;
    expect(phone).toContain('[payment_method_id] INTEGER');
    expect(phone).toContain('FOREIGN KEY ([payment_method_id]) REFERENCES [DonationMethod]([id])');
    expect(phone).not.toContain('CHECK');
    // The generator refuses to drop a column a CHECK still holds, as SQL Server does.
    expect(read('scripts/gen-db-assets.mjs')).toContain('still has a CHECK constraint; DROP CONSTRAINT it first');
  });

  it('refuses an unknown payment method id in the web mock store', async () => {
    const db = new MemoryDataService({ now: () => new Date(NOW) });
    await db.init();
    const line = { CouncilID: OWN, GLAccountID: 1, DateLogged: '2026-09-01 00:00:00', Description: 'x', TransactionID: 't' };
    expect(() => db.debugStore.insert('JournalEntry', { ...line, payment_method_id: 999 })).toThrow(/FOREIGN KEY constraint failed: JournalEntry.payment_method_id/);
    expect(db.debugStore.insert('JournalEntry', { ...line, payment_method_id: 3 }).payment_method_id).toBe(3);
  });

  it('offers every enabled money method, never Physical Items, and ties a check number to Check only', () => {
    const opt = (id: number, DonationMethod: string, kind: 'cash' | 'card' | 'check' | 'qr' | 'item') => ({ method: { id, DonationMethod }, kind });
    const options = [opt(8, 'Check', 'check'), opt(1, 'Cash', 'cash'), opt(2, 'Credit Card', 'card'), opt(3, 'Venmo', 'qr'), opt(4, 'Zelle', 'qr'), opt(5, 'Zeffy', 'qr'), opt(6, 'Parishsoft', 'qr'), opt(7, 'Physical Items', 'item')];
    expect(journalPaymentOptions(options).map((o) => o.method.DonationMethod)).toEqual(['Cash', 'Credit Card', 'Venmo', 'Zelle', 'Zeffy', 'Parishsoft', 'Check']);
    expect(cleanJournalPayment(4, null, options)).toEqual({ payment_method_id: 4, CheckNumber: null });
    expect(cleanJournalPayment(8, ' 77 ', options)).toEqual({ payment_method_id: 8, CheckNumber: '77' });
    expect(cleanJournalPayment(null, '', options)).toEqual({ payment_method_id: null, CheckNumber: null });
    expect(() => cleanJournalPayment(7, null, options)).toThrow(/not one this council has enabled/);
    expect(() => cleanJournalPayment(9, null, options)).toThrow(/not one this council has enabled/);
    expect(() => cleanJournalPayment(8, null, options)).toThrow(/check number/);
    expect(() => cleanJournalPayment(3, '77', options)).toThrow(/Only a payment by check/);
    expect(() => cleanJournalPayment(null, '77', options)).toThrow(/Choose Check/);
  });

  it('adds Check as a donation method that feeds the cash column', () => {
    expect(read('Seed.sql')).toMatch(/\('Physical Items'\),\s*\('Check'\);/);
    expect(donationMethodKind('Check')).toBe('check');
    expect(donationFundsBucket('check')).toBe('cash');
  });
});

describe('council access requests (rules)', () => {
  it('cleans the four fields and refuses a missing field or a bad email', () => {
    expect(cleanAccessRequest({ ...request, city: '  Tacoma ' })).toEqual(request);
    expect(() => cleanAccessRequest({ ...request, contact_email: 'not-an-email' })).toThrow(/not an email/);
    expect(() => cleanAccessRequest({ ...request, council_name: ' ' })).toThrow(/Council name is required/);
    expect(() => cleanAccessRequest({ ...request, state: 'x'.repeat(51) })).toThrow();
  });

  it('emails the notice to the council mailbox and allows only PENDING -> APPROVED', () => {
    const email = accessRequestEmail({ id: 4, ...request, submitted_at: '2026-10-11 09:00:00' });
    expect(ACCESS_REQUEST_NOTIFY_EMAIL).toBe('council15295@stmarys.org');
    expect(email).toMatchObject({ to: 'council15295@stmarys.org', subject: 'New council access request: Council 9999 St. Joseph' });
    expect(email.text).toContain('Contact: gk@stjoseph.org');
    expect(assertAccessRequestTransition('PENDING', 'APPROVED')).toBe('APPROVED');
    expect(() => assertAccessRequestTransition('APPROVED', 'APPROVED')).toThrow(/cannot become/);
    expect(() => assertAccessRequestTransition('PENDING', 'REJECTED')).toThrow(/must be one of/);
  });

  it('lists pending requests first, newest first', () => {
    const rows = [
      { id: 1, status: 'APPROVED' as const, submitted_at: '2026-10-10 09:00:00' },
      { id: 2, status: 'PENDING' as const, submitted_at: '2026-10-09 09:00:00' },
      { id: 3, status: 'PENDING' as const, submitted_at: '2026-10-11 09:00:00' },
    ];
    expect(sortAccessRequests(rows).map((r) => r.id)).toEqual([3, 2, 1]);
  });
});

describe.each(drivers)('Sprint 7F ($name driver)', (d) => {
  it('stores an access request from anyone and lets only a Super Admin list and approve it', async () => {
    const db = await d.make();
    const saved = await db.accessRequests.submit(request);
    expect(saved).toMatchObject({ ...request, status: 'PENDING', reviewed_by_id: null });
    await expectRule(db.accessRequests.submit({ ...request, contact_email: 'nope' }), 'INVALID_INPUT');
    await expectRule(db.accessRequests.list(MEMBER.admin), 'SUPER_ADMIN_REQUIRED');
    await expectRule(db.accessRequests.setStatus(MEMBER.admin, saved.id, 'APPROVED'), 'SUPER_ADMIN_REQUIRED');
    expect(await db.accessRequests.list(MEMBER.superAdmin)).toHaveLength(1);

    const approved = await db.accessRequests.setStatus(MEMBER.superAdmin, saved.id, 'APPROVED');
    expect(approved).toMatchObject({ status: 'APPROVED', reviewed_by_id: MEMBER.superAdmin });
    await expectRule(db.accessRequests.setStatus(MEMBER.superAdmin, saved.id, 'APPROVED'), 'INVALID_INPUT');
    await expectRule(db.accessRequests.setStatus(MEMBER.superAdmin, 999, 'APPROVED'), 'RECORD_NOT_FOUND');
    expect(d.count(db, 'CouncilAccessRequests')).toBe(1);
  });

  it("builds a member's session for a Super Admin's view, and refuses anyone else or a Super Admin target", async () => {
    const db = await d.make();
    // Sprint 10 Revision 3.0: only a council Admin may be impersonated.
    const view = await db.auth.impersonate(MEMBER.superAdmin, MEMBER.admin);
    expect(view).toMatchObject({ memberId: MEMBER.admin, memberType: 'Admin' });
    await expectRule(db.auth.impersonate(MEMBER.superAdmin, MEMBER.member), 'IMPERSONATION_REFUSED');
    await expectRule(db.auth.impersonate(MEMBER.admin, MEMBER.member), 'SUPER_ADMIN_REQUIRED');
    await expectRule(db.auth.impersonate(MEMBER.superAdmin, MEMBER.superAdmin), 'IMPERSONATION_REFUSED');
    await expectRule(db.auth.impersonate(MEMBER.superAdmin, 99999), 'RECORD_NOT_FOUND');
  });

  it('records revenue paid by check or by Venmo against the DonationMethod lookup', async () => {
    const db = await d.make();
    const past = await db.events.create(
      { EventName: 'Pancake breakfast', EventDescription: 'Hall', OwnerID: MEMBER.admin, StartDate: '2026-09-12', EndDate: '2026-09-12', Location: 'Hall', CategoryID: 1 },
      [OWN],
    );
    const input = { LinkedEventID: past.id, Amount: 300, RevenueAccountID: PARKING_FUNDRAISING, DateLogged: '2026-09-13' };
    const methods = journalPaymentOptions(await db.donations.listMethods(OWN));
    const id = (name: string) => methods.find((o) => o.method.DonationMethod === name)!.method.id;
    expect(methods.map((o) => o.method.DonationMethod)).toEqual(['Cash', 'Credit Card', 'Venmo', 'Zelle', 'Zeffy', 'Parishsoft', 'Check']);
    await expectRule(db.finance.logConcludedRevenue(MEMBER.superAdmin, OWN, { ...input, payment_method_id: id('Check') }), 'INVALID_INPUT');
    await expectRule(db.finance.logConcludedRevenue(MEMBER.superAdmin, OWN, { ...input, payment_method_id: id('Cash'), CheckNumber: '1001' }), 'INVALID_INPUT');
    await expectRule(db.finance.logConcludedRevenue(MEMBER.superAdmin, OWN, { ...input, payment_method_id: 7 }), 'INVALID_INPUT'); // Physical Items
    const lines = await db.finance.logConcludedRevenue(MEMBER.superAdmin, OWN, { ...input, payment_method_id: id('Check'), CheckNumber: ' 1001 ' });
    expect(lines.map((l) => [l.payment_method_id, l.CheckNumber])).toEqual([
      [id('Check'), '1001'],
      [id('Check'), '1001'],
    ]);
    const venmo = await db.finance.logConcludedRevenue(MEMBER.superAdmin, OWN, { ...input, payment_method_id: id('Venmo') });
    expect(venmo[0]).toMatchObject({ payment_method_id: id('Venmo'), CheckNumber: null });
    const none = await db.finance.logConcludedRevenue(MEMBER.superAdmin, OWN, input);
    expect(none[0]).toMatchObject({ payment_method_id: null });
  });
});

describe('asset photos', () => {
  const DRIVE_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';

  it('files photos in Drive under Assets / <asset name>', () => {
    expect(driveVaultFolderPath('asset', 'Grill - smoker')).toEqual(['Fraternal Enterprise Suite', 'Assets', 'Grill - smoker']);
    expect(assetDriveFolderName('  Grill /  smoker ')).toBe('Grill - smoker');
    expect(assetDriveFolderName('Tent\\poles\t2')).toBe('Tent-poles-2');
    expect(assetDriveFolderName('')).toBe('Unnamed asset');
    expect(assetDriveFolderName('x'.repeat(300))).toHaveLength(100);
    expect(driveThumbnailUrl(DRIVE_ID, 400)).toBe(`https://drive.google.com/thumbnail?id=${DRIVE_ID}&sz=w400`);
    expect(photoSrc(DRIVE_ID)).toBe(driveThumbnailUrl(DRIVE_ID));
  });

  it('keeps only a Drive file id as the photo, or null', () => {
    expect(cleanAssetPhotoUrl(DRIVE_ID)).toBe(DRIVE_ID);
    expect(cleanAssetPhotoUrl(null)).toBeNull();
    for (const bad of ['/api/media/assets/1/a.jpg', 'https://example.org/grill.jpg', 'blob:http://localhost/abc', 'javascript:alert(1)']) {
      expect(() => cleanAssetPhotoUrl(bad)).toThrow(/filed in the council Google Drive/);
    }
    // The photo is its own method, not one of the form's details.
    expect(() => cleanAssetRecordChanges({ photo_url: 'x' } as never)).toThrow(/no editable field "photo_url"/);
  });

  it('makes the Deputy Grand Knight a full asset manager and leaves Trustees with photos only', () => {
    const dgk = actor({ roles: ['Deputy Grand Knight'], officer: true });
    const trustee = actor({ roles: ['Trustee 2'], officer: true });
    expect(mayManageCouncilAssets(dgk, OWN)).toBe(true);
    expect(mayManageCouncilAssets({ ...dgk, councilId: 2 }, OWN)).toBe(false);
    expect(mayManageCouncilAssets({ ...dgk, active: false }, OWN)).toBe(false);
    expect(mayManageCouncilAssets(trustee, OWN)).toBe(false);
    for (const a of [dgk, trustee, superAdmin, admin]) expect(mayAttachAssetPhoto(a, OWN)).toBe(true);
    for (const a of [member, officer, { ...trustee, councilId: 2 }, { ...trustee, active: false }]) expect(mayAttachAssetPhoto(a, OWN)).toBe(false);
    const web = (roles: string[]) => ({ memberId: 9, councilId: OWN, memberType: 'Member' as const, isOfficer: true, roles });
    expect(canManageCouncilAssets(web(['Deputy Grand Knight']), OWN)).toBe(true);
    expect(canManageCouncilAssets(web(['Trustee 1']), OWN)).toBe(false);
    expect(canAttachAssetPhoto(web(['Trustee 1']), OWN)).toBe(true);
    expect(canAttachAssetPhoto(web(['Recorder']), OWN)).toBe(false);
  });

  it('saves the Drive id on the asset row through setAssetPhoto', async () => {
    const db = new MemoryDataService({ now: () => new Date(NOW) });
    await db.init();
    const asset = db.debugStore.insert('CouncilAssetsInventory', { council_id: OWN, asset_name: 'Grill', purchase_date: '2026-09-01 00:00:00', cost_basis: 400 });
    expect((await db.expenses.setAssetPhoto(MEMBER.superAdmin, asset.id as number, DRIVE_ID)).photo_url).toBe(DRIVE_ID);
    await expectRule(db.expenses.setAssetPhoto(MEMBER.superAdmin, asset.id as number, '/api/media/assets/1/a.jpg'), 'INVALID_INPUT');
    await expectRule(db.expenses.setAssetPhoto(MEMBER.member, asset.id as number, null), 'ADMIN_REQUIRED');
    await expectRule(db.expenses.setAssetPhoto(MEMBER.superAdmin, 999, null), 'RECORD_NOT_FOUND');
    expect((await db.expenses.setAssetPhoto(MEMBER.superAdmin, asset.id as number, null)).photo_url).toBeNull();
  });

  it('uploads through the Drive route for every cleared officer, with the local disk folder gone', () => {
    const route = read('apps/web/app/api/assets/photo/route.ts');
    expect(route).toContain('mayAttachAssetPhoto(actor, councilId)');
    expect(route).toContain("driveVaultClient(creds).upload('asset'");
    expect(route).toContain('assetDriveFolderName(');
    expect(route).not.toContain('hasAdminRights');
    const page = read('apps/web/components/modules/CouncilAssetManagement.tsx');
    expect(page).toContain("form.set('assetName', asset.asset_name)");
    expect(page).toContain('db.expenses.setAssetPhoto(user.memberId, asset.id, link)');
    expect(page).not.toMatch(/archiveToDriveVault|localFileLink/);
    expect(read('.gitignore')).not.toContain('.media/');
    expect(() => read('apps/web/services/server/asset-media.ts')).toThrow();
    expect(() => read('apps/web/app/api/media/assets/[council]/[file]/route.ts')).toThrow();
  });

  it('shows the photos on the phone in a read-only Council Assets panel', () => {
    const screen = read('apps/mobile/app/(app)/assets.tsx');
    expect(screen).toContain('driveThumbnailUrl(asset.photo_url!, 400)');
    expect(screen).toContain('db.expenses.listAssetsInventory(user.memberId, user.councilId)');
    expect(read('apps/mobile/app/(app)/_layout.tsx')).toContain('<Tabs.Screen name="assets"');
    expect(read('apps/mobile/app/(app)/index.tsx')).toContain("canAttachAssetPhoto(user, user.councilId) ? <Button title=\"Council assets\"");
  });
});

describe('Schema 67: check donations', () => {
  it('adds Donation.CheckNumber and bumps the phone version', () => {
    expect(read('Schema.sql')).toContain('ALTER TABLE [Donation] ADD [CheckNumber] VARCHAR(50) NULL;');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (6[7-9]|[7-9]\d|\d{3});/);
    expect(TABLES.Donation.columns.find((c) => c.name === 'CheckNumber')).toMatchObject({ kind: 'text', notNull: false });
    expect(DONATION_EDITABLE_COLUMNS).toContain('CheckNumber');
  });

  it('requires a check number on a Check donation and refuses one on any other method', () => {
    expect(() => assertDonationFitsMethod('check', { DonationDesciption: null, CheckNumber: '2041' })).not.toThrow();
    expect(() => assertDonationFitsMethod('check', { DonationDesciption: null, CheckNumber: null })).toThrow(/check number/);
    expect(() => assertDonationFitsMethod('cash', { DonationDesciption: null, CheckNumber: '2041' })).toThrow(/Only a donation by check/);
    expect(() => assertDonationFitsMethod('qr', { DonationDesciption: null })).not.toThrow();
  });

  it('asks for the check number on the phone and web forms', () => {
    const phone = read('apps/mobile/app/(app)/donate.tsx');
    expect(phone).toContain('<Field label="CHECK NUMBER (REQUIRED)">');
    expect(phone).toContain("if (isCheck && checkNumber.trim() === '') return setError('Enter the check number printed on the check.');");
    expect(phone).toContain('CheckNumber: v.checkNumber,');
    expect(read('apps/web/components/modules/DonationRecords.tsx')).toContain('<Field label="Check number">');
  });
});

describe.each(drivers)('Sprint 7F Extension 2 ($name driver)', (d) => {
  it('records a Check donation with its number, and refuses it without one', async () => {
    const db = await d.make();
    const options = await db.donations.listMethods(OWN);
    const check = options.find((o) => o.kind === 'check')!;
    const cash = options.find((o) => o.kind === 'cash')!;
    const typeId = (await db.donations.listTypes(OWN))[0].id;
    const base = { CouncilID: OWN, DonationTypeID: typeId, DonationAmount: 50 };
    expect(check.method.DonationMethod).toBe('Check');
    await expectRule(db.donations.record(MEMBER.admin, { ...base, DonationMethodID: check.method.id }), 'INVALID_INPUT');
    await expectRule(db.donations.record(MEMBER.admin, { ...base, DonationMethodID: cash.method.id, CheckNumber: '2041' }), 'INVALID_INPUT');
    const saved = await db.donations.record(MEMBER.admin, { ...base, DonationMethodID: check.method.id, CheckNumber: ' 2041 ' });
    expect(saved).toMatchObject({ CheckNumber: '2041', DonationAmount: 50 });
    // Switching a correction to cash must drop the number.
    await expectRule(db.donations.update(MEMBER.admin, saved.id, { DonationMethodID: cash.method.id }), 'INVALID_INPUT');
    expect(await db.donations.update(MEMBER.admin, saved.id, { DonationMethodID: cash.method.id, CheckNumber: null })).toMatchObject({ CheckNumber: null });
  });
});

describe('impersonation', () => {
  it('lets only an Active Super Admin impersonate, and only a council Admin (Sprint 10 Revision 3.0)', () => {
    expect(() => assertMayImpersonate(superAdmin, { memberId: 9, memberType: 'Admin' })).not.toThrow();
    expect(() => assertMayImpersonate(superAdmin, { memberId: 9, memberType: 'Member' })).toThrow(/View As Member/);
    expect(() => assertMayImpersonate(admin, { memberId: 9, memberType: 'Admin' })).toThrow(BusinessRuleError);
    expect(() => assertMayImpersonate({ ...superAdmin, active: false }, { memberId: 9, memberType: 'Admin' })).toThrow(/Super Admin/);
    expect(() => assertMayImpersonate(superAdmin, { memberId: 7, memberType: 'Super Admin' })).toThrow(/cannot be impersonated/);
    expect(mayImpersonateMember({ memberId: 1, memberType: 'Super Admin' }, { memberId: 3, memberType: 'Admin' })).toBe(true);
    expect(mayImpersonateMember({ memberId: 1, memberType: 'Super Admin' }, { memberId: 3, memberType: 'Member' })).toBe(false);
    expect(mayImpersonateMember({ memberId: 1, memberType: 'Super Admin' }, { memberId: 1, memberType: 'Super Admin' })).toBe(false);
    expect(mayImpersonateMember({ memberId: 2, memberType: 'Admin' }, { memberId: 3, memberType: 'Admin' })).toBe(false);
  });

  it('refuses writes, never reads, while the view is on', async () => {
    let on = false;
    const calls: string[] = [];
    const service = {
      init: () => 'ready',
      members: {
        get: async (id: number) => calls.push(`get ${id}`),
        listByCouncil: async () => calls.push('list'),
        update: async () => calls.push('update'),
      },
    };
    const guarded = guardViewAsWrites(service, () => on);
    expect(guarded.init()).toBe('ready');
    await guarded.members.update();
    on = true;
    await guarded.members.get(3);
    await guarded.members.listByCouncil();
    await expectRule(guarded.members.update() as Promise<unknown>, 'VIEW_AS_READ_ONLY');
    expect(calls).toEqual(['update', 'get 3', 'list']);
    expect(['getAssetRecord', 'listInbox', 'monthlySummary', 'memberCenter'].every(isViewAsReadMethod)).toBe(true);
    expect(['update', 'markAsRead', 'compileInMemoriam', 'setStatus', 'getaway'].some(isViewAsReadMethod)).toBe(false);
  });

  it('mints a view-as token that names the Super Admin and never outlives their own session', async () => {
    const now = new Date('2026-10-11T12:00:00Z');
    const user = { credentialId: 1, memberId: 1, councilId: 1, username: 'sa', firstName: 'S', lastName: 'A', memberType: 'Super Admin' as const, roles: [], isOfficer: false, isBudgetDirector: false };
    const own = sessionClaimsFor(user, true, new Date(now.getTime() - 7.5 * 3600_000), 8 * 3600);
    const target = { ...user, credentialId: 3, memberId: 3, username: 'm', memberType: 'Member' as const };
    const view = impersonationClaimsFor(target, true, own, now, 60);
    expect(view).toMatchObject({ memberId: 3, impersonatorId: 1, exp: own.exp });
    const secret = 's'.repeat(32);
    expect(await verifySessionToken(await signSessionToken(view, secret), secret, now)).toMatchObject({ impersonatorId: 1 });
    expect(sessionCookieHeader('abc', true, IMPERSONATOR_COOKIE)).toBe(`${IMPERSONATOR_COOKIE}=abc; Path=/api; HttpOnly; SameSite=Strict; Secure`);
  });

  it('wires the route, the member grid button and the read-only server guard', () => {
    const route = read('apps/web/app/api/admin/impersonate/route.ts');
    expect(route).toContain("actor.memberType !== 'Super Admin'");
    expect(route).toContain('db.auth.impersonate(claims.memberId, memberId)');
    expect(read('apps/web/services/server/session.ts')).toContain("claims.impersonatorId !== undefined && req.method !== 'GET'");
    expect(read('apps/web/components/modules/MemberRosterDirectory.tsx')).toContain('👥 Impersonate Admin');
    expect(read('apps/web/services/db.ts')).toContain('guardViewAsWrites(createDataService(), () => viewAsActive)');
  });
});

describe('remote assistance', () => {
  afterEach(() => resetAssistRequests());

  it('lets officers and Admins ask, and only Super Admins watch', () => {
    expect([officer, admin, member, superAdmin].map(mayRequestRemoteAssistance)).toEqual([true, true, false, false]);
    expect([officer, admin, member, superAdmin].map(mayWatchRemoteAssistance)).toEqual([false, false, false, true]);
    expect(canOpenRemoteAssistanceDesk({ memberId: 1, councilId: 1, memberType: 'Super Admin', isOfficer: false, roles: [] })).toBe(true);
    expect(portalAreas({ memberId: 1, councilId: 1, memberType: 'Super Admin', isOfficer: false, roles: [] })).toContain('system-settings/remote-assistance');
    expect(portalAreas({ memberId: 2, councilId: 1, memberType: 'Admin', isOfficer: false, roles: [] })).not.toContain('system-settings/remote-assistance');
  });

  it('strips scripts, handlers, javascript links and form values from a screen copy', () => {
    const html = sanitizeAssistSnapshot(
      '<div onclick="steal()"><script>alert(1)</script><a href="javascript:x()">a</a><input name="q" value="secret"><textarea>notes</textarea><iframe src="x"></iframe>ok</div>',
    );
    expect(html).toBe('<div><a>a</a><input name="q"><textarea></textarea>ok</div>');
  });

  it('keeps one open request per member, refreshes it for its owner only, and closes it', () => {
    const snapshot = cleanAssistSnapshot({ route: '/expenses', viewport: { width: 1280, height: 800 }, html: '<main>hi</main>' });
    if (typeof snapshot === 'string') throw new Error(snapshot);
    expect(cleanAssistSnapshot({ route: 'expenses', html: '' })).toBe('Send the page path.');
    const first = openAssistRequest({ memberId: 5, councilId: 1, memberName: 'Recorder, Rob' }, 'Where is the save button?', snapshot);
    const second = openAssistRequest({ memberId: 5, councilId: 1, memberName: 'Recorder, Rob' }, '', snapshot);
    expect(listAssistRequests().map((r) => r.id)).toEqual([second.id]);
    expect(listAssistRequests()[0]).not.toHaveProperty('html');
    expect(getAssistRequest(first.id)).toBeNull();
    expect(updateAssistSnapshot(second.id, 6, { ...snapshot, html: '<main>other</main>' })).toBe(false);
    expect(updateAssistSnapshot(second.id, 5, { ...snapshot, html: '<main>new</main>' })).toBe(true);
    expect(getAssistRequest(second.id)?.html).toBe('<main>new</main>');
    expect(closeAssistRequest(second.id, 6, false)).toBe(false);
    expect(closeAssistRequest(second.id, 1, true)).toBe(true);
    expect(listAssistRequests()).toEqual([]);
  });

  it('puts the request button in the header for officers and Admins and draws the copy in a sandboxed frame', () => {
    expect(read('apps/web/components/Shell.tsx')).toContain("user.memberType !== 'Super Admin' && (user.isOfficer || user.memberType === 'Admin') ? <RemoteAssistButton />");
    expect(read('apps/web/components/PlatformAccessParts.tsx')).toContain('❓ Request Remote Officer Assistance');
    expect(read('apps/web/app/system-settings/remote-assistance/page.tsx')).toContain('sandbox=""');
  });
});

describe('sign-in gates and the mail center', () => {
  it('puts the understated access request link on both sign-in screens (Sprint 8P Stage 1)', () => {
    expect(ACCESS_REQUEST_LINK_LABEL).toBe('[ 🔑 Request Access ]');
    for (const screen of ['apps/web/components/Shell.tsx', 'apps/mobile/app/sign-in.tsx']) {
      expect(read(screen)).toContain('{ACCESS_REQUEST_LINK_LABEL}');
      expect(read(screen)).not.toContain('🏢 Register Your Council / Request Access');
    }
    expect(read('apps/mobile/app/sign-in.tsx')).toContain('db.accessRequests.submit(draft)');
  });

  it('shows the Inbound Council Mail Center on the Super Admin Desk only (Sprint 10 Revision 1.0 took it off the Grand Knight Desk)', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).not.toContain('<InboundMailCenter />');
    expect(DESK_DRAWERS.map((d) => d.id as string)).not.toContain('access-requests');
    expect(read('apps/web/components/SuperAdminDesk.tsx')).toContain('<InboundMailCenter />');
    expect(read('apps/web/app/dashboard/page.tsx')).not.toContain('<InboundMailCenter />');
    expect(read('apps/web/components/PlatformAccessParts.tsx')).not.toMatch(/bg-black/);
  });

  it("emails the notice through the driver's email hook", async () => {
    const sent: SendGridMailRequest[] = [];
    const db = new MemoryDataService({ now: () => new Date(NOW), sendEmail: async (r) => void sent.push(r) });
    await db.init();
    await db.accessRequests.submit(request);
    expect(sent).toHaveLength(1);
    expect(sent[0].body.personalizations[0].to[0].email).toBe(ACCESS_REQUEST_NOTIFY_EMAIL);
  });
});
