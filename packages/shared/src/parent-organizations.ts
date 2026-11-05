// =========================================================================
// RELATIONAL PARENT ORGANIZATIONS (Sprint 11 Revision 19.6, schema 112)
//
// ParentOrganizations is the master list of umbrella organizations: a display name (org_name, unique), the short code
// stored in Council.parent_organization (org_code, unique: 'KofC', 'SECULAR_CHARITY' or a new code) and the data
// vertical ('FRATERNAL' or 'SECULAR_NONPROFIT'). CouncilParentMappings ties each council to one parent organization,
// with an optional parent council for a chapter that sits under another council.
//
// The parent organization isolates configuration on the database tier:
//   - the eight global lookup tables carry parent_org_id. NULL is a row every organization shares (the platform
//     defaults the access rules resolve by name: 'Active', the member types, the officer roles); a value is a row only
//     that organization's councils read (lookupRowsInScope). The seed gives the four fraternal degrees to the Knights.
//   - PlatformSettings row 1 (parent_org_id NULL) is the platform default; a parent organization may keep one override
//     row of its own (unique parent_org_id), which its councils read instead (platformSettingsRowFor).
// A council with no mapping row falls back to the ParentOrganizations row whose org_code matches its
// Council.parent_organization (resolveCouncilParentOrgId). Every mapping write keeps Council.parent_organization and
// tenant_type in step, and only the 'KofC' code unlocks the fraternal extensions (tenant.ts).
// =========================================================================
import { BusinessRuleError, describeActor, hasSuperAdminRights, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import { tenantTypeForParent, type TenantType } from './tenant';
import type { Council, PlatformSettings } from './types';

export const VERTICAL_TYPES = ['FRATERNAL', 'SECULAR_NONPROFIT'] as const;
export type VerticalType = (typeof VERTICAL_TYPES)[number];

export const VERTICAL_TYPE_LABELS: Record<VerticalType, string> = {
  FRATERNAL: 'Fraternal order',
  SECULAR_NONPROFIT: 'Secular nonprofit',
};

/** One ParentOrganizations row. */
export interface ParentOrganizationRecord {
  id: number;
  org_name: string;
  org_code: string;
  vertical_type: VerticalType;
  created_at?: string | null;
}

/** One CouncilParentMappings row. */
export interface CouncilParentMapping {
  id: number;
  council_id: number;
  parent_org_id: number;
  /** The council this chapter sits under in the hierarchy, or null for a top-level council. */
  parent_council_id: number | null;
  mapped_at?: string | null;
}

/** What parentOrganizations.create accepts. */
export interface ParentOrganizationInput {
  org_name: string;
  org_code: string;
  vertical_type: VerticalType;
}

/**
 * Which parent organization a read is for: a council (resolved through its mapping) or a parent organization id.
 * `parentOrgId: null` asks for the shared platform defaults only. No scope at all reads every row (the Super Admin's
 * maintenance view and the older callers).
 */
export interface ParentOrgScope {
  councilId?: number;
  parentOrgId?: number | null;
}

/** The ParentOrganizations ids of the seed: the Knights of Columbus (1) and the secular charity (2). */
export const KOFC_PARENT_ORG_ID = 1;
export const SECULAR_CHARITY_PARENT_ORG_ID = 2;

/** Longest org_name (VARCHAR(100)) and org_code (VARCHAR(30)). */
export const PARENT_ORG_NAME_MAX_LENGTH = 100;
export const PARENT_ORG_CODE_MAX_LENGTH = 30;

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

/** parentOrganizations.create's input, trimmed: a name, a code of letters, digits and underscores, and a known vertical. */
export function cleanParentOrganizationInput(input: unknown): ParentOrganizationInput {
  const raw = (input ?? {}) as Record<string, unknown>;
  const name = typeof raw.org_name === 'string' ? raw.org_name.trim() : '';
  const code = typeof raw.org_code === 'string' ? raw.org_code.trim() : '';
  const vertical = typeof raw.vertical_type === 'string' ? raw.vertical_type.trim().toUpperCase() : '';
  if (!name) throw invalid('Enter the parent organization name.', { field: 'org_name' });
  if (name.length > PARENT_ORG_NAME_MAX_LENGTH) throw invalid(`The name may be at most ${PARENT_ORG_NAME_MAX_LENGTH} characters.`, { field: 'org_name' });
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(code)) {
    throw invalid('The code must start with a letter and use only letters, digits and underscores, for example ELKS_LODGE.', { field: 'org_code', value: code });
  }
  if (code.length > PARENT_ORG_CODE_MAX_LENGTH) throw invalid(`The code may be at most ${PARENT_ORG_CODE_MAX_LENGTH} characters.`, { field: 'org_code' });
  if (!(VERTICAL_TYPES as readonly string[]).includes(vertical)) {
    throw invalid(`The vertical must be one of ${VERTICAL_TYPES.join(', ')}.`, { field: 'vertical_type', value: raw.vertical_type });
  }
  return { org_name: name, org_code: code, vertical_type: vertical as VerticalType };
}

/** Refuses a name or code another parent organization already holds, ignoring case. */
export function assertParentOrganizationUnique(rows: readonly Pick<ParentOrganizationRecord, 'id' | 'org_name' | 'org_code'>[], input: ParentOrganizationInput): void {
  const same = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();
  const name = rows.find((r) => same(r.org_name, input.org_name));
  if (name) throw invalid(`A parent organization named "${input.org_name}" already exists (id ${name.id}).`, { field: 'org_name', existingId: name.id });
  const code = rows.find((r) => same(r.org_code, input.org_code));
  if (code) throw invalid(`The code "${input.org_code}" is taken by ${code.org_name} (id ${code.id}).`, { field: 'org_code', existingId: code.id });
}

/** Only an Active Super Admin adds parent organizations or maps councils to them (SUPER_ADMIN_REQUIRED). */
export function assertMayMaintainParentOrganizations(actor: MemberWriteActor, action: string): void {
  if (hasSuperAdminRights(actor)) return;
  throw new SecurityPrivilegeError('SUPER_ADMIN_REQUIRED', `Only an active Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`, {
    actorId: actor.memberId,
    actorType: actor.memberType ?? null,
  });
}

/** The Council columns a mapping write keeps in step: the org's code, and the tenant type only 'KofC' makes fraternal. */
export function councilColumnsForParentOrg(org: Pick<ParentOrganizationRecord, 'org_code'>): { parent_organization: string; tenant_type: TenantType } {
  const code = org.org_code.trim();
  return { parent_organization: code, tenant_type: tenantTypeForParent(code.toUpperCase() === 'KOFC' ? 'KofC' : 'SECULAR_CHARITY') };
}

/** The ParentOrganizations row a council's stored code names ('kofc' in any case is the 'KofC' row), or undefined. */
export function parentOrgForCode<T extends Pick<ParentOrganizationRecord, 'org_code'>>(orgs: readonly T[], code: unknown): T | undefined {
  const text = typeof code === 'string' && code.trim() !== '' ? code.trim().toUpperCase() : 'KOFC';
  return orgs.find((o) => o.org_code.toUpperCase() === text);
}

/**
 * The parent organization id of a council: its mapping row, otherwise the org whose code its Council.parent_organization
 * holds (a blank code reads as 'KofC', and tenant_type 'GENERIC' as 'SECULAR_CHARITY'), otherwise null.
 */
export function resolveCouncilParentOrgId(
  council: Pick<Council, 'id'> & Partial<Pick<Council, 'parent_organization' | 'tenant_type'>>,
  mappings: readonly Pick<CouncilParentMapping, 'council_id' | 'parent_org_id'>[],
  orgs: readonly Pick<ParentOrganizationRecord, 'id' | 'org_code'>[],
): number | null {
  const mapped = mappings.find((m) => m.council_id === council.id);
  if (mapped) return mapped.parent_org_id;
  const blank = council.parent_organization === undefined || council.parent_organization === null || String(council.parent_organization).trim() === '';
  const code = blank ? (String(council.tenant_type ?? '').trim().toUpperCase() === 'GENERIC' ? 'SECULAR_CHARITY' : 'KofC') : council.parent_organization;
  return parentOrgForCode(orgs, code)?.id ?? null;
}

/**
 * The rows of a global lookup table a parent organization reads: the shared rows (parent_org_id NULL) and its own.
 * `undefined` reads every row; `null` reads the shared rows only.
 */
export function lookupRowsInScope<R extends { parent_org_id?: number | null }>(rows: readonly R[], parentOrgId: number | null | undefined): R[] {
  if (parentOrgId === undefined) return [...rows];
  return rows.filter((r) => r.parent_org_id === undefined || r.parent_org_id === null || r.parent_org_id === parentOrgId);
}

/**
 * The rows a new or renamed lookup row's key must not clash with: for a shared row every row (it would show in every
 * organization), for an organization's row the shared rows and that organization's own.
 */
export const lookupKeyScopeRows = <R extends { parent_org_id?: number | null }>(rows: readonly R[], parentOrgId: number | null): R[] =>
  parentOrgId === null ? [...rows] : lookupRowsInScope(rows, parentOrgId);

/** Validates the parent organization a lookup row or settings row is filed under: null (shared) or a known id. */
export function cleanParentOrgId(value: unknown, orgs: readonly Pick<ParentOrganizationRecord, 'id'>[]): number | null {
  if (value === undefined || value === null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || !orgs.some((o) => o.id === id)) throw invalid(`There is no parent organization with id ${String(value)}.`, { field: 'parent_org_id', value });
  return id;
}

/**
 * The PlatformSettings row a parent organization reads: its own override row when it has one, otherwise the platform
 * default row (parent_org_id NULL, id 1). `null` or `undefined` reads the default.
 */
export function platformSettingsRowFor<R extends Partial<PlatformSettings>>(rows: readonly R[], parentOrgId: number | null | undefined, defaultId: number): R | undefined {
  const own = parentOrgId === undefined || parentOrgId === null ? undefined : rows.find((r) => r.parent_org_id === parentOrgId);
  return own ?? rows.find((r) => r.id === defaultId);
}

/** The label of a scope for a heading: 'Shared by every organization' or the organization's name. */
export const parentOrgScopeLabel = (orgs: readonly Pick<ParentOrganizationRecord, 'id' | 'org_name'>[], parentOrgId: number | null): string =>
  parentOrgId === null ? 'Shared by every organization' : (orgs.find((o) => o.id === parentOrgId)?.org_name ?? `Parent organization ${parentOrgId}`);
