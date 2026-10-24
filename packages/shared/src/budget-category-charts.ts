// =========================================================================
// BUDGET CATEGORY CHARTS (Sprint 9 Revision 6.0)
//
// The Budget Analyzer's two charts over the council's own budget categories (CouncilBudgetCategory, the funds the
// Financial Secretary, Treasurer or an Admin define and assign on the Budget page), from budget.getBudgetProgress:
//   - the Allocation Pie: each category's share of the year's budget - the approved figures once the year is
//     Approved, the proposed figures before that;
//   - the YTD expenditure bars: each category's actual spend so far against its approved cap.
// A category keeps its colour slot by its place in the council's list (id order), so adding spend or a filter never
// repaints the others. Past CHART_SERIES_COLORS' eight slots the remaining categories fold into one 'Other' slice;
// the Uncategorized group and 'Other' take the neutral colour.
// =========================================================================
import type { BudgetCategoryPerformance, BudgetYearPerformance } from './contract';
import { CHART_NEUTRAL_COLOR, CHART_SERIES_COLORS } from './theme';

/** The label of the folded slice. */
export const BUDGET_CHART_OTHER_LABEL = 'Other';

/** One slice of the Allocation Pie, or one bar of the YTD chart. */
export interface BudgetCategorySlice {
  /** The category id; null for Uncategorized; 'other' for the folded slice. */
  key: number | null | 'other';
  label: string;
  color: string;
  /** The figure the pie shares out (approved once Approved, else proposed). */
  amount: number;
  /** amount as a percentage of the whole, to one decimal place; 0 when the whole is 0. */
  sharePercent: number;
  approved: number;
  actual: number;
  /** actual as a percentage of approved, to one decimal place; null without an approved cap. */
  percentUsed: number | null;
  overBudget: boolean;
}

/** The charts' data: which figure the pie shows, the slices in legend order, and the whole. */
export interface BudgetCategoryCharts {
  basis: 'approved' | 'proposed';
  total: number;
  actualTotal: number;
  throughDate: string;
  slices: BudgetCategorySlice[];
}

const cents = (n: number) => Math.round(n * 100);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildBudgetCategoryCharts(progress: Pick<BudgetYearPerformance, 'status' | 'categories' | 'throughDate'>): BudgetCategoryCharts {
  const basis = progress.status === 'Approved' ? 'approved' : 'proposed';
  const named = progress.categories.filter((c) => c.categoryId !== null);
  const uncategorized = progress.categories.find((c) => c.categoryId === null);
  const kept = named.slice(0, CHART_SERIES_COLORS.length);
  const folded = named.slice(CHART_SERIES_COLORS.length);
  const raw: { key: BudgetCategorySlice['key']; label: string; color: string; rows: BudgetCategoryPerformance[] }[] = kept.map((c, i) => ({
    key: c.categoryId,
    label: c.label,
    color: CHART_SERIES_COLORS[i],
    rows: [c],
  }));
  if (folded.length > 0) raw.push({ key: 'other', label: BUDGET_CHART_OTHER_LABEL, color: CHART_NEUTRAL_COLOR, rows: folded });
  if (uncategorized) raw.push({ key: null, label: uncategorized.label, color: CHART_NEUTRAL_COLOR, rows: [uncategorized] });
  const sum = (rows: BudgetCategoryPerformance[], pick: (c: BudgetCategoryPerformance) => number) => rows.reduce((t, c) => t + cents(pick(c)), 0) / 100;
  const amounts = raw.map((r) => sum(r.rows, (c) => (basis === 'approved' ? c.approved : c.proposed)));
  const total = amounts.reduce((t, a) => t + cents(a), 0) / 100;
  const slices = raw.map((r, i) => {
    const approved = sum(r.rows, (c) => c.approved);
    const actual = sum(r.rows, (c) => c.actual);
    return {
      key: r.key,
      label: r.label,
      color: r.color,
      amount: amounts[i],
      sharePercent: cents(total) > 0 ? round1((cents(amounts[i]) / cents(total)) * 100) : 0,
      approved,
      actual,
      percentUsed: cents(approved) > 0 ? round1((cents(actual) / cents(approved)) * 100) : null,
      overBudget: cents(approved) > 0 && cents(actual) > cents(approved),
    };
  });
  return { basis, total, actualTotal: slices.reduce((t, s) => t + cents(s.actual), 0) / 100, throughDate: progress.throughDate, slices };
}

/** A donut slice's SVG path: the ring between `inner` and `outer` from angle `start` to `end` (radians, 0 = 12 o'clock). */
export function donutSlicePath(cx: number, cy: number, outer: number, inner: number, start: number, end: number): string {
  const sweep = Math.min(end - start, Math.PI * 2 - 1e-6);
  const stop = start + sweep;
  const at = (r: number, a: number) => `${(cx + r * Math.sin(a)).toFixed(3)} ${(cy - r * Math.cos(a)).toFixed(3)}`;
  const large = sweep > Math.PI ? 1 : 0;
  return `M ${at(outer, start)} A ${outer} ${outer} 0 ${large} 1 ${at(outer, stop)} L ${at(inner, stop)} A ${inner} ${inner} 0 ${large} 0 ${at(inner, start)} Z`;
}
