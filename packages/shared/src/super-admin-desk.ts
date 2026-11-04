// =========================================================================
// THE SUPER ADMIN DESK (Sprint 8O)
//
// The Super Admin cockpit: a folder tab on the Active Desks row (officer-desks.ts dashboardTabsFor,
// /dashboard#super-admin). Sprint 11 Revision 17.5: every Super Admin session gets the tab, drawn beside the council
// desks (showsSuperAdminDeskTab). While a Super Admin views the portal as someone else, the session is that member's, so
// the tab is gone.
// Sprint 11 Revision 18.0: the tab reads 'Super Admin Desk' (it read 'Platform Management'). The row of horizontal
// folders and the stacked drawers under it are gone. The desk is a left vertical filing spine (the officer desks'
// DeskBlotter, desk-drawers.ts DESK_DRAWERS with desk 'super-admin') whose drawers open in place, in two cabinets:
//   Communications Cabinet: Feedback Communication Center, Council Access Request Approval Queue
//   Settings Cabinet:       Global System Parameters, Global Lookup Tables, System Feature Flag Control Panel,
//                           Secure Access Vault (the Super Admin's own home council only)
// and the Global Charities Registry as a freestanding drawer under them. The drawers reuse the driver methods of the
// rest of the portal, so the drivers' own Super Admin checks still apply; this gate decides only where the desk is drawn.
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

/**
 * Sprint 11 Revision 17.5: true when the Active Desks row draws the Super Admin Desk tab - any Super Admin session.
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

/**
 * Sprint 11 Revision 18.0: the desk's two filing cabinets and what each holds, in spine order (the drawers themselves
 * are desk-drawers.ts DESK_DRAWERS entries with desk 'super-admin'). The Global Charities Registry stands outside them.
 */
export const SUPER_ADMIN_DESK_CABINETS = [
  { id: 'communications', label: 'Communications Cabinet', drawers: ['feedback', 'access-requests'] },
  { id: 'settings', label: 'Settings Cabinet', drawers: ['global-parameters', 'global-lookups', 'feature-flags', 'credentials-vault'] },
] as const;
/** The drawer pinned outside the cabinets. */
export const SUPER_ADMIN_FREESTANDING_DRAWERS = ['charities-registry'] as const;

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
