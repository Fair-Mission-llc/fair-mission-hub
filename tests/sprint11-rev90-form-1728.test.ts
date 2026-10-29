// Sprint 11 Revision 9.0: the Form 1728 interrogation engine, Council 15295's Form 1728 activity portfolio and its
// seeded lightweight scope.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  classifyForm1728,
  compileSupremeSnapshot,
  COUNCIL_15295_SEED_FLAGS,
  COUNCIL_15295_SEED_OFF_FLAGS,
  councilFeatureFlags,
  FORM_1728_DEFAULT_LINE,
  FORM_1728_LINES,
  form1728LineLabel,
  form1728YearToDate,
  supremeReportingPeriod,
  tallyForm1728,
  type DataService,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { NOW } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const read = (path: string) => readFileSync(path, 'utf8');

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

describe('1. the interrogation engine', () => {
  it.each([
    ['Coats For Kids', 'COMMUNITY_A'],
    ['Coats for kids', 'COMMUNITY_A'],
    ['Winter coat drive at St. Mary', 'COMMUNITY_A'],
    ['Global Wheelchair Mission', 'COMMUNITY_B'],
    ['Wheelchair delivery day', 'COMMUNITY_B'],
    ['Habitat for Humanity Support', 'COMMUNITY_C'],
    ['Saturday house build', 'COMMUNITY_C'],
    ['House building with Habitat', 'COMMUNITY_C'],
    ["Veterans' Day breakfast", 'COMMUNITY_M'],
    ['Care packages for deployed troops', 'COMMUNITY_M'],
    ['VA Hospital visit', 'COMMUNITY_M'],
    ['Special Olympics Staffing', 'LIFE_C'],
    ['Special Olympics', 'LIFE_C'],
  ])('files %s to %s', (title, code) => {
    expect(classifyForm1728(title).code).toBe(code);
  });

  it('files vague titles to Community line N, Miscellaneous Community Activities', () => {
    for (const title of ['Socials', 'Planning', 'Greeting', 'Parish picnic', '', '   ', '!!!']) {
      const line = classifyForm1728(title);
      expect(line).toMatchObject({ code: FORM_1728_DEFAULT_LINE, section: 'Community', line: 'N', confidence: 'default', cues: [] });
    }
    expect(FORM_1728_DEFAULT_LINE).toBe('COMMUNITY_N');
  });

  it('matches whole words only, so a stray word does not refile a record', () => {
    expect(classifyForm1728('Floor coating project').code).toBe('COMMUNITY_N');
    expect(classifyForm1728('Kids movie night').code).toBe('COMMUNITY_N');
  });

  it('reads the description at half weight, and the title wins a contest', () => {
    expect(classifyForm1728('Saturday drive', 'Collecting winter coats for children').code).toBe('COMMUNITY_A');
    expect(classifyForm1728('Global Wheelchair Mission', 'Raised at the coat check').code).toBe('COMMUNITY_B');
  });

  it('reports its score, confidence and the cues it read', () => {
    const line = classifyForm1728('Global Wheelchair Mission');
    expect(line.confidence).toBe('strong');
    expect(line.cues[0]).toBe('global wheelchair mission');
    expect(form1728LineLabel(line)).toBe('Community line B - Global Wheelchair Mission');
  });

  it('keeps the line catalog unique and in report order', () => {
    const codes = FORM_1728_LINES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const l of FORM_1728_LINES) expect(l.code).toBe(`${l.section.toUpperCase()}_${l.line}`);
  });
});

describe('2. tallies', () => {
  it('totals hours, entries and volunteers per line inside the span, in report order', () => {
    const lines = tallyForm1728(
      [
        { title: 'Special Olympics Staffing', date: '2026-06-06', hours: 4, memberId: 1 },
        { title: 'Coats for kids', date: '2026-01-17', hours: 3, memberId: 1 },
        { title: 'Coats for kids', date: '2026-02-07', hours: 2.5, memberId: 2 },
        { title: 'Socials', date: '2026-03-01', hours: 1, memberId: 3 },
        { title: 'Coats for kids', date: '2025-12-31', hours: 9, memberId: 4 },
      ],
      '2026-01-01',
      '2026-12-31',
    );
    expect(lines.map((l) => [l.code, l.hours, l.entries, l.volunteers])).toEqual([
      ['COMMUNITY_A', 5.5, 2, 2],
      ['COMMUNITY_N', 1, 1, 1],
      ['LIFE_C', 4, 1, 1],
    ]);
  });

  it('names the calendar year to date', () => {
    expect(form1728YearToDate(NOW)).toEqual({ fromDate: '2026-01-01', toDate: '2026-09-20' });
  });

  it('adds the Form 1728 lines to the Supreme snapshot, read from each title', () => {
    const snapshot = compileSupremeSnapshot('AnnualSurvey', supremeReportingPeriod('AnnualSurvey', NOW), {
      council: { id: 1, CouncilNumber: 15295, CouncilName: "St. Mary's Cathedral" },
      eventTime: [{ MemberID: 1, Hours: 2, category: 'Service', title: 'Veterans Day Honor Guard' }],
      activityTime: [
        { MemberID: 2, Hours: 3, category: 'Service', title: 'Habitat for Humanity Support' },
        { MemberID: 3, Hours: 1.25, category: 'Fellowship' },
      ],
      events: [],
      eventExpenseItems: [],
      donations: [],
      disbursements: [],
    });
    expect(snapshot.form1728Lines.map((l) => [l.code, l.hours])).toEqual([
      ['COMMUNITY_C', 3],
      ['COMMUNITY_M', 2],
      ['COMMUNITY_N', 1.25],
    ]);
  });
});

describe('3. Council 15295 seeds', () => {
  it.each(presentation)('carries the four Form 1728 activities with 2026 hours on each line (%s)', async (_name, create) => {
    const db = await create();
    const activities = await db.activities.listByCouncil(1);
    const portfolio = ['Coats for kids', 'Global Wheelchair Mission', 'Habitat for Humanity Support', 'Special Olympics Staffing'];
    const chosen = portfolio.map((name) => activities.find((a) => a.ActivityName === name)!);
    expect(chosen.every(Boolean)).toBe(true);
    expect(chosen.map((a) => classifyForm1728(a.ActivityName, a.ActivityDescription).code)).toEqual(['COMMUNITY_A', 'COMMUNITY_B', 'COMMUNITY_C', 'LIFE_C']);
    expect(chosen.find((a) => a.ActivityName === 'Special Olympics Staffing')!.CategoryID).toBe(7);

    const logs = await Promise.all(chosen.map((a) => db.activityTime.listByActivity(a.id)));
    const span = form1728YearToDate(NOW);
    const lines = tallyForm1728(
      logs.flatMap((log) => log.entries.map((e) => ({ title: log.activity.ActivityName, date: e.row.ActivityDate, hours: e.row.Hours, memberId: e.row.MemberID }))),
      span.fromDate,
      span.toDate,
    );
    expect(Object.fromEntries(lines.map((l) => [l.code, l.hours]))).toEqual({ COMMUNITY_A: 9.5, COMMUNITY_B: 12, COMMUNITY_C: 16.5, LIFE_C: 11.25 });
  });

  it.each(presentation)('starts Council 15295 with the eight premium switches off (%s)', async (_name, create) => {
    const db = await create();
    const flags = councilFeatureFlags(await db.councils.get(1));
    expect(flags).toEqual(COUNCIL_15295_SEED_FLAGS);
    for (const name of COUNCIL_15295_SEED_OFF_FLAGS) expect(flags[name]).toBe(false);
  });

  it('writes the switches into the baseline council row of Seed.sql', () => {
    const seed = read('Seed.sql');
    const insert = seed.slice(seed.indexOf('INSERT INTO [Council] ([CouncilNumber]'), seed.indexOf("'kofc15295@gmail.com'") + 60);
    for (const name of COUNCIL_15295_SEED_OFF_FLAGS) expect(insert).toContain(`[${name}]`);
  });
});

describe('4. screens', () => {
  it('shows the line on the activity and event screens and the Supreme sync audit', () => {
    expect(read('apps/web/app/activities/page.tsx')).toContain('<Form1728YearToDatePanel');
    expect(read('apps/web/app/activities/page.tsx')).toContain('<Form1728Badge');
    expect(read('apps/web/app/events/page.tsx')).toContain('<Form1728Preview');
    expect(read('apps/web/app/supreme-sync/page.tsx')).toContain('snapshot.form1728Lines');
  });
});
