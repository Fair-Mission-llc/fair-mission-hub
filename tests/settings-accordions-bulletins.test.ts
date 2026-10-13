// Sprint 8Q (schema version 90): the Honorary Expense lexicon, the Council Wide Settings accordion buckets, the Council
// Feature Deployment Matrix with its biometric switch, structured newsletters and the Home bulletin feed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  biometricLoginEnabled,
  BULLETIN_FEED_LIMIT,
  BULLETIN_FEED_TITLE,
  bulletinFeed,
  bulletinTitle,
  cleanBulletinLayout,
  cleanHistorianBulletin,
  COUNCIL_HISTORIAN_ROLE,
  COUNCIL_SETTINGS_BUCKETS,
  councilFeatureDeployment,
  FEATURE_DEPLOYED_BADGE,
  FEATURE_FLAG_NAMES,
  FEATURE_OFF_BADGE,
  featureDeploymentBadge,
  HONORARY_EXPENSE_BADGE,
  parseBulletinBlocks,
  PLATFORM_SCHEMA_VERSION,
  type DataService,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { BiometricLogin, type BiometricScanner } from '../apps/mobile/services/biometric-login';
import { OnboardingController } from '../apps/mobile/services/onboarding';
import { sessionStore } from '../apps/mobile/services/session';
import { _reset } from './shims/expo-secure-store';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;

/** Every source and document file the sweep covers (not node_modules, build output, git or binaries). */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(__dirname, '..', dir))) {
    if (['node_modules', '.next', 'dist', '.git', 'generated', '.expo', '__pycache__'].includes(name)) continue;
    const rel = `${dir}/${name}`;
    if (statSync(join(__dirname, '..', rel)).isDirectory()) sourceFiles(rel, out);
    else if (/\.(ts|tsx|md|sql|py|txt)$/.test(name)) out.push(rel);
  }
  return out;
}

describe('schema version 90', () => {
  it('adds the biometric switch and the bulletin layout columns and moves the phone database to 90', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('(schema version 90)');
    expect(schema).toContain('ALTER TABLE [Council] ADD [biometric_login_enabled] INT NOT NULL DEFAULT 1;');
    expect(schema).toContain('ALTER TABLE [CouncilHistorianBulletin] ADD [headline] VARCHAR(200) NULL;');
    expect(schema).toContain("CHECK ([body_format] IN ('STRUCTURED', 'PLAIN'))");
    expect(TABLES.Council.columns.map((c) => c.name)).toContain('biometric_login_enabled');
    expect(TABLES.CouncilHistorianBulletin.columns.map((c) => c.name)).toEqual(expect.arrayContaining(['headline', 'body_format']));
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (9\d);/);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toContain(`const SCHEMA_VERSION = ${PLATFORM_SCHEMA_VERSION};`);
  });
});

describe('the Honorary Expense lexicon', () => {
  it('leaves no Honor Voucher string in code, schema or documents', () => {
    const banned = /honou?r[ _-]?voucher/i;
    const files = ['Schema.sql', 'data_dictionary.md', 'user_guide.md', ...sourceFiles('apps'), ...sourceFiles('packages/shared/src'), ...sourceFiles('docs'), ...sourceFiles('scripts')];
    const hits = files.filter((f) => !f.endsWith('ARCHITECTURAL_HISTORY.md') && banned.test(read(f)));
    expect(hits).toEqual([]);
    expect(HONORARY_EXPENSE_BADGE).toBe('⚠️ HONORARY EXPENSE - NO RECEIPT ATTACHED');
    expect(read('apps/web/app/expenses/page.tsx')).toContain('⚠️ I have no receipt (Honorary Expense)');
  });
});

describe('the Council Feature Deployment Matrix (pure)', () => {
  it('names the two accordion buckets', () => {
    expect(COUNCIL_SETTINGS_BUCKETS.map((b) => b.label)).toEqual(['🔧 Operational Configuration', '📋 System Information']);
  });

  it('reads each capability from the council row, then lists every module', () => {
    const off = councilFeatureDeployment({ biometric_login_enabled: 0 });
    expect(off.slice(0, 3).map((r) => [r.label, r.deployed])).toEqual([
      ['Parametric Parish Splits', false],
      ['Cross-Council Shared Asset Libraries', false],
      ['Biometric Authentication', false],
    ]);
    expect(off.filter((r) => r.group === 'module').map((r) => r.id)).toEqual([...FEATURE_FLAG_NAMES]);
    const on = councilFeatureDeployment({
      parish_split_enabled: 1,
      is_loaner_library_enabled: 1,
      meeting_latitude: 47.6,
      meeting_longitude: -122.3,
      SmtpHost: 'smtp.example.org',
      flag_mobile_elections: 0,
    });
    expect(on.filter((r) => r.group === 'capability').every((r) => r.deployed)).toBe(true);
    expect(on.find((r) => r.id === 'flag_mobile_elections')!.deployed).toBe(false);
    expect(featureDeploymentBadge({ deployed: true })).toBe(FEATURE_DEPLOYED_BADGE);
    expect(featureDeploymentBadge({ deployed: false })).toBe(FEATURE_OFF_BADGE);
    expect([FEATURE_DEPLOYED_BADGE, FEATURE_OFF_BADGE]).toEqual(['🟢 DEPLOYED', '⚪ AVAILABLE / OFF']);
  });

  it('reads a missing biometric switch as on', () => {
    expect(biometricLoginEnabled({})).toBe(true);
    expect(biometricLoginEnabled({ biometric_login_enabled: null })).toBe(true);
    expect(biometricLoginEnabled({ biometric_login_enabled: 0 })).toBe(false);
  });

  it('puts the matrix in Operational Configuration and the read-only record in System Information', () => {
    const page = read('apps/web/app/system-settings/council-settings/page.tsx');
    const operational = page.slice(page.indexOf('<SettingsBucket id="operational" defaultOpen>'), page.indexOf('<SettingsBucket id="information">'));
    const information = page.slice(page.indexOf('<SettingsBucket id="information">'));
    for (const card of ['GroupedSettingsCards', 'MeetingCheckInCard', 'ParishSplitSettingsCard', 'LoanerLibrarySharingCard', 'FeatureDeploymentMatrix', 'OPERATIONAL_SETTINGS_PAGES']) {
      expect(operational).toContain(card);
    }
    for (const card of ['CouncilInstanceRecord', 'SYSTEM_REFERENCE_PAGES', 'CustomGuidesCard']) expect(information).toContain(card);
  });
});

describe('structured bulletins (pure)', () => {
  it('keeps clean paragraph spacing', () => {
    expect(cleanHistorianBulletin('2026-10', ' One  \r\n\r\n\r\n\r\nTwo ')).toEqual({ bulletin_month: '2026-10', body: 'One\n\nTwo' });
  });

  it('parses headings, paragraphs and bullets, or keeps plain text as typed', () => {
    const body = '## Charity\nWe raised $500.\nThank you.\n\n- Coats\n- Food\n\nSee you soon.';
    expect(parseBulletinBlocks(body)).toEqual([
      { kind: 'heading', text: 'Charity' },
      { kind: 'paragraph', lines: ['We raised $500.', 'Thank you.'] },
      { kind: 'list', items: ['Coats', 'Food'] },
      { kind: 'paragraph', lines: ['See you soon.'] },
    ]);
    expect(parseBulletinBlocks(body, 'PLAIN')).toEqual([{ kind: 'paragraph', lines: body.split('\n') }]);
    expect(parseBulletinBlocks('  ')).toEqual([]);
  });

  it('cleans the layout fields', () => {
    expect(cleanBulletinLayout({ headline: '  October   news ', body_format: 'PLAIN' })).toEqual({ headline: 'October news', body_format: 'PLAIN' });
    expect(cleanBulletinLayout({ headline: ' ' })).toEqual({ headline: null });
    expect(cleanBulletinLayout(undefined)).toEqual({});
    expect(() => cleanBulletinLayout({ headline: 'x'.repeat(201) })).toThrow(/at most 200/);
    expect(() => cleanBulletinLayout({ body_format: 'HTML' as never })).toThrow(/STRUCTURED or PLAIN/);
  });

  it('feeds the newest saved bulletins up to this month', () => {
    const rows = ['2026-07', '2026-08', '2026-09', '2026-10'].map((m) => ({ bulletin_month: m, body: m === '2026-08' ? ' ' : `News ${m}` }));
    expect(bulletinFeed(rows, '2026-09-20').map((r) => r.bulletin_month)).toEqual(['2026-09', '2026-07']);
    expect(BULLETIN_FEED_LIMIT).toBe(3);
    expect(bulletinTitle({ bulletin_month: '2026-09', headline: null })).toBe('September 2026 Newsletter');
    expect(bulletinTitle({ bulletin_month: '2026-09', headline: 'Fall Drive' })).toBe('Fall Drive');
    expect(BULLETIN_FEED_TITLE).toBe('[ 📰 Latest Council Newsletters & Bulletins ]');
  });

  it('leads Home and Member Actions with the feed', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    const grid = desks.slice(desks.indexOf('export function HomeWidgets('), desks.indexOf('// ---- the Officer Desks'));
    expect(grid).toContain('<LatestBulletinsFeed memberId={user.memberId} councilId={councilId} className="col-span-full" />');
    expect(read('apps/web/app/member-actions/page.tsx')).toContain('<LatestBulletinsFeed memberId={user.memberId} councilId={user.councilId}');
  });
});

describe.each(drivers)('$name driver: Sprint 8Q', (d) => {
  it('saves a headline and layout, and feeds every member of the council', async () => {
    const db = await d.make();
    const historian = (await db.elections.listOfficerSeats(OWN)).find((s) => s.roleName === COUNCIL_HISTORIAN_ROLE)!;
    await db.elections.assignAppointedRole(MEMBER.superAdmin, OWN, historian.roleId, MEMBER.member);
    const first = await db.history.saveHistorianBulletin(MEMBER.member, OWN, '2026-08', 'August text');
    expect(first).toMatchObject({ headline: null, body_format: 'STRUCTURED' });
    await db.history.saveHistorianBulletin(MEMBER.member, OWN, '2026-09', '## Fall\n\nDrive', { headline: 'Fall Drive', body_format: 'PLAIN' });
    const kept = await db.history.saveHistorianBulletin(MEMBER.member, OWN, '2026-09', '## Fall\n\nCoat drive');
    expect(kept).toMatchObject({ headline: 'Fall Drive', body_format: 'PLAIN', body: '## Fall\n\nCoat drive' });
    await db.history.saveHistorianBulletin(MEMBER.member, OWN, '2026-12', 'Drafted ahead');
    await expectRule(db.history.saveHistorianBulletin(MEMBER.member, OWN, '2026-10', 'x', { body_format: 'RICH' as never }), 'INVALID_INPUT');

    const feed = await db.history.listBulletinFeed(MEMBER.newMember, OWN);
    expect(feed.map((b) => [b.bulletin_month, b.headline ?? null])).toEqual([
      ['2026-09', 'Fall Drive'],
      ['2026-08', null],
    ]);
    expect((await db.history.listBulletinFeed(MEMBER.superAdmin, OWN)).length).toBe(2);
    await expectRule(db.history.listBulletinFeed(MEMBER.member, 2), 'COUNCIL_ACCESS_DENIED');
  });

  it('switches biometric sign-in for the council editors only', async () => {
    const db = await d.make();
    expect(biometricLoginEnabled(await db.councils.get(OWN))).toBe(true);
    await expectRule(db.councils.setBiometricLoginEnabled(MEMBER.member, OWN, false), 'ADMIN_REQUIRED');
    await expectRule(db.councils.setBiometricLoginEnabled(MEMBER.admin, OWN, 'no' as never), 'INVALID_INPUT');
    expect((await db.councils.setBiometricLoginEnabled(MEMBER.admin, OWN, false)).biometric_login_enabled).toBe(0);
    expect(biometricLoginEnabled(await db.councils.get(OWN))).toBe(false);
  });
});

// ---- the phone honours the council's biometric switch ------------------------------------------------------

beforeEach(() => _reset());

const scanner: BiometricScanner = { available: async () => true, scan: async () => true };
const keystore = {
  getItemAsync: (k: string) => SecureStore.getItemAsync(k),
  setItemAsync: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  deleteItemAsync: (k: string) => SecureStore.deleteItemAsync(k),
};
const PASSWORD = 'dev-pass-secure-9912';

async function atPasswordPrompt(db: DataService, biometric: BiometricLogin) {
  const c = new OnboardingController({ db, sessions: sessionStore, councilNumber: 15295, biometric });
  await c.start();
  await c.submitEmail('testmember@kofc.org');
  await c.submitPassword('any-password-at-all', 'any-password-at-all');
  return c;
}

describe.each(drivers)('$name driver: the council biometric switch on the phone', (d) => {
  it('mints no key while the council has it off, and forgets a stored key at its next use', async () => {
    const db = await d.make();
    const biometric = new BiometricLogin(keystore, scanner, async () => 'ab'.repeat(32));
    await db.councils.setBiometricLoginEnabled(MEMBER.admin, OWN, false);
    const off = await atPasswordPrompt(db, biometric);
    expect(await off.submitPassword(PASSWORD, undefined, undefined, { enableBiometric: true })).toMatchObject({ screen: 'signedIn' });
    expect(await off.biometricEmail()).toBeNull();

    await db.councils.setBiometricLoginEnabled(MEMBER.admin, OWN, true);
    _reset();
    const on = await atPasswordPrompt(db, biometric);
    await on.submitPassword(PASSWORD, undefined, undefined, { enableBiometric: true });
    expect(await on.biometricEmail()).toBe('testmember@kofc.org');

    await db.councils.setBiometricLoginEnabled(MEMBER.admin, OWN, false);
    expect(await biometric.signIn(db)).toEqual({ ok: false, reason: 'councilOff' });
    expect(await biometric.enrolledEmail()).toBeNull();
  });
});
