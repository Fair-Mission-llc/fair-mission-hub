'use client';
// Sprint 8S Revision 2: the step-by-step layout every workflow drawer shares - the Fraternal Planning & Budgeting
// Workflow, the Council Election Workflow and the finance desks' Expense Report (ER) and Charitable Donation Workflows
// (desk-workflows.ts).
//   WorkflowActionBar      the highlighted gold bar: one plain sentence on what happens now, and any action buttons.
//   WorkflowStepRow        the numbered steps, the current one in gold, done ones ticked; a step can carry the count
//                          of items waiting at it and a 'Your step' tag.
//   WorkflowWheels         the progress wheels: a ring per measure, filled to its share.
import type { ReactNode } from 'react';
import type { PlanningStepState } from '@kofc/shared';
import { cx, Pill } from '@/components/ui';

export interface WorkflowStepView {
  key: string;
  label: string;
  when: string;
  detail: string;
  state: PlanningStepState;
  count?: number | null;
  yours?: boolean;
}

/** The highlighted action bar across the top of a workflow. */
export function WorkflowActionBar({ headline, alert = false, children }: { headline: string; alert?: boolean; children?: ReactNode }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-3 rounded border-2 border-l-8 px-4 py-3', alert ? 'border-brand-red bg-brand-red/5' : 'border-gold bg-gold/10')}>
      <p className="min-w-0 flex-1 text-base font-bold" role="status">
        {headline}
      </p>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

/** The numbered steps of a workflow. */
export function WorkflowStepRow({ steps, label }: { steps: readonly WorkflowStepView[]; label: string }) {
  return (
    <ol className={cx('grid grid-cols-1 gap-2', steps.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4')} aria-label={label}>
      {steps.map((step, i) => (
        <li
          key={step.key}
          aria-current={step.state === 'current' ? 'step' : undefined}
          className={cx(
            'min-w-0 rounded border-2 p-2',
            step.state === 'current' ? 'border-gold bg-gold/10' : step.state === 'done' ? 'border-navy bg-white' : 'border-line bg-white',
          )}
        >
          <p className="text-xs font-bold uppercase tracking-wide">
            {step.state === 'done' ? '✓ ' : `${i + 1}. `}
            {step.label}
            {step.state === 'current' ? <span className="ml-1 text-navy">(now)</span> : null}
          </p>
          <p className="text-sm font-bold">{step.when}</p>
          <p className="text-xs text-muted">{step.detail}</p>
          {step.count != null || step.yours ? (
            <p className="mt-1 flex flex-wrap gap-1">
              {step.count != null ? <Pill tone={step.count > 0 ? 'gold' : 'outline'}>{step.count} waiting</Pill> : null}
              {step.yours ? <Pill tone="navy">Your step</Pill> : null}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

const WHEEL_RADIUS = 42;
const WHEEL_CIRCUMFERENCE = 2 * Math.PI * WHEEL_RADIUS;

export interface WorkflowWheel {
  label: string;
  value: number;
  total: number;
  /** The line under the ring, e.g. '2 of 4 steps'. */
  caption: string;
}

/** The progress wheels: one navy ring per measure (gold when full), the percent in the middle. */
export function WorkflowWheels({ wheels }: { wheels: readonly WorkflowWheel[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-label="Progress">
      {wheels.map((w) => {
        const share = w.total > 0 ? Math.min(w.value / w.total, 1) : 0;
        const percent = Math.round(share * 100);
        return (
          <li key={w.label} className="flex min-w-0 flex-col items-center gap-1 rounded border-2 border-navy border-t-8 border-t-gold bg-white px-2 py-3 text-center">
            <h4 className="text-sm font-bold">{w.label}</h4>
            <svg viewBox="0 0 100 100" className="h-24 w-24" role="img" aria-label={`${w.label}: ${w.caption}`}>
              <circle cx="50" cy="50" r={WHEEL_RADIUS} fill="none" strokeWidth="9" className="stroke-line" />
              <circle
                cx="50"
                cy="50"
                r={WHEEL_RADIUS}
                fill="none"
                strokeWidth="9"
                strokeLinecap="round"
                className={share >= 1 ? 'stroke-gold' : 'stroke-navy'}
                strokeDasharray={`${share * WHEEL_CIRCUMFERENCE} ${WHEEL_CIRCUMFERENCE}`}
                transform="rotate(-90 50 50)"
              />
              <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-navy text-[1.15rem] font-bold">
                {w.total > 0 ? `${percent}%` : '–'}
              </text>
            </svg>
            <p className="text-xs text-muted">{w.caption}</p>
          </li>
        );
      })}
    </ul>
  );
}

/** The share of a workflow's steps already done, as a wheel. */
export const stepsWheel = (steps: readonly WorkflowStepView[], label = 'Steps complete'): WorkflowWheel => {
  const done = steps.filter((s) => s.state === 'done').length;
  return { label, value: done, total: steps.length, caption: `${done} of ${steps.length} steps` };
};
