'use client';
// Sprint 8O: the Administrative Feedback Loops. The feedback form and inbox left the Online Help Center (and every member
// and volunteer screen); they live here and are mounted only behind ADMIN-level guards:
//   AdminFeedbackForm  System Settings > Administrative Feedback Loops (/system-settings/feedback), where council Admins
//                      and Super Admins send a note to the platform owner (feedback.submit, ADMIN_REQUIRED for anyone else).
//   FeedbackInbox      the notes, newest first with each sender (feedback.listInbox, SUPER_ADMIN_REQUIRED) - the Super
//                      Admin Desk's [ 📥 Feedback Communication Center ] folder, and the same page for other Super Admins.
import { useState, type FormEvent } from 'react';
import { councilLabel, describeError, FEEDBACK_MAX_LENGTH } from '@kofc/shared';
import { Button, Empty, Field, Notice, Panel, Pill, Table, Td, Textarea } from '@/components/ui';
import { formatPhone } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-navy">{label}</span>
      <span className="rounded border border-line bg-white px-2 py-1.5 text-sm text-navy">{value || '–'}</span>
    </div>
  );
}

/** An Admin's note to the platform owner; the driver refuses anyone below Admin (ADMIN_REQUIRED). */
export function AdminFeedbackForm({ onSent }: { onSent: () => void }) {
  const user = useUser();
  const member = useLoad(() => db.members.get(user.memberId), [user.memberId]);
  const council = useLoad(() => db.councils.get(user.councilId), [user.councilId]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await db.feedback.submit(user.memberId, text);
      setText('');
      setMessage({ tone: 'info', text: 'Thank you. Your note was sent to the platform owner.' });
      onSent();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Send a Note to the Platform Owner" className="border-2 border-navy" actions={<Pill tone="navy">Admins</Pill>}>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        {member.error || council.error ? <Notice tone="error">{member.error ?? council.error}</Notice> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReadOnly label="Full name" value={`${user.firstName} ${user.lastName}`} />
          <ReadOnly label="Council" value={council.data ? councilLabel(council.data) : ''} />
          <ReadOnly label="Phone" value={member.data ? formatPhone(member.data.Phone) : ''} />
          <ReadOnly label="Email" value={member.data?.Email ?? user.username} />
        </div>
        <p className="text-xs text-muted">These details are sent with your note so the platform owner can follow up. Change them in My Profile (your name, top right).</p>
        <Field label="What happened, or what would help?" hint={`${text.length} of ${FEEDBACK_MAX_LENGTH} characters`}>
          {(id) => (
            <Textarea
              id={id}
              rows={7}
              value={text}
              maxLength={FEEDBACK_MAX_LENGTH}
              placeholder="Describe the problem or suggestion: the screen you were on, what you did, and what you expected to happen."
              onChange={(e) => setText(e.target.value)}
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
          <Button type="submit" disabled={busy || text.trim() === ''}>
            {busy ? 'Sending…' : 'Send note'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/** Super Admins only; the driver refuses anyone else (SUPER_ADMIN_REQUIRED), so it is never rendered for them. */
export function FeedbackInbox({ version = 0, title = 'Feedback inbox' }: { version?: number; title?: string }) {
  const user = useUser();
  const inbox = useLoad(() => db.feedback.listInbox(user.memberId), [user.memberId, version]);
  const rows = inbox.data ?? [];
  return (
    <Panel title={`${title} (${rows.length})`} actions={<Pill tone="navy">Super Admin</Pill>}>
      {inbox.error ? <Notice tone="error">{inbox.error}</Notice> : null}
      {inbox.data && rows.length === 0 ? <Empty>No administrative feedback has been sent yet.</Empty> : null}
      {rows.length > 0 ? (
        <div className="max-h-[32rem] overflow-y-auto">
          <Table caption="Administrative feedback notes, newest first" head={['Submitted (UTC)', 'Member', 'Council', 'Phone', 'Email', 'Feedback']}>
            {rows.map((r) => (
              <tr key={r.feedback.id} className="align-top">
                <Td className="whitespace-nowrap">{r.feedback.SubmittedAt}</Td>
                <Td className="whitespace-nowrap font-bold">
                  {r.firstName} {r.lastName}
                </Td>
                <Td>{r.councilNumber}</Td>
                <Td className="whitespace-nowrap">{formatPhone(r.phone)}</Td>
                <Td>{r.email}</Td>
                <Td className="whitespace-pre-wrap">{r.feedback.FeedbackText}</Td>
              </tr>
            ))}
          </Table>
        </div>
      ) : null}
    </Panel>
  );
}
