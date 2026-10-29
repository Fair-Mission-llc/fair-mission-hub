// Sprint 11 Revision 10.0 (schema 108): the unified Form 1728 matrix and its suggestion popup, Event.form_1728_line, the
// six standard screen names, the Super Admin-only Admin designation and the Electron desktop packaging.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  classifyForm1728,
  cleanForm1728LineCode,
  compileSupremeSnapshot,
  FEATURE_FLAG_LABELS,
  FORM_1728_LINES,
  FORM_1728_SECTIONS,
  grantableMemberTypes,
  OPERATIONS_KNOWLEDGE_ARCHIVE_TITLE,
  PLATFORM_SCHEMA_VERSION,
  resolveForm1728Line,
  searchForm1728Lines,
  STANDARD_SCREEN_NAMES,
  suggestForm1728Lines,
  supremeReportingPeriod,
  DESK_DRAWERS,
  type NewEvent,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER, NOW } from './helpers';

const read = (path: string) => readFileSync(path, 'utf8');

describe('1. the unified Form 1728 matrix', () => {
  it('covers Faith A-G, Family A-F, Community A-N and Life A-G, in report order', () => {
    const letters = (section: string) => FORM_1728_LINES.filter((l) => l.section === section).map((l) => l.line).join('');
    expect(letters('Faith')).toBe('ABCDEFG');
    expect(letters('Family')).toBe('ABCDEF');
    expect(letters('Community')).toBe('ABCDEFGHIJKLMN');
    expect(letters('Life')).toBe('ABCDEFG');
    expect(FORM_1728_LINES).toHaveLength(34);
    expect(FORM_1728_SECTIONS).toEqual(['Faith', 'Family', 'Community', 'Life']);
    expect([...new Set(FORM_1728_LINES.map((l) => l.section))]).toEqual(FORM_1728_SECTIONS);
  });

  it('keeps the Revision 9.0 lines where the user put them', () => {
    expect(classifyForm1728('Coats For Kids').code).toBe('COMMUNITY_A');
    expect(classifyForm1728('Global Wheelchair Mission').code).toBe('COMMUNITY_B');
    expect(classifyForm1728('Habitat for Humanity Support').code).toBe('COMMUNITY_C');
    expect(classifyForm1728('Veterans Day breakfast').code).toBe('COMMUNITY_M');
    expect(classifyForm1728('Special Olympics Staffing').code).toBe('LIFE_C');
    expect(classifyForm1728('Socials').code).toBe('COMMUNITY_N');
  });

  it.each([
    ['First Friday Holy Hour', 'FAITH_B'],
    ['Parish Rosary night', 'FAITH_C'],
    ['Into the Breach study', 'FAITH_A'],
    ['Seminarian dinner', 'FAITH_F'],
    ['Keep Christ in Christmas cards', 'FAITH_G'],
    ['Food drive', 'FAMILY_A'],
    ['Family of the Month award', 'FAMILY_C'],
    ['Good Friday stations', 'FAMILY_F'],
    ['Hurricane relief collection', 'COMMUNITY_D'],
    ['Free Throw Championship', 'COMMUNITY_G'],
    ['Red Cross blood drive', 'COMMUNITY_I'],
    ['Poop/Garbage patrol', 'COMMUNITY_J'],
    ['Transporting', 'COMMUNITY_K'],
    ['Squires meeting', 'COMMUNITY_L'],
    ['Ultrasound', 'LIFE_A'],
    ['March for Life bus trip', 'LIFE_B'],
    ['Silver Rose run', 'LIFE_F'],
  ])('files %s to %s', (title, code) => {
    expect(classifyForm1728(title).code).toBe(code);
  });

  it("lets the category's mission area tip a close call (the second engine), but never file a vague title", () => {
    // 'Youth basketball': Community L (youth 3) beats Community G (basketball 2) on the title alone.
    expect(classifyForm1728('Youth basketball').code).toBe('COMMUNITY_L');
    // A cue in another section gains nothing: Holy Hour stays Faith under a Community category.
    expect(classifyForm1728('Holy Hour', null, { missionArea: 'Community' }).code).toBe('FAITH_B');
    // 'Mother and daughter tea': 'mother' (1.5) alone is below the bar, plus 1 under a Life category clears it.
    expect(classifyForm1728('Mother and daughter tea').code).toBe('COMMUNITY_N');
    expect(classifyForm1728('Mother and daughter tea', null, { missionArea: 'Life' }).code).toBe('LIFE_E');
    expect(classifyForm1728('Parish picnic', null, { missionArea: 'Faith' }).code).toBe('COMMUNITY_N');
  });

  it('offers the best guess first, the runners-up, then Community N', () => {
    const s = suggestForm1728Lines('Youth soccer and basketball day');
    expect(s[0].code).toBe('COMMUNITY_H');
    expect(s.map((l) => l.code)).toContain('COMMUNITY_L');
    expect(s.at(-1)!.code).toBe('COMMUNITY_N');
    expect(suggestForm1728Lines('Socials').map((l) => l.code)).toEqual(['COMMUNITY_N']);
  });

  it('searches every line by section, letter, label or code', () => {
    expect(searchForm1728Lines('rosary').map((l) => l.code)).toEqual(['FAITH_C']);
    expect(searchForm1728Lines('life').length).toBeGreaterThanOrEqual(7);
    expect(searchForm1728Lines('community line n').map((l) => l.code)).toEqual(['COMMUNITY_N']);
    expect(searchForm1728Lines('')).toHaveLength(34);
  });

  it('validates a stored code and prefers it over the title', () => {
    expect(cleanForm1728LineCode('life_c')).toBe('LIFE_C');
    expect(cleanForm1728LineCode(null)).toBeNull();
    for (const bad of ['', 'COMMUNITY_Z', 'Form 107', 42]) expect(() => cleanForm1728LineCode(bad)).toThrow();
    expect(resolveForm1728Line('FAITH_C', 'Coats for kids')).toMatchObject({ code: 'FAITH_C', confirmed: true });
    expect(resolveForm1728Line(null, 'Coats for kids')).toMatchObject({ code: 'COMMUNITY_A', confirmed: false });
  });

  it('counts an event under its confirmed line in the Supreme snapshot', () => {
    const snapshot = compileSupremeSnapshot('AnnualSurvey', supremeReportingPeriod('AnnualSurvey', NOW), {
      council: { id: 1, CouncilNumber: 15295, CouncilName: "St. Mary's Cathedral" },
      eventTime: [
        { MemberID: 1, Hours: 2, category: 'Service', title: 'Saturday service day', line: 'COMMUNITY_E' },
        { MemberID: 2, Hours: 1, category: 'Service', title: 'Saturday service day' },
      ],
      activityTime: [],
      events: [],
      eventExpenseItems: [],
      donations: [],
      disbursements: [],
    });
    expect(snapshot.form1728Lines.map((l) => [l.code, l.hours])).toEqual([
      ['COMMUNITY_E', 2],
      ['COMMUNITY_N', 1],
    ]);
  });
});

describe.each(drivers)('2. Event.form_1728_line ($name driver)', (d) => {
  const draft = (line?: string | null): NewEvent => ({
    EventName: 'Saturday service day',
    EventDescription: 'Help around town',
    OwnerID: MEMBER.admin,
    StartDate: '2026-11-14',
    EndDate: '2026-11-14',
    Location: 'Parish Hall',
    CategoryID: 2,
    ...(line === undefined ? {} : { form_1728_line: line }),
  });

  it('stores the confirmed line on create, changes and clears it on update, and refuses an unknown code', async () => {
    const db = await d.make();
    const created = await db.events.create(draft('COMMUNITY_E'), [1]);
    expect((await db.events.get(created.id))!.form_1728_line).toBe('COMMUNITY_E');
    await db.events.update(created.id, { form_1728_line: 'family_e' });
    expect((await db.events.get(created.id))!.form_1728_line).toBe('FAMILY_E');
    await db.events.update(created.id, { form_1728_line: null });
    expect((await db.events.get(created.id))!.form_1728_line ?? null).toBeNull();
    await expectRule(db.events.create(draft('COMMUNITY_Z'), [1]), 'INVALID_INPUT');
    await expectRule(db.events.update(created.id, { form_1728_line: 'Form 107' }), 'INVALID_INPUT');
  });

  it('leaves the line empty when none is given', async () => {
    const db = await d.make();
    const created = await db.events.create(draft(), [1]);
    expect((await db.events.get(created.id))!.form_1728_line ?? null).toBeNull();
  });
});

describe('3. schema 108', () => {
  it('adds Event.form_1728_line and moves both drivers to version 108', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBeGreaterThanOrEqual(108); // 109 since Revision 11.0
    expect(read('Schema.sql')).toContain('ALTER TABLE [Event] ADD [form_1728_line] VARCHAR(20) NULL;');
    expect(read('Schema.sql')).toContain('(schema version 108)');
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toContain(' * 108: Event.form_1728_line');
    expect(read('data_dictionary.md')).toContain('form_1728_line (VARCHAR(20), NULL)');
  });

  it('opens the suggestion popup from the event form and saves the pick', () => {
    const page = read('apps/web/app/events/page.tsx');
    expect(page).toContain('<Form1728SuggestionDialog');
    expect(page).toContain('form_1728_line: form1728Line');
    const parts = read('apps/web/components/Form1728Parts.tsx');
    expect(parts).toContain('suggestForm1728Lines(');
    expect(parts).toContain('searchForm1728Lines(');
    expect(parts).toContain('showModal()');
  });
});

describe('4. the six standard screen names', () => {
  const sidebar = read('apps/web/components/Sidebar.tsx');

  it('names each in the sidebar, on its page and on its feature switch', () => {
    const pages: Record<keyof typeof STANDARD_SCREEN_NAMES, string> = {
      gallery: 'packages/shared/src/media-vault.ts',
      'system-settings/knowledge-archive': 'apps/web/components/modules/KnowledgeArchive.tsx',
      'resources/marketing': 'apps/web/app/resources/marketing/page.tsx',
      'inventory/loaner-library': 'apps/web/app/inventory/loaner-library/page.tsx',
      'finance/audit': 'apps/web/components/modules/TrusteeAuditDesk.tsx',
      history: 'apps/web/app/history/page.tsx',
    };
    for (const [area, name] of Object.entries(STANDARD_SCREEN_NAMES) as [keyof typeof STANDARD_SCREEN_NAMES, string][]) {
      expect(read(pages[area]), area).toContain(name);
      if (area !== 'gallery') expect(sidebar, area).toMatch(new RegExp(`'?${area.replace('/', '\\/')}'?: \\{[^}]*label: '${name.replace('&', '&')}'`));
    }
    expect(OPERATIONS_KNOWLEDGE_ARCHIVE_TITLE).toBe('Operations Knowledge Vault');
    expect(FEATURE_FLAG_LABELS.feature_photo_gallery.label).toBe('Media & Memory Center');
    expect(FEATURE_FLAG_LABELS.feature_marketing_factory.label).toBe('Recruitment Factory');
    expect(FEATURE_FLAG_LABELS.feature_loaner_library.label).toBe('Shared Equipment Library');
    expect(FEATURE_FLAG_LABELS.feature_advanced_audits.label).toBe('Financial Inspections');
    expect(FEATURE_FLAG_LABELS.feature_council_history.label).toBe('Historical Chronology');
  });

  it('uses the same names on the officer desk drawers', () => {
    const titles = DESK_DRAWERS.map((d) => d.title);
    expect(titles).toContain('Shared Equipment Library');
    expect(titles).toContain('Financial Inspections');
    expect(titles).toContain('Operations Knowledge Vault');
  });

  it('drops the old names from the screens and the manuals', () => {
    const old = /Cross-Council Loaner Library|Shared Loaner Library|Operations Knowledge Archive|Marketing Factory|Council Photo Gallery|Council History & Archive Vault|Semiannual Audit Form 1295 Center/;
    for (const file of [
      'apps/web/components/Sidebar.tsx',
      'packages/shared/src/desk-drawers.ts',
      'packages/shared/src/features.ts',
      'docs/ADMIN_USER_GUIDE.md',
      'docs/EXECUTIVE_GOVERNANCE_MANUAL.md',
      'docs/FINANCIAL_SECRETARY_MANUAL.md',
      'docs/TREASURER_MANUAL.md',
      'docs/MEMBER_USER_GUIDE.md',
    ])
      expect(read(file), file).not.toMatch(old);
  });
});

describe('5. only a Super Admin designates council Admins', () => {
  it('hides the Admin choice from council Admins on the member form', () => {
    const admin = { memberId: 2, councilId: 1, memberType: 'Admin' as const, roles: [], isOfficer: false };
    const superAdmin = { ...admin, memberId: 1, memberType: 'Super Admin' as const };
    expect(grantableMemberTypes(admin)).toEqual(['Member']);
    expect(grantableMemberTypes(admin, 'Admin')).toEqual([]);
    expect(grantableMemberTypes(superAdmin)).toContain('Admin');
  });
});

describe('6. the desktop executable', () => {
  it('wires npm run build:exe to the gated build and electron-builder', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['build:exe']).toBe('node scripts/build-exe.mjs');
    expect(Object.keys(pkg.devDependencies)).toEqual(expect.arrayContaining(['electron', 'electron-builder']));
    const script = read('scripts/build-exe.mjs');
    for (const gate of ["'run', 'typecheck'", "'gen-db-assets.mjs'), '--check'", "KOFC_DESKTOP_BUILD: '1'", "NEXT_PUBLIC_DATA_DRIVER: 'hub'", 'electron-builder.json'])
      expect(script).toContain(gate);
  });

  it('packages the standalone portal and the Electron shell', () => {
    const config = JSON.parse(read('electron-builder.json'));
    expect(config.extraMetadata.main).toBe('apps/desktop/main.cjs');
    expect(config.extraResources[0]).toMatchObject({ from: 'apps/web/.next/standalone', to: 'portal' });
    expect(config.afterPack).toBe('apps/desktop/after-pack.cjs');
    expect(config.win.target[0].target).toBe('portable');
    expect(read('apps/web/next.config.ts')).toContain("process.env.KOFC_DESKTOP_BUILD === '1' ? { output: 'standalone' as const } : {}");
    expect(read('.gitignore')).toContain('/dist-desktop/');
  });

  it('runs the portal on the loopback address only, with the vault in the user-data folder', () => {
    const main = read('apps/desktop/main.cjs');
    expect(main).toContain("const HOST = '127.0.0.1';");
    expect(main).toContain("ELECTRON_RUN_AS_NODE: '1'");
    expect(main).toContain('HUB_VAULT_DIR: dataDir');
    expect(main).toContain("path.join(app.getPath('userData'), 'vault')");
    expect(main).toContain('nodeIntegration: false');
    expect(main).toContain('shell.openExternal');
  });
});
