// =========================================================================
// GEOFENCED MEETING CHECK-IN (Sprint 7G, schema 68)
//
// A member checks in to a live council meeting from the phone's Meeting Console in one of two ways:
//   - GPS: the phone sends its position and how precise it is. The check-in counts when the position is inside the
//     council's meeting circle (Council.meeting_latitude / meeting_longitude, radius meeting_geofence_radius_meters,
//     DEFAULT 100) and the fix is at least as precise as that radius.
//   - Meeting PIN: when the phone is outside the circle (or has no usable fix), the member types the 4-digit session
//     token the Grand Knight reads out (Council.meeting_pin_token, DEFAULT '0000'). Five wrong PINs for one meeting
//     lock the PIN path for that member and meeting while the app stays open.
// The Grand Knight, the council's Admins and any Super Admin set the circle and the PIN (councils.setMeetingGeofence).
// The PIN is never sent to anyone else: council reads (councils.list / get / listAffiliated) drop it (withoutMeetingPin).
//
// Photos: a member may attach a photo to their own check-in (LiveAttendance.photo_url) and the meeting's chair may file
// a photo of the meeting (Meeting.photo_url). The web portal files meeting photos in the council's shared drive under
// Fraternal Enterprise Suite / Media / Meeting_Photos (MEETING_PHOTO_DRIVE_FOLDER).
// =========================================================================
import { describeActor, BusinessRuleError, hasAdminRights, hasSuperAdminRights, holdsGrandKnightAuthority, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import type { Council } from './types';

/** The Media subfolder that holds meeting photos in the Drive vault: Fraternal Enterprise Suite / Media / Meeting_Photos. */
export const MEETING_PHOTO_DRIVE_FOLDER = 'Meeting_Photos';
/** Council.meeting_geofence_radius_meters' default, in meters. */
export const DEFAULT_MEETING_GEOFENCE_RADIUS_METERS = 100;
/** The smallest and largest circle a council may set, in meters. */
export const MEETING_GEOFENCE_MIN_RADIUS_METERS = 25;
export const MEETING_GEOFENCE_MAX_RADIUS_METERS = 5000;
/** Council.meeting_pin_token's default. The settings page warns while a council still uses it. */
export const DEFAULT_MEETING_PIN_TOKEN = '0000';
/** Wrong PINs one member may enter for one meeting before the PIN path locks. */
export const MEETING_PIN_MAX_ATTEMPTS = 5;
/** Longest LiveAttendance.photo_url and Meeting.photo_url (VARCHAR(2000)). */
export const MEETING_PHOTO_URL_MAX_LENGTH = 2000;
/** The phone's check-in button, word for word. */
export const CHECK_IN_BUTTON_LABEL = '📍 Check In to Meeting';
/**
 * Sprint 9 Revision 5.0: GPS check-in is hidden from every screen. The phone's check-in drawer goes straight to the
 * meeting PIN, and the web Meeting Check-In card shows only the PIN. The location math below, the stored meeting point
 * and meetings.geofencedCheckIn's GPS path stay in place, so setting this to false brings the GPS screens back.
 */
export const GPS_UI_SUPPRESSED = true;

const EARTH_RADIUS_METERS = 6_371_000;

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

/** A position on the earth, in decimal degrees. */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** The council's meeting circle and PIN (Council columns, schema 68). */
export interface MeetingGeofence {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  pinToken: string;
}

/** councils.setMeetingGeofence's input. A field left out keeps its stored value; null coordinates clear the circle. */
export interface MeetingGeofenceChanges {
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number;
  pinToken?: string;
}

/** How a member proves they are at the meeting (meetings.geofencedCheckIn). */
export type CheckInProof =
  | { kind: 'gps'; latitude: number; longitude: number; /** The fix's precision radius in meters, as the phone reports it. */ accuracyMeters: number }
  | { kind: 'pin'; pin: string };

/** meetings.geofencedCheckIn's answer. */
export interface GeofencedCheckInResult {
  attendanceId: number;
  meetingId: number;
  memberId: number;
  checkedInAt: string;
  method: 'gps' | 'pin';
  /** How far the phone was from the meeting point, in whole meters; null for a PIN check-in. */
  distanceMeters: number | null;
  /** True when the member was already checked in; nothing new was written. */
  alreadyCheckedIn: boolean;
}

/** The great-circle distance between two points in meters (haversine). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isLatitude = (v: unknown): v is number => isNumber(v) && v >= -90 && v <= 90;
const isLongitude = (v: unknown): v is number => isNumber(v) && v >= -180 && v <= 180;
const isPin = (v: unknown): v is string => typeof v === 'string' && /^\d{4}$/.test(v);

/** The council's stored circle and PIN, with the column defaults for missing values. */
export function meetingGeofenceOf(council: Partial<Pick<Council, 'meeting_latitude' | 'meeting_longitude' | 'meeting_geofence_radius_meters' | 'meeting_pin_token'>>): MeetingGeofence {
  const lat = council.meeting_latitude;
  const lon = council.meeting_longitude;
  const radius = council.meeting_geofence_radius_meters;
  const pin = council.meeting_pin_token;
  return {
    latitude: isLatitude(lat) && isLongitude(lon) ? lat : null,
    longitude: isLatitude(lat) && isLongitude(lon) ? lon : null,
    radiusMeters: isNumber(radius) && radius > 0 ? radius : DEFAULT_MEETING_GEOFENCE_RADIUS_METERS,
    pinToken: isPin(pin) ? pin : DEFAULT_MEETING_PIN_TOKEN,
  };
}

/** True when the council has a meeting point, so the GPS path can be used. */
export const hasMeetingPoint = (fence: Pick<MeetingGeofence, 'latitude' | 'longitude'>): boolean => fence.latitude !== null && fence.longitude !== null;

/**
 * councils.setMeetingGeofence's input, checked (INVALID_INPUT): latitude -90..90 and longitude -180..180, set or
 * cleared together; a whole-meter radius from MEETING_GEOFENCE_MIN_RADIUS_METERS to MEETING_GEOFENCE_MAX_RADIUS_METERS;
 * a PIN of exactly 4 digits. Returns the Council column values to store.
 */
export function cleanMeetingGeofence(input: unknown): Partial<Pick<Council, 'meeting_latitude' | 'meeting_longitude' | 'meeting_geofence_radius_meters' | 'meeting_pin_token'>> {
  if (input === null || typeof input !== 'object') throw invalid('Enter the meeting location, radius or PIN to save.');
  const raw = input as Record<string, unknown>;
  const known = ['latitude', 'longitude', 'radiusMeters', 'pinToken'];
  const unknown = Object.keys(raw).filter((k) => !known.includes(k));
  if (unknown.length > 0) throw invalid(`Unknown meeting check-in setting: ${unknown.join(', ')}.`, { fields: unknown });
  const out: ReturnType<typeof cleanMeetingGeofence> = {};
  const hasLat = raw.latitude !== undefined;
  const hasLon = raw.longitude !== undefined;
  if (hasLat !== hasLon) throw invalid('Enter the latitude and the longitude together.', { field: hasLat ? 'longitude' : 'latitude' });
  if (hasLat) {
    if (raw.latitude === null && raw.longitude === null) {
      out.meeting_latitude = null;
      out.meeting_longitude = null;
    } else {
      if (!isLatitude(raw.latitude)) throw invalid(`The latitude must be a number from -90 to 90; received ${JSON.stringify(raw.latitude)}.`, { field: 'latitude' });
      if (!isLongitude(raw.longitude)) throw invalid(`The longitude must be a number from -180 to 180; received ${JSON.stringify(raw.longitude)}.`, { field: 'longitude' });
      // DECIMAL(9,6): six decimal places is about 11 cm.
      out.meeting_latitude = Math.round(raw.latitude * 1e6) / 1e6;
      out.meeting_longitude = Math.round(raw.longitude * 1e6) / 1e6;
    }
  }
  if (raw.radiusMeters !== undefined) {
    const r = raw.radiusMeters;
    if (!(isNumber(r) && Number.isInteger(r) && r >= MEETING_GEOFENCE_MIN_RADIUS_METERS && r <= MEETING_GEOFENCE_MAX_RADIUS_METERS)) {
      throw invalid(
        `The check-in radius must be a whole number of meters from ${MEETING_GEOFENCE_MIN_RADIUS_METERS} to ${MEETING_GEOFENCE_MAX_RADIUS_METERS.toLocaleString('en-US')}; received ${JSON.stringify(r)}.`,
        { field: 'radiusMeters' },
      );
    }
    out.meeting_geofence_radius_meters = r;
  }
  if (raw.pinToken !== undefined) {
    if (!isPin(raw.pinToken)) throw invalid('The meeting PIN must be exactly 4 digits.', { field: 'pinToken' });
    out.meeting_pin_token = raw.pinToken;
  }
  if (Object.keys(out).length === 0) throw invalid('Enter the meeting location, radius or PIN to save.');
  return out;
}

/**
 * Who sets the meeting circle and PIN and may read the PIN: the council's Active Grand Knight, Deputy Grand Knight (Sprint
 * 8C) or Admins, or any Active Super Admin.
 */
export function mayManageMeetingGeofence(actor: MemberWriteActor, councilId: number): boolean {
  if (hasSuperAdminRights(actor)) return true;
  if (actor.councilId !== councilId) return false;
  return hasAdminRights(actor) || (actor.active && holdsGrandKnightAuthority(actor.roles));
}

/** Rejects GRAND_KNIGHT_REQUIRED for anyone else, COUNCIL_ACCESS_DENIED for a Grand Knight or Admin of another council. */
export function assertMayManageMeetingGeofence(actor: MemberWriteActor, councilId: number): void {
  if (mayManageMeetingGeofence(actor, councilId)) return;
  if (hasAdminRights(actor) || (actor.active && holdsGrandKnightAuthority(actor.roles))) {
    throw new SecurityPrivilegeError(
      'COUNCIL_ACCESS_DENIED',
      `Member ${actor.memberId} sets the meeting check-in of their own council (${actor.councilId}) only, not council ${councilId}.`,
      { actorId: actor.memberId, actorCouncilId: actor.councilId, councilId },
    );
  }
  throw new SecurityPrivilegeError(
    'GRAND_KNIGHT_REQUIRED',
    `Only the council's Grand Knight or Deputy Grand Knight, an Admin of the council or a Super Admin can set the meeting location and PIN; member ${actor.memberId} is ${describeActor(actor)}.`,
    { actorId: actor.memberId, councilId },
  );
}

/** A Council row without its meeting PIN, for every reader that is not setting it. */
export function withoutMeetingPin<T extends object>(council: T): T {
  if (!('meeting_pin_token' in council)) return council;
  const { meeting_pin_token: _pin, ...rest } = council as T & { meeting_pin_token?: unknown };
  return rest as T;
}

/** The proof a phone sent, checked for shape (INVALID_INPUT). */
export function cleanCheckInProof(proof: unknown): CheckInProof {
  if (proof === null || typeof proof !== 'object') throw invalid('Send the phone location or the meeting PIN to check in.');
  const raw = proof as Record<string, unknown>;
  if (raw.kind === 'gps') {
    if (!isLatitude(raw.latitude) || !isLongitude(raw.longitude)) throw invalid('The phone did not send a valid location. Turn on location services, then try again.');
    if (!isNumber(raw.accuracyMeters) || raw.accuracyMeters < 0) throw invalid('The phone did not report how precise its location is. Try again outside, or use the meeting PIN.');
    return { kind: 'gps', latitude: raw.latitude, longitude: raw.longitude, accuracyMeters: raw.accuracyMeters };
  }
  if (raw.kind === 'pin') {
    const pin = typeof raw.pin === 'string' ? raw.pin.trim() : raw.pin;
    if (!isPin(pin)) throw invalid('Enter the 4-digit meeting PIN.', { field: 'pin' });
    return { kind: 'pin', pin };
  }
  throw invalid('Send the phone location or the meeting PIN to check in.');
}

/**
 * Checks a proof against the council's circle and PIN; resolves to the distance for a GPS fix (null for a PIN).
 * Rejects:
 *   GEOFENCE_NOT_CONFIGURED - GPS sent, but the council has no meeting point (use the PIN);
 *   GPS_PRECISION_TOO_LOW   - the fix's precision radius is wider than the check-in radius;
 *   OUTSIDE_GEOFENCE        - the fix is farther from the meeting point than the radius (use the PIN);
 *   MEETING_PIN_INVALID     - the PIN does not match.
 */
export function verifyCheckInProof(fence: MeetingGeofence, proof: CheckInProof): { distanceMeters: number | null } {
  if (proof.kind === 'pin') {
    if (proof.pin !== fence.pinToken) {
      throw new BusinessRuleError('MEETING_PIN_INVALID', 'That meeting PIN is not correct. Ask the Grand Knight for the PIN and try again.', {});
    }
    return { distanceMeters: null };
  }
  if (!hasMeetingPoint(fence)) {
    throw new BusinessRuleError(
      'GEOFENCE_NOT_CONFIGURED',
      'Your council has not set its meeting location, so GPS check-in is off. Enter the 4-digit meeting PIN from the Grand Knight instead.',
      {},
    );
  }
  const meters = Math.round(distanceMeters({ latitude: fence.latitude!, longitude: fence.longitude! }, proof));
  if (proof.accuracyMeters > fence.radiusMeters) {
    throw new BusinessRuleError(
      'GPS_PRECISION_TOO_LOW',
      `Your phone's location is only accurate to ${Math.round(proof.accuracyMeters)} m, and check-in needs ${fence.radiusMeters} m or better. Step outside or near a window and try again, or enter the meeting PIN.`,
      { accuracyMeters: Math.round(proof.accuracyMeters), radiusMeters: fence.radiusMeters, distanceMeters: meters },
    );
  }
  if (meters > fence.radiusMeters) {
    throw new BusinessRuleError(
      'OUTSIDE_GEOFENCE',
      `You are ${meters.toLocaleString('en-US')} m from the meeting hall, outside the ${fence.radiusMeters} m check-in area. Enter the 4-digit meeting PIN from the Grand Knight instead.`,
      { distanceMeters: meters, radiusMeters: fence.radiusMeters },
    );
  }
  return { distanceMeters: meters };
}

/** Rejects MEETING_PIN_LOCKED once a member has used up MEETING_PIN_MAX_ATTEMPTS wrong PINs for the meeting. */
export function assertPinAttemptsLeft(wrongAttempts: number): void {
  if (wrongAttempts < MEETING_PIN_MAX_ATTEMPTS) return;
  throw new BusinessRuleError(
    'MEETING_PIN_LOCKED',
    `You entered a wrong meeting PIN ${MEETING_PIN_MAX_ATTEMPTS} times, so PIN check-in is locked for this meeting. Ask the Grand Knight or an officer to check you in from the Live Meeting Console.`,
    { maxAttempts: MEETING_PIN_MAX_ATTEMPTS },
  );
}

/**
 * Counts wrong PINs per member per meeting, in the driver's memory (not stored). Starting the meeting's console again
 * does not reset it; a new driver session does.
 */
export class MeetingPinAttempts {
  private readonly wrong = new Map<string, number>();
  private key = (meetingId: number, memberId: number) => `${meetingId}:${memberId}`;
  count(meetingId: number, memberId: number): number {
    return this.wrong.get(this.key(meetingId, memberId)) ?? 0;
  }
  recordWrong(meetingId: number, memberId: number): void {
    this.wrong.set(this.key(meetingId, memberId), this.count(meetingId, memberId) + 1);
  }
  clear(meetingId: number, memberId: number): void {
    this.wrong.delete(this.key(meetingId, memberId));
  }
}

/** A photo reference for LiveAttendance.photo_url or Meeting.photo_url: trimmed, at most 2000 characters; '' or null clears it. */
export function cleanMeetingPhotoUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw invalid('The photo link must be text.', { field: 'photo_url' });
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.length > MEETING_PHOTO_URL_MAX_LENGTH) {
    throw invalid(`The photo link is longer than ${MEETING_PHOTO_URL_MAX_LENGTH} characters.`, { field: 'photo_url' });
  }
  return trimmed;
}
