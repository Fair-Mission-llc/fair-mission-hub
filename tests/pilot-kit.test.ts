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
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = ([7-9]\d|\d{3});/);
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
    expect(fsDesk).toEqual(expect.arrayContaining([14, 15, 20, 21]));
    // Sprint 8M Extension: report 16 is fully signed and waits for the Treasurer's check on boot.
    expect(fsDesk).not.toContain(16);
    expect((await db.expenses.listTreasurerQueue(treasurer, OWN)).map((q) => q.report.id)).toEqual(expect.arrayContaining([17, 18]));
    expect((await db.expenses.listAuthorizationQueue(gk, OWN)).map((q) => q.report.id)).toEqual([19, 23]);

    const held = await db.volunteerQuarantine.listPending(dgk, OWN);
    expect(held.map((h) => [h.memberName, h.row.activity_type, h.row.hours_reported])).toEqual([
      ['Member Alpha', 'SHIFT', 6.5],
      ['Member Beta', 'MANUAL', 6],
    ]);
  });

  it('signs both member personas up for every Parish Parking Event shift', async () => {
    const db = await makePresentation();
    const event = (await db.events.listByCouncil(OWN)).find((e) => e.EventName === 'Parish Parking Event')!;
    // Sprint 8S Revision 10.6: re-anchored by whole weeks to NOW (Sunday 2026-09-20, day 8 of the event: its second weekend).
    expect(event).toMatchObject({ StartDate: '2026-09-12', EndDate: '2026-10-03', Location: "St. Mary's Cathedral Parking Lot" });
    const shifts = await db.events.listShifts(event.id);
    expect(shifts).toHaveLength(7); // Sprint 8S Revision 10.7: six weekend shifts + the Wednesday slot
    for (const email of ['member_alpha@stmarys.org', 'member_beta@stmarys.org']) {
      const member = (await db.auth.signIn(email, PASSWORD))!;
      const mine = (await db.events.listMemberShifts(member.memberId)).filter((s) => s.event.id === event.id);
      expect(mine, email).toHaveLength(7);
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

  it('the GK script: report 19 is released', async () => {
    const db = await makePilot();
    const who = await ids(db);
    expect((await db.expenses.grandKnightAuthorizeOrder(who.gk_user!, 19)).report.Status).toBe('Approved');
  });

  it('the Treasurer script: report 16 is paid with check 1201 and nothing waits on the Grand Knight (Sprint 8M Extension)', async () => {
    const db = await makePilot();
    const who = await ids(db);
    await db.expenses.recordDisbursement(who.treasurer_user!, OWN, [16], { CheckNumber: '1201', PayoutDate: '2026-10-12' });
    const historian = (await db.auth.signIn('historian_user@stmarys.org', PASSWORD))!.memberId;
    expect((await db.expenses.listUserReports(historian)).find((r) => r.report.id === 16)?.report.Status).toBe('Reimbursed');
  });

  it("the Treasurer's chapter 2: the seeded 50% split turns $400.00 into a $200.00 request with no setting changed (Sprint 8S Revision 10)", async () => {
    const db = await makePilot();
    const who = await ids(db);
    expect((await db.finance.getParishSplitConsole(who.treasurer_user!, OWN)).settings).toEqual({ parish_split_enabled: 1, parish_split_percentage: 50, parish_split_gl_line_id: 16 });
    const row = (await db.finance.getParishSplitConsole(who.treasurer_user!, OWN)).events.find((r) => r.eventName === 'Parish Parking Event')!;
    expect(row).toMatchObject({ grossCollections: 400, share: 200, alreadyRequested: 0, available: 200 });
    const issued = await db.finance.issueChurchDisbursementRequest(who.treasurer_user!, OWN, row.eventId);
    expect(issued.request).toMatchObject({ id: 1, amount: 200, status: 'PENDING' });
    const paid = await db.finance.recordChurchDisbursementPayment(who.fs_user!, issued.request.id, { CheckNumber: '1404' });
    expect(paid).toMatchObject({ glAccountName: 'Parish Fundraiser Share', request: { status: 'PAID', check_number: '1404' } });
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
    expect((await db.volunteerQuarantine.reject(who.dgk_user!, alpha.row.id, 'Shift 9 ran 4 hours; report 4.')).clearance_status).toBe('DRAFT');
    // Alpha reports the Saturday shift (Shift 9) again with its 4 scheduled hours: it logs directly.
    expect(isQuarantinedHours(await db.eventTime.logHours(who.member_alpha!, 9, 4))).toBe(false);
    // Beta reports 9 hours on the 4-hour Sunday shift (Shift 10): it is held for review.
    expect(isQuarantinedHours(await db.eventTime.logHours(who.member_beta!, 10, 9))).toBe(true);
  });

  it("Sprint 8S Revision 9: the members' phone tap grid logs Alpha's hour of Planning and Beta's two hours of Ushering directly", async () => {
    const db = await makePilot();
    const who = await ids(db);
    const activities = await db.activities.listByCouncil(OWN);
    const idOf = (name: string) => activities.find((a) => a.ActivityName === name)!.id;
    const today = '2026-10-12';
    for (const [member, name, taps] of [[who.member_alpha!, 'Planning', 4], [who.member_beta!, 'Ushering', 8]] as const) {
      let last: Awaited<ReturnType<typeof db.activityTime.addQuarterHour>> | null = null;
      for (let i = 0; i < taps; i += 1) last = await db.activityTime.addQuarterHour(member, idOf(name), today);
      expect(isQuarantinedHours(last!), name).toBe(false);
      expect((last as { Hours: number }).Hours, name).toBe(taps / 4);
    }
  });
});

// Sprint 8S Revision 10: the three seated group flows, replayed on one load after the individual scripts' steps - every
// officer works the seeded record waiting at his own gate, and the members' new records stay on their own laptops.
describe.each(drivers)('$name driver: the seated group flows hold true', (d) => {
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

  it('Flow 1: Alpha files a new report, then FS signs 21, the Treasurer codes 22, the GK releases 23 and the Treasurer pays 13', async () => {
    const db = await makePilot();
    const [alpha, fs, treasurer, gk] = await Promise.all(['member_alpha', 'fs_user', 'treasurer_user', 'gk_user'].map((u) => signIn(db, u)));
    // The individual scripts' expense steps come first on the same load.
    await db.expenses.financialSecretaryAuditOrder(fs, 14);
    await db.expenses.financialSecretaryAuditOrder(fs, 20);
    await db.expenses.rejectReport(fs, 15, 'Please add the receipt photo');
    await db.expenses.treasurerLedgerAudit(treasurer, 17, { budgetLineId: 25, generalLedgerAccountId: 12 });
    await db.expenses.grandKnightAuthorizeOrder(gk, 19);
    await db.expenses.recordDisbursement(treasurer, OWN, [16], { CheckNumber: '1201', PayoutDate: '2026-10-12' });

    const mine = await db.expenses.submitReport(alpha, { Status: 'Submitted', LinkedEventID: 9 }, [line('Ace Hardware', 18.4, 'Zip ties and sign stakes')]);
    expect(mine.report.Status).toBe('Submitted');
    // Gate 1: the payment request on report 21.
    expect((await db.expenses.listCouncilQueue(fs, OWN)).filter((q) => awaitsWrittenOrder(q.report)).map((q) => q.report.id)).toContain(21);
    await db.expenses.financialSecretaryAuditOrder(fs, 21);
    // Gate 2: the ledger coding on report 22.
    expect((await db.expenses.listTreasurerQueue(treasurer, OWN)).map((q) => q.report.id)).toContain(22);
    await db.expenses.treasurerLedgerAudit(treasurer, 22, { budgetLineId: 25, generalLedgerAccountId: 13 });
    // Gate 3: the final release on report 23.
    expect((await db.expenses.listAuthorizationQueue(gk, OWN)).map((q) => q.report.id)).toContain(23);
    expect((await db.expenses.grandKnightAuthorizeOrder(gk, 23)).report.Status).toBe('Approved');
    // Gate 4: the check for report 13, released in September.
    const queue = await db.expenses.listCouncilQueue(treasurer, OWN);
    expect(queue.find((q) => q.report.id === 13)?.report.Status).toBe('Approved');
    await db.expenses.recordDisbursement(treasurer, OWN, [13], { CheckNumber: '1401', PayoutDate: '2026-10-12' });
    expect((await db.expenses.listCouncilQueue(treasurer, OWN)).find((q) => q.report.id === 13)?.report.Status ?? 'Reimbursed').toBe('Reimbursed');
  });

  it('Flow 2: Alpha proposes the food bank; the DGK claims request 6, asks for more information and places it on November 3', async () => {
    const db = await makePilot();
    const [alpha, dgk] = await Promise.all(['member_alpha', 'dgk_user'].map((u) => signIn(db, u)));
    // Facilitator preparation on the DGK laptop: the year's Monthly meetings.
    await db.meetings.populateAnnualCadence(dgk, OWN, 1, '2026-2027');

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
    expect(request.RequestStatus).toBe('Submitted');

    await db.charities.triageRequestStatus(dgk, 6, { action: 'claim' });
    await db.charities.openRequestThread(dgk, 6, 'MORE_INFO', 'How many of the forty seniors live in our parish?');
    await db.charities.triageRequestStatus(dgk, 6, { action: 'advance', TargetBudgetLineID: 23 });
    const { meeting } = await db.charities.routeRequestToNextEligibleAgenda(dgk, 6);
    expect(meeting).toMatchObject({ Date: '2026-11-03', MeetingTypeID: 1 }); // the first Tuesday at least 10 days after October 12
  });

  it("Flow 3: Alpha's 7 hours are held on his screen; the DGK rejects the seeded 6.5-hour entry and Alpha's 4 hours log at once", async () => {
    const db = await makePilot();
    const [alpha, beta, dgk] = await Promise.all(['member_alpha', 'member_beta', 'dgk_user'].map((u) => signIn(db, u)));
    // The DGK's individual script decides Beta's entry only.
    const seeded = await db.volunteerQuarantine.listPending(dgk, OWN);
    await db.volunteerQuarantine.clear(dgk, seeded.find((h) => h.row.user_id === beta)!.row.id);
    const alphaSeeded = seeded.find((h) => h.row.user_id === alpha)!;
    expect(alphaSeeded.row.hours_reported).toBe(6.5);

    expect(isQuarantinedHours(await db.eventTime.logHours(alpha, 10, 7))).toBe(true);
    expect((await db.volunteerQuarantine.reject(dgk, alphaSeeded.row.id, 'Too many hours for one day.')).clearance_status).toBe('DRAFT');
    expect(isQuarantinedHours(await db.eventTime.logHours(alpha, 10, 4))).toBe(false);
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
    // Sprint 7I Extension: the group flows leave the meeting console out. Sprint 8S Revision 10: the officers' group steps
    // work seeded reports (21, 22, 23 and 13), never the ones the individual scripts use (14-20).
    const group = kit.slice(kit.indexOf('GROUP_FLOWS: tuple'), kit.indexOf('FEEDBACK_RATINGS: tuple'));
    expect(group).not.toMatch(/Mtgs tab|check in|report 1[4-9]|report 20/i);
    // Sprint 8M Extension: Flow 5 is the live vetting only (claim, Request More Info both ways, Place on next agenda);
    // the floor vote and the grant's check happen at the real Monthly meeting, after the session.
    expect(group).not.toContain('Record Hand Ballot Tally');
    expect(group).toContain('Propose or follow a charity grant');
    expect(group).toContain('Claim & Audit');
    expect(group).toContain('Request More Info');
    expect(group).toContain('Place on next agenda');
    expect(group).toContain('Advance to vote');
    // Sprint 7I Extension 2: the individual scripts leave the meeting console out too.
    expect(kit.slice(kit.indexOf('PERSONAS: tuple'), kit.indexOf('GROUP_FLOWS: tuple'))).not.toMatch(/Live Meeting Console|welcome line/i);
  });

  it('keeps custom guides out of git', () => {
    expect(read('.gitignore')).toContain('generated/custom_manuals/');
    expect(read('apps/web/app/api/council/compile-manual/route.ts')).toContain("join(root, 'generated', 'custom_manuals')");
    expect(readdirSync(join(ROOT, 'docs')).filter((f) => f.startsWith('POSTER_'))).toHaveLength(3);
  });
});

// Sprint 8L: every web step from the Active Desks row and large print. Sprint 8S Revision 8: one web-only session from a
// 6:15 PM gavel in five phases (the 8L 30 + 30 split and the phone steps are gone).
describe('Sprint 8L pilot kit', () => {
  const kit = read('scripts/pilot_kit_pdf.py');
  const personas = kit.slice(kit.indexOf('PERSONAS: tuple'), kit.indexOf('GROUP_FLOWS: tuple'));
  const group = kit.slice(kit.indexOf('GROUP_FLOWS: tuple'), kit.indexOf('FEEDBACK_RATINGS: tuple'));

  it('anchors the session on the 6:15 PM gavel: Intro, Individual, Group, Exploration and Listening', () => {
    expect(kit).toContain("GAVEL_TIME = '6:15 PM'");
    for (const line of ['INTRO_MINUTES = 5', 'INDIVIDUAL_PHASE_MINUTES = 20', 'GROUP_PHASE_MINUTES = 40', 'EXPLORATION_MINUTES = 20', 'LISTENING_MINUTES = 20']) expect(kit).toContain(line);
    const clocks = [...kit.matchAll(/\('(\d:\d\d - \d:\d\d PM)', (\w+_MINUTES)/g)].map((m) => m[1]);
    expect(clocks).toEqual(['6:15 - 6:20 PM', '6:20 - 6:40 PM', '6:40 - 7:20 PM', '7:20 - 7:40 PM', '7:40 - 8:00 PM']);
    for (const phase of ['Introduction', 'Individual Desk Coordinate Phase', 'Synchronized Group Workflow', 'Open Exploration', 'Listening Session']) expect(kit).toContain(phase);
    const minutes = [...group.matchAll(/minutes=(\d+)/g)].map((m) => Number(m[1]));
    expect(minutes.reduce((x, y) => x + y, 0)).toBe(40);
    expect(kit).not.toMatch(/60-minute|30-minute/);
  });

  it('starts every web step from the Active Desks folders, never the sidebar', () => {
    expect(personas + group).not.toMatch(/sidebar|left navigation|Finances > (FS Expense Audit|GK Expense Authorize|Treasurer Ledger Audit Desk|Charity Vetting Queue|My Expense Reports)/);
    for (const folder of [
      'Charitable Grant Requests Vetting Board',
      'Constitutional Advisor Panels',
      'Connected Councils',
      'Semiannual Audit Form 1295 Center',
      'Charity Check Issuance Console',
      'Annual Budget vs Actuals Ledger Grid',
      'Bank Statement Match-Window',
      'Google Drive Media Gallery Sync Board',
    ])
      expect(personas, folder).toContain(folder);
  });

  it('puts Alpha and Beta on their phones in the individual phase and keeps the group phase web-only (Sprint 8S Revision 9)', () => {
    for (const key of ['alpha', 'beta']) {
      const steps = personas.slice(personas.indexOf(`key='${key}'`), key === 'alpha' ? personas.indexOf("key='beta'") : undefined);
      expect(steps, key).toContain('Step(SIGN_IN_PHONE');
      expect(steps, key).toContain("Step('Phone > Collect tab'");
      expect(steps, key).toContain('Under Tap an activity: 15 minutes per tap');
      expect(steps, key).toContain('Slide to Log Hours');
      expect(steps, key).toContain('Phone > Home > My expense reports');
      expect(steps, key).toContain('Tap Submit for approval.');
    }
    // The officers' scripts and every group flow stay on the laptops.
    for (const key of ['gk', 'fs', 'treasurer', 'dgk', 'historian']) {
      const next = ['gk', 'fs', 'treasurer', 'dgk', 'historian', 'alpha'][['gk', 'fs', 'treasurer', 'dgk', 'historian'].indexOf(key) + 1];
      expect(personas.slice(personas.indexOf(`key='${key}'`), personas.indexOf(`key='${next}'`)), key).not.toMatch(/\bphones?\b|Phone >|\btap\b/i);
    }
    const flows = group.slice(0, group.indexOf('# Sprint 8S Revision 8: the Live Meeting session'));
    expect(flows).not.toMatch(/\bphones?\b|smartphone|Expo Go|Collect tab|Report tab|Donate tab|\btap\b/i);
    expect(flows.match(/Step\(HOUR_LEDGER/g)).toHaveLength(2);
    expect(kit).toContain('Synchronized Group Workflow (web only)');
    expect(kit).toContain('Individual Desk Coordinate Phase (mobile and web)');
    expect(kit).not.toMatch(/Expo Go|smartphone/i);
  });

  it('has Member Alpha log the cash box drop, then conclude the session (Sprint 8N)', () => {
    const alpha = personas.slice(personas.indexOf("key='alpha'"), personas.indexOf("key='beta'"));
    const at = (text: string) => alpha.indexOf(text);
    expect(at('type 180.00 in AMOUNT')).toBeGreaterThan(at('tap the Venmo tile yourself'));
    expect(at('[ 🛑 Conclude Event Session & Lock Logs ]')).toBeGreaterThan(at('type 180.00 in AMOUNT'));
  });

  it("reviews the budget sheet on the Treasurer's script and prints Member Beta's pages in large type", () => {
    const treasurer = personas.slice(personas.indexOf("key='treasurer'"), personas.indexOf("key='dgk'"));
    expect(treasurer).toContain('Budgeted vs. Current Actual Spend');
    expect(treasurer).toContain('Budget Allocation & YOY Variance Analyzer');
    const beta = personas.slice(personas.indexOf("key='beta'"));
    expect(beta).toContain('large_print=True');
    expect(kit).toMatch(/LARGE_PRINT_SCALE = 1\.\d+/);
    expect(kit).toContain('styles(LARGE_PRINT_SCALE, LARGE_PRINT_SPACING) if p.large_print else st');
    expect(kit).toMatch(/LARGE_PRINT_SPACING = 1\.\d+/);
  });
});

// Sprint 8M Extension: independent individual scripts, no check logging on the volunteers' phones, and the six-flow
// group phase that ends with the parish settlement.
describe('Sprint 8M Extension pilot kit', () => {
  const kit = read('scripts/pilot_kit_pdf.py');
  const personas = kit.slice(kit.indexOf('PERSONAS: tuple'), kit.indexOf('GROUP_FLOWS: tuple'));
  const group = kit.slice(kit.indexOf('GROUP_FLOWS: tuple'), kit.indexOf('# Sprint 8S Revision 8: the Live Meeting session'));
  const persona = (key: string, next: string) => personas.slice(personas.indexOf(`key='${key}'`), next ? personas.indexOf(`key='${next}'`) : undefined);

  it("frees the Treasurer's script from the Grand Knight and adds the Parish Revenue Split Console chapter", () => {
    const treasurer = persona('treasurer', 'dgk');
    expect(treasurer).toContain('Report 16');
    expect(treasurer).toContain('check number 1201');
    expect(treasurer).not.toMatch(/After the Grand Knight releases|report 19/);
    expect(treasurer).toContain("chapter_title='Chapter 2 - The Parish Revenue Split Console'");
    expect(treasurer).toContain('[ 📋 Issue Church Disbursement Request ]');
    expect(treasurer).toContain('$400.00 x 50%');
  });

  it("keeps check logging off both volunteer scripts: Alpha's Venmo at $25.00 and $180 cash box drop", () => {
    for (const [key, next] of [['alpha', 'beta'], ['beta', '']] as const)
      expect(persona(key, next), key).not.toMatch(/Check tile|CHECK NUMBER|by check/i);
    const alpha = persona('alpha', 'beta');
    expect(alpha).toContain('Venmo tile yourself');
    expect(alpha).toContain('25.00');
    expect(alpha).toContain('Cash box drop - Saturday lot');
  });

  it('plays three seated flows: the expense pipeline, the charity request and the Flagged Hours Review gate (Sprint 8S Revision 10)', () => {
    const titles = [...group.matchAll(/title='(Flow \d) - ([^']+)'/g)].map((m) => `${m[1]} - ${m[2]}`);
    expect(titles).toEqual([
      'Flow 1 - The expense report pipeline, gate by gate',
      'Flow 2 - The charitable donation request workflow',
      'Flow 3 - The Flagged Hours Review gate',
    ]);
    expect(group).not.toMatch(/Donate tab|Start accepting|key='parish'|Switch it on|Save parish split|Parish share \(%\)/);
    const flow1 = group.slice(group.indexOf("key='expense'"), group.indexOf("key='charity'"));
    for (const report of ['report 21', 'report 22', 'report 23', 'report 13']) expect(flow1, report).toContain(report);
    expect(flow1).toContain('check number 1401');
  });

  it('keeps every persona in his own seat: no shared display, borrowed laptop or mid-session sign-out (Sprint 8S Revision 10)', () => {
    expect(kit).not.toMatch(/wireless|display laptop|on the display|at the GK laptop|takes the keyboard|sign (?:back )?in beside|sign back in|testadmin@kofc\.org/i);
    expect(group).not.toMatch(/who='[^']* at the [^']*laptop'|who='[^']* and [^']*'/);
    expect(kit).toContain("Every persona's own laptop, at his own seat");
  });

  it('pre-activates the parish split for the Treasurer (Sprint 8S Revision 10)', () => {
    const treasurer = persona('treasurer', 'dgk');
    expect(treasurer).not.toMatch(/Switch it on in Council Wide Settings|Save parish split|type 50 in Parish share/);
    expect(treasurer).toContain('The split is already on');
    expect(read('Seed.sql')).toContain('UPDATE [Council] SET [parish_split_enabled] = 1, [parish_split_percentage] = 50.00, [parish_split_gl_line_id] = 16 WHERE [id] = 1;');
    const historian = persona('historian', 'alpha');
    expect(historian).not.toMatch(/reports 16, 19 and 22|Charter member/);
  });

  it('gives Alpha the whole gate session and Beta one standalone gift (Sprint 8S Revision 10.2)', () => {
    const alpha = persona('alpha', 'beta');
    expect(alpha).toContain("Step('Phone > Collect tab > Start collecting for event'");
    expect(alpha).toMatch(/type 25.00 in STANDARD RATE/i);
    expect(alpha).toContain('The AMOUNT box already shows 25.00 from your setup. Do not type.');
    expect(alpha).toContain('drag the Slide to Conclude & Lock bar');
    expect(alpha).not.toMatch(/Gate open|Yes, conclude/);
    const beta = persona('beta', '');
    expect(beta).not.toMatch(/Gate open|STANDARD RATE|Tap Start|Conclude|ACCEPTING DONATIONS|Venmo|Parking in DONATION TYPE/);
    expect(beta).toContain('Do not tap Start collecting for event.');
    expect(beta).toContain('tap the Cash tile');
    expect(beta).toContain('Choose Unsolicited in DONATION TYPE');
    expect(beta).toContain('Recorded $50.00 by Cash as a standalone donation');
    expect(beta.indexOf('as a standalone donation')).toBeLessThan(beta.indexOf('Under Tap an activity'));
    // The donation type and the confirmation wording must match the seed and the phone screen.
    expect(read('Seed.sql')).toContain("('Unsolicited', 1)");
    expect(read('apps/mobile/app/(app)/donate.tsx')).toContain("' as a standalone donation'");
  });
});
