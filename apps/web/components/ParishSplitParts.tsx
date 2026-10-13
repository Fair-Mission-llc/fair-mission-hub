'use client';
// Sprint 8M Core - parametric parish splits (parish-split.ts). Three cards share one read, finance.getParishSplitConsole:
//  - ParishSplitSettingsCard (System Settings > Council Wide Settings): the split's switch, the parish's percentage and the
//    GL line its share is charged to. The front-end gate: the moment the switch is on without a GL line, the card says so
//    and Save stays disabled (parishSplitGateMessage); the drivers refuse the same save (PARISH_SPLIT_GL_LINE_REQUIRED).
//  - ParishSplitConsoleCard (Treasurer Desk): each event's live collections, the percentage share, what is already
//    requested and '[ 📋 Issue Church Disbursement Request ]', which holds the rest as a PENDING payment request against
//    the GL line for the Financial Secretary.
//  - ChurchDisbursementQueue (Financial Secretary Desk): the pending requests; the Financial Secretary types the check
//    number and clicks Record Payment Made, which posts the debit to the GL line and the credit to cash.
import { useState } from 'react';
import {
  canIssueChurchDisbursement,
  canPayChurchDisbursement,
  CHURCH_DISBURSEMENT_QUEUE_TITLE,
  describeError,
  ISSUE_CHURCH_DISBURSEMENT_LABEL,
  PARISH_SPLIT_CONSOLE_TITLE,
  PARISH_SPLIT_SETTINGS_TITLE,
  parishSplitGateMessage,
  RECORD_CHURCH_PAYMENT_LABEL,
  type Council,
  type ParishDisbursementDetail,
  type SessionUser,
} from '@kofc/shared';
import { Button, Empty, Field, Input, Notice, Panel, Pill, Select, Switch, Table, Td } from '@/components/ui';
import { formatMoney, parseNumberField } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const percent = (n: number) => `${Number(n.toFixed(2))}%`;

/** The settings card on Council Wide Settings. */
export function ParishSplitSettingsCard({ user, council, onSaved }: { user: SessionUser; council: Council; onSaved: () => Promise<void> }) {
  const view = useLoad(() => db.finance.getParishSplitConsole(user.memberId, council.id), [user.memberId, council.id]);
  return (
    <Panel title={PARISH_SPLIT_SETTINGS_TITLE} className="mt-6">
      {view.error ? <Notice tone="error">{view.error}</Notice> : null}
      {view.data ? (
        <ParishSplitSettingsForm
          key={`${council.id}-${view.data.settings.parish_split_enabled}-${view.data.settings.parish_split_percentage}-${view.data.settings.parish_split_gl_line_id}`}
          user={user}
          council={council}
          initial={view.data.settings}
          lines={view.data.lineOptions.map((a) => ({ id: a.id, name: a.AccountName }))}
          onSaved={async () => {
            await Promise.all([view.reload(), onSaved()]);
          }}
        />
      ) : view.loading ? (
        <p className="text-sm text-muted">Loading the parish split…</p>
      ) : null}
    </Panel>
  );
}

function ParishSplitSettingsForm({
  user,
  council,
  initial,
  lines,
  onSaved,
}: {
  user: SessionUser;
  council: Council;
  initial: { parish_split_enabled: number; parish_split_percentage: number; parish_split_gl_line_id: number | null };
  lines: { id: number; name: string }[];
  onSaved: () => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(initial.parish_split_enabled === 1);
  const [percentage, setPercentage] = useState(String(initial.parish_split_percentage));
  const [lineId, setLineId] = useState<number | null>(initial.parish_split_gl_line_id);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  // The front-end gate: on without a GL line is never saved.
  const gate = parishSplitGateMessage(enabled, lineId);

  const save = async () => {
    setMessage(null);
    let pct: number | null;
    try {
      pct = parseNumberField(percentage, 'Parish share');
    } catch (err) {
      return setMessage({ tone: 'error', text: describeError(err) });
    }
    if (pct === null) return setMessage({ tone: 'error', text: 'Enter the parish share as a percentage, e.g. 50.' });
    if (gate) return setMessage({ tone: 'error', text: gate });
    setBusy(true);
    try {
      const saved = await db.councils.setParishSplitSettings(user.memberId, council.id, { enabled, percentage: pct, glLineId: lineId });
      await onSaved();
      setMessage({ tone: 'info', text: `Saved for council ${saved.CouncilNumber}. The split is ${saved.parish_split_enabled === 1 ? 'on' : 'off'}.` });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        When the parish is owed a share of a fundraiser (for example the parking lot), the Treasurer splits each event&apos;s collections on the Treasurer Desk
        and the Financial Secretary pays the parish&apos;s share by check.
      </p>
      <Switch
        checked={enabled}
        disabled={busy}
        onChange={setEnabled}
        label={enabled ? 'The parish split is on' : 'The parish split is off'}
        description="Switching it on needs a general ledger line for the parish's share."
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Parish share (%)" hint="From 0.01 to 100. Default 50.">
          {(id) => <Input id={id} inputMode="decimal" value={percentage} onChange={(e) => setPercentage(e.target.value)} disabled={busy} />}
        </Field>
        <Field label="General ledger line for the parish share" hint="An expense line of your council's chart of accounts.">
          {(id) => (
            <Select id={id} value={lineId ?? ''} onChange={(e) => setLineId(e.target.value === '' ? null : Number(e.target.value))} disabled={busy}>
              <option value="">Choose the GL line</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {gate ? <Notice tone="error">{gate}</Notice> : null}
      <div>
        <Button onClick={() => void save()} disabled={busy || gate !== null}>
          {busy ? 'Saving…' : 'Save parish split'}
        </Button>
      </div>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </div>
  );
}

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
          <Td>{d.request.status === 'PAID' ? <Pill tone="navy">Paid · check {d.request.check_number}</Pill> : <Pill tone="gold">Pending</Pill>}</Td>
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
      setMessage({ tone: 'info', text: `Church Disbursement Request #${d.request.id} for ${formatMoney(d.request.amount)} is on the Financial Secretary Desk.` });
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
              <>The parish split is off. An officer switches it on and picks its GL line under System Settings: Council Wide Settings.</>
            )}
          </p>
          {data.events.length === 0 ? (
            <Empty>No event has collections to split yet.</Empty>
          ) : (
            <Table caption="Each event's live collections and the parish share" head={['Event', 'Collections', 'Parish share', 'Already requested', 'To request', '']}>
              {data.events.map((r) => (
                <tr key={r.eventId}>
                  <Td>{r.eventName}</Td>
                  <Td>{formatMoney(r.grossCollections)}</Td>
                  <Td>{formatMoney(r.share)}</Td>
                  <Td>{formatMoney(r.alreadyRequested)}</Td>
                  <Td className="font-bold">{formatMoney(r.available)}</Td>
                  <Td>
                    {mayIssue ? (
                      <Button size="sm" variant="gold" disabled={!on || r.available <= 0 || busy !== null} onClick={() => void issue(r.eventId)}>
                        {busy === r.eventId ? 'Issuing…' : ISSUE_CHURCH_DISBURSEMENT_LABEL}
                      </Button>
                    ) : null}
                  </Td>
                </tr>
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
