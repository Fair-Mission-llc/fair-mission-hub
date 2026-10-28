// Sprint 11 Revision 8.0 (schema 107): the Feature Flag Alignment Pass - three switches retired as core systems, five
// premium switches added, masking on the sidebar, the officer desks and the Navigation Guide, the 'disabled' banners of
// the council custom manuals, and the baseline Two-Factor Authentication layout.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALL_FEATURES_ON,
  ALWAYS_ON_MODULES,
  cleanFeatureFlagChanges,
  councilFeatureFlags,
  deskDrawersFor,
  disabledFeatureFlags,
  FEATURE_FLAG_AREAS,
  FEATURE_FLAG_LABELS,
  FEATURE_FLAG_NAMES,
  LIGHTWEIGHT_FEATURE_FLAGS,
  navigationGuide,
  PASSKEY_PLATFORMS,
  PLATFORM_SCHEMA_VERSION,
  portalAreas,
  RETIRED_FEATURE_COLUMNS,
  REV80_FEATURE_FLAGS,
  TWO_FACTOR_METHODS,
  twoFactorRows,
  type FeatureFlags,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const superAdmin = { memberId: 1, councilId: 1, memberType: 'Super Admin' as const, isOfficer: true, roles: ['Grand Knight', 'Financial Secretary', 'Historian'] };
const off = (...names: (keyof FeatureFlags)[]): FeatureFlags => ({ ...ALL_FEATURES_ON, ...Object.fromEntries(names.map((n) => [n, false])) });

describe('1. schema 107', () => {
  it('adds the five premium switches as BIT DEFAULT 1 Council columns and keeps the retired ones unread', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(107);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toContain('const SCHEMA_VERSION = 107;');
    expect(read('Schema.sql')).toContain('(schema version 107)');
    expect(REV80_FEATURE_FLAGS).toEqual(['feature_photo_gallery', 'feature_lessons_registry', 'feature_marketing_factory', 'feature_loaner_library', 'feature_advanced_audits']);
    for (const name of REV80_FEATURE_FLAGS) {
      expect(TABLES.Council!.columns.find((c) => c.name === name)).toMatchObject({ kind: 'bit', notNull: true });
      expect(FEATURE_FLAG_NAMES).toContain(name);
    }
    for (const name of RETIRED_FEATURE_COLUMNS) {
      expect(TABLES.Council!.columns.find((c) => c.name === name)).toBeDefined();
      expect(FEATURE_FLAG_NAMES as readonly string[]).not.toContain(name);
    }
    expect(FEATURE_FLAG_NAMES).toHaveLength(18);
  });
});

describe('2. core systems and the new switches (pure)', () => {
  it('makes event shifts, flagged hours review and the finance dashboards permanent', () => {
    expect(ALWAYS_ON_MODULES).toEqual(expect.arrayContaining(['Event shifts', 'Flagged hours review', 'Financial management dashboards']));
    const light = portalAreas(superAdmin, LIGHTWEIGHT_FEATURE_FLAGS);
    for (const area of ['events', 'finance/dashboard', 'finance/ledger', 'finance/balance-sheet', 'financials/budget'] as const) expect(light).toContain(area);
    expect(() => cleanFeatureFlagChanges({ feature_financial_management: false } as never)).toThrow(/permanent core system/);
    expect(Object.values(LIGHTWEIGHT_FEATURE_FLAGS).every((v) => v === false)).toBe(true);
  });

  it('maps each new switch to its pages and splits marketing and the loaner library out', () => {
    expect(FEATURE_FLAG_AREAS.feature_photo_gallery).toEqual(['gallery']);
    expect(FEATURE_FLAG_AREAS.feature_lessons_registry).toEqual(['lessons-registry', 'system-settings/knowledge-archive']);
    expect(FEATURE_FLAG_AREAS.feature_marketing_factory).toEqual(['resources/marketing']);
    expect(FEATURE_FLAG_AREAS.feature_loaner_library).toEqual(['inventory/loaner-library']);
    expect(FEATURE_FLAG_AREAS.feature_advanced_audits).toEqual(['finance/audit']);
    expect(FEATURE_FLAG_AREAS.feature_capital_assets).not.toContain('inventory/loaner-library');
    expect(FEATURE_FLAG_AREAS.feature_document_compilation).not.toContain('resources/marketing');
    expect(FEATURE_FLAG_LABELS.feature_council_history.label).toBe('Council History & Archive Vault');
    for (const name of REV80_FEATURE_FLAGS) {
      const full = portalAreas(superAdmin, ALL_FEATURES_ON);
      const masked = portalAreas(superAdmin, off(name));
      for (const area of FEATURE_FLAG_AREAS[name]) {
        expect(full).toContain(area);
        expect(masked).not.toContain(area);
      }
    }
  });

  it('removes a switched-off module from the officer desks', () => {
    const ids = (desk: Parameters<typeof deskDrawersFor>[1], flags: FeatureFlags) => deskDrawersFor(superAdmin, desk, 1, flags).map((d) => d.id);
    expect(ids('grand-knight', ALL_FEATURES_ON)).toEqual(expect.arrayContaining(['loaner-library', 'knowledge-archive']));
    expect(ids('grand-knight', off('feature_loaner_library'))).not.toContain('loaner-library');
    expect(ids('grand-knight', off('feature_lessons_registry'))).not.toContain('knowledge-archive');
    expect(ids('financial-secretary', ALL_FEATURES_ON)).toContain('form-1295');
    expect(ids('financial-secretary', off('feature_advanced_audits'))).not.toContain('form-1295');
    expect(ids('historian', ALL_FEATURES_ON)).toEqual(expect.arrayContaining(['media-gallery', 'meeting-photos', 'diary-logs', 'oral-histories']));
    const noGallery = ids('historian', off('feature_photo_gallery'));
    expect(noGallery).not.toContain('media-gallery');
    expect(noGallery).not.toContain('meeting-photos');
    const noHistory = ids('historian', off('feature_council_history'));
    expect(noHistory).not.toContain('diary-logs');
    expect(noHistory).not.toContain('oral-histories');
    expect(noHistory).toContain('bulletins');
  });

  it('removes a switched-off module from the Navigation Guide', () => {
    const items = (flags: FeatureFlags) => {
      const g = navigationGuide(superAdmin, flags);
      return [...g.groups.flatMap((x) => x.entries.map((e) => e.item)), ...g.pinned.map((e) => e.item)];
    };
    expect(items(ALL_FEATURES_ON)).toEqual(expect.arrayContaining(['gallery', 'lessons-registry', 'resources/marketing', 'inventory/loaner-library', 'finance/audit']));
    const masked = items(LIGHTWEIGHT_FEATURE_FLAGS);
    for (const item of ['gallery', 'lessons-registry', 'resources/marketing', 'inventory/loaner-library', 'finance/audit', 'history'] as const) expect(masked).not.toContain(item);
    expect(masked).toContain('finance/ledger');
  });

  it('lists a council\'s switched-off modules in order', () => {
    expect(disabledFeatureFlags(ALL_FEATURES_ON)).toEqual([]);
    expect(disabledFeatureFlags(off('feature_loaner_library', 'feature_photo_gallery'))).toEqual(['feature_photo_gallery', 'feature_loaner_library']);
    expect(disabledFeatureFlags(councilFeatureFlags({ feature_advanced_audits: 0 }))).toEqual(['feature_advanced_audits']);
  });
});

describe.each(drivers)('3. the switches ($name driver)', ({ make }) => {
  it('stores a new council with every switch off and lets a Super Admin flip the new ones', async () => {
    const db = await make();
    const created = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 99801, CouncilName: 'Council 99801', State: 'OR' });
    expect(councilFeatureFlags(created)).toEqual(LIGHTWEIGHT_FEATURE_FLAGS);
    await expectRule(db.councils.setFeatureFlags(MEMBER.admin, created.id, { feature_photo_gallery: true }), 'SUPER_ADMIN_REQUIRED');
    const on = await db.councils.setFeatureFlags(MEMBER.superAdmin, created.id, { feature_photo_gallery: true, feature_loaner_library: true });
    expect(councilFeatureFlags(on)).toMatchObject({ feature_photo_gallery: true, feature_loaner_library: true, feature_advanced_audits: false });
    await expectRule(db.councils.setFeatureFlags(MEMBER.superAdmin, created.id, { flag_complex_shifts: false } as never), 'INVALID_INPUT');
  });
});

describe('4. the custom manual banners', () => {
  const script = read('scripts/compile_all_manuals.py');

  it("names every switch in the compiler with the grid's label", () => {
    const entries = [...script.matchAll(/^    '([a-z_]+)': \('([^']+)', r'/gm)].map((m) => [m[1], m[2]]);
    expect(entries.map(([name]) => name)).toEqual([...FEATURE_FLAG_NAMES]);
    for (const [name, label] of entries) expect(label).toBe(FEATURE_FLAG_LABELS[name as keyof typeof FEATURE_FLAG_LABELS].label);
    expect(script).toContain("DISABLED_BANNER = '⚠️ This premium module is currently disabled'");
    expect(script).toContain("'--disabled-modules'");
    // A generic guide (no --disabled-modules) comes back unchanged.
    expect(script).toContain('if not disabled:\n        return markdown');
  });

  it('passes the council\'s switched-off modules from the custom manual route', () => {
    const route = read('apps/web/app/api/council/compile-manual/route.ts');
    expect(route).toContain('const disabled = await councilDisabledModules(payload.council.id);');
    expect(route).toContain("...(disabled.length > 0 ? ['--disabled-modules', disabled.join(',')] : []),");
    expect(read('apps/web/services/server/feature-gate.ts')).toContain('disabledFeatureFlags(councilFeatureFlags(council))');
  });
});

describe('5. Two-Factor Authentication layout', () => {
  const facts = { phone: '503-555-0100', email: 'k@example.org', emailGatewayConnected: true, passkeySupported: true, passkeyOnThisDevice: false };

  it('has a row for SMS, email and passkeys, and passkey lines for Android and iOS', () => {
    expect(TWO_FACTOR_METHODS.map((m) => m.label)).toEqual(['SMS text tokens', 'Email secure passcodes', 'WebAuthn biometric hardware passkeys']);
    expect(PASSKEY_PLATFORMS.map((p) => p.id)).toEqual(['android', 'ios', 'desktop']);
  });

  it('says plainly which methods work', () => {
    expect(twoFactorRows(facts).map((r) => r.status)).toEqual(['not-wired', 'not-wired', 'available']);
    expect(twoFactorRows({ ...facts, passkeyOnThisDevice: true })[2]!.status).toBe('ready');
    expect(twoFactorRows({ ...facts, phone: '', email: null }).map((r) => r.status)).toEqual(['needs-contact', 'needs-contact', 'available']);
    expect(twoFactorRows({ ...facts, passkeySupported: false })[2]!.status).toBe('not-wired');
  });

  it('draws the section on My Profile and the delivery panel on the Credentials Vault', () => {
    const profile = read('apps/web/app/profile/page.tsx');
    expect(profile).toContain('<TwoFactorSection');
    expect(profile).toContain('passkeyOnThisDevice: passkey.remembered !== null');
    expect(read('apps/web/components/modules/CredentialsVaultPanel.tsx')).toContain('<TwoFactorDeliveryPanel emailGatewayConnected={emailOn} />');
    expect(read('docs/MEMBER_USER_GUIDE.md')).toContain('### 2.5.2 Concept: the Two-Factor Authentication card');
  });
});
