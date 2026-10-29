// Sprint 11 Revision 12.0 (schema 110): framework upgrades, sign-in codes for Admins and Super Admins (Twilio / SendGrid),
// mail separation, and Council.parent_organization.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildTwilioSmsRequest,
  chooseTwoFactorChannel,
  cleanGlobalCouncilParameters,
  cleanParentOrganization,
  cleanTwoFactorCode,
  councilParentOrganization,
  councilTenantType,
  DEPLOYMENT_MATRIX_TITLES,
  FRATERNAL_FEATURE_FLAGS,
  generateTwoFactorCode,
  isPlatformOperationsSender,
  maskTwoFactorTarget,
  normalizeSmsNumber,
  outboundMailRoute,
  PLATFORM_OPERATIONS_SENDER,
  PLATFORM_SCHEMA_VERSION,
  SETTINGS_PAGE_TITLES,
  tenantFeatureDeployment,
  TWO_FACTOR_MAX_ATTEMPTS,
  twoFactorEmail,
  twoFactorRequiredFor,
  twoFactorRows,
  type SessionUser,
} from '@kofc/shared';
import { issueTwoFactorChallenge, twilioCredentials, twoFactorDelivery, verifyTwoFactorChallenge } from '../apps/web/services/server/two-factor';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(path, 'utf8');
const json = (path: string) => JSON.parse(read(path));

describe('1. framework upgrades', () => {
  it('runs Expo SDK 58, React 19.3, Electron 45 and Vitest 5', () => {
    const mobile = json('apps/mobile/package.json');
    expect(mobile.dependencies.expo).toBe('~58.0.21');
    expect(mobile.dependencies['expo-router']).toBe('~58.0.28');
    expect(mobile.dependencies['react-native']).toBe('0.88.1');
    expect(mobile.dependencies.react).toBe('19.3.0');
    expect(json('apps/web/package.json').dependencies.react).toBe('19.3.0');
    const root = json('package.json');
    expect(root.devDependencies.electron).toBe('^45.1.0');
    expect(root.devDependencies.vitest).toBe('^5.0.5');
  });

  it('types the phone scroll refs with React Native 0.88 ScrollViewInstance', () => {
    expect(read('apps/mobile/components/ui.tsx')).toContain('scrollRef?: RefObject<ScrollViewInstance | null>;');
    expect(read('apps/mobile/app/(app)/donate.tsx')).toContain('useRef<ScrollViewInstance>(null)');
  });
});

describe('2. Council.parent_organization (schema 110)', () => {
  it('adds the column and moves the platform to 110', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(110);
    expect(read('Schema.sql')).toContain("ALTER TABLE [Council] ADD [parent_organization] VARCHAR(30) NOT NULL DEFAULT 'KofC';");
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toContain('const SCHEMA_VERSION = 110;');
  });

  it('reads parent_organization first and falls back to tenant_type', () => {
    expect(councilParentOrganization({})).toBe('KofC');
    expect(councilParentOrganization({ tenant_type: 'GENERIC' })).toBe('SECULAR_CHARITY');
    expect(councilParentOrganization({ parent_organization: 'kofc', tenant_type: 'GENERIC' })).toBe('KofC');
    expect(councilParentOrganization({ parent_organization: 'anything else' })).toBe('SECULAR_CHARITY');
    expect(councilTenantType({ parent_organization: 'SECULAR_CHARITY', tenant_type: 'KOFC' })).toBe('GENERIC');
    expect(councilTenantType({ parent_organization: 'KofC' })).toBe('KOFC');
    expect(cleanParentOrganization('secular_charity')).toBe('SECULAR_CHARITY');
    expect(() => cleanParentOrganization('Church')).toThrow();
  });

  it('saves the parent organization and the tenant type together, and refuses a mismatch', () => {
    expect(cleanGlobalCouncilParameters({ parent_organization: 'SECULAR_CHARITY' })).toEqual({ parent_organization: 'SECULAR_CHARITY', tenant_type: 'GENERIC' });
    expect(cleanGlobalCouncilParameters({ parent_organization: 'KofC', tenant_type: 'KOFC' })).toEqual({ parent_organization: 'KofC', tenant_type: 'KOFC' });
    expect(() => cleanGlobalCouncilParameters({ parent_organization: 'KofC', tenant_type: 'GENERIC' })).toThrow(/goes with tenant type KOFC/);
  });

  it('masks the fraternal switches and speaks corporate language for a secular charity', () => {
    const kofc = tenantFeatureDeployment({ parent_organization: 'KofC' });
    const secular = tenantFeatureDeployment({ parent_organization: 'SECULAR_CHARITY' });
    for (const flag of FRATERNAL_FEATURE_FLAGS) {
      expect(kofc.map((r) => r.id)).toContain(flag);
      expect(secular.map((r) => r.id)).not.toContain(flag);
    }
    expect(secular.map((r) => `${r.label} ${r.description}`).join(' ')).not.toMatch(/\bCouncil\b|Knights|Fraternal|Grand Knight/);
    expect(SETTINGS_PAGE_TITLES).toEqual({ KofC: 'Council Wide Settings', SECULAR_CHARITY: 'Organization Settings' });
    expect(DEPLOYMENT_MATRIX_TITLES.SECULAR_CHARITY).toBe('Organization Feature Matrix');
  });

  it('shows Form 1728 only to Knights of Columbus tenants', () => {
    expect(read('apps/web/components/Form1728Parts.tsx')).toContain("return useTenantType() === 'KOFC';");
    for (const file of ['apps/web/app/events/page.tsx', 'apps/web/app/activities/page.tsx', 'apps/web/components/modules/CouncilLookupTables.tsx'])
      expect(read(file), file).toContain('useForm1728Enabled()');
    expect(read('apps/web/components/GlobalParametersCard.tsx')).toContain('parent_organization: parent');
  });
});

describe.each(drivers)('3. the parent organization in the $name driver', (d) => {
  it('starts every council as KofC and keeps tenant_type in step on save', async () => {
    const db = await d.make();
    expect((await db.councils.get(1))!.parent_organization).toBe('KofC');
    const saved = await db.councils.setGlobalParameters(MEMBER.superAdmin, 1, { parent_organization: 'SECULAR_CHARITY' });
    expect(saved).toMatchObject({ parent_organization: 'SECULAR_CHARITY', tenant_type: 'GENERIC' });
    expect(councilTenantType(await db.councils.get(1))).toBe('GENERIC');
    const back = await db.councils.setGlobalParameters(MEMBER.superAdmin, 1, { tenant_type: 'KOFC' });
    expect(back).toMatchObject({ parent_organization: 'KofC', tenant_type: 'KOFC' });
    await expectRule(db.councils.setGlobalParameters(MEMBER.admin, 1, { parent_organization: 'SECULAR_CHARITY' }), 'SUPER_ADMIN_REQUIRED');
  });
});

const admin: SessionUser = {
  credentialId: 2,
  memberId: 2,
  councilId: 1,
  username: 'testadmin@kofc.org',
  firstName: 'Council',
  lastName: 'Admin',
  memberType: 'Admin',
  roles: [],
  isOfficer: false,
  isBudgetDirector: false,
};
const TWILIO = { TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'secret-token', TWILIO_FROM_NUMBER: '+15035550100', PORTAL_SESSION_SECRET: 'x'.repeat(40) };

describe('4. sign-in codes for Admins and Super Admins', () => {
  it('asks only Admins and Super Admins, by SMS first, then email, only when a channel is configured', () => {
    expect(twoFactorRequiredFor('Admin')).toBe(true);
    expect(twoFactorRequiredFor('Super Admin')).toBe(true);
    expect(twoFactorRequiredFor('Member')).toBe(false);
    const contact = { phone: '503-555-0142', email: 'a@example.org' };
    expect(chooseTwoFactorChannel({ sms: true, email: true }, contact)).toBe('sms');
    expect(chooseTwoFactorChannel({ sms: true, email: true }, contact, 'email')).toBe('email');
    expect(chooseTwoFactorChannel({ sms: false, email: true }, contact)).toBe('email');
    expect(chooseTwoFactorChannel({ sms: true, email: false }, { phone: '12' })).toBeNull();
    expect(chooseTwoFactorChannel({ sms: false, email: false }, contact)).toBeNull();
  });

  it('formats numbers, codes and masks', () => {
    expect(normalizeSmsNumber('(503) 555-0142')).toBe('+15035550142');
    expect(normalizeSmsNumber('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalizeSmsNumber('555-0142')).toBeNull();
    for (let i = 0; i < 50; i++) expect(generateTwoFactorCode()).toMatch(/^\d{6}$/);
    expect(cleanTwoFactorCode(' 123-456 ')).toBe('123456');
    expect(cleanTwoFactorCode('12345')).toBeNull();
    expect(maskTwoFactorTarget('sms', { phone: '503-555-0142' })).toBe('***-***-0142');
    expect(maskTwoFactorTarget('email', { email: 'michael@kofc15295.org' })).toBe('m***@kofc15295.org');
  });

  it('builds the Twilio request with Basic auth and the platform sender for email codes', () => {
    const req = buildTwilioSmsRequest({ accountSid: 'AC123', authToken: 'tok', fromNumber: '+15035550100' }, '+15035550142', 'hi');
    expect(req.url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect(req.headers.Authorization).toBe(`Basic ${btoa('AC123:tok')}`);
    expect(new URLSearchParams(req.body).get('To')).toBe('+15035550142');
    expect(twoFactorEmail('a@example.org', '123456').from).toBe(PLATFORM_OPERATIONS_SENDER);
  });

  it('reads the delivery tokens from the environment', () => {
    expect(twilioCredentials(TWILIO)).toEqual({ accountSid: 'AC123', authToken: 'secret-token', fromNumber: '+15035550100' });
    expect(twilioCredentials({ TWILIO_ACCOUNT_SID: 'AC123' })).toBeNull();
    expect(twoFactorDelivery({})).toEqual({ sms: false, email: false });
    expect(twoFactorDelivery({ SENDGRID_API_KEY: 'SG.x', SENDGRID_LIVE: '1' }).email).toBe(true);
  });

  it('skips the step for members and when nothing is configured', async () => {
    const sent: string[] = [];
    const send = async (_c: string, _to: string, code: string) => void sent.push(code);
    expect(await issueTwoFactorChallenge({ user: { ...admin, memberType: 'Member' }, active: true }, { phone: '5035550142' }, { env: TWILIO, send })).toBeNull();
    expect(await issueTwoFactorChallenge({ user: admin, active: true }, { phone: '5035550142' }, { env: {}, send })).toBeNull();
    expect(sent).toEqual([]);
  });

  it('accepts the right code once, counts wrong codes, and refuses replays, expiry and tampering', async () => {
    const sent: { channel: string; to: string; code: string }[] = [];
    const send = async (channel: string, to: string, code: string) => void sent.push({ channel, to, code });
    const now = new Date(2026, 9, 29, 12, 0, 0);
    const prompt = (await issueTwoFactorChallenge({ user: admin, active: true }, { phone: '503-555-0142' }, { env: TWILIO, send, now }))!;
    expect(prompt).toMatchObject({ channel: 'sms', sentTo: '***-***-0142', expiresInSeconds: 300 });
    expect(sent[0]).toMatchObject({ channel: 'sms', to: '+15035550142' });
    expect(prompt.challenge).not.toContain(sent[0].code);
    const code = sent[0].code;
    const wrong = code === '000000' ? '111111' : '000000';

    const miss = verifyTwoFactorChallenge(prompt.challenge, wrong, { env: TWILIO, now });
    expect(miss).toMatchObject({ ok: false, status: 401 });
    expect(verifyTwoFactorChallenge(`${prompt.challenge.split('.')[0]}.forged`, code, { env: TWILIO, now })).toMatchObject({ ok: false, status: 401 });
    expect(verifyTwoFactorChallenge(prompt.challenge, code, { env: { PORTAL_SESSION_SECRET: 'y'.repeat(40) }, now })).toMatchObject({ ok: false });
    expect(verifyTwoFactorChallenge(prompt.challenge, code, { env: TWILIO, now: new Date(now.getTime() + 301_000) })).toMatchObject({ ok: false, status: 401 });

    const ok = verifyTwoFactorChallenge(prompt.challenge, code, { env: TWILIO, now });
    expect(ok).toMatchObject({ ok: true, active: true });
    expect(ok.ok && ok.user.memberId).toBe(2);
    expect(verifyTwoFactorChallenge(prompt.challenge, code, { env: TWILIO, now })).toMatchObject({ ok: false, status: 401 });
  });

  it(`locks a challenge after ${TWO_FACTOR_MAX_ATTEMPTS} wrong codes`, async () => {
    const sent: string[] = [];
    const now = new Date(2026, 9, 29, 12, 0, 0);
    const prompt = (await issueTwoFactorChallenge({ user: admin, active: true }, { email: 'a@example.org' }, {
      env: { SENDGRID_API_KEY: 'SG.x', SENDGRID_LIVE: '1', PORTAL_SESSION_SECRET: 'x'.repeat(40) },
      send: async (_c, _t, c) => void sent.push(c),
      now,
    }))!;
    expect(prompt.channel).toBe('email');
    const env = { PORTAL_SESSION_SECRET: 'x'.repeat(40) };
    const wrong = sent[0] === '000000' ? '111111' : '000000';
    for (let i = 0; i < TWO_FACTOR_MAX_ATTEMPTS; i++) verifyTwoFactorChallenge(prompt.challenge, wrong, { env, now });
    expect(verifyTwoFactorChallenge(prompt.challenge, sent[0], { env, now })).toMatchObject({ ok: false, status: 429 });
  });

  it('wires the step into the sign-in route, the code route and the sign-in card', () => {
    expect(read('apps/web/app/api/auth/session/route.ts')).toContain('issueTwoFactorChallenge(outcome, outcome.contact');
    expect(read('apps/web/app/api/auth/two-factor/route.ts')).toContain('verifyTwoFactorChallenge(body?.challenge, body?.code)');
    const shell = read('apps/web/components/Shell.tsx');
    expect(shell).toContain('function TwoFactorCodeCard()');
    expect(shell).toContain('autoComplete="one-time-code"');
  });

  it('reports the SMS and email rows from the delivery facts', () => {
    const base = { phone: '503-555-0142', email: 'a@example.org', emailGatewayConnected: false, passkeySupported: true, passkeyOnThisDevice: false };
    const rows = (delivery?: { sms: boolean; email: boolean }, requiredForMember = true) =>
      Object.fromEntries(twoFactorRows({ ...base, delivery, requiredForMember }).map((r) => [r.method.id, r.status]));
    expect(rows()).toMatchObject({ sms: 'not-wired', email: 'not-wired' });
    expect(rows({ sms: true, email: true })).toMatchObject({ sms: 'ready', email: 'ready' });
    expect(rows({ sms: true, email: true }, false)).toMatchObject({ sms: 'available', email: 'available' });
  });
});

describe('5. mail separation', () => {
  it('sends platform notices from the platform address and council mail only through the council account', () => {
    expect(PLATFORM_OPERATIONS_SENDER).toBe('tim@fairmissionsoftware.com');
    expect(outboundMailRoute('platform-operations', false)).toEqual({ via: 'platform-sendgrid', from: PLATFORM_OPERATIONS_SENDER });
    expect(outboundMailRoute('council-distribution', true)).toEqual({ via: 'council-smtp' });
    expect(outboundMailRoute('council-distribution', false).via).toBe('held');
    expect(isPlatformOperationsSender(' TIM@fairmissionsoftware.com ')).toBe(true);
    expect(read('apps/web/services/server/notify.ts')).toContain("outboundMailRoute('platform-operations', false)");
    expect(read('apps/web/app/api/notifications/email/route.ts')).toContain('isPlatformOperationsSender(email.from) && !(claims !== null && hasSuperAdminRights(');
  });
});
