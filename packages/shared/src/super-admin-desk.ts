// =========================================================================
// THE SUPER ADMIN DESK (Sprint 8O)
//
// The Super Admin cockpit: a folder tab titled 'Platform Management' on the Active Desks row (officer-desks.ts
// dashboardTabsFor, /dashboard#super-admin). Sprint 11 Revision 17.5: every Super Admin session gets the tab, drawn
// beside the council desks (showsSuperAdminDeskTab). Until then only the platform owner's own account had it. While a
// Super Admin views the portal as someone else, the session is that member's, so the tab is gone. Inside, three top
// horizontal action folders:
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
export const SUPER_ADMIN_DESK_TITLE = 'Platform Management';

/**
 * The platform owner's personal sign-in names (Credential usernames, compared without case). The desk mounts only for
 * these accounts, and only while the account is a Super Admin. The seeded owner account is testsuperadmin@kofc.org;
 * Sprint 8O Extension adds the developer's own local sign-in, 'tim'.
 */
export const PLATFORM_OWNER_USERNAMES: readonly string[] = ['testsuperadmin@kofc.org', 'tim'];

/**
 * Sprint 11 Revision 17.5: true when the Active Desks row draws the Platform Management tab - any Super Admin session.
 * isPlatformOwner still gates the owner-only tools (Advisory Panel invitations).
 */
export const showsSuperAdminDeskTab = (u: Pick<SessionUser, 'memberType'>): boolean => u.memberType === 'Super Admin';

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
  { id: 'feedback', label: 'Feedback Communication Center', hint: 'Read the notes council Admins send from System Settings > Administrative Feedback Loops.' },
  { id: 'access-requests', label: 'Council Access Request Approval Queue', hint: 'Approve or decline the councils asking for a license to join the platform.' },
  { id: 'feature-flags', label: 'System Feature Flag Control Panel', hint: "Switch each active council's optional modules on and off." },
];

/**
 * Sprint 10 Revision 3.0: the desk's four collapsible infrastructure drawers, stacked under the folder row in this order.
 * The Secure Access Vault drawer is pinned to the Super Admin's own home council: it never requests another council's
 * sealed keys (CredentialsVaultPanel homeCouncilOnly).
 */
export const SUPER_ADMIN_DESK_DRAWERS = [
  { id: 'global-parameters', label: 'Global System Parameters', hint: "Each council's dues rate and organization type, and the limits every council shares." },
  { id: 'global-lookups', label: 'Global Lookup Tables', hint: 'The platform-wide lookup tables: statuses, degrees, member types and more.' },
  { id: 'charities-registry', label: 'Global Charities Registry', hint: 'Search, verify and add the charities every council shares.' },
  { id: 'credentials-vault', label: 'Secure Access Vault', hint: "Your own home council's sealed connection keys only." },
] as const;
export type SuperAdminDeskDrawerId = (typeof SUPER_ADMIN_DESK_DRAWERS)[number]['id'];

/** The folder a stored or typed id names, else the first folder. */
export const superAdminDeskFolder = (id: string | null | undefined): SuperAdminDeskFolderId =>
  SUPER_ADMIN_DESK_FOLDERS.find((f) => f.id === id)?.id ?? 'feedback';

/** The Administrative Feedback Loops page title (System Settings > Administrative Feedback Loops). */
export const ADMINISTRATIVE_FEEDBACK_TITLE = 'Administrative Feedback Loops';

// ---- Sprint 11 Revision 17.0: the header shortcut ----------------------------------------------------------------

/** The header button every Super Admin session carries, beside Messaging and Help. */
export const SUPER_ADMIN_HEADER_LINK_LABEL = 'Super Admin Desk';

/** Where it goes: the Super Admin address of the Master Feature Deployment Grid (Super Admins only). */
export const SUPER_ADMIN_HEADER_HREF = '/super-admin';

/**
 * True when the header draws the Super Admin Desk button: the session's own clearance is Super Admin. While a Super
 * Admin views the portal as someone else, the session is that member's, so the button is gone with the rest of the
 * Super Admin tools.
 */
export const showsSuperAdminHeaderLink = (u: Pick<SessionUser, 'memberType'>, impersonating = false): boolean =>
  !impersonating && u.memberType === 'Super Admin';
