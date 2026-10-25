// =========================================================================
// THE COUNCIL FEATURE DEPLOYMENT MATRIX (Sprint 8Q, schema version 90)
//
// Sprint 8S Revision 10.1: Council Wide Settings (/system-settings/council-settings) is a filing cabinet - a 25% left
// rail of four flat text tabs (COUNCIL_SETTINGS_CABINET_TABS) beside a 75% canvas that shows the chosen tab's cards:
//   - Standard Bank Accounts        the payment and account pages (Council Lookups, Credentials Vault) and the read-only
//                                   Council Instance Record (EIN, dues, email gateway, schema version);
//   - Global Revenue Splits         the parish split and the Annual Budget Planner banner;
//   - User Access & Roster Control  meeting check-in, the inactivity sweep and the rank benchmarks;
//   - System Flags & Toggles        the timing and limit cards, this matrix (with the biometric sign-in switch), loaner
//                                   library sharing, the module and platform pages, the reference archives and the
//                                   custom user guides.
// (Sprint 8Q's two accordion buckets, Operational Configuration and System Information, are gone.)
//
// The matrix (councilFeatureDeployment) is one scannable row per advanced capability and per council module, each with
// a '🟢 DEPLOYED' or '⚪ AVAILABLE / OFF' badge read from the council row itself, and where the switch lives. Nothing
// here writes: each capability keeps its own switch and its own editors.
//
// Council.biometric_login_enabled (Schema 90, DEFAULT 1) is the one new switch: 0 turns off FaceID / biometric sign-in
// on the phones of the council's members (councils.setBiometricLoginEnabled, the Council Wide Settings editors).
// =========================================================================
import { councilFeatureFlags, FEATURE_FLAG_LABELS, FEATURE_FLAG_NAMES, type FeatureFlagName } from './features';
import type { Council } from './types';

/** The four flat tabs of the Council Wide Settings filing cabinet (Sprint 8S Revision 10.1), in rail order. */
export const COUNCIL_SETTINGS_CABINET_TABS = [
  { id: 'bank-accounts', label: 'Standard Bank Accounts', hint: "Payment methods, account owners and sealed keys, and the council's record." },
  { id: 'revenue-splits', label: 'Global Revenue Splits', hint: "The parish's share of fundraisers and the year's budget planning steps." },
  { id: 'access-roster', label: 'User Access & Roster Control', hint: 'Meeting check-in, the inactivity sweep and the member rank benchmarks.' },
  { id: 'flags-toggles', label: 'System Flags & Toggles', hint: 'Time limits and windows, which features are on, sharing switches and printable guides.' },
] as const;
export type CouncilSettingsTabId = (typeof COUNCIL_SETTINGS_CABINET_TABS)[number]['id'];

/** The matrix section's title. */
export const FEATURE_DEPLOYMENT_MATRIX_TITLE = 'Council Feature Deployment Matrix';
/** The two status badges. */
export const FEATURE_DEPLOYED_BADGE = '🟢 DEPLOYED';
export const FEATURE_OFF_BADGE = '⚪ AVAILABLE / OFF';

/** Whether the council lets its members sign in with FaceID / biometrics (Council.biometric_login_enabled; missing reads as on). */
export function biometricLoginEnabled(council: Pick<Council, 'biometric_login_enabled'> | null | undefined): boolean {
  const value = council?.biometric_login_enabled;
  return value === undefined || value === null || Number(value) !== 0;
}

export type FeatureDeploymentGroup = 'capability' | 'module';

/** One row of the matrix. */
export interface FeatureDeploymentRow {
  id: string;
  group: FeatureDeploymentGroup;
  label: string;
  description: string;
  deployed: boolean;
  /** Where the switch lives, in words. */
  managedOn: string;
  /** The page that holds the switch, when it is not on Council Wide Settings itself. */
  href?: string;
}

type DeploymentCouncil = Pick<
  Council,
  | FeatureFlagName
  | 'parish_split_enabled'
  | 'is_loaner_library_enabled'
  | 'biometric_login_enabled'
  | 'meeting_latitude'
  | 'meeting_longitude'
  | 'SmtpHost'
>;

const on = (value: number | null | undefined) => Number(value ?? 0) === 1;
/** Where on this page a capability's switch lives: the cabinet tab, then the card (Sprint 8S Revision 10.1). */
const onTab = (id: CouncilSettingsTabId, card: string) => `This page, ${COUNCIL_SETTINGS_CABINET_TABS.find((t) => t.id === id)!.label} tab: ${card}`;

/**
 * The matrix for one council: the advanced capabilities first (parish splits, the shared asset library, biometric sign-in,
 * the geofenced check-in, the email gateway), then the council's twelve modules in FEATURE_FLAG_NAMES order.
 */
export function councilFeatureDeployment(council: Partial<DeploymentCouncil>): FeatureDeploymentRow[] {
  const capabilities: FeatureDeploymentRow[] = [
    {
      id: 'parish-split',
      group: 'capability',
      label: 'Parametric Parish Splits',
      description: "Shares each fundraiser's collections with the parish at the council's saved percentage and GL line.",
      deployed: on(council.parish_split_enabled),
      managedOn: onTab('revenue-splits', 'Parish Fundraiser Split'),
    },
    {
      id: 'loaner-library',
      group: 'capability',
      label: 'Cross-Council Shared Asset Libraries',
      description: "Lends the council's listed assets to its connected councils in the Cross-Council Loaner Library.",
      deployed: on(council.is_loaner_library_enabled),
      managedOn: onTab('flags-toggles', 'Cross-Council Loaner Library Sharing'),
    },
    {
      id: 'biometric',
      group: 'capability',
      label: 'Biometric Authentication',
      description: "Lets the council's members sign in on the phone app with FaceID or a fingerprint.",
      deployed: biometricLoginEnabled(council),
      managedOn: onTab('flags-toggles', 'the switch in this row'),
    },
    {
      id: 'geofence',
      group: 'capability',
      label: 'Geofenced Meeting Check-In',
      description: 'Checks members in by GPS inside the meeting circle. Without a meeting point only the PIN works.',
      deployed: council.meeting_latitude != null && council.meeting_longitude != null,
      managedOn: onTab('access-roster', 'Meeting Check-In'),
    },
    {
      id: 'email-gateway',
      group: 'capability',
      label: 'Council Email Gateway',
      description: "Sends the council's portal email through its own outgoing mail server.",
      deployed: (council.SmtpHost ?? '').trim() !== '',
      managedOn: 'Council Lookups: Email Gateway',
      href: '/council-lookups',
    },
  ];
  const flags = councilFeatureFlags(council);
  const modules: FeatureDeploymentRow[] = FEATURE_FLAG_NAMES.map((name) => ({
    id: name,
    group: 'module',
    label: FEATURE_FLAG_LABELS[name].label,
    description: FEATURE_FLAG_LABELS[name].hint,
    deployed: flags[name],
    managedOn: 'Feature Flags Control Center (Super Admins)',
    href: '/feature-flags',
  }));
  return [...capabilities, ...modules];
}

/** The badge a row shows. */
export const featureDeploymentBadge = (row: Pick<FeatureDeploymentRow, 'deployed'>): string => (row.deployed ? FEATURE_DEPLOYED_BADGE : FEATURE_OFF_BADGE);

/**
 * The platform's database schema version, shown under System Information. It moves with the phone database's
 * SCHEMA_VERSION (apps/mobile/services/drivers/sqlite.ts) and the Schema.sql sprint headers.
 */
export const PLATFORM_SCHEMA_VERSION = 100;
