'use client';
// Sprint 8M Core - parametric parish splits (parish-split.ts). Three cards share one read, finance.getParishSplitConsole:
//  - (ParishSplitSettingsCard, the switch card on Council Wide Settings, was deleted in Sprint 10 Revision 3.1: revenue
//    splits are driven by the Chart of Accounts split profiles on the Treasurer Desk. The engine keeps the council's saved
//    split; councils.setParishSplitSettings remains in the drivers with no screen.)
//  - ParishSplitConsoleCard (Treasurer Desk): each event's live collections, the percentage share, what is already
//    requested and '[ 📋 Issue Church Disbursement Request ]', which holds the rest as a PENDING payment request against
//    the GL line for the Financial Secretary.
//  - ChurchDisbursementQueue (Financial Secretary Desk): the pending requests; the Financial Secretary types the check
//    number and clicks Record Payment Made, which posts the debit to the GL line and the credit to cash.
// Sprint 8O: an event with Revenue Held by Parish (electronic donations through PARISH-owned payment methods) shows the
// Revenue Held by Parish Settlement Notice under its row instead of the check-cutting steps, and its button becomes
// '[ ⛪ Log Parish-Held Settlement Credit ]': the defensive tracking credit, settled at once with no check and no posting.
// Only what the parish does not already hold goes on to the Financial Secretary as a check request.
import { Fragment, useState } from 'react';
import {
  canIssueChurchDisbursement,
  canPayChurchDisbursement,
  CHURCH_DISBURSEMENT_QUEUE_TITLE,
  describeError,
  ISSUE_CHURCH_DISBURSEMENT_LABEL,
  LOG_PARISH_HELD_CREDIT_LABEL,
  PARISH_HELD_NOTICE_TITLE,
  parishHeldNoticeText,
  PARISH_SPLIT_CONSOLE_TITLE,
  settlementMethodOf,
  RECORD_CHURCH_PAYMENT_LABEL,
  type ParishDisbursementDetail,
  type SessionUser,
} from '@kofc/shared';
import { Button, Empty, Input, Notice, Panel, Pill, Table, Td } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const percent = (n: number) => `${Number(n.toFixed(2))}%`;

function RequestRows({ rows }: { rows: readonly ParishDisbursementDetail[] }) {
  return (
    <Table caption="Church Disbursement Requests" head={['#', 'Event', 'Share', 'GL line', 'Issued by', 'Status']}>
      {rows.map((d) => (
        <tr key={d.request.id}>
          <Td>{d.request.id}</Td>
          <Td>{d.eventName}</Td>
          <Td>
            {formatMoney(d.request.amount)} ({percent(d.request.split_percentage)} of {formatMoney(d.request.gross_collections)})
          </Td>
          <Td>{d.glAccountName}</Td>
          <Td>{d.requestedByName}</Td>
          <Td>
            {settlementMethodOf(d.request) === 'PARISH_HELD' ? (
              <Pill tone="outline">Held by parish · no check</Pill>
            ) : d.request.status === 'PAID' ? (
              <Pill tone="navy">Paid · check {d.request.check_number}</Pill>
            ) : (
              <Pill tone="gold">Pending</Pill>
            )}
          </Td>
        </tr>
      ))}
    </Table>
  );
}

/** The Treasurer Desk card: split each event's live collections and issue the parish's payment request. */
export function ParishSplitConsoleCard({ user, councilId }: { user: SessionUser; councilId: number }) {
  const view = useLoad(() => db.finance.getParishSplitConsole(user.memberId, councilId), [user.memberId, councilId]);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const mayIssue = canIssueChurchDisbursement(user, councilId);
  const data = view.data;
  const on = data?.settings.parish_split_enabled === 1 && data.glLine !== null;

  const issue = async (eventId: number) => {
    setBusy(eventId);
    setMessage(null);
    try {
      const d = await db.finance.issueChurchDisbursementRequest(user.memberId, councilId, eventId);
      setMessage({
        tone: 'info',
        text:
          settlementMethodOf(d.request) === 'PARISH_HELD'
            ? `Tracking credit #${d.request.id} logged: the parish already holds ${formatMoney(d.request.amount)} of ${d.eventName}'s share, so no check is cut and nothing is posted.`
            : `Church Disbursement Request #${d.request.id} for ${formatMoney(d.request.amount)} is on the Financial Secretary Desk.`,
      });
      await view.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel title={PARISH_SPLIT_CONSOLE_TITLE}>
      {view.error ? <Notice tone="error">{view.error}</Notice> : null}
      {message ? (
        <div className="mb-3">
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        </div>
      ) : null}
      {data ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {on ? (
              <>
                The parish receives <strong>{percent(data.settings.parish_split_percentage)}</strong> of each fundraiser&apos;s live collections, charged to{' '}
                <strong>{data.glLine?.AccountName}</strong>.
              </>
            ) : (
              <>
                The parish split is off for this council. Revenue splits now come from the Chart of Accounts split profiles on the Treasurer Desk
                (Edit split on a Revenue account).
              </>
            )}
          </p>
          {data.events.length === 0 ? (
            <Empty>No event has collections to split yet.</Empty>
          ) : (
            <Table
              caption="Each event's live collections and the parish share"
              head={['Event', 'Collections', 'Held by parish', 'Parish share', 'Already settled', 'Check to request', '']}
            >
              {data.events.map((r) => (
                <Fragment key={r.eventId}>
                  <tr>
                    <Td>{r.eventName}</Td>
                    <Td>{formatMoney(r.grossCollections)}</Td>
                    <Td>{r.parishHeldCollections > 0 ? formatMoney(r.parishHeldCollections) : '–'}</Td>
                    <Td>{formatMoney(r.share)}</Td>
                    <Td>{formatMoney(r.alreadyRequested)}</Td>
                    <Td className="font-bold">{formatMoney(r.checkDue)}</Td>
                    <Td>
                      {mayIssue ? (
                        <Button size="sm" variant="gold" disabled={!on || r.nextSettlement === null || busy !== null} onClick={() => void issue(r.eventId)}>
                          {busy === r.eventId ? 'Logging…' : r.nextSettlement === 'PARISH_HELD' ? LOG_PARISH_HELD_CREDIT_LABEL : ISSUE_CHURCH_DISBURSEMENT_LABEL}
                        </Button>
                      ) : null}
                    </Td>
                  </tr>
                  {r.parishHeldCollections > 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 pb-3">
                        {/* Sprint 8O: the check-cutting steps are bypassed for what the parish already holds. */}
                        <div role="note" aria-label={PARISH_HELD_NOTICE_TITLE} className="rounded border-2 border-gold bg-gold/10 px-3 py-2 text-sm">
                          <p className="font-bold text-navy">⛪ {PARISH_HELD_NOTICE_TITLE}</p>
                          <p>{parishHeldNoticeText(r)}</p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </Table>
          )}
          {data.requests.length > 0 ? <RequestRows rows={data.requests} /> : null}
        </div>
      ) : view.loading ? (
        <p className="text-sm text-muted">Loading the parish split…</p>
      ) : null}
    </Panel>
  );
}

/** The Financial Secretary Desk card: pay each pending Church Disbursement Request by check. */
export function ChurchDisbursementQueue({ user, councilId }: { user: SessionUser; councilId: number }) {
  const view = useLoad(() => db.finance.getParishSplitConsole(user.memberId, councilId), [user.memberId, councilId]);
  const [checks, setChecks] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const mayPay = canPayChurchDisbursement(user, councilId);
  const pending = (view.data?.requests ?? []).filter((d) => d.request.status === 'PENDING');

  const pay = async (d: ParishDisbursementDetail) => {
    setBusy(d.request.id);
    setMessage(null);
    try {
      const paid = await db.finance.recordChurchDisbursementPayment(user.memberId, d.request.id, { CheckNumber: checks[d.request.id] ?? '' });
      setMessage({ tone: 'info', text: `Check ${paid.request.check_number} for ${formatMoney(paid.request.amount)} is recorded against ${paid.glAccountName}.` });
      await view.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel title={`${CHURCH_DISBURSEMENT_QUEUE_TITLE} (${pending.length})`}>
      {view.error ? <Notice tone="error">{view.error}</Notice> : null}
      {message ? (
        <div className="mb-3">
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        </div>
      ) : null}
      {view.data && pending.length === 0 ? <Empty>No Church Disbursement Request is waiting for a check.</Empty> : null}
      {pending.length > 0 ? (
        <Table caption="Church Disbursement Requests waiting for the Financial Secretary's check" head={['#', 'Event', 'Amount', 'GL line', 'Issued by', 'Check number', '']}>
          {pending.map((d) => (
            <tr key={d.request.id}>
              <Td>{d.request.id}</Td>
              <Td>{d.eventName}</Td>
              <Td className="font-bold">{formatMoney(d.request.amount)}</Td>
              <Td>{d.glAccountName}</Td>
              <Td>{d.requestedByName}</Td>
              <Td>
                <Input
                  aria-label={`Check number for request ${d.request.id}`}
                  value={checks[d.request.id] ?? ''}
                  onChange={(e) => setChecks((c) => ({ ...c, [d.request.id]: e.target.value }))}
                  disabled={!mayPay || busy !== null}
                  maxLength={50}
                  className="w-28"
                />
              </Td>
              <Td>
                {mayPay ? (
                  <Button size="sm" disabled={busy !== null || (checks[d.request.id] ?? '').trim() === '' || d.request.requested_by_member_id === user.memberId} onClick={() => void pay(d)}>
                    {busy === d.request.id ? 'Recording…' : RECORD_CHURCH_PAYMENT_LABEL}
                  </Button>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      ) : null}
    </Panel>
  );
}
