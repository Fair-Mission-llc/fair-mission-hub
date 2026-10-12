// =========================================================================
// BILATERAL COUNCIL AFFILIATIONS (Sprints 8G/8H, schema version 78)
//
// Two councils of the same state become affiliates by a handshake (CouncilAffiliations):
//   1. an Admin, the Grand Knight or the Deputy Grand Knight of the requesting council - or a Super Admin - sends an
//      invite from the Bilateral Fraternal Affiliations desk (/system-settings/affiliations): a PENDING row;
//   2. the target council's Grand Knight or Deputy Grand Knight (or a Super Admin) clicks Accept on the Grand Knight Desk
//      or the affiliations desk: ACTIVE, with date_established set to that day - or Decline: DECLINED.
// A declined pair may be invited again (a new row). Only one PENDING or ACTIVE row may exist for a pair, whichever side
// sent it (AFFILIATION_CONFLICT). The legacy AffiliatedCouncils table (the Blueprint's static links) is not used here.
//
// The directory lists the other councils of the home council's State (Council has no active flag, so every council
// on the platform counts), nearest first by the great-circle distance between the councils' meeting points
// (Council.meeting_latitude / meeting_longitude, the Meeting Check-In card's point). Councils without a point, or every
// council when the home council has none, follow in district order: same district first, then by district number
// (Council.district_number, kept on the Councils page), then by council number.
//
// An ACTIVE affiliation unlocks asset sharing: the Cross-Council Loaner Library shows a brother council's listed items
// only to an ACTIVE affiliate, and only while both councils have is_loaner_library_enabled on (loaner-library.ts).
// =========================================================================
import type { SessionUser } from './contract';
import { holdsGrandKnightSeat, isAdmin, isSuperAdmin } from './permissions';
import {
  BusinessRuleError,
  describeActor,
  hasAdminRights,
  hasSuperAdminRights,
  holdsGrandKnightAuthority,
  SecurityPrivilegeError,
  type MemberWriteActor,
} from './rules';
import type { Council, CouncilAffiliations, CouncilAffiliationStatus } from './types';

type Actor = Pick<SessionUser, 'memberId' | 'councilId' | 'memberType' | 'isOfficer'> & { roles?: readonly string[] };

export const COUNCIL_AFFILIATION_STATUSES: readonly CouncilAffiliationStatus[] = ['PENDING', 'ACTIVE', 'DECLINED'];

export const COUNCIL_AFFILIATION_STATUS_LABELS: Record<CouncilAffiliationStatus, string> = {
  PENDING: 'Pending',
  ACTIVE: 'Affiliated',
  DECLINED: 'Declined',
};

/** The desk's page. */
export const AFFILIATIONS_HREF = '/system-settings/affiliations';

/** Highest Council.district_number the Councils page accepts. */
export const DISTRICT_NUMBER_MAX = 9999;

/** The target's answer to an invite. */
export type AffiliationDecision = 'ACCEPT' | 'DECLINE';

// ---- access ---------------------------------------------------------------------------------------------------------

const crossCouncil = (actor: MemberWriteActor, councilId: number, action: string) =>
  new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} for council ${councilId}.`, {
    actorId: actor.memberId,
    actorCouncilId: actor.councilId,
    councilId,
  });

/**
 * Reading the desk and sending invites for a council: its Active Admins, Grand Knight and Deputy Grand Knight, or any
 * Active Super Admin. GRAND_KNIGHT_REQUIRED, or COUNCIL_ACCESS_DENIED for another council's leader.
 */
export function assertMayManageAffiliations(actor: MemberWriteActor, councilId: number, action: string): void {
  if (hasSuperAdminRights(actor)) return;
  const leader = actor.active && (hasAdminRights(actor) || holdsGrandKnightAuthority(actor.roles));
  if (leader && actor.councilId === councilId) return;
  if (leader) throw crossCouncil(actor, councilId, action);
  throw new SecurityPrivilegeError(
    'GRAND_KNIGHT_REQUIRED',
    `Only the council's Admins, Grand Knight, Deputy Grand Knight or a Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, councilId },
  );
}

/**
 * Answering an invite: the target council's Active Grand Knight or Deputy Grand Knight, or any Active Super Admin. A
 * plain Admin may send invites but not accept them. GRAND_KNIGHT_REQUIRED, COUNCIL_ACCESS_DENIED.
 */
export function assertMayRespondToAffiliation(actor: MemberWriteActor, targetCouncilId: number, action: string): void {
  if (hasSuperAdminRights(actor)) return;
  if (actor.active && holdsGrandKnightAuthority(actor.roles)) {
    if (actor.councilId === targetCouncilId) return;
    throw crossCouncil(actor, targetCouncilId, action);
  }
  throw new SecurityPrivilegeError(
    'GRAND_KNIGHT_REQUIRED',
    `Only the invited council's Grand Knight, Deputy Grand Knight or a Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, councilId: targetCouncilId },
  );
}

/** The portal's twin of assertMayManageAffiliations (the page's audience, and its sidebar link for the own council). */
export const canManageAffiliations = (u: Actor, councilId: number): boolean =>
  isSuperAdmin(u) || (u.councilId === councilId && (isAdmin(u) || holdsGrandKnightSeat(u)));

/** The portal's twin of assertMayRespondToAffiliation. */
export const canRespondToAffiliation = (u: Actor, targetCouncilId: number): boolean => isSuperAdmin(u) || (u.councilId === targetCouncilId && holdsGrandKnightSeat(u));

// ---- the handshake ----------------------------------------------------------------------------------------------------

/** True when the row joins the two councils, in either direction. */
export const affiliationJoins = (row: Pick<CouncilAffiliations, 'requesting_council_id' | 'target_council_id'>, a: number, b: number): boolean =>
  (row.requesting_council_id === a && row.target_council_id === b) || (row.requesting_council_id === b && row.target_council_id === a);

/** The other council of a row, seen from `councilId`. */
export const affiliationPartnerOf = (row: Pick<CouncilAffiliations, 'requesting_council_id' | 'target_council_id'>, councilId: number): number =>
  row.requesting_council_id === councilId ? row.target_council_id : row.requesting_council_id;

/** The councils `councilId` holds an ACTIVE affiliation with. */
export function activeAffiliatePartners(rows: readonly Pick<CouncilAffiliations, 'requesting_council_id' | 'target_council_id' | 'status'>[], councilId: number): Set<number> {
  return new Set(
    rows
      .filter((r) => r.status === 'ACTIVE' && (r.requesting_council_id === councilId || r.target_council_id === councilId))
      .map((r) => affiliationPartnerOf(r, councilId)),
  );
}

const stateKey = (state: string | null | undefined): string => (state ?? '').trim().toUpperCase();

/**
 * The checks on a new invite: a different council (INVALID_INPUT), of the same State (AFFILIATION_OUT_OF_STATE), with
 * no PENDING or ACTIVE row for the pair in either direction (AFFILIATION_CONFLICT).
 */
export function assertAffiliationRequestable(
  requesting: Pick<Council, 'id' | 'State'>,
  target: Pick<Council, 'id' | 'State' | 'CouncilName'>,
  rows: readonly Pick<CouncilAffiliations, 'requesting_council_id' | 'target_council_id' | 'status'>[],
): void {
  if (requesting.id === target.id) throw new BusinessRuleError('INVALID_INPUT', 'A council cannot affiliate with itself.', { councilId: requesting.id });
  if (stateKey(requesting.State) !== stateKey(target.State)) {
    throw new BusinessRuleError(
      'AFFILIATION_OUT_OF_STATE',
      `${target.CouncilName} is in ${target.State}; affiliations stay inside the home state (${requesting.State}).`,
      { councilId: requesting.id, targetCouncilId: target.id },
    );
  }
  const open = rows.find((r) => affiliationJoins(r, requesting.id, target.id) && (r.status === 'PENDING' || r.status === 'ACTIVE'));
  if (open) {
    throw new BusinessRuleError(
      'AFFILIATION_CONFLICT',
      open.status === 'ACTIVE' ? `The councils are already affiliated.` : `An invite between the two councils is already pending.`,
      { councilId: requesting.id, targetCouncilId: target.id, status: open.status },
    );
  }
}

/** What an answer writes: ACTIVE with today's date, or DECLINED. Only a PENDING row can be answered (ILLEGAL_STATE_TRANSITION). */
export function planAffiliationResponse(
  row: Pick<CouncilAffiliations, 'id' | 'status'>,
  decision: AffiliationDecision,
  today: string,
): Pick<CouncilAffiliations, 'status' | 'date_established'> {
  if (row.status !== 'PENDING') {
    throw new BusinessRuleError('ILLEGAL_STATE_TRANSITION', `Affiliation ${row.id} is ${row.status}; only a pending invite can be answered.`, {
      affiliationId: row.id,
      status: row.status,
    });
  }
  if (decision === 'ACCEPT') return { status: 'ACTIVE', date_established: today };
  if (decision === 'DECLINE') return { status: 'DECLINED', date_established: null };
  throw new BusinessRuleError('INVALID_INPUT', `Answer an invite with ACCEPT or DECLINE; received ${JSON.stringify(decision)}.`, {});
}

/** A Councils-page district number: blank is none (null), otherwise a whole number 1 to DISTRICT_NUMBER_MAX. */
export function cleanDistrictNumber(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return null;
  const n = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > DISTRICT_NUMBER_MAX) {
    throw new BusinessRuleError('INVALID_INPUT', `District number must be a whole number from 1 to ${DISTRICT_NUMBER_MAX}; received ${String(value)}.`, { field: 'district_number' });
  }
  return n;
}

// ---- the directory ----------------------------------------------------------------------------------------------------

const EARTH_RADIUS_MILES = 3958.8;

/** Great-circle distance in miles between two points (haversine). */
export function distanceMiles(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

type DirectoryCouncil = Pick<
  Council,
  'id' | 'CouncilNumber' | 'CouncilName' | 'State' | 'meeting_latitude' | 'meeting_longitude' | 'district_number' | 'is_loaner_library_enabled'
>;

const pointOf = (c: DirectoryCouncil): { latitude: number; longitude: number } | null =>
  typeof c.meeting_latitude === 'number' && typeof c.meeting_longitude === 'number' ? { latitude: c.meeting_latitude, longitude: c.meeting_longitude } : null;

export const loanerLibraryEnabled = (c: Pick<Council, 'is_loaner_library_enabled'> | null | undefined): boolean => Number(c?.is_loaner_library_enabled ?? 0) === 1;

/** One row of the handshake, seen from the home council. */
export interface AffiliationLink {
  affiliationId: number;
  status: CouncilAffiliationStatus;
  /** 'outgoing' when the home council sent the invite. */
  direction: 'outgoing' | 'incoming';
  requestedAt: string;
  dateEstablished: string | null;
}

export interface AffiliationDirectoryEntry {
  councilId: number;
  councilNumber: number;
  councilName: string;
  state: string;
  districtNumber: number | null;
  sameDistrict: boolean;
  /** Miles from the home council's meeting point; null when either council has none. */
  distanceMiles: number | null;
  loanerLibraryEnabled: boolean;
  /** The pair's latest handshake row, or null when none was ever sent. */
  link: AffiliationLink | null;
}

/** councils.listAffiliationDirectory: the home council and its same-state neighbours. */
export interface AffiliationDirectory {
  councilId: number;
  councilName: string;
  state: string;
  districtNumber: number | null;
  /** False when the home council has no meeting point: the list is in district order only. */
  sortedByDistance: boolean;
  loanerLibraryEnabled: boolean;
  entries: AffiliationDirectoryEntry[];
  /** Invites waiting for the home council's answer, oldest first. */
  incoming: AffiliationDirectoryEntry[];
}

const linkOf = (row: CouncilAffiliations, homeId: number): AffiliationLink => ({
  affiliationId: row.id,
  status: row.status,
  direction: row.requesting_council_id === homeId ? 'outgoing' : 'incoming',
  requestedAt: row.requested_at,
  dateEstablished: row.date_established ? row.date_established.slice(0, 10) : null,
});

/** The directory for `home`: the other councils of its State, nearest first, then in district order. */
export function buildAffiliationDirectory(home: DirectoryCouncil, councils: readonly DirectoryCouncil[], rows: readonly CouncilAffiliations[]): AffiliationDirectory {
  const homePoint = pointOf(home);
  const latest = new Map<number, CouncilAffiliations>();
  for (const row of rows) {
    if (row.requesting_council_id !== home.id && row.target_council_id !== home.id) continue;
    const partner = affiliationPartnerOf(row, home.id);
    const seen = latest.get(partner);
    if (!seen || row.id > seen.id) latest.set(partner, row);
  }
  const entries = councils
    .filter((c) => c.id !== home.id && stateKey(c.State) === stateKey(home.State))
    .map((c): AffiliationDirectoryEntry => {
      const point = pointOf(c);
      const row = latest.get(c.id);
      return {
        councilId: c.id,
        councilNumber: c.CouncilNumber,
        councilName: c.CouncilName,
        state: c.State,
        districtNumber: c.district_number ?? null,
        sameDistrict: home.district_number != null && c.district_number === home.district_number,
        distanceMiles: homePoint && point ? Math.round(distanceMiles(homePoint, point) * 10) / 10 : null,
        loanerLibraryEnabled: loanerLibraryEnabled(c),
        link: row ? linkOf(row, home.id) : null,
      };
    })
    .sort(
      (x, y) =>
        (x.distanceMiles ?? Infinity) - (y.distanceMiles ?? Infinity) ||
        Number(y.sameDistrict) - Number(x.sameDistrict) ||
        (x.districtNumber ?? Infinity) - (y.districtNumber ?? Infinity) ||
        x.councilNumber - y.councilNumber ||
        x.councilId - y.councilId,
    );
  return {
    councilId: home.id,
    councilName: home.CouncilName,
    state: home.State,
    districtNumber: home.district_number ?? null,
    sortedByDistance: homePoint !== null,
    loanerLibraryEnabled: loanerLibraryEnabled(home),
    entries,
    incoming: entries
      .filter((e) => e.link?.status === 'PENDING' && e.link.direction === 'incoming')
      .sort((a, b) => a.link!.requestedAt.localeCompare(b.link!.requestedAt) || a.link!.affiliationId - b.link!.affiliationId),
  };
}
