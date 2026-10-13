'use client';
// Sprint 8P Stage 2 - Zero-Traverse Action Drawers (desk-drawers.ts). The Grand Knight and Financial Secretary Desks are
// desk blotters: a grid of drawer handles (DeskDrawerHandle), each sliding its module out as a right-hand drawer
// (DeskActionDrawer) over the desk, so the work happens in place. A handle with work waiting on the reader's own
// signature carries the Alert Boundary Accent - a red border with a slow glow (animate-alert-boundary, still under
// prefers-reduced-motion). Each drawer ends with '[ 🔀 Back to Desk Blotter ]'. While a drawer is open this browser
// remembers its desk (DESK_RETURN_STORAGE_KEY), so a module that must open another page (the asset form after a long-term
// asset is released) leaves BackToDeskBlotterAnchor in the portal frame to come straight back.
// Sprint 8P Stage 3: every officer desk uses the blotter. A featured drawer (the Recorder's Historical Meeting Minutes
// Archive) spans the top row, and an alert can name its own warning (alertText) - an overdue audit, a held time entry -
// instead of the signature wording.
import { usePathname } from 'next/navigation';
import { useEffect, useState, type FocusEvent, type ReactNode } from 'react';
import { ALERT_BOUNDARY_LABEL, BACK_TO_DESK_BLOTTER_LABEL, DESK_RETURN_STORAGE_KEY, DASHBOARD_TABS, type DeskDrawerSpec } from '@kofc/shared';
import { cx, EmbeddedModuleContext } from '@/components/ui';
import { DeskLink, DeskRow } from '@/components/WorkspaceTabs';

/** What a desk shows on one handle beside its title: a count, and whether the Alert Boundary Accent is lit. */
export interface DeskDrawerStatus {
  count?: number | null;
  alert?: boolean;
  /** The warning the lit accent reads (default ALERT_BOUNDARY_LABEL, the signature wording). */
  alertText?: string;
}

interface DeskReturn {
  anchor: string;
  title: string;
}

function rememberDesk(value: DeskReturn | null) {
  try {
    if (value) window.sessionStorage.setItem(DESK_RETURN_STORAGE_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(DESK_RETURN_STORAGE_KEY);
  } catch {
    // Storage may be blocked; the drawer still works, only the frame anchor is lost.
  }
}

function readDeskReturn(): DeskReturn | null {
  try {
    const raw = window.sessionStorage.getItem(DESK_RETURN_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<DeskReturn>) : null;
    return parsed && typeof parsed.anchor === 'string' && typeof parsed.title === 'string' ? (parsed as DeskReturn) : null;
  } catch {
    return null;
  }
}

/** One closed drawer on the blotter: a large button with the module's name, its one-line summary and its status. */
function DeskDrawerHandle({ spec, status, onOpen }: { spec: DeskDrawerSpec; status?: DeskDrawerStatus; onOpen: () => void }) {
  const alert = !!status?.alert;
  const alertText = status?.alertText ?? ALERT_BOUNDARY_LABEL;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      data-alert-boundary={alert ? 'true' : undefined}
      data-featured={spec.featured ? 'true' : undefined}
      aria-label={`${spec.title}${status?.count != null ? `, ${status.count} waiting` : ''}${alert ? `, ${alertText}` : ''}. Open the drawer.`}
      className={cx(
        'flex h-full w-full flex-col gap-2 rounded bg-white px-4 py-3 text-left text-navy hover:bg-gold/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold',
        spec.featured && 'bg-gold/10 py-5',
        alert ? 'border-4 border-brand-red motion-safe:animate-alert-boundary' : 'border-2 border-navy border-t-8 border-t-gold',
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className={cx('font-serif font-bold leading-tight', spec.featured ? 'text-2xl' : 'text-lg')}>
          {spec.featured ? <span aria-hidden="true">⭐ </span> : null}
          {spec.title}
        </span>
        {status?.count != null ? (
          <span className={cx('rounded px-2 py-0.5 text-lg font-bold', status.count > 0 ? 'bg-brand-red text-white' : 'bg-line text-navy')}>{status.count}</span>
        ) : null}
      </span>
      <span className="text-sm">{spec.summary}</span>
      {alert ? <span className="text-sm font-bold text-brand-red">🔴 {alertText}</span> : null}
      <span className="mt-auto text-sm font-bold underline">Open drawer ▸</span>
    </button>
  );
}

/** The open drawer: a dimmed desk behind, the module on the right, and the way back at its foot. */
function DeskActionDrawer({ spec, onClose, children }: { spec: DeskDrawerSpec; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label={`Close ${spec.title}`} onClick={onClose} className="absolute inset-0 cursor-default bg-navy/40" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={spec.title}
        className="relative flex h-full w-[60rem] max-w-full flex-col border-l-8 border-gold bg-white shadow-2xl motion-safe:animate-slide-in"
      >
        <header data-surface="navy" className="flex items-center justify-between gap-3 bg-navy px-4 py-3 text-white">
          <h2 className="font-serif text-xl font-bold">{spec.title}</h2>
          <button type="button" onClick={onClose} className="font-bold underline">
            Close
          </button>
        </header>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <EmbeddedModuleContext.Provider value={true}>{children}</EmbeddedModuleContext.Provider>
        </div>
        <footer className="border-t-2 border-navy px-5 py-3">
          <button type="button" onClick={onClose} className="rounded border-2 border-navy px-4 py-2 font-bold text-navy hover:bg-gold">
            {BACK_TO_DESK_BLOTTER_LABEL}
          </button>
        </footer>
      </aside>
    </div>
  );
}

/**
 * A desk blotter: the reader's drawer handles in a grid, and the one drawer open at a time. `render` mounts a drawer's
 * module only while it is open; `onClosed` lets the desk re-read its counts. A badge click-through that focuses a handle's
 * row (DESK_FOCUS_TARGETS) opens that drawer.
 */
export function DeskBlotter({
  desk,
  drawers,
  status,
  render,
  onClosed,
}: {
  desk: DeskDrawerSpec['desk'];
  drawers: readonly DeskDrawerSpec[];
  status?: (spec: DeskDrawerSpec) => DeskDrawerStatus | undefined;
  render: (spec: DeskDrawerSpec) => ReactNode;
  onClosed?: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = drawers.find((d) => d.rowId === openId) ?? null;
  const deskTitle = DASHBOARD_TABS.find((t) => t.id === desk)?.label ?? 'Desk';

  const openDrawer = (spec: DeskDrawerSpec) => {
    rememberDesk({ anchor: desk, title: deskTitle });
    setOpenId(spec.rowId);
  };
  const close = () => {
    rememberDesk(null);
    setOpenId(null);
    onClosed?.();
  };
  const onRowFocus = (spec: DeskDrawerSpec) => (e: FocusEvent<HTMLDivElement>) => {
    // Only the click-through's focus on the row itself opens it, never tabbing onto the handle.
    if ((e.target as HTMLElement).id === spec.rowId) openDrawer(spec);
  };

  return (
    <>
      <div role="group" aria-label={`${deskTitle} blotter`} data-desk={desk} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {drawers.map((spec) => (
          <div key={spec.rowId} onFocus={onRowFocus(spec)} className={cx(spec.featured && 'md:col-span-2 xl:col-span-3')}>
            <DeskRow id={spec.rowId} label={spec.title}>
              <DeskDrawerHandle spec={spec} status={status?.(spec)} onOpen={() => openDrawer(spec)} />
            </DeskRow>
          </div>
        ))}
      </div>
      {open ? (
        <DeskActionDrawer spec={open} onClose={close}>
          {render(open)}
        </DeskActionDrawer>
      ) : null}
    </>
  );
}

/**
 * The frame's safety anchor (Sprint 8P Stage 2): on any page but the dashboard, while this browser remembers a drawer's
 * desk, '[ 🔀 Back to Desk Blotter ]' returns to it. Opening the dashboard forgets it.
 */
export function BackToDeskBlotterAnchor() {
  const pathname = usePathname();
  const [target, setTarget] = useState<DeskReturn | null>(null);
  useEffect(() => {
    if (pathname === '/dashboard') {
      rememberDesk(null);
      setTarget(null);
    } else {
      setTarget(readDeskReturn());
    }
  }, [pathname]);
  if (!target) return null;
  return (
    <div className="border-b-2 border-gold bg-white px-6 py-2">
      <DeskLink anchor={target.anchor} className="inline-block rounded border-2 border-navy px-3 py-1 text-sm font-bold text-navy hover:bg-gold">
        {BACK_TO_DESK_BLOTTER_LABEL}
      </DeskLink>
      <span className="ml-3 text-sm">Return to the {target.title}.</span>
    </div>
  );
}
