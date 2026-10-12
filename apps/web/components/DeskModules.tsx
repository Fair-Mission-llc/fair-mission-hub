'use client';
// Sprint 8L - Omnipresent Officer Desks: every advanced module an officer works in is mounted on the top of that
// officer's Active Desk, so no instruction sends anyone to the sidebar for it. A DeskModule is one folder on the desk:
// a closed <details> row naming the module, opened in place. Its body mounts only while it is open (each module reads
// its own data), inside EmbeddedModuleContext so the module's page title drops to a sub-heading. A folder shows only
// when the reader's role may open the module's portal area (portalAreas, with the council's feature flags and tenant
// type), so the desk never shows a module its page would refuse. The full page stays at its own route.
//
// Mounted folders (DESK_MODULES in officer-desks.ts names them for the manuals and tests):
//   Grand Knight Desk (and the Deputy's)  Charitable Grant Requests Vetting Board, Constitutional Advisor Panels,
//                                         Connected Councils
//   Financial Secretary Desk               Semiannual Audit Form 1295 Center, Charity Check Issuance Console
//   Treasurer Desk                         Annual Budget vs Actuals Ledger Grid, Bank Statement Match-Window
//   Recorder Desk                          Council Resolutions and Motions Ledger
//   Historian Desk                         Google Drive Media Gallery Sync Board
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  canManageBudgetForecast,
  canPostGeneralLedger,
  currentFraternalYear,
  fraternalYearBounds,
  portalAreaHref,
  portalAreas,
  type DeskModuleSpec,
  type SessionUser,
} from '@kofc/shared';
import { BudgetAnalyzerCard } from '@/components/BudgetAnalyzerParts';
import { ConcludedPerformanceGrid } from '@/components/DuesParts';
import { BankStatementUploader } from '@/components/FinanceParts';
import { MotionsLedger } from '@/components/MotionParts';
import { EmbeddedModuleContext, Notice } from '@/components/ui';
import { DeskRow } from '@/components/WorkspaceTabs';
import { useFeatureFlags, useTenantType } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** One module folder on an Active Desk; hidden when the reader may not open `spec.area`. */
export function DeskModule({ user, spec, children }: { user: SessionUser; spec: DeskModuleSpec; children: ReactNode }) {
  const features = useFeatureFlags();
  const tenantType = useTenantType();
  const [open, setOpen] = useState(false);
  if (!portalAreas(user, features, tenantType).includes(spec.area)) return null;
  return (
    <DeskRow id={spec.rowId} label={spec.title}>
      <details
        open={open}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="rounded border-2 border-navy bg-white open:border-l-8 open:border-l-gold"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2">
          <span className="font-serif text-lg font-bold">
            <span aria-hidden="true">{open ? '📂' : '📁'} </span>
            {spec.title}
          </span>
          <span className="text-xs text-muted">{open ? 'Click to fold away' : spec.summary}</span>
        </summary>
        {open ? (
          <div className="border-t-2 border-navy p-4">
            <EmbeddedModuleContext.Provider value={true}>{children}</EmbeddedModuleContext.Provider>
            <p className="mt-3 text-xs">
              <Link href={portalAreaHref(spec.area)} className="font-bold underline">
                Open {spec.title} as a full page
              </Link>
            </p>
          </div>
        ) : null}
      </details>
    </DeskRow>
  );
}

/** A desk's module folders, stacked at the top of the desk. */
export function DeskModuleShelf({ children }: { children: ReactNode }) {
  return (
    <div role="group" aria-label="Desk modules" className="flex flex-col gap-2">
      {children}
    </div>
  );
}

/**
 * The Treasurer's Annual Budget vs Actuals Ledger Grid: the Budgeted vs. Current Actual Spend grid of concluded events and
 * meetings (budget.getConcludedPerformance) over the Budget Allocation & YOY Variance Analyzer (budget.getBudgetAnalysis)
 * for the current fraternal year, the same two cards as the Financial Management Center.
 */
export function BudgetVsActualsModule({ user, councilId }: { user: SessionUser; councilId: number }) {
  const year = currentFraternalYear(new Date());
  const concluded = useLoad(() => db.budget.getConcludedPerformance(user.memberId, councilId), [user.memberId, councilId]);
  const analysis = useLoad(() => db.budget.getBudgetAnalysis(user.memberId, councilId, year), [user.memberId, councilId, year]);
  return (
    <div className="flex flex-col gap-4">
      {concluded.error ? <Notice tone="error">{concluded.error}</Notice> : null}
      {analysis.error ? <Notice tone="error">{analysis.error}</Notice> : null}
      {concluded.data ? <ConcludedPerformanceGrid performance={concluded.data} /> : concluded.loading ? <p className="text-sm">Loading…</p> : null}
      {analysis.data ? (
        <BudgetAnalyzerCard
          analysis={analysis.data}
          canSetCeiling={canManageBudgetForecast(user, councilId)}
          onSaveCeiling={async (ceiling) => {
            await db.budget.setTargetSpendingCeiling(user.memberId, councilId, year, ceiling);
            await analysis.reload();
          }}
        />
      ) : null}
    </div>
  );
}

/** The Treasurer's Bank Statement Match-Window: the electronic CSV bank audit (finance.uploadBankStatementReconciliation). */
export function BankStatementMatchWindow({ user, councilId }: { user: SessionUser; councilId: number }) {
  const chart = useLoad(() => db.finance.listChartOfAccounts(user.memberId, councilId), [user.memberId, councilId]);
  if (!canPostGeneralLedger(user, councilId)) {
    return <Notice tone="info">Matching bank statements belongs to the council&apos;s Financial Secretary and Treasurer (and Super Admins).</Notice>;
  }
  return (
    <div className="flex flex-col gap-2">
      {chart.error ? <Notice tone="error">{chart.error}</Notice> : null}
      {chart.data ? <BankStatementUploader councilId={councilId} chart={chart.data} onDone={() => chart.reload()} /> : chart.loading ? <p className="text-sm">Loading…</p> : null}
    </div>
  );
}

/** The Recorder's Council Resolutions and Motions Ledger for the current fraternal year. */
export function MotionsLedgerModule({ councilId }: { councilId: number }) {
  const { fromDate } = fraternalYearBounds(currentFraternalYear(new Date()));
  return <MotionsLedger councilId={councilId} fromDate={fromDate} />;
}
