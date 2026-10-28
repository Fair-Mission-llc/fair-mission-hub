// Sprint 8S Revision 4 (schema version 97): signing in unlocks the whole phone app - no in-session Face ID, fingerprint
// or passcode prompt - and critical triggers sit behind the Swipe to Confirm bar instead. Phone Home puts My Active
// Shifts first and folds the prayer intentions and the devotions into two closed drawers.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DAILY_DEVOTIONAL_DRAWER_LABEL,
  MOBILE_HOME_SECTIONS,
  MY_ACTIVE_SHIFTS_TITLE,
  PLATFORM_SCHEMA_VERSION,
  SPIRITUAL_INTENTIONS_DRAWER_LABEL,
} from '@kofc/shared';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('1. no mid-session biometric prompts on the phone', () => {
  it('removes the pocket gate', () => {
    expect(existsSync(join(root, 'apps/mobile/lib/pocket-gate.ts'))).toBe(false);
    const log = read('apps/mobile/app/(app)/log.tsx');
    expect(log).not.toMatch(/from '@\/lib\/pocket-gate'|confirmTap\(|pocketGateMode\(|authenticateAsync/);
    expect(log).toContain('const tap = enqueue;');
  });

  it('keeps biometric prompts to the sign-in path only', () => {
    for (const file of ['app/(app)/log.tsx', 'app/(app)/donate.tsx', 'app/(app)/index.tsx', 'app/(app)/expenses.tsx', 'app/(app)/settings.tsx']) {
      expect(read(`apps/mobile/${file}`)).not.toContain('authenticateAsync');
    }
    expect(read('apps/mobile/services/biometric-login.ts')).toContain('authenticateAsync');
  });

  it('guards Report Hours and Conclude & Lock with Swipe to Confirm', () => {
    const swipe = read('apps/mobile/components/SwipeToConfirm.tsx');
    expect(swipe).toContain('export function SwipeToConfirm(');
    expect(swipe).toContain('PanResponder.create(');
    expect(swipe).toContain("accessibilityActions={[{ name: 'activate', label: title }]}");
    expect(read('apps/mobile/app/(app)/log.tsx')).toContain('<SwipeToConfirm title="Slide to Log Hours"');
    const donate = read('apps/mobile/app/(app)/donate.tsx');
    expect(donate).toContain('<SwipeToConfirm title="Slide to Conclude & Lock"');
    expect(donate).not.toContain('Yes, conclude & lock');
  });

  it('moves the phone database to 97', () => {
    // Sprint 11 Revision 2.1 moved the platform to schema 103.
    expect(PLATFORM_SCHEMA_VERSION).toBe(105); // Sprint 11 Revision 6.0 moved the platform to schema 105.
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toContain('const SCHEMA_VERSION = 105;');
    expect(read('Schema.sql')).toContain('(schema version 97)');
  });
});

describe('2. My Active Shifts first on phone Home', () => {
  it('lists the sections in order', () => {
    expect(MY_ACTIVE_SHIFTS_TITLE).toBe('My Active Shifts');
    expect(MOBILE_HOME_SECTIONS[0]).toBe('my-active-shifts');
    expect(MOBILE_HOME_SECTIONS).toEqual(['my-active-shifts', 'liturgical-banner', 'greeting', 'spiritual-intentions', 'daily-devotional', 'council-dashboard', 'expense-reports']);
  });

  it('draws the shifts before the banner, the greeting and the faith drawers', () => {
    const home = read('apps/mobile/app/(app)/index.tsx');
    const at = (piece: string) => {
      const i = home.indexOf(piece);
      expect(i, piece).toBeGreaterThan(-1);
      return i;
    };
    const order = [
      '<Section title={MY_ACTIVE_SHIFTS_TITLE}>',
      '<LiturgicalBanner />',
      'Hello, {user.firstName}',
      '<PrayerIntentions version={prayerVersion} />',
      '<DevotionalTracker version={prayerVersion} />',
      '<Section title="Council Dashboard">',
      '<Section title="Expense reports">',
    ].map(at);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(home).not.toContain('<Section title="My shifts">');
  });
});

describe('3. prayers and devotions in closed drawers', () => {
  it('names the drawers', () => {
    expect(SPIRITUAL_INTENTIONS_DRAWER_LABEL).toBe('[ 📿 Active Spiritual Intentions Drawer ]');
    expect(DAILY_DEVOTIONAL_DRAWER_LABEL).toBe('[ 📖 Daily Devotional Drawer ]');
  });

  it('gives the phone a Drawer that starts closed', () => {
    const ui = read('apps/mobile/components/ui.tsx');
    expect(ui).toContain('export function Drawer(');
    expect(ui).toContain('defaultOpen = false');
    expect(ui).toContain('accessibilityState={{ expanded: open }}');
  });

  it('folds the prayer list and the devotions (with today\'s verse) into the drawers', () => {
    const prayers = read('apps/mobile/components/PrayerIntentions.tsx');
    expect(prayers).toContain('<Drawer label={SPIRITUAL_INTENTIONS_DRAWER_LABEL}');
    expect(prayers).not.toContain('<Section title="Council Prayer Intentions">');
    const devotions = read('apps/mobile/components/DevotionalTracker.tsx');
    expect(devotions).toContain('<Drawer label={DAILY_DEVOTIONAL_DRAWER_LABEL}');
    expect(devotions).toContain('dailyVerse(');
    expect(devotions).toContain('NABRE_NOTICE');
    expect(devotions).not.toContain('<Section title="My devotions">');
  });
});
