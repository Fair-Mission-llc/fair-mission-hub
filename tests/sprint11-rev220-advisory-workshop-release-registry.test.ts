// Sprint 11 Revision 22.0 (schema 113, no table change): the Idea vs. Feature lifecycle with threaded comments, the
// Release Registry (execute builds the change list from released features and the release commit manifest), the What's
// New notice, the Platform Calendar month grid, the six core SOP modules, and the checks that the Revision 21.7 layout
// (multi-tenant seed, feature grid, Council History, Admin Desk rail) and the training profiles stay in place.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADVISORY_PANEL_VIEWS,
  ADVISORY_ROADMAP,
  aggregateReleaseChange,
  assertLifecycleEdit,
  assertRateable,
  assertVersionIncrement,
  buildFeatureList,
  calendarMonthGrid,
  CLIENT_RELEASE_VERSION,
  cleanReleaseBlock,
  convertIdeaFields,
  HUB_ACTOR_FIRST_METHODS,
  isViewAsReadMethod,
  latestRelease,
  parseMarkdown,
  platformCalendar,
  PLATFORM_SCHEMA_VERSION,
  RELEASE_COMMIT_LOG,
  shiftMonth,
  shouldShowWhatsNew,
  TRAINING_PASSWORD,
  TRAINING_PROFILES,
  WORKSHOP_TOPIC,
  workshopRowTarget,
  type AdvisoryFeedback,
  type ReleaseCommit,
} from '@kofc/shared';
import { parseGitLog } from '../scripts/gen-release-log.mjs';
import { drivers, expectRule, MEMBER, NOW } from './helpers';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const row = (id: number, member: number, topic: string, body: string): AdvisoryFeedback => ({
  id,
  member_id: member,
  council_id: 1,
  topic,
  body,
  submitted_at: `2026-11-01 12:00:${String(id).padStart(2, '0')}`,
});
const entry = (title: string, status = 'Planned') => JSON.stringify({ title, target_date: null, status, notes: null });
const names = (id: number) => ({ name: `M${id}`, councilLabel: 'C' });

describe('0. the schema stays at 113 and the build is 11.22.0', () => {
  it('keeps PLATFORM_SCHEMA_VERSION at 113', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(113);
    expect(CLIENT_RELEASE_VERSION).toBe('11.22.0');
  });
});

describe('1. the Idea vs. Feature lifecycle (pure)', () => {
  it('ranks features only; ideas carry no rating and no rank', () => {
    const rows = [
      row(1, 1, WORKSHOP_TOPIC.entry, entry('Feature A')),
      row(2, 3, WORKSHOP_TOPIC.entry, entry('Idea B', 'Idea')),
      row(3, 1, WORKSHOP_TOPIC.entry, entry('Feature C')),
      row(4, 3, WORKSHOP_TOPIC.rating(3), '5'),
      row(5, 3, WORKSHOP_TOPIC.rating(2), '5'), // a stray rating on an idea counts for nothing
    ];
    const list = buildFeatureList(rows, 3, names);
    expect(list.map((e) => [e.title, e.lifecycle, e.priorityRank, e.ratingCount, e.myRating])).toEqual([
      ['Feature C', 'feature', 1, 1, 5],
      ['Feature A', 'feature', 2, 0, null],
      ['Idea B', 'idea', null, 0, null],
    ]);
  });

  it('nests replies under their parent comment', () => {
    const rows = [
      row(1, 1, WORKSHOP_TOPIC.entry, entry('Idea', 'Idea')),
      row(2, 3, WORKSHOP_TOPIC.comment(1), 'Top'),
      row(3, 4, WORKSHOP_TOPIC.reply(1, 2), 'Answer'),
      row(4, 3, WORKSHOP_TOPIC.reply(1, 3), 'Answer to the answer'),
      row(5, 4, WORKSHOP_TOPIC.reply(1, 999), 'Orphan'),
    ];
    const [idea] = buildFeatureList(rows, 3, names);
    expect(idea!.commentCount).toBe(4);
    expect(idea!.comments.map((c) => c.body)).toEqual(['Top', 'Orphan']);
    expect(idea!.comments[0]!.replies[0]!.body).toBe('Answer');
    expect(idea!.comments[0]!.replies[0]!.replies[0]).toMatchObject({ body: 'Answer to the answer', parentId: 3 });
    expect(workshopRowTarget('[ffl:comment:7:9]')).toEqual({ kind: 'comment', entryId: 7, parentId: 9 });
    expect(workshopRowTarget('[ffl:rating:7:9]')).toBeNull();
  });

  it('refuses a rating on an idea and a feature going back to an idea', () => {
    expect(() => assertRateable({ status: 'Idea', title: 'x' })).toThrow(/converts it into a feature/);
    expect(() => assertRateable({ status: 'Planned', title: 'x' })).not.toThrow();
    expect(() => assertLifecycleEdit({ status: 'Planned' }, { status: 'Idea' })).toThrow(/cannot go back/);
    expect(() => assertLifecycleEdit({ status: 'Idea' }, { status: 'Planned' })).not.toThrow();
    const idea = { title: 'T', target_date: null, status: 'Idea' as const, notes: 'n' };
    expect(convertIdeaFields(idea)).toEqual({ title: 'T', target_date: null, status: 'Planned', notes: 'n' });
    expect(convertIdeaFields(idea, { status: 'In testing', target_date: '2027-01-05' })).toMatchObject({ status: 'In testing', target_date: '2027-01-05' });
    expect(() => convertIdeaFields({ ...idea, status: 'Planned' })).toThrow(/already a feature/);
    expect(() => convertIdeaFields(idea, { status: 'Idea' })).toThrow();
  });
});

describe('2. the Release Registry (pure)', () => {
  const commits: ReleaseCommit[] = [
    { hash: 'aaa1111', date: '2026-11-01 10:00:00', subject: 'Old work', bullets: [] },
    { hash: 'bbb2222', date: '2026-11-03 10:00:00', subject: 'Rev A', bullets: ['Ledger fix', 'Calendar grid'] },
    { hash: 'ccc3333', date: '2026-11-04 10:00:00', subject: 'Rev B', bullets: [] },
    { hash: 'ddd4444', date: '2026-12-01 10:00:00', subject: 'Future', bullets: [] },
  ];

  it('checks the block fields and the version increment', () => {
    expect(cleanReleaseBlock({ name: ' Winter ', target_version: 'v11.22', scheduled_date: '2026-12-01' })).toEqual({ name: 'Winter', target_version: '11.22.0', scheduled_date: '2026-12-01' });
    expect(() => cleanReleaseBlock({ name: 'x', target_version: 'soon', scheduled_date: '2026-12-01' })).toThrow(/11.22.0/);
    expect(() => cleanReleaseBlock({ name: 'x', target_version: '1.0.0', scheduled_date: '12/01/2026' })).toThrow();
    const reg = [{ status: 'Released' as const, target_version: '11.21.7' }, { status: 'Scheduled' as const, target_version: '12.0.0' }];
    expect(() => assertVersionIncrement('11.21.7', reg)).toThrow(/higher than the released version 11.21.7/);
    expect(() => assertVersionIncrement('11.22.0', reg)).not.toThrow();
    expect(latestRelease([{ status: 'Released', target_version: '11.9.0' }, { status: 'Released', target_version: '11.22.0' }, { status: 'Scheduled', target_version: '13.0.0' }])).toMatchObject({ target_version: '11.22.0' });
  });

  it('aggregates released features and the commits since the previous release', () => {
    const change = aggregateReleaseChange({
      block: { scheduled_date: '2026-11-10' },
      registry: [{ status: 'Released', executed_at: '2026-11-02 00:00:00', feature_ids: [9] }],
      features: [
        { id: 9, title: 'Shipped earlier', status: 'Released', target_date: null },
        { id: 10, title: 'Dues reminders', status: 'Released', target_date: '2026-11-05' },
        { id: 11, title: 'Not yet', status: 'In testing', target_date: '2026-11-05' },
        { id: 12, title: 'Later release', status: 'Released', target_date: '2026-12-31' },
      ],
      commits,
      now: new Date('2026-11-06T00:00:00Z'),
    });
    expect(change.feature_ids).toEqual([10]);
    expect(change.change_list).toEqual(['New feature: Dues reminders', 'Rev B', 'Ledger fix', 'Calendar grid']);
    expect(change.commits.map((c) => c.hash)).toEqual(['ccc3333', 'bbb2222']);
  });

  it('shows What is New for a newer release within 30 days', () => {
    const r = { status: 'Released' as const, target_version: '11.22.0', executed_at: '2026-11-06 12:00:00' };
    const now = new Date('2026-11-07T00:00:00Z');
    expect(shouldShowWhatsNew(r, null, now)).toBe(true);
    expect(shouldShowWhatsNew(r, '11.21.7', now)).toBe(true);
    expect(shouldShowWhatsNew(r, '11.22.0', now)).toBe(false);
    expect(shouldShowWhatsNew(r, null, new Date('2026-12-31T00:00:00Z'))).toBe(false);
    expect(shouldShowWhatsNew({ ...r, status: 'Scheduled', executed_at: null }, null, now)).toBe(false);
    expect(shouldShowWhatsNew(null, null, now)).toBe(false);
  });

  it('ships a release commit manifest written from Git at build time', () => {
    expect(RELEASE_COMMIT_LOG.length).toBeGreaterThan(0);
    for (const c of RELEASE_COMMIT_LOG) {
      expect(c.hash).toMatch(/^[0-9a-f]{7}$/);
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    }
    const parsed = parseGitLog(
      'abcdef1234\x1f2026-11-06T10:07:32-08:00\x1fRev X\x1f- First bullet\n  continued here\n- Second\n\nCo-Authored-By: x\x1e',
    );
    expect(parsed).toEqual([{ hash: 'abcdef1', date: '2026-11-06 18:07:32', subject: 'Rev X', bullets: ['First bullet continued here', 'Second'] }]);
    expect(read('scripts/build-pilot.mjs')).toContain('writeReleaseLog()');
    expect(read('scripts/build-exe.mjs')).toContain('writeReleaseLog()');
  });
});

describe('3. the Platform Calendar month grid (pure)', () => {
  it('adds release blocks, meeting agendas and drill-down text', () => {
    const cal = platformCalendar(
      [],
      [{ meeting_date: '2026-12-01', title: 'Winter panel', location: 'Hall', agenda: 'Roadmap\nVotes' }],
      ADVISORY_ROADMAP,
      [{ name: 'Winter', target_version: '11.22.0', scheduled_date: '2026-12-05', status: 'Scheduled', change_list: [] }],
    );
    expect(cal.find((c) => c.title === 'Winter panel')!.more).toEqual(['Roadmap', 'Votes']);
    expect(cal.find((c) => c.title === 'Winter (v11.22.0)')).toMatchObject({ kind: 'release', detail: 'Scheduled' });
  });

  it('lays a month out in Sunday-first weeks', () => {
    const grid = calendarMonthGrid('2026-11', [{ date: '2026-11-06', kind: 'release', title: 'R', detail: null }]);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid[0]![0]!.date).toBe('2026-11-01'); // 1 November 2026 is a Sunday
    expect(grid.flat().filter((c) => c.date).length).toBe(30);
    expect(grid.flat().find((c) => c.date === '2026-11-06')!.entries.map((e) => e.title)).toEqual(['R']);
    expect(calendarMonthGrid('2027-02', [])[0]!.findIndex((c) => c.date === '2027-02-01')).toBe(1);
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(() => calendarMonthGrid('Nov', [])).toThrow();
  });
});

describe('4. the hub and the view-as guard carry the new calls', () => {
  it('registers every new advisory method', () => {
    for (const m of ['convertIdeaToFeature', 'listReleases', 'saveRelease', 'removeRelease', 'executeRelease', 'getLatestRelease']) expect(HUB_ACTOR_FIRST_METHODS.has(`advisory.${m}`), m).toBe(true);
    expect(isViewAsReadMethod('listReleases')).toBe(true);
    expect(isViewAsReadMethod('getLatestRelease')).toBe(true);
    expect(isViewAsReadMethod('executeRelease')).toBe(false);
  });

  it('adds the Release Registry view and the What is New card on Home', () => {
    expect(ADVISORY_PANEL_VIEWS.map((v) => v.id)).toContain('releases');
    expect(read('apps/web/components/AdvisoryPanel.tsx')).toContain("view === 'releases' ? <ReleaseRegistry />");
    expect(read('apps/web/app/dashboard/page.tsx')).toContain('<WhatsNewCard />');
    const parts = read('apps/web/components/AdvisoryWorkshopParts.tsx');
    expect(parts).toContain('data-calendar-grid="month"');
    expect(parts).toContain('CONVERT_IDEA_LABEL');
    for (const label of ['Release Name', 'Target Version', 'Scheduled Date', 'Execute release']) expect(parts).toContain(label);
  });
});

describe.each(drivers)('5. the lifecycle and the registry ($name driver)', ({ make }) => {
  it('keeps ideas unrated until converted, threads replies and deletes them with the entry', async () => {
    const db = await make();
    await db.advisory.setPanelist(MEMBER.superAdmin, MEMBER.member, true);
    let list = await db.advisory.submitFeatureIdea(MEMBER.member, { title: 'Bulletin export' });
    const idea = list[0]!;
    expect(idea).toMatchObject({ lifecycle: 'idea', priorityRank: null });
    await expectRule(db.advisory.rateFeature(MEMBER.member, idea.id, 4), 'INVALID_INPUT');

    list = await db.advisory.commentOnFeature(MEMBER.member, idea.id, 'Weekly or monthly?');
    const top = list[0]!.comments[0]!;
    list = await db.advisory.commentOnFeature(MEMBER.superAdmin, idea.id, 'Monthly.', top.id);
    expect(list[0]!.comments[0]!.replies.map((r) => r.body)).toEqual(['Monthly.']);
    expect(list[0]!.commentCount).toBe(2);
    await expectRule(db.advisory.commentOnFeature(MEMBER.member, idea.id, 'x', 99999), 'RECORD_NOT_FOUND');

    await expectRule(db.advisory.convertIdeaToFeature(MEMBER.member, idea.id), 'SUPER_ADMIN_REQUIRED');
    list = await db.advisory.convertIdeaToFeature(MEMBER.superAdmin, idea.id);
    expect(list[0]).toMatchObject({ lifecycle: 'feature', status: 'Planned', priorityRank: 1 });
    await expectRule(db.advisory.convertIdeaToFeature(MEMBER.superAdmin, idea.id), 'INVALID_INPUT');
    list = await db.advisory.rateFeature(MEMBER.member, idea.id, 4);
    expect(list[0]).toMatchObject({ ratingAverage: 4, myRating: 4 });
    await expectRule(db.advisory.saveFeature(MEMBER.superAdmin, { id: idea.id, title: 'Bulletin export', status: 'Idea' }), 'INVALID_INPUT');

    list = await db.advisory.removeFeature(MEMBER.superAdmin, idea.id);
    expect(list).toEqual([]);
    expect(await db.advisory.listFeedback(MEMBER.superAdmin)).toEqual([]);
  });

  it('schedules, executes and locks release blocks, and every member reads the newest', async () => {
    const db = await make();
    await db.advisory.setPanelist(MEMBER.superAdmin, MEMBER.member, true);
    await expectRule(db.advisory.saveRelease(MEMBER.member, { name: 'Nope', target_version: '1.0.0', scheduled_date: '2026-10-01' }), 'SUPER_ADMIN_REQUIRED');
    expect(await db.advisory.getLatestRelease(MEMBER.admin)).toBeNull();

    const features = await db.advisory.saveFeature(MEMBER.superAdmin, { title: 'Dues reminders', status: 'Released', target_date: '2026-09-15' });
    let reg = await db.advisory.saveRelease(MEMBER.superAdmin, { name: 'Autumn', target_version: '11.22.0', scheduled_date: '2026-09-20' });
    const block = reg[0]!;
    expect(block).toMatchObject({ status: 'Scheduled', change_list: [], executed_at: null });
    reg = await db.advisory.saveRelease(MEMBER.superAdmin, { id: block.id, name: 'Autumn Release', target_version: '11.22.0', scheduled_date: '2026-09-20' });
    expect(reg[0]!.name).toBe('Autumn Release');
    expect(await db.advisory.listReleases(MEMBER.member)).toHaveLength(1);
    await expectRule(db.advisory.listReleases(MEMBER.admin), 'ADMIN_REQUIRED');

    const done = await db.advisory.executeRelease(MEMBER.superAdmin, block.id);
    expect(done).toMatchObject({ status: 'Released', feature_ids: [features[0]!.id] });
    expect(done.change_list[0]).toBe('New feature: Dues reminders');
    expect(done.executed_at).toMatch(/^\d{4}-\d{2}-\d{2} /);
    // Commits dated after "now" never feed a change list.
    for (const c of done.commits) expect(RELEASE_COMMIT_LOG.find((x) => x.hash === c.hash)!.date <= NOW.toISOString().replace('T', ' ').slice(0, 19)).toBe(true);

    await expectRule(db.advisory.executeRelease(MEMBER.superAdmin, block.id), 'INVALID_INPUT');
    await expectRule(db.advisory.saveRelease(MEMBER.superAdmin, { id: block.id, name: 'x', target_version: '11.22.0', scheduled_date: '2026-09-20' }), 'INVALID_INPUT');
    await expectRule(db.advisory.removeRelease(MEMBER.superAdmin, block.id), 'INVALID_INPUT');

    // The next release must raise the version.
    reg = await db.advisory.saveRelease(MEMBER.superAdmin, { name: 'Repeat', target_version: '11.22.0', scheduled_date: '2026-10-01' });
    const repeat = reg.find((b) => b.name === 'Repeat')!;
    await expectRule(db.advisory.executeRelease(MEMBER.superAdmin, repeat.id), 'INVALID_INPUT');
    reg = await db.advisory.removeRelease(MEMBER.superAdmin, repeat.id);
    expect(reg.map((b) => b.name)).toEqual(['Autumn Release']);

    expect(await db.advisory.getLatestRelease(MEMBER.admin)).toMatchObject({ name: 'Autumn Release', target_version: '11.22.0' });
    expect(await db.advisory.listFeedback(MEMBER.superAdmin)).toEqual([]);
  });
});

describe('6. the six core SOP modules', () => {
  const sops = [
    ['sop-003-joint-event-revenue-splitting.md', 'SOP 003: Joint-Event Revenue Splitting'],
    ['sop-004-automated-home-parish-onboarding.md', 'SOP 004: Automated Home Parish Onboarding'],
    ['sop-005-platform-advisory-vetting-lifecycle.md', 'SOP 005: Platform Advisory Vetting Lifecycle'],
    ['sop-006-standalone-client-telemetry.md', 'SOP 006: Standalone Client Telemetry'],
    ['sop-007-in-person-cooperative-testing-mesh.md', 'SOP 007: In-Person Cooperative Testing Mesh'],
    ['sop-008-ephemeral-volunteer-training-simulator.md', 'SOP 008: Ephemeral Volunteer Training Simulator'],
  ] as const;

  it.each(sops)('%s opens with its title and a What it is section', (file, title) => {
    const md = read(`docs/sop/${file}`);
    expect(parseMarkdown(md)[0]).toEqual({ kind: 'heading', level: 1, text: title });
    expect(md).toContain('## What it is');
    expect(md).not.toMatch(/\r\n/);
    expect(md).not.toMatch(/Ã|â€/);
  });

  it('lists the training profiles and their password exactly, with no Super Admin', () => {
    const md = read('docs/sop/sop-008-ephemeral-volunteer-training-simulator.md');
    for (const p of TRAINING_PROFILES) expect(md).toContain(`\`${p.username}\``);
    expect(md).toContain(`\`${TRAINING_PASSWORD}\``);
    expect(readdirSync(join(root, 'docs/sop')).filter((f) => f.startsWith('sop-00')).length).toBe(6);
  });
});

describe('7. the Revision 21.7 layout and seeds stay in place', () => {
  it('seeds Secular Charity Corp with Chapter 1 and 2 (councils 10 and 11)', () => {
    const seed = read('Seed.sql');
    expect(seed).toContain("'Secular Charity Corp', 'SECULAR_CHARITY_CORP'");
    expect(seed).toMatch(/'Secular Charity Chapter 1'.*-- id 10/);
    expect(seed).toMatch(/'Secular Charity Chapter 2'.*-- id 11/);
  });

  it('offers the seven council desk training profiles and no Super Admin', () => {
    expect(TRAINING_PROFILES.map((p) => p.username)).toEqual(['admin@training', 'gk@training', 'fs@training', 'tr@training', 'rec@training', 'hist@training', 'mem@training']);
    expect(TRAINING_PASSWORD).toBe('training');
    expect(TRAINING_PROFILES.some((p) => /super/i.test(p.label) || p.role === 'Super Admin')).toBe(false);
    expect(read('apps/web/components/TrainingProfileBoard.tsx')).toContain('{TRAINING_PASSWORD}');
  });

  it('keeps the feature grid dropdown, sticky header and tier column text', () => {
    const grid = read('apps/web/components/FeatureFlagParts.tsx');
    expect(grid).toContain("TIER_TOGGLE_COLUMN_HEADER = 'TOGGLE ALL MODULES FOR THIS ORGANIZATIONAL TIER'");
    expect(grid).toContain("{ position: 'sticky', top: 0, zIndex: 40 }");
  });

  it('keeps Council History, with no Fraternal Annals & Oral History label left on screen', () => {
    const page = read('apps/web/app/history/page.tsx');
    for (const t of ['[ Edit Founding Info ]', 'Charter Members', 'Fraternal Year Summaries', 'Oral History & Diaries', 'In Memoriam']) expect(page).toContain(t);
    expect(read('packages/shared/src/council-settings.ts')).not.toContain('on Fraternal Annals & Oral History');
  });

  it('keeps the Admin Desk rail pinned and the Payment QR sample badge', () => {
    expect(read('apps/web/components/modules/AdminDesk.tsx')).toContain("{ position: 'sticky', top: 0, maxHeight: '100vh', overflowY: 'auto' }");
    expect(read('apps/web/components/PaymentQrUploader.tsx')).toContain("SAMPLE_CODE_BADGE_LABEL = 'Sample Code'");
    expect(existsSync(join(root, 'docs/SUPER_ADMIN_SYSTEM_MANUAL.md'))).toBe(true);
  });
});
