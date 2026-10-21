'use client';
// Sprint 8S Revision 2: the Expense Report (ER) Workflow and Charitable Donation Workflow drawers of the Financial
// Secretary and Treasurer Desks (desk-workflows.ts), in the step-by-step layout of the Planning & Budgeting Workflow
// (WorkflowParts.tsx). Each drawer shows where the council's work stands at every step, marks the reader's own steps and
// mounts the modules that do that step in place:
//   ER Workflow        Financial Secretary: Payment Requests (sign the written order). Treasurer: the Ledger Line Coder
//                      and Expense Report (ER) Settlement (pay by check). Both: the ER Routing Track under them.
//   Donation Workflow  Sprint 8S Revision 3: OUTGOING charity money (charity-pipeline.ts), on the FS, Treasurer and GK
//                      Desks - Member Charity Request, FS/GK Compliance Endorsement (endorse in place), Treasurer Check
//                      Settlement (the Charity Check Issuance Console in place). Incoming gifts stay on the batch coder
//                      and cash box drawers.
// Sprint 8S Revision 10.6: both drawers sit in [ 📖 Reference Workflows ] and are read-only scoreboards. They mount no
// module, form or button and their action bar never turns red; each step names the working folder where the reader
// acts. The endorse button lives in CharityEndorsementDesk, the 'FS/GK Compliance Endorsements' working folder.
import { useState, type ReactNode } from 'react';
import {
  buildCharityPipeline,
  buildExpenseWorkflow,
  canEndorseCharityRequest,
  charityPipelineStage,
  CHARITY_ENDORSEMENT_FOLDER_TITLE,
  CHARITY_ENDORSEMENT_STEP_LABEL,
  CHARITY_REQUEST_STEP_LABEL,
  CHARITY_SETTLEMENT_STEP_LABEL,
  describeError,
  ENDORSE_CHARITY_REQUEST_LABEL,
  EXPENSE_WORKFLOW_WORK_FOLDERS,
  expenseWorkflowStepOf,
  type CharitableRequest,
  type CharitableRequestDetail,
  type CharityPipelineDesk,
  type CharityPipelineStage,
  type ExpenseReportDetail,
  type FinanceWorkflowDesk,
  type SessionUser,
} from '@kofc/shared';
import { Button, Empty, Notice, Table, Td } from '@/components/ui';
import { stepsWheel, WorkflowActionBar, WorkflowStepRow, WorkflowWheels } from '@/components/WorkflowParts';
import { formatMoney, formatPersonName } from '@/lib/format';
import { db } from '@/services/db';

/** One in-place step module under its step's name. */
function StepSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2 rounded border-2 border-navy border-l-8 border-l-gold bg-white p-3">
      <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
      {children}
    </section>
  );
}

/** The Expense Report (ER) Workflow drawer over the council queue the desk already polls (null while it loads): read only. */
export function ExpenseReportWorkflow({ desk, queue }: { desk: FinanceWorkflowDesk; user: SessionUser; queue: readonly ExpenseReportDetail[] | null }) {
  const flow = buildExpenseWorkflow(desk, queue);
  const open = (queue ?? []).flatMap((d) => {
    const step = expenseWorkflowStepOf(d);
    return step ? [{ d, step }] : [];
  });
  return (
    <div className="flex flex-col gap-4">
      <WorkflowActionBar headline={flow.headline} />
      <WorkflowStepRow steps={flow.steps} label="Expense report steps" />
      <WorkflowWheels wheels={[stepsWheel(flow.steps, 'Steps clear')]} />
      <StepSection title="Every open sheet">
        {queue === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : open.length === 0 ? (
          <Empty>No expense sheet is open. Every sheet is paid.</Empty>
        ) : (
          <Table caption="Every open expense sheet and the step it waits at, oldest first." head={['Sheet', 'Submitted by', 'Total', 'Waits at', 'Who acts']}>
            {open.map(({ d, step }) => (
              <tr key={d.report.id}>
                <Td className="font-bold">#{d.report.id}</Td>
                <Td>{formatPersonName(d.submitterFirstName, d.submitterLastName)}</Td>
                <Td className="whitespace-nowrap text-right font-bold">{formatMoney(d.total)}</Td>
                <Td>{step.label}</Td>
                <Td>{step.when}</Td>
              </tr>
            ))}
          </Table>
        )}
        <p className="text-xs text-muted">This folder is for reference. Do your own step in {EXPENSE_WORKFLOW_WORK_FOLDERS[desk]}.</p>
      </StepSection>
    </div>
  );
}

/** One request line of a pipeline step: organization, amount, Knight Shepherd and a note. */
function RequestLine({ detail, amount, note, children }: { detail: CharitableRequestDetail; amount: number; note: string; children?: ReactNode }) {
  const r = detail.request;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded border-2 border-line p-3">
      <div className="min-w-0">
        <p className="font-bold">
          #{r.id} · {r.OrganizationName} · {formatMoney(amount)}
        </p>
        <p className="text-sm text-muted">
          Knight Shepherd {formatPersonName(detail.shepherdFirstName, detail.shepherdLastName)} · {note}
        </p>
      </div>
      {children}
    </li>
  );
}

/** The endorse button of one approved request. */
function EndorseButton({ user, request, onChanged }: { user: SessionUser; request: CharitableRequest; onChanged: (text: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (request.ShepherdMemberID === user.memberId) return <span className="text-sm text-muted">You shepherd this request, so another officer endorses it.</span>;
  const endorse = async () => {
    setBusy(true);
    setError(null);
    try {
      await db.charities.endorseApprovedRequest(user.memberId, request.id);
      await onChanged(`Request #${request.id} (${request.OrganizationName}) is endorsed for payment. It now waits for the Treasurer's check.`);
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="gold" disabled={busy} onClick={() => void endorse()}>
        {busy ? 'Endorsing…' : ENDORSE_CHARITY_REQUEST_LABEL}
      </Button>
      {error ? <span className="text-sm text-brand-red">{error}</span> : null}
    </div>
  );
}

/**
 * Sprint 8S Revision 10.6: the 'FS/GK Compliance Endorsements' working folder on the Grand Knight and Financial Secretary
 * Desks - the approved requests waiting for their compliance endorsement, each with the endorse button.
 */
export function CharityEndorsementDesk({
  user,
  councilId,
  requests,
  error,
  onChanged,
}: {
  user: SessionUser;
  councilId: number;
  requests: readonly CharitableRequestDetail[] | null;
  error: string | null;
  onChanged: () => Promise<unknown>;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const toEndorse = (requests ?? []).filter((d) => charityPipelineStage(d.request) === 'endorsement');
  const mayEndorse = canEndorseCharityRequest(user, councilId);
  const changed = async (text: string) => {
    setMessage(text);
    await onChanged();
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        After the council votes a grant, the Financial Secretary, Grand Knight or Deputy Grand Knight endorses it here. The Treasurer then pays it by check.
      </p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? (
        <Notice tone="info" onDismiss={() => setMessage(null)}>
          {message}
        </Notice>
      ) : null}
      <StepSection title={CHARITY_ENDORSEMENT_STEP_LABEL}>
        {requests === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : toEndorse.length === 0 ? (
          <Empty>No approved request waits for its compliance endorsement.</Empty>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Approved requests waiting for the FS/GK compliance endorsement">
            {toEndorse.map((d) => (
              <RequestLine key={d.request.id} detail={d} amount={d.request.AmountApproved} note="Approved by the council's vote">
                {mayEndorse ? <EndorseButton user={user} request={d.request} onChanged={changed} /> : <span className="text-sm text-muted">Waiting for the FS or GK</span>}
              </RequestLine>
            ))}
          </ul>
        )}
      </StepSection>
    </div>
  );
}

const voteNote = (r: CharitableRequest) =>
  r.RequestStatus === 'Advanced' ? 'Vetted; waiting for the council vote' : r.RequestStatus === 'Claimed by Trustee' ? 'Being vetted' : 'Waiting for a vetter';

/**
 * Sprint 8S Revision 3: the Charitable Donation Workflow drawer tracks OUTGOING charity money (charity-pipeline.ts) on
 * the Financial Secretary, Treasurer and Grand Knight Desks: [ 📋 Member Charity Request ] (from vetting to the vote),
 * [ ✍️ FS/GK Compliance Endorsement ] and [ ⛪ Treasurer Check Settlement ]. Sprint 8S Revision 10.6: read only - the
 * endorse button is in the FS/GK Compliance Endorsements folder, the checks in the Charity Check Issuance Console and
 * Charitable Contribution Matches folders.
 */
export function CharityPipelineWorkflow({
  desk,
  requests,
  error,
}: {
  desk: CharityPipelineDesk;
  requests: readonly CharitableRequestDetail[] | null;
  error: string | null;
}) {
  const flow = buildCharityPipeline(desk, requests);
  const at = (stage: CharityPipelineStage) => (requests ?? []).filter((d) => charityPipelineStage(d.request) === stage);
  const inRequest = at('request');
  const toEndorse = at('endorsement');
  const toSettle = at('settlement');
  const approved = toEndorse.length + toSettle.length + (flow.paid ?? 0);
  const yours = (key: string) => (flow.steps.find((s) => s.key === key)?.yours ? `${key === 'settlement' ? CHARITY_SETTLEMENT_STEP_LABEL : CHARITY_ENDORSEMENT_STEP_LABEL} · Your step` : null);
  const settleFolder = desk === 'financial-secretary' ? 'Charity Check Issuance Console' : 'Charitable Contribution Matches';
  return (
    <div className="flex flex-col gap-4">
      <WorkflowActionBar headline={flow.headline} />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <WorkflowStepRow steps={flow.steps} label="Outgoing charity steps" />
      <WorkflowWheels
        wheels={[
          stepsWheel(flow.steps, 'Steps clear'),
          { label: 'Approved requests paid', value: flow.paid ?? 0, total: approved, caption: `${flow.paid ?? 0} of ${approved} approved requests` },
        ]}
      />
      <StepSection title={CHARITY_REQUEST_STEP_LABEL}>
        {inRequest.length === 0 ? (
          <Empty>No charity request is in vetting or waiting for the council&apos;s vote.</Empty>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Charity requests in vetting or waiting for the vote">
            {inRequest.map((d) => (
              <RequestLine key={d.request.id} detail={d} amount={d.request.AmountRequested} note={voteNote(d.request)} />
            ))}
          </ul>
        )}
      </StepSection>
      <StepSection title={yours('endorsement') ?? CHARITY_ENDORSEMENT_STEP_LABEL}>
        {toEndorse.length === 0 ? (
          <Empty>No approved request waits for its compliance endorsement.</Empty>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Approved requests waiting for the FS/GK compliance endorsement">
            {toEndorse.map((d) => (
              <RequestLine key={d.request.id} detail={d} amount={d.request.AmountApproved} note="Approved; waiting for the FS or GK endorsement" />
            ))}
          </ul>
        )}
        {desk !== 'treasurer' ? <p className="text-xs text-muted">Endorse in the {CHARITY_ENDORSEMENT_FOLDER_TITLE} folder.</p> : null}
      </StepSection>
      <StepSection title={yours('settlement') ?? CHARITY_SETTLEMENT_STEP_LABEL}>
        {toSettle.length === 0 ? (
          <Empty>No endorsed request waits for its check.</Empty>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Endorsed requests waiting for the Treasurer's check">
            {toSettle.map((d) => (
              <RequestLine key={d.request.id} detail={d} amount={d.request.AmountApproved} note="Endorsed; waiting for the Treasurer's check" />
            ))}
          </ul>
        )}
        {desk !== 'grand-knight' ? <p className="text-xs text-muted">Pay by check in the {settleFolder} folder.</p> : null}
      </StepSection>
    </div>
  );
}
