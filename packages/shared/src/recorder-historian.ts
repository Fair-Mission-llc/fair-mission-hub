// =========================================================================
// THE RECORDER AND HISTORIAN DESKS AND THE CROSS-COUNCIL VIEW-AS LOOKUP (Sprint 8B, schema version 74)
//
// Two more Active Desks on /dashboard, each for one seat, its council's Admins and any Super Admin:
//   - Recorder Desk   canOpenRecorderDesk   the Meeting Minutes Entry Desk (Meeting.minutes_text, minutes_published_at)
//                                           with the minutes countdown (Council.meeting_minutes_due_days, saved since
//                                           Sprint 7E and read for the first time here), and the Start Live Meeting
//                                           Sequence button (meetings.launchLiveMeeting), which also shows the 4-digit
//                                           meeting PIN for members outside the check-in circle.
//   - Historian Desk  canOpenHistorianDesk  the Digital Fraternal Annals Scrapbook: monthly text bulletins
//                                           (CouncilHistorianBulletin), meeting photos filed under Media / Meeting_Photos
//                                           and the oral-history recordings.
//
// The Super Admin's view-as lookup (/system-settings/impersonate) drills down Council -> clearance group -> person
// (buildImpersonationTree), with a predictive search (impersonationSuggestions). impersonationCouncilContext is what the
// view switches to: the target's own council flags, tenant type and timing settings, never the Super Admin's.
// =========================================================================
import type { LiveAssemblyState, SessionUser } from './contract';
import { councilWideSettings, type CouncilWideSettings } from './council-settings';
import { COUNCIL_HISTORIAN_ROLE } from './elections';
import { councilFeatureFlags, type FeatureFlags } from './features';
import { addDays } from './planning';
import { councilLabel, sortCouncils } from './presentation';
import { BusinessRuleError, describeActor, hasAdminRights, hasSuperAdminRights, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import { councilTenantType, type TenantType } from './tenant';
import type { Council, Meeting } from './types';

type Actor = Pick<SessionUser, 'memberId' | 'councilId' | 'memberType'> & { roles?: readonly string[] };

/** The Role that keeps a council's minutes. */
export const RECORDER_ROLE = 'Recorder';
/** Longest Meeting.minutes_text. */
export const MINUTES_TEXT_MAX_LENGTH = 20_000;
/** Longest CouncilHistorianBulletin.body. */
export const HISTORIAN_BULLETIN_MAX_LENGTH = 8000;
/** How far back the minutes desk lists meetings, and how far ahead. */
export const MINUTES_DESK_PAST_DAYS = 90;
export const MINUTES_DESK_AHEAD_DAYS = 30;

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

export const holdsRecorderRole = (roles: readonly string[] | undefined): boolean => (roles ?? []).includes(RECORDER_ROLE);

// ---- desk access ---------------------------------------------------------------------------------------

const ownAdmin = (u: Actor, councilId: number) => u.memberType === 'Admin' && u.councilId === councilId;

/** The Recorder Desk tab: the council's Recorder, its Admins and any Super Admin. */
export const canOpenRecorderDesk = (u: Actor, councilId: number): boolean =>
  u.memberType === 'Super Admin' || ownAdmin(u, councilId) || (u.councilId === councilId && holdsRecorderRole(u.roles));

/** The Historian Desk tab: the council's Council Historian, its Admins and any Super Admin. */
export const canOpenHistorianDesk = (u: Actor, councilId: number): boolean =>
  u.memberType === 'Super Admin' || ownAdmin(u, councilId) || (u.councilId === councilId && (u.roles ?? []).includes(COUNCIL_HISTORIAN_ROLE));

function deskDenial(actor: MemberWriteActor, councilId: number, role: string, code: 'RECORDER_REQUIRED' | 'HISTORIAN_REQUIRED', action: string): SecurityPrivilegeError | null {
  if (hasSuperAdminRights(actor)) return null;
  const seated = hasAdminRights(actor) || (actor.active && (actor.roles ?? []).includes(role));
  if (!seated) {
    return new SecurityPrivilegeError(code, `Only the council's ${role}, an Admin or a Super Admin can ${action}; member ${actor.memberId} is ${describeActor(actor)} without the ${role} seat.`, {
      actorId: actor.memberId,
      councilId,
    });
  }
  if (actor.councilId !== councilId) {
    return new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', `Member ${actor.memberId} of council ${actor.councilId} cannot ${action} for council ${councilId}.`, {
      actorId: actor.memberId,
      actorCouncilId: actor.councilId,
      councilId,
    });
  }
  return null;
}

/** meetings.saveMeetingMinutes and launchLiveMeeting: RECORDER_REQUIRED, or COUNCIL_ACCESS_DENIED for another council. */
export function assertMayKeepMinutes(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = deskDenial(actor, councilId, RECORDER_ROLE, 'RECORDER_REQUIRED', action);
  if (denial) throw denial;
}

/** history.saveHistorianBulletin and listHistorianBulletins: HISTORIAN_REQUIRED, or COUNCIL_ACCESS_DENIED. */
export function assertMayKeepScrapbook(actor: MemberWriteActor, councilId: number, action: string): void {
  const denial = deskDenial(actor, councilId, COUNCIL_HISTORIAN_ROLE, 'HISTORIAN_REQUIRED', action);
  if (denial) throw denial;
}

/** assertMayKeepScrapbook as a yes/no: the Historian also files meeting photos (meetings.setMeetingPhoto). */
export const mayKeepScrapbook = (actor: MemberWriteActor, councilId: number): boolean =>
  deskDenial(actor, councilId, COUNCIL_HISTORIAN_ROLE, 'HISTORIAN_REQUIRED', 'keep the scrapbook') === null;

// ---- the minutes ---------------------------------------------------------------------------------------

export interface MeetingMinutesInput {
  /** The minutes as plain text with light markdown (# headings, - bullets). null or blank clears a draft. */
  text: string | null;
  /** True publishes them (minutes_published_at = now); false keeps them a draft and withdraws a publication. */
  publish?: boolean;
}

/** INVALID_INPUT for text over MINUTES_TEXT_MAX_LENGTH or publishing blank minutes. */
export function cleanMeetingMinutes(input: MeetingMinutesInput): { minutes_text: string | null; publish: boolean } {
  if (input === null || typeof input !== 'object') throw invalid('Send the minutes text.');
  const raw = input.text;
  if (raw !== null && raw !== undefined && typeof raw !== 'string') throw invalid('The minutes must be text.', { field: 'text' });
  const text = (raw ?? '').replace(/\r\n/g, '\n').trim();
  if (text.length > MINUTES_TEXT_MAX_LENGTH) throw invalid(`The minutes may be at most ${MINUTES_TEXT_MAX_LENGTH.toLocaleString('en-US')} characters.`, { field: 'text', length: text.length });
  const publish = input.publish === true;
  if (publish && text === '') throw invalid('Write the minutes before publishing them.', { field: 'text' });
  return { minutes_text: text === '' ? null : text, publish };
}

export type MinutesCountdownState = 'upcoming' | 'open' | 'overdue' | 'published';

export interface MinutesCountdown {
  state: MinutesCountdownState;
  /** The meeting's last day (EndDate for a multi-day meeting). */
  heldOn: string;
  /** heldOn plus the council's meeting_minutes_due_days. */
  dueDate: string;
  /** Whole days from today to dueDate: negative once overdue. */
  daysLeft: number;
}

const dayNumber = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000;

type MinutesMeeting = Pick<Meeting, 'Date'> & Partial<Pick<Meeting, 'EndDate' | 'minutes_published_at'>>;

/**
 * Where a meeting's minutes stand: 'upcoming' until it is held, 'published' once published, else 'open' through the
 * due date (the meeting's last day + dueDays) and 'overdue' after it.
 */
export function minutesCountdown(meeting: MinutesMeeting, today: string, dueDays: number): MinutesCountdown {
  const heldOn = String(meeting.EndDate || meeting.Date).slice(0, 10);
  const dueDate = addDays(heldOn, Math.max(0, Math.floor(dueDays)));
  const daysLeft = dayNumber(dueDate) - dayNumber(today);
  const state: MinutesCountdownState = meeting.minutes_published_at ? 'published' : today < heldOn ? 'upcoming' : daysLeft < 0 ? 'overdue' : 'open';
  return { state, heldOn, dueDate, daysLeft };
}

const STATE_ORDER: Record<MinutesCountdownState, number> = { overdue: 0, open: 1, upcoming: 2, published: 3 };

/**
 * The minutes desk's business calendar: the council's meetings from MINUTES_DESK_PAST_DAYS back to
 * MINUTES_DESK_AHEAD_DAYS ahead, overdue first, then open by days left, then upcoming by date, then published newest first.
 */
export function minutesDeskRows<M extends MinutesMeeting & Pick<Meeting, 'id'>>(meetings: readonly M[], today: string, dueDays: number): (MinutesCountdown & { meeting: M })[] {
  const from = addDays(today, -MINUTES_DESK_PAST_DAYS);
  const to = addDays(today, MINUTES_DESK_AHEAD_DAYS);
  return meetings
    .filter((m) => String(m.EndDate || m.Date).slice(0, 10) >= from && String(m.Date).slice(0, 10) <= to)
    .map((meeting) => ({ ...minutesCountdown(meeting, today, dueDays), meeting }))
    .sort(
      (a, b) =>
        STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
        (a.state === 'published' ? b.heldOn.localeCompare(a.heldOn) : a.state === 'upcoming' ? a.heldOn.localeCompare(b.heldOn) : a.daysLeft - b.daysLeft) ||
        a.meeting.id - b.meeting.id,
    );
}

/** One line of the countdown: 'Due in 3 days', 'Due today', '2 days overdue', 'Published', 'Not held yet'. */
export function minutesCountdownLabel(c: MinutesCountdown): string {
  switch (c.state) {
    case 'published':
      return 'Published';
    case 'upcoming':
      return 'Not held yet';
    case 'overdue':
      return `${-c.daysLeft} day${c.daysLeft === -1 ? '' : 's'} overdue`;
    default:
      return c.daysLeft === 0 ? 'Due today' : `Due in ${c.daysLeft} day${c.daysLeft === 1 ? '' : 's'}`;
  }
}

/** meetings.launchLiveMeeting: the console's state and the PIN the chair reads out. */
export interface LiveMeetingLaunch {
  state: LiveAssemblyState;
  /** Council.meeting_pin_token, the 4-digit check-in bypass for members outside the circle. */
  pinToken: string;
  /** True while the PIN is still the factory '0000': the Grand Knight should change it. */
  pinIsDefault: boolean;
}

// ---- the historian's monthly bulletins ------------------------------------------------------------------

/** 'YYYY-MM' for the month of an ISO date. */
export const bulletinMonthOf = (isoDate: string): string => isoDate.slice(0, 7);

/** INVALID_INPUT for a month that is not 'YYYY-MM' or a body over HISTORIAN_BULLETIN_MAX_LENGTH. A blank body is allowed (an empty draft). */
export function cleanHistorianBulletin(month: unknown, body: unknown): { bulletin_month: string; body: string } {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month.trim())) throw invalid('Name the bulletin month as YYYY-MM.', { field: 'month' });
  if (body !== null && body !== undefined && typeof body !== 'string') throw invalid('The bulletin must be text.', { field: 'body' });
  const text = (body ?? '').replace(/\r\n/g, '\n').trim();
  if (text.length > HISTORIAN_BULLETIN_MAX_LENGTH) {
    throw invalid(`A bulletin may be at most ${HISTORIAN_BULLETIN_MAX_LENGTH.toLocaleString('en-US')} characters.`, { field: 'body', length: text.length });
  }
  return { bulletin_month: month.trim(), body: text };
}

// ---- the view-as council context ------------------------------------------------------------------------

export interface ImpersonationCouncilContext {
  councilId: number;
  councilLabel: string;
  /** The member viewed belongs to another council than the Super Admin's own. */
  crossCouncil: boolean;
  flags: FeatureFlags;
  tenantType: TenantType;
  settings: CouncilWideSettings;
}

/** Everything the portal reads from the viewed member's own council the moment a view-as session begins. */
export function impersonationCouncilContext(council: Council, impersonatorCouncilId: number): ImpersonationCouncilContext {
  return {
    councilId: council.id,
    councilLabel: councilLabel(council),
    crossCouncil: council.id !== impersonatorCouncilId,
    flags: councilFeatureFlags(council),
    tenantType: councilTenantType(council),
    settings: councilWideSettings(council),
  };
}

// ---- the cascading view-as lookup -----------------------------------------------------------------------

export type ClearanceGroupId = 'executive' | 'finance' | 'records' | 'officers' | 'admins' | 'appointed' | 'members';

/** The drill-down's middle tier, in the order it shows them. */
export const CLEARANCE_GROUPS: readonly { id: ClearanceGroupId; label: string }[] = [
  { id: 'executive', label: 'Executive Officers' },
  { id: 'finance', label: 'Finance Officers' },
  { id: 'records', label: 'Recorder & Historian' },
  { id: 'officers', label: 'Other Officers' },
  { id: 'admins', label: 'Council Admins' },
  { id: 'appointed', label: 'Appointed Seats' },
  { id: 'members', label: 'Members' },
];

export interface ImpersonationCandidate {
  memberId: number;
  councilId: number;
  firstName: string;
  lastName: string;
  memberNumber?: string | number | null;
  email?: string | null;
  memberType: string | undefined;
  roles: readonly string[];
  /** Holds a Role with Officer = 1. */
  isOfficer: boolean;
}

/** A person's clearance group: their highest seat first, then Admin keys, then any other role. */
export function clearanceGroupOf(p: Pick<ImpersonationCandidate, 'memberType' | 'roles' | 'isOfficer'>): ClearanceGroupId {
  const has = (...names: string[]) => names.some((n) => p.roles.includes(n));
  if (has('Grand Knight', 'Deputy Grand Knight')) return 'executive';
  if (has('Financial Secretary', 'Treasurer')) return 'finance';
  if (has(RECORDER_ROLE, COUNCIL_HISTORIAN_ROLE)) return 'records';
  if (p.isOfficer) return 'officers';
  if (p.memberType === 'Admin') return 'admins';
  if (p.roles.length > 0) return 'appointed';
  return 'members';
}

const searchText = (p: ImpersonationCandidate, council: string) =>
  [p.firstName, p.lastName, `${p.firstName} ${p.lastName}`, p.memberNumber ?? '', p.email ?? '', p.memberType ?? '', council, ...p.roles].join(' ').toLowerCase();

const byName = (a: ImpersonationCandidate, b: ImpersonationCandidate) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName) || a.memberId - b.memberId;

/** Every word of the query must appear somewhere in the person's name, number, email, type, roles or council. */
function matcher(query: string, labels: ReadonlyMap<number, string>) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return (p: ImpersonationCandidate) => {
    if (words.length === 0) return true;
    const text = searchText(p, labels.get(p.councilId) ?? '');
    return words.every((w) => text.includes(w));
  };
}

/** Who a Super Admin may view as: never themselves, never another Super Admin (assertMayImpersonate). */
const viewable = (viewerId: number) => (p: ImpersonationCandidate) => p.memberId !== viewerId && p.memberType !== 'Super Admin';

export interface ImpersonationTreeGroup {
  id: ClearanceGroupId;
  label: string;
  people: ImpersonationCandidate[];
}

export interface ImpersonationTreeCouncil {
  councilId: number;
  label: string;
  /** People in the council who match the query. */
  count: number;
  groups: ImpersonationTreeGroup[];
}

export interface ImpersonationTree {
  councils: ImpersonationTreeCouncil[];
  /** People who match, across every council. */
  matches: number;
}

/**
 * The lookup's Council -> clearance group -> person tree for one query. Councils come in CouncilNumber order, groups in
 * CLEARANCE_GROUPS order, people by last then first name. A council or group with nobody matching is left out.
 */
export function buildImpersonationTree(
  councils: readonly Pick<Council, 'id' | 'CouncilNumber' | 'CouncilName'>[],
  people: readonly ImpersonationCandidate[],
  query: string,
  viewerId: number,
): ImpersonationTree {
  const labels = new Map(councils.map((c) => [c.id, councilLabel(c)]));
  const hit = matcher(query, labels);
  const shown = people.filter(viewable(viewerId)).filter(hit);
  const out: ImpersonationTreeCouncil[] = [];
  for (const c of sortCouncils(councils)) {
    const mine = shown.filter((p) => p.councilId === c.id);
    if (mine.length === 0) continue;
    const groups = CLEARANCE_GROUPS.map((g) => ({ ...g, people: mine.filter((p) => clearanceGroupOf(p) === g.id).sort(byName) })).filter((g) => g.people.length > 0);
    out.push({ councilId: c.id, label: labels.get(c.id) ?? '', count: mine.length, groups });
  }
  return { councils: out, matches: shown.length };
}

/** How many names the predictive search offers under the box. */
export const IMPERSONATION_SUGGESTION_LIMIT = 8;

/**
 * The predictive search's suggestions: people whose first or last name starts with the query's last word come first,
 * then any other match, each by name.
 */
export function impersonationSuggestions(
  councils: readonly Pick<Council, 'id' | 'CouncilNumber' | 'CouncilName'>[],
  people: readonly ImpersonationCandidate[],
  query: string,
  viewerId: number,
  limit: number = IMPERSONATION_SUGGESTION_LIMIT,
): ImpersonationCandidate[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const labels = new Map(councils.map((c) => [c.id, councilLabel(c)]));
  const last = words[words.length - 1];
  const hits = people.filter(viewable(viewerId)).filter(matcher(query, labels));
  const prefix = (p: ImpersonationCandidate) => p.firstName.toLowerCase().startsWith(last) || p.lastName.toLowerCase().startsWith(last);
  return hits.sort((a, b) => Number(prefix(b)) - Number(prefix(a)) || byName(a, b)).slice(0, Math.max(0, limit));
}
