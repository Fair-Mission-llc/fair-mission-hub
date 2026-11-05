'use client';
// Sprint 11 Revision 20.0: the Local Feedback Portal (local-feedback.ts). A member's line to their own council's
// Admins, with a chat log tied to each ticket ID.
//   FeedbackTicketForm      the submission form (localFeedback.submitTicket)
//   MyFeedbackTickets       the member's history cards; each opens its chat log
//   FeedbackSupportPortal   the two together in Left Vertical Action Drawers (the /answers/feedback page body and the
//                           Member Desk's Feedback Support drawer)
//   MemberFeedbackQueue     the Admins' high-density triage ledger of every council ticket (the Admin Desk's Member
//                           Feedback Queue drawer); a row's status is set in place and its chat log opens beside it
//   FeedbackChatDrawer      the chat log of one ticket, in a side drawer; the member and the council's Admins post to
//                           it, and only an Admin sets the status
import { useState, type FormEvent } from 'react';
import {
  canTriageCouncilFeedback,
  describeError,
  FEEDBACK_CHAT_MAX_LENGTH,
  FEEDBACK_SUBJECT_MAX_LENGTH,
  FEEDBACK_TICKET_BODY_MAX_LENGTH,
  FEEDBACK_TICKET_CATEGORIES,
  FEEDBACK_TICKET_STATUSES,
  formatTimestamp,
  openFeedbackTicketCount,
  type FeedbackTicket,
  type FeedbackTicketCategory,
  type FeedbackTicketStatus,
} from '@kofc/shared';
import { Drawer } from '@/components/Drawer';
import { LeftActionDrawers } from '@/components/LeftActionDrawers';
import { Button, cx, Empty, Field, Input, Notice, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const statusTone = (status: FeedbackTicketStatus) => (status === 'Open' ? 'red' : status === 'In Progress' ? 'gold' : 'outline');

function StatusPill({ status }: { status: FeedbackTicketStatus }) {
  return <Pill tone={statusTone(status)}>{status}</Pill>;
}

// ---- the chat log ---------------------------------------------------------------------------------------------------

/** One ticket's chat log in a side drawer. `onChanged` lets the list behind it re-read the ticket. */
export function FeedbackChatDrawer({ ticketId, onClose, onChanged }: { ticketId: number; onClose: () => void; onChanged?: () => void }) {
  const user = useUser();
  const [version, setVersion] = useState(0);
  const chat = useLoad(() => db.localFeedback.getTicketChat(user.memberId, ticketId), [user.memberId, ticketId, version]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<FeedbackTicketStatus | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ticket = chat.data?.ticket;
  const triager = ticket ? canTriageCouncilFeedback({ ...user, active: true }, ticket.councilId) : false;

  const after = () => {
    setVersion((v) => v + 1);
    onChanged?.();
  };

  const post = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (triager && status && status !== ticket?.status) await db.localFeedback.setTicketStatus(user.memberId, ticketId, status, text.trim() || null);
      else await db.localFeedback.postTicketMessage(user.memberId, ticketId, text);
      setText('');
      setStatus('');
      after();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const canSend = text.trim() !== '' || (triager && status !== '' && status !== ticket?.status);
  return (
    <Drawer title={`Ticket #${ticketId} chat log`} onClose={onClose} wide>
      {chat.error ? <Notice tone="error">{chat.error}</Notice> : null}
      {!chat.data && !chat.error ? <p className="text-sm text-muted">Opening the chat log…</p> : null}
      {ticket ? (
        <>
          <div className="flex flex-col gap-1 rounded border-2 border-navy p-3">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-serif text-lg font-bold">{ticket.subject}</span>
              <StatusPill status={ticket.status} />
              <Pill tone="outline">{ticket.category}</Pill>
            </p>
            <p className="text-xs text-muted">
              Ticket #{ticket.id} · opened by {ticket.memberName} · {formatTimestamp(ticket.openedAt)}
            </p>
          </div>
          <ol aria-label={`Chat log of ticket ${ticket.id}`} className="flex flex-col gap-2">
            {chat.data!.entries.map((e) => {
              const mine = e.senderId === user.memberId;
              return (
                <li
                  key={e.id}
                  className={cx(
                    'flex flex-col gap-1 rounded border px-3 py-2',
                    e.kind === 'status' ? 'border-dashed border-navy bg-line/40' : mine ? 'ml-8 border-navy bg-gold/10' : 'mr-8 border-line bg-white',
                  )}
                >
                  <span className="text-xs font-bold text-navy">
                    {e.senderName} · {formatTimestamp(e.at)}
                    {e.kind === 'opening' ? ' · opened the ticket' : null}
                  </span>
                  {e.kind === 'status' ? (
                    <span className="text-sm">
                      Set the status to <StatusPill status={e.status!} />
                    </span>
                  ) : null}
                  {e.text ? <span className="whitespace-pre-wrap text-sm">{e.text}</span> : null}
                </li>
              );
            })}
          </ol>
          <form onSubmit={(e) => void post(e)} className="flex flex-col gap-3 border-t-2 border-navy pt-3">
            <Field label="Reply" hint={`${text.length} of ${FEEDBACK_CHAT_MAX_LENGTH} characters`}>
              {(id) => <Textarea id={id} rows={4} value={text} maxLength={FEEDBACK_CHAT_MAX_LENGTH} onChange={(e) => setText(e.target.value)} />}
            </Field>
            {triager ? (
              <Field label="Change the status (Admins)" hint="Your reply, if any, is saved as the note on the change.">
                {(id) => (
                  <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as FeedbackTicketStatus | '')}>
                    <option value="">Keep {ticket.status}</option>
                    {FEEDBACK_TICKET_STATUSES.filter((s) => s !== ticket.status).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : null}
            {error ? <Notice tone="error">{error}</Notice> : null}
            <div>
              <Button type="submit" disabled={busy || !canSend}>
                {busy ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </form>
        </>
      ) : null}
    </Drawer>
  );
}

// ---- the member's side ----------------------------------------------------------------------------------------------

/** A member opens a ticket for their own council's Admins. */
export function FeedbackTicketForm({ onSent }: { onSent: (ticket: FeedbackTicket) => void }) {
  const user = useUser();
  const [category, setCategory] = useState<FeedbackTicketCategory>('Question');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const ticket = await db.localFeedback.submitTicket(user.memberId, { category, subject, body });
      setSubject('');
      setBody('');
      setMessage({ tone: 'info', text: `Ticket #${ticket.id} was sent to your council's Admins. Follow it under My tickets.` });
      onSent(ticket);
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <p className="text-sm">Ask your council&apos;s Admins a question, report a problem or share an idea. They answer on the ticket&apos;s chat log.</p>
      <Field label="Category">
        {(id) => (
          <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as FeedbackTicketCategory)}>
            {FEEDBACK_TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Subject" hint={`${subject.length} of ${FEEDBACK_SUBJECT_MAX_LENGTH} characters`}>
        {(id) => <Input id={id} value={subject} maxLength={FEEDBACK_SUBJECT_MAX_LENGTH} onChange={(e) => setSubject(e.target.value)} required />}
      </Field>
      <Field label="What happened, or what would help?" hint={`${body.length} of ${FEEDBACK_TICKET_BODY_MAX_LENGTH} characters`}>
        {(id) => (
          <Textarea
            id={id}
            rows={6}
            value={body}
            maxLength={FEEDBACK_TICKET_BODY_MAX_LENGTH}
            placeholder="The screen you were on, what you did and what you expected."
            onChange={(e) => setBody(e.target.value)}
            required
          />
        )}
      </Field>
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <div>
        <Button type="submit" disabled={busy || subject.trim() === '' || body.trim() === ''}>
          {busy ? 'Sending…' : 'Send feedback'}
        </Button>
      </div>
    </form>
  );
}

/** The member's own tickets as history cards, newest activity first. */
export function MyFeedbackTickets({ version, onChanged }: { version: number; onChanged?: () => void }) {
  const user = useUser();
  const [reload, setReload] = useState(0);
  const [chatFor, setChatFor] = useState<number | null>(null);
  const tickets = useLoad(() => db.localFeedback.listMyTickets(user.memberId), [user.memberId, version, reload]);
  return (
    <div className="flex flex-col gap-3">
      {tickets.error ? <Notice tone="error">{tickets.error}</Notice> : null}
      {tickets.data && tickets.data.length === 0 ? <Empty>You have not sent any feedback yet.</Empty> : null}
      <ul className="flex flex-col gap-2">
        {(tickets.data ?? []).map((t) => (
          <li key={t.id} className="flex flex-col gap-1 rounded border-2 border-navy p-3">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-bold">#{t.id}</span>
              <span className="font-serif font-bold">{t.subject}</span>
              <StatusPill status={t.status} />
              <Pill tone="outline">{t.category}</Pill>
            </p>
            <p className="text-xs text-muted">
              Opened {formatTimestamp(t.openedAt)} · {t.replyCount} {t.replyCount === 1 ? 'reply' : 'replies'}
              {t.lastReplyBy ? ` · last from ${t.lastReplyBy}` : ''}
            </p>
            <div>
              <Button size="sm" variant="secondary" onClick={() => setChatFor(t.id)}>
                Open chat log
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {chatFor !== null ? (
        <FeedbackChatDrawer
          ticketId={chatFor}
          onClose={() => setChatFor(null)}
          onChanged={() => {
            setReload((n) => n + 1);
            onChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}

/** The member's portal: the form and the history, each in a left action drawer. */
export function FeedbackSupportPortal() {
  const [open, setOpen] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  return (
    <LeftActionDrawers
      label="Feedback Support drawers"
      open={open}
      onOpen={setOpen}
      drawers={[
        { id: 'new-ticket', title: 'Send feedback', hint: 'Open a ticket for your council’s Admins' },
        { id: 'my-tickets', title: 'My tickets', hint: 'Your tickets and their chat logs' },
      ]}
      render={(id) =>
        id === 'new-ticket' ? (
          <FeedbackTicketForm
            onSent={() => {
              setVersion((v) => v + 1);
            }}
          />
        ) : (
          <MyFeedbackTickets version={version} />
        )
      }
    />
  );
}

// ---- the Admins' triage ledger --------------------------------------------------------------------------------------

/** Every ticket of the reader's council, Open first, in one dense table. */
export function MemberFeedbackQueue({ councilId }: { councilId: number }) {
  const user = useUser();
  const [version, setVersion] = useState(0);
  const [chatFor, setChatFor] = useState<number | null>(null);
  const [filter, setFilter] = useState<FeedbackTicketStatus | 'All'>('All');
  const [error, setError] = useState<string | null>(null);
  const tickets = useLoad(() => db.localFeedback.listCouncilTickets(user.memberId, councilId), [user.memberId, councilId, version]);
  const rows = (tickets.data ?? []).filter((t) => filter === 'All' || t.status === filter);

  const setStatus = async (ticket: FeedbackTicket, status: FeedbackTicketStatus) => {
    setError(null);
    try {
      await db.localFeedback.setTicketStatus(user.memberId, ticket.id, status);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(describeError(err));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm">
          Feedback from your council&apos;s members. {tickets.data ? `${openFeedbackTicketCount(tickets.data)} need an answer.` : null}
        </p>
        <Field label="Show">
          {(id) => (
            <Select id={id} value={filter} onChange={(e) => setFilter(e.target.value as FeedbackTicketStatus | 'All')}>
              <option value="All">All tickets</option>
              {FEEDBACK_TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {tickets.error ? <Notice tone="error">{tickets.error}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {tickets.data && rows.length === 0 ? <Empty>No tickets to show.</Empty> : null}
      {rows.length > 0 ? (
        <Table caption="Member feedback tickets" head={['#', 'Status', 'Member', 'Category', 'Subject', 'Opened', 'Last activity', 'Replies', '']}>
          {rows.map((t) => (
            <tr key={t.id} className={cx(t.status === 'Open' && 'border-l-8 border-brand-red')}>
              <Td className="font-bold">{t.id}</Td>
              <Td>
                <Select
                  aria-label={`Status of ticket ${t.id}`}
                  value={t.status}
                  onChange={(e) => void setStatus(t, e.target.value as FeedbackTicketStatus)}
                  className="min-w-[8rem] py-1 text-xs"
                >
                  {FEEDBACK_TICKET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Td>
              <Td className="whitespace-nowrap">{t.memberName}</Td>
              <Td>{t.category}</Td>
              <Td className="max-w-[18rem] truncate">
                <span title={t.subject}>{t.subject}</span>
              </Td>
              <Td className="whitespace-nowrap text-xs">{formatTimestamp(t.openedAt)}</Td>
              <Td className="whitespace-nowrap text-xs">{formatTimestamp(t.lastActivityAt)}</Td>
              <Td className="text-right">{t.replyCount}</Td>
              <Td>
                <Button size="sm" variant="secondary" onClick={() => setChatFor(t.id)}>
                  Chat log
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      ) : null}
      {chatFor !== null ? <FeedbackChatDrawer ticketId={chatFor} onClose={() => setChatFor(null)} onChanged={() => setVersion((v) => v + 1)} /> : null}
    </div>
  );
}
