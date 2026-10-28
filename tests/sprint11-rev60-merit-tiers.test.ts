// Sprint 11 Revision 6.0 (schema 105): the 6-tier merit ladder that replaces the canonization shield, Member.join_date
// from the Supreme roster's First Degree / Initiation Date column, the automatic charter member rule against
// Council.institution_date, and the council's own milestones on the Admin Desk's Council Lookup Tables drawer.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyCharterRule,
  CHARTER_MEMBER_BADGE,
  cleanInstitutionDate,
  cleanMeritThresholds,
  cleanSupremeRosterRow,
  councilMeritThresholds,
  DEFAULT_MERIT_THRESHOLDS,
  isCharterJoinDate,
  MERIT_TIERS,
  meritBadgeText,
  meritStanding,
  meritThresholdColumns,
  meritYearMetrics,
  parseSupremeRosterCsv,
  PLATFORM_SCHEMA_VERSION,
  rosterExistingMemberChanges,
  type MeritMetrics,
  type MeritThresholds,
  type NewMember,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER, NOW } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const TODAY = '2026-09-20';
const zero: MeritMetrics = { hours: 0, events: 0, meetings: 0, recruits: 0 };
const stand = (metrics: Partial<MeritMetrics>, member: Parameters<typeof meritStanding>[0]['member'] = { DateJoinedCouncil: '2015-01-01' }, roles: string[] = []) =>
  meritStanding({ member, roles, metrics: { ...zero, ...metrics }, thresholds: DEFAULT_MERIT_THRESHOLDS, today: TODAY });

const CSV_HEADER = 'Member Number,First Name,Last Name,Email,Phone,Street,City,State,Zip,Birth Date,Degree,Date Joined,Charter Member,First Degree Date';

describe('1. schema 105', () => {
  it('moves the platform to 105 with the join date, recruiter, honorary switch, institution date and milestones', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBeGreaterThanOrEqual(105); // Sprint 11 Revision 7.0 moved the platform on to 106.
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = 10[5-9];/);
    expect(read('Schema.sql')).toContain('(schema version 105)');
    const member = TABLES.Member!.columns;
    expect(member.find((c) => c.name === 'join_date')).toMatchObject({ notNull: false });
    expect(member.find((c) => c.name === 'recruited_by_member_id')).toBeDefined();
    expect(member.find((c) => c.name === 'flag_honorary_shield')).toMatchObject({ kind: 'bit', notNull: true });
    const council = TABLES.Council!.columns.map((c) => c.name);
    expect(council).toContain('institution_date');
    expect(council.filter((c) => c.startsWith('merit_t'))).toHaveLength(12);
    expect(council).not.toContain('rank_threshold_hours');
    expect(council).not.toContain('rank_threshold_events');
  });
});

describe('2. roster CSV: First Degree / Initiation Date -> join_date', () => {
  it('maps either header to join_date and keeps it optional', () => {
    const row = '7100101,Leo,Founder,leo.founder@example.org,503-555-0190,1 Main St,Salem,OR,97301,1960-01-01,3,2026-09-01,No,1990-03-10';
    expect(parseSupremeRosterCsv(`${CSV_HEADER}\n${row}\n`)[0]!.join_date).toBe('1990-03-10');
    expect(parseSupremeRosterCsv(`${CSV_HEADER.replace('First Degree Date', 'Initiation Date')}\n${row}\n`)[0]!.join_date).toBe('1990-03-10');
    expect(parseSupremeRosterCsv(`${CSV_HEADER.replace('First Degree Date', 'First Degree Date / Initiation Date')}\n${row}\n`)[0]!.join_date).toBe('1990-03-10');
    // The column is optional: a 13-column file still loads.
    const short = parseSupremeRosterCsv(`${CSV_HEADER.replace(',First Degree Date', '')}\n${row.replace(',1990-03-10', '')}\n`)[0]!;
    expect(short.join_date).toBeUndefined();
  });

  it('binds join_date on the cleaned member and refuses a future or pre-birth date', () => {
    const [row] = parseSupremeRosterCsv(`${CSV_HEADER}\n7100102,Al,Early,al.early@example.org,503-555-0191,1 Main St,Salem,OR,97301,1960-01-01,1,2026-09-01,No,1990-03-10\n`);
    const ids = { activeStatusId: 1, memberTypeId: 3 };
    expect(cleanSupremeRosterRow(row!, OWN, ids, NOW).join_date).toBe('1990-03-10');
    expect(() => cleanSupremeRosterRow({ ...row!, join_date: '2027-01-01' }, OWN, ids, NOW)).toThrow(/cannot be in the future/);
    expect(() => cleanSupremeRosterRow({ ...row!, join_date: '1950-01-01' }, OWN, ids, NOW)).toThrow(/after the date of birth/);
    expect(cleanSupremeRosterRow({ ...row!, join_date: '' }, OWN, ids, NOW).join_date).toBeNull();
  });
});

describe('3. charter member rule (pure)', () => {
  it('flags a join date on or before the institution date + 30 days', () => {
    expect(isCharterJoinDate('1990-03-01', '1990-03-10')).toBe(true); // before institution
    expect(isCharterJoinDate('1990-04-09', '1990-03-10')).toBe(true); // day 30
    expect(isCharterJoinDate('1990-04-10', '1990-03-10')).toBe(false); // day 31
    expect(isCharterJoinDate(null, '1990-03-10')).toBe(false);
    expect(isCharterJoinDate('1990-03-01', null)).toBe(false);
  });

  it('only ever turns the flag on', () => {
    expect(applyCharterRule({ join_date: '1990-03-15', flag_charter_member: 0 }, '1990-03-10').flag_charter_member).toBe(1);
    expect(applyCharterRule({ join_date: '2001-01-01', flag_charter_member: 1 }, '1990-03-10').flag_charter_member).toBe(1);
    expect(applyCharterRule({ join_date: '2001-01-01', flag_charter_member: 0 }, '1990-03-10').flag_charter_member).toBe(0);
    const ids = { activeStatusId: 1, memberTypeId: 3 };
    const [row] = parseSupremeRosterCsv(`${CSV_HEADER}\n7100103,Cy,Charter,cy@example.org,503-555-0192,1 Main St,Salem,OR,97301,1960-01-01,1,2026-09-01,No,1990-03-20\n`);
    expect(cleanSupremeRosterRow(row!, OWN, ids, NOW, '1990-03-10').flag_charter_member).toBe(1);
    expect(cleanSupremeRosterRow(row!, OWN, ids, NOW, '1980-01-01').flag_charter_member).toBe(0);
    expect(CHARTER_MEMBER_BADGE).toBe('📜 Charter Member');
  });

  it('brings an existing member in line: join date, charter flag, nothing when unchanged', () => {
    const existing = { DateJoinedCouncil: '2026-09-01', join_date: null, flag_charter_member: 0, DateOfBirth: '1960-01-01' };
    expect(rosterExistingMemberChanges(existing, { DateJoinedCouncil: '2026-09-01', join_date: '1990-03-20' }, '1990-03-10', NOW)).toEqual({ join_date: '1990-03-20', flag_charter_member: 1 });
    expect(rosterExistingMemberChanges({ ...existing, join_date: '1990-03-20', flag_charter_member: 1 }, { DateJoinedCouncil: '2026-09-01', join_date: '' }, '1990-03-10', NOW)).toEqual({});
    expect(rosterExistingMemberChanges(existing, { DateJoinedCouncil: '2026-08-01' }, null, NOW)).toEqual({ DateJoinedCouncil: '2026-08-01' });
  });

  it('checks the institution date', () => {
    expect(cleanInstitutionDate(undefined, NOW)).toBeUndefined();
    expect(cleanInstitutionDate(null, NOW)).toBeNull();
    expect(cleanInstitutionDate('', NOW)).toBeNull();
    expect(cleanInstitutionDate('1990-03-10', NOW)).toBe('1990-03-10');
    expect(() => cleanInstitutionDate('1990-02-30', NOW)).toThrow(/YYYY-MM-DD/);
    expect(() => cleanInstitutionDate('2030-01-01', NOW)).toThrow(/future/);
  });
});

describe('4. the six tiers (pure)', () => {
  it('names the six tiers in order', () => {
    expect(MERIT_TIERS.map((t) => t.id)).toEqual(['TIER_1_NEW', 'TIER_2_ACTIVE', 'TIER_3_ANCHOR', 'TIER_4_CHAMPION', 'TIER_5_DISTINGUISHED', 'TIER_6_LEADERSHIP']);
    expect(MERIT_TIERS.map((t) => t.label)).toEqual(['New Member', 'Active Knight', 'Anchor Knight', 'Fraternal Champion', 'Shining Armor Companion', 'Shield Circle / Honorary']);
    expect(DEFAULT_MERIT_THRESHOLDS).toEqual({
      tier2: { hours: 1, events: 1, meetings: 1 },
      tier3: { hours: 20, events: 4, meetings: 4 },
      tier4: { hours: 60, events: 8, meetings: 8 },
      tier5: { meetings: 3, events: 3, recruits: 1 },
    });
  });

  it('Tier 1: 180 days or fewer from the join date', () => {
    expect(stand({}, { join_date: '2026-03-24' }).tier?.id).toBe('TIER_1_NEW'); // day 180
    expect(stand({}, { join_date: '2026-03-23' }).tier).toBeNull(); // day 181
    // join_date wins over DateJoinedCouncil; DateJoinedCouncil is the fallback.
    expect(stand({}, { join_date: '2010-01-01', DateJoinedCouncil: '2026-09-01' }).tier).toBeNull();
    expect(stand({}, { DateJoinedCouncil: '2026-09-01' }).tier?.id).toBe('TIER_1_NEW');
  });

  it('Tiers 2 to 4: hours, events AND meetings this fraternal year', () => {
    expect(stand({ hours: 1, events: 1, meetings: 1 }).tier?.id).toBe('TIER_2_ACTIVE');
    expect(stand({ hours: 1, events: 1, meetings: 0 }).tier).toBeNull();
    expect(stand({ hours: 20, events: 4, meetings: 4 }).tier?.id).toBe('TIER_3_ANCHOR');
    expect(stand({ hours: 59.75, events: 8, meetings: 8 })).toMatchObject({ tier: { id: 'TIER_3_ANCHOR' }, next: { tier: { id: 'TIER_4_CHAMPION' }, hoursNeeded: 0.25, eventsNeeded: 0, meetingsNeeded: 0 } });
    expect(stand({ hours: 60, events: 8, meetings: 8 })).toMatchObject({ tier: { id: 'TIER_4_CHAMPION' }, next: null });
    // A new member who serves holds the higher tier.
    expect(stand({ hours: 1, events: 1, meetings: 1 }, { join_date: '2026-09-01' })).toMatchObject({ tier: { number: 2 }, qualified: [1, 2] });
  });

  it('Tier 5: 3 meetings, 3 separate events and 1 recruit this fraternal year', () => {
    expect(stand({ hours: 2, events: 3, meetings: 3, recruits: 1 }).tier?.id).toBe('TIER_5_DISTINGUISHED');
    expect(stand({ hours: 2, events: 3, meetings: 3, recruits: 0 }).tier?.id).toBe('TIER_2_ACTIVE');
    expect(stand({ hours: 100, events: 10, meetings: 10, recruits: 1 }).qualified).toEqual([2, 3, 4, 5]);
  });

  it('Tier 6: an executive office, 25+ years since joining, or the Admin switch', () => {
    expect(stand({}, { DateJoinedCouncil: '2015-01-01' }, ['Grand Knight'])).toMatchObject({ tier: { id: 'TIER_6_LEADERSHIP' }, honoraryReason: 'office' });
    expect(stand({}, { DateJoinedCouncil: '2015-01-01' }, ['Deputy Grand Knight']).honoraryReason).toBe('office');
    expect(stand({}, { DateJoinedCouncil: '2015-01-01' }, ['Treasurer']).tier).toBeNull();
    expect(stand({}, { join_date: '2001-09-20' })).toMatchObject({ tier: { number: 6 }, honoraryReason: 'tenure' }); // exactly 25 years
    expect(stand({}, { join_date: '2001-09-21' }).tier).toBeNull();
    expect(stand({}, { join_date: '2015-01-01', flag_honorary_shield: 1 })).toMatchObject({ tier: { number: 6 }, honoraryReason: 'override' });
    expect(meritBadgeText(stand({}, { join_date: '2001-01-01' }))).toBe('👑 Tier 6: Shield Circle / Honorary (25+ years)');
    expect(meritBadgeText(stand({}))).toBe('No merit tier yet this fraternal year');
  });

  it('counts only the current fraternal year and resets every July 1', () => {
    const logs = [
      { MemberID: 5, Hours: 3, date: '2026-06-30', eventId: 1 }, // last fraternal year
      { MemberID: 5, Hours: 2, date: '2026-07-01', eventId: 2 },
      { MemberID: 5, Hours: 1.5, date: '2026-09-01', eventId: 2 },
      { MemberID: 5, Hours: 1, date: '2026-09-02', eventId: null },
      { MemberID: 6, Hours: 9, date: '2026-09-02', eventId: 3 },
    ];
    const attendance = [
      { MemberID: 5, MeetingID: 1, CheckedInAt: '2026-06-15T19:00:00' },
      { MemberID: 5, MeetingID: 2, CheckedInAt: '2026-09-15T19:00:00' },
      { MemberID: 5, MeetingID: 2, CheckedInAt: '2026-09-15T19:05:00' },
    ];
    const members = [
      { id: 7, recruited_by_member_id: 5, join_date: '2026-08-01' },
      { id: 8, recruited_by_member_id: 5, join_date: '2025-08-01' },
      { id: 9, recruited_by_member_id: 5, join_date: null, DateJoinedCouncil: '2026-10-01' },
      { id: 5, recruited_by_member_id: 5, join_date: '2026-08-01' },
    ];
    expect(meritYearMetrics({ memberId: 5, fraternalYear: '2026-2027', logs, attendance, members })).toEqual({ hours: 4.5, events: 1, meetings: 1, recruits: 2 });
    expect(meritYearMetrics({ memberId: 5, fraternalYear: '2025-2026', logs, attendance, members })).toEqual({ hours: 3, events: 1, meetings: 1, recruits: 1 });
    expect(stand({}).fraternalYear).toBe('2026-2027');
  });

  it('reads, checks and stores the council milestones', () => {
    expect(councilMeritThresholds(null)).toEqual(DEFAULT_MERIT_THRESHOLDS);
    expect(councilMeritThresholds({ merit_t3_hours: 30, merit_t5_recruits: 2 })).toMatchObject({ tier3: { hours: 30 }, tier5: { recruits: 2 } });
    const custom: MeritThresholds = { tier2: { hours: 2, events: 1, meetings: 1 }, tier3: { hours: 25, events: 5, meetings: 5 }, tier4: { hours: 80, events: 10, meetings: 9 }, tier5: { meetings: 4, events: 4, recruits: 2 } };
    expect(cleanMeritThresholds(custom)).toEqual(custom);
    expect(meritThresholdColumns(custom)).toMatchObject({ merit_t2_hours: 2, merit_t4_meetings: 9, merit_t5_recruits: 2 });
    expect(Object.keys(meritThresholdColumns(custom))).toHaveLength(12);
    expect(() => cleanMeritThresholds({ ...custom, tier3: { ...custom.tier3, hours: 1 } })).toThrow(/must not go down/);
    expect(() => cleanMeritThresholds({ ...custom, tier2: { ...custom.tier2, events: 1.5 } })).toThrow(/Tier 2 events/);
    expect(() => cleanMeritThresholds({ ...custom, tier5: { meetings: 4, events: 4 } })).toThrow(/Tier 5 recruits/);
    expect(() => cleanMeritThresholds(null)).toThrow(/Enter the milestones/);
  });
});

describe.each(drivers)('5. merit tiers and the charter rule ($name driver)', ({ make }) => {
  const newMember = (over: Partial<NewMember> = {}): NewMember => ({
    CouncilID: OWN,
    MemberNumber: 7200001,
    MemberFirstName: 'Mark',
    MemberLastName: 'Merit',
    Phone: '503-555-0180',
    StreetAddress1: '8 Mission Road',
    City: 'Salem',
    State: 'OR',
    ZipCode: '97301',
    Email: 'mark.merit@example.org',
    DateOfBirth: '1960-05-05',
    StatusID: 1,
    DegreeID: 1,
    MemberTypeID: 3,
    DateJoinedCouncil: '2015-09-01',
    ...over,
  });

  it('lets only the council Admins and Super Admins set the milestones and institution date', async () => {
    const db = await make();
    const custom = { ...DEFAULT_MERIT_THRESHOLDS, tier3: { hours: 30, events: 5, meetings: 5 } };
    expect(await db.councils.setMeritThresholds(MEMBER.admin, OWN, custom, '1990-03-10')).toMatchObject({ merit_t3_hours: 30, institution_date: '1990-03-10' });
    // Leaving the date out keeps it.
    expect((await db.councils.setMeritThresholds(MEMBER.admin, OWN, DEFAULT_MERIT_THRESHOLDS)).institution_date).toBe('1990-03-10');
    await expectRule(db.councils.setMeritThresholds(MEMBER.member, OWN, custom), 'ADMIN_REQUIRED');
    const other = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 99601, CouncilName: 'Council 99601', State: 'OR' });
    await expectRule(db.councils.setMeritThresholds(MEMBER.admin, other.id, custom), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.councils.setMeritThresholds(MEMBER.superAdmin, other.id, { ...custom, tier4: { hours: 1, events: 1, meetings: 1 } }), 'INVALID_INPUT');
    await expectRule(db.councils.setMeritThresholds(MEMBER.superAdmin, other.id, custom, '2030-01-01'), 'INVALID_INPUT');
    expect((await db.councils.setMeritThresholds(MEMBER.superAdmin, other.id, custom, null)).institution_date ?? null).toBeNull();
  });

  it('imports the First Degree Date and flags charter members on the roster sync, new and existing', async () => {
    const db = await make();
    await db.councils.setMeritThresholds(MEMBER.admin, OWN, DEFAULT_MERIT_THRESHOLDS, '1990-03-10');
    const csv = `${CSV_HEADER}\n7200101,Fred,Founder,fred.founder@example.org,503-555-0110,1 Main St,Salem,OR,97301,1960-01-01,3,1990-03-20,No,1990-03-20\n7200102,Neil,Newer,neil.newer@example.org,503-555-0111,1 Main St,Salem,OR,97301,1980-01-01,1,2020-01-01,No,2020-01-01\n`;
    const first = await db.supreme.syncSupremeRoster(MEMBER.admin, OWN, parseSupremeRosterCsv(csv));
    expect(first.created.map((m) => [m.join_date, m.flag_charter_member])).toEqual([
      ['1990-03-20', 1],
      ['2020-01-01', 0],
    ]);
    // An existing member without the date picks it up, and the charter flag with it.
    const neil = first.created[1]!;
    await db.members.update(MEMBER.admin, neil.id, { join_date: null });
    const second = await db.supreme.syncSupremeRoster(MEMBER.admin, OWN, parseSupremeRosterCsv(csv.replace('2020-01-01,No,2020-01-01', '2020-01-01,No,1990-04-01')));
    expect(second.created).toEqual([]);
    expect(second.updated.map((m) => [m.id, m.join_date, m.flag_charter_member])).toEqual([[neil.id, '1990-04-01', 1]]);
  });

  it('applies the charter rule when an Admin saves a member', async () => {
    const db = await make();
    await db.councils.setMeritThresholds(MEMBER.admin, OWN, DEFAULT_MERIT_THRESHOLDS, '1990-03-10');
    const late = await db.members.create(MEMBER.admin, newMember({ join_date: '2000-01-01' }));
    expect(late.flag_charter_member).toBe(0);
    expect((await db.members.update(MEMBER.admin, late.id, { join_date: '1990-03-01' })).flag_charter_member).toBe(1);
  });

  it('gives the tier on the devotional tracker and the Council Dashboard, with recruits and the Honorary switch', async () => {
    const db = await make();
    const mark = await db.members.create(MEMBER.admin, newMember());
    expect((await db.devotionals.getProgress(mark.id)).rank).toMatchObject({ tier: null, fraternalYear: '2026-2027', metrics: { hours: 0, recruits: 0 } });
    // A recruit who joined this fraternal year counts; a member cannot recruit themselves.
    await db.members.update(MEMBER.admin, MEMBER.member, { recruited_by_member_id: mark.id, join_date: '2026-08-15' });
    expect((await db.devotionals.getProgress(mark.id)).rank.metrics.recruits).toBe(1);
    await expectRule(db.members.update(MEMBER.admin, mark.id, { recruited_by_member_id: mark.id }), 'INVALID_INPUT');
    // Only an Admin may award the Honorary tier.
    await expectRule(db.members.update(mark.id, mark.id, { flag_honorary_shield: 1 }), 'ADMIN_REQUIRED');
    await db.members.update(MEMBER.admin, mark.id, { flag_honorary_shield: 1 });
    expect((await db.devotionals.getProgress(mark.id)).rank).toMatchObject({ tier: { id: 'TIER_6_LEADERSHIP' }, honoraryReason: 'override' });
    const center = await db.reports.memberCenter(mark.id, OWN, 2026, 9);
    expect(center.me.rank?.tier?.number).toBe(6);
  });
});

describe('6. screens and manuals', () => {
  it('mounts the milestone panel in the Council Lookup Tables drawer for Admins and Super Admins only', () => {
    const lookups = read('apps/web/components/modules/CouncilLookupTables.tsx');
    expect(lookups).toContain("canAdministerCouncil(user, scope.councilId) ? [{ id: 'merit' as const, label: 'Merit Tier Milestones' }]");
    expect(lookups).toContain('<MeritMilestonesPanel');
    const panel = read('apps/web/components/MeritTierParts.tsx');
    expect(panel).toContain('db.councils.setMeritThresholds');
    expect(panel).toContain('if (!canAdministerCouncil(user, councilId))');
    expect(read('apps/web/components/modules/CouncilWideSettings.tsx')).not.toContain('RankThresholdsCard');
  });

  it('shows the badge on web and phone and the recruiter and Honorary switch on the member form', () => {
    expect(read('apps/web/app/member-center/page.tsx')).toContain('<MeritTierBadge rank={me.rank} />');
    expect(read('apps/mobile/app/(app)/member-center.tsx')).toContain('<MeritTierBadge rank={c.me.rank} />');
    expect(read('apps/mobile/components/DevotionalTracker.tsx')).toContain('<MeritTierBadge rank={p.rank} />');
    const form = read('apps/web/components/modules/MemberRecordForm.tsx');
    expect(form).toContain("{ key: 'join_date', label: 'First Degree / Initiation Date'");
    expect(form).toContain('Recruited by (optional)');
    expect(form).toContain('Shield Circle / Honorary (Tier 6)');
  });

  it('describes the ladder in the manuals and the Quick-Start guide', () => {
    expect(read('docs/ADMIN_USER_GUIDE.md')).toContain('**Merit Tier Milestones** tab');
    expect(read('docs/QUICK_START_INTAKE_GUIDE.md')).toContain('First Degree Date');
    expect(read('docs/MEMBER_USER_GUIDE.md')).toContain('merit tier');
    expect(read('data_dictionary.md')).toContain('Member.join_date');
    expect(read('docs/ARCHITECTURAL_HISTORY.md')).toMatch(/\| 105 \|/);
  });
});
