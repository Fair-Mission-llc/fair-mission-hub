// Sprint 9 Revision 5.0: Quick Check-In for walk-in volunteers (events.getQuickCheckInBoard / quickCheckIn) and the
// GPS screens switched off (GPS_UI_SUPPRESSED).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GPS_UI_SUPPRESSED,
  HUB_ACTOR_FIRST_METHODS,
  isShiftCaptain,
  QUICK_CHECK_IN_LABEL,
  toIsoDate,
  type DataService,
  type MemberWriteActor,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER, NOW, rawInsert } from './helpers';

const OWN = 1;
const OTHER = 3;
const OTHER_COUNCIL = 2;
const TODAY = toIsoDate(NOW);
const TOMORROW = toIsoDate(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 1));
const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('who is a Shift Captain (pure rule)', () => {
  const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({ memberId: 10, councilId: OWN, memberType: 'Member', active: true, roles: [], ...over });
  const scope = { eventId: 1, ownerId: 99, eventCouncilIds: [OWN] };

  it('is the event owner, an officer or Trustee, or an Admin of a linked council, or any Super Admin', () => {
    expect(isShiftCaptain(actor(), scope)).toBe(false);
    expect(isShiftCaptain(actor({ memberId: 99 }), scope)).toBe(true);
    expect(isShiftCaptain(actor({ roles: ['Grand Knight'] }), scope)).toBe(true);
    expect(isShiftCaptain(actor({ roles: ['Trustee 1'] }), scope)).toBe(true);
    expect(isShiftCaptain(actor({ memberType: 'Admin' }), scope)).toBe(true);
    expect(isShiftCaptain(actor({ memberType: 'Admin', councilId: OTHER }), scope)).toBe(false);
    expect(isShiftCaptain(actor({ roles: ['Grand Knight'], councilId: OTHER }), scope)).toBe(false);
    expect(isShiftCaptain(actor({ memberType: 'Super Admin', councilId: OTHER }), scope)).toBe(true);
  });

  it('is never an inactive member', () => {
    expect(isShiftCaptain(actor({ memberId: 99, active: false }), scope)).toBe(false);
    expect(isShiftCaptain(actor({ memberType: 'Admin', active: false }), scope)).toBe(false);
  });
});

async function todaysShift(db: DataService, ownerId: number, shiftDate = TODAY) {
  const event = await db.events.create(
    { EventName: 'Walk-in Fish Fry', EventDescription: 'Lent supper', OwnerID: ownerId, StartDate: TODAY, EndDate: TOMORROW, Location: 'Hall', CategoryID: 1 },
    [OWN],
  );
  const shift = await db.events.createShift({
    ShiftName: 'Fryer', ShiftDescription: '', ShiftDate: shiftDate, StartTime: '17:00:00', EndTime: '19:00:00', EventID: event.id, MinNumberVolunteers: 1,
  });
  return { event, shift };
}

describe.each(drivers)('$name driver: quick check-in', (d) => {
  it('gives the captain today’s shift and the council roster, and nothing to a plain member', async () => {
    const db = await d.make();
    const { shift } = await todaysShift(db, MEMBER.admin);
    await todaysShift(db, MEMBER.admin, TOMORROW);

    const board = await db.events.getQuickCheckInBoard(MEMBER.admin);
    expect(board.shifts.map((s) => s.shift.id)).toEqual([shift.id]);
    expect(board.shifts[0].signedUpMemberIds).toEqual([]);
    const active = await db.members.listByCouncil(OWN, { activeOnly: true });
    expect(board.roster.map((r) => r.memberId).sort((a, b) => a - b)).toEqual(active.map((m) => m.id).sort((a, b) => a - b));
    const names = board.roster.map((r) => `${r.lastName}|${r.firstName}`);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

    expect(await db.events.getQuickCheckInBoard(MEMBER.member)).toEqual({ shifts: [], roster: [] });
  });

  it('signs a walk-in up at once and counts them, and a second tap writes nothing', async () => {
    const db = await d.make();
    const { shift } = await todaysShift(db, MEMBER.admin);

    const first = await db.events.quickCheckIn(MEMBER.admin, shift.id, MEMBER.member);
    expect(first.alreadySignedUp).toBe(false);
    expect(first.signup).toMatchObject({ ShiftID: shift.id, MemberID: MEMBER.member, NoShow: 0 });
    expect((await db.events.getShift(shift.id))!.NumberVolunteersSignedUp).toBe(1);

    const again = await db.events.quickCheckIn(MEMBER.admin, shift.id, MEMBER.member);
    expect(again).toEqual({ signup: first.signup, alreadySignedUp: true });
    expect((await db.events.getShift(shift.id))!.NumberVolunteersSignedUp).toBe(1);
    expect((await db.events.getQuickCheckInBoard(MEMBER.admin)).shifts[0].signedUpMemberIds).toEqual([MEMBER.member]);
    // The walk-in is on the member's own schedule, so the phone calendar feed and the Report tab see it.
    expect((await db.events.listMemberShifts(MEMBER.member)).some((s) => s.shift.id === shift.id)).toBe(true);
  });

  it('lets the event’s owner captain it, but not another plain member', async () => {
    const db = await d.make();
    const { shift } = await todaysShift(db, MEMBER.member);
    const board = await db.events.getQuickCheckInBoard(MEMBER.member);
    expect(board.shifts.map((s) => s.shift.id)).toEqual([shift.id]);
    const walkIn = board.roster.find((r) => r.memberId !== MEMBER.member)!;
    expect((await db.events.quickCheckIn(MEMBER.member, shift.id, walkIn.memberId)).alreadySignedUp).toBe(false);

    const other = await todaysShift(db, MEMBER.admin);
    await expectRule(db.events.quickCheckIn(MEMBER.member, other.shift.id, walkIn.memberId), 'COUNCIL_ACCESS_DENIED');
    expect(await db.events.listSignups(other.shift.id)).toEqual([]);
  });

  it('refuses a shift on another day and a member outside the event’s councils', async () => {
    const db = await d.make();
    const later = await todaysShift(db, MEMBER.admin, TOMORROW);
    await expectRule(db.events.quickCheckIn(MEMBER.admin, later.shift.id, MEMBER.member), 'INVALID_INPUT');

    const { shift } = await todaysShift(db, MEMBER.admin);
    // An active member of another council, copied from a seeded member of this one.
    const { id: _id, ...model } = (await db.members.get(MEMBER.member))!;
    const outsiderId = rawInsert(db, 'Member', { ...model, CouncilID: OTHER_COUNCIL, MemberNumber: 9_900_001, Email: 'walk.in.outsider@example.org' } as never);
    await expectRule(db.events.quickCheckIn(MEMBER.admin, shift.id, outsiderId), 'INVALID_INPUT');
    await expectRule(db.events.quickCheckIn(MEMBER.admin, shift.id, 99999), 'MEMBER_NOT_FOUND');
    await expectRule(db.events.quickCheckIn(MEMBER.admin, 99999, MEMBER.member), 'SHIFT_NOT_FOUND');
    expect(await db.events.listSignups(shift.id)).toEqual([]);
  });
});

describe('phone screens', () => {
  it('puts the Quick Check-In button on the Signup and Collect tabs', () => {
    expect(QUICK_CHECK_IN_LABEL).toBe('⏱️ Quick Check-In');
    for (const screen of ['apps/mobile/app/(app)/shifts.tsx', 'apps/mobile/app/(app)/donate.tsx']) {
      expect(read(screen)).toContain('<QuickCheckIn');
    }
    const modal = read('apps/mobile/components/QuickCheckIn.tsx');
    expect(modal).toContain('db.events.getQuickCheckInBoard(user.memberId)');
    expect(modal).toContain('db.events.quickCheckIn(user.memberId');
  });

  it('lets the hub check the captain is the signed-in member', () => {
    expect(HUB_ACTOR_FIRST_METHODS.has('events.getQuickCheckInBoard')).toBe(true);
    expect(HUB_ACTOR_FIRST_METHODS.has('events.quickCheckIn')).toBe(true);
  });
});

describe('GPS screens suppressed', () => {
  it('hides the GPS check-in on the phone and the meeting point fields on the web, but keeps the location math', () => {
    expect(GPS_UI_SUPPRESSED).toBe(true);
    const drawer = read('apps/mobile/components/GeofenceCheckIn.tsx');
    expect(drawer).toContain('useState(GPS_UI_SUPPRESSED)');
    expect(drawer).toContain('getCurrentPositionAsync');
    const card = read('apps/web/components/MeetingCheckInCard.tsx');
    expect(card).toContain('{GPS_UI_SUPPRESSED ? null : (');
    expect(read('packages/shared/src/geofence.ts')).toContain('export function distanceMeters');
  });
});
