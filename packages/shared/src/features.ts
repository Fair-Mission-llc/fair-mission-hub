// =========================================================================
// COUNCIL FEATURE FLAGS (Sprint 6A, widened in Sprint 6R)
// On/off switches on the Council row. A flag that is off hides its module from the portal sidebar, its pages
// (RequireArea), the phone's tab bar and the buttons that lead there, for every member of the council, leaving the
// financial engine and the simple service logs. Only a Super Admin flips them (councils.setFeatureFlags), from the
// Feature Flags Control Center (/feature-flags, Sprint 6R). The data behind a hidden module stays; switching the flag
// back on brings it all back.
// Sprint 6R (schema 57) adds six 'feature_*' switches beside the five 'flag_*' ones, named as the user gave them: expense
// reporting, the Faith Center, the Constitutional Advisor, the council bylaws, the council history and the live console.
// Sprint 11 Revision 7.0 (schema 106) adds four premium switches - capital asset tracking, the Global Charities
// Registry, the document compilation pipelines and the financial management dashboards - and the Master Feature
// Deployment Grid (/feature-flags, also /super-admin). A new council (councils.create) starts with
// LIGHTWEIGHT_FEATURE_FLAGS. Councils already on file keep their stored switches.
// Sprint 11 Revision 8.0 (schema 107) retires three switches - event shifts (flag_complex_shifts), flagged hours review
// (feature_volunteer_quarantine, Sprint 7B) and the financial management dashboards (feature_financial_management) - as
// permanent core systems. Their columns stay on the Council table, unread (RETIRED_FEATURE_COLUMNS). It adds five
// premium switches - the Media & Memory Center, the Lessons & Knowledge Registries, the Recruitment Factory (split
// from the document compilation pipelines), the Shared Equipment Library (split from capital asset tracking) and the
// Advanced Financial Audits (now Financial Inspections) - and widens the Council History switch (now Historical Chronology, Revision 10.0). A switch that is off
// also hides its officer desk drawers (desk-drawers.ts, by portal area), its Navigation Guide entries (portalSidebar) and
// adds a 'disabled' banner to the matching sections of the council's custom manuals (scripts/compile_all_manuals.py).
// =========================================================================
import type { PortalArea } from './permissions';
import { assertValidHours, BusinessRuleError, HOURS_STEP } from './rules';
import type { Council } from './types';

export const FEATURE_FLAG_NAMES = [
  'flag_mobile_elections',
  'flag_fundraising_inflow',
  'flag_charity_proposals',
  'flag_meeting_management',
  'feature_expense_reporting',
  'feature_faith_center',
  'feature_constitutional_advisor',
  'feature_council_bylaws',
  'feature_council_history',
  'feature_live_meeting_console',
  'feature_capital_assets',
  'feature_charity_registry',
  'feature_document_compilation',
  'feature_photo_gallery',
  'feature_lessons_registry',
  'feature_marketing_factory',
  'feature_loaner_library',
  'feature_advanced_audits',
] as const;
export type FeatureFlagName = (typeof FEATURE_FLAG_NAMES)[number];

/** Sprint 11 Revision 8.0: the five switches the revision added (schema 107). */
export const REV80_FEATURE_FLAGS = [
  'feature_photo_gallery',
  'feature_lessons_registry',
  'feature_marketing_factory',
  'feature_loaner_library',
  'feature_advanced_audits',
] as const satisfies readonly FeatureFlagName[];

/**
 * Sprint 11 Revision 8.0: the switches retired as permanent core systems. Their BIT columns stay on the Council table
 * (the schema generator cannot drop a column), but nothing reads them and councils.setFeatureFlags refuses them.
 */
export const RETIRED_FEATURE_COLUMNS = ['flag_complex_shifts', 'feature_volunteer_quarantine', 'feature_financial_management'] as const;

/** Whether each module is on for a council. */
export type FeatureFlags = Record<FeatureFlagName, boolean>;

/** Every module on: the default for a council row that predates the flags or has not loaded yet. */
export const ALL_FEATURES_ON: FeatureFlags = Object.fromEntries(FEATURE_FLAG_NAMES.map((k) => [k, true])) as FeatureFlags;

/**
 * Sprint 11 Revision 7.0: the footprint a new council starts with. Since Revision 8.0 every switch is a premium module,
 * so a new council starts with all of them off; the core systems (ALWAYS_ON_MODULES) have no switch and always show.
 */
export const LIGHTWEIGHT_FEATURE_FLAGS: FeatureFlags = Object.fromEntries(FEATURE_FLAG_NAMES.map((k) => [k, false])) as FeatureFlags;

/**
 * Sprint 11 Revision 9.0: the premium switches Council 15295 (CouncilID 1) starts with off (Seed.sql): capital assets,
 * the charity registry, advanced financial audits, document compilation, the photo gallery, the loaner library, the
 * marketing factory and the election center. Its other switches keep the column default (on).
 */
export const COUNCIL_15295_SEED_OFF_FLAGS = [
  'feature_capital_assets',
  'feature_charity_registry',
  'feature_advanced_audits',
  'feature_document_compilation',
  'feature_photo_gallery',
  'feature_loaner_library',
  'feature_marketing_factory',
  'flag_mobile_elections',
] as const satisfies readonly FeatureFlagName[];

/** Sprint 11 Revision 9.0: Council 15295's switches as seeded. */
export const COUNCIL_15295_SEED_FLAGS: FeatureFlags = {
  ...ALL_FEATURES_ON,
  ...Object.fromEntries(COUNCIL_15295_SEED_OFF_FLAGS.map((k) => [k, false])),
};

/** Sprint 11 Revision 7.0: the Super Admin page's title (/feature-flags and /super-admin). */
export const MASTER_FEATURE_GRID_TITLE = 'Master Feature Deployment Grid';

/**
 * The core systems that always show, with no switch. Sprint 11 Revision 8.0 adds event shifts, flagged hours review and
 * the financial management dashboards.
 */
export const ALWAYS_ON_MODULES = [
  'Service hours',
  'Event communications',
  'Calendars',
  'Event shifts',
  'Flagged hours review',
  'Financial management dashboards',
] as const;

/** Sprint 11 Revision 7.0: how the Master Feature Deployment Grid groups the switches. Every switch is premium since 8.0. */
export type FeatureFlagTier = 'lightweight' | 'premium';
export const featureFlagTier = (name: FeatureFlagName): FeatureFlagTier => (LIGHTWEIGHT_FEATURE_FLAGS[name] ? 'lightweight' : 'premium');

/** The BIT column values a new council is stored with (councils.create). */
export const lightweightFeatureColumns = (): Record<FeatureFlagName, 0 | 1> =>
  Object.fromEntries(FEATURE_FLAG_NAMES.map((n) => [n, LIGHTWEIGHT_FEATURE_FLAGS[n] ? 1 : 0])) as Record<FeatureFlagName, 0 | 1>;

/** How the master admin portal names and explains each switch. */
export const FEATURE_FLAG_LABELS: Record<FeatureFlagName, { label: string; hint: string }> = {
  flag_mobile_elections: { label: 'Officer elections', hint: 'Officer nominations and the appointed leadership matrix' },
  flag_fundraising_inflow: {
    label: 'Fundraising inflow',
    hint: 'Recorded donations, the phone app Collect tab: event point-of-sale, card and QR collections, gate intake drawers',
  },
  flag_charity_proposals: { label: 'Charity proposals', hint: 'Member charity grant proposals and the vetting desk that tracks them' },
  flag_meeting_management: { label: 'Meeting management', hint: 'Meeting center, cadence manager and the phone app Meetings tab' },
  feature_expense_reporting: {
    label: 'Expense reporting',
    hint: 'Member expense reports, the FS, Treasurer and GK signature desks, check payments made and the phone app expense screen',
  },
  feature_faith_center: {
    label: 'Faith Center',
    hint: "The web Faith Center page and the phone app's feast-day banner, Daily Bible Quote and prayer intentions",
  },
  feature_constitutional_advisor: { label: 'Constitutional Advisor', hint: 'The parliamentary question desk that cites the bylaws' },
  feature_council_bylaws: { label: 'Council bylaws', hint: "The council's constitutional bylaws page" },
  feature_council_history: {
    label: 'Historical Chronology',
    hint: "The Team Legacy history page (annals, diary, oral histories, In Memoriam) and the Historian Desk's diary and oral history drawers",
  },
  feature_live_meeting_console: { label: 'Live meeting console', hint: 'The live meeting console: agenda, check-ins, secret ballots and hand tallies' },
  feature_capital_assets: {
    label: 'Capital asset tracking',
    hint: "The council asset inventory, the Admin Desk's asset drawer and the phone app Council Assets screen",
  },
  feature_charity_registry: { label: 'Global charity registry', hint: "The Global Charities Registry page and the Admin Desk's registry drawer" },
  feature_document_compilation: {
    label: 'Document compilation pipelines',
    hint: 'The printable custom guide compiler on Council Wide Settings and its PDF route',
  },
  feature_photo_gallery: {
    label: 'Media & Memory Center',
    hint: "The photo gallery page and the Historian Desk's media gallery and meeting photo drawers",
  },
  feature_lessons_registry: {
    label: 'Lessons & Knowledge Registries',
    hint: 'The lessons-learned registry and the Operations Knowledge Vault with its officer desk drawers',
  },
  feature_marketing_factory: { label: 'Recruitment Factory', hint: 'The marketing flyer factory and its co-pilot route' },
  feature_loaner_library: { label: 'Shared Equipment Library', hint: "The shared loaner library page and the Grand Knight Desk's loaner drawer" },
  feature_advanced_audits: {
    label: 'Financial Inspections',
    hint: "The Trustees' semiannual audit and Form 1295 center, on its page and the Financial Secretary Desk",
  },
};

/**
 * The portal areas each flag hides when it is off. Officer desk drawers carry a portal area, so they hide with it
 * (desk-drawers.ts deskDrawersFor), and so do the Navigation Guide's entries (navigation-guide.ts reads portalSidebar).
 */
export const FEATURE_FLAG_AREAS: Record<FeatureFlagName, readonly PortalArea[]> = {
  flag_mobile_elections: ['elections', 'elections/appointments'],
  flag_fundraising_inflow: ['donations'],
  flag_charity_proposals: ['charities/propose', 'charities/vetting'],
  flag_meeting_management: ['meetings', 'meetings/cadence', 'meetings/live'],
  // The Treasurer's desk codes expense sheets, so it goes with them; the general ledger and the budget stay.
  feature_expense_reporting: ['expenses', 'expenses/queue', 'expenses/audit', 'expenses/authorize', 'expenses/disbursements', 'finance/treasurer-desk'],
  feature_faith_center: ['faith-center'],
  feature_constitutional_advisor: ['governance/advisor'],
  feature_council_bylaws: ['governance/bylaws'],
  feature_council_history: ['history'],
  feature_live_meeting_console: ['meetings/live'],
  feature_capital_assets: ['expenses/assets'],
  feature_charity_registry: ['charities/registry'],
  // The custom guide compiler is a card on Council Wide Settings, not its own area; that page reads the flag itself.
  feature_document_compilation: [],
  feature_photo_gallery: ['gallery'],
  feature_lessons_registry: ['lessons-registry', 'system-settings/knowledge-archive'],
  feature_marketing_factory: ['resources/marketing'],
  feature_loaner_library: ['inventory/loaner-library'],
  feature_advanced_audits: ['finance/audit'],
};

/** The phone app's tabs (route names under app/(app)) that a flag hides when it is off. */
export type MobileTab = 'index' | 'shifts' | 'log' | 'meetings' | 'donate';
export const FEATURE_FLAG_MOBILE_TABS: Record<FeatureFlagName, readonly MobileTab[]> = {
  ...(Object.fromEntries(FEATURE_FLAG_NAMES.map((k) => [k, []])) as unknown as Record<FeatureFlagName, readonly MobileTab[]>),
  // The phone app has no election or charity proposal screens; those flags only trim the portal. The phone's expense
  // screen, Faith Center and Council Assets screen are not tabs; they read their flags themselves (FeatureGate).
  flag_fundraising_inflow: ['donate'],
  flag_meeting_management: ['meetings'],
};

/** A council row's flags; a missing or NULL column reads as on. */
export function councilFeatureFlags(council: Partial<Pick<Council, FeatureFlagName>> | null | undefined): FeatureFlags {
  const flags = { ...ALL_FEATURES_ON };
  for (const name of FEATURE_FLAG_NAMES) {
    const value = council?.[name];
    if (value !== undefined && value !== null) flags[name] = Number(value) !== 0;
  }
  return flags;
}

/** The switches that are off for a council, in FEATURE_FLAG_NAMES order (the custom manual banners read them). */
export const disabledFeatureFlags = (flags: FeatureFlags): FeatureFlagName[] => FEATURE_FLAG_NAMES.filter((n) => !flags[n]);

/** Drops the portal areas whose module is switched off. */
export function withFeatureFlags<T extends PortalArea>(areas: readonly T[], flags: FeatureFlags): T[] {
  const hidden = new Set<PortalArea>(FEATURE_FLAG_NAMES.filter((name) => !flags[name]).flatMap((name) => FEATURE_FLAG_AREAS[name]));
  return areas.filter((area) => !hidden.has(area));
}

/** Whether the phone app shows `tab` under these flags. */
export const mobileTabEnabled = (tab: MobileTab, flags: FeatureFlags): boolean =>
  FEATURE_FLAG_NAMES.every((name) => flags[name] || !FEATURE_FLAG_MOBILE_TABS[name].includes(tab));

/** The changes councils.setFeatureFlags accepts: any subset of the flags. */
export type FeatureFlagChanges = Partial<FeatureFlags>;

/**
 * Validates a councils.setFeatureFlags request: every key a known flag, every value a boolean. Returns the BIT values to
 * store, only for the flags named. A retired switch (now a core system) is refused by name.
 */
export function cleanFeatureFlagChanges(changes: FeatureFlagChanges): Partial<Record<FeatureFlagName, 0 | 1>> {
  const out: Partial<Record<FeatureFlagName, 0 | 1>> = {};
  for (const [key, value] of Object.entries(changes ?? {})) {
    if ((RETIRED_FEATURE_COLUMNS as readonly string[]).includes(key)) {
      throw new BusinessRuleError('INVALID_INPUT', `"${key}" is a permanent core system now and has no switch.`, { flag: key });
    }
    if (!(FEATURE_FLAG_NAMES as readonly string[]).includes(key)) {
      throw new BusinessRuleError('INVALID_INPUT', `"${key}" is not a feature flag; the flags are ${FEATURE_FLAG_NAMES.join(', ')}.`, { flag: key });
    }
    if (typeof value !== 'boolean') {
      throw new BusinessRuleError('INVALID_INPUT', `Feature flag ${key} must be true or false; received ${String(value)}.`, { flag: key, value });
    }
    out[key as FeatureFlagName] = value ? 1 : 0;
  }
  return out;
}

/**
 * The rapid-tap tracker's next total (Sprint 6A): an entry's hours plus one 15-minute step, or one step for a new entry,
 * validated like any logged hours (HOURS_OUT_OF_RANGE past 24).
 */
export const nextQuarterHourTotal = (current: number | null | undefined): number => assertValidHours((current ?? 0) + HOURS_STEP);
