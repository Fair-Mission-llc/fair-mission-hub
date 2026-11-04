// =========================================================================
// MOTION REQUESTS (Sprint 11 Revision 18.0, schema 111)
//
// A member asks to put a motion before the council. The request records who proposed it (proposed_by), what the motion
// does (summary_what), why (rationale_why) and its cost (financial_impact_usd, 0 when none). It waits as 'Pending' until
// the Grand Knight (or Deputy Grand Knight) decides it:
//   - 'Approved' files a ProposedMotion (SourceType 'GeneralMember', SourceRecordID = the request id) with a fixed
//     MOTION_REQUEST_SLOT_MINUTES (5-minute) slot on the soonest Monthly meeting dated at least
//     Council.motion_request_lead_days (default 5) after the member submitted the request. A request that comes in
//     later than that waits for the next Monthly meeting.
//   - 'Denied' closes it with a note the member reads.
//   - The member may withdraw a request that is still Pending ('Withdrawn').
//
// Each request keeps a chat log (MotionRequestMessage) in two channels:
//   - MEMBER_GK: the member and the Grand Knight's seat.
//   - OFFICER_ADVISORY: the council's officers advising the Grand Knight. The member never reads it (unless the member
//     holds the Grand Knight's seat).
//
// Screens: 'My Motion Requests' on the Member Desk and at the foot of /motion-requests (the Faith In Action link and page
// heading 'Motion Request' since Revision 18.5), and the
// 'Motion Requests' drawer on the Grand Knight Desk, lit while a request waits for a decision.
// =========================================================================
import { MONTHLY_MEETING_TYPE_NAME } from './charities';
import { addDays } from './planning';
import {
  BusinessRuleError,
  describeActor,
  hasSuperAdminRights,
  holdsGrandKnightAuthority,
  SecurityPrivilegeError,
  type MemberWriteActor,
} from './rules';
import type { Meeting, Member, ProposedMotion } from './types';

/** The Grand Knight Desk drawer and the page heading for officers. */
export const MOTION_REQUESTS_TITLE = 'Motion Requests';
/**
 * The member's own history panel: at the foot of /motion-requests and on the Member Desk. Sprint 11 Revision 18.5: the
 * sidebar link and the page heading read MOTION_REQUEST_LABEL instead.
 */
export const MY_MOTION_REQUESTS_TITLE = 'My Motion Requests';
/** Sprint 11 Revision 18.5: the Faith In Action sidebar link and the /motion-requests page heading. */
export const MOTION_REQUEST_LABEL = 'Motion Request';
/** The page the Faith In Action link opens. */
export const MOTION_REQUESTS_HREF = '/motion-requests';
/** Every approved motion gets this many minutes on the agenda. */
export const MOTION_REQUEST_SLOT_MINUTES = 5;

export const MOTION_SUMMARY_MAX_LENGTH = 500;
export const MOTION_RATIONALE_MAX_LENGTH = 4000;
export const MOTION_DECISION_NOTE_MAX_LENGTH = 1000;
export const MOTION_MESSAGE_MAX_LENGTH = 2000;
/** The largest financial impact a request may state, in dollars. */
export const MOTION_FINANCIAL_IMPACT_MAX_USD = 10_000_000;

export const MOTION_REQUEST_STATUSES = ['Pending', 'Approved', 'Denied', 'Withdrawn'] as const;
export type MotionRequestStatus = (typeof MOTION_REQUEST_STATUSES)[number];

export const MOTION_REQUEST_CHANNELS = ['MEMBER_GK', 'OFFICER_ADVISORY'] as const;
export type MotionRequestChannel = (typeof MOTION_REQUEST_CHANNELS)[number];

/** How screens name each channel. */
export const MOTION_REQUEST_CHANNEL_LABELS: Readonly<Record<MotionRequestChannel, string>> = {
  MEMBER_GK: 'Member and Grand Knight',
  OFFICER_ADVISORY: 'Officer advisory',
};

/** One MotionRequest row (schema 111). */
export interface MotionRequest {
  id: number;
  council_id: number;
  /** The member who proposed it. */
  proposed_by: number;
  summary_what: string;
  rationale_why: string;
  /** Dollars, 0 when the motion costs nothing. */
  financial_impact_usd: number;
  request_status: MotionRequestStatus;
  submitted_at: string;
  decided_by_member_id?: number | null;
  decided_at?: string | null;
  decision_note?: string | null;
  /** The Monthly meeting an approved request is heard at. */
  target_meeting_id?: number | null;
  /** The ProposedMotion an approval filed. */
  proposed_motion_id?: number | null;
}

/** One MotionRequestMessage row (schema 111). */
export interface MotionRequestMessage {
  id: number;
  motion_request_id: number;
  channel: MotionRequestChannel;
  author_member_id: number;
  posted_at: string;
  message_body: string;
}

/** What a member types to submit a request. */
export interface MotionRequestInput {
  summary_what: string;
  rationale_why: string;
  financial_impact_usd?: number | null;
}

/** The meeting an approved request would be heard at. */
export interface MotionRequestMeeting {
  id: number;
  name: string;
  date: string;
}

/** A request as the screens show it. */
export interface MotionRequestDetail {
  request: MotionRequest;
  proposerName: string;
  deciderName: string | null;
  targetMeeting: MotionRequestMeeting | null;
  /** The channels the reader may open, in display order. */
  channels: MotionRequestChannel[];
  /** Messages per channel the reader may open. */
  messageCounts: Partial<Record<MotionRequestChannel, number>>;
  /** True when the reader may approve or deny it now. */
  canDecide: boolean;
  /** True when the reader may withdraw it now. */
  canWithdraw: boolean;
}

export interface MotionRequestMessageDetail extends MotionRequestMessage {
  authorName: string;
}

/** One channel of a request's chat log. */
export interface MotionRequestThread {
  requestId: number;
  channel: MotionRequestChannel;
  messages: MotionRequestMessageDetail[];
  canPost: boolean;
}

/** motionRequests.decide's answer. */
export interface MotionRequestDecision {
  request: MotionRequestDetail;
  /** The motion filed on the agenda; null for a denial. */
  motion: ProposedMotion | null;
  meeting: MotionRequestMeeting | null;
}

/** motionRequests.preview's answer: where a request submitted now would land. */
export interface MotionRequestPreview {
  leadDays: number;
  /** The first meeting date a request submitted today can be heard at. */
  earliestDate: string;
  meeting: MotionRequestMeeting | null;
}

/** The reader as the motion rules see it. */
export type MotionActor = Pick<MemberWriteActor, 'memberId' | 'councilId' | 'memberType' | 'active' | 'roles' | 'officer'>;

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

function cleanText(value: unknown, label: string, field: string, max: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') throw invalid(`Enter ${label}.`, { field });
  if (text.length > max) throw invalid(`${label[0]!.toUpperCase()}${label.slice(1)} is ${text.length} characters; the limit is ${max}.`, { field, max });
  return text;
}

/** The dollar amount as stored: whole cents, 0 to MOTION_FINANCIAL_IMPACT_MAX_USD. Blank reads as 0. */
export function cleanFinancialImpact(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n) || n < 0) throw invalid('Financial impact must be a dollar amount of 0 or more.', { field: 'financial_impact_usd' });
  if (n > MOTION_FINANCIAL_IMPACT_MAX_USD) {
    throw invalid(`Financial impact cannot be more than $${MOTION_FINANCIAL_IMPACT_MAX_USD.toLocaleString('en-US')}.`, { field: 'financial_impact_usd' });
  }
  return Math.round(n * 100) / 100;
}

/** motionRequests.submit's input, trimmed and checked (INVALID_INPUT otherwise). */
export function cleanMotionRequestInput(input: unknown): Required<MotionRequestInput> {
  if (input === null || typeof input !== 'object') throw invalid('Send the motion request as an object.');
  const raw = input as Record<string, unknown>;
  return {
    summary_what: cleanText(raw.summary_what, 'what the motion does', 'summary_what', MOTION_SUMMARY_MAX_LENGTH),
    rationale_why: cleanText(raw.rationale_why, 'why the council should pass it', 'rationale_why', MOTION_RATIONALE_MAX_LENGTH),
    financial_impact_usd: cleanFinancialImpact(raw.financial_impact_usd),
  };
}

/** A decision note: optional for an approval, required for a denial so the member knows why. */
export function cleanDecisionNote(note: unknown, decision: 'Approved' | 'Denied'): string | null {
  const text = typeof note === 'string' ? note.trim() : '';
  if (text === '') {
    if (decision === 'Denied') throw invalid('Write a short note telling the member why the request is denied.', { field: 'decision_note' });
    return null;
  }
  if (text.length > MOTION_DECISION_NOTE_MAX_LENGTH) throw invalid(`The note is ${text.length} characters; the limit is ${MOTION_DECISION_NOTE_MAX_LENGTH}.`, { field: 'decision_note' });
  return text;
}

export function cleanMotionDecision(value: unknown): 'Approved' | 'Denied' {
  if (value === 'Approved' || value === 'Denied') return value;
  throw invalid(`A decision must be 'Approved' or 'Denied'; received ${JSON.stringify(value)}.`, { field: 'decision' });
}

export function cleanMotionChannel(value: unknown): MotionRequestChannel {
  if ((MOTION_REQUEST_CHANNELS as readonly unknown[]).includes(value)) return value as MotionRequestChannel;
  throw invalid(`A channel must be MEMBER_GK or OFFICER_ADVISORY; received ${JSON.stringify(value)}.`, { field: 'channel' });
}

export function cleanMotionMessage(value: unknown): string {
  return cleanText(value, 'a message', 'message_body', MOTION_MESSAGE_MAX_LENGTH);
}

// ---- who may do what ------------------------------------------------------------------------------------------

/** The Grand Knight's seat (Grand Knight or Deputy Grand Knight) of `councilId`, or an Active Super Admin. */
export function canDecideMotionRequests(actor: MotionActor, councilId: number): boolean {
  if (hasSuperAdminRights(actor as MemberWriteActor)) return true;
  return actor.active && actor.councilId === councilId && holdsGrandKnightAuthority(actor.roles);
}

/** Reading the council's request list: the decision makers and the council's officers. */
export function canReadCouncilMotionRequests(actor: MotionActor, councilId: number): boolean {
  return canDecideMotionRequests(actor, councilId) || (actor.active && actor.councilId === councilId && !!actor.officer);
}

/** Whether `actor` may read and post in `channel` of `request`. */
export function motionRequestChannelAccess(
  actor: MotionActor,
  request: Pick<MotionRequest, 'council_id' | 'proposed_by'>,
  channel: MotionRequestChannel,
): { read: boolean; post: boolean } {
  const decides = canDecideMotionRequests(actor, request.council_id);
  const proposer = actor.memberId === request.proposed_by;
  if (channel === 'MEMBER_GK') {
    const read = decides || proposer;
    return { read, post: read && actor.active };
  }
  // The officers' channel: never the member who proposed it, unless that member holds the Grand Knight's seat.
  const officer = actor.active && actor.councilId === request.council_id && !!actor.officer;
  const read = decides || (officer && !proposer);
  return { read, post: read && actor.active };
}

/** The channels `actor` may open, in display order. */
export const readableMotionChannels = (actor: MotionActor, request: Pick<MotionRequest, 'council_id' | 'proposed_by'>): MotionRequestChannel[] =>
  MOTION_REQUEST_CHANNELS.filter((c) => motionRequestChannelAccess(actor, request, c).read);

export function assertMayDecideMotionRequests(actor: MotionActor, councilId: number, action: string): void {
  if (canDecideMotionRequests(actor, councilId)) return;
  throw new SecurityPrivilegeError(
    'GRAND_KNIGHT_REQUIRED',
    `Only the council's Grand Knight or Deputy Grand Knight may ${action}; you are ${describeActor(actor as MemberWriteActor)}.`,
    { memberId: actor.memberId, councilId },
  );
}

export function assertMayReadCouncilMotionRequests(actor: MotionActor, councilId: number): void {
  if (canReadCouncilMotionRequests(actor, councilId)) return;
  throw new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', `Only the officers of council ${councilId} read its motion requests.`, {
    memberId: actor.memberId,
    councilId,
  });
}

export function assertMotionChannelAccess(
  actor: MotionActor,
  request: Pick<MotionRequest, 'id' | 'council_id' | 'proposed_by'>,
  channel: MotionRequestChannel,
  mode: 'read' | 'post',
): void {
  if (motionRequestChannelAccess(actor, request, channel)[mode]) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `You may not ${mode === 'read' ? 'read' : 'post in'} the ${MOTION_REQUEST_CHANNEL_LABELS[channel].toLowerCase()} messages of motion request ${request.id}.`,
    { memberId: actor.memberId, requestId: request.id, channel },
  );
}

/** Only an Active member submits a request. */
export function assertMaySubmitMotionRequest(actor: MotionActor): void {
  if (actor.active) return;
  throw new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', 'Only an active member may submit a motion request.', { memberId: actor.memberId });
}

export const motionRequestNotFound = (id: number): BusinessRuleError =>
  new BusinessRuleError('RECORD_NOT_FOUND', `No motion request ${id}.`, { requestId: id });

/** A decision or a withdrawal needs a request that is still Pending (REQUEST_STATUS_CONFLICT otherwise). */
export function assertMotionRequestPending(request: Pick<MotionRequest, 'id' | 'request_status'>): void {
  if (request.request_status === 'Pending') return;
  throw new BusinessRuleError(
    'REQUEST_STATUS_CONFLICT',
    `Motion request ${request.id} is already ${request.request_status}; only a Pending request can change.`,
    { requestId: request.id, status: request.request_status },
  );
}

/** Only the member who proposed it withdraws it. */
export function assertMayWithdrawMotionRequest(actor: MotionActor, request: Pick<MotionRequest, 'id' | 'proposed_by' | 'request_status'>): void {
  if (actor.memberId !== request.proposed_by) {
    throw new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', `Only the member who proposed motion request ${request.id} may withdraw it.`, {
      memberId: actor.memberId,
      requestId: request.id,
    });
  }
  assertMotionRequestPending(request);
}

// ---- the agenda ---------------------------------------------------------------------------------------------

/** The council's lead days as stored, or the default (5) for a missing or broken value. */
export function motionRequestLeadDays(council: { motion_request_lead_days?: number | null } | null | undefined): number {
  const n = council?.motion_request_lead_days;
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.round(n) : 5;
}

/**
 * The first date a request can be heard: `leadDays` after the day it was submitted (YYYY-MM-DD or a timestamp), and
 * never before `today`.
 */
export function motionRequestEarliestDate(submittedAt: string, leadDays: number, today: string): string {
  const earliest = addDays(String(submittedAt).slice(0, 10), leadDays);
  return earliest > today ? earliest : today;
}

/**
 * The soonest of `monthlyMeetings` (already limited to the council's Monthly meetings) dated on or after `earliest`, by
 * Date, then Time Start, then id; null when none qualifies.
 */
export function nextMotionRequestMeeting<M extends Pick<Meeting, 'id' | 'Date' | 'Time Start'>>(monthlyMeetings: readonly M[], earliest: string): M | null {
  const eligible = monthlyMeetings
    .filter((m) => String(m.Date).slice(0, 10) >= earliest)
    .sort((a, b) => (a.Date < b.Date ? -1 : a.Date > b.Date ? 1 : a['Time Start'] < b['Time Start'] ? -1 : a['Time Start'] > b['Time Start'] ? 1 : a.id - b.id));
  return eligible[0] ?? null;
}

export const noMotionRequestMeeting = (requestId: number, councilId: number, earliest: string): BusinessRuleError =>
  new BusinessRuleError(
    'NO_ELIGIBLE_MEETING',
    `Council ${councilId} has no ${MONTHLY_MEETING_TYPE_NAME} meeting on or after ${earliest} to hear motion request ${requestId}; add the meeting on Recurring Meetings first.`,
    { requestId, councilId, earliestDate: earliest },
  );

/** How a meeting appears on the motion screens. */
export const motionRequestMeeting = (m: Pick<Meeting, 'id' | 'Date'> & { 'Meeting Name'?: string | null }): MotionRequestMeeting => ({
  id: m.id,
  name: String(m['Meeting Name'] ?? '').trim() || 'Monthly meeting',
  date: String(m.Date).slice(0, 10),
});

/** The ProposedMotion text an approval files: what the motion does, and its cost when it has one. */
export function motionRequestMotionText(request: Pick<MotionRequest, 'summary_what' | 'financial_impact_usd'>): string {
  const cost = Number(request.financial_impact_usd) || 0;
  const amount = cost.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  return cost > 0 ? `${request.summary_what} (financial impact ${amount})` : request.summary_what;
}

// ---- building what the screens read ---------------------------------------------------------------------------

type NamedMember = Pick<Member, 'id' | 'MemberFirstName' | 'MemberLastName'>;

const nameOf = (members: ReadonlyMap<number, NamedMember>, id: number | null | undefined): string => {
  if (id === null || id === undefined) return '';
  const m = members.get(id);
  return m ? `${m.MemberFirstName} ${m.MemberLastName}`.trim() : `Member ${id}`;
};

/** Newest first. */
export const sortMotionRequests = <T extends Pick<MotionRequest, 'id' | 'submitted_at'>>(rows: readonly T[]): T[] =>
  [...rows].sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : a.submitted_at > b.submitted_at ? -1 : b.id - a.id));

/** Pending first, then newest first: the order of the Grand Knight's drawer. */
export const sortMotionRequestsForDecision = <T extends { request: Pick<MotionRequest, 'id' | 'submitted_at' | 'request_status'> }>(rows: readonly T[]): T[] =>
  [...rows].sort((a, b) => {
    const pa = a.request.request_status === 'Pending' ? 0 : 1;
    const pb = b.request.request_status === 'Pending' ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return a.request.submitted_at < b.request.submitted_at ? 1 : a.request.submitted_at > b.request.submitted_at ? -1 : b.request.id - a.request.id;
  });

/** The screens' view of each request, for `actor`. */
export function buildMotionRequestDetails(
  actor: MotionActor,
  requests: readonly MotionRequest[],
  members: readonly NamedMember[],
  meetings: readonly (Pick<Meeting, 'id' | 'Date'> & { 'Meeting Name'?: string | null })[],
  messages: readonly Pick<MotionRequestMessage, 'motion_request_id' | 'channel'>[],
): MotionRequestDetail[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const meetingById = new Map(meetings.map((m) => [m.id, m]));
  return sortMotionRequests(requests).map((request) => {
    const channels = readableMotionChannels(actor, request);
    const messageCounts: Partial<Record<MotionRequestChannel, number>> = {};
    for (const c of channels) messageCounts[c] = messages.filter((m) => m.motion_request_id === request.id && m.channel === c).length;
    const meeting = request.target_meeting_id ? meetingById.get(request.target_meeting_id) : undefined;
    const pending = request.request_status === 'Pending';
    return {
      request: { ...request },
      proposerName: nameOf(byId, request.proposed_by),
      deciderName: request.decided_by_member_id ? nameOf(byId, request.decided_by_member_id) : null,
      targetMeeting: meeting ? motionRequestMeeting(meeting) : null,
      channels,
      messageCounts,
      canDecide: pending && canDecideMotionRequests(actor, request.council_id),
      canWithdraw: pending && actor.memberId === request.proposed_by,
    };
  });
}

/** One channel's messages, oldest first, with author names. */
export function buildMotionRequestThread(
  actor: MotionActor,
  request: Pick<MotionRequest, 'id' | 'council_id' | 'proposed_by'>,
  channel: MotionRequestChannel,
  messages: readonly MotionRequestMessage[],
  members: readonly NamedMember[],
): MotionRequestThread {
  const byId = new Map(members.map((m) => [m.id, m]));
  return {
    requestId: request.id,
    channel,
    messages: messages
      .filter((m) => m.motion_request_id === request.id && m.channel === channel)
      .sort((a, b) => (a.posted_at < b.posted_at ? -1 : a.posted_at > b.posted_at ? 1 : a.id - b.id))
      .map((m) => ({ ...m, authorName: nameOf(byId, m.author_member_id) })),
    canPost: motionRequestChannelAccess(actor, request, channel).post,
  };
}

/** How many requests wait for a decision: the Grand Knight drawer's count and alert. */
export const pendingMotionRequestCount = (rows: readonly { request: Pick<MotionRequest, 'request_status'> }[]): number =>
  rows.filter((r) => r.request.request_status === 'Pending').length;

/** The pill each status shows. */
export const MOTION_REQUEST_STATUS_LABELS: Readonly<Record<MotionRequestStatus, string>> = {
  Pending: 'Waiting for the Grand Knight',
  Approved: 'Approved: on the agenda',
  Denied: 'Denied',
  Withdrawn: 'Withdrawn',
};
