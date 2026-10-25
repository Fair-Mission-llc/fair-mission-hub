// =========================================================================
// MEMBER ROSTER DIRECTORY (Sprint 10 Revision 2.0)
//
// One read-only list of Brother Knights with their council, phone, email and degree. It has three homes: the sidebar's
// 'Member Roster' link (/roster, first in the Faith In Action pillar, every signed-in member), the Member Desk and the
// Grand Knight and Financial Secretary Desks. The Fraternal roster tab of the Volunteer Center shows the same list.
//
// Who sees which rows (members.listRoster enforces it in every driver):
//   - a member, officer or Admin: Active members of their own council and its affiliated (sister) councils, with a
//     council picker to narrow the list;
//   - an Active Super Admin: every Active member of every council - one global list, and no council picker.
// Phone and email show for every reader, as on the council's shared roster sheet (Sprint 5M). Street address and date
// of birth never do.
// =========================================================================
import type { Council, Member } from './types';

export const MEMBER_ROSTER_HREF = '/roster';
export const MEMBER_ROSTER_TITLE = 'Member Roster';

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

/** Only the fraternal list offers a council picker; the Super Admin's global list never does. */
export function rosterShowsCouncilPicker(scope: MemberRosterScope): boolean {
  return scope === 'fraternal';
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
