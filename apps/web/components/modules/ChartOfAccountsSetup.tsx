'use client';
// Sprint 8S Revision 10.4: the Treasurer Desk's '[ 🔧 Accounting Configuration ] › Chart of Accounts & GL Setup' folder.
// The council's chart of accounts (finance.listChartOfAccounts) as one grid per account type - Assets, Liabilities,
// Equity, Revenue, Expenses - with each account's posted debits, credits and balance, virtual goals indented under their
// bank account. An account name opens its full ledger (AccountLedgerDrawer). The Cash Over/Short line is added by the
// cash box audit when it is first needed.
// Sprint 9 Revision 6.0 (schema 99): Split Accounts (gl-splits.ts). A split account carries a 'Split Account' tag and
// its destinations and shares under its name. The council's Treasurer (or a Super Admin) has an 'Edit split' button on
// each account that opens the editor below the grid: the destination accounts (same type)
// and each one's percentage, which must add up to 100 (finance.setGLSplitProfile). Coding donations to a split account
// on the batch coder then posts the shares to the destinations.
// Sprint 9 Revision 6.1: only Revenue rows carry 'Edit split' (maySplitAccount); Asset, Liability, Equity and Expense rows
// have no split controls. Every posting to a split account - manual entries, event revenue, batch coding - is shared out.
// Sprint 9 Revision 6.2: no Split Account switch. A line is a Split Account exactly when it has destinations (the
// profiles from finance.listGLSplitProfiles); the editor saves the destination rows, and none ends the split.
// Sprint 11 Revision 2.1 (schema 103): the editor also lists the council's ACTIVE affiliates (finance.listSplitSisterCouncils).
// A share sent to one posts to this council's 'Due to Sister Council' Liability clearing account - never to the other
// council's books. Asset rows carry a Parish tag when the account is parish-owned (ownership_type).
// Sprint 11 Revision 2.2: the tag shows for both shielded classifications, in the tenant's words (accountOwnershipLabel).
import { useState } from 'react';
import {
  accountOwnershipLabel,
  accountOwnershipOf,
  canBatchCodeDonations,
  isShieldedOwnership,
  describeError,
  GL_ACCOUNT_TYPE_LABELS,
  GL_ACCOUNT_TYPES,
  GL_SPLIT_ACCOUNT_LABEL,
  isSisterCouncilClearingAccount,
  maySplitAccount,
  type GLAccount,
  type GLSplitProfile,
  type SplitSisterCouncil,
} from '@kofc/shared';
import { AccountLedgerDrawer, flattenChart, Money } from '@/components/FinanceParts';
import { SplitShareRows, splitRowsOf, splitRowsToDestinations, type SplitRow } from '@/components/SplitShareRows';
import { Button, Empty, Notice, Pill, Table, Td } from '@/components/ui';
import { useTenantType, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

function SplitEditor({
  account,
  accounts,
  profile,
  splitIds,
  sisters,
  councilId,
  onSaved,
  onClose,
}: {
  account: GLAccount;
  /** Sprint 11 Revision 2.1: the council's ACTIVE affiliates a share may go to. */
  sisters: readonly SplitSisterCouncil[];
  accounts: GLAccount[];
  profile: GLSplitProfile | undefined;
  /** The accounts that are Split Accounts (they have destination rows). */
  splitIds: ReadonlySet<number>;
  councilId: number;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const user = useUser();
  const [rows, setRows] = useState<SplitRow[]>(() => splitRowsOf(profile, sisters));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A destination is another Revenue account that is not itself split and not a virtual goal.
  const choices = accounts.filter((a) => a.id !== account.id && maySplitAccount(a) && !splitIds.has(a.id));
  const destinations = splitRowsToDestinations(rows);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await db.finance.setGLSplitProfile(user.memberId, councilId, account.id, { destinations });
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
      <p className="text-sm">
        Every posting to {account.AccountName} is shared out to the accounts below. With one or more destinations the line is a {GL_SPLIT_ACCOUNT_LABEL}; save
        with no destinations to make it an ordinary line again. Postings already made stay as they are.
      </p>
      {sisters.length > 0 ? (
        <p className="text-sm">
          A share sent to an affiliated council is posted to this council&apos;s own &lsquo;Due to Sister Council&rsquo; liability account and paid out from there. Nothing
          is written to the other council&apos;s books.
        </p>
      ) : null}
      <SplitShareRows rows={rows} onChange={setRows} choices={choices} sisters={sisters} disabled={busy} />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : destinations.length > 0 ? 'Save split profile' : 'Save with no split'}
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
  const tenant = useTenantType();
  const chart = useLoad(() => db.finance.listChartOfAccounts(memberId, councilId), [memberId, councilId]);
  const profiles = useLoad(() => db.finance.listGLSplitProfiles(memberId, councilId), [memberId, councilId]);
  const sisters = useLoad(() => db.finance.listSplitSisterCouncils(memberId, councilId).catch(() => [] as SplitSisterCouncil[]), [memberId, councilId]);
  const [drill, setDrill] = useState<GLAccount | null>(null);
  const [editing, setEditing] = useState<GLAccount | null>(null);
  const nodes = flattenChart(chart.data);
  const assets = nodes.filter((n) => n.account.AccountType === 'Asset');
  const mayEdit = canBatchCodeDonations(user, councilId);
  const profileOf = (id: number) => profiles.data?.find((p) => p.accountId === id);
  // Sprint 9 Revision 6.2: a Split Account is one with destinations on disk.
  const splitIds = new Set((profiles.data ?? []).map((p) => p.accountId));

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
      {editing && chart.data && sisters.data && maySplitAccount(editing) ? (
        <SplitEditor
          key={editing.id}
          account={editing}
          accounts={nodes.map((n) => n.account)}
          profile={profileOf(editing.id)}
          splitIds={splitIds}
          sisters={sisters.data ?? []}
          councilId={councilId}
          onSaved={async () => {
            await Promise.all([chart.reload(), profiles.reload(), sisters.reload()]);
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
                            {splitIds.has(n.account.id) ? <Pill tone="navy">{GL_SPLIT_ACCOUNT_LABEL}</Pill> : null}
                            {isShieldedOwnership(n.account.ownership_type) ? <Pill tone="gold">{accountOwnershipLabel(accountOwnershipOf(n.account), tenant)}</Pill> : null}
                            {isSisterCouncilClearingAccount(n.account) ? <Pill tone="navy">Sister council clearing</Pill> : null}
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
