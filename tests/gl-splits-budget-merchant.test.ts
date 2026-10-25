// Sprint 9 Revision 6.0 (schema 99): GL Split Accounts on the batch coder (gl-splits.ts), the Budget Analyzer's charts
// over the council's own budget categories (budget-category-charts.ts) and the merchant account label on the phone's QR
// screens (account-ownership.ts merchantAccountLine).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildBudgetCategoryCharts,
  CHART_NEUTRAL_COLOR,
  CHART_SERIES_COLORS,
  cleanGLSplitProfile,
  currentFraternalYear,
  donutSlicePath,
  expandSplitJournalLines,
  maySplitAccount,
  merchantAccountLine,
  buildGLSplitProfiles,
  splitAccountIdsOf,
  PLATFORM_SCHEMA_VERSION,
  splitAmount,
  type BudgetCategoryPerformance,
  type CleanJournalLine,
  type DataService,
  type GLAccount,
  type GLAccountSplitAllocation,
  type GLSplitProfile,
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
const PARKING_FUNDRAISING = 8;
const PARISH_SHARE = 16;
const PILOT_DAY = new Date(2026, 9, 12, 19, 0, 0);

const account = (id: number, AccountType: GLAccount['AccountType'], extra: Partial<GLAccount> = {}): GLAccount => ({
  id,
  CouncilID: OWN,
  AccountName: `Account ${id}`,
  AccountType,
  ParentAccountID: null,
  IsVirtualGoal: 0,
  TargetGoalAmount: 0,
  ...extra,
});

describe('schema 99', () => {
  it('adds the split columns and table and the merchant account label, and moves every version marker', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('(schema version 99)');
    expect(TABLES.GLAccount.columns.map((c) => c.name)).toContain('is_split_account');
    expect(TABLES.GLAccountSplitAllocation.columns.map((c) => c.name)).toEqual(['id', 'source_gl_account_id', 'destination_gl_account_id', 'split_percentage']);
    expect(TABLES.CouncilDonationMethod.columns.map((c) => c.name)).toContain('account_identity_label');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (99|\d{3});/);
    expect(PLATFORM_SCHEMA_VERSION).toBeGreaterThanOrEqual(99);
  });
});

describe('split profile rules (pure)', () => {
  const accounts = [
    account(1, 'Asset'),
    account(8, 'Revenue'),
    account(9, 'Revenue'),
    account(10, 'Revenue'),
    account(11, 'Revenue', { is_split_account: 1 }),
    account(12, 'Expense'),
    account(13, 'Revenue', { IsVirtualGoal: 1 }),
  ];
  const clean = (input: unknown, allocations: GLAccountSplitAllocation[] = []) => cleanGLSplitProfile(OWN, 8, input, accounts, allocations);

  it('takes same-type destinations whose shares add up to 100', () => {
    expect(
      clean({
                destinations: [
          { destinationAccountId: 9, percentage: 33.33 },
          { destinationAccountId: 10, percentage: 66.67 },
        ],
      }),
    ).toEqual([
      { destinationAccountId: 9, percentage: 33.33 },
      { destinationAccountId: 10, percentage: 66.67 },
    ]);
    expect(clean({ destinations: [] })).toEqual([]);
  });

  it('refuses shares off 100, bad destinations and a destination becoming a split account', () => {
    const one = (destinationAccountId: number, percentage = 100) => ({ destinations: [{ destinationAccountId, percentage }] });
    expect(() => clean({ destinations: [{ destinationAccountId: 9, percentage: 60 }] })).toThrow(/add up to 100%/);
    expect(() => clean(one(8))).toThrow(/its own destination/);
    expect(() => clean(one(11), [{ id: 9, source_gl_account_id: 11, destination_gl_account_id: 10, split_percentage: 100 }])).toThrow(/is a Split Account/);
    expect(() => clean(one(12))).toThrow(/must be a Revenue account/);
    expect(() => clean(one(13))).toThrow(/virtual goal/);
    expect(() => clean(one(99))).toThrow(/not an account of this council/);
    expect(() => clean(one(9, 100.001))).toThrow(/two decimals/);
    // Sprint 9 Revision 6.2: no switch - an empty list ends the split, and the list itself is required.
    expect(clean({ destinations: [] })).toEqual([]);
    expect(() => clean({})).toThrow(/List the destination accounts/);
    expect(() => clean({ isSplitAccount: true })).toThrow(/List the destination accounts/);
    expect(() =>
      clean(
        {
                    destinations: [
            { destinationAccountId: 9, percentage: 50 },
            { destinationAccountId: 9, percentage: 50 },
          ],
        },
      ),
    ).toThrow(/listed twice/);
    // Account 8 already receives a share of account 11, so it cannot split.
    expect(() => clean(one(9), [{ id: 1, source_gl_account_id: 11, destination_gl_account_id: 8, split_percentage: 100 }])).toThrow(/receives a share/);
  });

  it('shares an amount to the cent, the last destination taking the rounding', () => {
    expect(splitAmount(100, [{ percentage: 33.33 }, { percentage: 33.33 }, { percentage: 33.34 }])).toEqual([33.33, 33.33, 33.34]);
    expect(splitAmount(0.01, [{ percentage: 50 }, { percentage: 50 }])).toEqual([0.01, 0]);
    expect(splitAmount(810, [{ percentage: 50 }, { percentage: 50 }])).toEqual([405, 405]);
  });

  it('replaces only the split account line with one line per destination', () => {
    const base = { Description: 'Batch', DateLogged: '2026-10-12', LinkedEventID: null, LinkedMeetingID: null, CheckNumber: null };
    const lines: CleanJournalLine[] = [
      { ...base, GLAccountID: 1, DebitAmount: 10, CreditAmount: 0 },
      { ...base, GLAccountID: 8, DebitAmount: 0, CreditAmount: 10 },
    ];
    const profile: GLSplitProfile = {
      accountId: 8,
      accountName: 'Parking',
      accountType: 'Revenue',
      destinations: [
        { destinationAccountId: 9, destinationAccountName: 'Council', percentage: 70 },
        { destinationAccountId: 10, destinationAccountName: 'Parish', percentage: 30 },
      ],
    };
    const out = expandSplitJournalLines(lines, [profile]);
    expect(out.map((l) => [l.GLAccountID, l.DebitAmount, l.CreditAmount])).toEqual([
      [1, 10, 0],
      [9, 0, 7],
      [10, 0, 3],
    ]);
    expect(out[1]!.Description).toBe('Batch (70% of Parking)');
    expect(expandSplitJournalLines(lines, [])).toEqual(lines);
    // Sprint 9 Revision 6.1: a split left on a non-Revenue account is never applied; a second pass changes nothing.
    expect(expandSplitJournalLines(lines, [{ ...profile, accountType: 'Expense' }])).toEqual(lines);
    expect(expandSplitJournalLines(out, [profile])).toEqual(out);
  });

  it('lets only a Revenue account become a Split Account (Revision 6.1), but any account stop splitting', () => {
    const one = (id: number) => ({ destinations: [{ destinationAccountId: id, percentage: 100 }] });
    const expense = [account(12, 'Expense'), account(14, 'Expense'), account(1, 'Asset'), account(2, 'Asset')];
    expect(() => cleanGLSplitProfile(OWN, 12, one(14), expense, [])).toThrow(/only Revenue accounts can be Split Accounts/);
    expect(() => cleanGLSplitProfile(OWN, 1, one(2), expense, [])).toThrow(/only Revenue accounts/);
    expect(cleanGLSplitProfile(OWN, 12, { destinations: [] }, expense, [])).toEqual([]);
    expect([maySplitAccount(account(8, 'Revenue')), maySplitAccount(account(12, 'Expense')), maySplitAccount(account(13, 'Revenue', { IsVirtualGoal: 1 }))]).toEqual([
      true,
      false,
      false,
    ]);
  });
});

describe('implicit split accounts and the event override (Revision 6.2, pure)', () => {
  const accounts = [account(1, 'Asset'), account(8, 'Revenue', { is_split_account: 0 }), account(9, 'Revenue', { is_split_account: 1 }), account(10, 'Revenue')];
  const rows = [{ id: 1, source_gl_account_id: 8, destination_gl_account_id: 10, split_percentage: 100 }];

  it('makes an account a Split Account by its destination rows alone, whatever the mirror column says', () => {
    expect([...splitAccountIdsOf(rows)]).toEqual([8]);
    expect(buildGLSplitProfiles(OWN, accounts, rows).map((p) => p.accountId)).toEqual([8]);
    // Account 9's stale mirror flag makes it nothing: it has no rows, so it may receive a share.
    expect(cleanGLSplitProfile(OWN, 8, { destinations: [{ destinationAccountId: 9, percentage: 100 }] }, accounts, rows)).toEqual([{ destinationAccountId: 9, percentage: 100 }]);
  });
});

describe.each(drivers)('$name driver: split accounts on the batch coder', (d) => {
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
  const creditsOf = async (db: DataService, actor: number) => {
    const out = new Map<number, number>();
    const walk = (nodes: Awaited<ReturnType<DataService['finance']['listChartOfAccounts']>>['accounts']) =>
      nodes.forEach((n) => {
        out.set(n.account.id, n.creditTotal);
        walk(n.children);
      });
    walk((await db.finance.listChartOfAccounts(actor, OWN)).accounts);
    return out;
  };

  it('lets only the Treasurer set a profile, and posts a coded batch to the destinations', async () => {
    const db = await makePilot();
    const [fs, treasurer] = await Promise.all(['fs_user', 'treasurer_user'].map((u) => signIn(db, u)));
    const profile = {
            destinations: [
        { destinationAccountId: PARISH_SHARE, percentage: 40 },
        { destinationAccountId: PARKING_FUNDRAISING, percentage: 60 },
      ],
    };
    const queue = await db.finance.getBatchCodingQueue(treasurer, OWN);
    const other = queue.revenueAccounts.find((a) => a.id !== PARKING_FUNDRAISING && a.id !== PARISH_SHARE)!;
    expect(other).toBeDefined();

    // The split account is another Revenue line; Parking Fundraising and the parish share receive the shares.
    await expectRule(db.finance.setGLSplitProfile(fs, OWN, other.id, profile), 'TREASURER_REQUIRED');
    const saved = await db.finance.setGLSplitProfile(treasurer, OWN, other.id, profile);
    expect(saved).toEqual([
      {
        accountId: other.id,
        accountName: other.AccountName,
        accountType: 'Revenue',
        destinations: [
          { destinationAccountId: PARISH_SHARE, destinationAccountName: 'Parish Fundraiser Share', percentage: 40 },
          { destinationAccountId: PARKING_FUNDRAISING, destinationAccountName: 'Parking Fundraising', percentage: 60 },
        ],
      },
    ]);
    expect(await db.finance.listGLSplitProfiles(fs, OWN)).toEqual(saved);
    await expectRule(db.finance.setGLSplitProfile(treasurer, OWN, PARISH_SHARE, { destinations: [{ destinationAccountId: other.id, percentage: 100 }] }), 'INVALID_INPUT');

    const before = await creditsOf(db, treasurer);
    const ids = queue.rows.map((r) => r.donation.id);
    const done = await db.finance.batchCodeDonations(treasurer, OWN, { donationIds: ids, revenueAccountId: other.id });
    expect(done.splits).toEqual([
      { destinationAccountId: PARISH_SHARE, destinationAccountName: 'Parish Fundraiser Share', amount: 324 },
      { destinationAccountId: PARKING_FUNDRAISING, destinationAccountName: 'Parking Fundraising', amount: 486 },
    ]);
    const after = await creditsOf(db, treasurer);
    expect(after.get(other.id)).toBe(before.get(other.id));
    expect((after.get(PARISH_SHARE) ?? 0) - (before.get(PARISH_SHARE) ?? 0)).toBe(324);
    expect((after.get(PARKING_FUNDRAISING) ?? 0) - (before.get(PARKING_FUNDRAISING) ?? 0)).toBe(486);
    const posting = (await db.finance.listLedgerTransactions(treasurer, OWN)).find((t) => t.transactionId === done.batchId);
    expect(posting).toMatchObject({ amount: 810, lineCount: 3 });
    // The donations keep the line they were coded to.
    const coded = (await db.donations.list(OWN, {})).filter((x) => ids.includes(x.id));
    expect(new Set(coded.map((x) => x.revenue_gl_account_id))).toEqual(new Set([other.id]));

    // Switching the split off clears its destinations.
    expect(await db.finance.setGLSplitProfile(treasurer, OWN, other.id, { destinations: [] })).toEqual([]);
    expect((await db.finance.getBatchCodingQueue(treasurer, OWN)).revenueAccounts.find((a) => a.id === other.id)?.is_split_account).toBe(0);
  });

  it('splits every posting to a Revenue split account: manual rows and concluded event revenue (Revision 6.1)', async () => {
    const db = await makePilot();
    const superAdmin = (await db.auth.signIn('testsuperadmin@kofc.org', PASSWORD))!.memberId;
    const treasurer = await signIn(db, 'treasurer_user');
    const queue = await db.finance.getBatchCodingQueue(treasurer, OWN);
    const split = queue.revenueAccounts.find((a) => a.id !== PARKING_FUNDRAISING && a.id !== PARISH_SHARE)!;
    const cash = queue.depositAccount!;
    const rowsBefore = (await db.finance.getAccountLedger(superAdmin, split.id)).rows.length;
    await db.finance.setGLSplitProfile(treasurer, OWN, split.id, {
            destinations: [
        { destinationAccountId: PARISH_SHARE, percentage: 25 },
        { destinationAccountId: PARKING_FUNDRAISING, percentage: 75 },
      ],
    });

    // A manual double-entry posting: the credit on the split account is stored as its two shares, in its place.
    const manual = await db.finance.logDoubleEntryTransaction(superAdmin, [
      { GLAccountID: cash.id, DebitAmount: 100, Description: 'Bake sale deposit' },
      { GLAccountID: split.id, CreditAmount: 100, Description: 'Bake sale deposit' },
    ]);
    expect(manual.map((l) => [l.GLAccountID, l.DebitAmount, l.CreditAmount])).toEqual([
      [cash.id, 100, 0],
      [PARISH_SHARE, 0, 25],
      [PARKING_FUNDRAISING, 0, 75],
    ]);
    expect(new Set(manual.map((l) => l.TransactionID)).size).toBe(1);

    // Concluded event revenue logged to the split account.
    const past = await db.events.create(
      { EventName: 'Fish fry', EventDescription: 'Hall', OwnerID: superAdmin, StartDate: '2026-09-12', EndDate: '2026-09-12', Location: 'Hall', CategoryID: 1 },
      [OWN],
    );
    const revenue = await db.finance.logConcludedRevenue(superAdmin, OWN, { LinkedEventID: past.id, Amount: 300.01, RevenueAccountID: split.id, DateLogged: '2026-09-13' });
    expect(revenue.filter((l) => l.CreditAmount > 0).map((l) => [l.GLAccountID, l.CreditAmount, l.LinkedEventID])).toEqual([
      [PARISH_SHARE, 75, past.id],
      [PARKING_FUNDRAISING, 225.01, past.id],
    ]);

    // The split account itself takes no new posting.
    expect((await db.finance.getAccountLedger(superAdmin, split.id)).rows).toHaveLength(rowsBefore);
  });

  it('splits one event batch by a one-time Event Split Override, leaving the master profile alone (Revision 6.2)', async () => {
    const db = await makePilot();
    const [fs, treasurer] = await Promise.all(['fs_user', 'treasurer_user'].map((u) => signIn(db, u)));
    const queue = await db.finance.getBatchCodingQueue(treasurer, OWN);
    const split = queue.revenueAccounts.find((a) => a.id !== PARKING_FUNDRAISING && a.id !== PARISH_SHARE)!;
    const master = [
      { destinationAccountId: PARISH_SHARE, percentage: 50 },
      { destinationAccountId: PARKING_FUNDRAISING, percentage: 50 },
    ];
    await db.finance.setGLSplitProfile(treasurer, OWN, split.id, { destinations: master });
    expect((await db.finance.getBatchCodingQueue(treasurer, OWN)).splitProfiles.map((p) => p.accountId)).toEqual([split.id]);

    // The un-coded gifts: Zelle $400 (event 1?) and two Venmo gifts; pick the donations of one event.
    const byEvent = new Map<number, number[]>();
    for (const r of queue.rows) if (r.donation.EventID != null) byEvent.set(r.donation.EventID, [...(byEvent.get(r.donation.EventID) ?? []), r.donation.id]);
    const [eventId, ids] = [...byEvent.entries()][0]!;
    const amount = queue.rows.filter((r) => ids.includes(r.donation.id)).reduce((t, r) => t + r.donation.DonationAmount, 0);
    const override = [
      { destinationAccountId: PARISH_SHARE, percentage: 10 },
      { destinationAccountId: PARKING_FUNDRAISING, percentage: 90 },
    ];

    // Only the Treasurer codes; the override follows the split rules and needs one event's donations.
    await expectRule(db.finance.batchCodeDonations(fs, OWN, { donationIds: ids, revenueAccountId: split.id, eventSplitOverride: override }), 'TREASURER_REQUIRED');
    await expectRule(
      db.finance.batchCodeDonations(treasurer, OWN, { donationIds: ids, revenueAccountId: split.id, eventSplitOverride: [{ destinationAccountId: PARISH_SHARE, percentage: 60 }] }),
      'INVALID_INPUT',
    );
    await expectRule(
      db.finance.batchCodeDonations(treasurer, OWN, { donationIds: ids, revenueAccountId: split.id, eventSplitOverride: [{ destinationAccountId: split.id, percentage: 100 }] }),
      'INVALID_INPUT',
    );
    const standalone = queue.rows.find((r) => r.donation.EventID == null);
    if (standalone) {
      await expectRule(
        db.finance.batchCodeDonations(treasurer, OWN, { donationIds: [ids[0]!, standalone.donation.id], revenueAccountId: split.id, eventSplitOverride: override }),
        'INVALID_INPUT',
      );
    }

    const done = await db.finance.batchCodeDonations(treasurer, OWN, { donationIds: ids, revenueAccountId: split.id, eventSplitOverride: override });
    expect(done.overridden).toBe(true);
    expect(done.splits.map((x) => [x.destinationAccountId, x.amount])).toEqual([
      [PARISH_SHARE, Math.round(amount * 10) / 100],
      [PARKING_FUNDRAISING, Math.round(amount * 100 - Math.round(amount * 10)) / 100],
    ]);
    const posting = (await db.finance.listLedgerTransactions(treasurer, OWN)).find((t) => t.transactionId === done.batchId);
    expect(posting).toMatchObject({ amount, lineCount: 3, linkedEventId: eventId });
    // The master profile is untouched.
    expect((await db.finance.listGLSplitProfiles(treasurer, OWN))[0]!.destinations.map((x) => x.percentage)).toEqual([50, 50]);

    // An override may also split an ordinary Revenue line, keeping part of the money on it.
    const rest = (await db.finance.getBatchCodingQueue(treasurer, OWN)).rows.filter((r) => r.donation.EventID != null && r.donation.EventID !== eventId);
    if (rest.length > 0) {
      const next = rest.filter((r) => r.donation.EventID === rest[0]!.donation.EventID);
      const plain = await db.finance.batchCodeDonations(treasurer, OWN, {
        donationIds: next.map((r) => r.donation.id),
        revenueAccountId: PARKING_FUNDRAISING,
        eventSplitOverride: [
          { destinationAccountId: PARKING_FUNDRAISING, percentage: 75 },
          { destinationAccountId: PARISH_SHARE, percentage: 25 },
        ],
      });
      expect(plain.splits.map((x) => x.destinationAccountId)).toEqual([PARKING_FUNDRAISING, PARISH_SHARE]);
    }
  });

  it('keeps the account name donors see on each payment method and hands it to the phone', async () => {
    const db = await makePilot();
    const admin = (await db.auth.signIn('testsuperadmin@kofc.org', PASSWORD))!.memberId;
    const methods = await db.donations.listMethods(OWN);
    const venmo = methods.find((m) => m.method.DonationMethod === 'Venmo')!;
    await db.lookups.saveCouncilSpecific(admin, OWN, 'CouncilDonationMethod', [
      {
        id: venmo.link.id,
        DonationMethodID: venmo.method.id,
        DonationMethodURL: venmo.link.DonationMethodURL ?? null,
        account_owner_entity: 'PARISH',
        account_identity_label: "St. Mary's Cathedral Parish",
      },
    ]);
    const after = (await db.donations.listMethods(OWN)).find((m) => m.link.id === venmo.link.id)!;
    expect(merchantAccountLine(after.link)).toBe("Pays into St. Mary's Cathedral Parish (Parish account)");
    await expectRule(
      db.lookups.saveCouncilSpecific(admin, OWN, 'CouncilDonationMethod', [
        { id: venmo.link.id, DonationMethodID: venmo.method.id, account_owner_entity: 'PARISH', account_identity_label: 'x'.repeat(101) },
      ]),
      'INVALID_INPUT',
    );
  });

  it('feeds the category charts from the year\'s progress', async () => {
    const db = await makePilot();
    const treasurer = await signIn(db, 'treasurer_user');
    const progress = await db.budget.getBudgetProgress(treasurer, OWN, currentFraternalYear(PILOT_DAY));
    const charts = buildBudgetCategoryCharts(progress);
    expect(charts.slices.length).toBe(progress.categories.length);
    expect(charts.slices.reduce((t, s) => t + Math.round(s.amount * 100), 0) / 100).toBe(charts.total);
  });
});

describe('merchant account line and budget category charts (pure)', () => {
  it('names the account owner, with the label when there is one', () => {
    expect(merchantAccountLine({ account_owner_entity: 'COUNCIL', account_identity_label: '  ' })).toBe("Pays into the council's account");
    expect(merchantAccountLine({ account_owner_entity: 'PARISH' })).toBe("Pays into the parish's account");
    expect(merchantAccountLine(null)).toBe("Pays into the council's account");
    expect(merchantAccountLine({ account_owner_entity: 'THIRD_PARTY', account_identity_label: 'Zeffy for St. Mary' })).toBe('Pays into Zeffy for St. Mary (Third-party account)');
  });

  const category = (categoryId: number | null, label: string, proposed: number, approved: number, actual: number): BudgetCategoryPerformance => ({
    categoryId,
    label,
    lineCount: 1,
    proposed,
    approved,
    actual,
    variance: approved - actual,
    percentUsed: null,
    alert: 'On Track' as BudgetCategoryPerformance['alert'],
  });

  it('shares the approved budget once Approved, keeps colour slots by list order and folds past eight', () => {
    const named = Array.from({ length: 10 }, (_, i) => category(i + 1, `Fund ${i + 1}`, 100, 200, i === 0 ? 250 : 50));
    const charts = buildBudgetCategoryCharts({ status: 'Approved', throughDate: '2026-10-12', categories: [...named, category(null, 'Uncategorized', 0, 400, 0)] });
    expect(charts.basis).toBe('approved');
    expect(charts.slices.map((s) => s.label)).toEqual(['Fund 1', 'Fund 2', 'Fund 3', 'Fund 4', 'Fund 5', 'Fund 6', 'Fund 7', 'Fund 8', 'Other', 'Uncategorized']);
    expect(charts.slices.slice(0, 8).map((s) => s.color)).toEqual([...CHART_SERIES_COLORS]);
    expect(charts.slices.slice(8).map((s) => s.color)).toEqual([CHART_NEUTRAL_COLOR, CHART_NEUTRAL_COLOR]);
    expect(charts.slices[8]).toMatchObject({ amount: 400, approved: 400, actual: 100 });
    expect(charts.total).toBe(2400);
    expect(charts.slices[0]).toMatchObject({ sharePercent: 8.3, percentUsed: 125, overBudget: true });
  });

  it('shares the proposed budget before approval', () => {
    const charts = buildBudgetCategoryCharts({ status: 'Draft', throughDate: '2026-10-12', categories: [category(1, 'A', 300, 0, 0), category(2, 'B', 100, 0, 0)] });
    expect(charts.basis).toBe('proposed');
    expect(charts.slices.map((s) => [s.sharePercent, s.percentUsed])).toEqual([
      [75, null],
      [25, null],
    ]);
  });

  it('draws a donut slice as a closed ring segment', () => {
    expect(donutSlicePath(110, 110, 100, 60, 0, Math.PI / 2)).toBe('M 110.000 10.000 A 100 100 0 0 1 210.000 110.000 L 170.000 110.000 A 60 60 0 0 0 110.000 50.000 Z');
  });
});

describe('screens', () => {
  it('puts the split editor on the Treasurer chart, the category panel on the Budget page and the payee on the phone QR screens', () => {
    expect(read('apps/web/components/modules/ChartOfAccountsSetup.tsx')).toContain('db.finance.setGLSplitProfile(');
    expect(read('apps/web/components/CashAuditParts.tsx')).toContain('done.splits');
    expect(read('apps/web/components/AnnualBudgetCenter.tsx')).toContain('<BudgetCategoryManager');
    expect(read('apps/web/components/BudgetAnalyzerParts.tsx')).toContain('<BudgetCategoryCharts progress={progress} />');
    expect(read('apps/web/app/council-lookups/page.tsx')).toContain("key: 'account_identity_label'");
    expect(read('apps/mobile/components/CollectionQrModal.tsx')).toContain('{payee}');
    expect(read('apps/mobile/components/DonationQr.tsx')).toContain('{payee}');
    expect(read('apps/mobile/app/(app)/donate.tsx')).toContain('merchantAccountLine(option.link)');
  });
});
