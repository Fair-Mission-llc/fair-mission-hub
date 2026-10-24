// Sprint 8S Revision 10.6 (schema version 97): the game-day calibration pass - the pilot's Parish Parking Event follows
// the calendar, the Ledger Line Coder's inferred budget line wraps, the photo gallery loses its header slideshow button
// and opens a newly saved Smart Album, and the Reference Workflows folders are read-only scoreboards with the FS/GK
// endorse button moved to its own working folder.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DonationSessionController,
  buildCharityPipeline,
  buildExpenseWorkflow,
  CHARITY_ENDORSEMENT_FOLDER_TITLE,
  DESK_DRAWERS,
  deskDrawersFor,
  deskSpineSections,
  expenseWorkflowStepOf,
  isEventAtGate,
  pilotTimelineOffsetDays,
  PILOT_PARKING_EVENT_NAME,
  shiftEnd,
  shiftSeedDate,
  shiftStart,
  toIsoDate,
  type DataService,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { openDatabases } from './shims/expo-sqlite';

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const OWN = 1;
const SEEDED_START = '2026-10-10';
/** The pilot's game day: Wednesday 2026-10-21, 6:30 PM. */
const GAME_DAY = new Date(2026, 9, 21, 18, 30, 0);

describe('1. the Parish Parking Event follows the calendar (pure)', () => {
  it('moves by whole weeks so today falls 2-8 days after the first Saturday', () => {
    expect(pilotTimelineOffsetDays(SEEDED_START, new Date(2026, 9, 12))).toBe(0); // the scripts' Monday
    expect(pilotTimelineOffsetDays(SEEDED_START, new Date(2026, 9, 18))).toBe(0); // the second Sunday
    expect(pilotTimelineOffsetDays(SEEDED_START, GAME_DAY)).toBe(7);
    expect(pilotTimelineOffsetDays(SEEDED_START, new Date(2026, 8, 20))).toBe(-28);
    for (let day = -60; day <= 120; day++) {
      const today = new Date(2026, 9, 10 + day, 9, 0, 0);
      const offset = pilotTimelineOffsetDays(SEEDED_START, today);
      expect(Math.abs(offset % 7)).toBe(0);
      const start = shiftSeedDate(SEEDED_START, offset);
      const since = Math.round((new Date(`${toIsoDate(today)}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86_400_000);
      expect(since, toIsoDate(today)).toBeGreaterThanOrEqual(2);
      expect(since, toIsoDate(today)).toBeLessThanOrEqual(8);
      expect(new Date(`${start}T00:00:00`).getDay()).toBe(6); // still a Saturday
    }
  });

  it('keeps the time part of a timestamp', () => {
    expect(shiftSeedDate('2026-10-10 13:15:00', 7)).toBe('2026-10-17 13:15:00');
    expect(shiftSeedDate('2026-10-10', 0)).toBe('2026-10-10');
  });
});

const makers: { name: string; make: (now: Date) => Promise<DataService> }[] = [
  {
    name: 'memory',
    make: async (now) => {
      const db = new MemoryDataService({ now: () => new Date(now), presentationData: true });
      await db.init();
      return db;
    },
  },
  {
    name: 'sqlite',
    make: async (now) => {
      openDatabases.length = 0;
      const db = new SqliteDataService({ now: () => new Date(now), presentationData: true });
      await db.init();
      return db;
    },
  },
];

describe.each(makers)('$name driver: the parking event on game day', (d) => {
  it('opens the event at the phone gate with its shifts, donations and held hours moved together', async () => {
    const db = await d.make(GAME_DAY);
    const event = (await db.events.listByCouncil(OWN)).find((e) => e.EventName === PILOT_PARKING_EVENT_NAME)!;
    expect(event).toMatchObject({ StartDate: '2026-10-17', EndDate: '2026-11-07', collection_status: 'OPEN' });
    const shifts = await db.events.listShifts(event.id);
    // Sprint 8S Revision 10.7: Shift 15, the Wednesday 12:00 PM-11:30 PM slot, lands on game day itself.
    expect(shifts.map((s) => s.ShiftDate).sort()).toEqual(['2026-10-17', '2026-10-18', '2026-10-21', '2026-10-24', '2026-10-25', '2026-10-31', '2026-11-01']);
    const wednesday = shifts.find((s) => s.ShiftDate === '2026-10-21')!;
    expect(wednesday).toMatchObject({ ShiftName: 'Lot attendants - Wednesday', StartTime: '12:00:00', EndTime: '23:30:00' });
    expect(shiftStart(wednesday).getTime()).toBeLessThanOrEqual(GAME_DAY.getTime());
    expect(shiftEnd(wednesday).getTime()).toBeGreaterThan(GAME_DAY.getTime());
    // The phone Collect tab offers only events at the gate (donate.tsx).
    expect(isEventAtGate(event, shifts, GAME_DAY)).toBe(true);
    const donations = await db.donations.list(OWN, { eventId: event.id });
    expect(donations.map((g) => g.DonationDate).sort()).toEqual(['2026-10-17', '2026-10-18']);
    expect(donations.reduce((sum, g) => sum + g.DonationAmount, 0)).toBe(400);
  });

  it('lets any plain member start collecting for the parking event and record a gift (Sprint 9 Revision 5.1)', async () => {
    const db = await d.make(GAME_DAY);
    const event = (await db.events.listByCouncil(OWN)).find((e) => e.EventName === PILOT_PARKING_EVENT_NAME)!;
    const typeId = (await db.donations.listTypes(OWN))[0].id;
    const cash = (await db.donations.listMethods(OWN)).find((m) => m.kind === 'cash')!;
    // Member Beta (34) holds no office; member 3 holds no office and has no shift on the event. Neither is refused.
    for (const memberId of [34, 3]) {
      expect((await db.members.listRoles(memberId)).filter((r) => r.Officer === 1)).toEqual([]);
      const session = new DonationSessionController(db, OWN, memberId);
      expect(await session.start(event.id, { amount: 25, donationTypeId: typeId })).toMatchObject({ active: true, eventId: event.id });
      const gift = await session.record({ DonationMethodID: cash.method.id });
      expect(gift).toMatchObject({ EventID: event.id, DonationAmount: 25, RecordedBy: memberId });
    }
    // The Collect tab puts no role check in front of 'Start collecting for event'.
    expect(read('apps/mobile/app/(app)/donate.tsx')).not.toMatch(/memberType|listRoles|holds\w*Seat|Officer/);
  });

  it('leaves the seeded dates alone on the scripts\' own day', async () => {
    const db = await d.make(new Date(2026, 9, 12, 19, 0, 0));
    const event = (await db.events.listByCouncil(OWN)).find((e) => e.EventName === PILOT_PARKING_EVENT_NAME)!;
    expect(event).toMatchObject({ StartDate: '2026-10-10', EndDate: '2026-10-31' });
  });
});

describe('1b. the phone re-anchors an already installed database', () => {
  it('runs the anchor after the presentation seed and on every open of a current database', () => {
    const driver = read('apps/mobile/services/drivers/sqlite.ts');
    expect(driver).toContain('await this.anchorPilotTimeline(db);');
    // Sprint 9 Revision 4.0: a phone still re-anchors on every open; only the persistent hub vault keeps its dates.
    expect(driver).toContain('if (this.presentationData && !this.persistent) await db.withTransactionAsync(() => this.anchorPilotTimeline(db));');
    expect(read('Seed.sql')).toContain('packages/shared/src/pilot-timeline.ts');
  });
});

describe('2. the inferred budget line wraps on the Ledger Line Coder', () => {
  it('lets the green label wrap inside its card', () => {
    const coder = read('apps/web/components/modules/LedgerLineCoder.tsx');
    const label = coder.slice(coder.indexOf('data-inferred-budget'), coder.indexOf('inferredBudgetLabel(inferred)}'));
    for (const cls of ['flex-wrap', 'whitespace-normal', 'break-words', 'max-w-full', 'font-bold text-green']) expect(label).toContain(cls);
    expect(label).not.toContain('max-w-72');
  });
});

describe('3. the photo gallery', () => {
  it('drops the header Play slideshow button and opens a newly saved Smart Album', () => {
    const gallery = read('apps/web/components/modules/PhotoGallery.tsx');
    expect(gallery).not.toContain('▶ Play slideshow');
    expect(gallery).not.toContain('autoplay: true');
    const save = gallery.slice(gallery.indexOf('const save = () =>'), gallery.indexOf('const remove = (album'));
    expect(save).toContain('onOpen(album);');
    expect(gallery).toContain('aria-pressed={activeId === a.id}');
  });
});

describe('4. read-only Reference Workflows and the endorsement folder', () => {
  const GK = { memberId: 7, councilId: OWN, memberType: 'Member', isOfficer: true, roles: ['Grand Knight'] };
  const FS = { memberId: 7, councilId: OWN, memberType: 'Member', isOfficer: true, roles: ['Financial Secretary'] };
  const TREASURER = { memberId: 7, councilId: OWN, memberType: 'Member', isOfficer: true, roles: ['Treasurer'] };

  it('files FS/GK Compliance Endorsements as a working folder that can float', () => {
    expect(DESK_DRAWERS.filter((d) => d.id === 'charity-endorsements').map((d) => [d.desk, d.title, d.alerts, d.cabinet])).toEqual([
      ['grand-knight', CHARITY_ENDORSEMENT_FOLDER_TITLE, true, undefined],
      ['financial-secretary', CHARITY_ENDORSEMENT_FOLDER_TITLE, true, 'outbound'],
    ]);
    expect(deskDrawersFor(GK, 'grand-knight', OWN).map((d) => d.id)).toContain('charity-endorsements');
    expect(deskDrawersFor(FS, 'financial-secretary', OWN).map((d) => d.id)).toContain('charity-endorsements');
    expect(deskDrawersFor(TREASURER, 'treasurer', OWN).map((d) => d.id)).not.toContain('charity-endorsements');
    const drawers = deskDrawersFor(GK, 'grand-knight', OWN);
    const sections = deskSpineSections('grand-knight', drawers, (s) => s.id === 'charity-endorsements' || s.id === 'donation-workflow');
    expect(sections[0].drawers.map((d) => d.id)).toEqual(['charity-endorsements']);
    expect(sections.at(-1)!.drawers.map((d) => d.id)).toContain('donation-workflow');
  });

  it('points every own step to its working folder instead of working it below', () => {
    expect(buildExpenseWorkflow('financial-secretary', [{ report: { Status: 'Submitted', FinancialSecretaryMemberID: null } as never }]).headline).toContain(
      'in the Auditing & Return Queue folder',
    );
    expect(expenseWorkflowStepOf({ report: { Status: 'Submitted', FinancialSecretaryMemberID: null } as never })).toMatchObject({ key: 'payment-request' });
    const approved = { request: { id: 1, RequestStatus: 'Approved', VoteStatus: 'Approved', PaymentOrderId: null, ShepherdMemberID: 3, compliance_endorsed_by_member_id: null } as never };
    expect(buildCharityPipeline('grand-knight', [approved]).headline).toContain(`in the ${CHARITY_ENDORSEMENT_FOLDER_TITLE} folder`);
    expect(buildCharityPipeline('treasurer', [approved]).headline).not.toContain('below');
  });

  it('mounts no form, button or working module in the reference drawers', () => {
    const parts = read('apps/web/components/FinanceWorkflowParts.tsx');
    const er = parts.slice(parts.indexOf('export function ExpenseReportWorkflow'), parts.indexOf('/** One request line'));
    const pipeline = parts.slice(parts.indexOf('export function CharityPipelineWorkflow'));
    for (const body of [er, pipeline]) {
      expect(body).not.toMatch(/<Button|<Input|<Select|<Textarea|EndorseButton|onClick/);
      expect(body).toContain('<WorkflowActionBar headline={flow.headline} />');
    }
    const election = read('apps/web/components/modules/ElectionWorkflow.tsx');
    const drawer = election.slice(election.indexOf('export function CouncilElectionWorkflow'));
    expect(drawer).toContain('readOnly />');
    expect(drawer).not.toContain('Set the ballot');
    expect(election).toContain('{selected && !readOnly ? (');
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).toContain('council={council.data} readOnly />');
    expect(desks).toContain('return charity.endorsements;');
    const planning = read('apps/web/components/PlanningWorkflowParts.tsx');
    expect(planning).toContain('const setter = !readOnly && canSetCouncilGoals(user, council.id);');
    expect(planning).toContain('const budgetEditor = !readOnly && canManageBudgetForecast(user, council.id);');
  });
});
