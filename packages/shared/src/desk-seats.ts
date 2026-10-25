// =========================================================================
// VACANT DESK SEATS (Sprint 10 Revision 3.1)
//
// An officer desk can be opened by someone who does not hold its seat - a council Admin or a Super Admin - while nobody
// holds it. The desk then leads with a placeholder card (SEAT_VACANT_MESSAGE) linking to the Member Roster, read from
// elections.listOfficerSeats (a seat whose holder is null). A desk whose seat is not an office in the seat list (the
// Council Historian, an appointed role) is never reported vacant, so a missing list or seat never breaks the desk.
// =========================================================================
import type { OfficerSeat } from './contract';
import type { DashboardTabId } from './officer-desks';

export const SEAT_VACANT_MESSAGE = 'Seat Vacant — Open Council Roster to Assign this Officer Position';

/** The office whose holder works each officer desk. */
export const DESK_SEAT_ROLES: Partial<Record<DashboardTabId, string>> = {
  'grand-knight': 'Grand Knight',
  'financial-secretary': 'Financial Secretary',
  treasurer: 'Treasurer',
  recorder: 'Recorder',
};

/** The vacant office of `desk`, or null when the desk has no seat, the seat is not listed or someone holds it. */
export function vacantDeskSeat(seats: readonly Pick<OfficerSeat, 'roleName' | 'holder'>[] | null | undefined, desk: DashboardTabId): string | null {
  const role = DESK_SEAT_ROLES[desk];
  if (!role || !seats) return null;
  const seat = seats.find((s) => s.roleName === role);
  return seat && seat.holder == null ? role : null;
}
