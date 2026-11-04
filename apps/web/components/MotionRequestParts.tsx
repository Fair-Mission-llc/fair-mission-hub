'use client';
// Sprint 11 Revision 18.0: Motion Requests (motion-requests.ts, schema 111).
//   - MyMotionRequestsPanel: a member submits a request (what, why, financial impact), follows it, withdraws it while it
//     is Pending, and messages the Grand Knight. On the Member Desk and on /motion-requests (Faith In Action).
//   - CouncilMotionRequests: the Grand Knight's seat approves or denies each request; an approval puts a 5-minute motion
//     on the soonest Monthly meeting the council's lead days allow. The council's officers read the list and advise in
//     the officer channel. On the Grand Knight Desk's Motion Requests drawer and on /motion-requests for officers.
//   - MotionThread: one chat channel of a request, kept with the request for good.
import { useState } from 'react';
import {
  describeError,
  MOTION_RATIONALE_MAX_LENGTH,
  MOTION_REQUEST_CHANNEL_LABELS,
  MOTION_REQUEST_SLOT_MINUTES,
  MOTION_REQUEST_STATUS_LABELS,
  MOTION_SUMMARY_MAX_LENGTH,
  MY_MOTION_REQUESTS_TITLE,
  MOTION_REQUESTS_TITLE,
  pendingMotionRequestCount,
  type MotionRequestChannel,
  type MotionRequestDetail,
  type MotionRequestStatus,
  type SessionUser,
} from '@kofc/shared';
import { Button, cx, Empty, Field, Input, Notice, Panel, Pill, Textarea } from '@/components/ui';
import { formatFullDate, formatMoney } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const STATUS_TONE: Record<MotionRequestStatus, 'gold' | 'navy' | 'red' | 'outline'> = {
  Pending: 'gold',
  Approved: 'navy',
  Denied: 'red',
  Withdrawn: 'outline',
};

export function MotionStatusPill({ status }: { status: MotionRequestStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{MOTION_REQUEST_STATUS_LABELS[status]}</Pill>;
}

/** One channel of a request's chat log, with a box to post when the reader may. */
export function MotionThread({ user, requestId, channel }: { user: SessionUser; requestId: number; channel: MotionRequestChannel }) {
  const thread = useLoad(() => db.motionRequests.listMessages(user.memberId, requestId, channel), [user.memberId, requestId, channel]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const post = async () => {
    setBusy(true);
    setError(null);
    try {
      await db.motionRequests.postMessage(user.memberId, requestId, channel, text);
      setText('');
      await thread.reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };
  const messages = thread.data?.messages ?? [];
  return (
    <section aria-label={`${MOTION_REQUEST_CHANNEL_LABELS[channel]} messages`} className="flex flex-col gap-2 rounded border border-line bg-white p-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-navy">{MOTION_REQUEST_CHANNEL_LABELS[channel]} messages</h4>
      {channel === 'OFFICER_ADVISORY' ? <p className="text-xs text-muted">Officers only. The member who proposed the motion does not see these messages.</p> : null}
      {thread.error ? <Notice tone="error">{thread.error}</Notice> : null}
      {thread.data && messages.length === 0 ? <p className="text-sm text-muted">No messages yet.</p> : null}
      {messages.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {messages.map((m) => (
            <li key={m.id} className={cx('rounded px-3 py-2 text-sm', m.author_member_id === user.memberId ? 'bg-gold/20' : 'bg-navy/5')}>
              <p className="text-xs font-bold text-navy">
                {m.authorName} · {m.posted_at.slice(0, 16)}
              </p>
              <p className="whitespace-pre-wrap">{m.message_body}</p>
            </li>
          ))}
        </ol>
      ) : null}
      {thread.data?.canPost ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void post();
          }}
        >
          <Textarea aria-label="Write a message" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div>
            <Button type="submit" size="sm" disabled={busy || text.trim() === ''}>
              {busy ? 'Sending…' : 'Send message'}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

/** The facts of one request: what, why, cost, and where it stands. */
function MotionFacts({ detail, showProposer }: { detail: MotionRequestDetail; showProposer?: boolean }) {
  const r = detail.request;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-bold">
          #{r.id} {r.summary_what}
        </span>
        <MotionStatusPill status={r.request_status} />
      </p>
      {showProposer ? <p className="text-xs text-muted">Proposed by {detail.proposerName} on {formatFullDate(r.submitted_at.slice(0, 10))}</p> : null}
      {!showProposer ? <p className="text-xs text-muted">Submitted {formatFullDate(r.submitted_at.slice(0, 10))}</p> : null}
      <p className="whitespace-pre-wrap">
        <span className="font-bold">Why: </span>
        {r.rationale_why}
      </p>
      <p>
        <span className="font-bold">Financial impact: </span>
        {r.financial_impact_usd > 0 ? formatMoney(r.financial_impact_usd) : 'None'}
      </p>
      {detail.targetMeeting ? (
        <p>
          <span className="font-bold">On the agenda: </span>
          {detail.targetMeeting.name}, {formatFullDate(detail.targetMeeting.date)} ({MOTION_REQUEST_SLOT_MINUTES} minutes)
        </p>
      ) : null}
      {r.decision_note ? (
        <p className="whitespace-pre-wrap">
          <span className="font-bold">{detail.deciderName ? `Note from ${detail.deciderName}: ` : 'Note: '}</span>
          {r.decision_note}
        </p>
      ) : null}
    </div>
  );
}

/** The channel buttons and the open channel under a request. */
function MotionChannels({ user, detail }: { user: SessionUser; detail: MotionRequestDetail }) {
  const [open, setOpen] = useState<MotionRequestChannel | null>(null);
  if (detail.channels.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {detail.channels.map((c) => (
          <Button key={c} size="sm" variant={open === c ? 'primary' : 'secondary'} aria-pressed={open === c} onClick={() => setOpen(open === c ? null : c)}>
            {MOTION_REQUEST_CHANNEL_LABELS[c]} ({detail.messageCounts[c] ?? 0})
          </Button>
        ))}
      </div>
      {open ? <MotionThread key={open} user={user} requestId={detail.request.id} channel={open} /> : null}
    </div>
  );
}

/** The submit form, with the meeting a request sent today would reach. */
function MotionRequestForm({ user, onSaved }: { user: SessionUser; onSaved: () => Promise<void> }) {
  const preview = useLoad(() => db.motionRequests.preview(user.memberId), [user.memberId]);
  const [what, setWhat] = useState('');
  const [why, setWhy] = useState('');
  const [impact, setImpact] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await db.motionRequests.submit(user.memberId, { summary_what: what, rationale_why: why, financial_impact_usd: impact.trim() === '' ? 0 : Number(impact.replace(/[$,\s]/g, '')) });
      setWhat('');
      setWhy('');
      setImpact('');
      setMessage({ tone: 'info', text: `Motion request #${saved.request.id} is with the Grand Knight.` });
      await onSaved();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };
  const p = preview.data;
  return (
    <form
      aria-label="New motion request"
      className="flex flex-col gap-3 rounded border-2 border-navy bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h3 className="font-serif text-lg font-bold text-navy">Request a motion</h3>
      {p ? (
        <p className="text-sm">
          Requests must be in {p.leadDays} days before the meeting.{' '}
          {p.meeting
            ? `If the Grand Knight approves a request you send today, it goes on the ${p.meeting.name} agenda on ${formatFullDate(p.meeting.date)} with a ${MOTION_REQUEST_SLOT_MINUTES}-minute slot.`
            : `No Monthly meeting is scheduled on or after ${formatFullDate(p.earliestDate)} yet; an approved request waits for the next one.`}
        </p>
      ) : null}
      <Field label="What the motion does" hint={`Up to ${MOTION_SUMMARY_MAX_LENGTH} characters.`}>
        {(id) => <Input id={id} value={what} maxLength={MOTION_SUMMARY_MAX_LENGTH} onChange={(e) => setWhat(e.target.value)} placeholder="Buy a new grill for the parish fish fry" />}
      </Field>
      <Field label="Why the council should pass it" hint={`Up to ${MOTION_RATIONALE_MAX_LENGTH} characters.`}>
        {(id) => <Textarea id={id} rows={3} value={why} maxLength={MOTION_RATIONALE_MAX_LENGTH} onChange={(e) => setWhy(e.target.value)} />}
      </Field>
      <Field label="Financial impact ($)" hint="Leave blank or 0 when the motion costs nothing.">
        {(id) => <Input id={id} inputMode="decimal" value={impact} onChange={(e) => setImpact(e.target.value)} placeholder="0.00" />}
      </Field>
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <div>
        <Button type="submit" variant="gold" disabled={busy || what.trim() === '' || why.trim() === ''}>
          {busy ? 'Sending…' : 'Submit motion request'}
        </Button>
      </div>
    </form>
  );
}

/** The member's own requests and the form to send one. */
export function MyMotionRequestsPanel({ user, showForm = true }: { user: SessionUser; showForm?: boolean }) {
  const mine = useLoad(() => db.motionRequests.listMine(user.memberId), [user.memberId]);
  const [error, setError] = useState<string | null>(null);
  const rows = mine.data ?? [];
  const withdraw = async (id: number) => {
    setError(null);
    try {
      await db.motionRequests.withdraw(user.memberId, id);
      await mine.reload();
    } catch (err) {
      setError(describeError(err));
    }
  };
  return (
    <Panel title={`${MY_MOTION_REQUESTS_TITLE} (${rows.length})`}>
      <div className="flex flex-col gap-3">
        {showForm ? <MotionRequestForm user={user} onSaved={() => mine.reload()} /> : null}
        {mine.error ? <Notice tone="error">{mine.error}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        {mine.data && rows.length === 0 ? <Empty>You have not requested a motion yet.</Empty> : null}
        {rows.length > 0 ? (
          <ul aria-label={MY_MOTION_REQUESTS_TITLE} className="flex flex-col divide-y divide-line">
            {rows.map((d) => (
              <li key={d.request.id} className="flex flex-col gap-2 py-3">
                <MotionFacts detail={d} />
                <MotionChannels user={user} detail={d} />
                {d.canWithdraw ? (
                  <div>
                    <Button size="sm" variant="secondary" onClick={() => void withdraw(d.request.id)}>
                      Withdraw request
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Panel>
  );
}

/** Approve or deny one Pending request. */
function DecisionControls({ user, detail, onDone }: { user: SessionUser; detail: MotionRequestDetail; onDone: () => Promise<void> }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const decide = async (decision: 'Approved' | 'Denied') => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await db.motionRequests.decide(user.memberId, detail.request.id, decision, note);
      setMessage({
        tone: 'info',
        text: result.meeting
          ? `Approved. The motion is on the ${result.meeting.name} agenda on ${formatFullDate(result.meeting.date)} (${MOTION_REQUEST_SLOT_MINUTES} minutes).`
          : 'Denied. The member sees your note.',
      });
      await onDone();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded border-2 border-gold bg-gold/10 p-3">
      <Field label="Note to the member" hint="Optional when you approve. Required when you deny.">
        {(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="gold" disabled={busy} onClick={() => void decide('Approved')}>
          Approve and add to the agenda
        </Button>
        <Button variant="danger" disabled={busy || note.trim() === ''} onClick={() => void decide('Denied')}>
          Deny request
        </Button>
      </div>
    </div>
  );
}

/** The council's requests: the Grand Knight decides them; officers read them and advise. */
export function CouncilMotionRequests({ user, councilId, onChanged }: { user: SessionUser; councilId: number; onChanged?: () => void }) {
  const list = useLoad(() => db.motionRequests.listForCouncil(user.memberId, councilId), [user.memberId, councilId]);
  const rows = list.data ?? [];
  const pending = pendingMotionRequestCount(rows);
  const reload = async () => {
    await list.reload();
    onChanged?.();
  };
  return (
    <Panel title={`${MOTION_REQUESTS_TITLE} (${pending} waiting)`}>
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          Approve a request to put it on the agenda of the next Monthly meeting the council's lead days allow, with a {MOTION_REQUEST_SLOT_MINUTES}-minute slot.
          Use the officer advisory messages to talk it over with the other officers before you decide.
        </p>
        {list.error ? <Notice tone="error">{list.error}</Notice> : null}
        {list.data && rows.length === 0 ? <Empty>No member has requested a motion.</Empty> : null}
        {rows.length > 0 ? (
          <ul aria-label="Council motion requests" className="flex flex-col gap-3">
            {rows.map((d) => (
              <li
                key={d.request.id}
                data-alert-boundary={d.request.request_status === 'Pending' ? 'true' : undefined}
                className={cx('flex flex-col gap-2 rounded bg-white p-3', d.request.request_status === 'Pending' ? 'border-4 border-brand-red' : 'border-2 border-line')}
              >
                <MotionFacts detail={d} showProposer />
                {d.canDecide ? <DecisionControls user={user} detail={d} onDone={reload} /> : null}
                <MotionChannels user={user} detail={d} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Panel>
  );
}
