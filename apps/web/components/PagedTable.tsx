'use client';
// Sprint 11 Revision 17.0: the search box and pager around a full-width workspace table (Member Activities, the
// Meeting Center). usePagedSearch keeps the query and page; a new search goes back to page 1.
import { useState, type ReactNode } from 'react';
import { matchesEveryWord, paginateRows, WORKSPACE_TABLE_PAGE_SIZE } from '@kofc/shared';
import { Button, Empty, Input } from '@/components/ui';

export interface PagedSearch<T> {
  query: string;
  setQuery: (q: string) => void;
  matched: readonly T[];
  shown: T[];
  page: number;
  pages: number;
  setPage: (p: number) => void;
}

/** One page of the `rows` whose `text(row)` holds every word of the search. */
export function usePagedSearch<T>(rows: readonly T[], text: (row: T) => string, pageSize = WORKSPACE_TABLE_PAGE_SIZE): PagedSearch<T> {
  const [query, setQueryState] = useState('');
  const [page, setPage] = useState(0);
  const matched = query.trim() ? rows.filter((r) => matchesEveryWord(text(r), query)) : rows;
  const view = paginateRows(matched, page, pageSize);
  return {
    query,
    setQuery: (q: string) => {
      setQueryState(q);
      setPage(0);
    },
    matched,
    shown: view.shown,
    page: view.page,
    pages: view.pages,
    setPage,
  };
}

/** The search box, the match count, the table (`children`) and the pager. */
export function PagedTableControls<T>({
  id,
  label,
  paged,
  total,
  noun = 'rows',
  children,
}: {
  id: string;
  label: string;
  paged: PagedSearch<T>;
  total: number;
  noun?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label htmlFor={id} className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide">
          {label}
          <Input id={id} type="search" value={paged.query} onChange={(e) => paged.setQuery(e.target.value)} className="w-72 normal-case" />
        </label>
        <p className="text-xs text-muted" aria-live="polite">
          {paged.matched.length === total ? `${total} ${noun}` : `${paged.matched.length} of ${total} ${noun} match`}
        </p>
      </div>
      {paged.matched.length === 0 && total > 0 ? <Empty>Nothing matches the search.</Empty> : children}
      {paged.pages > 1 ? (
        <nav aria-label={`${label} pages`} className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="secondary" disabled={paged.page === 0} onClick={() => paged.setPage(paged.page - 1)}>
            Previous
          </Button>
          <span>
            Page {paged.page + 1} of {paged.pages}
          </span>
          <Button size="sm" variant="secondary" disabled={paged.page >= paged.pages - 1} onClick={() => paged.setPage(paged.page + 1)}>
            Next
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
