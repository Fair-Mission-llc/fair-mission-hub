// Sprint 8S Revision 3 (schema version 96): the Charitable Donation Workflow drawers pivot to OUTGOING charity money -
// Member Charity Request > FS/GK Compliance Endorsement > Treasurer Check Settlement, with the endorsement recorded and
// required before a check - and the automated Old Business engine: last month's open minutes checkboxes on Home and in
// the next meeting's minutes draft at launch.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertRequestEndorsable,
  assertRequestEndorsedForPayment,
  buildCharityPipeline,
  canEndorseCharityRequest,
  CHARITY_ENDORSEMENT_STEP_LABEL,
  CHARITY_REQUEST_STEP_LABEL,
  CHARITY_SETTLEMENT_STEP_LABEL,
  charityPipelineAlert,
  charityPipelineStage,
  DESK_DRAWERS,
  deskDrawersFor,
  HOME_UNIVERSAL_CARDS,
  minutesCheckboxes,
  OLD_BUSINESS_HEADING,
  oldBusinessItems,
  openMinutesItems,
  PLATFORM_SCHEMA_VERSION,
  previousMonthRange,
  setMinutesCheckbox,
  upcomingAgenda,
  UPCOMING_EVENT_AGENDA_TITLE,
  withOldBusiness,
  type CalendarEntry,
  type CharitableRequest,
  type DataService,
  type Meeting,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const seat = (roles: string[], memberType: 'Member' | 'Admin' | 'Super Admin' = 'Member', memberId = 7) => ({ memberId, councilId: OWN, memberType, isOfficer: roles.length > 0, roles });
const FS = seat(['Financial Secretary']);
const GK = seat(['Grand Knight']);
const DGK = seat(['Deputy Grand Knight']);
const TREASURER = seat(['Treasurer']);

const req = (over: Partial<CharitableRequest> = {}): CharitableRequest => ({
  id: 5,
  CouncilID: OWN,
  OrganizationName: 'Cathedral Neighbors Food Bank',
  AmountRequested: 350,
  RequestStatus: 'Advanced',
  SubmittedAt: '2026-09-01 12:00:00',
  ShepherdMemberID: 3,
  Is501c3: 1,
  IsRecurring: 0,
  RequestTier: 1,
  VoteStatus: 'Approved',
  AmountApproved: 350,
  ...over,
});
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return (err as { code?: string }).code;
  }
  return null;
};
const detail = (r: CharitableRequest) => ({ request: r });

describe('1. the outgoing charity pipeline (pure)', () => {
  it('names the three steps exactly', () => {
    expect([CHARITY_REQUEST_STEP_LABEL, CHARITY_ENDORSEMENT_STEP_LABEL, CHARITY_SETTLEMENT_STEP_LABEL]).toEqual([
      '[ 📋 Member Charity Request ]',
      '[ ✍️ FS/GK Compliance Endorsement ]',
      '[ ⛪ Treasurer Check Settlement ]',
    ]);
  });

  it('places each request on its step', () => {
    expect(charityPipelineStage(req({ VoteStatus: 'Pending', RequestStatus: 'Submitted' }))).toBe('request');
    expect(charityPipelineStage(req())).toBe('endorsement');
    expect(charityPipelineStage(req({ compliance_endorsed_by_member_id: 2 }))).toBe('settlement');
    expect(charityPipelineStage(req({ compliance_endorsed_by_member_id: 2, PaymentOrderId: 9 }))).toBe('paid');
    expect(charityPipelineStage(req({ VoteStatus: 'Rejected' }))).toBe('closed');
    expect(charityPipelineStage(req({ RequestStatus: 'Declined', VoteStatus: 'Pending' }))).toBe('closed');
  });

  it('lets the FS, GK and DGK endorse, never the Shepherd, and only an approved, unpaid, unendorsed request', () => {
    expect([FS, GK, DGK, TREASURER, seat([])].map((u) => canEndorseCharityRequest(u, OWN))).toEqual([true, true, true, false, false]);
    expect(canEndorseCharityRequest(FS, 2)).toBe(false);
    expect(canEndorseCharityRequest(seat([], 'Super Admin'), 2)).toBe(true);
    expect(code(() => assertRequestEndorsable(req(), 7))).toBeNull();
    expect(code(() => assertRequestEndorsable(req({ VoteStatus: 'Pending' }), 7))).toBe('REQUEST_STATUS_CONFLICT');
    expect(code(() => assertRequestEndorsable(req({ compliance_endorsed_by_member_id: 2 }), 7))).toBe('REQUEST_STATUS_CONFLICT');
    expect(code(() => assertRequestEndorsable(req({ PaymentOrderId: 4 }), 7))).toBe('REQUEST_STATUS_CONFLICT');
    expect(code(() => assertRequestEndorsable(req(), 3))).toBe('SELF_ENDORSEMENT_BLOCKED');
  });

  it('pays only an endorsed request, and never by its endorser', () => {
    expect(code(() => assertRequestEndorsedForPayment(req(), 7))).toBe('CHARITY_ENDORSEMENT_REQUIRED');
    expect(code(() => assertRequestEndorsedForPayment(req({ compliance_endorsed_by_member_id: 7 }), 7))).toBe('ENDORSER_PAYOUT_BLOCKED');
    expect(code(() => assertRequestEndorsedForPayment(req({ compliance_endorsed_by_member_id: 2 }), 7))).toBeNull();
  });

  it('counts each step and puts each desk on its own', () => {
    const rows = [
      req({ id: 1, VoteStatus: 'Pending', RequestStatus: 'Claimed by Trustee' }),
      req({ id: 2 }),
      req({ id: 3 }),
      req({ id: 4, compliance_endorsed_by_member_id: 2 }),
      req({ id: 5, compliance_endorsed_by_member_id: 2, PaymentOrderId: 8 }),
    ].map(detail);
    const fs = buildCharityPipeline('financial-secretary', rows);
    expect(fs.steps.map((s) => [s.label, s.count, s.state, s.yours])).toEqual([
      [CHARITY_REQUEST_STEP_LABEL, 1, 'upcoming', false],
      [CHARITY_ENDORSEMENT_STEP_LABEL, 2, 'current', true],
      [CHARITY_SETTLEMENT_STEP_LABEL, 1, 'upcoming', false],
    ]);
    expect([fs.waiting, fs.paid]).toEqual([2, 1]);
    const t = buildCharityPipeline('treasurer', rows);
    expect(t.steps[2]).toMatchObject({ state: 'current', yours: true });
    expect(t.waiting).toBe(1);
    expect(buildCharityPipeline('grand-knight', []).headline).toBe('No charity request is open. Every approved request is paid.');
  });

  it('lights the drawer only for work the reader may do now', () => {
    const toEndorse = [detail(req())];
    const toPay = [detail(req({ compliance_endorsed_by_member_id: 2 }))];
    expect(charityPipelineAlert(FS, 'financial-secretary', OWN, toEndorse)).toBe(true);
    expect(charityPipelineAlert(GK, 'grand-knight', OWN, toEndorse)).toBe(true);
    expect(charityPipelineAlert(seat(['Financial Secretary'], 'Member', 3), 'financial-secretary', OWN, toEndorse)).toBe(false); // the Shepherd
    expect(charityPipelineAlert(TREASURER, 'treasurer', OWN, toPay)).toBe(true);
    expect(charityPipelineAlert(seat(['Treasurer'], 'Member', 2), 'treasurer', OWN, toPay)).toBe(false); // the endorser
    expect(charityPipelineAlert(TREASURER, 'treasurer', OWN, toEndorse)).toBe(false);
  });

  it('mounts the drawer on the FS, Treasurer and GK desks and the console in place', () => {
    expect(DESK_DRAWERS.filter((d) => d.id === 'donation-workflow').map((d) => [d.desk, d.area])).toEqual([
      ['grand-knight', 'charities/vetting'],
      ['financial-secretary', 'charities/queue'],
      ['treasurer', 'charities/queue'],
    ]);
    expect(deskDrawersFor(GK, 'grand-knight', OWN).map((d) => d.id)).toContain('donation-workflow');
    expect(deskDrawersFor(seat(['Trustee 1']), 'grand-knight', OWN).map((d) => d.id)).not.toContain('donation-workflow');
    const parts = read('apps/web/components/FinanceWorkflowParts.tsx');
    expect(parts).toContain('<CharityCheckConsole />');
    expect(parts).toContain('db.charities.endorseApprovedRequest(');
    expect(read('apps/web/components/modules/CharityCheckConsole.tsx')).toContain('chargeableBlock(request, user.memberId)');
  });
});

/** Filed by the plain member, vetted by Admin 2, put on the agenda and passed; not endorsed. */
async function approvedRequest(db: DataService): Promise<number> {
  const { request } = await db.charities.submitCharitableRequest(MEMBER.member, {
    OrganizationName: 'Cathedral Neighbors Food Bank',
    AmountRequested: 350,
    RelationshipTypeID: 1,
    Is501c3: true,
    OrgMission: 'Weekly groceries for families near the cathedral',
  });
  await db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'claim' });
  await db.charities.triageRequestStatus(MEMBER.admin, request.id, { action: 'advance' });
  await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, 1, '2026-2027');
  const { motion } = await db.charities.routeRequestToNextEligibleAgenda(MEMBER.superAdmin, request.id);
  await db.meetings.finalizeProposedMotionVote(MEMBER.superAdmin, motion.id, 'Passed');
  return request.id;
}

const CHECK = { CheckNumber: '1401', PayoutDate: '2026-09-21', CharityType: 'Food Security' };

describe.each(drivers)('$name driver: the endorsement step', (d) => {
  it('records the endorsement and requires it, from a second officer, before the check', async () => {
    const db = await d.make();
    const id = await approvedRequest(db);
    await expectRule(db.charities.payApprovedRequest(MEMBER.admin, id, CHECK), 'CHARITY_ENDORSEMENT_REQUIRED');
    await expectRule(db.charities.endorseApprovedRequest(MEMBER.newMember, id), 'CHARITY_ENDORSER_REQUIRED');
    await expectRule(db.charities.endorseApprovedRequest(MEMBER.member, id), 'CHARITY_ENDORSER_REQUIRED');
    await expectRule(db.charities.endorseApprovedRequest(MEMBER.superAdmin, 9999), 'RECORD_NOT_FOUND');
    const endorsed = await db.charities.endorseApprovedRequest(MEMBER.admin, id);
    expect(endorsed.compliance_endorsed_by_member_id).toBe(MEMBER.admin);
    expect(endorsed.compliance_endorsed_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    await expectRule(db.charities.endorseApprovedRequest(MEMBER.superAdmin, id), 'REQUEST_STATUS_CONFLICT');
    await expectRule(db.charities.payApprovedRequest(MEMBER.admin, id, CHECK), 'ENDORSER_PAYOUT_BLOCKED');
    const paid = await db.charities.payApprovedRequest(MEMBER.superAdmin, id, CHECK);
    expect(paid.request.PaymentOrderId).toBe(paid.disbursement.id);
    const queue = await db.charities.listCharitableRequestsQueue(MEMBER.superAdmin, OWN);
    expect(charityPipelineStage(queue.find((q) => q.request.id === id)!.request)).toBe('paid');
  });
});

// ---- 2. the Old Business engine ------------------------------------------------------------------------------------

const SEPT_MINUTES = `# Projects
- [x] Order replacement banners for the parish picnic
- [ ] Seal the teak furniture on the parish patio before the rains
  * [ ] Organize the council storage room in the parish hall basement
- a plain bullet`;

const meeting = (id: number, date: string, text: string | null, published: boolean): Meeting & { 'Meeting Name': string } =>
  ({ id, CouncilID: OWN, Date: date, 'Meeting Name': `Meeting ${id}`, minutes_text: text, minutes_published_at: published ? '2026-09-18 20:00:00' : null }) as unknown as Meeting & {
    'Meeting Name': string;
  };

describe('2. the Old Business engine (pure)', () => {
  it('reads only the open checkbox lines', () => {
    expect(openMinutesItems(SEPT_MINUTES)).toEqual(['Seal the teak furniture on the parish patio before the rains', 'Organize the council storage room in the parish hall basement']);
    expect(openMinutesItems(null)).toEqual([]);
  });

  it('takes the previous calendar month, across the new year', () => {
    expect(previousMonthRange('2026-10-13')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(previousMonthRange('2027-01-05')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(previousMonthRange('2028-03-01')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it("lists last month's published items once, oldest meeting first", () => {
    const rows = [
      meeting(3, '2026-09-29', '- [ ] seal the TEAK furniture on the parish patio before the rains\n- [ ] Order the Christmas tree', true),
      meeting(2, '2026-09-15', SEPT_MINUTES, true),
      meeting(4, '2026-09-30', '- [ ] Draft only', false),
      meeting(1, '2026-08-20', '- [ ] Too old', true),
      meeting(5, '2026-10-06', '- [ ] This month', true),
    ];
    expect(oldBusinessItems(rows, OWN, '2026-10-13').map((i) => [i.meetingId, i.text])).toEqual([
      [2, 'Seal the teak furniture on the parish patio before the rains'],
      [2, 'Organize the council storage room in the parish hall basement'],
      [3, 'Order the Christmas tree'],
    ]);
    expect(oldBusinessItems(rows, 2, '2026-10-13')).toEqual([]);
  });

  it('writes the block into a draft once, within the length cap', () => {
    const items = [{ text: 'Seal the teak furniture' }, { text: 'Organize the storage room' }];
    const first = withOldBusiness('# Call to order', items, 20_000)!;
    expect(first).toBe(`${OLD_BUSINESS_HEADING}\n- [ ] Seal the teak furniture\n- [ ] Organize the storage room\n\n# Call to order`);
    expect(withOldBusiness(first, items, 20_000)).toBeNull();
    expect(withOldBusiness('', [], 20_000)).toBeNull();
    expect(withOldBusiness('x'.repeat(50), items, 60)).toBeNull();
  });

  it('ticks one checkbox line and leaves the rest of the text alone', () => {
    const boxes = minutesCheckboxes(SEPT_MINUTES);
    expect(boxes.map((b) => [b.line, b.done])).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ]);
    const ticked = setMinutesCheckbox(SEPT_MINUTES, 2, true);
    expect(openMinutesItems(ticked)).toEqual(['Organize the council storage room in the parish hall basement']);
    expect(setMinutesCheckbox(ticked, 2, false)).toBe(SEPT_MINUTES);
    expect(setMinutesCheckbox(SEPT_MINUTES, 4, true)).toBe(SEPT_MINUTES);
  });

  it('renames the Home card and shows the next seven days with the priorities', () => {
    expect(UPCOMING_EVENT_AGENDA_TITLE).toBe('[ 📅 Upcoming Event Agenda ]');
    expect(HOME_UNIVERSAL_CARDS).toContain('Upcoming Event Agenda');
    expect(HOME_UNIVERSAL_CARDS).not.toContain("Today's Event Agenda");
    const e = (id: number, startDate: string, endDate = startDate, startTime: string | null = null) => ({ id, kind: 'event', title: `E${id}`, startDate, endDate, startTime }) as unknown as CalendarEntry;
    expect(upcomingAgenda([e(1, '2026-10-21'), e(2, '2026-10-14', '2026-10-14', '19:00'), e(3, '2026-10-10', '2026-10-13'), e(4, '2026-10-19')], '2026-10-13', '2026-10-19').map((x) => x.id)).toEqual([3, 2, 4]);
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).toContain('<HomeCard title={UPCOMING_EVENT_AGENDA_TITLE}>');
    expect(desks).toContain('db.meetings.listOldBusiness(councilId, today)');
    expect(desks).not.toContain('<HomeCard title="Today\'s Event Agenda">');
    expect(desks).toContain('<CarriedOldBusiness');
  });
});

describe.each(drivers)('$name driver: the Old Business engine', (d) => {
  it("lists last month's open items and writes them into the next meeting's draft at launch, once", async () => {
    const db = await d.make();
    const type = (await db.lookups.list('MeetingType'))[0];
    const make = (name: string, date: string) =>
      db.meetings.create({ OwnerID: null, CouncilID: OWN, 'Meeting Name': name, Date: date, 'Time Start': '19:30:00', 'Time End': '21:00:00', Location: 'Parish Hall', MeetingType: type.id });
    const august = await make('August Business Meeting', '2026-08-18');
    const september = await make('September Business Meeting', '2026-09-15');
    await db.meetings.saveMeetingMinutes(MEMBER.admin, august.id, { text: SEPT_MINUTES, publish: true });
    await db.meetings.saveMeetingMinutes(MEMBER.admin, september.id, { text: '# Call to order' });

    const listed = await db.meetings.listOldBusiness(OWN, '2026-09-20');
    expect(listed.map((i) => [i.meetingName, i.text])).toEqual([
      ['August Business Meeting', 'Seal the teak furniture on the parish patio before the rains'],
      ['August Business Meeting', 'Organize the council storage room in the parish hall basement'],
    ]);
    await expectRule(db.meetings.listOldBusiness(OWN, '2026/09/20'), 'INVALID_DATE');

    const launch = await db.meetings.launchLiveMeeting(MEMBER.admin, september.id);
    expect(launch.oldBusiness).toHaveLength(2);
    expect(launch.minutesText.startsWith(`${OLD_BUSINESS_HEADING}\n- [ ] Seal the teak furniture`)).toBe(true);
    expect(launch.minutesText.endsWith('# Call to order')).toBe(true);
    const again = await db.meetings.launchLiveMeeting(MEMBER.admin, september.id);
    expect(again.minutesText).toBe(launch.minutesText);
    expect(again.minutesText.split(OLD_BUSINESS_HEADING)).toHaveLength(2);

    // Published minutes are never rewritten by a launch.
    const published = await db.meetings.saveMeetingMinutes(MEMBER.admin, september.id, { text: 'Final', publish: true });
    expect((await db.meetings.launchLiveMeeting(MEMBER.admin, september.id)).minutesText).toBe(published.minutes_text);
  });
});

describe('3. schema 96 and the seed', () => {
  it('moves the phone database to 96 and adds the endorsement columns', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBeGreaterThanOrEqual(96);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toContain(' * 96: CharitableRequest.compliance_endorsed_by_member_id');
    const schema = read('Schema.sql');
    expect(schema).toContain('(schema version 96)');
    expect(schema).toContain('ALTER TABLE [CharitableRequest] ADD [compliance_endorsed_by_member_id] INTEGER NULL;');
    expect(schema).toContain('ALTER TABLE [CharitableRequest] ADD [compliance_endorsed_at] DATETIME NULL;');
    expect(read('docs/ARCHITECTURAL_HISTORY.md')).toContain('| 96 | 8S Revision 3 |');
  });

  it("seeds the September minutes with the teak furniture and storage room items", () => {
    const seed = read('Seed.sql');
    expect(seed).toContain("'September Business Meeting'");
    expect(seed).toContain('- [ ] Seal the teak furniture on the parish patio before the rains');
    expect(seed).toContain('- [ ] Organize the council storage room in the parish hall basement');
  });
});
