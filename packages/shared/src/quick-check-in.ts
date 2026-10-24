// =========================================================================
// QUICK CHECK-IN FOR WALK-IN VOLUNTEERS (Sprint 9 Revision 5.0; no schema change)
//
// A Shift Captain at an event taps '⏱️ Quick Check-In' on the phone's Signup or Collect tab, picks one of today's
// shifts, and taps a member's name on the council roster. The member is signed up for the shift on the spot (an
// EventSignup row, NumberVolunteersSignedUp + 1), so a walk-in is on the volunteer log with no typing. The member then
// reports their own hours from the Report tab, as for any shift.
//
// Who is a Shift Captain: there is no captain role in the data, so the captain is anyone the hours review already
// trusts to run an event - the event's owner (its chair), an elected officer or Trustee, or an Admin of a council the
// event is linked to, or any Super Admin (QUARANTINE_EXEMPT_ROLE_NAMES). The captain must be Active.
// Only shifts dated today can be checked in to, and only Active members of a council the event is linked to.
// =========================================================================
import { hasAdminRights, hasSuperAdminRights, BusinessRuleError, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import { QUARANTINE_EXEMPT_ROLE_NAMES } from './volunteer-quarantine';
import type { Event, EventSignup, Shift } from './types';

/** The phone's button, word for word. */
export const QUICK_CHECK_IN_LABEL = '⏱️ Quick Check-In';

/** The event a captain would run: its owner and the councils it is linked to. */
export interface QuickCheckInEventScope {
  eventId: number;
  ownerId: number | null | undefined;
  eventCouncilIds: readonly number[];
}

/** True when the actor may check walk-ins in to the event's shifts (see the header). */
export function isShiftCaptain(actor: MemberWriteActor, scope: QuickCheckInEventScope): boolean {
  if (!actor.active) return false;
  if (hasSuperAdminRights(actor)) return true;
  if (scope.ownerId === actor.memberId) return true;
  if (!scope.eventCouncilIds.includes(actor.councilId)) return false;
  if (hasAdminRights(actor)) return true;
  return (actor.roles ?? []).some((r) => QUARANTINE_EXEMPT_ROLE_NAMES.includes(r));
}

export function assertShiftCaptain(actor: MemberWriteActor, scope: QuickCheckInEventScope): void {
  if (isShiftCaptain(actor, scope)) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Member ${actor.memberId} cannot check volunteers in to event ${scope.eventId}; only its chair, an officer, a Trustee or an Admin of its council can.`,
    { actorId: actor.memberId, eventId: scope.eventId },
  );
}

/** Quick check-in works only on the shift's own day (`today`, YYYY-MM-DD in the device's local time). */
export function assertQuickCheckInToday(shift: Pick<Shift, 'id' | 'ShiftDate' | 'ShiftName'>, today: string): void {
  if (shift.ShiftDate === today) return;
  throw new BusinessRuleError(
    'INVALID_INPUT',
    `Shift "${shift.ShiftName}" is on ${shift.ShiftDate}. Quick check-in works only on the day of the shift (${today}).`,
    { shiftId: shift.id, shiftDate: shift.ShiftDate, today },
  );
}

/** The walk-in must be an Active member of a council the event is linked to. */
export function assertQuickCheckInMember(
  member: { id: number; CouncilID: number; active: boolean },
  scope: QuickCheckInEventScope,
): void {
  if (member.active && scope.eventCouncilIds.includes(member.CouncilID)) return;
  throw new BusinessRuleError(
    'INVALID_INPUT',
    `Member ${member.id} is not an active member of a council that runs event ${scope.eventId}, so they cannot be checked in to it.`,
    { memberId: member.id, eventId: scope.eventId },
  );
}

/** One of today's shifts the captain may check walk-ins in to. */
export interface QuickCheckInShift {
  shift: Shift;
  event: Event;
  /** Members already signed up for the shift. */
  signedUpMemberIds: number[];
}

/** A name on the roster: an Active member of a council linked to one of the shifts' events. */
export interface QuickCheckInRosterEntry {
  memberId: number;
  councilId: number;
  firstName: string;
  lastName: string;
}

/** events.getQuickCheckInBoard: today's shifts and the roster to pick walk-ins from. */
export interface QuickCheckInBoard {
  shifts: QuickCheckInShift[];
  roster: QuickCheckInRosterEntry[];
}

/** events.quickCheckIn: the member's signup, and whether it was already there (then nothing was written). */
export interface QuickCheckInResult {
  signup: EventSignup;
  alreadySignedUp: boolean;
}

/** Roster order: last name, first name, id. */
export const compareRosterEntries = (a: QuickCheckInRosterEntry, b: QuickCheckInRosterEntry): number =>
  a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName) || a.memberId - b.memberId;
