// Sprint 11 Revision 11.0 (schema 109): the Form 1728 popup on ongoing activities (Activities.form_1728_line), five more
// unified screen names, and the dependency compliance report.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_COLUMNS,
  ADMIN_DESK_DRAWERS,
  cleanActivity,
  compileSupremeSnapshot,
  DESK_DRAWERS,
  MEMBER_ROSTER_TITLE,
  PLATFORM_SCHEMA_VERSION,
  SUPER_ADMIN_DESK_TITLE,
  supremeReportingPeriod,
  type DataService,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { drivers, expectRule, MEMBER, NOW } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const read = (path: string) => readFileSync(path, 'utf8');

describe('1. Activities.form_1728_line (schema 109)', () => {
  it('adds the column and moves the platform to 109', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(109);
    expect(read('Schema.sql')).toContain('ALTER TABLE [Activities] ADD [form_1728_line] VARCHAR(20) NULL;');
    expect(read('Schema.sql')).toContain('(schema version 109)');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toContain('const SCHEMA_VERSION = 109;');
    expect(read('data_dictionary.md')).toContain('form_1728_line (VARCHAR(20), NULL) — Sprint 11 Revision 11.0');
    expect(ACTIVITY_COLUMNS).toContain('form_1728_line');
  });

  it('cleans the line like an event line: a catalog code, case-insensitive, or null', () => {
    const base = { ActivityName: 'Rosary', ActivityDescription: 'Monthly rosary', CategoryID: 3, CouncilID: 1 };
    expect(cleanActivity(base).form_1728_line).toBeNull();
    expect(cleanActivity({ ...base, form_1728_line: 'faith_c' }).form_1728_line).toBe('FAITH_C');
    expect(() => cleanActivity({ ...base, form_1728_line: 'FAITH_Z' })).toThrow();
  });

  it('counts activity hours under the confirmed line in the Supreme snapshot', () => {
    const snapshot = compileSupremeSnapshot('AnnualSurvey', supremeReportingPeriod('AnnualSurvey', NOW), {
      council: { id: 1, CouncilNumber: 15295, CouncilName: "St. Mary's Cathedral" },
      eventTime: [],
      activityTime: [
        { MemberID: 1, Hours: 3, category: 'Service', title: 'Greeting', line: 'FAMILY_B' },
        { MemberID: 2, Hours: 1, category: 'Service', title: 'Greeting' },
      ],
      events: [],
      eventExpenseItems: [],
      donations: [],
      disbursements: [],
    });
    expect(snapshot.form1728Lines.map((l) => [l.code, l.hours])).toEqual([
      ['FAMILY_B', 3],
      ['COMMUNITY_N', 1],
    ]);
  });
});

describe.each(drivers)('2. activity writes keep the line ($name driver)', (d) => {
  it('stores it on create, changes it on update, keeps it on other updates and refuses an unknown code', async () => {
    const db = await d.make();
    const created = await db.activities.create(MEMBER.admin, {
      ActivityName: 'Parish Rosary',
      ActivityDescription: 'Rosary before the 9 AM Mass',
      CategoryID: 3,
      CouncilID: 1,
      form_1728_line: 'FAITH_C',
    });
    expect((await db.activities.get(created.id))!.form_1728_line).toBe('FAITH_C');
    await db.activities.update(MEMBER.admin, created.id, { ActivityDescription: 'Rosary after the 9 AM Mass' });
    expect((await db.activities.get(created.id))!.form_1728_line).toBe('FAITH_C');
    await db.activities.update(MEMBER.admin, created.id, { form_1728_line: 'FAITH_B' });
    expect((await db.activities.get(created.id))!.form_1728_line).toBe('FAITH_B');
    await expectRule(db.activities.update(MEMBER.admin, created.id, { form_1728_line: 'Form 107' }), 'INVALID_INPUT');
  });

  it('keeps the stored line when the Council Lookup Tables save a row without it, and writes it when given', async () => {
    const db = await d.make();
    const before = (await db.lookups.listCouncilSpecific(MEMBER.admin, 1, 'Activities')) as unknown as Record<string, unknown>[];
    const row = before.find((r) => r.ActivityName === 'Ultrasound')!;
    await db.activities.update(MEMBER.admin, row.id as number, { form_1728_line: 'LIFE_A' });
    const { form_1728_line: _line, ...withoutLine } = { ...row, ActivityDescription: 'Ultrasound Initiative support' };
    await db.lookups.saveCouncilSpecific(MEMBER.admin, 1, 'Activities', [withoutLine] as never);
    expect((await db.activities.get(row.id as number))!.form_1728_line).toBe('LIFE_A');
    await db.lookups.saveCouncilSpecific(MEMBER.admin, 1, 'Activities', [{ ...withoutLine, form_1728_line: 'LIFE_G' }] as never);
    expect((await db.activities.get(row.id as number))!.form_1728_line).toBe('LIFE_G');
  });
});

const presentation: [string, () => Promise<DataService>][] = [
  ['memory', async () => {
    const db = new MemoryDataService({ now: () => new Date(NOW), presentationData: true });
    await db.init();
    return db;
  }],
  ['sqlite', async () => {
    openDatabases.length = 0;
    const db = new SqliteDataService({ now: () => new Date(NOW), presentationData: true });
    await db.init();
    return db;
  }],
];

describe('3. seeds', () => {
  it.each(presentation)('seeds the Revision 9.0 portfolio with confirmed lines (%s)', async (_name, create) => {
    const db = await create();
    const lines = Object.fromEntries((await db.activities.listByCouncil(1)).map((a) => [a.ActivityName, a.form_1728_line ?? null]));
    expect(lines['Global Wheelchair Mission']).toBe('COMMUNITY_B');
    expect(lines['Habitat for Humanity Support']).toBe('COMMUNITY_C');
    expect(lines['Special Olympics Staffing']).toBe('LIFE_C');
    expect(lines['Coats for kids']).toBeNull();
  });
});

describe('4. the popup on the activity screens', () => {
  it('confirms the line before saving on the Activities page and in the Admin Desk lookup tables', () => {
    const page = read('apps/web/app/activities/page.tsx');
    expect(page).toContain('useForm1728Confirm()');
    expect(page).toContain('{confirmLine.dialog}');
    expect(page).toContain('Change line');
    expect(page).toContain('form_1728_line');
    const lookups = read('apps/web/components/modules/CouncilLookupTables.tsx');
    expect(lookups).toContain('useForm1728Confirm()');
    expect(lookups).toContain("key: 'form_1728_line'");
    expect(lookups).toContain('FORM_1728_CANCELLED_MESSAGE');
    expect(ADMIN_DESK_DRAWERS.map((d) => d.id)).toContain('council-lookups');
    const parts = read('apps/web/components/Form1728Parts.tsx');
    expect(parts).toContain('export function useForm1728Confirm()');
    expect(parts).toContain('export function needsForm1728Confirmation(');
  });
});

describe('5. five more unified screen names', () => {
  const sidebar = read('apps/web/components/Sidebar.tsx');
  const manuals = ['docs/ADMIN_USER_GUIDE.md', 'docs/EXECUTIVE_GOVERNANCE_MANUAL.md', 'docs/FINANCIAL_SECRETARY_MANUAL.md', 'docs/TREASURER_MANUAL.md', 'docs/MEMBER_USER_GUIDE.md'];

  it('Transaction Ledger names the general ledger link and page', () => {
    expect(sidebar).toContain("'finance/ledger': { href: '/finance/ledger', label: 'Transaction Ledger'");
    expect(read('apps/web/app/finance/ledger/page.tsx')).toContain('Transaction Ledger');
  });

  it('Roster & Achievements names the roster link, page and directory', () => {
    expect(MEMBER_ROSTER_TITLE).toBe('Roster & Achievements');
    expect(sidebar).toContain("roster: { href: '/roster', label: 'Roster & Achievements'");
  });

  it('Chamber Check-In names the PIN drawers and the phone check-in panel', () => {
    const titles = DESK_DRAWERS.filter((d) => d.id === 'meeting-pin').map((d) => d.title);
    expect(titles).toEqual(expect.arrayContaining(['Chamber Check-In', 'Chamber Check-In (Recorder Absent)']));
    const phone = read('apps/mobile/components/GeofenceCheckIn.tsx');
    expect(phone).toContain('accessibilityLabel="Chamber Check-In"');
    expect(phone).toContain('CHAMBER CHECK-IN');
  });

  it('Secure Access Vault names the vault link, page and Admin Desk drawer', () => {
    expect(sidebar).toMatch(/label: 'Secure Access Vault'/);
    expect(read('apps/web/components/modules/CredentialsVaultPanel.tsx')).toContain('<PageTitle>Secure Access Vault</PageTitle>');
    expect(ADMIN_DESK_DRAWERS.find((d) => d.id === 'credentials-vault')!.label).toBe('Secure Access Vault');
  });

  it('Platform Management names the Super Admin desk', () => {
    expect(SUPER_ADMIN_DESK_TITLE).toBe('Platform Management');
  });

  it('drops the old names from the screens, the phone and the manuals', () => {
    const old = /General Ledger Spreadsheet|Member Roster|Credentials Vault|Super Admin Desk|Meeting Check-In PIN|Meeting PIN \(Recorder Absent\)/;
    for (const file of ['apps/web/components/Sidebar.tsx', 'packages/shared/src/desk-drawers.ts', 'packages/shared/src/admin-desk.ts', 'apps/mobile/components/GeofenceCheckIn.tsx', ...manuals])
      expect(read(file), file).not.toMatch(old);
  });
});

describe('6. the Phase 1 compliance report', () => {
  it('records the audit, the licenses and the open findings in the architectural history', () => {
    const history = read('docs/ARCHITECTURAL_HISTORY.md');
    expect(history).toContain('## 10. Phase 1 vetting: dependency compliance and security footprint (Sprint 11 Revision 11.0)');
    expect(history).toContain('| 109 | 11 Revision 11.0 |');
    expect(history).toContain('LGPL-3.0');
    expect(history).toContain('The vetting criterion "zero vulnerabilities" is **not met**');
    expect(JSON.parse(read('apps/web/package.json')).dependencies.next).toBe('~16.4.3');
  });
});

describe('7. the desktop shell after an upgrade', () => {
  it('asks before setting an older vault aside, and never deletes it', () => {
    const main = read('apps/desktop/main.cjs');
    expect(main).toContain('async function ensureVaultVersion(url)');
    expect(main).toContain("db.prepare('PRAGMA user_version')");
    expect(main).toContain("buttons: ['Start a new database', 'Quit']");
    expect(main).toContain('fs.renameSync(dataDir');
    expect(main).not.toMatch(/fs\.rmSync|fs\.unlinkSync/);
  });
});
