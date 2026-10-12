'use client';
// The Annual Fraternal Roadmap (Sprint 7G): the Executive Dashboard's high-contrast timeline of the council's yearly
// hand-over - Nominations (May), Elections (June) and the Budget Lock (July 10) - read from elections.getFraternalRoadmap.
// Each milestone is a node on one line: navy with a check when the database shows it done, a heavy gold border when it
// is the next step still open ('upcoming'), red when its due date has passed with nothing recorded ('overdue'), and a
// plain outline when it comes later. The line runs across on wide screens and down on a phone.
//
// When a reader who may send them (the council's Admins and officers, or a Super Admin) opens a roadmap with an overdue
// step, the card calls elections.dispatchRoadmapAlerts once: council leadership get a push alert per overdue step, and
// the call skips anyone already alerted, so opening the dashboard again sends nothing new.
//
// Under it, the Three-Signature Expense Flow draws the expense sheet's path as a tree - the member's submission, the
// Financial Secretary's written order, the Treasurer's ledger coding, the Grand Knight's counter-signature and the
// check - with the council's live count waiting at each signature, and the "returned to the member" branch (expenses.rejectReport).
//
// Sprint 8A: the dashboard's Home desk shows the roadmap as RoadmapRibbon - one compact line of status chips that links
// to the full card on the Reports Desk. Both send the overdue alerts the same way (useRoadmapAlerts).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FraternalRoadmap as Roadmap, RoadmapMilestone, RoadmapMilestoneStatus, SessionUser, SignatureFlowCounts } from '@kofc/shared';
import { Button, cx, Notice, Panel, Pill } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const STATUS_TEXT: Record<RoadmapMilestoneStatus, string> = {
  complete: 'Done',
  upcoming: 'Up next',
  overdue: 'Overdue',
  scheduled: 'Later',
};

const NODE_LOOK: Record<RoadmapMilestoneStatus, string> = {
  complete: 'border-4 border-navy bg-navy text-white',
  upcoming: 'border-[6px] border-gold bg-white text-navy shadow-[0_0_0_3px_var(--color-navy)]',
  overdue: 'border-4 border-brand-red bg-brand-red text-white',
  scheduled: 'border-4 border-navy bg-white text-navy',
};

const CARD_LOOK: Record<RoadmapMilestoneStatus, string> = {
  complete: 'border-2 border-navy',
  upcoming: 'border-[6px] border-gold',
  overdue: 'border-4 border-brand-red',
  scheduled: 'border-2 border-line',
};

const PILL_TONE: Record<RoadmapMilestoneStatus, 'navy' | 'gold' | 'red' | 'outline'> = {
  complete: 'navy',
  upcoming: 'gold',
  overdue: 'red',
  scheduled: 'outline',
};

/** The council's Admins and officers, or a Super Admin: elections.dispatchRoadmapAlerts' callers. */
const maySendAlerts = (user: SessionUser, councilId: number) =>
  user.memberType === 'Super Admin' || (user.councilId === councilId && (user.memberType === 'Admin' || user.isOfficer));

function MilestoneNode({ milestone, index }: { milestone: RoadmapMilestone; index: number }) {
  const s = milestone.status;
  return (
    <li className="relative flex flex-1 gap-4 md:flex-col md:items-center md:gap-3">
      {/* The node sits on the line; the line itself is drawn by the list behind the nodes. */}
      <div
        aria-hidden="true"
        className={cx('z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-serif text-xl font-bold', NODE_LOOK[s])}
      >
        {s === 'complete' ? '✓' : s === 'overdue' ? '!' : index + 1}
      </div>
      <div className={cx('flex w-full flex-col gap-1 rounded bg-white px-3 py-2 md:text-center', CARD_LOOK[s])}>
        <div className="flex flex-wrap items-center gap-2 md:justify-center">
          <h3 className={cx('font-serif text-lg', s === 'upcoming' || s === 'overdue' ? 'font-black' : 'font-bold')}>{milestone.title}</h3>
          <Pill tone={PILL_TONE[s]}>{STATUS_TEXT[s]}</Pill>
        </div>
        <p className="text-sm font-bold">{milestone.windowLabel}</p>
        <p className="text-xs text-muted">Due {formatFullDate(milestone.dueOn)}</p>
        <p className={cx('text-sm', s === 'overdue' && 'font-bold text-brand-red')}>{milestone.detail}</p>
      </div>
    </li>
  );
}

/**
 * Overdue steps of the current cycle alert leadership once per dashboard visit; the data layer skips repeats. `current`
 * is false while the reader browses another year. Returns the note to show, if any.
 */
function useRoadmapAlerts(r: Roadmap | null | undefined, current: boolean, user: SessionUser, councilId: number): string | null {
  const [alertNote, setAlertNote] = useState<string | null>(null);
  const swept = useRef<string | null>(null);
  useEffect(() => {
    if (!r || !current || !maySendAlerts(user, councilId)) return;
    if (!r.milestones.some((m) => m.status === 'overdue')) return;
    const key = `${councilId}:${r.cycleYear}`;
    if (swept.current === key) return;
    swept.current = key;
    db.elections
      .dispatchRoadmapAlerts(user.memberId, councilId)
      .then((sweep) =>
        setAlertNote(
          sweep.alertsSent > 0
            ? `Push alert sent to ${sweep.recipientIds.length} council leader${sweep.recipientIds.length === 1 ? '' : 's'} for ${sweep.overdue.length} overdue step${sweep.overdue.length === 1 ? '' : 's'}.`
            : 'Council leadership already has the alert for each overdue step.',
        ),
      )
      .catch(() => setAlertNote(null));
  }, [r, current, user, councilId]);
  return alertNote;
}

/** The Annual Fraternal Roadmap card, opening on the current cycle (roadmapCycleYear), with the year's arrows. */
export function FraternalRoadmap({ user, councilId }: { user: SessionUser; councilId: number }) {
  const [cycleYear, setCycleYear] = useState<number | null>(null);
  const roadmap = useLoad(() => db.elections.getFraternalRoadmap(user.memberId, councilId, cycleYear ?? undefined), [user.memberId, councilId, cycleYear]);
  const r = roadmap.data;
  const year = r?.cycleYear ?? null;
  const alertNote = useRoadmapAlerts(r, cycleYear === null, user, councilId);

  return (
    <Panel
      title={year === null ? 'Annual Fraternal Roadmap' : `Annual Fraternal Roadmap · ${year}`}
      actions={
        year === null ? null : (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" aria-label={`Show the ${year - 1} roadmap`} onClick={() => setCycleYear(year - 1)}>
              ← {year - 1}
            </Button>
            <Button size="sm" variant="secondary" aria-label={`Show the ${year + 1} roadmap`} onClick={() => setCycleYear(year + 1)}>
              {year + 1} →
            </Button>
          </div>
        )
      }
    >
      {roadmap.error ? <Notice tone="error">{roadmap.error}</Notice> : null}
      {!r ? (
        <p className="text-sm text-muted">Loading the roadmap…</p>
      ) : (
        <div data-surface="white" className="flex flex-col gap-4">
          <p className="text-sm">
            The steps that hand the council over to the <strong>{r.termYear}</strong> fraternal year. The next open step has a gold border; a step past its due
            date with nothing recorded turns red.
          </p>
          <ol aria-label={`Roadmap for ${r.cycleYear}`} className="relative flex flex-col gap-4 md:flex-row md:gap-6">
            {/* The timeline: down the left edge on a phone, across the node centers on wide screens. */}
            <span aria-hidden="true" className="absolute bottom-7 left-[1.625rem] top-7 w-1.5 bg-navy md:left-[16%] md:right-[16%] md:top-[1.625rem] md:bottom-auto md:h-1.5 md:w-auto" />
            {r.milestones.map((m, i) => (
              <MilestoneNode key={m.id} milestone={m} index={i} />
            ))}
          </ol>
          {alertNote ? <Notice tone="info">{alertNote}</Notice> : null}
          {cycleYear !== null ? (
            <button type="button" className="self-start text-sm font-bold underline" onClick={() => setCycleYear(null)}>
              Back to the current cycle
            </button>
          ) : null}
        </div>
      )}
      {r ? <SignatureFlowTree counts={r.signatureFlow} /> : null}
    </Panel>
  );
}

const CHIP_LOOK: Record<RoadmapMilestoneStatus, string> = {
  complete: 'border-navy bg-navy text-white',
  upcoming: 'border-gold bg-white text-navy',
  overdue: 'border-brand-red bg-brand-red text-white',
  scheduled: 'border-line bg-white text-navy',
};

const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * The Home desk's single-line roadmap (Sprint 8A): the current cycle's milestones as chips joined by a navy rule, each
 * with its status and due date, and a link to the full card on the Reports Desk. It never wraps; a narrow screen scrolls
 * it sideways.
 */
export function RoadmapRibbon({ user, councilId, fullLink }: { user: SessionUser; councilId: number; fullLink: ReactNode }) {
  const roadmap = useLoad(() => db.elections.getFraternalRoadmap(user.memberId, councilId), [user.memberId, councilId]);
  const r = roadmap.data;
  const alertNote = useRoadmapAlerts(r, true, user, councilId);
  return (
    <section
      aria-label="Annual Fraternal Roadmap"
      title={alertNote ?? undefined}
      className="flex items-center gap-3 overflow-x-auto whitespace-nowrap rounded border-2 border-navy bg-white px-3 py-1.5 text-sm"
    >
      <span className="shrink-0 font-serif font-bold">🗺️ Roadmap{r ? ` ${r.cycleYear}` : ''}</span>
      {roadmap.error ? <span className="text-brand-red">{roadmap.error}</span> : null}
      {!r ? (
        roadmap.error ? null : <span className="text-muted">Loading…</span>
      ) : (
        <ol aria-label={`Roadmap for ${r.cycleYear}`} className="flex shrink-0 items-center">
          {r.milestones.map((m, i) => (
            <li key={m.id} className="flex items-center">
              {i > 0 ? <span aria-hidden="true" className="h-1 w-6 bg-navy" /> : null}
              <span className={cx('rounded-full border-2 px-2.5 py-0.5 font-bold', CHIP_LOOK[m.status])}>
                {m.status === 'complete' ? '✓ ' : m.status === 'overdue' ? '! ' : ''}
                {m.title} · {STATUS_TEXT[m.status]} · {shortDate(m.dueOn)}
              </span>
            </li>
          ))}
        </ol>
      )}
      <span className="ml-auto shrink-0">{fullLink}</span>
    </section>
  );
}

/** One box of the signature tree, with the count waiting at it. */
function FlowStep({ title, who, count, tone = 'navy' }: { title: string; who: string; count?: number; tone?: 'navy' | 'gold' | 'start' }) {
  return (
    <div
      className={cx(
        'flex min-w-0 flex-col items-center gap-1 rounded px-3 py-2 text-center',
        tone === 'navy' && 'border-4 border-navy bg-white',
        tone === 'gold' && 'border-4 border-gold bg-white',
        tone === 'start' && 'border-4 border-navy bg-navy text-white',
      )}
    >
      <span className="font-serif text-base font-bold leading-tight">{title}</span>
      <span className={cx('text-xs', tone === 'start' ? 'text-white' : 'text-muted')}>{who}</span>
      {count !== undefined ? (
        <span className={cx('mt-1 rounded-full px-2 text-sm font-bold', count > 0 ? 'bg-gold text-navy' : 'border border-line text-navy')}>
          {count} waiting
        </span>
      ) : null}
    </div>
  );
}

const Arrow = () => (
  <span aria-hidden="true" className="flex items-center justify-center font-bold text-navy">
    <span className="md:hidden">↓</span>
    <span className="hidden md:inline">→</span>
  </span>
);

/** The Three-Signature Expense Flow, as a tree with the live counts. */
export function SignatureFlowTree({ counts }: { counts: SignatureFlowCounts }) {
  const total = counts.awaitingFinancialSecretary + counts.awaitingTreasurer + counts.awaitingGrandKnight + counts.awaitingCheck;
  return (
    <figure className="mt-6 flex flex-col gap-3 border-t border-line pt-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-serif text-lg font-bold">Three-Signature Expense Flow</span>
        <span className="text-sm text-muted">{total === 0 ? 'No expense sheet is waiting.' : `${total} expense sheet${total === 1 ? '' : 's'} in the flow`}</span>
      </figcaption>
      <div
        role="img"
        aria-label={
          `Member submits, then the Financial Secretary's written order (${counts.awaitingFinancialSecretary} waiting), the Treasurer's ledger coding ` +
          `(${counts.awaitingTreasurer} waiting), the Grand Knight's counter-signature (${counts.awaitingGrandKnight} waiting), and the check ` +
          `(${counts.awaitingCheck} waiting). Council leadership may return a submitted sheet to the member as a draft.`
        }
        className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr]"
      >
        <FlowStep title="Member submits" who="Any member" tone="start" />
        <Arrow />
        <FlowStep title="1. Written order" who="Financial Secretary" count={counts.awaitingFinancialSecretary} />
        <Arrow />
        <FlowStep title="2. Ledger coding" who="Treasurer" count={counts.awaitingTreasurer} />
        <Arrow />
        <FlowStep title="3. Counter-signature" who="Grand Knight" count={counts.awaitingGrandKnight} />
        <Arrow />
        <FlowStep title="Check paid" who="Financial Secretary or Treasurer" count={counts.awaitingCheck} tone="gold" />
      </div>
      <div className="flex flex-col items-center gap-1 md:items-stretch">
        <span aria-hidden="true" className="hidden h-4 border-x-4 border-b-4 border-dashed border-brand-red md:mx-[22%] md:block" />
        <p className="rounded border-2 border-dashed border-brand-red px-3 py-1 text-center text-sm font-bold text-brand-red md:mx-auto">
          Returned: council leadership may send a submitted sheet back to the member as a draft, with a reason. Its signatures are cleared.
        </p>
      </div>
      <p className="text-xs text-muted">Nobody signs a sheet they submitted, and no one signs two lines of the same sheet.</p>
    </figure>
  );
}
