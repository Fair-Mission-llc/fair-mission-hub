'use client';
// Sprint 8N - high-volume batch coding and cash box audit closures (cash-audit.ts). Two Treasurer Desk cards:
//  - CashBoxAuditPanel: the variance metrics above the fold (events awaiting the count, their logged cash, the net
//    over/short so far), then each event's logged cash with an input for the paper currency counted. The variance is
//    worked out as the Treasurer types; a difference needs a reason. 'Close cash audit & lock' stores the count, posts the
//    Over/Short Reconciliation Line (finance.closeCashAudit) and locks the event's logs. The phone's Donation rows stay as
//    they were logged.
//  - BatchTransactionCoder: the un-coded electronic (card and QR-code) donations in one grid, with
//    '[✓ Select All Un-coded Transactions]', a checkbox per row and one Revenue line drop-down. The selected donations are
//    coded in a single group action (finance.batchCodeDonations), which posts one balanced transaction for the batch.
// The Treasurer (or a Super Admin) acts; the other general ledger readers see the same cards read-only.
import { useState } from 'react';
import {
  BATCH_CODE_BUTTON_LABEL,
  BATCH_CODER_TITLE,
  canBatchCodeDonations,
  canCloseCashAudit,
  CASH_AUDIT_PANEL_TITLE,
  CASH_OVER_SHORT_ACCOUNT_NAME,
  cashVariance,
  CLOSE_CASH_AUDIT_LABEL,
  describeCashVariance,
  describeError,
  formatDate,
  SELECT_ALL_UNCODED_LABEL,
  type CashAuditRow,
  type SessionUser,
} from '@kofc/shared';
import { Button, cx, Empty, Field, Input, Notice, Panel, Pill, Select, Table, Td } from '@/components/ui';
import { formatMoney, parseNumberField } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string } | null;

const varianceTone = (v: number) => (Math.round(v * 100) === 0 ? 'text-navy' : 'text-brand-red');

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col rounded border-2 border-navy bg-white px-3 py-2">
      <span className="text-xs font-bold uppercase">{label}</span>
      <span className={cx('text-2xl font-bold leading-tight', tone ?? 'text-navy')}>{value}</span>
    </div>
  );
}

const STATUS_PILL: Record<CashAuditRow['collectionStatus'], { tone: 'gold' | 'navy' | 'red'; text: string }> = {
  OPEN: { tone: 'gold', text: 'Session open' },
  CONCLUDED: { tone: 'red', text: 'Concluded · ready to count' },
  RECONCILED: { tone: 'navy', text: 'Reconciled' },
};

/** The Treasurer Desk's Cash Box Audit Closure Panel. */
export function CashBoxAuditPanel({ user, councilId }: { user: SessionUser; councilId: number }) {
  const view = useLoad(() => db.finance.getCashAuditBoard(user.memberId, councilId), [user.memberId, councilId]);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const mayClose = canCloseCashAudit(user, councilId);
  const data = view.data;
  const awaiting = (data?.rows ?? []).filter((r) => r.collectionStatus !== 'RECONCILED');
  const closed = (data?.rows ?? []).filter((r) => r.collectionStatus === 'RECONCILED');

  /** The typed count as dollars, null while blank, or the parse error. */
  const counted = (eventId: number): number | null | Error => {
    try {
      return parseNumberField(counts[eventId] ?? '', 'Counted cash');
    } catch (err) {
      return err instanceof Error ? err : new Error(String(err));
    }
  };

  const close = async (row: CashAuditRow) => {
    const value = counted(row.eventId);
    if (value instanceof Error) return setMessage({ tone: 'error', text: value.message });
    if (value === null) return setMessage({ tone: 'error', text: `Type the paper currency you counted for ${row.eventName}.` });
    setBusy(row.eventId);
    setMessage(null);
    try {
      const board = await db.finance.closeCashAudit(user.memberId, councilId, {
        eventId: row.eventId,
        verifiedCashAmount: value,
        discrepancyReason: reasons[row.eventId] ?? null,
      });
      const done = board.rows.find((r) => r.eventId === row.eventId);
      const variance = done?.variance ?? 0;
      setMessage({
        tone: 'info',
        text:
          Math.round(variance * 100) === 0
            ? `${row.eventName} is reconciled: the count matched the logs. Its logs are locked.`
            : `${row.eventName} is reconciled (${describeCashVariance(variance)}). The Over/Short Reconciliation Line is posted to ${CASH_OVER_SHORT_ACCOUNT_NAME}; the logs are locked.`,
      });
      await view.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel title={CASH_AUDIT_PANEL_TITLE}>
      {view.error ? <Notice tone="error">{view.error}</Notice> : null}
      {data ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="Cash variance metrics">
            <Metric label="Events awaiting the count" value={String(data.metrics.awaitingCount)} tone={data.metrics.awaitingCount ? 'text-brand-red' : undefined} />
            <Metric label="Logged cash to verify" value={formatMoney(data.metrics.awaitingLoggedCash)} />
            <Metric label="Concluded on a phone" value={String(data.metrics.concludedAwaitingCount)} />
            <Metric label="Net over / short" value={describeCashVariance(data.metrics.netVariance)} tone={varianceTone(data.metrics.netVariance)} />
          </div>
          {message ? (
            <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
              {message.text}
            </Notice>
          ) : null}
          <p className="text-sm">
            Count the paper currency from the event&apos;s cash box and type the total. The difference from the cash the phones logged is posted as the
            Over/Short Reconciliation Line; the phone logs themselves never change.
          </p>
          {awaiting.length === 0 ? (
            <Empty>No event&apos;s cash box is waiting for a count.</Empty>
          ) : (
            <Table caption="Cash boxes waiting for the Treasurer's count" head={['Event', 'Session', 'Logged cash', 'Counted cash', 'Variance', 'Reason for a difference', '']}>
              {awaiting.map((r) => {
                const value = counted(r.eventId);
                const variance = typeof value === 'number' ? cashVariance(r.loggedCash, value) : null;
                const needsReason = variance !== null && Math.round(variance * 100) !== 0 && (reasons[r.eventId] ?? '').trim() === '';
                return (
                  <tr key={r.eventId}>
                    <Td>
                      <span className="font-bold">{r.eventName}</span>
                      <br />
                      <span className="text-xs">
                        {formatDate(r.startDate)}
                        {r.endDate !== r.startDate ? ` – ${formatDate(r.endDate)}` : ''}
                      </span>
                    </Td>
                    <Td>
                      <Pill tone={STATUS_PILL[r.collectionStatus].tone}>{STATUS_PILL[r.collectionStatus].text}</Pill>
                      {r.concludedByName ? <span className="block text-xs">by {r.concludedByName}</span> : null}
                    </Td>
                    <Td>
                      {formatMoney(r.loggedCash)}
                      <span className="block text-xs">
                        {r.cashDonationCount} cash log{r.cashDonationCount === 1 ? '' : 's'}
                      </span>
                    </Td>
                    <Td>
                      <Input
                        aria-label={`Counted cash for ${r.eventName}`}
                        inputMode="decimal"
                        placeholder="0.00"
                        value={counts[r.eventId] ?? ''}
                        onChange={(e) => setCounts((c) => ({ ...c, [r.eventId]: e.target.value }))}
                        disabled={!mayClose || busy !== null}
                        className="w-28"
                      />
                    </Td>
                    <Td className={cx('font-bold', variance === null ? '' : varianceTone(variance))}>{variance === null ? '–' : describeCashVariance(variance)}</Td>
                    <Td>
                      <Input
                        aria-label={`Reason for the difference at ${r.eventName}`}
                        value={reasons[r.eventId] ?? ''}
                        onChange={(e) => setReasons((c) => ({ ...c, [r.eventId]: e.target.value }))}
                        disabled={!mayClose || busy !== null}
                        maxLength={255}
                        placeholder={variance !== null && Math.round(variance * 100) !== 0 ? 'Required' : 'Only when it differs'}
                      />
                    </Td>
                    <Td>
                      {mayClose ? (
                        <Button size="sm" variant="gold" disabled={busy !== null || variance === null || needsReason} onClick={() => void close(r)}>
                          {busy === r.eventId ? 'Closing…' : CLOSE_CASH_AUDIT_LABEL}
                        </Button>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </Table>
          )}
          {closed.length > 0 ? (
            <Table caption="Closed cash box audits" head={['Event', 'Logged', 'Counted', 'Variance', 'Reason', 'Closed by']}>
              {closed.map((r) => (
                <tr key={r.eventId}>
                  <Td>{r.eventName}</Td>
                  <Td>{formatMoney(r.loggedCash)}</Td>
                  <Td>{formatMoney(r.verifiedCash ?? 0)}</Td>
                  <Td className={cx('font-bold', varianceTone(r.variance ?? 0))}>{describeCashVariance(r.variance ?? 0)}</Td>
                  <Td>{r.discrepancyReason ?? '–'}</Td>
                  <Td>
                    {r.verifiedByName}
                    {r.verifiedAt ? <span className="block text-xs">{formatDate(r.verifiedAt.slice(0, 10))}</span> : null}
                  </Td>
                </tr>
              ))}
            </Table>
          ) : null}
        </div>
      ) : view.loading ? (
        <p className="text-sm text-muted">Loading the cash box audits…</p>
      ) : null}
    </Panel>
  );
}

/** The Treasurer Desk's High-Volume Batch Transaction Coder. */
export function BatchTransactionCoder({ user, councilId }: { user: SessionUser; councilId: number }) {
  const view = useLoad(() => db.finance.getBatchCodingQueue(user.memberId, councilId), [user.memberId, councilId]);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [lineId, setLineId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const mayCode = canBatchCodeDonations(user, councilId);
  const rows = view.data?.rows ?? [];
  const allIds = rows.map((r) => r.donation.id);
  const allSelected = rows.length > 0 && allIds.every((id) => selected.has(id));
  const picked = rows.filter((r) => selected.has(r.donation.id));
  const pickedTotal = picked.reduce((sum, r) => sum + Math.round(r.donation.DonationAmount * 100), 0) / 100;

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const code = async () => {
    if (lineId === null) return setMessage({ tone: 'error', text: 'Choose the Revenue line for the selected donations.' });
    setBusy(true);
    setMessage(null);
    try {
      const done = await db.finance.batchCodeDonations(user.memberId, councilId, { donationIds: picked.map((r) => r.donation.id), revenueAccountId: lineId });
      setMessage({
        tone: 'info',
        text: `Coded ${done.count} donation${done.count === 1 ? '' : 's'} (${formatMoney(done.total)}) to ${done.revenueAccountName} as one posting.`,
      });
      setSelected(new Set());
      await view.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={`${BATCH_CODER_TITLE} (${rows.length})`}>
      {view.error ? <Notice tone="error">{view.error}</Notice> : null}
      {message ? (
        <div className="mb-3">
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        </div>
      ) : null}
      {view.data ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Card and QR-code gifts (Venmo, Zelle, Zeffy, ParishSoft) wait here until they are coded to a Revenue line. Un-coded total:{' '}
            <strong>{formatMoney(view.data.uncodedTotal)}</strong>
            {view.data.depositAccount ? <> · deposited to {view.data.depositAccount.AccountName}</> : null}.
          </p>
          {rows.length === 0 ? (
            <Empty>Every electronic donation is coded.</Empty>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    className="size-5 accent-navy"
                    checked={allSelected}
                    disabled={!mayCode || busy}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(allIds))}
                  />
                  {SELECT_ALL_UNCODED_LABEL}
                </label>
                <Field label="Revenue GL line for the selection">
                  {(id) => (
                    <Select id={id} value={lineId ?? ''} onChange={(e) => setLineId(e.target.value === '' ? null : Number(e.target.value))} disabled={!mayCode || busy}>
                      <option value="">Choose the Revenue line</option>
                      {view.data!.revenueAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.AccountName}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {mayCode ? (
                  <Button variant="gold" disabled={busy || picked.length === 0 || lineId === null} onClick={() => void code()}>
                    {busy ? 'Coding…' : `${BATCH_CODE_BUTTON_LABEL} (${picked.length} · ${formatMoney(pickedTotal)})`}
                  </Button>
                ) : null}
              </div>
              <Table caption="Un-coded electronic donations" head={['', 'Date', 'Method', 'Event', 'Donor / description', 'Amount']}>
                {rows.map((r) => (
                  <tr key={r.donation.id}>
                    <Td>
                      <input
                        type="checkbox"
                        aria-label={`Select donation ${r.donation.id}`}
                        className="size-5 accent-navy"
                        checked={selected.has(r.donation.id)}
                        disabled={!mayCode || busy}
                        onChange={() => toggle(r.donation.id)}
                      />
                    </Td>
                    <Td>{formatDate(r.donation.DonationDate)}</Td>
                    <Td>{r.methodName}</Td>
                    <Td>{r.eventName ?? 'Standalone'}</Td>
                    <Td>{[r.donation.Donor, r.donation.DonationDesciption].filter(Boolean).join(' · ') || '–'}</Td>
                    <Td className="font-bold">{formatMoney(r.donation.DonationAmount)}</Td>
                  </tr>
                ))}
              </Table>
            </>
          )}
        </div>
      ) : view.loading ? (
        <p className="text-sm text-muted">Loading the un-coded donations…</p>
      ) : null}
    </Panel>
  );
}
