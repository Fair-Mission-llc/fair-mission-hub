// Sprint 8B (schema version 74): the Recorder and Historian Active Desks, the live meeting launch, the cross-council
// view-as context and the cascading view-as lookup.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildImpersonationTree,
  canOpenHistorianDesk,
  canOpenImpersonationLookup,
  canOpenRecorderDesk,
  cleanHistorianBulletin,
  cleanMeetingMinutes,
  clearanceGroupOf,
  councilLabel,
  COUNCIL_HISTORIAN_ROLE,
  dashboardTabFromAnchor,
  dashboardTabsFor,
  impersonationCouncilContext,
  impersonationSuggestions,
  isHistorianDeskOnly,
  landingRouteFor,
  minutesCountdown,
  minutesCountdownLabel,
  minutesDeskRows,
  portalAreas,
  type Council,
  type DataService,
  type ImpersonationCandidate,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
/** Seed.sql Role ids. */
const RECORDER_ROLE_ID = 4;

const seat = (over: { memberType?: 'Member' | 'Admin' | 'Super Admin'; roles?: string[]; councilId?: number; isOfficer?: boolean } = {}) => ({
  memberId: 7,
  councilId: over.councilId ?? OWN,
  memberType: over.memberType ?? ('Member' as const),
  isOfficer: over.isOfficer ?? false,
  roles: over.roles ?? [],
});

describe('schema version 74', () => {
  it('adds the minutes columns and the bulletin table, and bumps the phone database', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('(schema version 74)');
    expect(schema).toContain('ALTER TABLE [Meeting] ADD [minutes_text] VARCHAR(MAX) NULL;');
    expect(schema).toContain('ALTER TABLE [Meeting] ADD [minutes_published_at] DATETIME NULL;');
    expect(schema).toContain('CREATE UNIQUE INDEX [CouncilHistorianBulletin_Month_Idx] ON [CouncilHistorianBulletin] ([council_id], [bulletin_month]);');
    expect(TABLES.CouncilHistorianBulletin.columns.map((c) => c.name)).toEqual(['id', 'council_id', 'bulletin_month', 'body', 'author_member_id', 'updated_at', 'headline', 'body_format']);
    expect(TABLES.Meeting.columns.map((c) => c.name)).toEqual(expect.arrayContaining(['minutes_text', 'minutes_published_at']));
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (7[4-9]|[8-9]\d);/);
    expect(read('docs/ARCHITECTURAL_HISTORY.md')).toContain('| 74 | 8B |');
    expect(read('data_dictionary.md')).toContain('[CouncilHistorianBulletin]');
  });
});

describe('the seat desks (pure)', () => {
  it('opens the Recorder Desk to the Recorder, the council Admins and any Super Admin', () => {
    expect(canOpenRecorderDesk(seat({ roles: ['Recorder'], isOfficer: true }), OWN)).toBe(true);
    expect(canOpenRecorderDesk(seat({ roles: ['Recorder'], isOfficer: true }), 2)).toBe(false);
    expect(canOpenRecorderDesk(seat({ roles: ['Grand Knight'], isOfficer: true }), OWN)).toBe(false);
    expect(canOpenRecorderDesk(seat({ memberType: 'Admin' }), OWN)).toBe(true);
    expect(canOpenRecorderDesk(seat({ memberType: 'Admin' }), 2)).toBe(false);
    expect(canOpenRecorderDesk(seat({ memberType: 'Super Admin' }), 2)).toBe(true);
    expect(canOpenRecorderDesk(seat(), OWN)).toBe(false);
  });

  it('opens the Historian Desk to the Council Historian, the council Admins and any Super Admin', () => {
    expect(canOpenHistorianDesk(seat({ roles: [COUNCIL_HISTORIAN_ROLE] }), OWN)).toBe(true);
    expect(canOpenHistorianDesk(seat({ roles: [COUNCIL_HISTORIAN_ROLE] }), 2)).toBe(false);
    expect(canOpenHistorianDesk(seat({ roles: ['Recorder'], isOfficer: true }), OWN)).toBe(false);
    expect(canOpenHistorianDesk(seat({ memberType: 'Admin' }), OWN)).toBe(true);
    expect(canOpenHistorianDesk(seat({ memberType: 'Super Admin' }), 3)).toBe(true);
  });

  it('adds the two tabs after the Treasurer Desk, and gives a Historian without an officer seat only their desks', () => {
    const ids = (u: ReturnType<typeof seat>) => dashboardTabsFor(u, OWN).map((t) => t.id);
    // Sprint 8C: no Reports Desk; every officer reads the Oversight Desk.
    expect(ids(seat({ roles: ['Recorder'], isOfficer: true }))).toEqual(['home', 'recorder', 'member']);
    expect(ids(seat({ memberType: 'Admin' }))).toEqual(['home', 'grand-knight', 'financial-secretary', 'treasurer', 'recorder', 'historian', 'member']);
    const historian = seat({ roles: [COUNCIL_HISTORIAN_ROLE] });
    expect(isHistorianDeskOnly(historian)).toBe(true);
    expect(ids(historian)).toEqual(['historian', 'member']);
    expect(ids(seat({ roles: [COUNCIL_HISTORIAN_ROLE, 'Recorder'], isOfficer: true }))).toEqual(['home', 'recorder', 'historian', 'member']);
    // A tab the reader lacks falls back to their first tab, which is Home for everyone but the Historian-only reader.
    expect(dashboardTabFromAnchor('#reports', dashboardTabsFor(historian, OWN))).toBe('historian');
    expect(dashboardTabFromAnchor('#nope', dashboardTabsFor(seat({ memberType: 'Admin' }), OWN))).toBe('home');
  });

  it('opens /dashboard to the Historian, and the lookup page to Super Admins only', () => {
    const historian = seat({ roles: [COUNCIL_HISTORIAN_ROLE] });
    expect(portalAreas(historian)).toContain('dashboard');
    expect(landingRouteFor(historian)).toBe('/dashboard');
    expect(portalAreas(seat())).not.toContain('dashboard');
    expect(canOpenImpersonationLookup(seat({ memberType: 'Super Admin' }))).toBe(true);
    expect(canOpenImpersonationLookup(seat({ memberType: 'Admin' }))).toBe(false);
    expect(portalAreas(seat({ memberType: 'Super Admin' }))).toContain('system-settings/impersonate');
    expect(portalAreas(seat({ memberType: 'Admin' }))).not.toContain('system-settings/impersonate');
  });
});

describe('the minutes countdown (pure)', () => {
  it('counts down from the meeting’s last day plus the due days', () => {
    expect(minutesCountdown({ Date: '2026-10-06' }, '2026-10-12', 7)).toEqual({ state: 'open', heldOn: '2026-10-06', dueDate: '2026-10-13', daysLeft: 1 });
    expect(minutesCountdown({ Date: '2026-10-01' }, '2026-10-12', 7)).toMatchObject({ state: 'overdue', daysLeft: -4 });
    expect(minutesCountdown({ Date: '2026-10-20' }, '2026-10-12', 7)).toMatchObject({ state: 'upcoming' });
    expect(minutesCountdown({ Date: '2026-10-01', EndDate: '2026-10-03' }, '2026-10-12', 7)).toMatchObject({ heldOn: '2026-10-03', dueDate: '2026-10-10' });
    expect(minutesCountdown({ Date: '2026-10-01', minutes_published_at: '2026-10-02 10:00:00' }, '2026-10-12', 7).state).toBe('published');
  });

  it('labels each state in plain words', () => {
    const at = (date: string) => minutesCountdownLabel(minutesCountdown({ Date: date }, '2026-10-12', 7));
    expect(at('2026-10-05')).toBe('Due today');
    expect(at('2026-10-06')).toBe('Due in 1 day');
    expect(at('2026-10-04')).toBe('1 day overdue');
    expect(at('2026-10-01')).toBe('4 days overdue');
    expect(at('2026-11-01')).toBe('Not held yet');
  });

  it('lists overdue first, then open, upcoming and published, inside the desk window', () => {
    const rows = minutesDeskRows(
      [
        { id: 1, Date: '2026-10-20' },
        { id: 2, Date: '2026-10-06' },
        { id: 3, Date: '2026-10-01' },
        { id: 4, Date: '2026-09-15', minutes_published_at: '2026-09-16 09:00:00' },
        { id: 5, Date: '2026-01-01' },
        { id: 6, Date: '2027-03-01' },
      ],
      '2026-10-12',
      7,
    );
    expect(rows.map((r) => [r.meeting.id, r.state])).toEqual([
      [3, 'overdue'],
      [2, 'open'],
      [1, 'upcoming'],
      [4, 'published'],
    ]);
  });

  it('cleans the minutes and refuses to publish blank ones', () => {
    expect(cleanMeetingMinutes({ text: '  # Call to order\r\n- 7:30 PM  ', publish: true })).toEqual({ minutes_text: '# Call to order\n- 7:30 PM', publish: true });
    expect(cleanMeetingMinutes({ text: '   ' })).toEqual({ minutes_text: null, publish: false });
    expect(() => cleanMeetingMinutes({ text: ' ', publish: true })).toThrow(/before publishing/);
    expect(() => cleanMeetingMinutes({ text: 'x'.repeat(20_001) })).toThrow(/at most/);
  });

  it('checks the bulletin month and length', () => {
    expect(cleanHistorianBulletin('2026-10', ' Hello ')).toEqual({ bulletin_month: '2026-10', body: 'Hello' });
    expect(() => cleanHistorianBulletin('2026-13', 'x')).toThrow(/YYYY-MM/);
    expect(() => cleanHistorianBulletin('October', 'x')).toThrow(/YYYY-MM/);
    expect(() => cleanHistorianBulletin('2026-10', 'x'.repeat(8001))).toThrow(/at most/);
  });
});

describe('the cross-council view-as lookup (pure)', () => {
  const councils = [
    { id: 2, CouncilNumber: 16000, CouncilName: 'Holy Family Council' },
    { id: 1, CouncilNumber: 15295, CouncilName: "St. Mary's Cathedral Council" },
  ];
  const person = (memberId: number, councilId: number, firstName: string, lastName: string, over: Partial<ImpersonationCandidate> = {}): ImpersonationCandidate => ({
    memberId,
    councilId,
    firstName,
    lastName,
    memberType: 'Member',
    roles: [],
    isOfficer: false,
    ...over,
  });
  const people = [
    person(1, 1, 'Sam', 'Super', { memberType: 'Super Admin' }),
    person(2, 1, 'Greg', 'Knight', { roles: ['Grand Knight'], isOfficer: true }),
    person(3, 1, 'Fran', 'Secretary', { roles: ['Financial Secretary'], isOfficer: true }),
    person(4, 1, 'Ray', 'Recorder', { roles: ['Recorder'], isOfficer: true }),
    person(5, 1, 'Ada', 'Admin', { memberType: 'Admin' }),
    person(6, 1, 'Tom', 'Smith'),
    person(7, 2, 'Tim', 'Smithers', { roles: ['Warden'], isOfficer: true }),
    person(8, 2, 'Hal', 'Story', { roles: [COUNCIL_HISTORIAN_ROLE] }),
  ];

  it('sorts each person into one clearance group by their highest seat', () => {
    expect(clearanceGroupOf({ memberType: 'Admin', roles: ['Grand Knight'], isOfficer: true })).toBe('executive');
    expect(clearanceGroupOf({ memberType: 'Member', roles: ['Treasurer'], isOfficer: true })).toBe('finance');
    expect(clearanceGroupOf({ memberType: 'Member', roles: [COUNCIL_HISTORIAN_ROLE], isOfficer: false })).toBe('records');
    expect(clearanceGroupOf({ memberType: 'Member', roles: ['Warden'], isOfficer: true })).toBe('officers');
    expect(clearanceGroupOf({ memberType: 'Admin', roles: [], isOfficer: false })).toBe('admins');
    expect(clearanceGroupOf({ memberType: 'Member', roles: ['Membership Director'], isOfficer: false })).toBe('appointed');
    expect(clearanceGroupOf({ memberType: 'Member', roles: [], isOfficer: false })).toBe('members');
  });

  it('drills down Council -> group -> person, in CouncilNumber order, never listing the viewer or a Super Admin', () => {
    const tree = buildImpersonationTree(councils, people, '', 1);
    expect(tree.matches).toBe(7);
    expect(tree.councils.map((c) => [c.councilId, c.count])).toEqual([
      [1, 5],
      [2, 2],
    ]);
    expect(tree.councils[0].groups.map((g) => [g.id, g.people.map((p) => p.memberId)])).toEqual([
      ['executive', [2]],
      ['finance', [3]],
      ['records', [4]],
      ['admins', [5]],
      ['members', [6]],
    ]);
    expect(tree.councils[0].label).toBe(councilLabel(councils[1]));
  });

  it('filters the tree by every word typed, across name, role and council', () => {
    expect(buildImpersonationTree(councils, people, 'smi', 1).councils.map((c) => c.groups.flatMap((g) => g.people.map((p) => p.memberId)))).toEqual([[6], [7]]);
    expect(buildImpersonationTree(councils, people, '16000 smith', 1).matches).toBe(1);
    expect(buildImpersonationTree(councils, people, 'grand knight', 1).councils[0].groups[0].people[0].memberId).toBe(2);
    expect(buildImpersonationTree(councils, people, 'super', 2).matches).toBe(0);
  });

  it('suggests name-prefix matches first', () => {
    expect(impersonationSuggestions(councils, people, 'sto', 1).map((p) => p.memberId)).toEqual([8]);
    // 'Recorder' starts with 're'; Greg and Secretary only contain it.
    expect(impersonationSuggestions(councils, people, 're', 1).map((p) => p.memberId)).toEqual([4, 2, 3]);
    expect(impersonationSuggestions(councils, people, '', 1)).toEqual([]);
    expect(impersonationSuggestions(councils, people, 'm', 1, 2)).toHaveLength(2);
  });

  it("switches the view to the viewed member's own council settings", () => {
    const council = { id: 2, CouncilNumber: 16000, CouncilName: 'Holy Family Council', tenant_type: 'GENERIC', flag_prayer_intentions: 0, meeting_minutes_due_days: 10 } as unknown as Council;
    const ctx = impersonationCouncilContext(council, 1);
    expect(ctx).toMatchObject({ councilId: 2, crossCouncil: true, tenantType: 'GENERIC' });
    expect(ctx.settings.meeting_minutes_due_days).toBe(10);
    expect(impersonationCouncilContext(council, 2).crossCouncil).toBe(false);
  });

  it('wires the route, the session and the lookup page', () => {
    const route = read('apps/web/app/api/admin/impersonate/route.ts');
    expect(route).toContain('impersonationCouncilContext(council, claims.councilId)');
    expect(route).toContain('council: context');
    const session = read('apps/web/lib/session.tsx');
    expect(session).toContain('adoptCouncil(council, target.councilId)');
    const page = read('apps/web/app/system-settings/impersonate/page.tsx');
    expect(page).toContain('<RequireArea area="system-settings/impersonate">');
    expect(page).toContain('buildImpersonationTree(');
    expect(page).toContain('impersonationSuggestions(');
    expect(read('apps/web/components/DashboardDesks.tsx')).toContain('[ 🚀 Start Live Meeting Sequence ]');
    expect(read('apps/web/app/api/drive-vault/meeting-photos/route.ts')).toContain('MEETING_PHOTO_DRIVE_FOLDER');
  });
});

/** Seats `memberId` as the council's Recorder straight in the backing store. */
function seatRecorder(d: (typeof drivers)[number], db: DataService, memberId: number): void {
  if (d.name === 'memory') (db as MemoryDataService).debugStore.insert('MemberRoles', { RoleID: RECORDER_ROLE_ID, MemberID: memberId });
  else openDatabases.at(-1)!.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) VALUES (?, ?)').run(RECORDER_ROLE_ID, memberId);
}

async function newMeeting(db: DataService) {
  const type = (await db.lookups.list('MeetingType'))[0];
  return db.meetings.create({
    OwnerID: null,
    CouncilID: OWN,
    'Meeting Name': 'October Business Meeting',
    Date: '2026-09-15',
    'Time Start': '19:30:00',
    'Time End': '21:00:00',
    Location: 'Parish Hall',
    MeetingType: type.id,
  });
}

describe.each(drivers)('Sprint 8B ($name driver)', (d) => {
  it('lets the Recorder save a draft, publish the minutes and keep the first publication stamp', async () => {
    const db = await d.make();
    const meeting = await newMeeting(db);
    await expectRule(db.meetings.saveMeetingMinutes(MEMBER.member, meeting.id, { text: 'x' }), 'RECORDER_REQUIRED');
    seatRecorder(d, db, MEMBER.member);
    const draft = await db.meetings.saveMeetingMinutes(MEMBER.member, meeting.id, { text: '# Call to order' });
    expect(draft).toMatchObject({ minutes_text: '# Call to order', minutes_published_at: null });
    const published = await db.meetings.saveMeetingMinutes(MEMBER.member, meeting.id, { text: '# Call to order\n- 7:30 PM', publish: true });
    expect(published.minutes_published_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    const again = await db.meetings.saveMeetingMinutes(MEMBER.admin, meeting.id, { text: 'Amended', publish: true });
    expect(again.minutes_published_at).toBe(published.minutes_published_at);
    expect((await db.meetings.saveMeetingMinutes(MEMBER.admin, meeting.id, { text: 'Amended' })).minutes_published_at).toBeNull();
    await expectRule(db.meetings.saveMeetingMinutes(MEMBER.admin, 9999, { text: 'x' }), 'MEETING_NOT_FOUND');
  });

  it('launches the live meeting and hands the chair the PIN', async () => {
    const db = await d.make();
    const meeting = await newMeeting(db);
    await expectRule(db.meetings.launchLiveMeeting(MEMBER.member, meeting.id), 'RECORDER_REQUIRED');
    const launch = await db.meetings.launchLiveMeeting(MEMBER.admin, meeting.id);
    expect(launch).toMatchObject({ pinToken: '0000', pinIsDefault: true });
    expect(launch.state.meeting.IsLiveInProgress).toBe(1);
    await db.councils.setMeetingGeofence(MEMBER.superAdmin, OWN, { pinToken: '4821' });
    expect(await db.meetings.launchLiveMeeting(MEMBER.superAdmin, meeting.id)).toMatchObject({ pinToken: '4821', pinIsDefault: false });
  });

  it('keeps one bulletin per month for the Historian, and lets them file meeting photos', async () => {
    const db = await d.make();
    const meeting = await newMeeting(db);
    await expectRule(db.history.saveHistorianBulletin(MEMBER.member, OWN, '2026-10', 'x'), 'HISTORIAN_REQUIRED');
    await expectRule(db.meetings.setMeetingPhoto(MEMBER.member, meeting.id, null), 'ADMIN_REQUIRED');
    const historian = (await db.elections.listOfficerSeats(OWN)).find((s) => s.roleName === COUNCIL_HISTORIAN_ROLE)!;
    await db.elections.assignAppointedRole(MEMBER.superAdmin, OWN, historian.roleId, MEMBER.member);
    await db.history.saveHistorianBulletin(MEMBER.member, OWN, '2026-09', 'September');
    await db.history.saveHistorianBulletin(MEMBER.member, OWN, '2026-10', 'First draft');
    const saved = await db.history.saveHistorianBulletin(MEMBER.member, OWN, '2026-10', 'Second draft');
    expect(saved).toMatchObject({ council_id: OWN, bulletin_month: '2026-10', body: 'Second draft', author_member_id: MEMBER.member });
    expect((await db.history.listHistorianBulletins(MEMBER.member, OWN)).map((b) => [b.bulletin_month, b.body])).toEqual([
      ['2026-10', 'Second draft'],
      ['2026-09', 'September'],
    ]);
    await expectRule(db.history.listHistorianBulletins(MEMBER.member, 2), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.history.saveHistorianBulletin(MEMBER.admin, OWN, '2026/10', 'x'), 'INVALID_INPUT');
    expect((await db.meetings.setMeetingPhoto(MEMBER.member, meeting.id, '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456')).photo_url).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz0123456');
  });
});
