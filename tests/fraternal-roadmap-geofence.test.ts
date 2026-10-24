// Sprint 7G (Schema 68): the Annual Fraternal Roadmap (roadmap.ts) with its overdue-milestone push alerts and the
// three-signature flow counts, the geofenced meeting check-in with its PIN bypass (geofence.ts), check-in and meeting
// photos, and the dual user manuals compiled by scripts/compile_all_manuals.py.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertMayDispatchRoadmapAlerts,
  assertMayManageMeetingGeofence,
  buildRoadmapMilestones,
  CHECK_IN_BUTTON_LABEL,
  cleanCheckInProof,
  cleanMeetingGeofence,
  cleanMeetingPhotoUrl,
  countSignatureFlow,
  DEFAULT_MEETING_PIN_TOKEN,
  distanceMeters,
  MEETING_PHOTO_DRIVE_FOLDER,
  MEETING_PIN_MAX_ATTEMPTS,
  meetingGeofenceOf,
  driveVaultFolderPath,
  roadmapAlertPayload,
  roadmapCycleYear,
  verifyCheckInProof,
  withoutMeetingPin,
  type DataService,
  type MemberWriteActor,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { SCHEMA_STATEMENTS } from '../apps/mobile/services/generated/schema.sqlite';
import { drivers, expectRule, MEMBER, type DriverUnderTest } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const CADENCE = 1;
// St. Mary's parish hall stand-in: a point and spots 40 m and about 1.1 km away.
const HALL = { latitude: 47.6062, longitude: -122.3321 };
const NEAR = { latitude: 47.60656, longitude: -122.3321 };
const FAR = { latitude: 47.6162, longitude: -122.3321 };

const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({ memberId: 9, councilId: OWN, memberType: 'Member', active: true, roles: [], ...over });

async function makeAt(d: DriverUnderTest, at: Date): Promise<DataService> {
  const now = () => new Date(at);
  if (d.name === 'memory') {
    const db = new MemoryDataService({ now, log: () => {} });
    await db.init();
    return db;
  }
  openDatabases.length = 0;
  const db = new SqliteDataService({ now, log: () => {} });
  await db.init();
  return db;
}

describe('Schema 68', () => {
  it('adds the meeting circle and PIN to Council and photo_url to LiveAttendance and Meeting, and bumps the phone version', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('Sprint 7G: GEOFENCED MEETING CHECK-IN AND MEETING PHOTOS (schema version 68)');
    for (const line of [
      'ALTER TABLE [Council] ADD [meeting_latitude] DECIMAL(9,6) NULL;',
      'ALTER TABLE [Council] ADD [meeting_longitude] DECIMAL(9,6) NULL;',
      'ALTER TABLE [Council] ADD [meeting_geofence_radius_meters] INT NOT NULL DEFAULT 100;',
      "ALTER TABLE [Council] ADD [meeting_pin_token] VARCHAR(4) NOT NULL DEFAULT '0000';",
      'ALTER TABLE [LiveAttendance] ADD [photo_url] VARCHAR(2000) NULL;',
      'ALTER TABLE [Meeting] ADD [photo_url] VARCHAR(2000) NULL;',
    ]) {
      expect(schema).toContain(line);
    }
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (6[8-9]|[7-9]\d);/);
    const council = TABLES.Council;
    expect(council.columns.find((c) => c.name === 'meeting_pin_token')).toMatchObject({ notNull: true });
    expect(TABLES.LiveAttendance.columns.some((c) => c.name === 'photo_url')).toBe(true);
    expect(TABLES.Meeting.columns.some((c) => c.name === 'photo_url')).toBe(true);
    expect(SCHEMA_STATEMENTS.join('\n')).toContain('[meeting_geofence_radius_meters]');
    expect(read('data_dictionary.md')).toContain('# 36. Geofenced meeting check-in and meeting photos (Sprint 7G)');
  });
});

describe('geofence rules', () => {
  it('measures great-circle distance in meters', () => {
    expect(Math.round(distanceMeters(HALL, NEAR))).toBe(40);
    expect(Math.round(distanceMeters(HALL, FAR))).toBe(1112);
    expect(distanceMeters(HALL, HALL)).toBe(0);
  });

  it('reads stored settings with the column defaults', () => {
    expect(meetingGeofenceOf({})).toEqual({ latitude: null, longitude: null, radiusMeters: 100, pinToken: DEFAULT_MEETING_PIN_TOKEN });
    expect(meetingGeofenceOf({ meeting_latitude: 47.6, meeting_longitude: null, meeting_geofence_radius_meters: 250, meeting_pin_token: '4821' })).toEqual({
      latitude: null,
      longitude: null,
      radiusMeters: 250,
      pinToken: '4821',
    });
  });

  it('cleans the settings input', () => {
    expect(cleanMeetingGeofence({ latitude: 47.60621234, longitude: -122.33207891, radiusMeters: 150, pinToken: '4821' })).toEqual({
      meeting_latitude: 47.606212,
      meeting_longitude: -122.332079,
      meeting_geofence_radius_meters: 150,
      meeting_pin_token: '4821',
    });
    expect(cleanMeetingGeofence({ latitude: null, longitude: null })).toEqual({ meeting_latitude: null, meeting_longitude: null });
    const bad = (input: unknown) => {
      try {
        cleanMeetingGeofence(input);
      } catch (e) {
        return (e as Error).message;
      }
      return 'accepted';
    };
    expect(bad({ latitude: 47 })).toBe('Enter the latitude and the longitude together.');
    expect(bad({ latitude: 91, longitude: 0 })).toMatch(/latitude must be a number from -90 to 90/);
    expect(bad({ radiusMeters: 10 })).toMatch(/whole number of meters from 25 to 5,000/);
    expect(bad({ pinToken: '12a4' })).toBe('The meeting PIN must be exactly 4 digits.');
    expect(bad({ pinToken: '12345' })).toBe('The meeting PIN must be exactly 4 digits.');
    expect(bad({ color: 'red' })).toBe('Unknown meeting check-in setting: color.');
    expect(bad({})).toBe('Enter the meeting location, radius or PIN to save.');
  });

  it('checks a proof against the circle, the precision and the PIN', () => {
    const fence = { latitude: HALL.latitude, longitude: HALL.longitude, radiusMeters: 100, pinToken: '4821' };
    expect(verifyCheckInProof(fence, { kind: 'gps', ...NEAR, accuracyMeters: 12 })).toEqual({ distanceMeters: 40 });
    expect(verifyCheckInProof(fence, { kind: 'pin', pin: '4821' })).toEqual({ distanceMeters: null });
    const code = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return [(e as { code: string }).code, (e as Error).message];
      }
      return null;
    };
    expect(code(() => verifyCheckInProof(fence, { kind: 'gps', ...FAR, accuracyMeters: 12 }))).toEqual([
      'OUTSIDE_GEOFENCE',
      'You are 1,112 m from the meeting hall, outside the 100 m check-in area. Enter the 4-digit meeting PIN from the Grand Knight instead.',
    ]);
    expect(code(() => verifyCheckInProof(fence, { kind: 'gps', ...NEAR, accuracyMeters: 180 }))?.[0]).toBe('GPS_PRECISION_TOO_LOW');
    expect(code(() => verifyCheckInProof(fence, { kind: 'pin', pin: '0000' }))).toEqual([
      'MEETING_PIN_INVALID',
      'That meeting PIN is not correct. Ask the Grand Knight for the PIN and try again.',
    ]);
    expect(code(() => verifyCheckInProof({ ...fence, latitude: null, longitude: null }, { kind: 'gps', ...NEAR, accuracyMeters: 5 }))?.[0]).toBe('GEOFENCE_NOT_CONFIGURED');
    expect(() => cleanCheckInProof({ kind: 'pin', pin: '12' })).toThrow('Enter the 4-digit meeting PIN.');
    expect(() => cleanCheckInProof({ kind: 'gps', latitude: 1, longitude: 2 })).toThrow(/did not report how precise/);
    expect(cleanCheckInProof({ kind: 'pin', pin: ' 4821 ' })).toEqual({ kind: 'pin', pin: '4821' });
  });

  it('lets the Grand Knight, the Deputy Grand Knight (Sprint 8C), the council Admins and Super Admins manage the circle and PIN', () => {
    expect(() => assertMayManageMeetingGeofence(actor({ roles: ['Grand Knight'] }), OWN)).not.toThrow();
    expect(() => assertMayManageMeetingGeofence(actor({ memberType: 'Admin' }), OWN)).not.toThrow();
    expect(() => assertMayManageMeetingGeofence(actor({ memberType: 'Super Admin', councilId: 2 }), OWN)).not.toThrow();
    expect(() => assertMayManageMeetingGeofence(actor({ roles: ['Deputy Grand Knight'], officer: true }), OWN)).not.toThrow();
    expect(() => assertMayManageMeetingGeofence(actor({ roles: ['Treasurer'], officer: true }), OWN)).toThrow(/Deputy Grand Knight, an Admin/);
    expect(() => assertMayManageMeetingGeofence(actor({ roles: ['Grand Knight'], councilId: 2 }), OWN)).toThrow(/own council/);
  });

  it('drops the PIN from council reads and cleans photo links', () => {
    expect(withoutMeetingPin({ id: 1, meeting_pin_token: '4821', CouncilName: 'x' })).toEqual({ id: 1, CouncilName: 'x' });
    expect(cleanMeetingPhotoUrl('  ')).toBeNull();
    expect(cleanMeetingPhotoUrl(' 1AbCdEfGhIjKlMnOpQrStUvWxYz012345 ')).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz012345');
    expect(() => cleanMeetingPhotoUrl('x'.repeat(2001))).toThrow(/longer than 2000/);
    expect(driveVaultFolderPath('media', MEETING_PHOTO_DRIVE_FOLDER)).toEqual(['Fraternal Enterprise Suite', 'Media', 'Meeting_Photos']);
  });
});

describe('roadmap rules', () => {
  const none = { nominationCount: 0, leadershipTermCount: 0, budgetStatus: null };

  it('opens on this year until 30 days after the July 10 lock, then on next year', () => {
    expect(roadmapCycleYear(new Date(2027, 0, 15))).toBe(2027);
    expect(roadmapCycleYear(new Date(2027, 7, 9))).toBe(2027);
    expect(roadmapCycleYear(new Date(2027, 7, 10))).toBe(2028);
    expect(roadmapCycleYear(new Date(2026, 8, 20))).toBe(2027);
  });

  it('marks the next open milestone upcoming, past ones overdue and recorded ones complete', () => {
    const april = buildRoadmapMilestones(2027, new Date(2027, 3, 2), none);
    expect(april.map((m) => [m.id, m.status, m.dueOn])).toEqual([
      ['nominations', 'upcoming', '2027-05-31'],
      ['elections', 'scheduled', '2027-06-30'],
      ['budget_lock', 'scheduled', '2027-07-10'],
    ]);
    expect(april.map((m) => m.windowLabel)).toEqual(['May 1 - May 31', 'June 1 - June 30', 'July 1 - July 10']);
    // The due day itself is not overdue.
    expect(buildRoadmapMilestones(2027, new Date(2027, 4, 31, 23, 0), none)[0].status).toBe('upcoming');
    const june = buildRoadmapMilestones(2027, new Date(2027, 5, 5), none);
    expect(june.map((m) => m.status)).toEqual(['overdue', 'upcoming', 'scheduled']);
    const july = buildRoadmapMilestones(2027, new Date(2027, 6, 12), { nominationCount: 3, leadershipTermCount: 0, budgetStatus: 'Proposed' });
    expect(july.map((m) => [m.status, m.detail])).toEqual([
      ['complete', '3 nominations recorded for 2027-2028.'],
      ['overdue', 'No officer is seated for 2027-2028 yet.'],
      ['overdue', 'The 2027-2028 budget is still Proposed.'],
    ]);
    const done = buildRoadmapMilestones(2027, new Date(2027, 6, 12), { nominationCount: 0, leadershipTermCount: 12, budgetStatus: 'Approved' });
    expect(done.map((m) => m.status)).toEqual(['complete', 'complete', 'complete']);
  });

  it('counts the three-signature flow and words the overdue alert', () => {
    expect(
      countSignatureFlow([
        { Status: 'Draft', FinancialSecretaryApprovedAt: null, TreasurerReviewedAt: null },
        { Status: 'Submitted', FinancialSecretaryApprovedAt: null, TreasurerReviewedAt: null },
        { Status: 'Submitted', FinancialSecretaryApprovedAt: '2026-09-01 00:00:00', TreasurerReviewedAt: null },
        { Status: 'Submitted', FinancialSecretaryApprovedAt: '2026-09-01 00:00:00', TreasurerReviewedAt: '2026-09-02 00:00:00' },
        { Status: 'Approved', FinancialSecretaryApprovedAt: '2026-09-01 00:00:00', TreasurerReviewedAt: '2026-09-02 00:00:00' },
        { Status: 'Reimbursed', FinancialSecretaryApprovedAt: '2026-09-01 00:00:00', TreasurerReviewedAt: '2026-09-02 00:00:00' },
      ]),
    ).toEqual({ awaitingFinancialSecretary: 1, awaitingTreasurer: 1, awaitingGrandKnight: 1, awaitingCheck: 1 });
    const [nominations] = buildRoadmapMilestones(2027, new Date(2027, 5, 5), none);
    expect(roadmapAlertPayload(nominations, 2027)).toEqual({
      title: 'Overdue: Nominations 2027',
      body:
        'The Nominations step of the 2027 fraternal roadmap was due 2027-05-31 and is not recorded as done. No nomination recorded for 2027-2028 yet. ' +
        'Open the Executive Dashboard to see the Annual Fraternal Roadmap.',
    });
  });

  it('lets Admins, officers and Super Admins send the alerts', () => {
    expect(() => assertMayDispatchRoadmapAlerts(actor({ officer: true, roles: ['Recorder'] }), OWN)).not.toThrow();
    expect(() => assertMayDispatchRoadmapAlerts(actor(), OWN)).toThrow(/Only an active Admin or officer/);
    expect(() => assertMayDispatchRoadmapAlerts(actor({ memberType: 'Admin', councilId: 2 }), OWN)).toThrow(/cannot send roadmap alerts for council 1/);
  });
});

describe.each(drivers)('Sprint 7G ($name driver)', (d) => {
  /** The October 6 Monthly meeting. */
  async function octoberMeeting(db: DataService): Promise<number> {
    const { created } = await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, CADENCE, '2026-2027');
    return created.find((m) => m.Date === '2026-10-06')!.id;
  }

  /** The October 6 Monthly meeting, live. */
  async function liveMeeting(db: DataService): Promise<number> {
    const meetingId = await octoberMeeting(db);
    await db.meetings.startLiveAssemblyConsole(MEMBER.admin, meetingId);
    return meetingId;
  }

  it('keeps the PIN out of council reads and lets only the Grand Knight, Admins and Super Admins read or set it', async () => {
    const db = await d.make();
    expect((await db.councils.get(OWN))!).not.toHaveProperty('meeting_pin_token');
    expect((await db.councils.list()).some((c) => 'meeting_pin_token' in c)).toBe(false);
    expect((await db.councils.get(OWN))!.meeting_geofence_radius_meters).toBe(100);
    expect(await db.councils.getMeetingGeofence(MEMBER.superAdmin, OWN)).toEqual({ latitude: null, longitude: null, radiusMeters: 100, pinToken: '0000' });
    await expectRule(db.councils.getMeetingGeofence(MEMBER.member, OWN), 'GRAND_KNIGHT_REQUIRED');
    await expectRule(db.councils.setMeetingGeofence(MEMBER.member, OWN, { pinToken: '1234' }), 'GRAND_KNIGHT_REQUIRED');
    await expectRule(db.councils.setMeetingGeofence(MEMBER.admin, OWN, { pinToken: '12' }), 'INVALID_INPUT');
    const saved = await db.councils.setMeetingGeofence(MEMBER.admin, OWN, { ...HALL, radiusMeters: 120, pinToken: '4821' });
    expect(saved).toEqual({ ...HALL, radiusMeters: 120, pinToken: '4821' });
    expect((await db.councils.get(OWN))!).toMatchObject({ meeting_latitude: HALL.latitude, meeting_geofence_radius_meters: 120 });
    expect((await db.councils.get(OWN))!).not.toHaveProperty('meeting_pin_token');
  });

  it('checks a member in by GPS inside the circle, and points them to the PIN outside it', async () => {
    const db = await d.make();
    const meetingId = await liveMeeting(db);
    const gps = (p: { latitude: number; longitude: number }, accuracyMeters = 10) => ({ kind: 'gps' as const, ...p, accuracyMeters });
    await expectRule(db.meetings.geofencedCheckIn(MEMBER.member, meetingId, gps(NEAR)), 'GEOFENCE_NOT_CONFIGURED');
    await db.councils.setMeetingGeofence(MEMBER.superAdmin, OWN, { ...HALL, radiusMeters: 100, pinToken: '4821' });
    await expectRule(db.meetings.geofencedCheckIn(MEMBER.member, meetingId, gps(FAR)), 'OUTSIDE_GEOFENCE');
    await expectRule(db.meetings.geofencedCheckIn(MEMBER.member, meetingId, gps(NEAR, 400)), 'GPS_PRECISION_TOO_LOW');
    expect(d.count(db, 'LiveAttendance')).toBe(0);
    const first = await db.meetings.geofencedCheckIn(MEMBER.member, meetingId, gps(NEAR));
    expect(first).toMatchObject({ meetingId, memberId: MEMBER.member, method: 'gps', distanceMeters: 40, alreadyCheckedIn: false });
    expect((await db.meetings.getLiveAssemblyState(MEMBER.member, meetingId)).viewerCheckedIn).toBe(true);
    expect((await db.meetings.listInvites(meetingId)).find((i) => i.MemberID === MEMBER.member)).toMatchObject({ Attended: 1, ResponseStatus: 'Accepted' });
    // A second tap returns the first check-in, whatever it sends.
    const again = await db.meetings.geofencedCheckIn(MEMBER.member, meetingId, gps(FAR));
    expect(again).toMatchObject({ attendanceId: first.attendanceId, alreadyCheckedIn: true });
    expect(d.count(db, 'LiveAttendance')).toBe(1);
  });

  it('takes the PIN outside the circle and locks it after five wrong PINs', async () => {
    const db = await d.make();
    const meetingId = await liveMeeting(db);
    await db.councils.setMeetingGeofence(MEMBER.superAdmin, OWN, { pinToken: '4821' });
    for (let i = 0; i < MEETING_PIN_MAX_ATTEMPTS; i++) await expectRule(db.meetings.geofencedCheckIn(MEMBER.member, meetingId, { kind: 'pin', pin: '0000' }), 'MEETING_PIN_INVALID');
    await expectRule(db.meetings.geofencedCheckIn(MEMBER.member, meetingId, { kind: 'pin', pin: '4821' }), 'MEETING_PIN_LOCKED');
    // Another member is not locked out.
    const admin = await db.meetings.geofencedCheckIn(MEMBER.admin, meetingId, { kind: 'pin', pin: '4821' });
    expect(admin).toMatchObject({ method: 'pin', distanceMeters: null, alreadyCheckedIn: false });
    expect(d.count(db, 'LiveAttendance')).toBe(1);
  });

  it('refuses check-in before the console starts', async () => {
    const db = await d.make();
    const meetingId = await octoberMeeting(db);
    await expectRule(db.meetings.geofencedCheckIn(MEMBER.member, meetingId, { kind: 'pin', pin: '0000' }), 'LIVE_ASSEMBLY_CONFLICT');
  });

  it('saves a check-in photo for the member checked in and a meeting photo for the chair', async () => {
    const db = await d.make();
    const meetingId = await liveMeeting(db);
    await expectRule(db.meetings.setCheckInPhoto(MEMBER.member, meetingId, 'file:///media/Meeting_Photos-1.jpg'), 'NOT_CHECKED_IN');
    await db.meetings.geofencedCheckIn(MEMBER.member, meetingId, { kind: 'pin', pin: '0000' });
    const photo = await db.meetings.setCheckInPhoto(MEMBER.member, meetingId, ' file:///media/Meeting_Photos-1.jpg ');
    expect(photo).toMatchObject({ MemberID: MEMBER.member, photo_url: 'file:///media/Meeting_Photos-1.jpg' });
    await expectRule(db.meetings.setMeetingPhoto(MEMBER.member, meetingId, '1AbCdEfGhIjKlMnOpQrStUv'), 'ADMIN_REQUIRED');
    expect(await db.meetings.setMeetingPhoto(MEMBER.admin, meetingId, '1AbCdEfGhIjKlMnOpQrStUv')).toMatchObject({ id: meetingId, photo_url: '1AbCdEfGhIjKlMnOpQrStUv' });
    expect((await db.meetings.get(meetingId))!.photo_url).toBe('1AbCdEfGhIjKlMnOpQrStUv');
    expect((await db.meetings.setMeetingPhoto(MEMBER.admin, meetingId, null)).photo_url).toBeNull();
  });

  it('reads the roadmap of a cycle with the three-signature counts', async () => {
    const db = await d.make();
    // NOW is 2026-09-20: the dashboard opens on the 2027 cycle, and its first step is next.
    const next = await db.elections.getFraternalRoadmap(MEMBER.member, OWN);
    expect(next).toMatchObject({ councilId: OWN, cycleYear: 2027, termYear: '2027-2028' });
    expect(next.milestones.map((m) => m.status)).toEqual(['upcoming', 'scheduled', 'scheduled']);
    expect(next.signatureFlow).toEqual(expect.objectContaining({ awaitingFinancialSecretary: expect.any(Number), awaitingCheck: expect.any(Number) }));
    // The 2026 cycle: today's officers hold 2026-2027 terms, so nominations and elections read complete.
    const past = await db.elections.getFraternalRoadmap(MEMBER.member, OWN, 2026);
    expect(past.milestones.slice(0, 2).map((m) => m.status)).toEqual(['complete', 'complete']);
    await expectRule(db.elections.getFraternalRoadmap(MEMBER.member, OWN, 1999), 'INVALID_INPUT');
    await expectRule(db.elections.getFraternalRoadmap(MEMBER.member, 2), 'COUNCIL_ACCESS_DENIED');
  });

  it('pushes overdue milestones to council leadership once', async () => {
    const db = await makeAt(d, new Date(2027, 5, 5, 12, 0, 0));
    const roadmap = await db.elections.getFraternalRoadmap(MEMBER.admin, OWN);
    expect(roadmap.milestones.map((m) => m.status)).toEqual(['overdue', 'upcoming', 'scheduled']);
    await expectRule(db.elections.dispatchRoadmapAlerts(MEMBER.member, OWN), 'ADMIN_REQUIRED');
    const sweep = await db.elections.dispatchRoadmapAlerts(MEMBER.admin, OWN);
    expect(sweep).toMatchObject({ cycleYear: 2027, overdue: ['nominations'] });
    expect(sweep.recipientIds).toEqual(expect.arrayContaining([MEMBER.superAdmin, MEMBER.admin]));
    expect(sweep.recipientIds).not.toContain(MEMBER.member);
    expect(sweep.alertsSent).toBe(sweep.recipientIds.length);
    const alerts = await db.notifications.listMemberAlerts(MEMBER.admin);
    expect(alerts.find((a) => a.Title === 'Overdue: Nominations 2027')).toMatchObject({ Priority: 'High', IsRead: 0 });
    expect(await db.elections.dispatchRoadmapAlerts(MEMBER.superAdmin, OWN)).toMatchObject({ alertsSent: 0, recipientIds: [] });
  });
});

describe('Sprint 7G screens and manuals', () => {
  it('puts the roadmap and the signature tree on the Executive Dashboard', () => {
    // Sprint 8D/8E: the Executive Dashboard is its own page.
    const page = read('apps/web/app/executive-dashboard/page.tsx');
    expect(page).toContain('<FraternalRoadmap');
    const parts = read('apps/web/components/RoadmapParts.tsx');
    expect(parts).toContain('Annual Fraternal Roadmap');
    expect(parts).toContain('dispatchRoadmapAlerts');
    expect(parts).toContain('Three-Signature Expense Flow');
  });

  it('adds the meeting check-in card to Council Wide Settings and the meeting photo to the live console', () => {
    expect(read('apps/web/app/system-settings/council-settings/page.tsx')).toContain('<MeetingCheckInCard');
    const live = read('apps/web/app/meetings/live/page.tsx');
    expect(live).toContain('MEETING_PHOTO_DRIVE_FOLDER');
    expect(live).toContain('setMeetingPhoto');
  });

  it('puts the check-in drawer on the phone Meeting Console', () => {
    const drawer = read('apps/mobile/components/GeofenceCheckIn.tsx');
    expect(drawer).toContain('CHECK_IN_BUTTON_LABEL');
    expect(drawer).toContain('expo-location');
    expect(drawer).toContain('geofencedCheckIn');
    expect(drawer).toContain('setCheckInPhoto');
    expect(read('apps/mobile/components/AgendaSheet.tsx')).toContain('<GeofenceCheckIn');
    expect(CHECK_IN_BUTTON_LABEL).toBe('📍 Check In to Meeting');
  });

  it('documents the sprint in both guides and compiles both PDFs', () => {
    const admin = read('docs/ADMIN_USER_GUIDE.md');
    const member = read('docs/MEMBER_USER_GUIDE.md');
    for (const text of ['Annual Fraternal Roadmap', 'Overdue: Nominations', 'meeting PIN']) expect(admin).toContain(text);
    for (const text of ['Check in with PIN', 'Council Dashboard', 'CHECK NUMBER (REQUIRED)']) {
      expect(member).toContain(text);
    }
    // Sprint 9 Revision 5.0: GPS check-in is hidden (GPS_UI_SUPPRESSED), so the guide teaches the PIN only.
    for (const text of [CHECK_IN_BUTTON_LABEL, 'You are 1,112 m from the meeting hall', 'Location (GPS)']) expect(member).not.toContain(text);
    const script = read('scripts/compile_all_manuals.py');
    expect(script).toContain('docs/ADMIN_USER_GUIDE.pdf');
    expect(script).toContain('docs/MEMBER_USER_GUIDE.pdf');
    expect(existsSync(join(__dirname, '..', 'docs/MEMBER_USER_GUIDE.pdf'))).toBe(true);
  });
});
