// =========================================================================
// THE COUNCIL FEATURE DEPLOYMENT MATRIX (Sprint 8Q, schema version 90)
//
// Sprint 10 Revision 3.0: Council Wide Settings (/system-settings/council-settings) is a stack of collapsible drawer
// panels (COUNCIL_SETTINGS_DRAWERS), replacing the Sprint 8S Revision 10.1 filing cabinet of four tabs:
//   - Standard Bank Accounts        the payment and account pages (Council Lookups, Credentials Vault) and the read-only
//                                   Council Instance Record (EIN, dues, email gateway, schema version);
//   - User Access & Roster Control  meeting check-in, the inactivity sweep and the rank benchmarks;
//   - System Settings               the timing and limit cards and the custom user guides;
//   - Feature Controls              the parish fundraiser split, loaner library sharing and the module switch pages;
//   - Council Feature Deployment Matrix   this matrix alone (with the biometric sign-in switch).
// The Global Revenue Splits tab and the Reference Archives links are gone.
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

/**
 * Sprint 10 Revision 3.0: the Council Wide Settings page is a stack of collapsible drawer panels, in this order. The
 * Council Feature Deployment Matrix has its own drawer; the old 'System Flags & Toggles' tab is split into 'System
 * Settings' (the timing and limit cards and the custom guides) and 'Feature Controls' (the switches a council flips: the
 * parish split, loaner library sharing and the module pages). The 'Global Revenue Splits' tab and the 'Reference
 * Archives' links are gone; the Annual Budget Planner banner moved to the Annual Budget Center.
 */
export const COUNCIL_SETTINGS_DRAWERS = [
  { id: 'bank-accounts', label: 'Standard Bank Accounts', hint: "Payment methods, the Account Owners Matrix, sealed keys and the council's record." },
  { id: 'access-roster', label: 'User Access & Roster Control', hint: 'The inactivity sweep and the member rank benchmarks.' },
  { id: 'system-settings', label: 'System Settings', hint: 'Time limits, windows and reminders, where uploaded files are kept, and the printable custom guides.' },
  { id: 'feature-controls', label: 'Feature Controls', hint: 'Loaner library sharing and the module switch pages.' },
  { id: 'feature-matrix', label: 'Council Feature Deployment Matrix', hint: 'Which advanced capabilities and modules are on for the council, and where each switch lives.' },
] as const;
export type CouncilSettingsDrawerId = (typeof COUNCIL_SETTINGS_DRAWERS)[number]['id'];

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
  | 'is_loaner_library_enabled'
  | 'biometric_login_enabled'
  | 'meeting_latitude'
  | 'meeting_longitude'
  | 'SmtpHost'
>;

const on = (value: number | null | undefined) => Number(value ?? 0) === 1;
/** Where on this page a capability's switch lives: the drawer, then the card (Sprint 10 Revision 3.0). */
const onDrawer = (id: CouncilSettingsDrawerId, card: string) => `This page, ${COUNCIL_SETTINGS_DRAWERS.find((t) => t.id === id)!.label} drawer: ${card}`;

/**
 * The matrix for one council: the advanced capabilities first (the shared asset library, biometric sign-in,
 * the geofenced check-in, the email gateway), then the council's twelve modules in FEATURE_FLAG_NAMES order.
 */
export function councilFeatureDeployment(council: Partial<DeploymentCouncil>): FeatureDeploymentRow[] {
  const capabilities: FeatureDeploymentRow[] = [
    {
      id: 'loaner-library',
      group: 'capability',
      label: 'Cross-Council Shared Asset Libraries',
      description: "Lends the council's listed assets to its connected councils in the Cross-Council Loaner Library.",
      deployed: on(council.is_loaner_library_enabled),
      managedOn: onDrawer('feature-controls', 'Cross-Council Loaner Library Sharing'),
    },
    {
      id: 'biometric',
      group: 'capability',
      label: 'Biometric Authentication',
      description: "Lets the council's members sign in on the phone app with FaceID or a fingerprint.",
      deployed: biometricLoginEnabled(council),
      managedOn: onDrawer('feature-matrix', 'the switch in this row'),
    },
    {
      id: 'geofence',
      group: 'capability',
      label: 'Geofenced Meeting Check-In',
      description: 'Checks members in by GPS inside the meeting circle. Without a meeting point only the PIN works.',
      deployed: council.meeting_latitude != null && council.meeting_longitude != null,
      // Sprint 10 Revision 4.0: the check-in card moved to the Recorder Desk.
      managedOn: 'Recorder Desk: Meeting Check-In PIN (Grand Knight Desk when the Recorder is absent)',
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
export const PLATFORM_SCHEMA_VERSION = 101;
