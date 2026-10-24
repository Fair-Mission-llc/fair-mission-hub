// Sprint 9 Revision 1.0: the phone sign-in screen must never run the Face ID / fingerprint scanner on its own. Loading
// the email or password prompt only reads the keystore and asks whether the phone has a scanner; the scan itself runs
// only when the member taps "Sign In with FaceID / Biometrics" (or turns on the enrollment toggle), and only when this
// phone holds a biometric key for the member.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it } from 'vitest';
import { BiometricLogin, type BiometricScanner } from '../apps/mobile/services/biometric-login';
import { OnboardingController } from '../apps/mobile/services/onboarding';
import { sessionStore } from '../apps/mobile/services/session';
import { _reset } from './shims/expo-secure-store';
import { drivers } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const EMAIL = 'testmember@kofc.org';
const PASSWORD = 'dev-pass-secure-9912';

beforeEach(() => _reset());

/** A fake scanner that counts hardware probes and scans. */
const scanner = (opts: { available?: boolean; pass?: boolean } = {}) => {
  const calls = { probes: 0, scans: 0 };
  const s: BiometricScanner = {
    available: async () => {
      calls.probes++;
      return opts.available ?? true;
    },
    scan: async () => {
      calls.scans++;
      return opts.pass ?? true;
    },
  };
  return { s, calls };
};
const keystore = {
  getItemAsync: (k: string) => SecureStore.getItemAsync(k),
  setItemAsync: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  deleteItemAsync: (k: string) => SecureStore.deleteItemAsync(k),
};
const biometricWith = (s: BiometricScanner) => new BiometricLogin(keystore, s, async () => 'ab'.repeat(32));

/** What the sign-in screen's mount effect (app-context.tsx) asks for when a prompt screen is shown. */
const mountPrompt = (c: OnboardingController) => Promise.all([c.biometricEmail(), c.biometricAvailable()]);

describe('the sign-in screen source', () => {
  it('the mount effect only reads the key and the hardware, never the scan', () => {
    const ctx = read('apps/mobile/lib/app-context.tsx');
    const effect = ctx.slice(ctx.indexOf('const promptScreen'), ctx.indexOf('const submitBiometric'));
    expect(effect).toContain('useEffect(');
    expect(effect).toContain('controller.biometricEmail()');
    expect(effect).toContain('controller.biometricAvailable()');
    expect(effect).not.toMatch(/submitBiometric|signIn\(|scan\(|authenticateAsync/);
  });

  it('the screen starts a biometric sign-in only from a button press', () => {
    const screen = read('apps/mobile/app/sign-in.tsx');
    expect(screen).not.toMatch(/useEffect\([^]*?submitBiometric[^]*?\}, \[/);
    const uses = screen.match(/submitBiometric/g) ?? [];
    const pressed = screen.match(/onPress=\{\(\) => void run\(submitBiometric\)\}/g) ?? [];
    // One use is the destructure from useApp(); every other use is a button's onPress.
    expect(pressed.length).toBeGreaterThan(0);
    expect(uses.length).toBe(pressed.length + 1);
  });

  it('only the device scanner wrapper calls the native biometric prompt', () => {
    for (const path of ['apps/mobile/app/sign-in.tsx', 'apps/mobile/app/_layout.tsx', 'apps/mobile/lib/app-context.tsx', 'apps/mobile/services/onboarding.ts']) {
      expect(read(path)).not.toContain('authenticateAsync');
    }
    expect(read('apps/mobile/services/biometric-login.ts').match(/authenticateAsync/g)).toHaveLength(1);
  });
});

describe.each(drivers)('$name driver: the sign-in screen mounts without scanning', (d) => {
  it('with no key on the phone, mounting never scans and never probes the hardware for the button', async () => {
    const db = await d.make();
    const { s, calls } = scanner();
    const biometric = biometricWith(s);
    const c = new OnboardingController({ db, sessions: sessionStore, councilNumber: 15295, biometric });
    await c.start();
    calls.probes = 0;

    expect(await biometric.enrolledEmail()).toBeNull();
    expect(calls.probes).toBe(0); // no key: the button check stops before the hardware

    const [email, available] = await mountPrompt(c);
    expect(email).toBeNull();
    expect(available).toBe(true); // the toggle may show, but showing it is not a scan
    expect(calls.scans).toBe(0);
  });

  it('with no key, a biometric sign-in attempt ends before the scanner', async () => {
    const db = await d.make();
    const { s, calls } = scanner();
    const result = await biometricWith(s).signIn(db);
    expect(result).toEqual({ ok: false, reason: 'noKey' });
    expect(calls).toEqual({ probes: 0, scans: 0 });
  });

  it('with a key on the phone, mounting still does not scan; one tap scans once and signs in', async () => {
    const db = await d.make();
    const { s, calls } = scanner();
    const biometric = biometricWith(s);
    await biometric.enroll(await db.auth.signIn(EMAIL, PASSWORD), EMAIL);
    const c = new OnboardingController({ db, sessions: sessionStore, councilNumber: 15295, biometric });
    await c.start();

    for (let i = 0; i < 3; i++) await mountPrompt(c); // re-renders and screen changes re-run the effect
    expect(await c.biometricEmail()).toBe(EMAIL);
    expect(calls.scans).toBe(0);

    expect(await c.submitBiometric()).toMatchObject({ screen: 'signedIn' });
    expect(calls.scans).toBe(1);
  });

  it('on a phone without a scanner, a stored key hides the button and mounting never scans', async () => {
    const db = await d.make();
    const { s, calls } = scanner({ available: false });
    const biometric = biometricWith(s);
    await biometric.enroll(await db.auth.signIn(EMAIL, PASSWORD), EMAIL);
    const c = new OnboardingController({ db, sessions: sessionStore, councilNumber: 15295, biometric });
    await c.start();
    expect(await mountPrompt(c)).toEqual([null, false]);
    expect(calls.scans).toBe(0);
  });
});
