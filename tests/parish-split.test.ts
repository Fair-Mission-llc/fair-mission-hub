// Sprint 8M Core: parametric parish splits (schema 83) - the three Council settings and their GL line gate, the Parish
// Fundraiser Revenue Split Console on the Treasurer Desk, the Church Disbursement Request it sends to the Financial
// Secretary Desk, and the check that pays it. Also the phone's Donate tab without the Check tile.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildParishSplitRows,
  cleanParishSplitSettings,
  parishShare,
  parishSplitGateMessage,
  parishSplitSettings,
  PHONE_STANDARD_RATE_HINT,
  type DataService,
  type GLAccount,
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
const PARISH_LINE = 16; // Parish Fundraiser Share (Revenue since Sprint 8M Extension), presentation seed
const PILOT_DAY = new Date(2026, 9, 12, 19, 0, 0);

const account = (id: number, AccountType: GLAccount['AccountType'], IsVirtualGoal = 0, CouncilID = OWN): GLAccount => ({
  id,
  CouncilID,
  AccountName: `Account ${id}`,
  AccountType,
  ParentAccountID: null,
  IsVirtualGoal,
  TargetGoalAmount: 0,
});

describe('parish split rules', () => {
  const accounts = [account(1, 'Asset'), account(7, 'Revenue'), account(13, 'Expense'), account(16, 'Expense'), account(40, 'Expense', 0, 2)];
  const off = parishSplitSettings({});

  it('defaults to off at 50.00% with no GL line', () => {
    expect(off).toEqual({ parish_split_enabled: 0, parish_split_percentage: 50, parish_split_gl_line_id: null });
  });

  it('refuses to switch the split on without a GL line, in the rules and in the front-end gate', () => {
    expect(() => cleanParishSplitSettings({ enabled: true }, off, accounts, OWN)).toThrow(expect.objectContaining({ code: 'PARISH_SPLIT_GL_LINE_REQUIRED' }));
    expect(parishSplitGateMessage(true, null)).toMatch(/general ledger line/);
    expect(parishSplitGateMessage(true, 16)).toBeNull();
    expect(parishSplitGateMessage(false, null)).toBeNull();
    // Switching on and choosing the line is one save.
    expect(cleanParishSplitSettings({ enabled: true, glLineId: 16, percentage: 40 }, off, accounts, OWN)).toEqual({
      parish_split_enabled: 1,
      parish_split_percentage: 40,
      parish_split_gl_line_id: 16,
    });
    // Clearing the line of a split that is on is refused too.
    const on = { parish_split_enabled: 1, parish_split_percentage: 50, parish_split_gl_line_id: 16 };
    expect(() => cleanParishSplitSettings({ glLineId: null }, on, accounts, OWN)).toThrow(expect.objectContaining({ code: 'PARISH_SPLIT_GL_LINE_REQUIRED' }));
  });

  it('takes a revenue or expense line of the council and a percentage from 0.01 to 100', () => {
    // Sprint 8M Extension: a Revenue line (7) is accepted, as is an Expense line (13).
    expect(cleanParishSplitSettings({ glLineId: 7 }, off, accounts, OWN).parish_split_gl_line_id).toBe(7);
    expect(cleanParishSplitSettings({ glLineId: 13 }, off, accounts, OWN).parish_split_gl_line_id).toBe(13);
    for (const glLineId of [1, 40, 99]) {
      expect(() => cleanParishSplitSettings({ glLineId }, off, accounts, OWN), String(glLineId)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    }
    for (const percentage of [0, -5, 100.01, 33.333, Number.NaN]) {
      expect(() => cleanParishSplitSettings({ percentage }, off, accounts, OWN), String(percentage)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    }
    expect(() => cleanParishSplitSettings({ colour: 'blue' }, off, accounts, OWN)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(cleanParishSplitSettings({ percentage: 100 }, off, accounts, OWN).parish_split_percentage).toBe(100);
  });

  it('splits the money collections to the cent, leaving physical items out and subtracting earlier requests', () => {
    expect(parishShare(215, 50)).toBe(107.5);
    expect(parishShare(10.01, 33.33)).toBe(3.34);
    const rows = buildParishSplitRows(
      [
        { id: 9, EventName: 'Parish Parking Event', StartDate: '2026-10-10', EndDate: '2026-10-31' },
        { id: 3, EventName: 'Fish Fry', StartDate: '2026-03-06', EndDate: '2026-03-06' },
      ],
      [
        { EventID: 9, DonationAmount: 25, isItem: false },
        { EventID: 9, DonationAmount: 180, isItem: false },
        { EventID: 9, DonationAmount: 60, isItem: true },
        { EventID: null, DonationAmount: 500, isItem: false },
      ],
      [{ event_id: 9, amount: 40 }],
      50,
    );
    expect(rows).toEqual([
      { eventId: 9, eventName: 'Parish Parking Event', startDate: '2026-10-10', endDate: '2026-10-31', grossCollections: 205, share: 102.5, alreadyRequested: 40, available: 62.5 },
    ]);
  });
});

describe.each(drivers)('$name driver: the parish split engine', (d) => {
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

  async function collect(db: DataService, memberId: number) {
    const methods = await db.donations.listMethods(OWN);
    const typeId = (await db.donations.listTypes(OWN))[0]!.id;
    const venmo = methods.find((o) => o.method.DonationMethod === 'Venmo')!.method.id;
    const cash = methods.find((o) => o.kind === 'cash')!.method.id;
    const items = methods.find((o) => o.kind === 'item')!.method.id;
    await db.donations.record(memberId, { CouncilID: OWN, EventID: PARKING_EVENT, DonationMethodID: venmo, DonationTypeID: typeId, DonationAmount: 25 });
    await db.donations.record(memberId, { CouncilID: OWN, EventID: PARKING_EVENT, DonationMethodID: cash, DonationTypeID: typeId, DonationAmount: 180, DonationDesciption: 'Cash box drop' });
    await db.donations.record(memberId, {
      CouncilID: OWN,
      EventID: PARKING_EVENT,
      DonationMethodID: items,
      DonationTypeID: typeId,
      DonationAmount: 60,
      DonationDesciption: 'Two boxes of traffic cones',
    });
  }

  it('starts off, with the seeded Parish Fundraiser Share line on offer', async () => {
    const db = await makePilot();
    const treasurer = await signIn(db, 'treasurer_user');
    const view = await db.finance.getParishSplitConsole(treasurer, OWN);
    expect(view.settings).toEqual({ parish_split_enabled: 0, parish_split_percentage: 50, parish_split_gl_line_id: null });
    expect(view.lineOptions.map((a) => a.AccountName)).toContain('Parish Fundraiser Share');
    expect(view.glLine).toBeNull();
  });

  it('saves the settings only with a live GL line, for the Council Wide Settings editors', async () => {
    const db = await makePilot();
    const [gk, alpha] = await Promise.all(['gk_user', 'member_alpha'].map((u) => signIn(db, u)));
    await expectRule(db.councils.setParishSplitSettings(gk, OWN, { enabled: true }), 'PARISH_SPLIT_GL_LINE_REQUIRED');
    expect((await db.councils.get(OWN))?.parish_split_enabled).toBe(0);
    await expectRule(db.councils.setParishSplitSettings(alpha, OWN, { enabled: true, glLineId: PARISH_LINE }), 'ADMIN_REQUIRED');
    const saved = await db.councils.setParishSplitSettings(gk, OWN, { enabled: true, glLineId: PARISH_LINE, percentage: 50 });
    expect(saved).toMatchObject({ parish_split_enabled: 1, parish_split_percentage: 50, parish_split_gl_line_id: PARISH_LINE });
  });

  it('issues the Church Disbursement Request on the Treasurer Desk and pays it from the FS Desk with check 1404', async () => {
    const db = await makePilot();
    const [gk, fs, treasurer, alpha] = await Promise.all(['gk_user', 'fs_user', 'treasurer_user', 'member_alpha'].map((u) => signIn(db, u)));
    await collect(db, alpha);

    // While the split is off nothing is issued.
    await expectRule(db.finance.issueChurchDisbursementRequest(treasurer, OWN, PARKING_EVENT), 'PARISH_SPLIT_DISABLED');
    await db.councils.setParishSplitSettings(gk, OWN, { enabled: true, glLineId: PARISH_LINE });

    const row = (await db.finance.getParishSplitConsole(treasurer, OWN)).events.find((r) => r.eventId === PARKING_EVENT)!;
    // The seeded first weekend ($400.00) plus Venmo $25 and the $180 cash drop; the $60 of items is left out.
    expect(row).toMatchObject({ grossCollections: 605, share: 302.5, alreadyRequested: 0, available: 302.5 });

    await expectRule(db.finance.issueChurchDisbursementRequest(fs, OWN, PARKING_EVENT), 'TREASURER_REQUIRED');
    const issued = await db.finance.issueChurchDisbursementRequest(treasurer, OWN, PARKING_EVENT);
    expect(issued).toMatchObject({ eventName: 'Parish Parking Event', glAccountName: 'Parish Fundraiser Share', requestedByName: 'Treasurer User' });
    expect(issued.request).toMatchObject({ status: 'PENDING', amount: 302.5, gross_collections: 605, split_percentage: 50, gl_account_id: PARISH_LINE });
    // The whole share is requested, so a second request is refused until more is collected.
    await expectRule(db.finance.issueChurchDisbursementRequest(treasurer, OWN, PARKING_EVENT), 'INVALID_INPUT');
    // Nothing is posted until the check is recorded.
    const before = await db.finance.getAccountLedger(fs, PARISH_LINE);

    await expectRule(db.finance.recordChurchDisbursementPayment(treasurer, issued.request.id, { CheckNumber: '1404' }), 'FINANCIAL_SECRETARY_REQUIRED');
    await expectRule(db.finance.recordChurchDisbursementPayment(fs, issued.request.id, { CheckNumber: '  ' }), 'INVALID_INPUT');
    const paid = await db.finance.recordChurchDisbursementPayment(fs, issued.request.id, { CheckNumber: '1404' });
    expect(paid.request).toMatchObject({ status: 'PAID', check_number: '1404', paid_by_member_id: fs });
    expect(paid.paidByName).toBe('FS User');
    await expectRule(db.finance.recordChurchDisbursementPayment(fs, issued.request.id, { CheckNumber: '1405' }), 'ILLEGAL_STATE_TRANSITION');

    const postings = (await db.finance.listLedgerTransactions(fs, OWN)).find((t) => t.transactionId === paid.request.transaction_id);
    expect(postings).toBeTruthy();
    const after = await db.finance.getAccountLedger(fs, PARISH_LINE);
    expect(after.rows.length - before.rows.length).toBe(1);
    expect(after.rows.find((e) => e.entry.CheckNumber === '1404')?.entry.DebitAmount).toBe(302.5);

    // More collections later: only the new share is requested.
    const typeId = (await db.donations.listTypes(OWN))[0]!.id;
    const cash = (await db.donations.listMethods(OWN)).find((o) => o.kind === 'cash')!.method.id;
    await db.donations.record(alpha, { CouncilID: OWN, EventID: PARKING_EVENT, DonationMethodID: cash, DonationTypeID: typeId, DonationAmount: 25 });
    expect((await db.finance.issueChurchDisbursementRequest(treasurer, OWN, PARKING_EVENT)).request.amount).toBe(12.5);
  });

  it('keeps the officer who issued a request from paying it', async () => {
    const db = await makePilot();
    const [gk, alpha] = await Promise.all(['gk_user', 'member_alpha'].map((u) => signIn(db, u)));
    const superAdmin = (await db.auth.signIn('testsuperadmin@kofc.org', PASSWORD))!.memberId;
    await collect(db, alpha);
    await db.councils.setParishSplitSettings(gk, OWN, { enabled: true, glLineId: PARISH_LINE });
    const issued = await db.finance.issueChurchDisbursementRequest(superAdmin, OWN, PARKING_EVENT);
    await expectRule(db.finance.recordChurchDisbursementPayment(superAdmin, issued.request.id, { CheckNumber: '1404' }), 'DUAL_SIGNATURE_CONFLICT');
  });
});

describe('Sprint 8M: schema 83 and the phone Donate tab', () => {
  it('bumps the phone database to 83 and records the release', () => {
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (8[3-9]|9\d);/);
    const schema = read('Schema.sql');
    expect(schema).toContain('(schema version 83)');
    expect(schema).toContain('ALTER TABLE [Council] ADD [parish_split_enabled] INT NOT NULL DEFAULT 0;');
    expect(schema).toContain('ALTER TABLE [Council] ADD [parish_split_percentage] DECIMAL(5,2) NOT NULL DEFAULT 50.00;');
    expect(schema).toContain('ALTER TABLE [Council] ADD [parish_split_gl_line_id] INT NULL;');
  });

  it('keeps the Check tile on the phone (Sprint 8M Extension) and hints a $25.00 standard rate', () => {
    expect(PHONE_STANDARD_RATE_HINT).toBe(25);
    const donate = read('apps/mobile/app/(app)/donate.tsx');
    expect(donate).not.toContain('phoneDonationOptions');
    expect(donate).toContain('<Field label="CHECK NUMBER (REQUIRED)">');
    expect(donate).toContain('EVENT DESCRIPTION (OPTIONAL)');
    expect(donate).not.toContain('e.g. 10.00');
  });

  it('puts the console on the Treasurer Desk and the requests on the FS Desk', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).toContain('<ParishSplitConsoleCard');
    expect(desks).toContain('<ChurchDisbursementQueue');
    expect(read('apps/web/components/ParishSplitParts.tsx')).toContain('ISSUE_CHURCH_DISBURSEMENT_LABEL');
  });
});
