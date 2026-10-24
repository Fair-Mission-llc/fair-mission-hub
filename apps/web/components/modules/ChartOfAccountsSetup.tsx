'use client';
// Sprint 8S Revision 10.4: the Treasurer Desk's '[ 🔧 Accounting Configuration ] › Chart of Accounts & GL Setup' folder.
// The council's chart of accounts (finance.listChartOfAccounts) as one grid per account type - Assets, Liabilities,
// Equity, Revenue, Expenses - with each account's posted debits, credits and balance, virtual goals indented under their
// bank account. An account name opens its full ledger (AccountLedgerDrawer). The Cash Over/Short line is added by the
// cash box audit when it is first needed.
// Sprint 9 Revision 6.0 (schema 99): Split Accounts (gl-splits.ts). A split account carries a 'Split Account' tag and
// its destinations and shares under its name. The council's Treasurer (or a Super Admin) has an 'Edit split' button on
// each account that opens the editor below the grid: the Split Account switch, the destination accounts (same type)
// and each one's percentage, which must add up to 100 (finance.setGLSplitProfile). Coding donations to a split account
// on the batch coder then posts the shares to the destinations.
// Sprint 9 Revision 6.1: only Revenue rows carry 'Edit split' (maySplitAccount); Asset, Liability, Equity and Expense rows
// have no split controls. Every posting to a split account - manual entries, event revenue, batch coding - is shared out.
import { useState } from 'react';
import {
  canBatchCodeDonations,
  describeError,
  GL_ACCOUNT_TYPE_LABELS,
  GL_ACCOUNT_TYPES,
  GL_SPLIT_ACCOUNT_LABEL,
  GL_SPLIT_MAX_DESTINATIONS,
  isSplitAccount,
  maySplitAccount,
  type GLAccount,
  type GLSplitProfile,
} from '@kofc/shared';
import { AccountLedgerDrawer, flattenChart, Money } from '@/components/FinanceParts';
import { Button, Empty, Field, Input, Notice, Pill, Select, Table, Td } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

interface DraftRow {
  key: number;
  accountId: number | null;
  percentage: string;
}

/** The sum of the typed shares, to the cent of a percent; NaN while a share is not a number. */
const totalOf = (rows: readonly DraftRow[]) => rows.reduce((sum, r) => sum + Math.round(Number(r.percentage) * 100), 0) / 100;

function SplitEditor({
  account,
  accounts,
  profile,
  councilId,
  onSaved,
  onClose,
}: {
  account: GLAccount;
  accounts: GLAccount[];
  profile: GLSplitProfile | undefined;
  councilId: number;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const user = useUser();
  let nextKey = 0;
  const [splits, setSplits] = useState(isSplitAccount(account));
  const [rows, setRows] = useState<DraftRow[]>(() =>
    profile && profile.destinations.length > 0
      ? profile.destinations.map((d) => ({ key: nextKey++, accountId: d.destinationAccountId, percentage: String(d.percentage) }))
      : [
          { key: nextKey++, accountId: null, percentage: '' },
          { key: nextKey++, accountId: null, percentage: '' },
        ],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A destination is another account of the same type that is not itself split and not a virtual goal.
  const choices = accounts.filter((a) => a.id !== account.id && a.AccountType === account.AccountType && !isSplitAccount(a) && a.IsVirtualGoal !== 1);
  const total = totalOf(rows);

  const change = (key: number, patch: Partial<DraftRow>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await db.finance.setGLSplitProfile(
        user.memberId,
        councilId,
        account.id,
        splits
          ? { isSplitAccount: true, destinations: rows.map((r) => ({ destinationAccountId: r.accountId ?? 0, percentage: Number(r.percentage) })) }
          : { isSplitAccount: false },
      );
      await onSaved();
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="split-editor" className="flex flex-col gap-3 rounded border-2 border-gold bg-white p-4">
      <h3 id="split-editor" className="font-serif text-lg font-bold">
        Split profile: {account.AccountName}
      </h3>
      <label className="inline-flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={splits} onChange={(e) => setSplits(e.target.checked)} disabled={busy} />
        {GL_SPLIT_ACCOUNT_LABEL}: share every posting to this Revenue line out to the accounts below
      </label>
      {splits ? (
        <>
          {rows.map((r, i) => (
            <div key={r.key} className="flex flex-wrap items-end gap-3">
              <Field label={`Destination ${i + 1}`} className="min-w-56 flex-1">
                {(id) => (
                  <Select id={id} value={r.accountId ?? ''} onChange={(e) => change(r.key, { accountId: e.target.value === '' ? null : Number(e.target.value) })} disabled={busy}>
                    <option value="">Choose a {GL_ACCOUNT_TYPE_LABELS[account.AccountType].toLowerCase()} account</option>
                    {choices.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.AccountName}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Share (%)" className="w-28">
                {(id) => <Input id={id} inputMode="decimal" value={r.percentage} onChange={(e) => change(r.key, { percentage: e.target.value })} disabled={busy} />}
              </Field>
              <Button variant="secondary" size="sm" onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))} disabled={busy || rows.length <= 1}>
                Remove
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRows((all) => [...all, { key: Math.max(0, ...all.map((x) => x.key)) + 1, accountId: null, percentage: '' }])}
              disabled={busy || rows.length >= GL_SPLIT_MAX_DESTINATIONS}
            >
              Add destination
            </Button>
            <span className={Number.isFinite(total) && total === 100 ? 'text-sm font-bold' : 'text-sm font-bold text-brand-red'}>
              Total: {Number.isFinite(total) ? `${total}%` : '–'} (must be 100%)
            </span>
          </div>
        </>
      ) : (
        <p className="text-sm">Saving with the switch off makes {account.AccountName} an ordinary account again. Postings already made stay as they are.</p>
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save split profile'}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </section>
  );
}

export function ChartOfAccountsSetup({ memberId, councilId }: { memberId: number; councilId: number }) {
  const user = useUser();
  const chart = useLoad(() => db.finance.listChartOfAccounts(memberId, councilId), [memberId, councilId]);
  const profiles = useLoad(() => db.finance.listGLSplitProfiles(memberId, councilId), [memberId, councilId]);
  const [drill, setDrill] = useState<GLAccount | null>(null);
  const [editing, setEditing] = useState<GLAccount | null>(null);
  const nodes = flattenChart(chart.data);
  const assets = nodes.filter((n) => n.account.AccountType === 'Asset');
  const mayEdit = canBatchCodeDonations(user, councilId);
  const profileOf = (id: number) => profiles.data?.find((p) => p.accountId === id);

  return (
    <div className="flex flex-col gap-4">
      {chart.error ? <Notice tone="error">{chart.error}</Notice> : null}
      {profiles.error ? <Notice tone="error">{profiles.error}</Notice> : null}
      {chart.loading && !chart.data ? <p className="text-sm">Loading the chart of accounts…</p> : null}
      {chart.data && nodes.length === 0 ? <Empty>This council has no chart of accounts yet.</Empty> : null}
      {chart.data && nodes.length > 0 ? (
        <p className="text-sm">
          {nodes.length} accounts, {assets.length} of them asset lines. Expense coding on the Ledger Line Coder uses the Expense accounts below; each one
          also decides the budget line the sheet is charged to. A Revenue line may be a {GL_SPLIT_ACCOUNT_LABEL}: every posting to it is shared out to its destinations.
        </p>
      ) : null}
      {editing && chart.data && maySplitAccount(editing) ? (
        <SplitEditor
          key={editing.id}
          account={editing}
          accounts={nodes.map((n) => n.account)}
          profile={profileOf(editing.id)}
          councilId={councilId}
          onSaved={async () => {
            await Promise.all([chart.reload(), profiles.reload()]);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {chart.data
        ? GL_ACCOUNT_TYPES.map((type) => {
            const rows = nodes.filter((n) => n.account.AccountType === type);
            if (!rows.length) return null;
            return (
              <section key={type} aria-labelledby={`coa-${type}`} className="flex flex-col gap-2">
                <h3 id={`coa-${type}`} className="border-b-4 border-gold pb-1 font-serif text-lg font-bold">
                  {GL_ACCOUNT_TYPE_LABELS[type]}
                </h3>
                <Table caption={`${GL_ACCOUNT_TYPE_LABELS[type]} accounts`} head={['Account', 'Debits', 'Credits', 'Balance', ...(mayEdit && type === 'Revenue' ? [''] : [])]}>
                  {rows.map((n) => {
                    const profile = profileOf(n.account.id);
                    return (
                      <tr key={n.account.id}>
                        <Td>
                          <span style={{ paddingLeft: `${n.depth * 1.5}rem` }} className="inline-flex flex-wrap items-center gap-2">
                            {n.depth > 0 ? <span aria-hidden="true">↳</span> : null}
                            <button type="button" onClick={() => setDrill(n.account)} className="text-left font-bold underline" aria-label={`Open the ${n.account.AccountName} ledger`}>
                              {n.account.AccountName}
                            </button>
                            {n.account.IsVirtualGoal === 1 ? <Pill tone="gold">Virtual goal</Pill> : null}
                            {isSplitAccount(n.account) ? <Pill tone="navy">{GL_SPLIT_ACCOUNT_LABEL}</Pill> : null}
                          </span>
                          {profile && profile.destinations.length > 0 ? (
                            <span className="mt-1 block text-xs" style={{ paddingLeft: `${n.depth * 1.5}rem` }}>
                              Split: {profile.destinations.map((d) => `${d.percentage}% ${d.destinationAccountName}`).join(', ')}
                            </span>
                          ) : null}
                        </Td>
                        <Td className="text-right">
                          <Money value={n.debitTotal} />
                        </Td>
                        <Td className="text-right">
                          <Money value={n.creditTotal} />
                        </Td>
                        <Td className="text-right font-bold">
                          <Money value={n.balance} />
                        </Td>
                        {mayEdit && type === 'Revenue' ? (
                          <Td className="text-right">
                            {maySplitAccount(n.account) ? (
                              <Button variant="secondary" size="sm" onClick={() => setEditing(n.account)} aria-label={`Edit the split profile of ${n.account.AccountName}`}>
                                Edit split
                              </Button>
                            ) : null}
                          </Td>
                        ) : null}
                      </tr>
                    );
                  })}
                </Table>
              </section>
            );
          })
        : null}
      {drill ? <AccountLedgerDrawer account={drill} onClose={() => setDrill(null)} /> : null}
    </div>
  );
}
