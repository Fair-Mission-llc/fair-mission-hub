// =========================================================================
// THE LOCAL FEEDBACK PORTAL (Sprint 11 Revision 20.0; own tables since Sprint 11 Revision 21.0, schema 113)
//
// A member asks their own council's Admins for help, reports a problem or shares an idea, and the two sides talk it
// through on a chat log tied to the ticket. This is the council's own channel; the Administrative Feedback Loops
// (SystemFeedback, feedback.submit) stay the Admins' line to the platform owner.
//
// Storage (schema 113): the tickets left the messaging tables.
//   - LocalFeedbackTickets: one row per ticket (its id is the ticket ID) with the member's council, the category, the
//     subject, the member's words, the status ('Open', 'In Progress', 'Resolved'), when it opened, its last activity
//     and when it was resolved.
//   - LocalFeedbackTicketMessages: one row per later chat log line. entry_kind 'reply' is an answer; 'status' is a
//     status change (status_to = the new status, message_text = the optional note).
//   - Nothing is written to ChatThreads or Messages, so the Communications Hub never sees a ticket.
//
// Who sees what:
//   - Any Active member opens tickets and reads and answers their own (the Feedback Support page and the Member Desk's
//     Feedback Support drawer).
//   - The council's Active Admins, and Super Admins, read every ticket of that council, answer on its chat log and set
//     its status (the Admin Desk's Member Feedback Queue drawer, canTriageCouncilFeedback).
//   - Nobody else - another member, or an Admin of another council - reads a ticket (COUNCIL_ACCESS_DENIED).
// =========================================================================
import { assertText, BusinessRuleError, SecurityPrivilegeError, type MemberWriteActor } from './rules';

/** The ANSWERS sidebar link, the page heading and the Member Desk drawer. */
export const LOCAL_FEEDBACK_TITLE = 'Feedback Support';
export const LOCAL_FEEDBACK_HREF = '/answers/feedback';
/** The Admin Desk drawer that holds the council's triage ledger. */
export const MEMBER_FEEDBACK_QUEUE_TITLE = 'Member Feedback Queue';

export const FEEDBACK_TICKET_CATEGORIES = ['Question', 'Problem', 'Suggestion', 'Praise'] as const;
export type FeedbackTicketCategory = (typeof FEEDBACK_TICKET_CATEGORIES)[number];

export const FEEDBACK_TICKET_STATUSES = ['Open', 'In Progress', 'Resolved'] as const;
export type FeedbackTicketStatus = (typeof FEEDBACK_TICKET_STATUSES)[number];

export const FEEDBACK_SUBJECT_MAX_LENGTH = 120;
export const FEEDBACK_TICKET_BODY_MAX_LENGTH = 2000;
export const FEEDBACK_CHAT_MAX_LENGTH = 2000;

export interface FeedbackTicketInput {
  category: FeedbackTicketCategory;
  subject: string;
  body: string;
}

/** One ticket as the member's history cards and the Admins' triage ledger show it. */
export interface FeedbackTicket {
  /** The ticket ID: its LocalFeedbackTickets id. */
  id: number;
  councilId: number;
  memberId: number;
  memberName: string;
  category: FeedbackTicketCategory;
  subject: string;
  body: string;
  status: FeedbackTicketStatus;
  openedAt: string;
  lastActivityAt: string;
  /** Chat log entries after the opening message, status changes included. */
  replyCount: number;
  /** Who wrote the newest entry, or null when nobody has answered yet. */
  lastReplyBy: string | null;
}

export type FeedbackChatEntryKind = 'opening' | 'reply' | 'status';

/** One line of a ticket's chat log, oldest first. */
export interface FeedbackChatEntry {
  id: number;
  kind: FeedbackChatEntryKind;
  senderId: number | null;
  senderName: string;
  text: string;
  at: string;
  /** Set on a status change. */
  status?: FeedbackTicketStatus;
}

export interface FeedbackTicketChat {
  ticket: FeedbackTicket;
  entries: FeedbackChatEntry[];
}

// ---- the stored rows -----------------------------------------------------------------------------------------------

/** A LocalFeedbackTickets row (schema 113). */
export interface LocalFeedbackTicketRow {
  id: number;
  council_id: number;
  member_id: number;
  category: FeedbackTicketCategory;
  subject: string;
  body: string;
  status: FeedbackTicketStatus;
  opened_at: string;
  last_activity_at: string;
  resolved_at?: string | null;
}

/** A LocalFeedbackTicketMessages row: one chat log line after the opening (schema 113). */
export interface LocalFeedbackTicketMessageRow {
  id: number;
  ticket_id: number;
  sender_id: number;
  entry_kind: 'reply' | 'status';
  status_to?: FeedbackTicketStatus | null;
  message_text: string;
  created_at: string;
}

const isCategory = (v: unknown): v is FeedbackTicketCategory => (FEEDBACK_TICKET_CATEGORIES as readonly unknown[]).includes(v);
const isStatus = (v: unknown): v is FeedbackTicketStatus => (FEEDBACK_TICKET_STATUSES as readonly unknown[]).includes(v);

/** Validates a new ticket (INVALID_INPUT for an unknown category, or a blank or too-long subject or body). */
export function cleanFeedbackTicketInput(input: unknown): FeedbackTicketInput {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  if (!isCategory(raw.category)) {
    throw new BusinessRuleError('INVALID_INPUT', `Choose a category: ${FEEDBACK_TICKET_CATEGORIES.join(', ')}.`, { category: raw.category });
  }
  const subject = assertText(raw.subject, 'Subject', FEEDBACK_SUBJECT_MAX_LENGTH).replace(/\s+/g, ' ');
  const body = assertText(raw.body, 'Feedback', FEEDBACK_TICKET_BODY_MAX_LENGTH);
  return { category: raw.category, subject, body };
}

/** Validates one chat log reply. */
export const cleanFeedbackChatText = (text: unknown): string => assertText(text, 'Reply', FEEDBACK_CHAT_MAX_LENGTH);

/** The new LocalFeedbackTickets row's values (the driver adds the id). */
export function newFeedbackTicketRow(input: FeedbackTicketInput, councilId: number, memberId: number, at: string): Omit<LocalFeedbackTicketRow, 'id'> {
  return {
    council_id: councilId,
    member_id: memberId,
    category: input.category,
    subject: input.subject,
    body: input.body,
    status: 'Open',
    opened_at: at,
    last_activity_at: at,
    resolved_at: null,
  };
}

/** The ticket columns a status change writes: the status, the activity time and resolved_at (set on Resolved, cleared otherwise). */
export function feedbackStatusChange(status: FeedbackTicketStatus, at: string): Pick<LocalFeedbackTicketRow, 'status' | 'last_activity_at' | 'resolved_at'> {
  return { status, last_activity_at: at, resolved_at: status === 'Resolved' ? at : null };
}

// ---- reading tickets from the rows ----------------------------------------------------------------------------------

const byTimeThenId = (a: LocalFeedbackTicketMessageRow, b: LocalFeedbackTicketMessageRow) =>
  (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id - b.id;

export interface FeedbackTicketRows {
  tickets: readonly LocalFeedbackTicketRow[];
  messages: readonly LocalFeedbackTicketMessageRow[];
  /** memberId -> "First Last" */
  names: ReadonlyMap<number, string>;
}

const nameOf = (rows: FeedbackTicketRows, id: number | null | undefined) => (id == null ? 'Unknown' : (rows.names.get(id) ?? 'Former member'));

/** The chat log id of a ticket's opening line (the member's words live on the ticket row, not a message row). */
export const FEEDBACK_OPENING_ENTRY_ID = 0;

/** One ticket and its chat log, oldest line first. */
export function buildFeedbackTicketChat(row: LocalFeedbackTicketRow, rows: FeedbackTicketRows): FeedbackTicketChat {
  const lines = rows.messages.filter((m) => m.ticket_id === row.id).sort(byTimeThenId);
  const entries: FeedbackChatEntry[] = [
    { id: FEEDBACK_OPENING_ENTRY_ID, kind: 'opening', senderId: row.member_id, senderName: nameOf(rows, row.member_id), text: row.body, at: row.opened_at },
    ...lines.map((m): FeedbackChatEntry => {
      const base = { id: m.id, senderId: m.sender_id, senderName: nameOf(rows, m.sender_id), text: m.message_text ?? '', at: m.created_at };
      return m.entry_kind === 'status' && isStatus(m.status_to) ? { ...base, kind: 'status', status: m.status_to } : { ...base, kind: 'reply' };
    }),
  ];
  const last = lines.at(-1);
  return {
    ticket: {
      id: row.id,
      councilId: row.council_id,
      memberId: row.member_id,
      memberName: nameOf(rows, row.member_id),
      category: isCategory(row.category) ? row.category : 'Question',
      subject: row.subject,
      body: row.body,
      status: isStatus(row.status) ? row.status : 'Open',
      openedAt: row.opened_at,
      lastActivityAt: row.last_activity_at || last?.created_at || row.opened_at,
      replyCount: lines.length,
      lastReplyBy: last ? nameOf(rows, last.sender_id) : null,
    },
    entries,
  };
}

/** Every ticket among the rows, newest activity first. */
export function buildFeedbackTickets(rows: FeedbackTicketRows): FeedbackTicket[] {
  return rows.tickets
    .map((t) => buildFeedbackTicketChat(t, rows).ticket)
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt) || b.id - a.id);
}

const STATUS_ORDER: Record<FeedbackTicketStatus, number> = { Open: 0, 'In Progress': 1, Resolved: 2 };

/** The triage ledger's order: Open, then In Progress, then Resolved; newest activity first within each. */
export function sortFeedbackTicketsForTriage(tickets: readonly FeedbackTicket[]): FeedbackTicket[] {
  return [...tickets].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.lastActivityAt.localeCompare(a.lastActivityAt) || b.id - a.id,
  );
}

/** How many tickets still need an Admin (Open or In Progress). */
export const openFeedbackTicketCount = (tickets: readonly Pick<FeedbackTicket, 'status'>[]): number => tickets.filter((t) => t.status !== 'Resolved').length;

// ---- who may do what ------------------------------------------------------------------------------------------------

type TriageActor = Pick<MemberWriteActor, 'memberId' | 'councilId' | 'memberType' | 'active'>;

/** The council's Active Admins and any Active Super Admin read and answer every ticket of the council. */
export const canTriageCouncilFeedback = (actor: TriageActor, councilId: number): boolean =>
  actor.active && (actor.memberType === 'Super Admin' || (actor.memberType === 'Admin' && actor.councilId === councilId));

/** Any Active member opens a ticket (COUNCIL_ACCESS_DENIED otherwise). */
export function assertMayOpenFeedbackTicket(actor: TriageActor): void {
  if (actor.active) return;
  throw new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', 'Only an active member may send feedback to the council.', { memberId: actor.memberId });
}

/** The triage ledger of `councilId`: its Admins and Super Admins only (ADMIN_REQUIRED otherwise). */
export function assertMayTriageCouncilFeedback(actor: TriageActor, councilId: number): void {
  if (canTriageCouncilFeedback(actor, councilId)) return;
  throw new SecurityPrivilegeError('ADMIN_REQUIRED', `Member ${actor.memberId} may not read council ${councilId}'s feedback tickets; only its Admins can.`, {
    actorId: actor.memberId,
    councilId,
  });
}

/** A ticket's chat log: the member who opened it and the council's triagers (COUNCIL_ACCESS_DENIED otherwise). */
export function assertMayReadFeedbackTicket(actor: TriageActor, ticket: Pick<FeedbackTicket, 'id' | 'memberId' | 'councilId'>): void {
  if (actor.active && actor.memberId === ticket.memberId) return;
  if (canTriageCouncilFeedback(actor, ticket.councilId)) return;
  throw new SecurityPrivilegeError('COUNCIL_ACCESS_DENIED', `Member ${actor.memberId} may not read feedback ticket ${ticket.id}.`, {
    actorId: actor.memberId,
    ticketId: ticket.id,
  });
}

/** Only a triager changes a ticket's status (ADMIN_REQUIRED otherwise). */
export const assertMaySetFeedbackTicketStatus = (actor: TriageActor, ticket: Pick<FeedbackTicket, 'councilId'>): void =>
  assertMayTriageCouncilFeedback(actor, ticket.councilId);

/** Validates a requested status (INVALID_INPUT otherwise). */
export function cleanFeedbackTicketStatus(status: unknown): FeedbackTicketStatus {
  if (isStatus(status)) return status;
  throw new BusinessRuleError('INVALID_INPUT', `A ticket's status is one of ${FEEDBACK_TICKET_STATUSES.join(', ')}.`, { status });
}

export const feedbackTicketNotFound = (id: number): BusinessRuleError => new BusinessRuleError('RECORD_NOT_FOUND', `No feedback ticket ${id}.`, { ticketId: id });

