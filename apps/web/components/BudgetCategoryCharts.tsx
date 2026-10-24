'use client';
// Sprint 9 Revision 6.0: the Budget Analyzer's charts over the council's own budget categories (budget-category-charts.ts,
// from budget.getBudgetProgress):
//   - the Allocation Pie: a donut of each category's share of the year's budget (approved figures once the year is
//     Approved, proposed before), with the total in the middle; hovering or focusing a slice shows its figures there;
//   - the YTD expenditure bars: each category's spend so far against its approved cap, one bar per category on one
//     dollar scale, the cap drawn as the light track behind the spend.
// Colours come from CHART_SERIES_COLORS by the category's place in the council's list. Identity is never colour alone:
// the table under the charts names every category with its swatch, share, cap, spend and percentage used, and an
// over-budget category carries '✖ Over' in words.
import { useState } from 'react';
import { buildBudgetCategoryCharts, donutSlicePath, type BudgetYearPerformance } from '@kofc/shared';
import { formatPercent } from '@/components/BudgetParts';
import { formatMoney } from '@/lib/format';

const SIZE = 220;
const OUTER = 100;
const INNER = 62;

function Swatch({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: color }} />;
}

export function BudgetCategoryCharts({ progress }: { progress: BudgetYearPerformance }) {
  const charts = buildBudgetCategoryCharts(progress);
  const [active, setActive] = useState<number | null>(null);
  if (charts.slices.length === 0) return <p className="mt-2 text-base font-normal">No budget lines are filed under a category yet.</p>;
  const basisLabel = charts.basis === 'approved' ? 'Approved' : 'Proposed';
  const focus = active === null ? null : charts.slices[active];
  const scale = Math.max(1, ...charts.slices.map((s) => Math.max(s.approved, s.actual)));

  // Slices of the donut, clockwise from 12 o'clock, with a 2px white ring between neighbours.
  let angle = 0;
  const arcs =
    charts.total > 0
      ? charts.slices.map((s) => {
          const start = angle;
          angle += (s.amount / charts.total) * Math.PI * 2;
          return { slice: s, start, end: angle };
        })
      : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <figure className="flex flex-col items-center gap-2">
          <figcaption className="self-start text-base font-bold">Allocation Pie ({basisLabel.toLowerCase()} figures)</figcaption>
          {charts.total > 0 ? (
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-56 w-56" role="img" aria-label={`Budget by category, ${basisLabel.toLowerCase()} total ${formatMoney(charts.total)}`}>
              {arcs.map(({ slice, start, end }, i) =>
                end - start > 0 ? (
                  <path
                    key={String(slice.key)}
                    d={donutSlicePath(SIZE / 2, SIZE / 2, active === i ? OUTER + 6 : OUTER, INNER, start, end)}
                    style={{ fill: slice.color, stroke: 'var(--color-white)', strokeWidth: 2 }}
                    tabIndex={0}
                    aria-label={`${slice.label}: ${formatMoney(slice.amount)}, ${formatPercent(slice.sharePercent)}`}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    className="cursor-pointer outline-none"
                  />
                ) : null,
              )}
              <text x={SIZE / 2} y={SIZE / 2 - 8} textAnchor="middle" className="fill-navy text-[11px]">
                {focus ? focus.label.slice(0, 22) : `${basisLabel} total`}
              </text>
              <text x={SIZE / 2} y={SIZE / 2 + 12} textAnchor="middle" className="fill-navy text-[15px] font-bold">
                {formatMoney(focus ? focus.amount : charts.total)}
              </text>
              {focus ? (
                <text x={SIZE / 2} y={SIZE / 2 + 30} textAnchor="middle" className="fill-navy text-[11px]">
                  {formatPercent(focus.sharePercent)}
                </text>
              ) : null}
            </svg>
          ) : (
            <p className="text-base font-normal">Every category is at $0.00 so far.</p>
          )}
        </figure>

        <figure className="flex flex-col gap-2">
          <figcaption className="text-base font-bold">Year-to-date spending against each cap (through {progress.throughDate})</figcaption>
          <ul className="flex flex-col gap-3">
            {charts.slices.map((s) => (
              <li key={String(s.key)} className="flex flex-col gap-1" title={`${s.label}: ${formatMoney(s.actual)} of ${formatMoney(s.approved)}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-2 font-bold">
                    <Swatch color={s.color} />
                    {s.label}
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(s.actual)} of {formatMoney(s.approved)}
                    {s.overBudget ? <span className="ml-2 font-bold text-brand-red">✖ Over</span> : null}
                  </span>
                </div>
                <div className="relative h-3 w-full">
                  <div className="absolute inset-y-0 left-0 rounded-r bg-line" style={{ width: `${(s.approved / scale) * 100}%` }} />
                  <div className="absolute inset-y-0 left-0 rounded-r" style={{ width: `${(s.actual / scale) * 100}%`, backgroundColor: s.color }} />
                </div>
              </li>
            ))}
          </ul>
        </figure>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-base">
          <caption className="sr-only">Budget categories: share of the budget, approved cap, spend so far and percentage used</caption>
          <thead>
            <tr className="border-b-4 border-gold text-left text-sm uppercase tracking-wide">
              <th scope="col" className="px-3 py-2">
                Category
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                {basisLabel}
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Share
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Spent so far
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Of cap
              </th>
            </tr>
          </thead>
          <tbody>
            {charts.slices.map((s) => (
              <tr key={String(s.key)} className="border-b-2 border-line">
                <th scope="row" className="px-3 py-2 text-left">
                  <span className="inline-flex items-center gap-2">
                    <Swatch color={s.color} />
                    {s.label}
                  </span>
                </th>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(s.amount)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPercent(s.sharePercent)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(s.actual)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {s.percentUsed === null ? '—' : formatPercent(s.percentUsed)}
                  {s.overBudget ? <span className="ml-2 font-bold text-brand-red">✖ Over</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
