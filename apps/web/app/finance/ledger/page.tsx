'use client';
// Transaction Ledger (Sprint 5Z-8): the council's chart of accounts (finance.listChartOfAccounts) as one table
// per account type - Assets, Liabilities, Equity, Revenue, Expenses - with each account's posted debits, credits and
// normal-side balance, virtual goals indented under their bank account. Every account name opens the drill-down drawer
// (finance.getAccountLedger): every line ever posted to it with its date, description, check number, linked event and
// running balance, and each line's whole multi-line posting. Same readers as the Financial Management Center
// (canReadGeneralLedger). Sprint 9 Revision 6.0: a Split Account carries a tag; the Treasurer edits its profile on the
// Treasurer Desk's Chart of Accounts & GL Setup folder.
// Sprint 11 Revision 16.0: titled '[ 📊 Chart of Accounts & General Ledger ]' (GENERAL_LEDGER_TITLE), with the
// '[ 💸 Transfer Funds ]' button for those who post to the books (canPostGeneralLedger); it opens TransferDrawer.
// Sprint 11 Revision 18.5: titled 'General Ledger'. The Financial Dashboard link and the Equity box are gone (Equity is
// read on the Balance Sheet). The ledger's posters get '[ Add Account ]' above the tables and Edit / Delete links on
// every row (finance.saveGLAccount, finance.removeGLAccount); a used account cannot be deleted and keeps its type.
import { useState, type FormEvent } from 'react';
import {
  ADD_GL_ACCOUNT_LABEL,
  canPostGeneralLedger,
  describeError,
  GENERAL_LEDGER_PAGE_TYPES,
  GENERAL_LEDGER_TITLE,
  GL_ACCOUNT_NAME_MAX_LENGTH,
  GL_ACCOUNT_TYPE_LABELS,
  GL_SPLIT_ACCOUNT_LABEL,
  TRANSFER_FUNDS_TITLE,
  type GLAccount,
  type GLAccountType,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Drawer } from '@/components/Drawer';
import { AccountLedgerDrawer, flattenChart, Money, TransferDrawer } from '@/components/FinanceParts';
import { Button, Empty, Field, Input, Notice, PageTitle, Pill, Select, Table, Td } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const NORMAL_SIDE: Record<GLAccountType, string> = {
  Asset: 'debit',
  Liability: 'credit',
  Equity: 'credit',
  Revenue: 'credit',
  Expense: 'debit',
};

/** The Add Account / Edit Account drawer. `account` null adds a new top-level account. */
function AccountEditorDrawer({ councilId, account, onClose, onSaved }: { councilId: number; account: GLAccount | null; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const user = useUser();
  const [name, setName] = useState(account?.AccountName ?? '');
  const [type, setType] = useState<GLAccountType>(account?.AccountType ?? 'Expense');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await db.finance.saveGLAccount(user.memberId, councilId, { id: account?.id ?? null, AccountName: name, AccountType: type });
      await onSaved();
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer title={account ? `Edit ${account.AccountName}` : ADD_GL_ACCOUNT_LABEL} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Field label="Account name">
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={GL_ACCOUNT_NAME_MAX_LENGTH} disabled={busy} required />}
        </Field>
        <Field label="Account type" hint={account ? 'A used account keeps its type; you can still rename it.' : undefined}>
          {(id) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as GLAccountType)} disabled={busy}>
              {GENERAL_LEDGER_PAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {GL_ACCOUNT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="submit" variant="gold" disabled={busy || !name.trim()}>
          {busy ? 'Saving…' : account ? 'Save account' : ADD_GL_ACCOUNT_LABEL}
        </Button>
      </form>
    </Drawer>
  );
}

function LedgerSpreadsheet() {
  const user = useUser();
  const scope = useCouncilScope();
  const chart = useLoad(() => db.finance.listChartOfAccounts(user.memberId, scope.councilId), [user.memberId, scope.councilId]);
  // Sprint 9 Revision 6.2: an account is a Split Account when it has destinations.
  const profiles = useLoad(() => db.finance.listGLSplitProfiles(user.memberId, scope.councilId), [user.memberId, scope.councilId]);
  const splitIds = new Set((profiles.data ?? []).map((p) => p.accountId));
  const [drill, setDrill] = useState<GLAccount | null>(null);
  const nodes = flattenChart(chart.data);
  const canPost = canPostGeneralLedger(user, scope.councilId);
  const [transferring, setTransferring] = useState(false);
  // Sprint 11 Revision 18.5: the account editor (undefined closed, null adding) and the row action message.
  const [editing, setEditing] = useState<GLAccount | null | undefined>(undefined);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const remove = async (account: GLAccount) => {
    if (!window.confirm(`Delete ${account.AccountName}? Only an unused account can be deleted.`)) return;
    setMessage(null);
    try {
      await db.finance.removeGLAccount(user.memberId, scope.councilId, account.id);
      await chart.reload();
      setMessage({ tone: 'info', text: `${account.AccountName} is deleted.` });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <CouncilSelect scope={scope} />
            {canPost && chart.data ? (
              <Button variant="gold" onClick={() => setTransferring(true)}>
                {TRANSFER_FUNDS_TITLE}
              </Button>
            ) : null}
            {canPost && chart.data ? (
              <Button variant="secondary" onClick={() => setEditing(null)}>
                {ADD_GL_ACCOUNT_LABEL}
              </Button>
            ) : null}
          </div>
        }
      >
        {GENERAL_LEDGER_TITLE}
      </PageTitle>
      {chart.error ? <Notice tone="error">{chart.error}</Notice> : null}
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      {chart.loading && !chart.data ? <p className="text-sm">Loading…</p> : null}
      {chart.data && nodes.length === 0 ? <Empty>This council has no chart of accounts yet.</Empty> : null}

      {chart.data
        ? GENERAL_LEDGER_PAGE_TYPES.map((type) => {
            const rows = nodes.filter((n) => n.account.AccountType === type);
            if (!rows.length) return null;
            // A group's total counts top-level accounts' rolled-up balances, so nested goals are not counted twice.
            const total = rows.filter((n) => n.depth === 0).reduce((sum, n) => sum + Math.round(n.rolledUpBalance * 100), 0) / 100;
            return (
              <section key={type} aria-labelledby={`ledger-${type}`} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-4 border-gold pb-1">
                  <h2 id={`ledger-${type}`} className="font-serif text-xl font-bold">
                    {GL_ACCOUNT_TYPE_LABELS[type]}
                  </h2>
                  <p className="text-sm">
                    Normal {NORMAL_SIDE[type]} balance · total <Money value={total} className="font-bold" />
                  </p>
                </div>
                <Table caption={`${GL_ACCOUNT_TYPE_LABELS[type]} accounts`} head={canPost ? ['Account', 'Debits', 'Credits', 'Balance', 'With sub-accounts', 'Actions'] : ['Account', 'Debits', 'Credits', 'Balance', 'With sub-accounts']}>
                  {rows.map((n) => (
                    <tr key={n.account.id}>
                      <Td>
                        <span style={{ paddingLeft: `${n.depth * 1.5}rem` }} className="inline-flex flex-wrap items-center gap-2">
                          {n.depth > 0 ? <span aria-hidden="true">↳</span> : null}
                          <button
                            type="button"
                            onClick={() => setDrill(n.account)}
                            className="text-left font-bold underline"
                            aria-label={`Open the ${n.account.AccountName} ledger`}
                          >
                            {n.account.AccountName}
                          </button>
                          {n.account.IsVirtualGoal === 1 ? <Pill tone="gold">Virtual goal</Pill> : null}
                          {splitIds.has(n.account.id) ? <Pill tone="navy">{GL_SPLIT_ACCOUNT_LABEL}</Pill> : null}
                        </span>
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
                      <Td className="text-right">{n.children.length ? <Money value={n.rolledUpBalance} /> : '–'}</Td>
                      {canPost ? (
                        <Td className="whitespace-nowrap">
                          <button type="button" onClick={() => setEditing(n.account)} className="mr-3 font-bold underline" aria-label={`Edit ${n.account.AccountName}`}>
                            Edit
                          </button>
                          <button type="button" onClick={() => void remove(n.account)} className="font-bold text-brand-red underline" aria-label={`Delete ${n.account.AccountName}`}>
                            Delete
                          </button>
                        </Td>
                      ) : null}
                    </tr>
                  ))}
                </Table>
              </section>
            );
          })
        : null}

      {transferring && chart.data ? (
        <TransferDrawer councilId={scope.councilId} chart={chart.data} onClose={() => setTransferring(false)} onDone={() => chart.reload()} />
      ) : null}
      {drill ? <AccountLedgerDrawer account={drill} onClose={() => setDrill(null)} /> : null}
      {editing !== undefined ? <AccountEditorDrawer councilId={scope.councilId} account={editing} onClose={() => setEditing(undefined)} onSaved={() => chart.reload()} /> : null}
    </div>
  );
}

export default function LedgerSpreadsheetPage() {
  return (
    <RequireArea area="finance/ledger">
      <LedgerSpreadsheet />
    </RequireArea>
  );
}
