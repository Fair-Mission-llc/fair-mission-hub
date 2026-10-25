// Sprint 7H: Council 15295 renamed St. Mary's Cathedral Council (schema version 69), the live console's welcome read from
// the council's elected chairs, the gate window read from shift_signup_lock_hours, the stray root tsconfig.json gone,
// and the on-demand custom user guides (customizeManualMarkdown, /api/council/compile-manual).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assemblyWelcomeLine,
  cleanCustomManualPayload,
  COUNCIL_WIDE_SETTING_DEFAULTS,
  COUNCIL_WIDE_SETTING_NAMES,
  COUNCIL_WIDE_SETTING_RULES,
  CUSTOM_MANUAL_KINDS,
  CUSTOM_MANUAL_SOURCES,
  customizeManualMarkdown,
  customManualFileName,
  MANUAL_SETTING_PHRASES,
  mayCompileCustomManual,
  type MemberWriteActor,
} from '@kofc/shared';
import { drivers } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const COUNCIL = { id: 1, number: 15295, name: "St. Mary's Cathedral Council" };
const seat = (roleName: string, firstName: string, lastName: string) => ({ roleName, holder: { memberId: 1, firstName, lastName, since: null } });

describe('schema version 69', () => {
  it('renames Council 15295 and bumps the phone database', () => {
    expect(read('Seed.sql')).toContain("VALUES (15295, 'St. Mary''s Cathedral Council',");
    expect(read('Seed.sql')).not.toContain("'St. Jude Council'");
    expect(read('Schema.sql')).toContain('(schema version 69)');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (69|[7-9]\d|\d{3});/);
  });

  // Sprint 8R: Expo tooling keeps writing a root tsconfig.json stub ({ "extends": "expo/tsconfig.base" }). It is ignored
  // by git (.gitignore '/tsconfig.json'), so it can never be committed, and a local copy no longer fails the suite.
  it('keeps the stray root tsconfig.json out of the repository', () => {
    expect(read('.gitignore').split(/\r?\n/).map((l) => l.trim())).toContain('/tsconfig.json');
    const path = join(__dirname, '..', 'tsconfig.json');
    if (existsSync(path)) {
      // A local file is tolerated only as the Expo stub, never as a real project config.
      const stub = JSON.parse(readFileSync(path, 'utf8')) as { extends?: string; compilerOptions?: Record<string, unknown>; include?: unknown };
      expect(stub.extends).toBe('expo/tsconfig.base');
      expect(Object.keys(stub.compilerOptions ?? {})).toEqual([]);
      expect(stub.include).toBeUndefined();
    }
  });
});

describe.each(drivers)('$name driver: the renamed council', (d) => {
  it("seeds Council 15295 as St. Mary's Cathedral Council", async () => {
    const db = await d.make();
    expect((await db.councils.list()).find((c) => c.CouncilNumber === 15295)?.CouncilName).toBe("St. Mary's Cathedral Council");
  });
});

describe('live console welcome', () => {
  it("names the held elected chairs in office order, then the council", () => {
    const line = assemblyWelcomeLine({ CouncilNumber: 15295, CouncilName: "St. Mary's Cathedral Council" }, [
      seat('Trustee 1', 'Hector', 'Ruiz'),
      seat('Deputy Grand Knight', 'David', 'Lee'),
      seat('Grand Knight', 'Tom', 'Burke'),
      { roleName: 'Chancellor', holder: null },
    ]);
    expect(line).toBe(
      "Welcome Worthy Grand Knight Tom Burke, and Worthy Deputy Grand Knight David Lee! St. Mary's Cathedral Council 15295 Assembly Console is Fully Operational.",
    );
  });

  it('reads one chair, or none', () => {
    const council = { CouncilNumber: 4511, CouncilName: 'Salem Council' };
    expect(assemblyWelcomeLine(council, [seat('Grand Knight', 'Ann', 'Ray')])).toBe('Welcome Worthy Grand Knight Ann Ray! Salem Council 4511 Assembly Console is Fully Operational.');
    expect(assemblyWelcomeLine(council, [])).toBe('Welcome, Brother Knights! Salem Council 4511 Assembly Console is Fully Operational.');
  });

  it('has no fixed names left in the console', () => {
    const page = read('apps/web/app/meetings/live/page.tsx');
    expect(page).not.toMatch(/DEMO_ROSTER_WELCOME|St\. Jude|Tom|Hector/);
    expect(page).toContain('db.elections.listOfficerSeats(councilId)');
    expect(page).toContain('assemblyWelcomeLine(council, seats)');
  });
});

describe('gate window setting', () => {
  it('is in use, and the phone reads it', () => {
    expect(COUNCIL_WIDE_SETTING_RULES.shift_signup_lock_hours.inUse).toBe(true);
    const donate = read('apps/mobile/app/(app)/donate.tsx');
    expect(donate).toContain('councilWideSettings(council).shift_signup_lock_hours');
    expect(donate).toContain('isEventAtGate(e, shifts[i], now, leadHours)');
    expect(read('packages/shared/src/calendar.ts')).not.toContain('GATE_LEAD_HOURS =');
  });
});

describe('custom user guides', () => {
  // Sprint 9 Revision 7.1: the three role manuals print too.
  const guides = Object.fromEntries(CUSTOM_MANUAL_KINDS.map((k) => [k, read(CUSTOM_MANUAL_SOURCES[k].source)])) as Record<(typeof CUSTOM_MANUAL_KINDS)[number], string>;
  const custom = {
    ...COUNCIL_WIDE_SETTING_DEFAULTS,
    volunteer_logging_window_days: 120,
    er_submission_window_days: 45,
    shift_signup_lock_hours: 3.5,
    inactivity_threshold_days: 400,
    reminder_delay_days: 4,
    reminder_cadence_days: 10,
    max_shift_padding_hours: 0.5,
  };

  it('finds every phrase it rewrites in its guide, so a guide edit cannot silently drop one', () => {
    for (const phrase of MANUAL_SETTING_PHRASES) expect(guides[phrase.guide], `${phrase.guide}: ${phrase.find}`).toContain(phrase.find);
  });

  it("lists every setting's on-screen label in the Administrator guide's settings tables", () => {
    for (const name of COUNCIL_WIDE_SETTING_NAMES) expect(guides.admin, name).toContain(`| **${COUNCIL_WIDE_SETTING_RULES[name].label}** |`);
  });

  it("prints the council's numbers in the Member guide", () => {
    const out = customizeManualMarkdown('member', guides.member, COUNCIL, custom, '2026-10-11');
    expect(out).toContain("> **Printed for St. Mary's Cathedral Council 15295 on 2026-10-11.**");
    expect(out).toContain('| Dates up to 120 days before today |');
    expect(out).toContain('From the event start to 45 days after the event ends, inside the 120-day window');
    expect(out).toContain('Wait until 3.5 hours before the first shift.');
    expect(out).toContain('The first reminder goes out 4 days after the shift.');
    expect(out).toContain('A new reminder goes out every 10 days.');
    expect(out).not.toContain('(90 days by default)');
    expect(out).not.toContain('The 30-day');
    // the summary sits before the contents
    expect(out.indexOf('Council Wide Settings\n')).toBeLessThan(out.indexOf('## Contents'));
    expect(out).toContain('| Hours before an event that gate donations open | **3.5 hours** | 2 hours | Yes |');
  });

  it("shows the council's value beside each default in the Administrator guide", () => {
    const out = customizeManualMarkdown('admin', guides.admin, COUNCIL, custom, '2026-10-11');
    expect(out).toContain('| **Days back a member may log volunteer time** | 90 days (this council: **120 days**) |');
    expect(out).toContain('| **Hours before an event that gate donations open** | 2 hours (this council: **3.5 hours**) |');
    expect(out).toContain("This council's window is 120 days (section 8.3)");
    expect(out).not.toContain('90 days by default');
  });

  it("prints the council's numbers in the role manuals", () => {
    const executive = customizeManualMarkdown('executive', guides.executive, COUNCIL, custom, '2026-10-11');
    expect(executive).toContain('The 1.0 hour is the default; this council allows 0.5 hours.');
    expect(executive).toContain('| **Days back a member may log volunteer time** | 90 days (this council: **120 days**) |');
    expect(executive).not.toContain('90 days by default');
    expect(customizeManualMarkdown('financial-secretary', guides['financial-secretary'], COUNCIL, custom, '2026-10-11')).toContain('The default is 365 days; this council uses 400 days.');
    const treasurer = customizeManualMarkdown('treasurer', guides.treasurer, COUNCIL, custom, '2026-10-11');
    expect(treasurer.indexOf('Council Wide Settings')).toBeLessThan(treasurer.indexOf('## Contents'));
    expect(customManualFileName('executive', 15295)).toBe('Executive_Governance_Manual_Council_15295.pdf');
  });

  it('leaves the guide as written apart from the summary when the council keeps the defaults', () => {
    const out = customizeManualMarkdown('member', guides.member, COUNCIL, { ...COUNCIL_WIDE_SETTING_DEFAULTS }, '2026-10-11');
    expect(out).toContain('| Dates up to 90 days before today |');
    expect(out).toContain('Wait until 2 hours before the first shift.');
  });

  it('checks the posted payload', () => {
    const ok = { guide: 'admin', council: COUNCIL, settings: { er_submission_window_days: 45 } };
    expect(cleanCustomManualPayload(ok)).toEqual({ guide: 'admin', council: COUNCIL, settings: { ...COUNCIL_WIDE_SETTING_DEFAULTS, er_submission_window_days: 45 } });
    expect(cleanCustomManualPayload({ ...ok, guide: 'treasurer' }).guide).toBe('treasurer');
    expect(() => cleanCustomManualPayload({ ...ok, guide: 'recorder' })).toThrow(/Choose the guide/);
    expect(() => cleanCustomManualPayload({ ...ok, council: { ...COUNCIL, id: 0 } })).toThrow(/council by its id/);
    expect(() => cleanCustomManualPayload({ ...ok, council: { ...COUNCIL, name: 'Two\nlines' } })).toThrow(/council name/);
    expect(() => cleanCustomManualPayload({ ...ok, settings: { er_submission_window_days: 9999 } })).toThrow();
    expect(() => cleanCustomManualPayload({ ...ok, settings: { bogus: 1 } })).toThrow(/Unknown council setting/);
    expect(customManualFileName('member', 15295)).toBe('Member_User_Guide_Council_15295.pdf');
  });

  it("admits the settings page's audience only", () => {
    const actor = (memberType: string, officer: boolean, councilId = 1): MemberWriteActor => ({ memberId: 9, councilId, memberType, active: true, officer });
    expect(mayCompileCustomManual(actor('Admin', false), 1)).toBe(true);
    expect(mayCompileCustomManual(actor('Member', true), 1)).toBe(true);
    expect(mayCompileCustomManual(actor('Super Admin', false, 2), 1)).toBe(true);
    expect(mayCompileCustomManual(actor('Member', false), 1)).toBe(false);
    expect(mayCompileCustomManual(actor('Admin', false, 2), 1)).toBe(false);
  });

  it('ships the route, the buttons and the script options', () => {
    const route = read('apps/web/app/api/council/compile-manual/route.ts');
    expect(route).toContain('mayCompileCustomManual(session.actor, payload.council.id)');
    expect(route).toContain("'compile_all_manuals.py'");
    expect(route).toContain('runPythonScript(');
    const page = read('apps/web/app/system-settings/council-settings/page.tsx');
    expect(page).toContain('📥 Generate Custom ${label} PDF');
    for (const kind of CUSTOM_MANUAL_KINDS) expect(page).toContain(`{ guide: '${kind}', label: `);
    expect(read('scripts/compile_all_manuals.py')).toContain("key='financial-secretary'");
    const script = read('scripts/compile_all_manuals.py');
    for (const flag of ['--input', '--output', '--base', '--prepared-for']) expect(script).toContain(`'${flag}'`);
  });
});
