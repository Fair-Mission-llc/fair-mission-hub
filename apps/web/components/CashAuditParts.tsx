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
//    Sprint 9 Revision 6.2: with the donations of one event selected, '⚖️ Override Event Split' opens a one-time share
//    table (SplitShareRows) that splits this posting in place of the line's master split; nothing is saved to the line.
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
  GL_SPLIT_ACCOUNT_LABEL,
  maySplitAccount,
  OVERRIDE_EVENT_SPLIT_LABEL,
  SELECT_ALL_UNCODED_LABEL,
  canLogConcludedRevenue,
  eventHasConcluded,
  journalPaymentOptions,
  lumpSumMethodChoices,
  LUMP_SUM_OVERRIDE_MODES,
  LUMP_SUM_OVERRIDE_TITLE,
  toIsoDate,
  type LumpSumOverrideMode,
  type GLAccount,
  type CashAuditRow,
  type SessionUser,
} from '@kofc/shared';
import { SplitShareRows, splitRowsOf, splitRowsToDestinations, type SplitRow } from '@/components/SplitShareRows';
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

/**
 * Sprint 10 Revision 3.0: the Lump-Sum Financial Override row (cash-audit.ts LUMP_SUM_OVERRIDE_MODES) - one corrected
 * cash bag count or one bulk electronic revenue block, posted in a single action through finance.logConcludedRevenue.
 * The council's Treasurer or a Super Admin (canLogConcludedRevenue; the drivers check again).
 */
function LumpSumOverrideRow({ user, councilId, revenueAccounts, depositAccount }: { user: SessionUser; councilId: number; revenueAccounts: readonly GLAccount[]; depositAccount: GLAccount | null }) {
  const today = toIsoDate(new Date());
  const sources = useLoad(async () => {
    const [events, activities, methods] = await Promise.all([db.events.listByCouncil(councilId), db.activities.listByCouncil(councilId), db.donations.listMethods(councilId)]);
    return {
      events: events.filter((e) => eventHasConcluded(e, today)).sort((a, b) => String(b.StartDate).localeCompare(String(a.StartDate))),
      activities,
      methods: journalPaymentOptions(methods),
    };
  }, [councilId, today]);
  const [mode, setMode] = useState<LumpSumOverrideMode>('cash-bag');
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [lineId, setLineId] = useState('');
  const [method, setMethod] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const choices = lumpSumMethodChoices(sources.data?.methods ?? [], mode);
  const methodValue = method || String(choices[0]?.method.id ?? '');
  const ready = source !== '' && amount.trim() !== '' && lineId !== '' && depositAccount !== null;

  const post = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const value = parseNumberField(amount, 'Amount');
      if (value === null) throw new Error('Enter the amount.');
      const m = /^(event|activity):(\d+)$/.exec(source);
      const label = LUMP_SUM_OVERRIDE_MODES.find((x) => x.id === mode)!.label;
      await db.finance.logConcludedRevenue(user.memberId, councilId, {
        LinkedEventID: m?.[1] === 'event' ? Number(m[2]) : null,
        LinkedActivityID: m?.[1] === 'activity' ? Number(m[2]) : null,
        Amount: value,
        RevenueAccountID: Number(lineId),
        DepositAccountID: depositAccount?.id ?? null,
        DateLogged: today,
        Description: `${label} (lump-sum override)`,
        payment_method_id: methodValue ? Number(methodValue) : null,
        CheckNumber: null,
      });
      setMessage({ tone: 'info', text: `Posted ${formatMoney(value)} as one ${label.toLowerCase()} to the ledger.` });
      setAmount('');
      setSource('');
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="lump-sum-override" className="flex flex-col gap-3 rounded border-2 border-gold border-l-8 p-3">
      <h3 id="lump-sum-override" className="font-serif text-base font-bold">
        {LUMP_SUM_OVERRIDE_TITLE}
      </h3>
      <p className="text-sm">
        Post a corrected cash bag count, or a block of electronic revenue taken outside the portal, in one action. It goes straight into the ledger as income
        {depositAccount ? <> deposited to {depositAccount.AccountName}</> : null}.
      </p>
      {sources.error ? <Notice tone="error">{sources.error}</Notice> : null}
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) void post();
        }}
      >
        <Field label="Override type">
          {(id) => (
            <Select
              id={id}
              value={mode}
              disabled={busy}
              onChange={(e) => {
                setMode(e.target.value as LumpSumOverrideMode);
                setMethod('');
              }}
            >
              {LUMP_SUM_OVERRIDE_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Event or activity">
          {(id) => (
            <Select id={id} value={source} required disabled={busy} onChange={(e) => setSource(e.target.value)}>
              <option value="">Choose a past event or an activity</option>
              {(sources.data?.events ?? []).map((e) => (
                <option key={e.id} value={`event:${e.id}`}>
                  {e.EventName} · {formatDate(String(e.StartDate).slice(0, 10))}
                </option>
              ))}
              {(sources.data?.activities ?? []).map((a) => (
                <option key={a.id} value={`activity:${a.id}`}>
                  {a.ActivityName}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Payment method">
          {(id) => (
            <Select id={id} value={methodValue} disabled={busy} onChange={(e) => setMethod(e.target.value)}>
              {choices.map((o) => (
                <option key={o.method.id} value={o.method.id}>
                  {o.method.DonationMethod}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Revenue GL line">
          {(id) => (
            <Select id={id} value={lineId} required disabled={busy} onChange={(e) => setLineId(e.target.value)}>
              <option value="">Choose the Revenue line</option>
              {revenueAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.AccountName}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Amount">
          {(id) => <Input id={id} inputMode="decimal" required value={amount} placeholder="0.00" disabled={busy} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        <Button type="submit" variant="gold" disabled={busy || !ready}>
          {busy ? 'Posting…' : 'Post override'}
        </Button>
      </form>
    </section>
  );
}

/** The Treasurer Desk's High-Volume Batch Transaction Coder. */
export function BatchTransactionCoder({ user, councilId }: { user: SessionUser; councilId: number }) {
  const view = useLoad(() => db.finance.getBatchCodingQueue(user.memberId, councilId), [user.memberId, councilId]);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [lineId, setLineId] = useState<number | null>(null);
  // Sprint 9 Revision 6.2: the one-time Event Split Override - its rows, or null while it is not in use.
  const [override, setOverride] = useState<SplitRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const mayCode = canBatchCodeDonations(user, councilId);
  const rows = view.data?.rows ?? [];
  const allIds = rows.map((r) => r.donation.id);
  const allSelected = rows.length > 0 && allIds.every((id) => selected.has(id));
  const picked = rows.filter((r) => selected.has(r.donation.id));
  const pickedTotal = picked.reduce((sum, r) => sum + Math.round(r.donation.DonationAmount * 100), 0) / 100;
  const splitProfiles = view.data?.splitProfiles ?? [];
  const splitIds = new Set(splitProfiles.map((p) => p.accountId));
  // The override works on one event's donations at a time (the event session envelope).
  const pickedEvents = new Set(picked.map((r) => r.donation.EventID ?? null));
  const overrideEvent = pickedEvents.size === 1 && !pickedEvents.has(null) ? picked[0]! : null;
  const overrideChoices = (view.data?.revenueAccounts ?? []).filter((a) => maySplitAccount(a) && !splitIds.has(a.id));
  const openOverride = () => setOverride(splitRowsOf(splitProfiles.find((p) => p.accountId === lineId)));

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
      const done = await db.finance.batchCodeDonations(user.memberId, councilId, {
        donationIds: picked.map((r) => r.donation.id),
        revenueAccountId: lineId,
        eventSplitOverride: override ? splitRowsToDestinations(override) : null,
      });
      setMessage({
        tone: 'info',
        text:
          `Coded ${done.count} donation${done.count === 1 ? '' : 's'} (${formatMoney(done.total)}) to ${done.revenueAccountName} as one posting.` +
          // Sprint 9 Revision 6.0: a Split Account's credit went to its destinations.
          (done.splits.length > 0
            ? ` ${done.overridden ? 'Event Split Override' : 'Split'}: ${done.splits.map((x) => `${formatMoney(x.amount)} to ${x.destinationAccountName}`).join(', ')}.`
            : ''),
      });
      setSelected(new Set());
      setOverride(null);
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
          {canLogConcludedRevenue(user, councilId) ? (
            <LumpSumOverrideRow user={user} councilId={councilId} revenueAccounts={view.data.revenueAccounts} depositAccount={view.data.depositAccount} />
          ) : null}
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
                          {splitIds.has(a.id) ? `${a.AccountName} (${GL_SPLIT_ACCOUNT_LABEL})` : a.AccountName}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {mayCode ? (
                  <Button
                    variant="secondary"
                    disabled={busy || lineId === null || overrideEvent === null}
                    onClick={() => (override ? setOverride(null) : openOverride())}
                    title={overrideEvent === null ? 'Select the donations of one event and a Revenue line first.' : undefined}
                  >
                    {override ? 'Cancel Event Split Override' : OVERRIDE_EVENT_SPLIT_LABEL}
                  </Button>
                ) : null}
                {mayCode ? (
                  <Button variant="gold" disabled={busy || picked.length === 0 || lineId === null} onClick={() => void code()}>
                    {busy ? 'Coding…' : `${BATCH_CODE_BUTTON_LABEL} (${picked.length} · ${formatMoney(pickedTotal)})`}
                  </Button>
                ) : null}
              </div>
              {override && overrideEvent ? (
                <section aria-labelledby="event-split-override" className="flex flex-col gap-3 rounded border-2 border-gold p-3">
                  <h3 id="event-split-override" className="font-serif text-base font-bold">
                    {OVERRIDE_EVENT_SPLIT_LABEL}: {overrideEvent.eventName}
                  </h3>
                  <p className="text-sm">
                    These shares split this one posting of {formatMoney(pickedTotal)} in place of the line&apos;s master split. They are not saved to the line;
                    the next batch uses the master rules again.
                  </p>
                  <SplitShareRows rows={override} onChange={setOverride} choices={overrideChoices} disabled={busy} />
                </section>
              ) : null}
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
