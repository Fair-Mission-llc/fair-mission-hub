// Sprint 11 Revision 18.5 (schema 111, no table change): the Advisory Panel for every Super Admin, the Admin Desk tab
// beside the Super Admin Desk, Payment QR Codes from the live Active donation methods, the vault's single storage
// provider, Expense Reporting and Charitable Contributions off for Council 15295, the streamlined General Ledger with
// Add Account / Edit / Delete, and the 'Motion Request' labels.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  memberDeskDrawersFor,
  assertMayInviteAdvisoryPanelist,
  assertMayKeepAdvisoryPanel,
  assertMayReadAdvisoryPanel,
  COUNCIL_15295_SEED_FLAGS,
  dashboardTabsFor,
  deskDrawersFor,
  GENERAL_LEDGER_PAGE_TYPES,
  GENERAL_LEDGER_TITLE,
  MOTION_REQUEST_LABEL,
  MY_MOTION_REQUESTS_TITLE,
  paymentQrUploadRows,
  PLATFORM_SCHEMA_VERSION,
  vaultStorageProviderOptions,
  type DrawerDeskId,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const OWN = 1;
const superAdmin = { memberId: 1, councilId: OWN, memberType: 'Super Admin' as const, isOfficer: false, roles: [] as string[], active: true };

describe('0. schema', () => {
  it('stays at 111', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(113); // Sprint 11 Revision 21.0 moved the platform to schema 113.
  });
});

describe('1. the Advisory Panel and the Active Desks for Super Admins', () => {
  it('lets any Super Admin read, keep and invite, whatever the sign-in name', () => {
    for (const username of [undefined, null, 'other.admin@kofc.org', 'testsuperadmin@kofc.org']) {
      expect(() => assertMayReadAdvisoryPanel(superAdmin, username)).not.toThrow();
      expect(() => assertMayKeepAdvisoryPanel(superAdmin, username)).not.toThrow();
      expect(() => assertMayInviteAdvisoryPanelist(superAdmin, username)).not.toThrow();
    }
    const admin = { ...superAdmin, memberType: 'Admin' as const };
    expect(() => assertMayKeepAdvisoryPanel(admin)).toThrow();
    expect(() => assertMayInviteAdvisoryPanelist(admin)).toThrow();
    expect(read('apps/web/components/AdvisoryPanel.tsx')).not.toContain('isPlatformOwner');
  });

  it('draws the Super Admin Desk and the Admin Desk side by side for a Super Admin', () => {
    const ids = dashboardTabsFor(superAdmin, OWN).map((t) => t.id);
    expect(ids.slice(0, 3)).toEqual(['home', 'super-admin', 'admin']);
    // Sprint 11 Revision 18.6: a Council Admin gets the Admin Desk tab (but not the Super Admin Desk tab).
    const adminTabs = dashboardTabsFor({ ...superAdmin, memberType: 'Admin' }, OWN).map((t) => t.id);
    expect(adminTabs).toContain('admin');
    expect(adminTabs).not.toContain('super-admin');
    expect(read('apps/web/app/dashboard/page.tsx')).toContain("shown === 'admin'");
    expect(read('apps/web/app/dashboard/page.tsx')).toContain('<AdminDesk embedded />');
  });
});

describe('2. Payment QR Codes and the vault', () => {
  it('keeps only Active methods that take a QR code', () => {
    const names = new Map([
      [1, 'Cash'],
      [2, 'Venmo'],
      [3, 'Zelle'],
      [4, 'Check'],
      [5, 'Square'],
    ]);
    const rows = [
      { id: 10, DonationMethodID: 1, lookup_status: 'Active' },
      { id: 11, DonationMethodID: 2, lookup_status: 'Active' },
      { id: 12, DonationMethodID: 3, lookup_status: 'Inactive' },
      { id: 13, DonationMethodID: 4, lookup_status: 'Active' },
      { id: 14, DonationMethodID: 9, lookup_status: 'Active' },
    ];
    expect(paymentQrUploadRows(rows, (id) => names.get(id)).map((r) => r.id)).toEqual([11]);
    const card = read('apps/web/components/PaymentQrUploader.tsx');
    expect(card).not.toContain('No QR code for this payment method');
  });

  it("lists only the council's chosen storage provider in the vault", () => {
    expect(vaultStorageProviderOptions({ file_repository_mode: 'DROPBOX_BUSINESS' })).toEqual([
      { id: 'DROPBOX_BUSINESS', label: 'Dropbox Business', credentialKey: 'DROPBOX_ACCESS_TOKEN' },
    ]);
    expect(vaultStorageProviderOptions(null).map((o) => o.id)).toEqual(['GOOGLE_DRIVE']);
    expect(vaultStorageProviderOptions({ file_repository_mode: 'LOCAL_NETWORK' as never })[0]!.credentialKey).toBe('FILE_SERVER_PASSWORD');
    const vault = read('apps/web/components/modules/CredentialsVaultPanel.tsx');
    expect(vault).toContain('vaultStorageProviderOptions(council.data)');
    expect(vault).not.toContain('card={DROPBOX_CARD}');
  });
});

describe('3. Expense Reporting and Charitable Contributions off for Council 15295', () => {
  it('seeds both switches off', () => {
    expect(COUNCIL_15295_SEED_FLAGS.feature_expense_reporting).toBe(false);
    expect(COUNCIL_15295_SEED_FLAGS.flag_charity_proposals).toBe(false);
  });

  it('leaves no expense or charity drawer on any desk while they are off', () => {
    const related = /^er-|expense|charit|ledger-coder|vetting|donation-workflow|approved-expenses|payment-requests/;
    for (const desk of ['grand-knight', 'financial-secretary', 'treasurer'] as DrawerDeskId[]) {
      const ids = deskDrawersFor(superAdmin, desk, OWN, COUNCIL_15295_SEED_FLAGS).map((d) => d.id);
      expect(ids.filter((id) => related.test(id))).toEqual([]);
    }
    // The general ledger stays on the Treasurer Desk.
    expect(deskDrawersFor(superAdmin, 'treasurer', OWN, COUNCIL_15295_SEED_FLAGS).map((d) => d.id)).toContain('chart-of-accounts');
    // Sprint 11 Revision 20.0: the Member Desk's expense drawer follows the switch (memberDeskDrawersFor).
    expect(memberDeskDrawersFor(COUNCIL_15295_SEED_FLAGS).map((d) => d.id)).not.toContain('expense-sheets');
    expect(memberDeskDrawersFor(COUNCIL_15295_SEED_FLAGS).map((d) => d.id)).not.toContain('charity-requests');
  });

  it.each(drivers)('$name driver: Council 15295 starts with both off', async (d) => {
    const db = await d.make();
    const council = await db.councils.get(1);
    expect(council?.feature_expense_reporting).toBe(0);
    expect(council?.flag_charity_proposals).toBe(0);
  });
});

describe('4. the General Ledger', () => {
  it('is titled General Ledger with no Financial Dashboard link and no Equity box', () => {
    expect(GENERAL_LEDGER_TITLE).toBe('General Ledger');
    expect(GENERAL_LEDGER_PAGE_TYPES).toEqual(['Asset', 'Liability', 'Revenue', 'Expense']);
    const page = read('apps/web/app/finance/ledger/page.tsx');
    expect(page).not.toContain('FINANCIAL_DASHBOARD_TITLE');
    expect(page).not.toContain('/finance/dashboard');
    expect(page).toContain('GENERAL_LEDGER_PAGE_TYPES.map');
    expect(page).toContain('{ADD_GL_ACCOUNT_LABEL}');
    expect(page).toContain('db.finance.saveGLAccount');
    expect(page).toContain('db.finance.removeGLAccount');
  });

  describe.each(drivers)('$name driver: finance.saveGLAccount / removeGLAccount', (d) => {
    it('adds, renames, retypes while unused and deletes an account', async () => {
      const db = await d.make();
      const added = await db.finance.saveGLAccount(MEMBER.superAdmin, OWN, { AccountName: 'Hall Rental Income', AccountType: 'Revenue' });
      expect(added).toMatchObject({ CouncilID: OWN, AccountName: 'Hall Rental Income', AccountType: 'Revenue' });
      const renamed = await db.finance.saveGLAccount(MEMBER.superAdmin, OWN, { id: added.id, AccountName: 'Hall Rentals', AccountType: 'Expense' });
      expect(renamed).toMatchObject({ id: added.id, AccountName: 'Hall Rentals', AccountType: 'Expense' });
      await db.finance.removeGLAccount(MEMBER.superAdmin, OWN, added.id);
      const chart = await db.finance.listChartOfAccounts(MEMBER.superAdmin, OWN);
      const names: string[] = [];
      const walk = (n: (typeof chart.accounts)[number]) => {
        names.push(n.account.AccountName);
        n.children.forEach(walk);
      };
      chart.accounts.forEach(walk);
      expect(names).not.toContain('Hall Rentals');
    });

    it('refuses duplicates, Equity, used accounts and non-posters', async () => {
      const db = await d.make();
      const chart = await db.finance.listChartOfAccounts(MEMBER.superAdmin, OWN);
      const first = chart.accounts[0]!.account;
      await expectRule(db.finance.saveGLAccount(MEMBER.superAdmin, OWN, { AccountName: first.AccountName, AccountType: 'Expense' }), 'INVALID_INPUT');
      await expectRule(db.finance.saveGLAccount(MEMBER.superAdmin, OWN, { AccountName: 'New Equity', AccountType: 'Equity' }), 'INVALID_INPUT');
      await expectRule(db.finance.saveGLAccount(MEMBER.member, OWN, { AccountName: 'Sneaky', AccountType: 'Expense' }), 'FINANCE_OFFICER_REQUIRED');
      await expectRule(db.finance.removeGLAccount(MEMBER.superAdmin, OWN, 999999), 'RECORD_NOT_FOUND');
      // An account with sub-accounts or postings stays, and keeps its type.
      const parent = chart.accounts.find((n) => n.children.length > 0)!.account;
      await expectRule(db.finance.removeGLAccount(MEMBER.superAdmin, OWN, parent.id), 'RECORD_IN_USE');
      const other = parent.AccountType === 'Asset' ? 'Expense' : 'Asset';
      await expectRule(db.finance.saveGLAccount(MEMBER.superAdmin, OWN, { id: parent.id, AccountName: parent.AccountName, AccountType: other }), 'RECORD_IN_USE');
    });
  });
});

describe('5. the Motion Request labels', () => {
  it('reads Motion Request on the link and heading, My Motion Requests on the history panel', () => {
    expect(MOTION_REQUEST_LABEL).toBe('Motion Request');
    expect(MY_MOTION_REQUESTS_TITLE).toBe('My Motion Requests');
    expect(read('apps/web/components/Sidebar.tsx')).toContain("'motion-requests': { href: '/motion-requests', label: MOTION_REQUEST_LABEL");
    const page = read('apps/web/app/motion-requests/page.tsx');
    expect(page).toContain('<PageTitle>{MOTION_REQUEST_LABEL}</PageTitle>');
    expect(page).toContain('<MyMotionRequestsPanel user={user} split');
    expect(read('apps/web/components/DashboardDesks.tsx')).toContain('<MyMotionRequestsPanel user={user} />');
  });
});
