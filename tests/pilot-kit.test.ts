// Phase 7I: every St. Jude place renamed St. Mary's Cathedral (schema version 70), the seven anonymous Conference Room
// Pilot personas and the work waiting on their desks, the `py` launcher on Windows, and the pilot kit PDFs (fillable
// scripts and 11x17 posters) that scripts/compile_all_manuals.py compiles.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { awaitsWrittenOrder, isQuarantinedHours, type DataService } from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { drivers, expectRule, NOW } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const PASSWORD = 'dev-pass-secure-9912';
const OWN = 1;

const PERSONAS = [
  ['gk_user@stmarys.org', 'GK User', 'Grand Knight'],
  ['fs_user@stmarys.org', 'FS User', 'Financial Secretary'],
  ['treasurer_user@stmarys.org', 'Treasurer User', 'Treasurer'],
  ['dgk_user@stmarys.org', 'DGK User', 'Deputy Grand Knight'],
  ['historian_user@stmarys.org', 'Historian User', 'Council Historian'],
  ['member_alpha@stmarys.org', 'Member Alpha', 'Member'],
  ['member_beta@stmarys.org', 'Member Beta', 'Member'],
] as const;

describe('schema version 70', () => {
  it('bumps the phone database and records the release', () => {
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = ([7-9]\d);/);
    expect(read('Schema.sql')).toContain('(schema version 70)');
  });

  it('leaves no St. Jude in the seeds, the dev seeds or the generated databases', () => {
    for (const path of [
      'Seed.sql',
      'apps/web/services/seed-dev.ts',
      'apps/mobile/services/seed-dev.ts',
      'apps/web/services/generated/schema.generated.ts',
      'apps/mobile/services/generated/schema.sqlite.ts',
    ]) {
      expect(read(path), path).not.toMatch(/jude/i);
    }
  });

  it('runs Python through the py launcher on Windows', () => {
    expect(read('apps/web/services/server/reportlab.ts')).toContain("process.platform === 'win32' ? 'py' : 'python3'");
  });
});

describe.each(drivers)('$name driver: the Conference Room Pilot personas', (d) => {
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

  it('signs each persona in to Council 15295 with its seat', async () => {
    const db = await makePresentation();
    for (const [email, name, role] of PERSONAS) {
      const user = await db.auth.signIn(email, PASSWORD);
      expect(user, email).toMatchObject({ councilId: OWN });
      expect(`${user!.firstName} ${user!.lastName}`).toBe(name);
      expect((await db.members.listRoles(user!.memberId)).map((r) => r.Role), email).toContain(role);
    }
  });

  it('puts the pilot work on each desk', async () => {
    const db = await makePresentation();
    const id = async (email: string) => (await db.auth.signIn(email, PASSWORD))!.memberId;
    const [gk, fs, treasurer, dgk] = await Promise.all(['gk_user', 'fs_user', 'treasurer_user', 'dgk_user'].map((u) => id(`${u}@stmarys.org`)));

    const fsDesk = (await db.expenses.listCouncilQueue(fs, OWN)).filter((q) => awaitsWrittenOrder(q.report)).map((q) => q.report.id);
    expect(fsDesk).toEqual(expect.arrayContaining([14, 15, 16]));
    expect((await db.expenses.listTreasurerQueue(treasurer, OWN)).map((q) => q.report.id)).toEqual(expect.arrayContaining([17, 18]));
    expect((await db.expenses.listAuthorizationQueue(gk, OWN)).map((q) => q.report.id)).toEqual([19]);

    const held = await db.volunteerQuarantine.listPending(dgk, OWN);
    expect(held.map((h) => [h.memberName, h.row.activity_type, h.row.hours_reported])).toEqual([
      ['Member Alpha', 'SHIFT', 6.5],
      ['Member Beta', 'MANUAL', 6],
    ]);
  });

  it('signs both member personas up for every Parish Parking Event shift', async () => {
    const db = await makePresentation();
    const event = (await db.events.listByCouncil(OWN)).find((e) => e.EventName === 'Parish Parking Event')!;
    expect(event).toMatchObject({ StartDate: '2026-10-10', EndDate: '2026-10-31', Location: "St. Mary's Cathedral Parking Lot" });
    const shifts = await db.events.listShifts(event.id);
    expect(shifts).toHaveLength(6);
    for (const email of ['member_alpha@stmarys.org', 'member_beta@stmarys.org']) {
      const member = (await db.auth.signIn(email, PASSWORD))!;
      const mine = (await db.events.listMemberShifts(member.memberId)).filter((s) => s.event.id === event.id);
      expect(mine, email).toHaveLength(6);
    }
  });
});

// The scripts' steps, replayed through the drivers on the Monday after the first parking weekend.
const PILOT_DAY = new Date(2026, 9, 12, 19, 0, 0);

describe.each(drivers)('$name driver: the pilot scripts hold true', (d) => {
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
  const ids = async (db: DataService) => {
    const out: Record<string, number> = {};
    for (const u of ['gk_user', 'fs_user', 'treasurer_user', 'dgk_user', 'member_alpha', 'member_beta']) {
      out[u] = (await db.auth.signIn(`${u}@stmarys.org`, PASSWORD))!.memberId;
    }
    return out;
  };

  it('Flow 1: report 14 goes from the written order to a paid check', async () => {
    const db = await makePilot();
    const who = await ids(db);
    await db.expenses.financialSecretaryAuditOrder(who.fs_user!, 14);
    await db.expenses.treasurerLedgerAudit(who.treasurer_user!, 14, { budgetLineId: 25, generalLedgerAccountId: 12 });
    expect((await db.expenses.grandKnightAuthorizeOrder(who.gk_user!, 14)).report.Status).toBe('Approved');
    await db.expenses.recordDisbursement(who.treasurer_user!, OWN, [14], { CheckNumber: '1202', PayoutDate: '2026-10-12' });
    const mine = await db.expenses.listUserReports(who.member_alpha!);
    expect(mine.find((r) => r.report.id === 14)?.report.Status).toBe('Reimbursed');
  });

  it('the GK script: report 19 is released and the Treasurer pays it', async () => {
    const db = await makePilot();
    const who = await ids(db);
    expect((await db.expenses.grandKnightAuthorizeOrder(who.gk_user!, 19)).report.Status).toBe('Approved');
    await db.expenses.recordDisbursement(who.treasurer_user!, OWN, [19], { CheckNumber: '1201', PayoutDate: '2026-10-12' });
  });

  it('the FS script returns report 15, and Flow 2 refuses an own report', async () => {
    const db = await makePilot();
    const who = await ids(db);
    const returned = await db.expenses.rejectReport(who.fs_user!, 15, 'Please add the receipt photo');
    expect(returned.report).toMatchObject({ Status: 'Draft', RejectionReason: 'Please add the receipt photo' });
    await expect(db.expenses.financialSecretaryAuditOrder(who.fs_user!, 14)).resolves.toBeTruthy();
  });

  it('Flow 3: the DGK decides both held entries, and the members log again', async () => {
    const db = await makePilot();
    const who = await ids(db);
    const held = await db.volunteerQuarantine.listPending(who.dgk_user!, OWN);
    const alpha = held.find((h) => h.row.user_id === who.member_alpha)!;
    const beta = held.find((h) => h.row.user_id === who.member_beta)!;
    expect((await db.volunteerQuarantine.clear(who.dgk_user!, beta.row.id)).clearance_status).toBe('APPROVED');
    expect((await db.volunteerQuarantine.reject(who.dgk_user!, alpha.row.id)).clearance_status).toBe('REJECTED');
    // Alpha reports the Saturday shift (Shift 9) again with its 4 scheduled hours: it logs directly.
    expect(isQuarantinedHours(await db.eventTime.logHours(who.member_alpha!, 9, 4))).toBe(false);
    // Beta reports 9 hours on the 4-hour Sunday shift (Shift 10): it is held for review.
    expect(isQuarantinedHours(await db.eventTime.logHours(who.member_beta!, 10, 9))).toBe(true);
  });
});

// Sprint 7I Extension: the group script's flows create every record live; these replay them on the pilot day.
describe.each(drivers)('$name driver: the live group flows hold true', (d) => {
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
  const line = (VendorName: string, Amount: number, ExpenseDescription: string) => ({ DateOfExpense: '2026-10-12', Amount, VendorName, ExpenseDescription });

  it('Flow 1: two new reports reach the FS desk, one is returned, and both are paid', async () => {
    const db = await makePilot();
    const [alpha, beta, fs, treasurer, gk] = await Promise.all(['member_alpha', 'member_beta', 'fs_user', 'treasurer_user', 'gk_user'].map((u) => signIn(db, u)));
    const a = await db.expenses.submitReport(alpha, { Status: 'Submitted', LinkedEventID: 9 }, [line('Ace Hardware', 18.4, 'Zip ties and sign stakes')]);
    const b = await db.expenses.submitReport(
      beta,
      { Status: 'Submitted', LinkedEventID: 9, flag_missing_receipt: true, missing_receipt_reason: 'The register tape was lost' },
      [line('Dollar Tree', 9.99, 'Donation receipt books')],
    );
    const fsDesk = (await db.expenses.listCouncilQueue(fs, OWN)).filter((q) => awaitsWrittenOrder(q.report)).map((q) => q.report.id);
    expect(fsDesk).toEqual(expect.arrayContaining([a.report.id, b.report.id]));

    await db.expenses.financialSecretaryAuditOrder(fs, a.report.id);
    expect((await db.expenses.rejectReport(fs, b.report.id, 'Please add the receipt photo')).report.Status).toBe('Draft');
    await db.expenses.submitReport(beta, { id: b.report.id, Status: 'Submitted', LinkedEventID: 9 }, [line('Dollar Tree', 9.99, 'Donation receipt books')]);
    await db.expenses.financialSecretaryAuditOrder(fs, b.report.id);
    for (const id of [a.report.id, b.report.id]) {
      await db.expenses.treasurerLedgerAudit(treasurer, id, { budgetLineId: 25, generalLedgerAccountId: 12 });
      await db.expenses.grandKnightAuthorizeOrder(gk, id);
    }
    await db.expenses.recordDisbursement(treasurer, OWN, [a.report.id], { CheckNumber: '1401', PayoutDate: '2026-10-12' });
    await db.expenses.recordDisbursement(treasurer, OWN, [b.report.id], { CheckNumber: '1402', PayoutDate: '2026-10-12' });
    expect((await db.expenses.listUserReports(alpha)).find((r) => r.report.id === a.report.id)?.report.Status).toBe('Reimbursed');
    expect((await db.expenses.listUserReports(beta)).find((r) => r.report.id === b.report.id)?.report.Status).toBe('Reimbursed');
  });

  it('Flow 3: a live 7-hour report is held, rejected and logged again', async () => {
    const db = await makePilot();
    const [alpha, beta, dgk] = await Promise.all(['member_alpha', 'member_beta', 'dgk_user'].map((u) => signIn(db, u)));
    expect(isQuarantinedHours(await db.eventTime.logHours(beta, 10, 4))).toBe(false);
    const held = await db.eventTime.logHours(alpha, 10, 7);
    expect(isQuarantinedHours(held)).toBe(true);
    const id = (held as { quarantined: { id: number } }).quarantined.id;
    expect((await db.volunteerQuarantine.listPending(dgk, OWN)).map((h) => h.row.id)).toContain(id);
    await db.volunteerQuarantine.reject(dgk, id);
    expect(isQuarantinedHours(await db.eventTime.logHours(alpha, 10, 4))).toBe(false);
  });

  it('Flow 5: a live charity request is vetted and placed on the soonest eligible Monthly meeting, then paid after the vote', async () => {
    const db = await makePilot();
    const [alpha, fs, gk, treasurer] = await Promise.all(['member_alpha', 'fs_user', 'gk_user', 'treasurer_user'].map((u) => signIn(db, u)));
    // Facilitator preparation: the year's Monthly meetings.
    await db.meetings.populateAnnualCadence(gk, OWN, 1, '2026-2027');

    const { request } = await db.charities.submitCharitableRequest(alpha, {
      OrganizationName: 'Cathedral Neighbors Food Bank',
      OrgMission: 'Weekly groceries for families near the cathedral',
      MailingAddress: '200 Cathedral Way, Portland, OR 97201',
      RelationshipTypeID: 3, // Local Nonprofit
      MissionAreaID: 3, // Community
      AmountRequested: 350,
      SpecificUse: 'Groceries for 30 families',
      Is501c3: true,
    });
    await db.charities.triageRequestStatus(fs, request.id, { action: 'claim' });
    await db.charities.openRequestThread(fs, request.id, 'MORE_INFO', 'How many of the 30 families are in our parish?');
    await db.charities.triageRequestStatus(fs, request.id, { action: 'advance', TargetBudgetLineID: 23 });
    const { meeting, motion } = await db.charities.routeRequestToNextEligibleAgenda(fs, request.id);
    expect(meeting).toMatchObject({ Date: '2026-11-03', MeetingTypeID: 1 }); // the first Tuesday at least 10 days after October 12

    // After the session: the council votes, and the Treasurer pays the approved request.
    await db.meetings.finalizeProposedMotionVote(gk, motion.id, 'Passed');
    await expectRule(db.charities.payApprovedRequest(alpha, request.id, { CheckNumber: '1501', PayoutDate: '2026-11-04', CharityType: 'Food Security' }), 'FINANCE_OFFICER_REQUIRED');
    const paid = await db.charities.payApprovedRequest(treasurer, request.id, { CheckNumber: '1501', PayoutDate: '2026-11-04', CharityType: 'Food Security' });
    expect(paid.disbursement.Amount).toBe(350);
    expect(paid.request.PaymentOrderId).toBe(paid.disbursement.id);
  });
});

describe('pilot kit PDFs', () => {
  const docs = (name: string) => join(ROOT, 'docs', name);

  it('compiles the two fillable scripts and the three 11x17 posters', () => {
    for (const name of ['INDIVIDUAL_PILOT_SCRIPTS.pdf', 'GROUP_CROSS_DESK_SCRIPT.pdf']) {
      const pdf = readFileSync(docs(name), 'latin1');
      expect(pdf, name).toContain('/AcroForm');
      expect(pdf, name).toMatch(/\/FT \/Btn/); // check boxes
      expect(pdf, name).toMatch(/\/FT \/Tx/); // Notes fields
    }
    for (const name of ['POSTER_FINANCIAL_WORKFLOW.pdf', 'POSTER_CHARITY_LIFECYCLE.pdf', 'POSTER_PERMISSIONS_MATRIX.pdf']) {
      const pdf = readFileSync(docs(name), 'latin1');
      expect(pdf, name).toMatch(/\/MediaBox \[\s*0 0 792 1224\s*\]/); // 11 x 17 inches
    }
  });

  it('builds them from scripts/pilot_kit_pdf.py, called by compile_all_manuals.py', () => {
    expect(existsSync(join(ROOT, 'scripts', 'pilot_kit_pdf.py'))).toBe(true);
    expect(read('scripts/compile_all_manuals.py')).toContain('pilot_kit_pdf');
    const kit = read('scripts/pilot_kit_pdf.py');
    for (const [email] of PERSONAS) expect(kit, email).toContain(email);
    expect(kit).toContain('Day in the Life');
    expect(kit).toContain('Attendee Feedback Questionnaire');
    expect(kit).not.toMatch(/\.print\(|lpr|os\.startfile/);
    // Sprint 7I Extension: the group flows create their records live and leave the meeting console out.
    const group = kit.slice(kit.indexOf('GROUP_FLOWS: tuple'), kit.indexOf('FEEDBACK_RATINGS: tuple'));
    expect(group).not.toMatch(/Live Meeting Console|Mtgs tab|check in|report 1[4-9]/i);
    expect(group).toContain('Propose Charity Grant');
    expect(group).toContain('Place on next agenda');
    // Sprint 7I Extension 2: the individual scripts leave the meeting console out too.
    expect(kit.slice(kit.indexOf('PERSONAS: tuple'), kit.indexOf('GROUP_FLOWS: tuple'))).not.toMatch(/Live Meeting Console|welcome line/i);
  });

  it('keeps custom guides out of git', () => {
    expect(read('.gitignore')).toContain('generated/custom_manuals/');
    expect(read('apps/web/app/api/council/compile-manual/route.ts')).toContain("join(root, 'generated', 'custom_manuals')");
    expect(readdirSync(join(ROOT, 'docs')).filter((f) => f.startsWith('POSTER_'))).toHaveLength(3);
  });
});
