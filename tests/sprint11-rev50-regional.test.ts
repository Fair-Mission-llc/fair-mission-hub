// Sprint 11 Revision 5.0 (schema 104): regional oversight (District and State Desks, assignment gates, State Councils),
// web passkeys in UserPasskeys, the database-level QR channel rule, sister-council shares in the batch override, and
// the regional test logins.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertMayAssignRegional,
  assertQrLinkAllowed,
  buildRegionalDeskReport,
  cleanRegionalAssignmentInput,
  filterRegionalCalendar,
  HUB_SERVER_ONLY_NAMESPACES,
  assertHubCallAllowed,
  paymentChannelOf,
  PLATFORM_SCHEMA_VERSION,
  portalAreas,
  PORTAL_NAV_GROUPS,
  REGIONAL_DESK_DRAWERS,
  REGIONAL_DESK_TABLES,
  regionalCouncilIds,
  STATE_COUNCIL_TEMPLATE_ACCOUNTS,
  topVolunteers,
  type DataService,
  type RegionalDeskRows,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { openDatabases } from './shims/expo-sqlite';
import { drivers, expectRule, MEMBER, NOW, rawInsert } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const PASSWORD = 'Fraternal2026!';
const TIM = 35;
const DD = 36;
const STATE = 37;

const admin = (memberType: string, memberId = 99) => ({ memberId, memberType, active: true });

describe('1. schema 104', () => {
  it('moves the platform to 104 with the new tables and the QR channel rule', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(104);
    const schema = read('Schema.sql');
    for (const t of ['UserPasskeys', 'MemberRegionalAssignment', 'MemberRegionalCouncil']) expect(TABLES[t]).toBeDefined();
    expect(schema).toContain("CHECK ([DonationMethodURL] IS NULL OR [payment_channel] IN ('DIGITAL'))");
    expect(TABLES.CouncilDonationMethod!.rowChecks).toEqual([
      { name: 'CK_CouncilDonationMethod_qr_channel', nullColumn: 'DonationMethodURL', column: 'payment_channel', allowed: ['DIGITAL'] },
    ]);
    expect(read('apps/mobile/services/generated/schema.sqlite.ts')).toContain("CONSTRAINT [CK_CouncilDonationMethod_qr_channel] CHECK ([DonationMethodURL] IS NULL OR [payment_channel] IN ('DIGITAL'))");
    expect(TABLES.Council!.columns.find((c) => c.name === 'council_level')).toMatchObject({ allowed: ['LOCAL', 'STATE'] });
  });

  it('maps every payment method to its channel and refuses QR links off the digital ones', () => {
    expect(['Cash', 'Check', 'Credit Card', 'Physical Items', 'Venmo', 'Zelle'].map(paymentChannelOf)).toEqual(['CASH', 'CHECK', 'CARD_READER', 'PHYSICAL_ITEM', 'DIGITAL', 'DIGITAL']);
    expect(() => assertQrLinkAllowed('Cash', 'https://x/qr.png')).toThrow(/never shows a QR code/);
    expect(() => assertQrLinkAllowed('Physical Items', 'https://x/qr.png')).toThrow();
    expect(() => assertQrLinkAllowed('Cash', null)).not.toThrow();
    expect(() => assertQrLinkAllowed('Venmo', 'https://x/qr.png')).not.toThrow();
  });
});

describe.each(drivers)('2. the database blocks QR links off digital methods [$name]', (d) => {
  it('refuses a raw Cash row with a QR link, below every app check', async () => {
    const db = await d.make();
    const council = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 99504, CouncilName: 'QR Test', State: 'OR' });
    const cash = (await db.donations.listAllMethods()).find((m) => m.DonationMethod === 'Cash')!;
    const venmo = (await db.donations.listAllMethods()).find((m) => m.DonationMethod === 'Venmo')!;
    expect(() => rawInsert(db, 'CouncilDonationMethod', { CouncilID: council.id, DonationMethodID: cash.id, DonationMethodURL: 'https://x/qr.png', payment_channel: 'CASH' })).toThrow(
      /CHECK constraint failed/,
    );
    expect(rawInsert(db, 'CouncilDonationMethod', { CouncilID: council.id, DonationMethodID: venmo.id, DonationMethodURL: 'https://x/qr.png', payment_channel: 'DIGITAL' })).toBeGreaterThan(0);
    // The drivers stamp the channel on every save.
    const saved = await db.lookups.saveCouncilSpecific(MEMBER.superAdmin, council.id, 'CouncilDonationMethod', [{ DonationMethodID: cash.id, account_owner_entity: 'COUNCIL' }]);
    expect(saved.find((m) => m.DonationMethodID === cash.id)).toMatchObject({ payment_channel: 'CASH' });
  });

  it('gives a new State Council instance its own checking account and books', async () => {
    const db = await d.make();
    const state = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 900099, CouncilName: 'Test State Council', State: 'WA', council_level: 'STATE' });
    expect(state.council_level).toBe('STATE');
    const chart = await db.finance.listChartOfAccounts(MEMBER.superAdmin, state.id);
    expect(chart.accounts.map((n) => n.account.AccountName).sort()).toEqual(STATE_COUNCIL_TEMPLATE_ACCOUNTS.map((a) => a.AccountName).sort());
    const local = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 99505, CouncilName: 'Local', State: 'WA' });
    expect(local.council_level).toBe('LOCAL');
  });
});

describe('3. regional rules', () => {
  it('cleans an assignment and requires a District Deputy to have councils', () => {
    expect(cleanRegionalAssignmentInput({ memberId: 4, assignmentType: 'STATE_OFFICER', stateCode: ' or ', councilIds: [3, 1, 3] })).toEqual({
      memberId: 4,
      assignmentType: 'STATE_OFFICER',
      stateCode: 'OR',
      councilIds: [1, 3],
    });
    expect(() => cleanRegionalAssignmentInput({ memberId: 4, assignmentType: 'DISTRICT_DEPUTY', stateCode: 'OR', councilIds: [] })).toThrow(/at least one council/);
    expect(() => cleanRegionalAssignmentInput({ memberId: 4, assignmentType: 'GRAND_POOBAH', stateCode: 'OR', councilIds: [] })).toThrow();
  });

  it('lets Super Admins assign anywhere and State Admins only inside their state', () => {
    const states = new Map([
      [1, 'OR'],
      [6, 'WA'],
    ]);
    const dd = { assignmentType: 'DISTRICT_DEPUTY' as const, stateCode: 'OR', councilIds: [1] };
    expect(() => assertMayAssignRegional(admin('Super Admin'), null, { ...dd, councilIds: [6] }, 'WA', states)).not.toThrow();
    expect(() => assertMayAssignRegional(admin('Member'), 'OR', dd, 'OR', states)).not.toThrow();
    expect(() => assertMayAssignRegional(admin('Member'), 'OR', { ...dd, councilIds: [6] }, 'OR', states)).toThrow(/outside it/);
    expect(() => assertMayAssignRegional(admin('Member'), 'OR', dd, 'WA', states)).toThrow(/home council/);
    expect(() => assertMayAssignRegional(admin('Member'), 'OR', { ...dd, assignmentType: 'STATE_ADMIN' }, 'OR', states)).toThrow(/Only a Super Admin can make a State Admin/);
    expect(() => assertMayAssignRegional(admin('Admin'), null, dd, 'OR', states)).toThrow(/Super Admin or a State Admin/);
  });

  it('scopes each desk to the reader', () => {
    const councils = [
      { id: 1, State: 'OR' },
      { id: 6, State: 'WA' },
      { id: 7, State: 'OR' },
    ];
    expect(regionalCouncilIds('state', admin('Super Admin'), null, councils)).toEqual([1, 6, 7]);
    expect(regionalCouncilIds('district', admin('Member'), { assignmentType: 'DISTRICT_DEPUTY', stateCode: 'OR', councilIds: [7, 1] }, councils)).toEqual([7, 1]);
    expect(regionalCouncilIds('state', admin('Member'), { assignmentType: 'STATE_OFFICER', stateCode: 'OR', councilIds: [6] }, councils)).toEqual([1, 6, 7]);
    expect(() => regionalCouncilIds('state', admin('Member'), { assignmentType: 'DISTRICT_DEPUTY', stateCode: 'OR', councilIds: [1] }, councils)).toThrow();
    expect(() => regionalCouncilIds('district', admin('Member'), null, councils)).toThrow();
  });

  it('lists the eight drawers in the exact order and filters the calendar and leaderboard', () => {
    expect(REGIONAL_DESK_DRAWERS.map((d) => d.label)).toEqual([
      'Council Directory & Affiliation Networks',
      'Financial & Budgetary Balance Rollups',
      'Activity & Volunteer Hours Summary',
      'Charitable Contributions & Grant Audits',
      'Master Regional Calendar',
      'Combined Physical Asset Ledger',
      'Council Goals Progress Center',
      'Top Performers & Volunteer Leaderboards',
    ]);
    const items = [
      { kind: 'event' as const, id: 1, title: 'A', date: '2026-11-01', location: '', councilIds: [1] },
      { kind: 'meeting' as const, id: 2, title: 'B', date: '2026-11-02', location: '', councilIds: [7] },
    ];
    expect(filterRegionalCalendar(items, []).length).toBe(2);
    expect(filterRegionalCalendar(items, [7]).map((i) => i.id)).toEqual([2]);
    const volunteers = Array.from({ length: 14 }, (_, i) => ({ memberId: i + 1, name: `M${i}`, councilId: i % 2 ? 7 : 1, hours: 20 - i }));
    expect(topVolunteers(volunteers)).toHaveLength(10);
    expect(topVolunteers(volunteers, 7).map((v) => v.memberId)).toEqual([2, 4, 6, 8, 10]);
  });

  it('adds up hours, cash and assets for the region only', () => {
    const empty = Object.fromEntries(REGIONAL_DESK_TABLES.map((t) => [t, []])) as unknown as Record<string, Record<string, unknown>[]>;
    const rows = {
      ...empty,
      Council: [
        { id: 1, CouncilNumber: 15295, CouncilName: 'A', State: 'OR', council_level: 'LOCAL' },
        { id: 2, CouncilNumber: 2042, CouncilName: 'B', State: 'OR', council_level: 'LOCAL' },
      ],
      MemberStatus: [{ id: 1, Status: 'Active' }],
      Member: [
        { id: 10, CouncilID: 1, MemberFirstName: 'Al', MemberLastName: 'One', StatusID: 1 },
        { id: 20, CouncilID: 2, MemberFirstName: 'Bo', MemberLastName: 'Two', StatusID: 1 },
      ],
      ActivityTime: [
        { MemberID: 10, ActivityDate: '2026-08-01', Hours: 5 },
        { MemberID: 10, ActivityDate: '2025-08-01', Hours: 99 }, // last fraternal year
        { MemberID: 20, ActivityDate: '2026-08-01', Hours: 7 },
      ],
      GLAccount: [
        { id: 1, CouncilID: 1, AccountType: 'Asset', IsVirtualGoal: 0 },
        { id: 2, CouncilID: 2, AccountType: 'Asset', IsVirtualGoal: 0 },
      ],
      JournalEntry: [
        { GLAccountID: 1, DebitAmount: 100, CreditAmount: 0, DateLogged: '2026-07-01' },
        { GLAccountID: 2, DebitAmount: 500, CreditAmount: 0, DateLogged: '2026-07-01' },
      ],
      CouncilAssetsInventory: [{ id: 1, council_id: 1, asset_name: 'Grill', purchase_date: '2025-01-01', cost_basis: 200, current_status: 'ACTIVE' }],
    } as unknown as RegionalDeskRows;
    const report = buildRegionalDeskReport('district', [1], rows, NOW);
    expect(report.totals).toEqual({ councils: 1, volunteerHours: 5, grossBalance: 100, assetCount: 1, assetValue: 200 });
    expect(report.volunteers).toEqual([{ memberId: 10, name: 'Al One', councilId: 1, hours: 5 }]);
  });

  it('opens the desks and the assignment panel to the right readers', () => {
    const base = { memberId: 5, councilId: 1, isOfficer: false };
    expect(portalAreas({ ...base, memberType: 'Member', roles: ['District Deputy'] })).toContain('district-desk');
    expect(portalAreas({ ...base, memberType: 'Member', roles: ['District Deputy'] })).not.toContain('state-desk');
    expect(portalAreas({ ...base, memberType: 'Member', roles: ['State Officer'] })).toContain('state-desk');
    expect(portalAreas({ ...base, memberType: 'Member', roles: ['State Admin'] })).toEqual(expect.arrayContaining(['state-desk', 'system-settings/regional-assignments']));
    expect(portalAreas({ ...base, memberType: 'Super Admin', roles: [] })).toEqual(expect.arrayContaining(['district-desk', 'state-desk', 'system-settings/regional-assignments']));
    expect(portalAreas({ ...base, memberType: 'Admin', roles: [] })).not.toContain('district-desk');
    expect(PORTAL_NAV_GROUPS.find((g) => g.id === 'performance')!.items.slice(0, 2)).toEqual(['district-desk', 'state-desk']);
    for (const page of ['district-desk', 'state-desk', 'system-settings/regional-assignments']) {
      expect(read(`apps/web/app/${page}/page.tsx`)).toContain(`<RequireArea area="${page}">`);
    }
    const desk = read('apps/web/components/modules/RegionalDesk.tsx');
    expect(desk).toContain('useState<RegionalDeskDrawerId | null>(null)');
    expect(desk.indexOf('<TopDeck')).toBeLessThan(desk.indexOf('desk drawers`}'));
  });
});

describe('4. passkeys are server-only', () => {
  it('keeps the passkeys namespace away from devices and seals the keys', () => {
    expect(HUB_SERVER_ONLY_NAMESPACES.has('passkeys')).toBe(true);
    expect(() => assertHubCallAllowed({ method: 'passkeys.save', args: [] }, { memberId: 3 })).toThrow(/not offered to devices/);
    const server = read('apps/web/services/server/webauthn.ts');
    expect(server).toContain("createCipheriv('aes-256-gcm'");
    expect(server).toContain('db.passkeys.save({');
    expect(server).toContain('export async function migrateLegacyPasskeys');
  });
});

describe.each(drivers)('5. the regional seed and desks [$name]', (d) => {
  async function makePresentation(): Promise<DataService> {
    const now = () => new Date(NOW);
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

  it('signs the three regional test logins in, and the developer login still works', async () => {
    const db = await makePresentation();
    const tim = await db.auth.signIn('tim@fairmissionsoftware.com', PASSWORD);
    const dd = await db.auth.signIn('dd.test@fairmissionsoftware.com', PASSWORD);
    const state = await db.auth.signIn('state.test@fairmissionsoftware.com', PASSWORD);
    expect(tim).toMatchObject({ memberId: TIM, memberType: 'Super Admin', councilId: 1 });
    expect(dd).toMatchObject({ memberId: DD, councilId: 1, roles: ['District Deputy'] });
    expect(state).toMatchObject({ memberId: STATE, roles: ['State Officer'] });
    expect((await db.councils.get(state!.councilId))).toMatchObject({ CouncilName: 'Oregon State Council', council_level: 'STATE' });
    expect(await db.auth.signIn('testsuperadmin@kofc.org', 'dev-pass-secure-9912')).toMatchObject({ memberType: 'Super Admin' });
  });

  it("gives the District Deputy 15295, 4100 and 7224, with each council's Top 5", async () => {
    const db = await makePresentation();
    const report = await db.regional.getRegionalDesk(DD, 'district');
    expect(report.councils.map((c) => c.councilNumber)).toEqual([4100, 7224, 15295]);
    expect(report.totals.councils).toBe(3);
    expect(report.totals.assetCount).toBeGreaterThanOrEqual(2);
    expect(report.totals.grossBalance).toBeGreaterThan(5400 + 3150);
    expect(report.volunteers.length).toBeGreaterThan(0);
    expect(topVolunteers(report.volunteers).length).toBeLessThanOrEqual(10);
    expect(topVolunteers(report.volunteers, 7).map((v) => [v.name, v.hours])).toEqual([
      ['Paul Harmon', 9.5],
      ['Luke Brennan', 4],
    ]);
    expect(report.calendar.some((i) => i.title === 'Sacred Heart Pancake Breakfast')).toBe(true);
    expect(report.affiliations).toContainEqual(expect.objectContaining({ councilId: 7, sisterCouncilId: 8 }));
    await expectRule(db.regional.getRegionalDesk(DD, 'state'), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.regional.getRegionalDesk(MEMBER.member, 'district'), 'COUNCIL_ACCESS_DENIED');
  });

  it("gives the State Officer every Oregon council and nothing in Washington", async () => {
    const db = await makePresentation();
    const report = await db.regional.getRegionalDesk(STATE, 'state');
    expect(report.councils.every((c) => c.state === 'OR')).toBe(true);
    expect(report.councils.map((c) => c.councilNumber)).toEqual(expect.arrayContaining([15295, 4100, 7224, 900001]));
    expect(report.councils[0]).toMatchObject({ level: 'STATE', cashBalance: 12800 });
    expect((await db.regional.getRegionalDesk(TIM, 'state')).councils.some((c) => c.state === 'WA')).toBe(true);
  });

  it('lets a Super Admin make a State Admin, who then assigns only inside Oregon', async () => {
    const db = await makePresentation();
    await expectRule(db.regional.getAssignmentWorkspace(MEMBER.admin), 'SUPER_ADMIN_REQUIRED');
    const workspace = await db.regional.getAssignmentWorkspace(TIM);
    expect(workspace.stateLimit).toBeNull();
    expect(workspace.assignments.map((a) => [a.memberId, a.assignmentType, a.councilIds])).toEqual([
      [DD, 'DISTRICT_DEPUTY', [1, 7, 8]],
      [STATE, 'STATE_OFFICER', []],
    ]);

    await db.regional.saveAssignment(TIM, { memberId: STATE, assignmentType: 'STATE_ADMIN', stateCode: 'OR', councilIds: [] });
    expect((await db.members.listRoles(STATE)).map((r) => r.Role)).toEqual(['State Admin']);
    const scoped = await db.regional.getAssignmentWorkspace(STATE);
    expect(scoped.stateLimit).toBe('OR');
    expect(scoped.councils.every((c) => c.state === 'OR')).toBe(true);

    const waCouncil = (await db.councils.list()).find((c) => c.State === 'WA')!;
    await expectRule(db.regional.saveAssignment(STATE, { memberId: 38, assignmentType: 'DISTRICT_DEPUTY', stateCode: 'OR', councilIds: [waCouncil.id] }), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.regional.saveAssignment(STATE, { memberId: 38, assignmentType: 'STATE_ADMIN', stateCode: 'OR', councilIds: [] }), 'SUPER_ADMIN_REQUIRED');
    const made = await db.regional.saveAssignment(STATE, { memberId: 38, assignmentType: 'DISTRICT_DEPUTY', stateCode: 'OR', councilIds: [7, 8] });
    expect(made).toMatchObject({ memberId: 38, assignmentType: 'DISTRICT_DEPUTY', councilIds: [7, 8] });
    expect((await db.members.listRoles(38)).map((r) => r.Role).sort()).toEqual(['District Deputy', 'Member']);

    await db.regional.removeAssignment(STATE, 38);
    expect((await db.members.listRoles(38)).map((r) => r.Role)).toEqual(['Member']);
    await expectRule(db.regional.removeAssignment(STATE, 38), 'RECORD_NOT_FOUND');
  });

  it('stores passkeys server-side by credential id', async () => {
    const db = await makePresentation();
    const row = { credential_id: 'cred-x', member_id: TIM, login_id: 35, username: 'tim@fairmissionsoftware.com', public_key_sealed: 'v1.a.b.c', alg: -7, sign_count: 0, created_at: '2026-10-27 09:00:00' };
    await db.passkeys.save(row);
    await db.passkeys.save({ ...row, sign_count: 2 });
    expect((await db.passkeys.list()).map((r) => [r.credential_id, r.sign_count])).toEqual([['cred-x', 2]]);
    await db.passkeys.setSignCount('cred-x', 5);
    expect((await db.passkeys.list())[0]!.sign_count).toBe(5);
    await db.passkeys.remove('cred-x');
    expect(await db.passkeys.list()).toEqual([]);
  });

  it("splits a batch override with a one-time share to an affiliated council's clearing account", async () => {
    const db = await makePresentation();
    const treasurer = (await db.auth.signIn('treasurer_user@stmarys.org', 'dev-pass-secure-9912'))!.memberId;
    const queue = await db.finance.getBatchCodingQueue(treasurer, 1);
    const byEvent = new Map<number, number[]>();
    for (const r of queue.rows) if (r.donation.EventID != null) byEvent.set(r.donation.EventID, [...(byEvent.get(r.donation.EventID) ?? []), r.donation.id]);
    const [, ids] = [...byEvent.entries()][0]!;
    const line = queue.revenueAccounts[0]!;
    const sister = (await db.finance.listSplitSisterCouncils(treasurer, 1))[0]!;
    const done = await db.finance.batchCodeDonations(treasurer, 1, {
      donationIds: ids,
      revenueAccountId: line.id,
      eventSplitOverride: [
        { destinationAccountId: line.id, percentage: 60 },
        { destinationAccountId: 0, affiliatedCouncilId: sister.councilId, percentage: 40 },
      ],
    });
    expect(done.overridden).toBe(true);
    const sisterNumber = (await db.councils.get(sister.councilId))!.CouncilNumber;
    expect(done.splits.map((s) => s.destinationAccountName)).toContain(`Due to Sister Council - Council ${sisterNumber}`);
  });
});
