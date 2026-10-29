// =========================================================================
// MEMBER ROSTER DIRECTORY (Sprint 10 Revision 2.0)
//
// One read-only list of Brother Knights with their council, phone, email and degree. It has three homes: the sidebar's
// 'Roster & Achievements' link (/roster, first in the Faith In Action pillar, every signed-in member), the Member Desk and the
// Grand Knight and Financial Secretary Desks. The Fraternal roster tab of the Volunteer Center shows the same list.
//
// Who sees which rows (members.listRoster enforces it in every driver):
//   - a member, officer or Admin: Active members of their own council and its affiliated (sister) councils, with a
//     council picker to narrow the list;
//   - an Active Super Admin: every Active member of every council. Sprint 10 Revision 3.0 put the council picker back
//     for the Super Admin ('All councils' or one council), to filter the global list quickly.
// Phone and email show for every reader, as on the council's shared roster sheet (Sprint 5M). Street address and date
// of birth never do.
//
// Sprint 10 Revision 3.0: /roster is also where member records are kept - the Affiliated Roster page (/members) is gone.
// A council Admin (their own council) or a Super Admin (any council) gets 'Add Member' and a row 'Edit' button, and asks
// listRoster for every status ({ allStatuses: true }) so Inactive members can be edited too. The driver widens the rows
// only for the councils the reader may administer (memberRosterManagedCouncilIds); everyone else still gets Active only.
// =========================================================================
import type { Council, Member } from './types';

export const MEMBER_ROSTER_HREF = '/roster';
export const MEMBER_ROSTER_TITLE = 'Roster & Achievements';

/** Sprint 10 Revision 3.0: the budget page's name (the Annual Budget Forecast Center / Annual Budget Projections before). */
export const ANNUAL_BUDGET_CENTER_TITLE = 'Annual Budget Center';
/** The Annual Budget Center row that sets Member.IsBudgetDirector - the only place it is set. */
export const ASSIGN_BUDGET_DIRECTOR_LABEL = 'Assign Designated Budget Director';

/** 'global' for an Active Super Admin; 'fraternal' (home council and its affiliated councils) for everyone else. */
export type MemberRosterScope = 'global' | 'fraternal';

/** The desks that mount the roster directory under their own tools. */
export const MEMBER_ROSTER_DESKS = ['member', 'grand-knight', 'financial-secretary'] as const;
export type MemberRosterDesk = (typeof MEMBER_ROSTER_DESKS)[number];

export interface MemberRosterViewer {
  memberType?: string | null;
  /** False for an inactive login; an inactive Super Admin reads only their own fraternal list. */
  active?: boolean;
}

export function memberRosterScope(viewer: MemberRosterViewer): MemberRosterScope {
  return viewer.memberType === 'Super Admin' && viewer.active !== false ? 'global' : 'fraternal';
}

/** Every roster offers a council picker (Sprint 10 Revision 3.0 restored it for the Super Admin's global list). */
export function rosterShowsCouncilPicker(_scope: MemberRosterScope): boolean {
  return true;
}

/** The picker's 'all' choice, in words. */
export function rosterAllCouncilsLabel(scope: MemberRosterScope): string {
  return scope === 'global' ? 'All councils on the platform' : 'All: my council and sister councils';
}

/** members.listRoster's options. */
export interface MemberRosterOptions {
  /** Every status, not only Active - honoured only for the councils the reader may administer. */
  allStatuses?: boolean;
}

/**
 * The councils whose Inactive and Former members a reader may list (and whose records they keep): every covered council
 * for an Active Super Admin, the home council for an Active council Admin, none for anyone else.
 */
export function memberRosterManagedCouncilIds(
  viewer: MemberRosterViewer,
  homeCouncilId: number,
  coveredIds: readonly number[],
): number[] {
  if (memberRosterScope(viewer) === 'global') return [...coveredIds];
  if (viewer.memberType === 'Admin' && viewer.active !== false) return coveredIds.includes(homeCouncilId) ? [homeCouncilId] : [];
  return [];
}

/** The councils a roster covers: every council for 'global', else the home council followed by its affiliated councils. */
export function memberRosterCouncilIds(scope: MemberRosterScope, homeCouncilId: number, affiliatedIds: readonly number[], allCouncilIds: readonly number[]): number[] {
  if (scope === 'global') return [...new Set(allCouncilIds)];
  return [...new Set([homeCouncilId, ...affiliatedIds])];
}

/** What members.listRoster returns: the scope, the councils it covers (home council first) and their Active members. */
export interface MemberRosterResult {
  scope: MemberRosterScope;
  councils: Council[];
  members: Member[];
}

/** Members sorted by last name, then first name, then member number. */
export function sortRosterMembers(members: readonly Member[]): Member[] {
  return [...members].sort(
    (a, b) => a.MemberLastName.localeCompare(b.MemberLastName) || a.MemberFirstName.localeCompare(b.MemberFirstName) || String(a.MemberNumber).localeCompare(String(b.MemberNumber)),
  );
}

/** The rows a reader sees after the council picker (`null` = all) and the name or number search. */
export function filterRosterMembers(members: readonly Member[], councilId: number | null, query: string): Member[] {
  const q = query.trim().toLowerCase();
  return members.filter((m) => (councilId === null || m.CouncilID === councilId) && (!q || `${m.MemberFirstName} ${m.MemberLastName} ${m.MemberNumber}`.toLowerCase().includes(q)));
}
