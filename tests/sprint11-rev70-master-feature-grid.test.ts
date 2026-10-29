// Sprint 11 Revision 7.0 (schema 106): the Master Feature Deployment Grid - four premium module switches (capital assets,
// the charity registry, document compilation, financial management), the lightweight footprint a new council starts
// with, Super Admin-only toggling, and the masking of the switched-off modules on the web and the phone.
// Sprint 11 Revision 8.0 (schema 107, tests/sprint11-rev80-flag-alignment.test.ts) retired feature_financial_management
// and flag_complex_shifts as core systems and split the marketing factory and the loaner library out; the pins below
// follow it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  adminDeskDrawersFor,
  ALL_FEATURES_ON,
  COUNCIL_15295_SEED_FLAGS,
  ALWAYS_ON_MODULES,
  canOpenFeatureFlagsControlCenter,
  councilFeatureFlags,
  FEATURE_FLAG_AREAS,
  FEATURE_FLAG_NAMES,
  featureFlagTier,
  LIGHTWEIGHT_FEATURE_FLAGS,
  lightweightFeatureColumns,
  MASTER_FEATURE_GRID_TITLE,
  PLATFORM_SCHEMA_VERSION,
  portalAreas,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const NEW_FLAGS = ['feature_capital_assets', 'feature_charity_registry', 'feature_document_compilation'] as const;
const superAdmin = { memberId: 1, councilId: 1, memberType: 'Super Admin' as const, isOfficer: true, roles: ['Grand Knight'] };
const admin = { memberId: 2, councilId: 1, memberType: 'Admin' as const, isOfficer: false };

describe('1. schema 106', () => {
  it('adds the four premium switches as BIT DEFAULT 1 Council columns', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(109); // Sprint 11 Revision 11.0 (was 107 in Revision 8.0)
    expect(read('Schema.sql')).toContain('(schema version 106)');
    expect(TABLES.Council!.columns.find((c) => c.name === 'feature_financial_management')).toMatchObject({ kind: 'bit' }); // kept, unread
    for (const name of NEW_FLAGS) {
      expect(TABLES.Council!.columns.find((c) => c.name === name)).toMatchObject({ kind: 'bit', notNull: true });
      expect(FEATURE_FLAG_NAMES).toContain(name);
    }
    expect(FEATURE_FLAG_NAMES).toHaveLength(18); // Sprint 11 Revision 8.0: 16 - 3 retired + 5 new
  });
});

describe('2. the lightweight footprint (pure)', () => {
  it('turns every switch off for a new council; the core systems have none (Sprint 11 Revision 8.0)', () => {
    expect(FEATURE_FLAG_NAMES.filter((n) => LIGHTWEIGHT_FEATURE_FLAGS[n])).toEqual([]);
    for (const n of FEATURE_FLAG_NAMES) expect(featureFlagTier(n)).toBe('premium');
    expect(ALWAYS_ON_MODULES).toEqual(['Service hours', 'Event communications', 'Calendars', 'Event shifts', 'Flagged hours review', 'Financial management dashboards']);
    expect(Object.values(lightweightFeatureColumns()).filter((v) => v === 1)).toHaveLength(0);
    // A council row without the columns (one on file before the switches) reads as all on.
    expect(councilFeatureFlags({})).toEqual(ALL_FEATURES_ON);
    expect(MASTER_FEATURE_GRID_TITLE).toBe('Master Feature Deployment Grid');
  });

  it('maps each premium switch to the pages it hides', () => {
    expect(FEATURE_FLAG_AREAS.feature_capital_assets).toEqual(['expenses/assets']);
    expect(FEATURE_FLAG_AREAS.feature_charity_registry).toEqual(['charities/registry']);
    expect(FEATURE_FLAG_AREAS.feature_document_compilation).toEqual([]);
  });

  it('masks the premium pages for a lightweight council and keeps the footprint', () => {
    const full = portalAreas(superAdmin, ALL_FEATURES_ON);
    const light = portalAreas(superAdmin, LIGHTWEIGHT_FEATURE_FLAGS);
    for (const area of ['calendar', 'messages', 'distribution-lists', 'events', 'member-actions', 'finance/ledger', 'financials/budget'] as const) expect(light).toContain(area);
    for (const area of ['finance/audit', 'gallery', 'inventory/loaner-library', 'charities/registry', 'expenses/assets', 'resources/marketing', 'donations', 'meetings', 'elections', 'expenses'] as const) {
      expect(full).toContain(area);
      expect(light).not.toContain(area);
    }
  });

  it('takes the registry and asset drawers off the Admin Desk when their switches are off', () => {
    expect(adminDeskDrawersFor(ALL_FEATURES_ON).map((d) => d.id)).toContain('charities-registry');
    const light = adminDeskDrawersFor(LIGHTWEIGHT_FEATURE_FLAGS).map((d) => d.id);
    expect(light).not.toContain('charities-registry');
    expect(light).not.toContain('asset-management');
    expect(light).toContain('council-lookups');
  });

  it('opens the grid to Super Admins only', () => {
    expect(canOpenFeatureFlagsControlCenter(superAdmin)).toBe(true);
    expect(canOpenFeatureFlagsControlCenter(admin)).toBe(false);
    expect(portalAreas(admin, ALL_FEATURES_ON)).not.toContain('feature-flags');
  });
});

describe.each(drivers)('3. new councils and the switches ($name driver)', ({ make }) => {
  it('stores a new council with the lightweight footprint and leaves councils on file as they were', async () => {
    const db = await make();
    expect(councilFeatureFlags(await db.councils.get(1))).toEqual(COUNCIL_15295_SEED_FLAGS);
    const created = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 99701, CouncilName: 'Council 99701', State: 'OR' });
    expect(councilFeatureFlags(created)).toEqual(LIGHTWEIGHT_FEATURE_FLAGS);
    expect(councilFeatureFlags(await db.councils.get(created.id))).toEqual(LIGHTWEIGHT_FEATURE_FLAGS);
  });

  it('lets only a Super Admin flip the premium switches', async () => {
    const db = await make();
    const created = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 99702, CouncilName: 'Council 99702', State: 'OR' });
    await expectRule(db.councils.setFeatureFlags(MEMBER.admin, created.id, { feature_advanced_audits: true }), 'SUPER_ADMIN_REQUIRED');
    const on = await db.councils.setFeatureFlags(MEMBER.superAdmin, created.id, { feature_advanced_audits: true, feature_capital_assets: true });
    expect(councilFeatureFlags(on)).toMatchObject({ feature_advanced_audits: true, feature_capital_assets: true, feature_charity_registry: false });
    const back = await db.councils.setFeatureFlags(MEMBER.superAdmin, created.id, LIGHTWEIGHT_FEATURE_FLAGS);
    expect(councilFeatureFlags(back)).toEqual(LIGHTWEIGHT_FEATURE_FLAGS);
  });
});

describe('4. screens', () => {
  it('draws the grid at /feature-flags and /super-admin for Super Admins, grouped, with a lightweight button', () => {
    for (const path of ['apps/web/app/feature-flags/page.tsx', 'apps/web/app/super-admin/page.tsx']) {
      const page = read(path);
      expect(page).toContain('<RequireArea area="feature-flags">');
      expect(page).toContain('<FeatureFlagControlPanel />');
      expect(page).toContain('MASTER_FEATURE_GRID_TITLE');
    }
    const grid = read('apps/web/components/FeatureFlagParts.tsx');
    expect(grid).toContain("CORE_SYSTEMS_TITLE = 'Core systems (always on)'"); // Sprint 11 Revision 8.0
    expect(grid).toContain("title: 'Premium modules'");
    expect(grid).toContain('LIGHTWEIGHT_FEATURE_FLAGS');
    expect(read('apps/web/components/Sidebar.tsx')).toContain("label: 'Master Feature Deployment Grid'");
    // A council Admin sees the module status on Council Wide Settings, but no link into the grid.
    expect(read('apps/web/components/FeatureDeploymentParts.tsx')).toContain("r.href !== '/feature-flags' || canOpenFeatureFlagsControlCenter(user)");
  });

  it('masks the premium pieces on the desks, the routes and the phone', () => {
    expect(read('apps/web/components/modules/AdminDesk.tsx')).toContain('adminDeskDrawersFor(useFeatureFlags())');
    expect(read('apps/web/components/modules/CouncilWideSettings.tsx')).toContain('councilFeatureFlags(council).feature_document_compilation ? <CustomGuidesCard');
    expect(read('apps/web/app/api/council/compile-manual/route.ts')).toContain("featureSwitchedOff(payload.council.id, 'feature_document_compilation')");
    expect(read('apps/web/app/api/marketing/copilot/route.ts')).toContain("featureSwitchedOff(session.actor.councilId, 'feature_marketing_factory')");
    expect(read('apps/mobile/app/(app)/assets.tsx')).toContain('<FeatureGate flag="feature_capital_assets">');
    expect(read('apps/mobile/app/(app)/index.tsx')).toContain('features.feature_capital_assets && canAttachAssetPhoto');
  });

  it('describes the grid in the Administrator guide', () => {
    const guide = read('docs/ADMIN_USER_GUIDE.md');
    expect(guide).toContain('**Master Feature Deployment Grid**');
    expect(guide).toContain('`feature_advanced_audits`');
    expect(guide).toContain('lightweight footprint');
    expect(read('docs/ARCHITECTURAL_HISTORY.md')).toMatch(/\| 106 \|/);
    expect(read('data_dictionary.md')).toContain('Council.feature_capital_assets');
  });
});
