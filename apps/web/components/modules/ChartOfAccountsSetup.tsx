'use client';
// Sprint 8S Revision 10.4: the Treasurer Desk's '[ 🔧 Accounting Configuration ] › Chart of Accounts & GL Setup' folder.
// The council's chart of accounts (finance.listChartOfAccounts) as one grid per account type - Assets, Liabilities,
// Equity, Revenue, Expenses - with each account's posted debits, credits and balance, virtual goals indented under their
// bank account. An account name opens its full ledger (AccountLedgerDrawer). The platform has no account editor yet, so
// the grid is the Treasurer's review of the seeded chart; the Cash Over/Short line is added by the cash box audit when it
// is first needed.
import { useState } from 'react';
import { GL_ACCOUNT_TYPE_LABELS, GL_ACCOUNT_TYPES, type GLAccount } from '@kofc/shared';
import { AccountLedgerDrawer, flattenChart, Money } from '@/components/FinanceParts';
import { Empty, Notice, Pill, Table, Td } from '@/components/ui';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

export function ChartOfAccountsSetup({ memberId, councilId }: { memberId: number; councilId: number }) {
  const chart = useLoad(() => db.finance.listChartOfAccounts(memberId, councilId), [memberId, councilId]);
  const [drill, setDrill] = useState<GLAccount | null>(null);
  const nodes = flattenChart(chart.data);
  const assets = nodes.filter((n) => n.account.AccountType === 'Asset');

  return (
    <div className="flex flex-col gap-4">
      {chart.error ? <Notice tone="error">{chart.error}</Notice> : null}
      {chart.loading && !chart.data ? <p className="text-sm">Loading the chart of accounts…</p> : null}
      {chart.data && nodes.length === 0 ? <Empty>This council has no chart of accounts yet.</Empty> : null}
      {chart.data && nodes.length > 0 ? (
        <p className="text-sm">
          {nodes.length} accounts, {assets.length} of them asset lines. Expense coding on the Ledger Line Coder uses the Expense accounts below; each one
          also decides the budget line the sheet is charged to.
        </p>
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
                <Table caption={`${GL_ACCOUNT_TYPE_LABELS[type]} accounts`} head={['Account', 'Debits', 'Credits', 'Balance']}>
                  {rows.map((n) => (
                    <tr key={n.account.id}>
                      <Td>
                        <span style={{ paddingLeft: `${n.depth * 1.5}rem` }} className="inline-flex flex-wrap items-center gap-2">
                          {n.depth > 0 ? <span aria-hidden="true">↳</span> : null}
                          <button type="button" onClick={() => setDrill(n.account)} className="text-left font-bold underline" aria-label={`Open the ${n.account.AccountName} ledger`}>
                            {n.account.AccountName}
                          </button>
                          {n.account.IsVirtualGoal === 1 ? <Pill tone="gold">Virtual goal</Pill> : null}
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
                    </tr>
                  ))}
                </Table>
              </section>
            );
          })
        : null}
      {drill ? <AccountLedgerDrawer account={drill} onClose={() => setDrill(null)} /> : null}
    </div>
  );
}
