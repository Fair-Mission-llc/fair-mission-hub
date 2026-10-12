'use client';
// The Executive Dashboard's Sprint 8F panels (council-goals.ts).
//
// GoalsProgressCenter - the Annual Council Goals Progress Center: one progress wheel per CouncilGoals target of the
// chosen fraternal year - funds raised, new members and service hours, then the Faith Center's rosaries, hours of
// adoration and confessions (a Knights of Columbus council only) - measured by reports.getCouncilGoals. The council's
// Grand Knight or Deputy Grand Knight, its Admins and Super Admins set the targets in place (reports.setCouncilGoals).
//
// YearOverYearTrends - the comparative trend lines of GET /api/analytics/trends (analytics-transport.ts): funds raised
// and volunteer hours month by month from July, one line per fraternal year (the newest solid navy, the year before
// dashed gold, the one before that dotted grey, each labelled at its end), a hover readout of the month, the revenue
// split and hours split per year, and the same figures as a table.
//
// Sprints 8G/8H: from July 1 of its year the goals are locked (planning-workflow.ts); the Progress Center then hides
// Edit targets and shows a Locked badge. The Fraternal Planning & Budgeting Workflow on Council Wide Settings reuses
// GoalsForm.
import { useMemo, useState } from 'react';
import {
  COUNCIL_GOAL_KEYS,
  COUNCIL_GOAL_LABELS,
  canSetCouncilGoals,
  defaultTrendYears,
  describeError,
  FISCAL_MONTH_LABELS,
  type CouncilGoalMetric,
  type CouncilGoalTargets,
  type CouncilTrends,
  type SessionUser,
  type TrendYear,
} from '@kofc/shared';
import { Button, cx, Field, Input, Notice, Panel, Pill, Select, Table, Td } from '@/components/ui';
import { formatDecimalHours, formatFullDate, formatMoney } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { loadCouncilTrends } from '@/services/analytics-transport';
import { db } from '@/services/db';

const formatMetric = (unit: CouncilGoalMetric['unit'], value: number): string =>
  unit === 'money' ? formatMoney(value) : unit === 'hours' ? formatDecimalHours(value) : value.toLocaleString('en-US');

// ---- the progress wheels ---------------------------------------------------------------------------------------

const WHEEL_RADIUS = 42;
const WHEEL_CIRCUMFERENCE = 2 * Math.PI * WHEEL_RADIUS;

/** One target as a ring: the navy arc fills to the share reached (capped at a full ring), the percent in the middle. */
function ProgressWheel({ metric }: { metric: CouncilGoalMetric }) {
  const share = metric.percent === null ? 0 : Math.min(metric.percent, 100) / 100;
  const reached = metric.percent !== null && metric.percent >= 100;
  return (
    <li className="flex flex-col items-center gap-1 rounded border-2 border-navy border-t-8 border-t-gold bg-white px-2 py-3 text-center">
      <h4 className="text-sm font-bold">{metric.label}</h4>
      <svg viewBox="0 0 100 100" className="h-28 w-28" role="img" aria-label={`${metric.label}: ${metric.percent === null ? 'no target set' : `${metric.percent}% of target`}`}>
        <circle cx="50" cy="50" r={WHEEL_RADIUS} fill="none" strokeWidth="9" className="stroke-line" />
        <circle
          cx="50"
          cy="50"
          r={WHEEL_RADIUS}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className={reached ? 'stroke-gold' : 'stroke-navy'}
          strokeDasharray={`${share * WHEEL_CIRCUMFERENCE} ${WHEEL_CIRCUMFERENCE}`}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-navy text-[1.15rem] font-bold">
          {metric.percent === null ? '–' : `${metric.percent}%`}
        </text>
      </svg>
      <p className="text-sm font-bold">{formatMetric(metric.unit, metric.actual)}</p>
      <p className="text-xs text-muted">{metric.target > 0 ? `of ${formatMetric(metric.unit, metric.target)}` : 'No target set'}</p>
      {reached ? <Pill tone="gold">Goal reached</Pill> : null}
    </li>
  );
}

/** The targets form of the goal setters. */
export function GoalsForm({ initial, onSave, onCancel }: { initial: CouncilGoalTargets; onSave: (t: CouncilGoalTargets) => Promise<void>; onCancel: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(COUNCIL_GOAL_KEYS.map((k) => [k, String(initial[k] ?? 0)])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3 rounded border-2 border-gold bg-white p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSave(Object.fromEntries(COUNCIL_GOAL_KEYS.map((k) => [k, Number(values[k] || 0)])) as CouncilGoalTargets);
        } catch (err) {
          setError(describeError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {COUNCIL_GOAL_KEYS.map((key) => (
          <Field key={key} label={`${COUNCIL_GOAL_LABELS[key]} target`} hint={key === 'hours_target' ? 'In quarter hours' : undefined}>
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                step={key === 'fundraising_target' ? 0.01 : key === 'hours_target' ? 0.25 : 1}
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              />
            )}
          </Field>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save targets'}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** The Annual Council Goals Progress Center for one fraternal year. */
export function GoalsProgressCenter({ user, councilId, fraternalYear }: { user: SessionUser; councilId: number; fraternalYear: string }) {
  const years = useMemo(() => {
    const list = defaultTrendYears(new Date());
    const next = `${Number(list[0].slice(0, 4)) + 1}-${Number(list[0].slice(0, 4)) + 2}`;
    return [next, ...list];
  }, []);
  const [year, setYear] = useState(fraternalYear);
  const [editing, setEditing] = useState(false);
  const progress = useLoad(() => db.reports.getCouncilGoals(user.memberId, councilId, year), [user.memberId, councilId, year]);
  const p = progress.data;
  const setter = canSetCouncilGoals(user, councilId);
  const fraternal = p?.metrics.filter((m) => m.group === 'fraternal') ?? [];
  const spiritual = p?.metrics.filter((m) => m.group === 'spiritual') ?? [];

  return (
    <Panel
      title="Annual Council Goals Progress Center"
      actions={
        <div className="flex items-end gap-2">
          <Field label="Fraternal year" className="w-36">
            {(id) => (
              <Select id={id} value={year} onChange={(e) => setYear(e.target.value)}>
                {(years.includes(year) ? years : [year, ...years]).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {p?.locked ? <Pill tone="outline">Locked July 1</Pill> : null}
          {setter && !editing && p && !p.locked ? (
            <Button size="sm" variant="gold" onClick={() => setEditing(true)}>
              {p.goals ? 'Edit targets' : 'Set targets'}
            </Button>
          ) : null}
        </div>
      }
    >
      {progress.error ? <Notice tone="error">{progress.error}</Notice> : null}
      {!p ? (
        progress.error ? null : <p className="text-sm text-muted">Loading the goals…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {editing ? (
            <GoalsForm
              initial={Object.fromEntries(p.metrics.map((m) => [m.key, m.target])) as CouncilGoalTargets}
              onCancel={() => setEditing(false)}
              onSave={async (targets) => {
                await db.reports.setCouncilGoals(user.memberId, councilId, year, targets);
                setEditing(false);
                await progress.reload();
              }}
            />
          ) : null}
          {!p.goals && !editing ? (
            <Notice tone="info">
              No targets are set for {p.fraternalYear}.
              {p.locked ? ' The year locked on July 1, so none can be added now.' : setter ? ' Choose Set targets to add them.' : ' The Grand Knight sets them.'}
            </Notice>
          ) : null}
          <section aria-labelledby="goals-fraternal">
            <h3 id="goals-fraternal" className="mb-2 text-sm font-bold uppercase tracking-wide">
              Fundraising, recruitment and service
            </h3>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {fraternal.map((m) => (
                <ProgressWheel key={m.key} metric={m} />
              ))}
            </ul>
          </section>
          {p.spiritual ? (
            <section aria-labelledby="goals-spiritual">
              <h3 id="goals-spiritual" className="mb-2 text-sm font-bold uppercase tracking-wide">
                Spiritual aggregates (Faith Center)
              </h3>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {spiritual.map((m) => (
                  <ProgressWheel key={m.key} metric={m} />
                ))}
              </ul>
            </section>
          ) : null}
          <p className="text-xs text-muted">
            {formatFullDate(p.fromDate)} to {formatFullDate(p.toDate)}. Funds raised and hours come from the events&apos; ledgers and the logged time; new members
            from each member&apos;s join date.{p.spiritual ? ' The devotional tally has no dates, so its wheels count every devotion members have logged.' : ''}
          </p>
        </div>
      )}
    </Panel>
  );
}

// ---- the year-over-year trend lines ------------------------------------------------------------------------------

/** Line styles in fixed order: newest year first. Each year also differs by dash pattern, never by colour alone. */
const SERIES = [
  { stroke: 'stroke-navy', fill: 'fill-navy', dash: undefined, name: 'solid navy' },
  { stroke: 'stroke-gold', fill: 'fill-gold', dash: '7 4', name: 'dashed gold' },
  { stroke: 'stroke-muted', fill: 'fill-muted', dash: '2 4', name: 'dotted grey' },
  { stroke: 'stroke-brand-red', fill: 'fill-brand-red', dash: '10 3 2 3', name: 'dash-dot red' },
  { stroke: 'stroke-green', fill: 'fill-green', dash: '4 2', name: 'short-dash green' },
] as const;

const CHART = { width: 640, height: 220, left: 56, right: 72, top: 12, bottom: 28 };

/** A rounded axis ceiling: 1, 2, 2.5 or 5 times a power of ten. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 2.5, 5, 10].find((m) => m * power >= value) ?? 10) * power;
}

function TrendChart({ title, years, pick, format }: { title: string; years: readonly TrendYear[]; pick: (m: TrendYear['months'][number]) => number; format: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceCeiling(Math.max(0, ...years.flatMap((y) => y.months.map(pick))));
  const plotW = CHART.width - CHART.left - CHART.right;
  const plotH = CHART.height - CHART.top - CHART.bottom;
  const x = (i: number) => CHART.left + (i / 11) * plotW;
  const y = (v: number) => CHART.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="text-sm font-bold">{title}</figcaption>
      <ul className="flex flex-wrap gap-3 text-xs" aria-label={`${title} legend`}>
        {years.map((yr, i) => (
          <li key={yr.fraternalYear} className="flex items-center gap-1.5">
            <svg width="24" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="24" y2="4" strokeWidth="2" strokeDasharray={SERIES[i].dash} className={SERIES[i].stroke} />
            </svg>
            {yr.fraternalYear}
          </li>
        ))}
      </ul>
      <div className="relative">
        <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="h-auto w-full" role="img" aria-label={`${title}, ${years.map((y) => y.fraternalYear).join(' against ')}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={CHART.left} x2={CHART.width - CHART.right} y1={y(t)} y2={y(t)} strokeWidth="1" className="stroke-line" />
              <text x={CHART.left - 6} y={y(t)} textAnchor="end" dominantBaseline="central" className="fill-muted text-[11px]">
                {format(t)}
              </text>
            </g>
          ))}
          {FISCAL_MONTH_LABELS.map((label, i) => (
            <text key={label} x={x(i)} y={CHART.height - 8} textAnchor="middle" className="fill-muted text-[11px]">
              {label}
            </text>
          ))}
          {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={CHART.top} y2={CHART.top + plotH} strokeWidth="1" className="stroke-navy" /> : null}
          {[...years].reverse().map((yr) => {
            const i = years.indexOf(yr);
            const points = yr.months.map((m, mi) => `${x(mi)},${y(pick(m))}`).join(' ');
            const last = yr.months[yr.months.length - 1];
            return (
              <g key={yr.fraternalYear}>
                <polyline points={points} fill="none" strokeWidth="2" strokeLinejoin="round" strokeDasharray={SERIES[i].dash} className={SERIES[i].stroke} />
                {hover !== null ? <circle cx={x(hover)} cy={y(pick(yr.months[hover]))} r="4" strokeWidth="2" className={cx(SERIES[i].fill, 'stroke-white')} /> : null}
                <text x={x(11) + 6} y={y(pick(last))} dominantBaseline="central" className="fill-navy text-[11px] font-bold">
                  {yr.fraternalYear.slice(2, 4)}-{yr.fraternalYear.slice(7)}
                </text>
              </g>
            );
          })}
          {FISCAL_MONTH_LABELS.map((label, i) => (
            <rect
              key={`hit-${label}`}
              x={x(i) - plotW / 22}
              y={CHART.top}
              width={plotW / 11}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {hover !== null ? (
          <div className="pointer-events-none absolute right-2 top-1 rounded border-2 border-navy bg-white px-2 py-1 text-xs shadow">
            <p className="font-bold">{FISCAL_MONTH_LABELS[hover]}</p>
            {years.map((yr) => (
              <p key={yr.fraternalYear}>
                {yr.fraternalYear}: <span className="font-bold">{format(pick(yr.months[hover]))}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </figure>
  );
}

const changeLabel = (percent: number | null): string => (percent === null ? 'no prior year to compare' : `${percent > 0 ? '+' : ''}${percent}% on the year before`);

function TrendsBody({ trends, source }: { trends: CouncilTrends; source: 'server' | 'browser' }) {
  const money = (n: number) => formatMoney(n).replace(/\.00$/, '');
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TrendChart title="Funds raised by month" years={trends.years} pick={(m) => m.raised} format={money} />
        <TrendChart title="Volunteer hours by month" years={trends.years} pick={(m) => m.hours} format={formatDecimalHours} />
      </div>
      <Table caption="Revenue split and hours by fraternal year" head={['Fraternal year', 'Cash', 'Electronic', 'Total raised', 'Event hours', 'Activity hours', 'Total hours']}>
        {trends.years.map((yr) => (
          <tr key={yr.fraternalYear}>
            <Td className="font-bold">{yr.fraternalYear}</Td>
            <Td className="text-right">{formatMoney(yr.totals.cash)}</Td>
            <Td className="text-right">{formatMoney(yr.totals.electronic)}</Td>
            <Td className="text-right font-bold">{formatMoney(yr.totals.raised)}</Td>
            <Td className="text-right">{formatDecimalHours(yr.totals.eventHours)}</Td>
            <Td className="text-right">{formatDecimalHours(yr.totals.activityHours)}</Td>
            <Td className="text-right font-bold">{formatDecimalHours(yr.totals.hours)}</Td>
          </tr>
        ))}
      </Table>
      <details className="text-sm">
        <summary className="cursor-pointer font-bold underline">Show the monthly figures as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <Table caption="Monthly funds raised and hours by fraternal year" head={['Month', ...trends.years.flatMap((y) => [`${y.fraternalYear} raised`, `${y.fraternalYear} hours`])]}>
            {FISCAL_MONTH_LABELS.map((label, i) => (
              <tr key={label}>
                <Td className="font-bold">{label}</Td>
                {trends.years.flatMap((y) => [
                  <Td key={`${y.fraternalYear}-r`} className="text-right">
                    {formatMoney(y.months[i].raised)}
                  </Td>,
                  <Td key={`${y.fraternalYear}-h`} className="text-right">
                    {formatDecimalHours(y.months[i].hours)}
                  </Td>,
                ])}
              </tr>
            ))}
          </Table>
        </div>
      </details>
      <p className="text-xs text-muted">
        Fraternal years run July to June. Funds raised: {changeLabel(trends.change.raisedPercent)}. Hours: {changeLabel(trends.change.hoursPercent)}.{' '}
        {source === 'server' ? 'Served by the analytics route.' : 'Computed in this browser (the analytics route could not answer for this session).'}
      </p>
    </div>
  );
}

/** The Year-over-Year Trends panel: the current fraternal year against the two before it. */
export function YearOverYearTrends({ user, councilId }: { user: SessionUser; councilId: number }) {
  const years = useMemo(() => defaultTrendYears(new Date()), []);
  const answer = useLoad(() => loadCouncilTrends(user.memberId, councilId, years), [user.memberId, councilId, years.join(',')]);
  return (
    <Panel title={`Year-over-Year Trends · ${years[years.length - 1]} to ${years[0]}`}>
      {answer.error ? <Notice tone="error">{answer.error}</Notice> : null}
      {answer.data ? <TrendsBody trends={answer.data.trends} source={answer.data.source} /> : answer.error ? null : <p className="text-sm text-muted">Loading the trends…</p>}
    </Panel>
  );
}
