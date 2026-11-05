// Sprint 11 Revision 19.6 (schema 112): the relational parent-child architecture - ParentOrganizations and
// CouncilParentMappings, Council.flag_motion_requests apart from flag_meeting_management, and parent_org_id on the eight
// global lookup tables and PlatformSettings - on both data drivers.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALL_FEATURES_ON,
  cleanParentOrganizationInput,
  FEATURE_FLAG_LABELS,
  FEATURE_FLAG_NAMES,
  HUB_ACTOR_FIRST_METHODS,
  KOFC_PARENT_ORG_ID,
  LOOKUP_TABLE_ORDER,
  lookupRowsInScope,
  PLATFORM_SCHEMA_VERSION,
  platformSettingsRowFor,
  resolveCouncilParentOrgId,
  SECULAR_CHARITY_PARENT_ORG_ID,
  withFeatureFlags,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(path, 'utf8');

describe('0. schema 112', () => {
  it('moves the platform and the phone database to 112', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBeGreaterThanOrEqual(112);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = 11[2-9];/);
    expect(read('Schema.sql')).toContain('RELATIONAL PARENT ORGANIZATIONS AND INDEPENDENT MOTION FLAGS (schema version 112)');
  });

  it('adds the two tables, the motion switch and parent_org_id on every global lookup table and PlatformSettings', () => {
    expect(TABLES.ParentOrganizations.columns.map((c) => c.name)).toEqual(['id', 'org_name', 'org_code', 'vertical_type', 'created_at']);
    expect(TABLES.CouncilParentMappings.columns.map((c) => c.name)).toEqual(['id', 'council_id', 'parent_org_id', 'parent_council_id', 'mapped_at']);
    expect(TABLES.CouncilParentMappings.foreignKeys.map((f) => `${f.column}->${f.refTable}`)).toEqual(
      expect.arrayContaining(['council_id->Council', 'parent_org_id->ParentOrganizations', 'parent_council_id->Council']),
    );
    expect(read('Schema.sql')).toContain('ALTER TABLE [Council] ADD [flag_motion_requests] BIT NOT NULL DEFAULT 1;');
    for (const table of [...LOOKUP_TABLE_ORDER, 'PlatformSettings'] as const) {
      expect(TABLES[table].columns.map((c) => c.name), table).toContain('parent_org_id');
      expect(TABLES[table].foreignKeys.map((f) => f.refTable), table).toContain('ParentOrganizations');
    }
  });
});

describe('1. pure rules', () => {
  const orgs = [
    { id: 1, org_code: 'KofC' },
    { id: 2, org_code: 'SECULAR_CHARITY' },
  ];

  it('resolves a council through its mapping, else its stored code, else its tenant type', () => {
    expect(resolveCouncilParentOrgId({ id: 9, parent_organization: 'KofC' }, [{ council_id: 9, parent_org_id: 2 }], orgs)).toBe(2);
    expect(resolveCouncilParentOrgId({ id: 9, parent_organization: 'secular_charity' }, [], orgs)).toBe(2);
    expect(resolveCouncilParentOrgId({ id: 9, parent_organization: null, tenant_type: 'GENERIC' }, [], orgs)).toBe(2);
    expect(resolveCouncilParentOrgId({ id: 9 }, [], orgs)).toBe(1);
    expect(resolveCouncilParentOrgId({ id: 9, parent_organization: 'UNKNOWN' }, [], orgs)).toBeNull();
  });

  it('reads shared rows plus the scope’s own, and the scope’s settings row before the default', () => {
    const rows = [{ id: 1, parent_org_id: null }, { id: 2, parent_org_id: 1 }, { id: 3, parent_org_id: 2 }];
    expect(lookupRowsInScope(rows, 1).map((r) => r.id)).toEqual([1, 2]);
    expect(lookupRowsInScope(rows, null).map((r) => r.id)).toEqual([1]);
    expect(lookupRowsInScope(rows, undefined).map((r) => r.id)).toEqual([1, 2, 3]);
    const settings = [{ id: 1, parent_org_id: null }, { id: 2, parent_org_id: 2 }];
    expect(platformSettingsRowFor(settings, 2, 1)?.id).toBe(2);
    expect(platformSettingsRowFor(settings, 1, 1)?.id).toBe(1);
  });

  it('validates a new parent organization', () => {
    expect(cleanParentOrganizationInput({ org_name: ' Elks Lodge ', org_code: 'ELKS', vertical_type: 'fraternal' })).toEqual({
      org_name: 'Elks Lodge',
      org_code: 'ELKS',
      vertical_type: 'FRATERNAL',
    });
    expect(() => cleanParentOrganizationInput({ org_name: 'X', org_code: '9 bad', vertical_type: 'FRATERNAL' })).toThrow(/code must start with a letter/);
    expect(() => cleanParentOrganizationInput({ org_name: 'X', org_code: 'OK', vertical_type: 'CHURCH' })).toThrow(/vertical/);
  });

  it('gives Motion Requests their own switch and hub write methods their actor check', () => {
    expect(FEATURE_FLAG_NAMES).toContain('flag_motion_requests');
    expect(FEATURE_FLAG_LABELS.flag_motion_requests.label).toBe('Motion requests');
    expect(withFeatureFlags(['motion-requests', 'meetings'], { ...ALL_FEATURES_ON, flag_motion_requests: false })).toEqual(['meetings']);
    expect(withFeatureFlags(['motion-requests', 'meetings'], { ...ALL_FEATURES_ON, flag_meeting_management: false })).toEqual(['motion-requests']);
    expect(HUB_ACTOR_FIRST_METHODS.has('parentOrganizations.create')).toBe(true);
    expect(HUB_ACTOR_FIRST_METHODS.has('parentOrganizations.mapCouncil')).toBe(true);
    expect(read('scripts/compile_all_manuals.py')).toContain("'flag_motion_requests': ('Motion requests', r'motion request'),");
  });
});

describe.each(drivers)('2. $name driver', ({ make, count }) => {
  it('seeds the two parent organizations and maps Council 15295 to the Knights', async () => {
    const db = await make();
    expect((await db.parentOrganizations.list()).map((o) => [o.id, o.org_code, o.vertical_type])).toEqual([
      [KOFC_PARENT_ORG_ID, 'KofC', 'FRATERNAL'],
      [SECULAR_CHARITY_PARENT_ORG_ID, 'SECULAR_CHARITY', 'SECULAR_NONPROFIT'],
    ]);
    expect((await db.parentOrganizations.listMappings()).map((m) => [m.council_id, m.parent_org_id])).toEqual([[1, 1]]);
    expect(await db.parentOrganizations.resolveForCouncil(1)).toBe(KOFC_PARENT_ORG_ID);
    expect((await db.councils.get(1))?.flag_motion_requests).toBe(1);
  });

  it('isolates lookup rows by parent organization', async () => {
    const db = await make();
    // The fraternal degrees belong to the Knights; a secular charity's scope does not read them.
    expect((await db.lookups.list('Degree', { councilId: 1 })).length).toBe(4);
    expect((await db.lookups.list('Degree', { parentOrgId: SECULAR_CHARITY_PARENT_ORG_ID })).length).toBe(0);
    expect((await db.lookups.list('Degree')).length).toBe(4);
    const own = await db.lookups.create(MEMBER.superAdmin, 'MeetingType', { Type: 'Board', Description: 'Board of directors' }, SECULAR_CHARITY_PARENT_ORG_ID);
    expect(own.parent_org_id).toBe(SECULAR_CHARITY_PARENT_ORG_ID);
    expect((await db.lookups.list('MeetingType', { councilId: 1 })).map((t) => t.Type)).not.toContain('Board');
    expect((await db.lookups.list('MeetingType', { parentOrgId: SECULAR_CHARITY_PARENT_ORG_ID })).map((t) => t.Type)).toContain('Board');
    // The same key may live in two organizations, but never beside a shared row of that name.
    await db.lookups.create(MEMBER.superAdmin, 'MeetingType', { Type: 'Board', Description: '' }, KOFC_PARENT_ORG_ID);
    await expectRule(db.lookups.create(MEMBER.superAdmin, 'MeetingType', { Type: 'Monthly', Description: '' }, SECULAR_CHARITY_PARENT_ORG_ID), 'INVALID_INPUT');
    await expectRule(db.lookups.create(MEMBER.superAdmin, 'MeetingType', { Type: 'Other', Description: '' }, 999), 'INVALID_INPUT');
  });

  it('keeps a parent organization’s platform settings apart from the default', async () => {
    const db = await make();
    const before = await db.councils.getPlatformSettings();
    const saved = await db.councils.setPlatformSettings(MEMBER.superAdmin, { global_ai_confidence_cutoff: 75 }, SECULAR_CHARITY_PARENT_ORG_ID);
    expect(saved.global_ai_confidence_cutoff).toBe(75);
    expect((await db.councils.getPlatformSettings({ parentOrgId: SECULAR_CHARITY_PARENT_ORG_ID })).global_ai_confidence_cutoff).toBe(75);
    expect((await db.councils.getPlatformSettings({ councilId: 1 })).global_ai_confidence_cutoff).toBe(before.global_ai_confidence_cutoff);
    expect((await db.councils.getPlatformSettings()).global_ai_confidence_cutoff).toBe(before.global_ai_confidence_cutoff);
    await db.councils.setPlatformSettings(MEMBER.superAdmin, { global_ai_confidence_cutoff: 80 }, SECULAR_CHARITY_PARENT_ORG_ID);
    expect(count(db, 'PlatformSettings')).toBe(2);
    await expectRule(db.councils.setPlatformSettings(MEMBER.admin, { global_ai_confidence_cutoff: 70 }, SECULAR_CHARITY_PARENT_ORG_ID), 'SUPER_ADMIN_REQUIRED');
  });

  it('adds parent organizations and maps councils, keeping the council columns in step', async () => {
    const db = await make();
    await expectRule(db.parentOrganizations.create(MEMBER.admin, { org_name: 'Elks Lodge', org_code: 'ELKS', vertical_type: 'FRATERNAL' }), 'SUPER_ADMIN_REQUIRED');
    const elks = await db.parentOrganizations.create(MEMBER.superAdmin, { org_name: 'Elks Lodge', org_code: 'ELKS', vertical_type: 'FRATERNAL' });
    await expectRule(db.parentOrganizations.create(MEMBER.superAdmin, { org_name: 'elks lodge', org_code: 'OTHER', vertical_type: 'FRATERNAL' }), 'INVALID_INPUT');
    const child = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 8001, CouncilName: 'Chapter One', State: 'OR' });
    // A new council maps to the organization its stored code names (KofC by default).
    expect(await db.parentOrganizations.resolveForCouncil(child.id)).toBe(KOFC_PARENT_ORG_ID);
    const mapping = await db.parentOrganizations.mapCouncil(MEMBER.superAdmin, child.id, elks.id, 1);
    expect([mapping.council_id, mapping.parent_org_id, mapping.parent_council_id]).toEqual([child.id, elks.id, 1]);
    const council = await db.councils.get(child.id);
    // Only the KofC code is fraternal: a new fraternal organization is still a white-label tenant.
    expect([council?.parent_organization, council?.tenant_type]).toEqual(['ELKS', 'GENERIC']);
    expect((await db.parentOrganizations.listMappings()).filter((m) => m.council_id === child.id)).toHaveLength(1);
    await expectRule(db.parentOrganizations.mapCouncil(MEMBER.superAdmin, child.id, elks.id, child.id), 'INVALID_INPUT');
    // An empty council with a chapter mapped under it cannot be deleted; the chapter itself can, with its mapping.
    const parent = await db.councils.create(MEMBER.superAdmin, { CouncilNumber: 8002, CouncilName: 'Parent Council', State: 'OR' });
    await db.parentOrganizations.mapCouncil(MEMBER.superAdmin, child.id, elks.id, parent.id);
    await expectRule(db.councils.remove(MEMBER.superAdmin, parent.id), 'RECORD_IN_USE');
    await db.councils.remove(MEMBER.superAdmin, child.id);
    await db.councils.remove(MEMBER.superAdmin, parent.id);
    expect((await db.parentOrganizations.listMappings()).map((m) => m.council_id)).toEqual([1]);
  });

  it('moves the mapping when the Global Parameters card changes a council’s code', async () => {
    const db = await make();
    await db.councils.setGlobalParameters(MEMBER.superAdmin, 1, { parent_organization: 'SECULAR_CHARITY' });
    expect(await db.parentOrganizations.resolveForCouncil(1)).toBe(SECULAR_CHARITY_PARENT_ORG_ID);
    expect((await db.lookups.list('Degree', { councilId: 1 })).length).toBe(0);
  });

  it('switches Motion Requests independently of meeting management', async () => {
    const db = await make();
    const council = await db.councils.setFeatureFlags(MEMBER.superAdmin, 1, { flag_motion_requests: false });
    expect([council.flag_motion_requests, council.flag_meeting_management]).toEqual([0, 1]);
  });
});
