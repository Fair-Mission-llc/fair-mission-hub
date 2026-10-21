'use client';
// The Fraternal Planning & Budgeting Workflow (Sprints 8G/8H, planning-workflow.ts) on Council Wide Settings.
//
// FraternalPlanningWorkflow - a status banner for one fraternal year: Draft (May), Review (June), Lock (July 1) and the
// final budget vote (by July 10), the current step highlighted, with the goals' and the budget's DRAFT / REVIEWED /
// LOCKED status. Under it the year's Annual Council Goals: an editable form for their setters (the GK, DGK, Admins and
// Super Admins) until July 1, then read-only information blocks for good - the data service refuses every write
// (COUNCIL_GOALS_LOCKED). "Mark goals reviewed" (reports.markCouncilGoalsReviewed) and "Mark budget reviewed"
// (budget.markBudgetYearReviewed) record the June review; the vote itself stays on the budget page.
//
// Sprint 8S Revision 2: the banner is drawn with the shared workflow layout (WorkflowParts.tsx) - the highlighted action
// bar, the step row and a progress wheel - the same layout as the Council Election Workflow and the finance desks'
// Expense Report (ER) and Charitable Donation Workflows.
//
// Sprint 8S Revision 10.6: `readOnly` (the desks' Planning & Budgeting Workflow reference folder) hides every edit and
// review button; the goals are set and reviewed on Council Wide Settings.
//
// LoanerLibrarySharingCard - the council's Cross-Council Loaner Library switch (Council.is_loaner_library_enabled).
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  budgetPlanningStatusOf,
  buildPlanningWorkflow,
  canManageBudgetForecast,
  canSetCouncilGoals,
  COUNCIL_GOAL_KEYS,
  COUNCIL_GOAL_LABELS,
  currentFraternalYear,
  describeError,
  goalsPlanningStatusOf,
  LOANER_LIBRARY_HREF,
  loanerLibraryEnabled,
  PLANNING_STATUS_LABELS,
  upcomingFraternalYear,
  type Council,
  type CouncilGoalTargets,
  type PlanningStatus,
  type SessionUser,
} from '@kofc/shared';
import { GoalsForm } from '@/components/GoalsParts';
import { Button, Field, Notice, Panel, Pill, Select, Switch } from '@/components/ui';
import { stepsWheel, WorkflowActionBar, WorkflowStepRow, WorkflowWheels } from '@/components/WorkflowParts';
import { formatDecimalHours, formatFullDate, formatMoney } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const STATUS_TONE: Record<PlanningStatus, 'outline' | 'gold' | 'navy'> = { DRAFT: 'outline', REVIEWED: 'gold', LOCKED: 'navy' };
/** How far a status has come, for its wheel: Draft 0, Reviewed 1, Locked 2 (of 2). */
const PLANNING_STATUS_RANK: Record<PlanningStatus, number> = { DRAFT: 0, REVIEWED: 1, LOCKED: 2 };

function StatusPill({ status }: { status: PlanningStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{PLANNING_STATUS_LABELS[status]}</Pill>;
}

/** The year's six targets as read-only information blocks. */
function GoalTargetBlocks({ targets, spiritual }: { targets: CouncilGoalTargets; spiritual: boolean }) {
  const keys = COUNCIL_GOAL_KEYS.filter((k) => spiritual || !['rosaries_target', 'adorations_target', 'confessions_target'].includes(k));
  const show = (key: (typeof COUNCIL_GOAL_KEYS)[number]) =>
    key === 'fundraising_target' ? formatMoney(targets[key]) : key === 'hours_target' ? `${formatDecimalHours(targets[key])} h` : targets[key].toLocaleString('en-US');
  return (
    <dl className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {keys.map((key) => (
        <div key={key} className="rounded border border-line bg-white p-2">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">{COUNCIL_GOAL_LABELS[key]}</dt>
          <dd className="text-lg font-bold">{targets[key] > 0 ? show(key) : 'No target'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The banner and the year's goals and budget status. */
export function FraternalPlanningWorkflow({ user, council, readOnly = false }: { user: SessionUser; council: Council; readOnly?: boolean }) {
  const today = useMemo(() => new Date(), []);
  const years = useMemo(() => {
    const upcoming = upcomingFraternalYear(today);
    const current = currentFraternalYear(today);
    return upcoming === current ? [current] : [upcoming, current];
  }, [today]);
  const [year, setYear] = useState(years[0]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'goals' | 'budget' | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const goals = useLoad(() => db.reports.getCouncilGoals(user.memberId, council.id, year), [user.memberId, council.id, year]);
  const budget = useLoad(() => db.budget.listAnnualForecast(user.memberId, council.id, year), [user.memberId, council.id, year]);

  const g = goals.data;
  const goalsStatus: PlanningStatus = g ? g.planningStatus : goalsPlanningStatusOf(null, year, today);
  const budgetStatus = budgetPlanningStatusOf(budget.data?.lines ?? []);
  const flow = buildPlanningWorkflow({ fraternalYear: year, today, goalsStatus, budgetStatus });
  const setter = !readOnly && canSetCouncilGoals(user, council.id);
  const budgetEditor = !readOnly && canManageBudgetForecast(user, council.id);
  const targets = g ? (Object.fromEntries(g.metrics.map((m) => [m.key, m.target])) as CouncilGoalTargets) : null;
  const allTargets = targets ? ({ ...Object.fromEntries(COUNCIL_GOAL_KEYS.map((k) => [k, 0])), ...targets } as CouncilGoalTargets) : null;

  const run = async (which: 'goals' | 'budget') => {
    setBusy(which);
    setMessage(null);
    try {
      if (which === 'goals') {
        await db.reports.markCouncilGoalsReviewed(user.memberId, council.id, year);
        await goals.reload();
        setMessage({ tone: 'info', text: `The ${year} goals are marked reviewed.` });
      } else {
        await db.budget.markBudgetYearReviewed(user.memberId, council.id, year);
        await budget.reload();
        setMessage({ tone: 'info', text: `The ${year} budget is marked reviewed.` });
      }
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title="Annual Budget Planner"
      className="mb-6"
      actions={
        years.length > 1 ? (
          <Field label="Fraternal year" className="w-36">
            {(id) => (
              <Select
                id={id}
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setEditing(false);
                  setMessage(null);
                }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        <WorkflowActionBar headline={flow.headline} />
        <WorkflowStepRow steps={flow.steps} label="Planning steps" />
        <WorkflowWheels
          wheels={[
            stepsWheel(flow.steps),
            { label: 'Goals', value: PLANNING_STATUS_RANK[goalsStatus], total: 2, caption: PLANNING_STATUS_LABELS[goalsStatus] },
            { label: 'Budget', value: PLANNING_STATUS_RANK[budgetStatus], total: 2, caption: PLANNING_STATUS_LABELS[budgetStatus] },
          ]}
        />
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}

        <section aria-labelledby="planning-goals" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="planning-goals" className="text-sm font-bold uppercase tracking-wide">
              Annual Council Goals
            </h3>
            <StatusPill status={goalsStatus} />
            {setter && g && !g.locked && !editing ? (
              <Button size="sm" variant="gold" onClick={() => setEditing(true)}>
                {g.goals ? 'Edit targets' : 'Set targets'}
              </Button>
            ) : null}
            {setter && g?.goals && !g.locked && goalsStatus === 'DRAFT' && !editing ? (
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void run('goals')}>
                {busy === 'goals' ? 'Saving…' : 'Mark goals reviewed'}
              </Button>
            ) : null}
          </div>
          {goals.error ? <Notice tone="error">{goals.error}</Notice> : null}
          {!g && !goals.error ? <p className="text-sm text-muted">Loading the goals…</p> : null}
          {g && editing && allTargets ? (
            <GoalsForm
              initial={allTargets}
              onCancel={() => setEditing(false)}
              onSave={async (t) => {
                await db.reports.setCouncilGoals(user.memberId, council.id, year, t);
                setEditing(false);
                await goals.reload();
              }}
            />
          ) : null}
          {g && !editing && allTargets ? (
            g.goals ? (
              <GoalTargetBlocks targets={allTargets} spiritual={g.spiritual} />
            ) : (
              <Notice tone="info">No goals are saved for {year}.{g.locked ? ' The year is locked, so none can be added now.' : ''}</Notice>
            )
          ) : null}
          {g?.locked ? (
            <p className="text-sm">
              <strong>Read-only.</strong> The {year} goals locked on {formatFullDate(flow.dates.lockDate)}, when the fraternal year began. Nobody can change
              them, not even a Super Admin.
            </p>
          ) : g ? (
            <p className="text-xs text-muted">The goals lock for good on {formatFullDate(flow.dates.lockDate)}.</p>
          ) : null}
        </section>

        <section aria-labelledby="planning-budget" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="planning-budget" className="text-sm font-bold uppercase tracking-wide">
              Annual budget
            </h3>
            <StatusPill status={budgetStatus} />
            {budgetEditor && budget.data?.window === 'Draft' && budgetStatus === 'DRAFT' && budget.data.lines.length > 0 ? (
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void run('budget')}>
                {busy === 'budget' ? 'Saving…' : 'Mark budget reviewed'}
              </Button>
            ) : null}
          </div>
          {budget.error ? <Notice tone="error">{budget.error}</Notice> : null}
          {budget.data ? (
            <p className="text-sm">
              {budget.data.lines.length} line{budget.data.lines.length === 1 ? '' : 's'}; drafting window{' '}
              <strong>{budget.data.window === 'Draft' ? 'open' : budget.data.window === 'Finalized' ? 'closed (figures locked July 1)' : 'not open yet'}</strong>.{' '}
              {budgetStatus === 'LOCKED'
                ? 'The council has voted the budget.'
                : `The council's final vote must be recorded by ${formatFullDate(flow.dates.voteDeadline)}.`}{' '}
              <Link href="/budget" className="font-bold underline">
                Open the budget
              </Link>
            </p>
          ) : null}
        </section>
      </div>
    </Panel>
  );
}

/** The council's switch for the Cross-Council Loaner Library. */
export function LoanerLibrarySharingCard({ user, council, onSaved }: { user: SessionUser; council: Council; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = loanerLibraryEnabled(council);
  const toggle = async (next: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await db.councils.setLoanerLibraryEnabled(user.memberId, council.id, next);
      await onSaved();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="Cross-Council Loaner Library Sharing" className="mt-6">
      <div className="flex flex-col gap-3">
        <Switch
          checked={on}
          disabled={busy}
          onChange={(next) => void toggle(next)}
          label={on ? 'Sharing is on' : 'Sharing is off'}
          description="Shares your listed items with affiliated councils, and shows you theirs."
        />
        <p className="text-sm">
          A brother council&apos;s item shows in the{' '}
          <Link href={LOANER_LIBRARY_HREF} className="font-bold underline">
            loaner library
          </Link>{' '}
          only when both councils have sharing on and the two are affiliated (
          <Link href="/system-settings/affiliations" className="font-bold underline">
            Connected Councils
          </Link>
          ). Your own items always show to your members.
        </p>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </Panel>
  );
}
