// Sprint 8N: high-volume batch coding and cash box audit closures (schema 84) - the event collection lifecycle
// (OPEN -> CONCLUDED -> RECONCILED) with the phone's '[ 🛑 Conclude Event Session & Lock Logs ]', the Treasurer Desk's
// High-Volume Batch Transaction Coder, and the Cash Box Audit Closure Panel with its Over/Short Reconciliation Line.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCashAuditBoard,
  canTransition,
  cashVariance,
  CASH_OVER_SHORT_ACCOUNT_NAME,
  CONCLUDE_EVENT_SESSION_LABEL,
  describeCashVariance,
  EVENT_COLLECTION_WORKFLOW,
  nextCollectionStatus,
  planBatchCoding,
  SELECT_ALL_UNCODED_LABEL,
  type BatchCodingRow,
  type DataService,
  type Donation,
  type Event,
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
const TOOTSIE_ROLL_EVENT = 5;
const OPERATING_CHECKING = 1;
const PARKING_FUNDRAISING = 8; // a Revenue line
const COUNCIL_OPERATIONAL_COSTS = 13; // an Expense line
const PILOT_DAY = new Date(2026, 9, 12, 19, 0, 0);

const account = (id: number, AccountType: GLAccount['AccountType'], CouncilID = OWN): GLAccount => ({
  id,
  CouncilID,
  AccountName: `Account ${id}`,
  AccountType,
  ParentAccountID: null,
  IsVirtualGoal: 0,
  TargetGoalAmount: 0,
});

const donation = (id: number, DonationAmount: number, extra: Partial<Donation> = {}): Donation => ({
  id,
  CouncilID: OWN,
  DonationDate: '2026-10-11',
  DonationMethodID: 3,
  DonationTypeID: 1,
  EventID: PARKING_EVENT,
  DonationAmount,
  ...extra,
});

describe('cash audit rules', () => {
  it('runs the collection lifecycle OPEN -> CONCLUDED -> RECONCILED and nothing leaves RECONCILED', () => {
    expect(Object.isFrozen(EVENT_COLLECTION_WORKFLOW)).toBe(true);
    expect(nextCollectionStatus({ id: 9 }, 'conclude')).toBe('CONCLUDED');
    expect(nextCollectionStatus({ id: 9, collection_status: 'CONCLUDED' }, 'conclude')).toBe('CONCLUDED');
    expect(nextCollectionStatus({ id: 9, collection_status: 'OPEN' }, 'reconcile')).toBe('RECONCILED');
    expect(canTransition(EVENT_COLLECTION_WORKFLOW, 'RECONCILED', 'conclude')).toBe(false);
    expect(() => nextCollectionStatus({ id: 9, collection_status: 'RECONCILED' }, 'reconcile')).toThrow(expect.objectContaining({ code: 'ILLEGAL_STATE_TRANSITION' }));
  });

  it('works out the variance to the cent', () => {
    expect(cashVariance(250, 245)).toBe(-5);
    expect(cashVariance(10.1, 10.3)).toBe(0.2);
    expect(describeCashVariance(-5)).toBe('Short $5.00');
    expect(describeCashVariance(0.2)).toBe('Over $0.20');
    expect(describeCashVariance(0)).toBe('Balanced');
  });

  it('plans one balanced posting for a batch and refuses a bad selection', () => {
    const accounts = [account(OPERATING_CHECKING, 'Asset'), account(PARKING_FUNDRAISING, 'Revenue'), account(COUNCIL_OPERATIONAL_COSTS, 'Expense')];
    const rows: BatchCodingRow[] = [
      { donation: donation(1, 150), methodName: 'Venmo', kind: 'qr', eventName: 'Parish Parking Event' },
      { donation: donation(2, 25.5, { DonationMethodID: 2 }), methodName: 'Credit Card', kind: 'card', eventName: 'Parish Parking Event' },
      { donation: donation(3, 250, { DonationMethodID: 1 }), methodName: 'Cash', kind: 'cash', eventName: 'Parish Parking Event' },
      { donation: donation(4, 40, { coding_batch_id: 'earlier', revenue_gl_account_id: 8 }), methodName: 'Zelle', kind: 'qr', eventName: 'Parish Parking Event' },
    ];
    const plan = planBatchCoding(OWN, rows, accounts, { donationIds: [1, 2], revenueAccountId: PARKING_FUNDRAISING }, PILOT_DAY);
    expect(plan.total).toBe(175.5);
    expect(plan.lines.map((l) => [l.GLAccountID, l.DebitAmount, l.CreditAmount])).toEqual([
      [OPERATING_CHECKING, 175.5, 0],
      [PARKING_FUNDRAISING, 0, 175.5],
    ]);
    expect(plan.lines[0]!.LinkedEventID).toBe(PARKING_EVENT);
    const code = (ids: number[], line = PARKING_FUNDRAISING) => () => planBatchCoding(OWN, rows, accounts, { donationIds: ids, revenueAccountId: line }, PILOT_DAY);
    expect(code([])).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(code([1, 1])).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(code([3])).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(code([99])).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
    expect(code([4])).toThrow(expect.objectContaining({ code: 'DONATION_ALREADY_CODED' }));
    expect(code([1], COUNCIL_OPERATIONAL_COSTS)).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });

  it('lists events with logged cash, awaiting ones first, with the metrics above the fold', () => {
    const event = (id: number, extra: Partial<Event> = {}) =>
      ({ id, EventName: `Event ${id}`, StartDate: `2026-10-0${id}`, EndDate: `2026-10-0${id}`, ...extra }) as Event;
    const board = buildCashAuditBoard(
      OWN,
      [event(1, { collection_status: 'RECONCILED', verified_cash_amount: 98 }), event(2, { collection_status: 'CONCLUDED' }), event(3), event(4)],
      [
        { EventID: 1, DonationAmount: 100, kind: 'cash' },
        { EventID: 2, DonationAmount: 60, kind: 'cash' },
        { EventID: 2, DonationAmount: 15.25, kind: 'cash' },
        { EventID: 2, DonationAmount: 500, kind: 'qr' },
        { EventID: 3, DonationAmount: 20, kind: 'cash' },
        { EventID: 4, DonationAmount: 75, kind: 'card' },
      ],
      [],
      new Map(),
    );
    expect(board.rows.map((r) => [r.eventId, r.collectionStatus, r.loggedCash])).toEqual([
      [3, 'OPEN', 20],
      [2, 'CONCLUDED', 75.25],
      [1, 'RECONCILED', 100],
    ]);
    expect(board.metrics).toEqual({ awaitingCount: 2, awaitingLoggedCash: 95.25, concludedAwaitingCount: 1, reconciledCount: 1, totalOver: 0, totalShort: 2, netVariance: -2 });
    expect(board.overShortAccount).toBeNull();
  });
});

describe.each(drivers)('$name driver: batch coding and cash box audits', (d) => {
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

  it('codes every un-coded electronic donation to one Revenue line in a single posting', async () => {
    const db = await makePilot();
    const [fs, treasurer] = await Promise.all(['fs_user', 'treasurer_user'].map((u) => signIn(db, u)));
    const queue = await db.finance.getBatchCodingQueue(treasurer, OWN);
    // The seeded deposits (rally, picnic, pancake breakfast) are already coded; three electronic gifts wait.
    expect(queue.rows.map((r) => [r.methodName, r.donation.DonationAmount])).toEqual([
      ['Zelle', 400],
      ['Venmo', 260],
      ['Venmo', 150],
    ]);
    expect(queue.uncodedTotal).toBe(810);
    expect(queue.depositAccount?.id).toBe(OPERATING_CHECKING);
    expect(queue.revenueAccounts.map((a) => a.id)).toContain(PARKING_FUNDRAISING);

    const ids = queue.rows.map((r) => r.donation.id);
    await expectRule(db.finance.batchCodeDonations(fs, OWN, { donationIds: ids, revenueAccountId: PARKING_FUNDRAISING }), 'TREASURER_REQUIRED');
    const done = await db.finance.batchCodeDonations(treasurer, OWN, { donationIds: ids, revenueAccountId: PARKING_FUNDRAISING });
    expect(done).toMatchObject({ count: 3, total: 810, revenueAccountId: PARKING_FUNDRAISING, revenueAccountName: 'Parking Fundraising' });

    const posting = (await db.finance.listLedgerTransactions(treasurer, OWN)).find((t) => t.transactionId === done.batchId);
    expect(posting).toMatchObject({ amount: 810, lineCount: 2, linkedEventId: null });
    expect((await db.finance.getBatchCodingQueue(treasurer, OWN)).rows).toEqual([]);
    const coded = (await db.donations.list(OWN, {})).filter((x) => ids.includes(x.id));
    expect(coded.map((x) => [x.revenue_gl_account_id, x.coding_batch_id, x.coded_by_member_id])).toEqual(ids.map(() => [PARKING_FUNDRAISING, done.batchId, treasurer]));

    await expectRule(db.finance.batchCodeDonations(treasurer, OWN, { donationIds: [ids[0]!], revenueAccountId: PARKING_FUNDRAISING }), 'DONATION_ALREADY_CODED');
    const superAdmin = (await db.auth.signIn('testsuperadmin@kofc.org', PASSWORD))!.memberId;
    await expectRule(db.donations.update(superAdmin, ids[0]!, { DonationAmount: 1 }), 'DONATION_ALREADY_CODED');
    await expectRule(db.donations.remove(superAdmin, ids[0]!), 'DONATION_ALREADY_CODED');
  });

  it("locks the event's logs when a member concludes the session on the phone", async () => {
    const db = await makePilot();
    const [alpha, beta] = await Promise.all(['member_alpha', 'member_beta'].map((u) => signIn(db, u)));
    await db.events.setIntakeSessionStatus(alpha, PARKING_EVENT, 'Active');
    const concluded = await db.events.concludeCollectionSession(alpha, PARKING_EVENT);
    expect(concluded).toMatchObject({ collection_status: 'CONCLUDED', collection_concluded_by_member_id: alpha, IntakeSessionStatus: 'Inactive' });
    // A second phone tapping too keeps the first stamp.
    expect((await db.events.concludeCollectionSession(beta, PARKING_EVENT)).collection_concluded_by_member_id).toBe(alpha);

    const typeId = (await db.donations.listTypes(OWN))[0]!.id;
    const cash = (await db.donations.listMethods(OWN)).find((o) => o.kind === 'cash')!.method.id;
    await expectRule(db.donations.record(alpha, { CouncilID: OWN, EventID: PARKING_EVENT, DonationMethodID: cash, DonationTypeID: typeId, DonationAmount: 10 }), 'COLLECTION_SESSION_CONCLUDED');
    await expectRule(db.events.setIntakeSessionStatus(alpha, PARKING_EVENT, 'Active'), 'COLLECTION_SESSION_CONCLUDED');
    const logged = (await db.donations.list(OWN, { eventId: PARKING_EVENT })).find((x) => x.DonationAmount === 250)!;
    const superAdmin = (await db.auth.signIn('testsuperadmin@kofc.org', PASSWORD))!.memberId;
    await expectRule(db.donations.update(superAdmin, logged.id, { DonationAmount: 245 }), 'COLLECTION_SESSION_CONCLUDED');
    // Standalone donations still go through.
    expect((await db.donations.record(alpha, { CouncilID: OWN, DonationMethodID: cash, DonationTypeID: typeId, DonationAmount: 10 })).EventID).toBeNull();
  });

  it('closes the cash box audit with an Over/Short Reconciliation Line and leaves the phone logs untouched', async () => {
    const db = await makePilot();
    const [fs, treasurer, alpha] = await Promise.all(['fs_user', 'treasurer_user', 'member_alpha'].map((u) => signIn(db, u)));
    await db.events.concludeCollectionSession(alpha, PARKING_EVENT);
    const board = await db.finance.getCashAuditBoard(treasurer, OWN);
    const row = board.rows.find((r) => r.eventId === PARKING_EVENT)!;
    expect(row).toMatchObject({ loggedCash: 250, cashDonationCount: 1, collectionStatus: 'CONCLUDED', concludedByName: 'Member Alpha', verifiedCash: null });
    expect(board.overShortAccount).toBeNull();

    await expectRule(db.finance.closeCashAudit(fs, OWN, { eventId: PARKING_EVENT, verifiedCashAmount: 245, discrepancyReason: 'Torn $5 bill' }), 'TREASURER_REQUIRED');
    await expectRule(db.finance.closeCashAudit(treasurer, OWN, { eventId: PARKING_EVENT, verifiedCashAmount: 245 }), 'INVALID_INPUT');
    const after = await db.finance.closeCashAudit(treasurer, OWN, { eventId: PARKING_EVENT, verifiedCashAmount: 245, discrepancyReason: 'A $5 bill went home in a change apron' });
    const closed = after.rows.find((r) => r.eventId === PARKING_EVENT)!;
    expect(closed).toMatchObject({ collectionStatus: 'RECONCILED', verifiedCash: 245, variance: -5, verifiedByName: 'Treasurer User' });
    expect(after.metrics.netVariance).toBe(-5);
    expect(after.overShortAccount?.AccountName).toBe(CASH_OVER_SHORT_ACCOUNT_NAME);

    const overShort = await db.finance.getAccountLedger(treasurer, after.overShortAccount!.id);
    expect(overShort.rows.map((r) => [r.entry.DebitAmount, r.entry.CreditAmount, r.entry.LinkedEventID])).toEqual([[5, 0, PARKING_EVENT]]);
    expect(overShort.rows[0]!.entry.TransactionID).toBe(closed.overShortTransactionId);
    // The phone's log still says what was logged.
    expect((await db.donations.list(OWN, { eventId: PARKING_EVENT })).map((x) => x.DonationAmount).sort((a, b) => a - b)).toEqual([150, 250]);
    const event = await db.events.get(PARKING_EVENT);
    expect(event).toMatchObject({ verified_cash_amount: 245, cash_discrepancy_reason: 'A $5 bill went home in a change apron', cash_verified_by_member_id: treasurer });

    await expectRule(db.finance.closeCashAudit(treasurer, OWN, { eventId: PARKING_EVENT, verifiedCashAmount: 250 }), 'ILLEGAL_STATE_TRANSITION');
    await expectRule(db.events.concludeCollectionSession(alpha, PARKING_EVENT), 'ILLEGAL_STATE_TRANSITION');
  });

  it("concludes a session no phone concluded and posts nothing when the count matches", async () => {
    const db = await makePilot();
    const treasurer = await signIn(db, 'treasurer_user');
    const before = (await db.finance.listLedgerTransactions(treasurer, OWN)).length;
    const after = await db.finance.closeCashAudit(treasurer, OWN, { eventId: TOOTSIE_ROLL_EVENT, verifiedCashAmount: 1120.5 });
    expect(after.rows.find((r) => r.eventId === TOOTSIE_ROLL_EVENT)).toMatchObject({ collectionStatus: 'RECONCILED', variance: 0, overShortTransactionId: null, concludedByName: 'Treasurer User' });
    expect((await db.finance.listLedgerTransactions(treasurer, OWN)).length).toBe(before);
    expect(after.overShortAccount).toBeNull();
  });
});

describe('Sprint 8N: schema 84, the desk panels and the phone button', () => {
  it('bumps the phone database to 84 and records the release', () => {
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (8[4-9]|9\d|\d{3});/);
    const schema = read('Schema.sql');
    expect(schema).toContain('(schema version 84)');
    expect(schema).toContain('ALTER TABLE [Event] ADD [verified_cash_amount] DECIMAL(18,2) NULL;');
    expect(schema).toContain('ALTER TABLE [Event] ADD [cash_discrepancy_reason] VARCHAR(255) NULL;');
    expect(schema).toContain("ALTER TABLE [Event] ADD [collection_status] VARCHAR(20) NOT NULL DEFAULT 'OPEN';");
    expect(schema).toContain('ALTER TABLE [Donation] ADD [revenue_gl_account_id] INT NULL;');
  });

  it('opens the Treasurer Desk with the cash box panel and the batch coder', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks.indexOf('<CashBoxAuditPanel')).toBeGreaterThan(0);
    expect(desks.indexOf('<CashBoxAuditPanel')).toBeLessThan(desks.indexOf('<BatchTransactionCoder'));
    expect(desks).not.toContain('<ParishSplitConsoleCard');
    expect(read('apps/web/components/CashAuditParts.tsx')).toContain('SELECT_ALL_UNCODED_LABEL');
    expect(SELECT_ALL_UNCODED_LABEL).toBe('[✓ Select All Un-coded Transactions]');
  });

  it("puts the conclude button on the phone's Donate tab", () => {
    expect(CONCLUDE_EVENT_SESSION_LABEL).toBe('[ 🛑 Conclude Event Session & Lock Logs ]');
    const donate = read('apps/mobile/app/(app)/donate.tsx');
    expect(donate).toContain('CONCLUDE_EVENT_SESSION_LABEL');
    expect(donate).toContain('db.events.concludeCollectionSession');
  });
});
