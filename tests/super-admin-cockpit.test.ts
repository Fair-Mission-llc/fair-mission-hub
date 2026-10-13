// Sprint 8O: Super Admin cockpit and account ownership splits (schema 85) - the account_owner_entity gate on the payment
// method editor, the parish-held settlement credit on the Parish Fundraiser Revenue Split Console (no check, no posting,
// never batch-coded), the Administrative Feedback Loops behind an ADMIN guard, and the platform owner's Super Admin Desk.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_OWNER_ENTITIES,
  accountOwnerEntityOf,
  accountOwnerGateMessage,
  buildBatchCodingQueue,
  buildParishSplitRows,
  canOpenAdministrativeFeedback,
  cleanAccountOwnerEntity,
  dashboardTabsFor,
  isParishHeldDonation,
  isPlatformOwner,
  LOG_PARISH_HELD_CREDIT_LABEL,
  PARISH_HELD_NOTICE_TITLE,
  parishHeldNoticeText,
  planChurchDisbursementRequest,
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
const PARISH_LINE = 16;
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

  it('treats only electronic gifts through a parish-owned account as held by the parish', () => {
    expect(isParishHeldDonation('qr', 'PARISH')).toBe(true);
    expect(isParishHeldDonation('card', 'PARISH')).toBe(true);
    expect(isParishHeldDonation('cash', 'PARISH')).toBe(false);
    expect(isParishHeldDonation('qr', 'COUNCIL')).toBe(false);
    expect(isParishHeldDonation('qr', 'THIRD_PARTY')).toBe(false);
    expect(isParishHeldDonation('qr', undefined)).toBe(false);
  });
});

describe('parish-held settlement rules', () => {
  const events = [{ id: 9, EventName: 'Parish Parking Event', StartDate: '2026-10-10', EndDate: '2026-10-31' }];
  const settings = { parish_split_enabled: 1, parish_split_percentage: 50, parish_split_gl_line_id: PARISH_LINE };

  it('settles parish-held revenue first as a tracking credit, then a check for the rest', () => {
    const donations = [
      { EventID: 9, DonationAmount: 250, isItem: false },
      { EventID: 9, DonationAmount: 150, isItem: false, parishHeld: true },
    ];
    const [row] = buildParishSplitRows(events, donations, [], 50);
    expect(row).toMatchObject({ grossCollections: 400, share: 200, parishHeldCollections: 150, parishHeldCreditAvailable: 150, checkDue: 50, nextSettlement: 'PARISH_HELD' });
    expect(planChurchDisbursementRequest(settings, [row!], 9, OWN)).toMatchObject({ amount: 150, settlement_method: 'PARISH_HELD' });
    expect(parishHeldNoticeText(row!)).toMatch(/no check is cut/);

    const [after] = buildParishSplitRows(events, donations, [{ event_id: 9, amount: 150, settlement_method: 'PARISH_HELD' }], 50);
    expect(after).toMatchObject({ alreadyRequested: 150, parishHeldCredited: 150, parishHeldCreditAvailable: 0, checkDue: 50, nextSettlement: 'CHECK' });
    expect(planChurchDisbursementRequest(settings, [after!], 9, OWN)).toMatchObject({ amount: 50, settlement_method: 'CHECK' });
  });

  it('cuts no check at all when the parish already holds more than its share', () => {
    const donations = [{ EventID: 9, DonationAmount: 300, isItem: false, parishHeld: true }, { EventID: 9, DonationAmount: 100, isItem: false }];
    const [row] = buildParishSplitRows(events, donations, [], 25);
    expect(row).toMatchObject({ share: 100, parishHeldCreditAvailable: 100, checkDue: 0, parishHeldExcess: 200 });
    expect(parishHeldNoticeText(row!)).toMatch(/No check is needed/);
    expect(parishHeldNoticeText(row!)).toMatch(/\$200\.00 more than its share/);
    const [done] = buildParishSplitRows(events, donations, [{ event_id: 9, amount: 100, settlement_method: 'PARISH_HELD' }], 25);
    expect(done).toMatchObject({ available: 0, checkDue: 0, nextSettlement: null });
    expect(() => planChurchDisbursementRequest(settings, [done!], 9, OWN)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });

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

  it('logs a parish-held tracking credit with no check and no posting, then a check request for the rest', async () => {
    const db = await makePilot();
    const [gk, treasurer, fs] = await Promise.all(['gk_user', 'treasurer_user', 'fs_user'].map((u) => signIn(db, u)));
    await venmoToParish(db, treasurer);
    await db.councils.setParishSplitSettings(gk, OWN, { enabled: true, glLineId: PARISH_LINE, percentage: 50 });

    // The seeded first weekend: $250 cash + $150 Venmo, and the Venmo is now the parish's own account.
    const row = (await db.finance.getParishSplitConsole(treasurer, OWN)).events.find((r) => r.eventId === PARKING_EVENT)!;
    expect(row).toMatchObject({ grossCollections: 400, share: 200, parishHeldCollections: 150, parishHeldCreditAvailable: 150, checkDue: 50, nextSettlement: 'PARISH_HELD' });

    const postings = (await db.finance.listLedgerTransactions(fs, OWN)).length;
    const credit = await db.finance.issueChurchDisbursementRequest(treasurer, OWN, PARKING_EVENT);
    expect(credit.request).toMatchObject({ settlement_method: 'PARISH_HELD', status: 'PAID', amount: 150, check_number: null, transaction_id: null, paid_by_member_id: treasurer });
    expect((await db.finance.listLedgerTransactions(fs, OWN)).length).toBe(postings);
    // The credit never reaches the Financial Secretary's check queue.
    await expectRule(db.finance.recordChurchDisbursementPayment(fs, credit.request.id, { CheckNumber: '1404' }), 'ILLEGAL_STATE_TRANSITION');

    const check = await db.finance.issueChurchDisbursementRequest(treasurer, OWN, PARKING_EVENT);
    expect(check.request).toMatchObject({ settlement_method: 'CHECK', status: 'PENDING', amount: 50 });
    await expectRule(db.finance.issueChurchDisbursementRequest(treasurer, OWN, PARKING_EVENT), 'INVALID_INPUT');
  });

  it('never offers or codes a parish-held donation in the batch coder', async () => {
    const db = await makePilot();
    const treasurer = await signIn(db, 'treasurer_user');
    const before = await db.finance.getBatchCodingQueue(treasurer, OWN);
    const venmoId = await venmoToParish(db, treasurer);
    const venmoRows = before.rows.filter((r) => r.donation.DonationMethodID === venmoId);
    expect(venmoRows.length).toBeGreaterThan(0);

    const after = await db.finance.getBatchCodingQueue(treasurer, OWN);
    expect(after.rows.some((r) => r.donation.DonationMethodID === venmoId)).toBe(false);
    expect(after.rows.length).toBe(before.rows.length - venmoRows.length);
    await expectRule(
      db.finance.batchCodeDonations(treasurer, OWN, { donationIds: [venmoRows[0]!.donation.id], revenueAccountId: after.revenueAccounts[0]!.id }),
      'INVALID_INPUT',
    );
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

describe('Super Admin Desk', () => {
  const owner = { memberId: 1, councilId: OWN, memberType: 'Super Admin' as const, isOfficer: false, roles: [], username: PLATFORM_OWNER_USERNAMES[0]! };

  it("mounts only for the platform owner's own Super Admin session", () => {
    expect(isPlatformOwner(owner)).toBe(true);
    expect(isPlatformOwner({ ...owner, username: owner.username.toUpperCase() })).toBe(true);
    expect(isPlatformOwner({ ...owner, username: 'another.super@kofc.org' })).toBe(false);
    expect(isPlatformOwner({ ...owner, memberType: 'Admin' })).toBe(false);
    expect(isPlatformOwner({ ...owner, username: undefined })).toBe(false);
    expect(dashboardTabsFor(owner, OWN).at(-1)).toMatchObject({ id: 'super-admin', label: SUPER_ADMIN_DESK_TITLE });
    expect(dashboardTabsFor({ ...owner, username: 'another.super@kofc.org' }, OWN).map((t) => t.id)).not.toContain('super-admin');
  });

  it('holds the three top horizontal action folders', () => {
    expect(SUPER_ADMIN_DESK_TITLE).toBe('Super Admin Desk');
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
  it('bumps the phone database to 85 and records the release', () => {
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (8[5-9]|9\d);/);
    const schema = read('Schema.sql');
    expect(schema).toContain('(schema version 85)');
    expect(schema).toContain("ALTER TABLE [CouncilDonationMethod] ADD [account_owner_entity] VARCHAR(20) NOT NULL DEFAULT 'COUNCIL'");
    expect(schema).toContain("CHECK ([account_owner_entity] IN ('COUNCIL', 'PARISH', 'THIRD_PARTY'))");
    expect(schema).toContain("ALTER TABLE [ParishDisbursementRequest] ADD [settlement_method] VARCHAR(20) NOT NULL DEFAULT 'CHECK'");
  });

  it('shows the parish-held notice and its credit button on the Treasurer Desk console', () => {
    expect(PARISH_HELD_NOTICE_TITLE).toBe('Revenue Held by Parish Settlement Notice');
    const parts = read('apps/web/components/ParishSplitParts.tsx');
    expect(parts).toContain('PARISH_HELD_NOTICE_TITLE');
    expect(parts).toContain('LOG_PARISH_HELD_CREDIT_LABEL');
    expect(LOG_PARISH_HELD_CREDIT_LABEL).toContain('Parish-Held Settlement Credit');
    expect(read('apps/web/app/council-lookups/page.tsx')).toContain('accountOwnerGateMessage');
  });
});
