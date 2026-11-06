// Sprint 11 Revision 21.5 (schema 113, no table change): the telegraphic desk text, the Admin Desk rail without its top
// deck, Council Wide Settings' Instance Record and Council Setup drawers, the cabinet/drawer border tones, the live Payment
// QR images, the split Member Desk hours drawers, the Advisory Panel workshop and the sign-in client telemetry.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_DESK_DRAWERS,
  adminDeskDrawersFor,
  ADVISORY_PANEL_VIEWS,
  ADVISORY_ROADMAP,
  ALL_FEATURES_ON,
  BUNDLED_PAYMENT_QR,
  buildFeatureList,
  CLIENT_RELEASE_BASELINE,
  CLIENT_RELEASE_VERSION,
  CLIENT_VERSION_HEADER,
  clientUpgradeNotice,
  compareClientVersions,
  COUNCIL_SETTINGS_DRAWERS,
  DESK_HANDLE_TONES,
  FUTURE_FEATURE_LIST_TITLE,
  HUB_ACTOR_FIRST_METHODS,
  MEMBER_DESK_DRAWERS,
  normalizeClientVersion,
  ownRosterRow,
  parseClientTelemetry,
  paymentQrDisplay,
  platformCalendar,
  PLATFORM_SCHEMA_VERSION,
  rankFeatureList,
  WORKSHOP_TOPIC,
  type AdvisoryFeedback,
  type Member,
} from '@kofc/shared';
import { POST as sessionPost } from '../apps/web/app/api/auth/session/route';
import { readClientTelemetryLog } from '../apps/web/services/server/client-telemetry';
import { drivers, expectRule, MEMBER } from './helpers';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('0. the schema stays at 113', () => {
  it('keeps PLATFORM_SCHEMA_VERSION at 113', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(113);
  });
});

describe('1. the Admin Desk rail and Council Wide Settings', () => {
  it('folds the top deck into the rail: manual and help are file cabinets, the rest working drawers', () => {
    expect(ADMIN_DESK_DRAWERS.slice(0, 4).map((d) => [d.id, d.kind])).toEqual([
      ['setup-wizard', 'drawer'],
      ['admin-manual', 'cabinet'],
      ['help-search', 'cabinet'],
      ['council-settings', 'drawer'],
    ]);
    const desk = read('apps/web/components/modules/AdminDesk.tsx');
    expect(desk).not.toMatch(/StaticTopDeck|CouncilIdentityRecord|PracticeSandboxSwitch|Admin Desk controls/);
    expect(desk).toContain('data-handle-kind={d.kind}');
    expect(desk).toContain('DESK_HANDLE_TONES[d.kind].edge');
  });

  it('drops the Setup Wizard drawer once the wizard has run', () => {
    expect(adminDeskDrawersFor(ALL_FEATURES_ON).map((d) => d.id)).toContain('setup-wizard');
    expect(adminDeskDrawersFor(ALL_FEATURES_ON, { setupWizardDone: true }).map((d) => d.id)).not.toContain('setup-wizard');
    expect(read('apps/web/components/modules/AdminDesk.tsx')).toContain('setWizardDone(setupWizardWasDone(user.councilId))');
  });

  it('puts the Council Instance Record and Council Setup in Council Wide Settings drawers', () => {
    expect(COUNCIL_SETTINGS_DRAWERS[0]!.id).toBe('instance-record');
    expect(COUNCIL_SETTINGS_DRAWERS.at(-1)!.id).toBe('council-setup');
    const page = read('apps/web/components/modules/CouncilWideSettings.tsx');
    expect(page).toContain('<CouncilSetupPanel council={council} />');
    const setup = read('apps/web/components/modules/CouncilSetupPanel.tsx');
    expect(setup).toContain('council.id !== user.councilId');
    expect(setup).toContain('<PracticeSandboxSwitch');
  });

  it('tells file cabinets from functional drawers by border tone on both desks', () => {
    expect(DESK_HANDLE_TONES.cabinet.edge).not.toBe(DESK_HANDLE_TONES.drawer.edge);
    const spine = read('apps/web/components/DeskDrawers.tsx');
    expect(spine).toContain("DESK_HANDLE_TONES[inCabinet ? 'cabinet' : 'drawer'].edge");
    expect(spine).toContain('DESK_HANDLE_TONES.cabinet.group');
  });

  it('keeps desk hints telegraphic: short, no sentences of instruction', () => {
    for (const d of ADMIN_DESK_DRAWERS) expect(d.hint.length, d.id).toBeLessThanOrEqual(48);
    for (const d of COUNCIL_SETTINGS_DRAWERS) expect(d.hint.length, d.id).toBeLessThanOrEqual(60);
    expect(read('apps/web/components/TwoFactorSection.tsx')).toContain('Second sign-in step after the password.');
    expect(read('apps/web/components/MeritTierParts.tsx')).toContain('Highest qualifying tier.');
  });
});

describe('2. Payment QR images and the Member Desk', () => {
  it('draws the live stored image, else the bundled sample, never "No QR code yet" for a seeded method', () => {
    expect(paymentQrDisplay('/api/council/payment-qr?file=c1/qr-1-ab.png', 'Venmo')).toEqual({ src: '/api/council/payment-qr?file=c1/qr-1-ab.png', source: 'uploaded' });
    expect(paymentQrDisplay('placeholder://qr/venmo.png', 'Venmo')).toEqual({ src: BUNDLED_PAYMENT_QR.venmo, source: 'sample' });
    expect(paymentQrDisplay(null, 'Zelle').source).toBe('sample');
    expect(paymentQrDisplay(null, 'Square')).toEqual({ src: null, source: 'none' });
    for (const src of Object.values(BUNDLED_PAYMENT_QR)) expect(() => readFileSync(join(root, 'apps/web/public', src))).not.toThrow();
    expect(read('apps/web/components/PaymentQrUploader.tsx')).toContain('paymentQrDisplay(row.DonationMethodURL, name)');
  });

  it("splits 'My Hours & Shifts' into Record Hours and My Scheduled Shifts", () => {
    expect(MEMBER_DESK_DRAWERS.map((d) => d.label)).toEqual(expect.arrayContaining(['Record Hours', 'My Scheduled Shifts']));
    expect(MEMBER_DESK_DRAWERS.map((d) => d.label)).not.toContain('My Hours & Shifts');
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).toContain("case 'record-hours':");
    expect(desks).toContain("case 'scheduled-shifts':");
  });

  it('reads My Roster Profile from the council roster rows', () => {
    const me = { id: 3 } as Member;
    expect(ownRosterRow({ members: [{ id: 2 } as Member, me] }, 3)).toBe(me);
    expect(ownRosterRow({ members: [] }, 3)).toBeNull();
    expect(read('apps/web/components/DashboardDesks.tsx')).toContain('ownRosterRow(await db.members.listRoster(user.memberId), user.memberId)');
  });
});

describe('3. the Advisory Panel workshop (pure)', () => {
  it("renames the releases view to 'Future Feature List' and adds the Platform Calendar", () => {
    expect(ADVISORY_PANEL_VIEWS.map((v) => v.label)).toEqual(['Development Roadmap', FUTURE_FEATURE_LIST_TITLE, 'Platform Calendar', 'Panel Meeting Dates', 'Consultation Feedback']);
    for (const r of ADVISORY_ROADMAP) expect(r.target_date, r.title).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sums ratings into an average and ranks the list by it', () => {
    const row = (id: number, member: number, topic: string, body: string): AdvisoryFeedback => ({ id, member_id: member, council_id: 1, topic, body, submitted_at: `2026-09-20 12:00:${String(id).padStart(2, '0')}` });
    const entry = (title: string) => JSON.stringify({ title, target_date: null, status: 'Planned', notes: null });
    const rows = [
      row(1, 1, WORKSHOP_TOPIC.entry, entry('A')),
      row(2, 1, WORKSHOP_TOPIC.entry, entry('B')),
      row(3, 3, WORKSHOP_TOPIC.rating(2), '5'),
      row(4, 4, WORKSHOP_TOPIC.rating(2), '4'),
      row(5, 3, WORKSHOP_TOPIC.rating(1), '2'),
      row(6, 3, WORKSHOP_TOPIC.rating(1), '3'), // replaces member 3's earlier 2
      row(7, 4, WORKSHOP_TOPIC.comment(1), 'Needed for the pilot.'),
    ];
    const list = buildFeatureList(rows, 3, (id) => ({ name: `M${id}`, councilLabel: 'C' }));
    expect(list.map((e) => [e.title, e.priorityRank, e.ratingAverage, e.ratingCount, e.myRating])).toEqual([
      ['B', 1, 4.5, 2, 5],
      ['A', 2, 3, 1, 3],
    ]);
    expect(list[1]!.comments.map((c) => c.body)).toEqual(['Needed for the pilot.']);
    expect(rankFeatureList([{ title: 'x', ratingAverage: null, ratingCount: 0, target_date: null }])[0]!.priorityRank).toBe(1);
  });

  it('merges releases, meetings and the pilot timeline on the Platform Calendar', () => {
    const cal = platformCalendar(
      [
        { title: 'Ledger', target_date: '2027-01-02', status: 'Planned', notes: null },
        { title: 'Idea only', target_date: null, status: 'Idea', notes: null },
      ],
      [{ meeting_date: '2026-12-01', title: 'Winter panel', location: null }],
      ADVISORY_ROADMAP,
    );
    expect(cal.map((c) => c.kind)).toEqual(expect.arrayContaining(['release', 'meeting', 'pilot']));
    expect(cal.map((c) => c.date)).toEqual([...cal.map((c) => c.date)].sort());
    expect(cal.some((c) => c.title === 'Idea only')).toBe(false);
  });

  it('lets the hub carry every workshop call', () => {
    for (const m of ['listFeatureList', 'saveFeature', 'removeFeature', 'submitFeatureIdea', 'commentOnFeature', 'rateFeature']) expect(HUB_ACTOR_FIRST_METHODS.has(`advisory.${m}`), m).toBe(true);
  });
});

describe.each(drivers)('3b. the Advisory Panel workshop ($name driver)', ({ make }) => {
  it('lets Super Admins keep the list and panelists submit ideas, comment and rate', async () => {
    const db = await make();
    await db.advisory.setPanelist(MEMBER.superAdmin, MEMBER.member, true);
    await expectRule(db.advisory.listFeatureList(MEMBER.admin), 'ADMIN_REQUIRED');
    await expectRule(db.advisory.saveFeature(MEMBER.member, { title: 'Nope' }), 'SUPER_ADMIN_REQUIRED');

    let list = await db.advisory.saveFeature(MEMBER.superAdmin, { title: 'Dues reminders', target_date: '2027-02-01', status: 'Planned', notes: 'Monthly.' });
    const dues = list[0]!;
    list = await db.advisory.submitFeatureIdea(MEMBER.member, { title: 'Parish bulletin export' });
    const idea = list.find((e) => e.title === 'Parish bulletin export')!;
    expect(idea.status).toBe('Idea');

    list = await db.advisory.rateFeature(MEMBER.member, idea.id, 5);
    list = await db.advisory.rateFeature(MEMBER.superAdmin, dues.id, 2);
    expect(list.map((e) => e.title)).toEqual(['Parish bulletin export', 'Dues reminders']);
    list = await db.advisory.rateFeature(MEMBER.member, idea.id, 1); // changes the member's rating, not a second one
    expect(list.find((e) => e.id === idea.id)).toMatchObject({ ratingCount: 1, ratingAverage: 1, myRating: 1 });
    expect(list[0]!.title).toBe('Dues reminders');
    await expectRule(db.advisory.rateFeature(MEMBER.member, idea.id, 6), 'INVALID_INPUT');

    list = await db.advisory.commentOnFeature(MEMBER.member, dues.id, 'Please include text reminders.');
    expect(list.find((e) => e.id === dues.id)!.comments.map((c) => c.body)).toEqual(['Please include text reminders.']);
    await expectRule(db.advisory.commentOnFeature(MEMBER.member, 99999, 'x'), 'RECORD_NOT_FOUND');

    list = await db.advisory.saveFeature(MEMBER.superAdmin, { id: idea.id, title: 'Parish bulletin export', status: 'Planned', target_date: '2027-03-01' });
    expect(list.find((e) => e.id === idea.id)).toMatchObject({ status: 'Planned', target_date: '2027-03-01', ratingCount: 1 });

    // Workshop rows never show as consultation notes, and a note may not borrow a workshop tag.
    expect(await db.advisory.listFeedback(MEMBER.superAdmin)).toEqual([]);
    await expectRule(db.advisory.submitFeedback(MEMBER.member, { topic: '[ffl:entry]', body: 'sneaky' }), 'INVALID_INPUT');

    list = await db.advisory.removeFeature(MEMBER.superAdmin, dues.id);
    expect(list.map((e) => e.id)).toEqual([idea.id]);
    await expectRule(db.advisory.removeFeature(MEMBER.member, idea.id), 'SUPER_ADMIN_REQUIRED');
  });
});

describe('4. client telemetry and the upgrade notice', () => {
  const headers = (h: Record<string, string>) => new Headers(h);

  it('parses version and platform from the sign-in headers', () => {
    expect(normalizeClientVersion('v11.21')).toBe('11.21.0');
    expect(normalizeClientVersion('banana')).toBeNull();
    expect(compareClientVersions('11.20.9', '11.21.0')).toBe(-1);
    expect(parseClientTelemetry(headers({ [CLIENT_VERSION_HEADER]: CLIENT_RELEASE_VERSION, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Electron/45.1.0' }))).toEqual({
      version: CLIENT_RELEASE_VERSION,
      platform: 'Windows Desktop',
      kind: 'desktop',
    });
    expect(parseClientTelemetry(headers({ 'user-agent': 'KofCClient/11.19.0 (iPhone; iOS 18)' }))).toEqual({ version: '11.19.0', platform: 'iOS', kind: 'phone' });
    expect(parseClientTelemetry(headers({ 'user-agent': 'Mozilla/5.0 (Macintosh; Mac OS X 14)' }))).toEqual({ version: null, platform: 'macOS', kind: 'browser' });
  });

  it('recommends an upgrade only below the release baseline', () => {
    expect(compareClientVersions(CLIENT_RELEASE_VERSION, CLIENT_RELEASE_BASELINE)).toBeGreaterThanOrEqual(0);
    expect(clientUpgradeNotice({ version: CLIENT_RELEASE_VERSION, kind: 'browser' })).toBeNull();
    expect(clientUpgradeNotice({ version: null, kind: 'browser' })).toBeNull();
    const notice = clientUpgradeNotice({ version: '11.19.0', kind: 'desktop' })!;
    expect(notice.title).toBe('Upgrade recommended');
    expect(notice.body).toContain('11.19.0');
    expect(clientUpgradeNotice({ version: '1.0.0', kind: 'browser' })!.actionLabel).toBe('Reload now');
  });

  describe('POST /api/auth/session', () => {
    let dir = '';
    const before = process.env.HUB_VAULT_DIR;
    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), 'kofc-telemetry-'));
      process.env.HUB_VAULT_DIR = dir;
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterAll(() => {
      if (before === undefined) delete process.env.HUB_VAULT_DIR;
      else process.env.HUB_VAULT_DIR = before;
      rmSync(dir, { recursive: true, force: true });
      vi.restoreAllMocks();
    });

    it('records the client and answers the upgrade notice for an old one', async () => {
      const res = await sessionPost(
        new Request('http://localhost/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', [CLIENT_VERSION_HEADER]: '11.10.0', 'user-agent': 'Mozilla/5.0 (Linux; Android 15)' },
          body: JSON.stringify({ username: 'testmember@kofc.org', password: 'dev-pass-secure-9912' }),
        }),
      );
      const body = (await res.json()) as { signedIn: boolean; client: { telemetry: { version: string; platform: string }; upgrade: { title: string } | null } };
      expect(body.signedIn).toBe(true);
      expect(body.client.telemetry).toMatchObject({ version: '11.10.0', platform: 'Android' });
      expect(body.client.upgrade?.title).toBe('Upgrade recommended');
      const log = await readClientTelemetryLog();
      expect(log.recent[0]).toMatchObject({ version: '11.10.0', platform: 'Android', route: 'portal' });
      expect(Object.keys(log.latestByMember)).toHaveLength(1);
    });
  });

  it('sends the bundle version on sign-in and shows the notice card in the frame', () => {
    expect(read('apps/web/services/session-transport.ts')).toContain('...clientTelemetryHeaders()');
    expect(read('apps/web/components/Shell.tsx')).toContain('<UpgradeNoticeCard />');
    expect(read('apps/web/app/api/sync/replicate/route.ts')).toContain("route: 'hub'");
  });
});
