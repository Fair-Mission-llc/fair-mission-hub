// Sprint 11 Revision 4.1 (schema 103, no table change): the Admin Desk Setup Wizard - five steps, the founding template
// clone, the practice sandbox and its purge, the '?' context tips and the Quick-Start Intake Guide.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  councilLooksUnset,
  FOUNDING_COUNCIL_NUMBER,
  isPracticeEmail,
  planFoundingTemplateClone,
  PRACTICE_EMAIL_DOMAIN,
  PRACTICE_EVENT_PREFIX,
  practiceFundraisers,
  practiceRosterRows,
  QUICK_START_GUIDE,
  SETUP_WIZARD_STEPS,
  type DataService,
  type GLAccount,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER, NOW } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

const account = (id: number, AccountName: string, extra: Partial<GLAccount> = {}): GLAccount => ({
  id,
  CouncilID: 1,
  AccountName,
  AccountType: 'Asset',
  ParentAccountID: null,
  IsVirtualGoal: 0,
  TargetGoalAmount: 0,
  ...extra,
});

describe('1. the five wizard steps', () => {
  it('runs in the exact order', () => {
    expect(SETUP_WIZARD_STEPS.map((s) => `${s.number}. ${s.title}`)).toEqual([
      '1. Supreme CSV Roster Ingestion',
      '2. File Storage and Email Gateway',
      '3. Clone Founding Template',
      '4. Practice Sandbox',
      '5. Quick-Start Guide',
    ]);
  });

  it('opens on its own only for an unset council', () => {
    expect(councilLooksUnset({ accounts: 0, members: 1 })).toBe(true);
    expect(councilLooksUnset({ accounts: 0, members: 2 })).toBe(false);
    expect(councilLooksUnset({ accounts: 3, members: 0 })).toBe(false);
  });

  it('masks the Admin Desk and keeps the email password on the home council', () => {
    const wizard = read('apps/web/components/modules/SetupWizard.tsx');
    expect(wizard).toContain('aria-modal="true"');
    expect(wizard).toContain('const councilId = user.councilId;');
    expect(wizard).toContain('<SupremeRosterUploader councilId={councilId} />');
    expect(wizard).toContain('<EmailGatewayPanel councilId={councilId} />');
    expect(wizard).toContain('db.councils.cloneFoundingTemplate(user.memberId, councilId)');
    expect(wizard).toContain('db.councils.seedPracticeSandbox(user.memberId, councilId)');
    // The gateway route seals the password in the vault, for the session's home council only.
    expect(read('apps/web/app/api/councils/email-gateway/route.ts')).toContain('requireHomeCouncilVaultSession');
    const desk = read('apps/web/components/modules/AdminDesk.tsx');
    expect(desk).toContain('<SetupWizard');
    expect(desk).toContain('Run Setup Wizard');
    expect(desk).toContain('<PracticeSandboxSwitch');
    expect(desk).toContain('db.councils.purgePracticeSandbox(user.memberId, user.councilId)');
  });

  it("puts '?' context tips beside the deep admin inputs", () => {
    expect(read('apps/web/components/ui.tsx')).toContain('export function HelpTip(');
    expect(read('apps/web/components/EmailGatewayPanel.tsx').match(/help="/g)?.length).toBeGreaterThanOrEqual(4);
    expect(read('apps/web/components/FileRepositoryCard.tsx')).toContain('help="');
    expect(read('apps/web/components/modules/SetupWizard.tsx')).toContain('<HelpTip');
  });
});

describe('2. planFoundingTemplateClone', () => {
  const source = {
    accounts: [
      account(3, 'Child', { ParentAccountID: 2 }),
      account(2, 'Parent'),
      account(4, 'Due to Sister Council', { AccountType: 'Liability', due_to_council_id: 9 }),
      account(5, 'Split', { is_split_account: 1 }),
      account(7, 'Goal Account #1', { IsVirtualGoal: 1, TargetGoalAmount: 500 }),
      account(6, 'Already Held'),
    ],
    activities: [{ id: 1, ActivityName: 'Rosary', ActivityDescription: 'x', CategoryID: 3, CouncilID: 1 }],
    donationTypes: [{ id: 1, CouncilID: 1, DonationType: 'General' }],
    methods: [
      { id: 1, CouncilID: 1, DonationMethodID: 1, account_id: 2, account_owner_entity: 'COUNCIL' as const },
      { id: 2, CouncilID: 1, DonationMethodID: 2, account_id: 5 },
    ],
    settings: { max_hours_per_shift: 8 } as never,
  };

  it('adds parents first, keeps what the target holds and leaves sister, split and goal accounts out', () => {
    const plan = planFoundingTemplateClone(source, {
      accounts: [{ AccountName: 'already held' }],
      activities: [],
      donationTypes: [{ DonationType: 'GENERAL' }],
      methods: [],
    });
    expect(plan.accounts.map((a) => [a.AccountName, a.parentName])).toEqual([
      ['Parent', null],
      ['Child', 'Parent'],
    ]);
    expect(plan.activities.map((a) => a.ActivityName)).toEqual(['Rosary']);
    expect(plan.donationTypes).toEqual([]);
    expect(plan.methods).toEqual([
      { DonationMethodID: 1, accountName: 'Parent', account_owner_entity: 'COUNCIL', lookup_status: 'Active' },
      { DonationMethodID: 2, accountName: null, account_owner_entity: 'COUNCIL', lookup_status: 'Active' },
    ]);
  });
});

describe('3. the practice sandbox data', () => {
  it('makes 10 marked members and 3 marked fundraisers', () => {
    const rows = practiceRosterRows(7, 'OR', NOW);
    expect(rows).toHaveLength(10);
    expect(new Set(rows.map((r) => r.Email)).size).toBe(10);
    expect(rows.every((r) => isPracticeEmail(r.Email) && r.Email.endsWith(`@${PRACTICE_EMAIL_DOMAIN}`))).toBe(true);
    const events = practiceFundraisers(NOW);
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.event.EventName.startsWith(PRACTICE_EVENT_PREFIX) && e.volunteers.length === 3)).toBe(true);
  });
});

describe('4. the Quick-Start Intake Guide', () => {
  it('is compiled by the manual script and served to Admins', () => {
    expect(read('scripts/compile_all_manuals.py')).toContain("key='quickstart'");
    const guide = read(`docs/${QUICK_START_GUIDE.markdown}`);
    for (const step of SETUP_WIZARD_STEPS) expect(guide).toContain(`Step ${step.number}:`);
    expect(existsSync(join(__dirname, '..', 'docs', QUICK_START_GUIDE.pdf))).toBe(true);
    expect(read('apps/web/app/api/manuals/pdf/route.ts')).toContain('key === QUICK_START_GUIDE.key');
  });
});

for (const driver of drivers) {
  describe(`5. the wizard's data methods [${driver.name}]`, () => {
    const newCouncil = async (db: DataService, number: number) =>
      db.councils.create(MEMBER.superAdmin, { CouncilNumber: number, CouncilName: `Setup Test ${number}`, State: 'OR' });

    it("clones the founding council's accounts, lookups and settings, once", async () => {
      const db = await driver.make();
      const founding = (await db.councils.list()).find((c) => c.CouncilNumber === FOUNDING_COUNCIL_NUMBER)!;
      const council = await newCouncil(db, 99411);
      const first = await db.councils.cloneFoundingTemplate(MEMBER.superAdmin, council.id);
      const foundingAccounts = (await db.finance.listChartOfAccounts(MEMBER.superAdmin, founding.id)).accounts.filter(
        (n) => n.account.due_to_council_id == null && !n.account.is_split_account,
      );
      const cloned = (await db.finance.listChartOfAccounts(MEMBER.superAdmin, council.id)).accounts;
      expect(first.accounts).toBe(foundingAccounts.length);
      expect(cloned.map((n) => n.account.AccountName).sort()).toEqual(foundingAccounts.map((n) => n.account.AccountName).sort());
      expect(first.activities).toBe((await db.lookups.listCouncilSpecific(MEMBER.superAdmin, founding.id, 'Activities')).length);
      expect(first.settings).toBeGreaterThan(0);
      const again = await db.councils.cloneFoundingTemplate(MEMBER.superAdmin, council.id);
      expect(again).toEqual({ accounts: 0, activities: 0, donationTypes: 0, paymentMethods: 0, settings: first.settings });
    });

    it('refuses the founding council itself and members without admin rights', async () => {
      const db = await driver.make();
      const founding = (await db.councils.list()).find((c) => c.CouncilNumber === FOUNDING_COUNCIL_NUMBER)!;
      await expectRule(db.councils.cloneFoundingTemplate(MEMBER.superAdmin, founding.id), 'INVALID_INPUT');
      const council = await newCouncil(db, 99412);
      await expectRule(db.councils.cloneFoundingTemplate(MEMBER.member, council.id), 'ADMIN_REQUIRED');
      await expectRule(db.councils.seedPracticeSandbox(MEMBER.member, council.id), 'ADMIN_REQUIRED');
    });

    it('seeds 10 practice members and 3 fundraisers, then purges exactly them', async () => {
      const db = await driver.make();
      const council = await newCouncil(db, 99413);
      const before = { members: driver.count(db, 'Member'), events: driver.count(db, 'Event'), creds: driver.count(db, 'Credentials') };
      expect(await db.councils.getPracticeSandboxStatus(MEMBER.superAdmin, council.id)).toEqual({ members: 0, events: 0, active: false });
      expect(await db.councils.seedPracticeSandbox(MEMBER.superAdmin, council.id)).toEqual({ members: 10, events: 3, signups: 9 });
      expect(await db.councils.getPracticeSandboxStatus(MEMBER.superAdmin, council.id)).toEqual({ members: 10, events: 3, active: true });
      expect((await db.members.listByCouncil(council.id)).filter((m) => isPracticeEmail(m.Email))).toHaveLength(10);
      await expectRule(db.councils.seedPracticeSandbox(MEMBER.superAdmin, council.id), 'INVALID_INPUT');
      expect(await db.councils.purgePracticeSandbox(MEMBER.superAdmin, council.id)).toEqual({ members: 10, events: 3 });
      expect(await db.councils.getPracticeSandboxStatus(MEMBER.superAdmin, council.id)).toEqual({ members: 0, events: 0, active: false });
      expect({ members: driver.count(db, 'Member'), events: driver.count(db, 'Event'), creds: driver.count(db, 'Credentials') }).toEqual(before);
    });
  });
}
