// Sprint 8P Stage 2 (schema version 88): the Grand Knight and Financial Secretary Desks' zero-traverse action drawers with
// the Alert Boundary Accent, and the phone password prompt's '[ 🔘 Enable FaceID / Biometric Login ]' toggle.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BACK_TO_DESK_BLOTTER_LABEL,
  DESK_DRAWERS,
  DESK_FOCUS_TARGETS,
  deskDrawersFor,
  fsPaymentRequestAlert,
  gkSignatureAlert,
  type DataService,
  type ExpenseReport,
} from '@kofc/shared';
import { BiometricLogin, type BiometricScanner } from '../apps/mobile/services/biometric-login';
import { BIOMETRIC_TOGGLE_LABEL, OnboardingController } from '../apps/mobile/services/onboarding';
import { sessionStore } from '../apps/mobile/services/session';
import { _reset } from './shims/expo-secure-store';
import { drivers } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const seat = (roles: string[], memberType: 'Member' | 'Admin' | 'Super Admin' = 'Member', memberId = 7) => ({
  memberId,
  councilId: OWN,
  memberType,
  isOfficer: roles.length > 0,
  roles,
});
const GK = seat(['Grand Knight']);
const DGK = seat(['Deputy Grand Knight']);
const FS = seat(['Financial Secretary']);
const ids = (u: ReturnType<typeof seat>, desk: 'grand-knight' | 'financial-secretary') => deskDrawersFor(u, desk, OWN).map((d) => d.id);

const sheet = (over: Partial<ExpenseReport> = {}) => ({
  report: {
    id: 1,
    CouncilID: OWN,
    SubmitterMemberID: 50,
    Status: 'Submitted',
    FinancialSecretaryMemberID: null,
    TreasurerMemberID: null,
    ...over,
  } as unknown as ExpenseReport,
});

describe('the drawer catalogue', () => {
  it('names every drawer the two desks were asked for', () => {
    expect(DESK_DRAWERS.filter((d) => d.desk === 'grand-knight').map((d) => d.title)).toEqual(
      expect.arrayContaining(['Approved Expenses', 'Shared Loaner Library', 'Planning & Budgeting Workflow', '[ 🗳️ Council Election Workflow ]', 'Operations Knowledge Archive']),
    );
    expect(DESK_DRAWERS.filter((d) => d.desk === 'financial-secretary').map((d) => d.title)).toEqual(
      expect.arrayContaining(['Payment Requests', 'Expense Report (ER) Routing Track', 'Charitable Donation Records', 'Operations Knowledge Archive']),
    );
    expect(new Set(DESK_DRAWERS.map((d) => d.rowId)).size).toBe(DESK_DRAWERS.length);
    expect(BACK_TO_DESK_BLOTTER_LABEL).toBe('[ 🔀 Back to Desk Blotter ]');
  });

  it('keeps the badge click-throughs landing on the signing drawers', () => {
    expect(DESK_DRAWERS.find((d) => d.id === 'approved-expenses')).toMatchObject({ rowId: DESK_FOCUS_TARGETS.vouchers.rowId, alerts: true });
    expect(DESK_DRAWERS.find((d) => d.id === 'payment-requests')).toMatchObject({ rowId: DESK_FOCUS_TARGETS.orders.rowId, alerts: true });
  });

  it("gives each seat only the drawers its role clears", () => {
    const gk = ids(GK, 'grand-knight');
    expect(gk).toEqual(expect.arrayContaining(['approved-expenses', 'loaner-library', 'planning-budgeting', 'election-workflow', 'knowledge-archive', 'affiliation-invites']));
    // Sprint 8C: the Deputy holds every Grand Knight grant.
    expect(ids(DGK, 'grand-knight')).toEqual(gk);
    expect(ids(FS, 'grand-knight')).not.toContain('approved-expenses');
    expect(ids(FS, 'grand-knight')).not.toContain('loaner-library');
    expect(ids(FS, 'financial-secretary')).toEqual(
      expect.arrayContaining(['payment-requests', 'er-routing-track', 'donation-records', 'church-disbursements', 'knowledge-archive', 'roster-imports']),
    );
    expect(ids(GK, 'financial-secretary')).not.toContain('payment-requests');
    expect(ids(seat([]), 'grand-knight')).not.toContain('approved-expenses');
    // Another council's Grand Knight gets no lending or planning drawer here.
    expect(deskDrawersFor({ ...GK, councilId: 2 }, 'grand-knight', OWN).map((d) => d.id)).not.toContain('loaner-library');
  });
});

describe('the Alert Boundary Accent', () => {
  it("lights the Grand Knight's drawer only for a sheet the reader may counter-sign", () => {
    expect(gkSignatureAlert(GK, [])).toBe(false);
    expect(gkSignatureAlert(GK, [sheet({ FinancialSecretaryMemberID: 60 })])).toBe(true);
    // The Collusion Guard and the reader's own sheet never light it.
    expect(gkSignatureAlert(GK, [sheet({ FinancialSecretaryMemberID: 7 })])).toBe(false);
    expect(gkSignatureAlert(GK, [sheet({ SubmitterMemberID: 7 })])).toBe(false);
    expect(gkSignatureAlert(FS, [sheet({ FinancialSecretaryMemberID: 60 })])).toBe(false);
  });

  it("lights the Financial Secretary's drawer only for a sheet waiting for the reader's payment request", () => {
    expect(fsPaymentRequestAlert(FS, [sheet()])).toBe(true);
    expect(fsPaymentRequestAlert(FS, [sheet({ SubmitterMemberID: 7 })])).toBe(false);
    expect(fsPaymentRequestAlert(FS, [sheet({ FinancialSecretaryMemberID: 60 })])).toBe(false);
    expect(fsPaymentRequestAlert(GK, [sheet()])).toBe(false);
  });

  it('draws the accent as a red glowing border that stays still without motion', () => {
    const drawers = read('apps/web/components/DeskDrawers.tsx');
    expect(drawers).toContain("'border-4 border-brand-red motion-safe:animate-alert-boundary'");
    expect(read('apps/web/app/globals.css')).toContain('@keyframes alert-boundary');
    expect(drawers).toContain('{BACK_TO_DESK_BLOTTER_LABEL}');
    expect(read('apps/web/components/Shell.tsx')).toContain('<BackToDeskBlotterAnchor />');
  });
});

describe('the desks mount their modules in place', () => {
  it('renders both desks as blotters of drawers with the signing modules inside', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).toContain('desk="grand-knight"');
    expect(desks).toContain('desk="financial-secretary"');
    for (const mounted of ['<ApprovedExpenseSigning />', '<PaymentRequestDesk />', '<ExpenseRoutingTrack />', '<DonationRecords />', '<CouncilElectionWorkflow />', '<KnowledgeArchive />']) {
      expect(desks).toContain(mounted);
    }
    expect(desks).not.toContain('Release approved expenses on the full desk');
    expect(desks).not.toContain('Verify & sign on the full desk');
  });

  it('keeps each moved page as a thin wrapper around its module', () => {
    for (const [route, mod] of [
      ['expenses/authorize', 'ApprovedExpenseSigning'],
      ['expenses/audit', 'PaymentRequestDesk'],
      ['expenses/queue', 'ExpenseRoutingTrack'],
      ['donations', 'DonationRecords'],
      ['elections', 'ElectionWorkflow'],
      ['system-settings/knowledge-archive', 'KnowledgeArchive'],
    ]) {
      const page = read(`apps/web/app/${route}/page.tsx`);
      expect(page).toContain(`area="${route}"`);
      expect(page).toContain(`@/components/modules/${mod}`);
    }
  });
});

describe('phone schema', () => {
  it('moves the phone database to version 88', () => {
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (8[8-9]|9\d);/);
  });
});

// ---- the biometric toggle ---------------------------------------------------------------------------------

beforeEach(() => _reset());

const scanner = (opts: { available?: boolean; pass?: boolean } = {}) => {
  const calls = { scans: 0 };
  const s: BiometricScanner = {
    available: async () => opts.available ?? true,
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
const biometricWith = (s: BiometricScanner) => new BiometricLogin(keystore, s, async () => 'cd'.repeat(32));

/** A registered member on the password prompt (the controller routes a registered email there) with no key on the phone. */
async function atPasswordPrompt(db: DataService, biometric: BiometricLogin) {
  const c = new OnboardingController({ db, sessions: sessionStore, councilNumber: 15295, biometric });
  await c.start();
  await c.submitEmail('testmember@kofc.org');
  expect(await c.submitPassword('any-password-at-all', 'any-password-at-all')).toMatchObject({ screen: 'signIn' });
  return c;
}
const PASSWORD = 'dev-pass-secure-9912';

describe.each(drivers)('$name driver: the biometric toggle', (d) => {
  it('labels the toggle and shows it on the password prompt', () => {
    expect(BIOMETRIC_TOGGLE_LABEL).toBe('[ 🔘 Enable FaceID / Biometric Login ]');
    const screen = read('apps/mobile/app/sign-in.tsx');
    expect(screen).toContain('label={BIOMETRIC_TOGGLE_LABEL}');
    expect(screen).toContain('submitPassword(password, undefined, undefined, { enableBiometric })');
  });

  it('with the toggle on, one scan after the password mints the key', async () => {
    const db = await d.make();
    const { s, calls } = scanner();
    const c = await atPasswordPrompt(db, biometricWith(s));
    expect(await c.biometricAvailable()).toBe(true);
    expect(await c.submitPassword(PASSWORD, undefined, undefined, { enableBiometric: true })).toMatchObject({ screen: 'signedIn' });
    expect(calls.scans).toBe(1);
    expect(await c.biometricEmail()).toBe('testmember@kofc.org');
  });

  it('with the toggle off, or a refused scan, signs in by password and stores no key', async () => {
    const db = await d.make();
    const off = await atPasswordPrompt(db, biometricWith(scanner().s));
    expect(await off.submitPassword(PASSWORD)).toMatchObject({ screen: 'signedIn' });
    expect(await off.biometricEmail()).toBeNull();

    _reset();
    const refused = await atPasswordPrompt(db, biometricWith(scanner({ pass: false }).s));
    expect(await refused.submitPassword(PASSWORD, undefined, undefined, { enableBiometric: true })).toMatchObject({ screen: 'signedIn' });
    expect(await refused.biometricEmail()).toBeNull();
  });

  it('a wrong password never asks for a scan', async () => {
    const db = await d.make();
    const { s, calls } = scanner();
    const c = await atPasswordPrompt(db, biometricWith(s));
    expect(await c.submitPassword('wrong-password', undefined, undefined, { enableBiometric: true })).toMatchObject({ screen: 'signIn', error: expect.any(String) });
    expect(calls.scans).toBe(0);
  });

  it('hides the toggle on a phone that cannot scan', async () => {
    const db = await d.make();
    const c = await atPasswordPrompt(db, biometricWith(scanner({ available: false }).s));
    expect(await c.biometricAvailable()).toBe(false);
  });
});

describe('the guides', () => {
  it('document the drawers, the alert boundary and the biometric toggle', () => {
    const admin = read('docs/ADMIN_USER_GUIDE.md');
    // Sprint 8S Revision 7: the section now explains the filing spine and the Desk Blotter stage.
    expect(admin).toContain('### 19.3.2 Concept: the filing spine, the Desk Blotter and the alert boundary');
    expect(admin).toContain('**[ 🔀 Back to Desk Blotter ]**');
    expect(admin).not.toContain('Release approved expenses on the full desk');
    expect(admin).not.toContain('Verify & sign on the full desk');
    expect(read('docs/MEMBER_USER_GUIDE.md')).toContain('### 2.4.1 Turn on Face ID sign-in from the password screen');
  });
});
