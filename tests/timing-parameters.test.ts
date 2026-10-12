// Sprint 7E (Schema 64): the timing settings - ten Council columns and three PlatformSettings columns - their grouped,
// explained editors, the drivers and server reading them live, and the Navigation Guide quoting them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cleanCouncilWideSettings,
  cleanPlatformSettings,
  COUNCIL_SETTING_GROUP_ORDER,
  COUNCIL_WIDE_SETTING_NAMES,
  COUNCIL_WIDE_SETTING_RULES,
  councilWideSettings,
  formatSettingValue,
  navigationTimings,
  PLATFORM_SETTING_GROUP_ORDER,
  PLATFORM_SETTING_NAMES,
  PLATFORM_SETTING_RULES,
  platformSettings,
  SETTING_GROUPS,
  settingsInGroup,
  type DataService,
  type ExpenseLineItemInput,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { sessionClaimsFor } from '../apps/web/services/server/session-token';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const NOW = new Date(2026, 8, 20, 12, 0, 0);

const NEW_COUNCIL_COLUMNS: [string, string, string][] = [
  ['er_submission_window_days', 'INT', '30'],
  ['volunteer_logging_window_days', 'INT', '90'],
  ['reminder_delay_days', 'INT', '5'],
  ['reminder_cadence_days', 'INT', '7'],
  ['expense_draft_expiry_days', 'INT', '90'],
  ['charity_proposal_voting_days', 'INT', '14'],
  ['shift_signup_lock_hours', 'DECIMAL(5,2)', '2.0'],
  ['officer_signature_reminder_days', 'INT', '3'],
  ['meeting_minutes_due_days', 'INT', '7'],
  ['special_election_notice_days', 'INT', '60'],
];
const NEW_PLATFORM_COLUMNS: [string, string][] = [
  ['cadence_invitation_horizon_days', '5'],
  ['user_session_expiry_hours', '8'],
  ['audit_log_retention_days', '180'],
];
const NOT_IN_USE = [
  'expense_draft_expiry_days',
  'charity_proposal_voting_days',
  'officer_signature_reminder_days',
  'special_election_notice_days',
  'audit_log_retention_days',
];

describe('Schema 64', () => {
  it('adds the ten Council columns and three PlatformSettings columns, seeds the row and bumps the phone version', () => {
    const schema = read('Schema.sql');
    for (const [name, type, value] of NEW_COUNCIL_COLUMNS) expect(schema).toContain(`ALTER TABLE [Council] ADD [${name}] ${type} NOT NULL DEFAULT ${value};`);
    for (const [name, value] of NEW_PLATFORM_COLUMNS) expect(schema).toContain(`ALTER TABLE [PlatformSettings] ADD [${name}] INT NOT NULL DEFAULT ${value};`);
    expect(TABLES.PlatformSettings.columns.map((c) => c.name)).toEqual(['id', 'oral_history_max_seconds', 'diary_text_max_length', 'prayer_intention_max_length', ...NEW_PLATFORM_COLUMNS.map(([n]) => n)]);
    expect(TABLES.Council.columns.map((c) => c.name)).toEqual(expect.arrayContaining(NEW_COUNCIL_COLUMNS.map(([n]) => n)));
    expect(read('Seed.sql')).toMatch(/INSERT INTO \[PlatformSettings\][^;]*VALUES \(1, 900, 4000, 500, 5, 8, 180\);/);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (6[4-9]|[7-9]\d);/);
  });
});

describe('timing settings (pure)', () => {
  it('defaults every new setting to its column default', () => {
    expect(councilWideSettings(null)).toMatchObject(Object.fromEntries(NEW_COUNCIL_COLUMNS.map(([n, , v]) => [n, Number(v)])));
    expect(platformSettings(null)).toMatchObject(Object.fromEntries(NEW_PLATFORM_COLUMNS.map(([n, v]) => [n, Number(v)])));
  });

  it('checks the ranges, whole days and quarter hours', () => {
    expect(cleanCouncilWideSettings({ er_submission_window_days: 45, shift_signup_lock_hours: 1.75 })).toEqual({ er_submission_window_days: 45, shift_signup_lock_hours: 1.75 });
    expect(() => cleanCouncilWideSettings({ er_submission_window_days: 0 })).toThrow(/from 1 to 365/);
    expect(() => cleanCouncilWideSettings({ volunteer_logging_window_days: 6 })).toThrow(/from 7 to 730/);
    expect(() => cleanCouncilWideSettings({ reminder_cadence_days: 2.5 })).toThrow(/whole number/);
    expect(() => cleanCouncilWideSettings({ shift_signup_lock_hours: 1.1 })).toThrow(/multiple of 0.25/);
    expect(cleanPlatformSettings({ user_session_expiry_hours: 24 })).toEqual({ user_session_expiry_hours: 24 });
    expect(() => cleanPlatformSettings({ user_session_expiry_hours: 169 })).toThrow(/from 1 to 168/);
    expect(() => cleanPlatformSettings({ cadence_invitation_horizon_days: 0 })).toThrow(/from 1 to 60/);
    expect(() => cleanPlatformSettings({ user_session_expiry_days: 7 })).toThrow(/Unknown platform setting/);
  });

  it('gives every setting a card and an (i) help text, and marks the ones no feature reads yet', () => {
    for (const [names, rules, order] of [
      [COUNCIL_WIDE_SETTING_NAMES, COUNCIL_WIDE_SETTING_RULES, COUNCIL_SETTING_GROUP_ORDER],
      [PLATFORM_SETTING_NAMES, PLATFORM_SETTING_RULES, PLATFORM_SETTING_GROUP_ORDER],
    ] as const) {
      const grouped = order.flatMap((g) => settingsInGroup(names as readonly string[], rules as Record<string, { group: never }>, g));
      expect([...grouped].sort()).toEqual([...names].sort());
      for (const name of names) {
        const rule = (rules as Record<string, (typeof COUNCIL_WIDE_SETTING_RULES)[keyof typeof COUNCIL_WIDE_SETTING_RULES]>)[name];
        expect(rule.help.length, name).toBeGreaterThan(60);
        expect(rule.inUse, name).toBe(!NOT_IN_USE.includes(name));
        if (!rule.inUse) expect(rule.help, name).toMatch(/changes nothing yet/);
      }
    }
    expect(COUNCIL_SETTING_GROUP_ORDER.map((g) => SETTING_GROUPS[g].title)).toEqual(['Financial Submissions', 'Volunteer & Meeting Operations', 'Reminder Cadences']);
    expect(formatSettingValue({ unit: 'days' }, 1)).toBe('1 day');
    expect(formatSettingValue({ unit: 'activities' }, 1)).toBe('1 activity');
    expect(formatSettingValue({ unit: 'hours' }, 2.5)).toBe('2.5 hours');
  });

  it('mints a session for the platform session length', () => {
    const user = { memberId: 2, councilId: 1, username: 'a', memberType: 'Admin' as const, roles: [], isOfficer: false, isBudgetDirector: false };
    expect(sessionClaimsFor(user, true, NOW).exp - sessionClaimsFor(user, true, NOW).iat).toBe(8 * 3600);
    const claims = sessionClaimsFor(user, true, NOW, 24 * 3600);
    expect(claims.exp - claims.iat).toBe(24 * 3600);
  });
});

describe('Navigation Guide time limits', () => {
  const member = { memberId: 9, councilId: 1, memberType: 'Member' as const, isOfficer: false, roles: [] };
  const admin = { ...member, memberId: 2, memberType: 'Admin' as const };

  it("quotes the viewer's own council and the platform, read live", () => {
    const lines = navigationTimings(member, { er_submission_window_days: 45, volunteer_logging_window_days: 120 }, { user_session_expiry_hours: 12 });
    const byName = Object.fromEntries(lines.map((l) => [l.name, l]));
    expect(byName.er_submission_window_days.value).toBe('45 days');
    expect(byName.volunteer_logging_window_days.value).toBe('120 days');
    expect(byName.reminder_delay_days.value).toBe('5 days');
    expect(byName.cadence_invitation_horizon_days).toMatchObject({ value: '5 days', scope: 'platform' });
    expect(byName.user_session_expiry_hours.value).toBe('12 hours');
    // A plain member sees only the limits they meet, never the leadership-only or unused ones.
    expect(lines.every((l) => l.inUse)).toBe(true);
    expect(byName.quarantine_max_single_hours).toBeUndefined();
  });

  it('shows leadership every timing setting, the unused ones last', () => {
    const lines = navigationTimings(admin, null, null);
    const names = lines.map((l) => l.name);
    expect(names).toEqual(expect.arrayContaining(['max_shift_padding_hours', 'inactivity_threshold_days', ...NOT_IN_USE]));
    expect(names).not.toContain('quarantine_max_daily_activities'); // a count, not a time limit
    const firstUnused = lines.findIndex((l) => !l.inUse);
    expect(lines.slice(firstUnused).every((l) => !l.inUse)).toBe(true);
  });
});

const receipt = (): ExpenseLineItemInput => ({ DateOfExpense: '2026-09-20', Amount: 12, VendorName: 'Costco', ExpenseDescription: 'Supplies' });

describe.each(drivers)('$name driver: timing settings', (d) => {
  async function eventEnding(db: DataService, EndDate: string): Promise<number> {
    const category = (await db.lookups.list('Category'))[0];
    const event = await db.events.create(
      { EventName: `Ends ${EndDate}`, EventDescription: 'Sprint 7E fixture', OwnerID: MEMBER.superAdmin, StartDate: EndDate, EndDate, Location: 'Hall', CategoryID: category.id },
      [OWN],
    );
    return event.id;
  }

  it('saves and reads back the new council settings', async () => {
    const db = await d.make();
    const saved = await db.councils.setCouncilWideSettings(MEMBER.admin, OWN, { er_submission_window_days: 10, special_election_notice_days: 30, shift_signup_lock_hours: 1.5 });
    expect(councilWideSettings(saved)).toMatchObject({ er_submission_window_days: 10, special_election_notice_days: 30, shift_signup_lock_hours: 1.5, reminder_delay_days: 5 });
    await expectRule(db.councils.setCouncilWideSettings(MEMBER.member, OWN, { er_submission_window_days: 10 }), 'ADMIN_REQUIRED');
  });

  it("closes expense filing on the council's own window", async () => {
    const db = await d.make();
    const ended40DaysAgo = await eventEnding(db, '2026-08-11');
    await expectRule(db.expenses.submitReport(MEMBER.member, { Status: 'Submitted', LinkedEventID: ended40DaysAgo }, [receipt()]), 'EXPENSE_WINDOW_CLOSED');
    await db.councils.setCouncilWideSettings(MEMBER.admin, OWN, { er_submission_window_days: 45 });
    const { report } = await db.expenses.submitReport(MEMBER.member, { Status: 'Submitted', LinkedEventID: ended40DaysAgo }, [receipt()]);
    expect(report.Status).toBe('Submitted');
  });

  it('releases cadence invitations on the platform horizon and keeps the full platform row', async () => {
    const db = await d.make();
    await expectRule(db.councils.setPlatformSettings(MEMBER.admin, { cadence_invitation_horizon_days: 10 }), 'SUPER_ADMIN_REQUIRED');
    const saved = await db.councils.setPlatformSettings(MEMBER.superAdmin, { cadence_invitation_horizon_days: 10, audit_log_retention_days: 365 });
    expect(saved).toMatchObject({ cadence_invitation_horizon_days: 10, audit_log_retention_days: 365, user_session_expiry_hours: 8, oral_history_max_seconds: 900 });
    expect(await db.councils.getPlatformSettings()).toEqual(saved);
    const result = await db.meetings.populateAnnualCadence(MEMBER.admin, OWN, 1, '2026-2027');
    expect(result.created[0]).toMatchObject({ Date: '2026-07-07', InviteReleaseDate: '2026-06-27' });
  });
});
