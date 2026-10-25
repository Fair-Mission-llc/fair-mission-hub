// =========================================================================
// THE SUPER ADMIN DESK (Sprint 8O)
//
// The platform owner's own cockpit: a folder tab titled 'Super Admin Desk' on the Active Desks row
// (officer-desks.ts dashboardTabsFor, /dashboard#super-admin). It mounts only when the session is the platform owner's
// personal account - an Active Super Admin whose sign-in name is in PLATFORM_OWNER_USERNAMES - so another Super Admin,
// and the owner while viewing the portal as someone else, never sees it. Inside, three top horizontal action folders:
//   [ 📥 Feedback Communication Center ]         the Administrative Feedback Loops notes Admins send (feedback.listInbox)
//   [ 🔑 Council Access Request Approval Queue ] the councils asking to join the platform (accessRequests.list/setStatus)
//   [ 🛠️ System Feature Flag Control Panel ]      every council's module switches (councils.setFeatureFlags)
// The folders reuse the same driver methods as the rest of the portal, so the drivers' own Super Admin checks still
// apply; this gate decides only where the desk is drawn.
//
// Also here: the Administrative Feedback Loops page (System Settings, /system-settings/feedback), where Admins send
// those notes. Its role guard admits a session whose clearance is ADMIN or higher - council Admins and Super Admins.
// =========================================================================
import type { SessionUser } from './contract';

/** The Active Desks folder tab's title. */
export const SUPER_ADMIN_DESK_TITLE = 'Super Admin Desk';

/**
 * The platform owner's personal sign-in names (Credential usernames, compared without case). The desk mounts only for
 * these accounts, and only while the account is a Super Admin. The seeded owner account is testsuperadmin@kofc.org;
 * Sprint 8O Extension adds the developer's own local sign-in, 'tim'.
 */
export const PLATFORM_OWNER_USERNAMES: readonly string[] = ['testsuperadmin@kofc.org', 'tim'];

/** True only for the platform owner's own session: an Active Super Admin signed in with an owner username. */
export function isPlatformOwner(
  u: Pick<SessionUser, 'memberType'> & { username?: string | null },
  owners: readonly string[] = PLATFORM_OWNER_USERNAMES,
): boolean {
  if (u.memberType !== 'Super Admin') return false;
  const name = String(u.username ?? '').trim().toLowerCase();
  return name !== '' && owners.some((o) => o.trim().toLowerCase() === name);
}

export type SuperAdminDeskFolderId = 'feedback' | 'access-requests' | 'feature-flags';

export interface SuperAdminDeskFolder {
  id: SuperAdminDeskFolderId;
  label: string;
  /** One line under the folder row saying what the folder is for. */
  hint: string;
}

/** The desk's three top horizontal action folders, in the order they are drawn. */
export const SUPER_ADMIN_DESK_FOLDERS: readonly SuperAdminDeskFolder[] = [
  { id: 'feedback', label: '[ 📥 Feedback Communication Center ]', hint: 'Read the notes council Admins send from System Settings > Administrative Feedback Loops.' },
  { id: 'access-requests', label: '[ 🔑 Council Access Request Approval Queue ]', hint: 'Approve or decline the councils asking for a license to join the platform.' },
  { id: 'feature-flags', label: '[ 🛠️ System Feature Flag Control Panel ]', hint: "Switch each active council's optional modules on and off." },
];

/**
 * Sprint 10 Revision 3.0: the desk's four collapsible infrastructure drawers, stacked under the folder row in this order.
 * The Credentials Vault drawer is pinned to the Super Admin's own home council: it never requests another council's
 * sealed keys (CredentialsVaultPanel homeCouncilOnly).
 */
export const SUPER_ADMIN_DESK_DRAWERS = [
  { id: 'global-parameters', label: 'Global System Parameters', hint: "Each council's dues rate and organization type, and the limits every council shares." },
  { id: 'global-lookups', label: 'Global Lookup Tables', hint: 'The platform-wide lookup tables: statuses, degrees, member types and more.' },
  { id: 'charities-registry', label: 'Global Charities Registry', hint: 'Search, verify and add the charities every council shares.' },
  { id: 'credentials-vault', label: 'Credentials Vault', hint: "Your own home council's sealed connection keys only." },
] as const;
export type SuperAdminDeskDrawerId = (typeof SUPER_ADMIN_DESK_DRAWERS)[number]['id'];

/** The folder a stored or typed id names, else the first folder. */
export const superAdminDeskFolder = (id: string | null | undefined): SuperAdminDeskFolderId =>
  SUPER_ADMIN_DESK_FOLDERS.find((f) => f.id === id)?.id ?? 'feedback';

/** The Administrative Feedback Loops page title (System Settings > Administrative Feedback Loops). */
export const ADMINISTRATIVE_FEEDBACK_TITLE = 'Administrative Feedback Loops';
