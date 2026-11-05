// =========================================================================
// THE LOCAL FEEDBACK PORTAL (Sprint 11 Revision 20.0, schema 112 - no table change)
//
// A member asks their own council's Admins for help, reports a problem or shares an idea, and the two sides talk it
// through on a chat log tied to the ticket. This is the council's own channel; the Administrative Feedback Loops
// (SystemFeedback, feedback.submit) stay the Admins' line to the platform owner.
//
// Storage: the schema is locked at 112, so a ticket lives on the existing messaging tables.
//   - The ticket is one ChatThreads row (CouncilID = the member's council). Its id is the ticket ID.
//   - The thread's first message opens the ticket. Its text starts with FEEDBACK_TICKET_MARKER, then the category and
//     subject lines, a blank line and the member's words (encodeFeedbackTicketOpening).
//   - Every later message is one chat log entry. A status change is a message that starts with FEEDBACK_STATUS_MARKER
//     (encodeFeedbackStatusChange); the newest one sets the ticket's status. A ticket with none is 'Open'.
//   - Ticket threads never show in the Communications Hub (messaging.ts buildThreadSummaries skips them).
//
// Who sees what:
//   - Any Active member opens tickets and reads and answers their own (the Feedback Support page and the Member Desk's
//     Feedback Support drawer).
//   - The council's Active Admins, and Super Admins, read every ticket of that council, answer on its chat log and set
//     its status (the Admin Desk's Member Feedback Queue drawer, canTriageCouncilFeedback).
//   - Nobody else - another member, or an Admin of another council - reads a ticket (COUNCIL_ACCESS_DENIED).
// =========================================================================
import { assertText, BusinessRuleError, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import type { ChatThread, Message } from './types';

/** The ANSWERS sidebar link, the page heading and the Member Desk drawer. */
export const LOCAL_FEEDBACK_TITLE = 'Feedback Support';
export const LOCAL_FEEDBACK_HREF = '/answers/feedback';
/** The Admin Desk drawer that holds the council's triage ledger. */
export const MEMBER_FEEDBACK_QUEUE_TITLE = 'Member Feedback Queue';

/** The first line of a ticket's opening message. */
export const FEEDBACK_TICKET_MARKER = '#local-feedback-ticket';
/** The first word of a status-change message. */
export const FEEDBACK_STATUS_MARKER = '#local-feedback-status';

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
  /** The ticket ID: its ChatThreads id. */
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

// ---- the stored text ------------------------------------------------------------------------------------------------

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

/** The opening message's text. */
export const encodeFeedbackTicketOpening = (input: FeedbackTicketInput): string =>
  `${FEEDBACK_TICKET_MARKER}\ncategory: ${input.category}\nsubject: ${input.subject}\n\n${input.body}`;

/** Whether a message text opens a feedback ticket. */
export const isFeedbackTicketText = (text: string | null | undefined): boolean =>
  typeof text === 'string' && (text === FEEDBACK_TICKET_MARKER || text.startsWith(`${FEEDBACK_TICKET_MARKER}\n`));

/** The opening message read back, or null when the text does not open a ticket. */
export function parseFeedbackTicketOpening(text: string | null | undefined): FeedbackTicketInput | null {
  if (!isFeedbackTicketText(text)) return null;
  const lines = (text as string).split('\n');
  const category = lines[1]?.startsWith('category: ') ? lines[1].slice('category: '.length).trim() : '';
  const subject = lines[2]?.startsWith('subject: ') ? lines[2].slice('subject: '.length).trim() : '';
  const body = lines.slice(4).join('\n');
  return { category: isCategory(category) ? category : 'Question', subject, body };
}

/** A status change's text: the marker, the new status and an optional note on the lines below. */
export const encodeFeedbackStatusChange = (status: FeedbackTicketStatus, note?: string | null): string =>
  `${FEEDBACK_STATUS_MARKER} ${status}${note && note.trim() ? `\n\n${note.trim()}` : ''}`;

/** A status change read back, or null for an ordinary reply. */
export function parseFeedbackStatusChange(text: string | null | undefined): { status: FeedbackTicketStatus; note: string } | null {
  if (typeof text !== 'string' || !text.startsWith(`${FEEDBACK_STATUS_MARKER} `)) return null;
  const [head = '', ...rest] = text.split('\n');
  const status = head.slice(FEEDBACK_STATUS_MARKER.length + 1).trim();
  if (!isStatus(status)) return null;
  return { status, note: rest.join('\n').trim() };
}

// ---- reading tickets from the messaging rows ------------------------------------------------------------------------

const byTimeThenId = (a: Message, b: Message) => (a.CreatedAt ?? '').localeCompare(b.CreatedAt ?? '') || a.id - b.id;

/** A thread's sent messages, oldest first. */
const sentMessages = (threadId: number, messages: readonly Message[]) =>
  messages.filter((m) => m.ThreadID === threadId && m.IsDraft !== 1).sort(byTimeThenId);

/** Whether the thread is a feedback ticket: its first sent message opens one. */
export function isFeedbackTicketThread(threadId: number, messages: readonly Message[]): boolean {
  return isFeedbackTicketText(sentMessages(threadId, messages)[0]?.MessageText ?? null);
}

export interface FeedbackTicketRows {
  threads: readonly ChatThread[];
  messages: readonly Message[];
  /** memberId -> "First Last" */
  names: ReadonlyMap<number, string>;
}

const nameOf = (rows: FeedbackTicketRows, id: number | null | undefined) => (id == null ? 'Unknown' : (rows.names.get(id) ?? 'Former member'));

/** One ticket and its chat log, or null when the thread is not a ticket. */
export function buildFeedbackTicketChat(thread: ChatThread, rows: FeedbackTicketRows): FeedbackTicketChat | null {
  const sent = sentMessages(thread.id, rows.messages);
  const opening = sent[0];
  const parsed = parseFeedbackTicketOpening(opening?.MessageText ?? null);
  if (!opening || !parsed) return null;
  let status: FeedbackTicketStatus = 'Open';
  const entries: FeedbackChatEntry[] = sent.map((m, i) => {
    const base = { id: m.id, senderId: m.SenderID ?? null, senderName: nameOf(rows, m.SenderID), at: m.CreatedAt ?? '' };
    if (i === 0) return { ...base, kind: 'opening' as const, text: parsed.body };
    const change = parseFeedbackStatusChange(m.MessageText);
    if (change) {
      status = change.status;
      return { ...base, kind: 'status' as const, text: change.note, status: change.status };
    }
    return { ...base, kind: 'reply' as const, text: m.MessageText ?? '' };
  });
  const last = sent.at(-1)!;
  return {
    ticket: {
      id: thread.id,
      councilId: thread.CouncilID ?? 0,
      memberId: opening.SenderID ?? 0,
      memberName: nameOf(rows, opening.SenderID),
      category: parsed.category,
      subject: parsed.subject,
      body: parsed.body,
      status,
      openedAt: opening.CreatedAt ?? thread.CreatedAt ?? '',
      lastActivityAt: last.CreatedAt ?? '',
      replyCount: sent.length - 1,
      lastReplyBy: sent.length > 1 ? nameOf(rows, last.SenderID) : null,
    },
    entries,
  };
}

/** Every ticket among the rows, newest activity first. */
export function buildFeedbackTickets(rows: FeedbackTicketRows): FeedbackTicket[] {
  return rows.threads
    .map((t) => buildFeedbackTicketChat(t, rows)?.ticket ?? null)
    .filter((t): t is FeedbackTicket => t !== null)
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

