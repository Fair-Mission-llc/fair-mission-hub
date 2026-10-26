'use client';
// Financial Management Center (Sprint 5Z-8): the council's general ledger at a glance for its Admins, every seated
// officer and any Super Admin (canReadGeneralLedger; the drivers: assertMayReadGeneralLedger). Three parts:
//   - Cash flow liquidity baffle gauges (buildLiquidityGauges): each bank account's cash beside what its virtual goals
//     reserve, leaving the true liquid operating cash, with every goal's progress toward its target.
//   - Balance sheet summary (finance.getLatestBalanceSheet): assets against liabilities and equity on a two-pan scale,
//     with the green '✓ Ledger Balanced (Zero Leaks)' badge when they agree to the penny.
//   - Quick-action hub: the electronic CSV bank audit (finance.uploadBankStatementReconciliation) and the asset transfer
//     drawer (finance.transferAssetFunds). Both post to the books, so they belong to the council's Financial Secretary
//     and Treasurer and any Super Admin (canPostGeneralLedger); other readers see why they are locked.
//   - Sprint 6A (Phase 5): the Membership Dues Revenue Forecast (Active and Inactive members times the council's
//     base_dues_rate, buildDuesForecast) and the Budgeted vs. Current Actual Spend grid (budget.getConcludedPerformance),
//     both summary cards (DuesParts). Read-only: neither posts to the books nor changes cash on hand.
//   - Sprint 6G Extension 2: the Budget Allocation & YOY Variance Analyzer (budget.getBudgetAnalysis, BudgetAnalyzerParts)
//     for the current fraternal year, with a what-if Target Spending Ceiling for the budget's editors. Read-only too.
//   - Sprint 6M: the Target Spending Ceiling is saved with the year's budget (budget.setTargetSpendingCeiling), and the
//     Council Balance Sheet & Equity Ledger card (finance.getCouncilNetWorth, NetWorthParts) states the council's true net
//     worth: liquid cash plus equipment at cost, less approved expense reports not yet paid. The Semiannual Trustee Audit
//     Desk (/finance/audit) is linked from the title bar.
//   - Sprint 6Q: the '💰 Log Concluded Event Revenues' card (finance.logConcludedRevenue, RevenueParts) lets the
//     Treasurer (or a Super Admin; canLogConcludedRevenue) post what a past event or an activity raised straight into the
//     ledger. The Treasurer Ledger Audit Desk (/finance/treasurer-desk) is linked from the title bar.
//   - Sprint 10 Revision 3.0: the Log Concluded Event Revenues card and the bank statement table are gone from this
//     page. Lump-sum revenue and corrected cash bag counts are posted from the Treasurer Desk's batch coder (the
//     Lump-Sum Financial Override row, CashAuditParts); bank statements are matched in the Treasurer Desk's Bank
//     Statement Match-Window. The quick-action hub keeps only the asset transfer drawer.
//   - Sprint 11 Revision 2.0: the Membership Dues Revenue Forecast and the Budget Allocation & YOY Variance Analyzer are
//     gone from this page. Budgeted vs. Current Actual Spend is a closed drawer (FinanceDrawer); its grid loads only once
//     the drawer is opened.
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { buildLiquidityGauges, canOpenTreasurerDesk, canPostGeneralLedger } from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { BalanceScale, LiquidityGaugeCard, TransferDrawer } from '@/components/FinanceParts';
import { NetWorthCard } from '@/components/NetWorthParts';
import { ConcludedPerformanceGrid } from '@/components/DuesParts';
import { Button, Empty, Notice, PageTitle, Panel } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** Sprint 11 Revision 2.0: a closed drawer of the Financial Management Center; the body mounts only while it is open. */
function FinanceDrawer({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="group rounded border-2 border-navy bg-white" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center gap-3 border-l-8 border-gold px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="font-bold text-navy motion-safe:transition-transform group-open:rotate-90">
          ›
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-serif text-lg font-bold leading-tight">{title}</span>
          <span className="text-xs text-muted">{summary}</span>
        </span>
      </summary>
      {open ? <div className="border-t border-line p-4">{children}</div> : null}
    </details>
  );
}

/** The drawer's body: the concluded events and meetings against their budget lines. */
function ConcludedPerformance({ actorId, councilId }: { actorId: number; councilId: number }) {
  const concluded = useLoad(() => db.budget.getConcludedPerformance(actorId, councilId), [actorId, councilId]);
  if (concluded.error) return <Notice tone="error">{concluded.error}</Notice>;
  return concluded.data ? <ConcludedPerformanceGrid performance={concluded.data} /> : <p className="text-sm">Loading…</p>;
}

function FinanceDashboard() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const chart = useLoad(() => db.finance.listChartOfAccounts(user.memberId, councilId), [user.memberId, councilId]);
  const sheet = useLoad(() => db.finance.getLatestBalanceSheet(user.memberId, councilId), [user.memberId, councilId]);
  const worth = useLoad(() => db.finance.getCouncilNetWorth(user.memberId, councilId), [user.memberId, councilId]);
  const [transferring, setTransferring] = useState(false);
  const canPost = canPostGeneralLedger(user, councilId);
  const reload = async () => {
    await Promise.all([chart.reload(), sheet.reload(), worth.reload()]);
  };
  const gauges = chart.data ? buildLiquidityGauges(chart.data) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <CouncilSelect scope={scope} />
            <Link href="/finance/ledger" className="text-sm font-bold underline">
              General ledger
            </Link>
            <Link href="/finance/balance-sheet" className="text-sm font-bold underline">
              Full balance sheet
            </Link>
            <Link href="/finance/audit" className="text-sm font-bold underline">
              Trustee audit desk
            </Link>
            {canOpenTreasurerDesk(user, councilId) ? (
              <Link href="/finance/treasurer-desk" className="text-sm font-bold underline">
                Treasurer desk
              </Link>
            ) : null}
          </div>
        }
      >
        Financial Management Center
      </PageTitle>
      {chart.error ? <Notice tone="error">{chart.error}</Notice> : null}
      {sheet.error ? <Notice tone="error">{sheet.error}</Notice> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Cash flow liquidity">
          {chart.loading && !chart.data ? (
            <p className="text-sm">Loading…</p>
          ) : gauges.length === 0 ? (
            <Empty>No bank account has virtual goals set aside inside it yet.</Empty>
          ) : (
            <div className="flex flex-col gap-8">
              {gauges.map((g) => (
                <LiquidityGaugeCard key={g.account.id} gauge={g} />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Balance sheet summary" actions={sheet.data ? <span className="text-xs text-muted">As of {formatFullDate(sheet.data.asOf)}</span> : undefined}>
          {sheet.data ? <BalanceScale sheet={sheet.data} /> : sheet.loading ? <p className="text-sm">Loading…</p> : null}
        </Panel>
      </div>

      {worth.error ? <Notice tone="error">{worth.error}</Notice> : null}
      {worth.data ? <NetWorthCard worth={worth.data} /> : worth.loading ? <p className="text-sm">Loading…</p> : null}

      <FinanceDrawer title="Budgeted vs. Current Actual Spend" summary="Concluded events and meetings of this fraternal year against their budget lines">
        <ConcludedPerformance actorId={user.memberId} councilId={councilId} />
      </FinanceDrawer>

      <Panel
        title="Quick actions"
        actions={
          canPost && chart.data ? (
            <Button variant="primary" onClick={() => setTransferring(true)}>
              Transfer between accounts
            </Button>
          ) : undefined
        }
      >
        {!canPost ? (
          <Notice tone="info">
            Posting transfers belongs to the council&apos;s Financial Secretary and Treasurer (and Super Admins). You can read every figure on this page.
          </Notice>
        ) : (
          <p className="text-sm">
            Lump-sum revenue and cash bag corrections are posted from the Treasurer Desk&apos;s batch coder; bank statements are matched in its Bank Statement
            Match-Window.
          </p>
        )}
      </Panel>

      {transferring && chart.data ? <TransferDrawer councilId={councilId} chart={chart.data} onClose={() => setTransferring(false)} onDone={reload} /> : null}
    </div>
  );
}

export default function FinanceDashboardPage() {
  return (
    <RequireArea area="finance/dashboard">
      <FinanceDashboard />
    </RequireArea>
  );
}
