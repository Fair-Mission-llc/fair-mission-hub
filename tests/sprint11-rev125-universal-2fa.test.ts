// Sprint 11 Revision 12.5 (schema stays 110): the universal sign-in code switch (TWO_FACTOR_REQUIRED=1) with its lockout
// guard, the hub phone's code screen, and the one-time-code keyboard hints on the phone and the web.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BusinessRuleError,
  PLATFORM_SCHEMA_VERSION,
  TWO_FACTOR_NO_CONTACT_MESSAGE,
  TWO_FACTOR_REQUIRED_ENV,
  TWO_FACTOR_ROUTE,
  twoFactorRequiredFor,
  universalTwoFactorOn,
  type DataService,
  type SessionUser,
} from '@kofc/shared';
import { issueTwoFactorChallenge, TwoFactorContactMissingError, verifyTwoFactorChallenge } from '../apps/web/services/server/two-factor';
import { OnboardingController, type TwoFactorVerifier } from '../apps/mobile/services/onboarding';
import type { SessionStore } from '../apps/mobile/services/session';

const read = (path: string) => readFileSync(path, 'utf8');

const member: SessionUser = {
  credentialId: 9,
  memberId: 9,
  councilId: 1,
  username: 'member_alpha@stmarys.org',
  firstName: 'Alpha',
  lastName: 'Member',
  memberType: 'Member',
  roles: [],
  isOfficer: false,
  isBudgetDirector: false,
};
const SECRET = { PORTAL_SESSION_SECRET: 'x'.repeat(40) };
const TWILIO = { ...SECRET, TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'secret-token', TWILIO_FROM_NUMBER: '+15035550100' };
const UNIVERSAL = { ...TWILIO, [TWO_FACTOR_REQUIRED_ENV]: '1' };

describe('1. the universal switch', () => {
  it('keeps schema 110', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(110);
  });

  it('reads TWO_FACTOR_REQUIRED=1 (or true) from the environment', () => {
    expect(TWO_FACTOR_REQUIRED_ENV).toBe('TWO_FACTOR_REQUIRED');
    expect(universalTwoFactorOn({ TWO_FACTOR_REQUIRED: '1' })).toBe(true);
    expect(universalTwoFactorOn({ TWO_FACTOR_REQUIRED: ' TRUE ' })).toBe(true);
    expect(universalTwoFactorOn({ TWO_FACTOR_REQUIRED: '0' })).toBe(false);
    expect(universalTwoFactorOn({})).toBe(false);
  });

  it('asks every member type while on, and keeps the Admin and Super Admin baseline while off', () => {
    for (const type of ['Member', 'Officer', 'Admin', 'Super Admin', undefined]) expect(twoFactorRequiredFor(type, true)).toBe(true);
    expect(twoFactorRequiredFor('Member', false)).toBe(false);
    expect(twoFactorRequiredFor('Admin', false)).toBe(true);
    expect(twoFactorRequiredFor('Super Admin')).toBe(true);
  });

  it('texts a plain member a code once the switch is on, and the code signs the member in', async () => {
    const sent: { to: string; code: string }[] = [];
    const now = new Date(2026, 9, 29, 12, 0, 0);
    const send = async (_c: string, to: string, code: string) => void sent.push({ to, code });
    expect(await issueTwoFactorChallenge({ user: member, active: true }, { phone: '5035550142' }, { env: TWILIO, send, now })).toBeNull();
    const prompt = await issueTwoFactorChallenge({ user: member, active: true }, { phone: '5035550142' }, { env: UNIVERSAL, send, now });
    expect(prompt).toMatchObject({ channel: 'sms', sentTo: '***-***-0142' });
    expect(sent).toEqual([{ to: '+15035550142', code: expect.stringMatching(/^\d{6}$/) }]);
    const verdict = verifyTwoFactorChallenge(prompt!.challenge, sent[0].code, { env: UNIVERSAL, now });
    expect(verdict.ok && verdict.user.memberId).toBe(9);
  });
});

describe('2. the lockout guard (the user\'s choice)', () => {
  const send = async () => {
    throw new Error('must not send');
  };

  it('keeps sign-in one step when the switch is on but no provider is connected', async () => {
    expect(await issueTwoFactorChallenge({ user: member, active: true }, { phone: '5035550142', email: 'a@example.org' }, { env: { ...SECRET, TWO_FACTOR_REQUIRED: '1' }, send })).toBeNull();
  });

  it('refuses a member with no usable phone or email while the switch is on and a provider is connected', async () => {
    await expect(issueTwoFactorChallenge({ user: member, active: true }, { phone: '12', email: '' }, { env: UNIVERSAL, send })).rejects.toBeInstanceOf(
      TwoFactorContactMissingError,
    );
    expect(TWO_FACTOR_NO_CONTACT_MESSAGE).toMatch(/Ask your council admin to add your cell phone/);
  });

  it('keeps the old one-step fallback for an Admin without contact details while the switch is off', async () => {
    expect(await issueTwoFactorChallenge({ user: { ...member, memberType: 'Admin' }, active: true }, { phone: null }, { env: TWILIO, send })).toBeNull();
  });

  it('wires the refusal into the web session route and the hub door, and reports the switch on GET', () => {
    const session = read('apps/web/app/api/auth/session/route.ts');
    expect(session).toContain('err instanceof TwoFactorContactMissingError');
    expect(session).toContain('{ status: 403 }');
    const hub = read('apps/web/app/api/sync/replicate/route.ts');
    expect(hub).toContain("new BusinessRuleError('TWO_FACTOR_CODE_REQUIRED'");
    expect(hub).toContain("new BusinessRuleError('TWO_FACTOR_UNAVAILABLE'");
    expect(read('apps/web/app/api/auth/two-factor/route.ts')).toContain('universal: universalTwoFactorOn(process.env)');
  });

  it('lets biometric and passkey sign-ins through without a code', () => {
    expect(read('apps/web/app/api/auth/webauthn/login/route.ts')).not.toContain('issueTwoFactorChallenge');
    expect(read('apps/mobile/services/onboarding.ts')).toMatch(/submitBiometric[\s\S]*?this\.finish\(result\.user\)/);
  });
});

// A phone whose hub answers a right password with TWO_FACTOR_CODE_REQUIRED.
function hubPhone(verify?: TwoFactorVerifier) {
  const saved: SessionUser[] = [];
  const prompt = { challenge: 'signed.challenge', channel: 'sms', sentTo: '***-***-0142', expiresInSeconds: 300 };
  const db = {
    members: { getByEmail: async () => ({ Email: 'member_alpha@stmarys.org', MemberFirstName: 'Alpha' }) },
    auth: {
      signIn: async (_u: string, password: string) => {
        if (password !== 'right-password') return null;
        throw new BusinessRuleError('TWO_FACTOR_CODE_REQUIRED', 'We texted a 6-digit code to ***-***-0142.', { twoFactor: prompt });
      },
    },
  } as unknown as DataService;
  const sessions = { save: async (u: SessionUser) => void saved.push(u), restore: async () => null, clear: async () => undefined } as unknown as SessionStore;
  return { controller: new OnboardingController({ db, sessions, councilNumber: 15295, verifyTwoFactor: verify }), saved };
}

describe('3. the hub phone code screen', () => {
  it('moves from the password to the code screen, then signs in with the right code', async () => {
    const tried: string[] = [];
    const { controller, saved } = hubPhone(async (challenge, code) => {
      tried.push(`${challenge}:${code}`);
      return code === '123456' ? { user: member } : { message: 'That code is not correct. 4 tries left.' };
    });
    await controller.start();
    await controller.submitEmail('member_alpha@stmarys.org');
    expect((await controller.submitPassword('wrong')).screen).toBe('signIn');
    const coded = await controller.submitPassword('right-password');
    expect(coded).toMatchObject({ screen: 'twoFactorCode', prompt: { sentTo: '***-***-0142', channel: 'sms' } });
    expect(await controller.submitTwoFactorCode('12')).toMatchObject({ screen: 'twoFactorCode', error: 'Type the 6-digit code.' });
    expect(await controller.submitTwoFactorCode('000000')).toMatchObject({ screen: 'twoFactorCode', error: 'That code is not correct. 4 tries left.' });
    expect(await controller.submitTwoFactorCode('123456')).toMatchObject({ screen: 'signedIn', user: { memberId: 9 } });
    expect(saved.map((u) => u.memberId)).toEqual([9]);
    expect(tried).toEqual(['signed.challenge:000000', 'signed.challenge:123456']);
  });

  it('Start over returns to the password prompt', async () => {
    const { controller } = hubPhone(async () => ({ user: member }));
    await controller.start();
    await controller.submitEmail('member_alpha@stmarys.org');
    await controller.submitPassword('right-password');
    expect(controller.cancelTwoFactor()).toEqual({ screen: 'signIn', email: 'member_alpha@stmarys.org' });
  });

  it('shows a hub refusal in words on the password prompt', async () => {
    const db = {
      members: { getByEmail: async () => ({ Email: 'member_alpha@stmarys.org', MemberFirstName: 'Alpha' }) },
      auth: {
        signIn: async () => {
          throw new BusinessRuleError('TWO_FACTOR_UNAVAILABLE', TWO_FACTOR_NO_CONTACT_MESSAGE, {});
        },
      },
    } as unknown as DataService;
    const c = new OnboardingController({ db, sessions: { restore: async () => null } as unknown as SessionStore, councilNumber: 15295 });
    await c.start();
    await c.submitEmail('member_alpha@stmarys.org');
    expect(await c.submitPassword('x')).toMatchObject({ screen: 'signIn', error: TWO_FACTOR_NO_CONTACT_MESSAGE });
  });

  it('checks the code at the hub only in hub mode', () => {
    const verifier = read('apps/mobile/services/hub-two-factor.ts');
    expect(verifier).toContain('HUB_MODE ? verifyOnHub : undefined');
    expect(verifier).toContain('`${HUB_URL}${TWO_FACTOR_ROUTE}`');
    expect(TWO_FACTOR_ROUTE).toBe('/api/auth/two-factor');
    expect(read('apps/mobile/lib/app-context.tsx')).toContain('verifyTwoFactor: hubTwoFactorVerifier');
  });
});

describe('4. one-time-code keyboard hints', () => {
  it('the phone code box offers the texted code above the keyboard on iOS and Android', () => {
    const screen = read('apps/mobile/app/sign-in.tsx');
    const box = screen.slice(screen.indexOf("state.screen === 'twoFactorCode'"), screen.indexOf("state.screen === 'forgotPassword'"));
    expect(box).toContain('textContentType="oneTimeCode"');
    expect(box).toContain('autoComplete="one-time-code"');
    expect(box).toContain('keyboardType="number-pad"');
    expect(box).toContain('maxLength={6}');
    // The reset code box gets the Android hint too.
    expect(screen.match(/autoComplete="one-time-code"/g)).toHaveLength(2);
  });

  it('the web code box uses the browser one-time-code hint', () => {
    const shell = read('apps/web/components/Shell.tsx');
    const card = shell.slice(shell.indexOf('function TwoFactorCodeCard()'));
    expect(card).toContain('autoComplete="one-time-code"');
    expect(card).toContain('inputMode="numeric"');
    expect(card).toContain('name="one-time-code"');
  });
});
