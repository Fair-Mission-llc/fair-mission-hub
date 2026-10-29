// =========================================================================
// MULTI-TENANT WHITE-LABEL GATE (Sprint 6Z-Dual-Gate-Model, schema version 39)
// Council.tenant_type says what kind of organization a council row is. 'KOFC' (the default) is a Knights of Columbus
// council: every fraternal extension is on and the portal speaks the order's language. Any other type is a
// white-labelled community organization: the fraternal extensions (FRATERNAL_AREAS, the liturgical overlay) are hidden,
// the drivers reject their operations (assertFraternalExtension in workflow.ts), and labels pass through whiteLabel.
//
// This is the second of the two gates. The first, the feature flags (features.ts), switches individual modules on and
// off within either kind of tenant.
// =========================================================================
import type { PortalArea } from './permissions';
import type { Council } from './types';
import { BusinessRuleError } from './rules';

export const TENANT_TYPES = ['KOFC', 'GENERIC'] as const;
export type TenantType = (typeof TENANT_TYPES)[number];

/** The tenant a council row that predates the column, or has not loaded yet, belongs to. */
export const DEFAULT_TENANT_TYPE: TenantType = 'KOFC';

// ---- Parent organization (Sprint 11 Revision 12.0, schema 110) ----------------------------------------------------
// Council.parent_organization names the umbrella organization a tenant belongs to: 'KofC' (a Knights of Columbus
// council: the Knights lookups, the fraternal areas and the 34-line Form 1728 suggestion popups) or 'SECULAR_CHARITY'
// (a non-denominational charity: the fraternal areas are masked and the settings read in corporate language). It is the
// primary field; tenant_type (schema 39) is kept in step on every write (KofC <-> KOFC, SECULAR_CHARITY <-> GENERIC) so
// older code and data keep working.

export const PARENT_ORGANIZATIONS = ['KofC', 'SECULAR_CHARITY'] as const;
export type ParentOrganization = (typeof PARENT_ORGANIZATIONS)[number];
export const DEFAULT_PARENT_ORGANIZATION: ParentOrganization = 'KofC';

export const PARENT_ORGANIZATION_LABELS: Record<ParentOrganization, string> = {
  KofC: 'Knights of Columbus council',
  SECULAR_CHARITY: 'Secular charity (non-denominational)',
};

/** The tenant_type kept in step with a parent organization. */
export const tenantTypeForParent = (parent: ParentOrganization): TenantType => (parent === 'KofC' ? 'KOFC' : 'GENERIC');
/** The parent organization a tenant_type stands for. */
export const parentOrganizationForTenant = (tenant: TenantType): ParentOrganization => (tenant === 'KOFC' ? 'KofC' : 'SECULAR_CHARITY');

const isBlank = (value: unknown) => value === undefined || value === null || String(value).trim() === '';

/**
 * A council row's parent organization: parent_organization when set ('kofc' in any case is 'KofC', any other value is
 * 'SECULAR_CHARITY', so an unknown value never unlocks the fraternal extensions), otherwise read from tenant_type.
 */
export function councilParentOrganization(
  council: Partial<Pick<Council, 'tenant_type' | 'parent_organization'>> | null | undefined,
): ParentOrganization {
  const raw = council?.parent_organization;
  if (!isBlank(raw)) return String(raw).trim().toUpperCase() === 'KOFC' ? 'KofC' : 'SECULAR_CHARITY';
  return parentOrganizationForTenant(tenantFromTenantType(council?.tenant_type));
}

/** A parent organization a Super Admin may save: exactly 'KofC' or 'SECULAR_CHARITY', ignoring case. */
export function cleanParentOrganization(value: unknown): ParentOrganization {
  const text = typeof value === 'string' ? value.trim().toUpperCase() : '';
  const match = PARENT_ORGANIZATIONS.find((p) => p.toUpperCase() === text);
  if (match) return match;
  throw new BusinessRuleError('INVALID_INPUT', `The parent organization must be one of ${PARENT_ORGANIZATIONS.join(', ')}; got ${JSON.stringify(value)}.`, {
    field: 'parent_organization',
    value,
  });
}

function tenantFromTenantType(raw: unknown): TenantType {
  if (isBlank(raw)) return DEFAULT_TENANT_TYPE;
  return String(raw).trim().toUpperCase() === 'KOFC' ? 'KOFC' : 'GENERIC';
}

/**
 * A council row's tenant. Sprint 11 Revision 12.0: parent_organization decides when it is set. Otherwise a missing,
 * NULL or blank tenant_type reads as 'KOFC', any spelling of 'kofc' is 'KOFC', and every other value is a white-label
 * tenant ('GENERIC'), so an unknown type never unlocks the fraternal extensions.
 */
export function councilTenantType(council: Partial<Pick<Council, 'tenant_type' | 'parent_organization'>> | null | undefined): TenantType {
  if (!isBlank(council?.parent_organization)) return tenantTypeForParent(councilParentOrganization(council));
  return tenantFromTenantType(council?.tenant_type);
}

/**
 * A tenant_type a Super Admin may save (Sprint 6I, councils.setGlobalParameters): exactly one of TENANT_TYPES, ignoring
 * case and surrounding spaces. Rejects INVALID_INPUT otherwise; unlike councilTenantType it never guesses.
 */
export function cleanTenantType(value: unknown): TenantType {
  const text = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if ((TENANT_TYPES as readonly string[]).includes(text)) return text as TenantType;
  throw new BusinessRuleError('INVALID_INPUT', `The tenant type must be one of ${TENANT_TYPES.join(', ')}; got ${JSON.stringify(value)}.`, {
    field: 'tenant_type',
    value,
  });
}

/** True for the Knights of Columbus tenant, the only one with the fraternal extensions. */
export const isFraternalTenant = (tenant: TenantType): boolean => tenant === 'KOFC';

/**
 * The portal areas only a Knights of Columbus council has: Supreme Council Sync (the order's Forms 1728 and 1295 and its
 * roster export), the Constitutional Advisor (which cites the order's Charter and Supreme Laws) and the web Faith Center
 * (Sprint 6L Extension 3: the feast day, the daily verse and the Council Prayer Intentions List).
 */
// Sprint 11 Revision 5.0: District Deputies and State Councils are Knights of Columbus offices.
export const FRATERNAL_AREAS: readonly PortalArea[] = ['supreme-sync', 'governance/advisor', 'faith-center', 'district-desk', 'state-desk', 'system-settings/regional-assignments'];

/** Drops the fraternal areas for a white-label tenant; a Knights of Columbus council keeps them all. */
export function withTenantGate<T extends PortalArea>(areas: readonly T[], tenant: TenantType): T[] {
  if (isFraternalTenant(tenant)) return [...areas];
  const fraternal = new Set<PortalArea>(FRATERNAL_AREAS);
  return areas.filter((area) => !fraternal.has(area));
}

/** The words the portal's chrome uses for the organization, which differ by tenant. */
export interface TenantVocabulary {
  /** The header title. */
  organizationName: string;
  /** One local unit: Council or Chapter. */
  unit: string;
  /** The presiding officer. */
  presidingOfficer: string;
}

export const TENANT_VOCABULARY: Record<TenantType, TenantVocabulary> = {
  KOFC: { organizationName: 'Knights of Columbus', unit: 'Council', presidingOfficer: 'Grand Knight' },
  GENERIC: { organizationName: 'Community Service Portal', unit: 'Chapter', presidingOfficer: 'President' },
};

/**
 * The fraternal terms a white-label tenant replaces, longest first so 'Deputy Grand Knight' is read before
 * 'Grand Knight' and 'Supreme Council' before 'Council'. Each pattern matches whole words and keeps the case of its
 * first letter where both cases occur.
 */
const WHITE_LABEL_TERMS: readonly (readonly [RegExp, string])[] = [
  [/\bKnights of Columbus\b/g, 'Community Service Portal'],
  [/\bDeputy Grand Knight\b/g, 'Vice President'],
  [/\bGrand Knights\b/g, 'Presidents'],
  [/\bGrand Knight\b/g, 'President'],
  [/\bDGK\b/g, 'Vice President'],
  [/\bGK\b/g, 'President'],
  [/\bSupreme Council\b/g, 'National Office'],
  [/\bSupreme\b/g, 'National'],
  [/\bbrother Knights\b/g, 'fellow members'],
  [/\bbrother Knight\b/g, 'fellow member'],
  [/\bKnights\b/g, 'Members'],
  [/\bKnight\b/g, 'Member'],
  [/\bFraternal\b/g, 'Community'],
  [/\bfraternal\b/g, 'community'],
  [/\bFaith In Action\b/g, 'Service In Action'],
  [/\bFaith-in-Action\b/g, 'Service-in-Action'],
  [/\bCouncils\b/g, 'Chapters'],
  [/\bCouncil\b/g, 'Chapter'],
  [/\bcouncils\b/g, 'chapters'],
  [/\bcouncil\b/g, 'chapter'],
];

/** `text` in the tenant's vocabulary: unchanged for a Knights of Columbus council, neutral words for a white label. */
export function whiteLabel(text: string, tenant: TenantType): string {
  if (isFraternalTenant(tenant)) return text;
  return WHITE_LABEL_TERMS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}
