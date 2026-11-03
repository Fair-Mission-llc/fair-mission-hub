// =========================================================================
// WORKSPACE DATA TABLES (Sprint 11 Revision 17.0)
// Member Activities (/activities) and the Meeting Center (/meetings) list their rows in full-width tables with a search
// box and a pager. A row matches when every word of the search appears in its text, in any case and any order.
// =========================================================================

/** Rows per page in the workspace data tables. */
export const WORKSPACE_TABLE_PAGE_SIZE = 15;

/** True when every word of `query` appears in `text` (case-insensitive); an empty search matches everything. */
export function matchesEveryWord(text: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = text.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** One page of `rows`: the page number is clamped to the pages there are, and `pages` is at least 1. */
export function paginateRows<T>(rows: readonly T[], page: number, pageSize = WORKSPACE_TABLE_PAGE_SIZE): { shown: T[]; page: number; pages: number } {
  const size = Math.max(1, Math.floor(pageSize));
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(0, Math.floor(page)), pages - 1);
  return { shown: rows.slice(current * size, current * size + size), page: current, pages };
}
