'use client';
// The Volunteer Time Quarantine Desk (Sprint 7B): a high-contrast pane on the executive dashboard for the council's Grand
// Knight, Deputy Grand Knight and Admins, and any Super Admin (canReviewVolunteerQuarantine). It lists every time entry
// the over-reporting guards held from the time tables (volunteerQuarantine.listPending) - member, activity, date, hours,
// the member's own description and why it was held - with two decisions per row:
//   - Approve & Add to Time Log (Sprint 7C wording; was Clear Hours to Ledger): APPROVED, and the hours are written to EventTime or ActivityTime so every total counts them;
//   - Reject & Return to Member (Sprint 9 Revision 1.1; was Reject & Remove): nothing is deleted. The tap slides open the
//     required 'Reason for returning time report (required)' field; sending it returns the entry to the member as DRAFT
//     with that reason, which the phone's Report Hours screen shows them so they can correct the hours and resubmit.
// Hidden while the council's feature_volunteer_quarantine flag is off.
import { useState } from 'react';
import { describeError, QUARANTINE_RETURN_REASON_LABEL, QUARANTINE_RETURN_REASON_MAX_LENGTH, type QuarantineDeskEntry } from '@kofc/shared';
import { Button, Empty, Field, Notice, Textarea } from '@/components/ui';
import { formatDecimalHours, formatFullDate } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

export function QuarantineDesk({ actorId, councilId }: { actorId: number; councilId: number }) {
  const desk = useLoad(() => db.volunteerQuarantine.listPending(actorId, councilId), [actorId, councilId]);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<{
    tone: 'info' | 'error';
    text: string;
  } | null>(null);
  // The entry whose return reason is being written, and the text so far. Rejecting never removes an entry at once.
  const [returning, setReturning] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const rows = desk.data ?? [];

  const openReturn = (entry: QuarantineDeskEntry) => {
    setReturning(entry.row.id);
    setReason('');
    setMessage(null);
  };
  const closeReturn = () => {
    setReturning(null);
    setReason('');
  };

  const decide = async (entry: QuarantineDeskEntry, verdict: 'clear' | 'return') => {
    if (verdict === 'return' && !reason.trim()) return;
    setBusy(entry.row.id);
    setMessage(null);
    try {
      if (verdict === 'clear') await db.volunteerQuarantine.clear(actorId, entry.row.id);
      else await db.volunteerQuarantine.reject(actorId, entry.row.id, reason);
      const hours = formatDecimalHours(entry.row.hours_reported);
      setMessage({
        tone: 'info',
        text:
          verdict === 'clear'
            ? `Cleared ${hours} for ${entry.memberName}; the hours now count in every total.`
            : `Returned ${hours} to ${entry.memberName} as a draft with your reason; the hours will not count unless they resubmit and it is approved.`,
      });
      closeReturn();
      await desk.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Flagged Hours Review Desk" className="rounded border-4 border-brand-red bg-navy px-5 py-4 text-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl font-bold">🚨 Flagged Hours Review Desk</h2>
        <span className="rounded bg-brand-red px-2 py-0.5 text-sm font-bold">{rows.length} pending</span>
      </div>
      <p className="mt-1 text-sm">
        Time entries held from every total: more than 5 activities in one day, more than 5.0 hours against one activity, or more than 1.0 hour over a
        scheduled shift.
      </p>
      {desk.error ? <Notice tone="error">{desk.error}</Notice> : null}
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      {desk.data && rows.length === 0 ? (
        <div className="mt-3 rounded bg-white p-2 text-navy">
          <Empty>No volunteer time is waiting for review.</Empty>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <ul className="mt-3 flex max-h-[32rem] flex-col gap-3 overflow-y-auto" aria-label="Held time entries">
          {rows.map((entry) => {
            const open = returning === entry.row.id;
            return (
              <li key={entry.row.id} className="rounded border-2 border-white bg-white px-4 py-3 text-navy">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-base font-bold">{entry.memberName}</p>
                  <p className="text-2xl font-bold text-brand-red">{formatDecimalHours(entry.row.hours_reported)}</p>
                </div>
                <p className="text-sm">
                  <span className="font-bold">{entry.row.activity_type === 'SHIFT' ? 'Shift' : 'Activity'}:</span> {entry.activityLabel} ·{' '}
                  {formatFullDate(entry.row.activity_date)}
                  {entry.row.scheduled_hours != null ? ` · scheduled ${formatDecimalHours(entry.row.scheduled_hours)}` : ''}
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-bold">Description:</span> {entry.description ?? <span className="text-muted">No description given</span>}
                </p>
                <p className="mt-1 text-sm font-bold text-brand-red">{entry.row.quarantine_reason}</p>
                <p className="text-xs text-muted">Logged {entry.row.date_logged}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {/* Green is the confirmation fill (globals.css); Button has no green variant. */}
                  <button
                    type="button"
                    className="rounded border-2 border-green bg-green px-4 py-1.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={busy !== null}
                    onClick={() => void decide(entry, 'clear')}
                  >
                    [ 🟢 Approve & Add to Time Log ]
                  </button>
                  <Button variant="danger" disabled={busy !== null || open} aria-expanded={open} onClick={() => openReturn(entry)}>
                    [ 🔴 Reject & Return to Member ]
                  </Button>
                </div>
                {open ? (
                  <div
                    className="mt-3 flex flex-col gap-2 rounded border-2 border-brand-red p-3"
                    role="group"
                    aria-label={`Return ${entry.memberName}'s time report`}
                  >
                    <Field label={QUARANTINE_RETURN_REASON_LABEL} hint="The member sees this on their phone, fixes the hours and resubmits.">
                      {(id) => (
                        <Textarea
                          id={id}
                          required
                          autoFocus
                          aria-required="true"
                          maxLength={QUARANTINE_RETURN_REASON_MAX_LENGTH}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      )}
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="danger" disabled={busy !== null || !reason.trim()} onClick={() => void decide(entry, 'return')}>
                        Send back to member
                      </Button>
                      <Button variant="secondary" disabled={busy !== null} onClick={closeReturn}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
