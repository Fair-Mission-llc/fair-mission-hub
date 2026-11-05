'use client';
// Sprint 11 Revision 20.0: Left Vertical Action Drawers. A narrow rail of drawer handles down the left side, all closed
// on arrival; opening one draws its module in the stage to the right of the rail, and opening another swaps it. A
// drawer's module mounts only while it is open, so a closed drawer reads no data and the page keeps its white space.
// Used by the Member Desk and the Feedback Support page (the Admin Desk keeps its own rail of the same shape).
import { useEffect, type ReactNode } from 'react';
import { plainTitle } from '@kofc/shared';
import { cx, EmbeddedModuleContext } from '@/components/ui';

export interface LeftActionDrawer {
  id: string;
  title: string;
  hint: string;
  /** A count shown on the handle, or null for none. */
  count?: number | null;
  /** A desk row id (officer-desks.ts DESK_FOCUS_TARGETS): a Home badge click-through that focuses it opens the drawer. */
  rowId?: string;
}

export function LeftActionDrawers({
  label,
  drawers,
  open,
  onOpen,
  render,
}: {
  label: string;
  drawers: readonly LeftActionDrawer[];
  open: string | null;
  onOpen: (id: string | null) => void;
  render: (id: string) => ReactNode;
}) {
  const current = drawers.find((d) => d.id === open) ?? null;
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, onOpen]);

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label={label} className="desk-rail-lock flex flex-col gap-2">
        {drawers.map((d) => {
          const selected = d.id === current?.id;
          return (
            <div
              key={d.id}
              id={d.rowId}
              tabIndex={d.rowId ? -1 : undefined}
              onFocus={(e) => {
                if (d.rowId && e.target === e.currentTarget && !selected) onOpen(d.id);
              }}
              className="rounded outline-none data-[desk-focus=true]:ring-4 data-[desk-focus=true]:ring-gold"
            >
            <button
              type="button"
              onClick={() => onOpen(selected ? null : d.id)}
              aria-expanded={selected}
              aria-controls={`left-drawer-${d.id}`}
              data-drawer-state={selected ? 'open' : 'closed'}
              className={cx(
                'flex w-full flex-col gap-0.5 rounded border-2 border-navy bg-white px-3 py-2 text-left text-navy hover:bg-gold/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold',
                selected && 'drawer-context-active border-l-8 border-l-gold bg-gold/30',
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-serif font-bold leading-tight">{plainTitle(d.title)}</span>
                {d.count != null ? <span className="rounded bg-line px-2 py-0.5 text-sm font-bold text-navy">{d.count}</span> : null}
              </span>
              <span className="text-xs text-muted">{d.hint}</span>
            </button>
            </div>
          );
        })}
      </nav>
      {current ? (
        <section
          id={`left-drawer-${current.id}`}
          aria-label={current.title}
          className="flex min-w-0 flex-col border-2 border-navy border-l-8 border-l-gold bg-white motion-safe:animate-slide-in"
        >
          <header data-surface="navy" className="flex items-center justify-between gap-3 bg-navy px-4 py-3 text-white">
            <h2 className="font-serif text-xl font-bold">{plainTitle(current.title)}</h2>
            <button type="button" onClick={() => onOpen(null)} className="font-bold underline">
              Close
            </button>
          </header>
          <div className="flex flex-col gap-4 p-5">
            <EmbeddedModuleContext.Provider value={true}>{render(current.id)}</EmbeddedModuleContext.Provider>
          </div>
        </section>
      ) : (
        <p className="rounded border border-dashed border-line p-6 text-sm text-muted">Open a drawer on the left to work in it here.</p>
      )}
    </div>
  );
}
