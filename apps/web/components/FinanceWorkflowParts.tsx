'use client';
// Sprint 8S Revision 2: the Expense Report (ER) Workflow and Charitable Donation Workflow drawers of the Financial
// Secretary and Treasurer Desks (desk-workflows.ts), in the step-by-step layout of the Planning & Budgeting Workflow
// (WorkflowParts.tsx). Each drawer shows where the council's work stands at every step, marks the reader's own steps and
// mounts the modules that do that step in place:
//   ER Workflow        Financial Secretary: Payment Requests (sign the written order). Treasurer: the Ledger Line Coder
//                      and Expense Report (ER) Settlement (pay by check). Both: the ER Routing Track under them.
//   Donation Workflow  Financial Secretary: Charitable Donation Records (record each gift). Treasurer: the High-Volume
//                      Batch Transaction Coder and the Cash Box Audit Closure Panel.
// The action bar turns red with the desk's Alert Boundary Accent rule (erWorkflowAlert, donationWorkflowAlert).
import type { ReactNode } from 'react';
import {
  buildDonationWorkflow,
  buildExpenseWorkflow,
  donationWorkflowAlert,
  erWorkflowAlert,
  type ExpenseReportDetail,
  type FinanceWorkflowDesk,
  type SessionUser,
} from '@kofc/shared';
import { BatchTransactionCoder, CashBoxAuditPanel } from '@/components/CashAuditParts';
import { DonationsWorkspace as DonationRecords } from '@/components/modules/DonationRecords';
import { AuditQueue as ExpenseRoutingTrack } from '@/components/modules/ExpenseRoutingTrack';
import { DisbursementLedger as ExpenseSettlement } from '@/components/modules/ExpenseSettlement';
import { TreasurerDesk as LedgerLineCoder } from '@/components/modules/LedgerLineCoder';
import { AuditDesk as PaymentRequestDesk } from '@/components/modules/PaymentRequestDesk';
import { stepsWheel, WorkflowActionBar, WorkflowStepRow, WorkflowWheels } from '@/components/WorkflowParts';

/** One in-place step module under its step's name. */
function StepSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2 rounded border-2 border-navy border-l-8 border-l-gold bg-white p-3">
      <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
      {children}
    </section>
  );
}

/** The Expense Report (ER) Workflow drawer over the council queue the desk already polls (null while it loads). */
export function ExpenseReportWorkflow({ desk, user, queue }: { desk: FinanceWorkflowDesk; user: SessionUser; queue: readonly ExpenseReportDetail[] | null }) {
  const flow = buildExpenseWorkflow(desk, queue);
  return (
    <div className="flex flex-col gap-4">
      <WorkflowActionBar headline={flow.headline} alert={queue ? erWorkflowAlert(user, desk, queue) : false} />
      <WorkflowStepRow steps={flow.steps} label="Expense report steps" />
      <WorkflowWheels wheels={[stepsWheel(flow.steps, 'Steps clear')]} />
      {desk === 'financial-secretary' ? (
        <StepSection title="Your step: Payment request">
          <PaymentRequestDesk />
        </StepSection>
      ) : (
        <>
          <StepSection title="Your step: Ledger coding">
            <LedgerLineCoder />
          </StepSection>
          <StepSection title="Your step: Check issued">
            <ExpenseSettlement />
          </StepSection>
        </>
      )}
      <StepSection title="Every open sheet">
        <ExpenseRoutingTrack />
      </StepSection>
    </div>
  );
}

/** The Charitable Donation Workflow drawer; `uncoded` and `openCashBoxes` are null when the reader cannot read them. */
export function CharitableDonationWorkflow({
  desk,
  user,
  councilId,
  uncoded,
  openCashBoxes,
}: {
  desk: FinanceWorkflowDesk;
  user: SessionUser;
  councilId: number;
  uncoded: number | null;
  openCashBoxes: number | null;
}) {
  const flow = buildDonationWorkflow(desk, { uncoded, openCashBoxes });
  return (
    <div className="flex flex-col gap-4">
      <WorkflowActionBar headline={flow.headline} alert={donationWorkflowAlert(user, councilId, desk, flow.waiting)} />
      <WorkflowStepRow steps={flow.steps} label="Donation steps" />
      <WorkflowWheels wheels={[stepsWheel(flow.steps, 'Steps clear')]} />
      {desk === 'financial-secretary' ? (
        <StepSection title="Your step: Record the gift">
          <DonationRecords />
        </StepSection>
      ) : (
        <>
          <StepSection title="Your step: Code to revenue">
            <BatchTransactionCoder user={user} councilId={councilId} />
          </StepSection>
          <StepSection title="Your step: Close the cash box">
            <CashBoxAuditPanel user={user} councilId={councilId} />
          </StepSection>
        </>
      )}
    </div>
  );
}
