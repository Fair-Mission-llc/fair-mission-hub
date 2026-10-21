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
// Sprint 8S Revision 7: the blotter is a split-view console - a 25% left filing spine of flat folder links (the Dynamic
// Priority Float of lit folders on top, then the Inbound/Outbound cabinets on the Financial Secretary and Treasurer Desks)
// beside a 75% Desk Blotter stage where the chosen folder's module opens in place, instead of an overlay drawer.
// Sprint 8S Revision 10.1: clicking a folder snaps the window to the top (snapViewportToTop), smoothly unless the reader
// prefers reduced motion, so the opened module is in full view.
import { usePathname } from 'next/navigation';
import { useEffect, useState, type FocusEvent, type ReactNode } from 'react';
import { ALERT_BOUNDARY_LABEL, BACK_TO_DESK_BLOTTER_LABEL, DESK_RETURN_STORAGE_KEY, DASHBOARD_TABS, deskSpineSections, type DeskDrawerSpec } from '@kofc/shared';
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

/** Scrolls the window to its very top: smoothly, or at once for a reader who prefers reduced motion. */
export function snapViewportToTop() {
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, left: 0, behavior: reduced ? 'auto' : 'smooth' });
}

/** One folder link on the left filing spine: the module's name and its status, flat (no nesting). */
function SpineFolder({ spec, status, selected, onOpen }: { spec: DeskDrawerSpec; status?: DeskDrawerStatus; selected: boolean; onOpen: () => void }) {
  const alert = !!status?.alert;
  const alertText = status?.alertText ?? ALERT_BOUNDARY_LABEL;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={selected ? 'true' : undefined}
      aria-controls="desk-blotter-stage"
      data-alert-boundary={alert ? 'true' : undefined}
      data-featured={spec.featured ? 'true' : undefined}
      aria-label={`${spec.title}${status?.count != null ? `, ${status.count} waiting` : ''}${alert ? `, ${alertText}` : ''}. Open on the Desk Blotter.`}
      className={cx(
        'flex w-full flex-col gap-1 rounded bg-white px-3 py-2 text-left text-navy hover:bg-gold/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold',
        spec.featured && 'bg-gold/10',
        selected && 'bg-gold/30',
        alert ? 'border-4 border-brand-red motion-safe:animate-alert-boundary' : cx('border-2 border-navy', selected && 'border-l-8 border-l-gold'),
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="font-serif font-bold leading-tight">
          {spec.featured ? <span aria-hidden="true">⭐ </span> : null}
          {spec.title}
        </span>
        {status?.count != null ? (
          <span className={cx('rounded px-2 py-0.5 text-sm font-bold', status.count > 0 ? 'bg-brand-red text-white' : 'bg-line text-navy')}>{status.count}</span>
        ) : null}
      </span>
      {alert ? <span className="text-xs font-bold text-brand-red">🔴 {alertText}</span> : null}
    </button>
  );
}

/** The right-hand Desk Blotter stage: the chosen folder's module, worked in place, and the way back at its foot. */
function BlotterStage({ spec, onClose, children }: { spec: DeskDrawerSpec; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <section aria-label={spec.title} className="flex min-w-0 flex-col border-2 border-navy border-l-8 border-l-gold bg-white motion-safe:animate-slide-in">
      <header data-surface="navy" className="flex items-center justify-between gap-3 bg-navy px-4 py-3 text-white">
        <h2 className="font-serif text-xl font-bold">{spec.title}</h2>
        <button type="button" onClick={onClose} className="font-bold underline">
          Close
        </button>
      </header>
      <p className="border-b border-line px-5 py-2 text-sm">{spec.summary}</p>
      <div className="flex flex-col gap-4 p-5">
        <EmbeddedModuleContext.Provider value={true}>{children}</EmbeddedModuleContext.Provider>
      </div>
      <footer className="border-t-2 border-navy px-5 py-3">
        <button type="button" onClick={onClose} className="rounded border-2 border-navy px-4 py-2 font-bold text-navy hover:bg-gold">
          {BACK_TO_DESK_BLOTTER_LABEL}
        </button>
      </footer>
    </section>
  );
}

/**
 * A desk console (Sprint 8S Revision 7, the Left Dual-Cabinet Rail): a 25% left filing spine of flat folder links
 * (deskSpineSections - the Dynamic Priority Float on top, then the Inbound and Outbound cabinets on the Financial
 * Secretary and Treasurer Desks, or one flat list) beside a 75% right Desk Blotter stage where the chosen folder's module
 * opens in place. `render` mounts a folder's module only while it is open; `onClosed` lets the desk re-read its counts.
 * A badge click-through that focuses a folder's row (DESK_FOCUS_TARGETS) opens that folder.
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
  const sections = deskSpineSections(desk, drawers, (spec) => !!status?.(spec)?.alert);
  const waiting = sections.find((s) => s.id === 'priority')?.drawers.length ?? 0;

  const openDrawer = (spec: DeskDrawerSpec) => {
    rememberDesk({ anchor: desk, title: deskTitle });
    setOpenId(spec.rowId);
  };
  const close = () => {
    rememberDesk(null);
    setOpenId(null);
    onClosed?.();
  };
  const onRowFocus = (spec: DeskDrawerSpec) => (e: FocusEvent<HTMLLIElement>) => {
    // Only the click-through's focus on the row itself opens it, never tabbing onto the folder link.
    if ((e.target as HTMLElement).id === spec.rowId) openDrawer(spec);
  };

  return (
    <div data-desk={desk} className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_3fr]">
      <nav aria-label={`${deskTitle} filing spine`} className="flex min-w-0 flex-col gap-4 self-start md:sticky md:top-4">
        {sections.map((section) => (
          <div
            key={section.id}
            role="group"
            aria-label={section.label || `${deskTitle} folders`}
            data-spine-section={section.id}
            className={cx(
              'flex flex-col gap-2',
              section.id === 'priority' && 'rounded border-4 border-brand-red bg-brand-red/5 p-2',
              section.id !== 'priority' && section.label && 'rounded border-2 border-navy p-2',
            )}
          >
            {section.label ? (
              <h3 className={cx('font-serif text-sm font-bold uppercase', section.id === 'priority' ? 'text-brand-red' : 'text-navy')}>
                {section.id === 'priority' ? '🔴 ' : ''}
                {section.label}
              </h3>
            ) : null}
            <ul className="flex flex-col gap-2">
              {section.drawers.map((spec) => (
                <li key={spec.rowId} onFocus={onRowFocus(spec)}>
                  <DeskRow id={spec.rowId} label={spec.title}>
                    <SpineFolder
                      spec={spec}
                      status={status?.(spec)}
                      selected={spec.rowId === openId}
                      onOpen={() => {
                        openDrawer(spec);
                        snapViewportToTop();
                      }}
                    />
                  </DeskRow>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div id="desk-blotter-stage" className="min-w-0">
        {open ? (
          <BlotterStage key={open.rowId} spec={open} onClose={close}>
            {render(open)}
          </BlotterStage>
        ) : (
          <div className="rounded border-2 border-dashed border-navy bg-white p-6 text-navy">
            <h2 className="font-serif text-xl font-bold">{deskTitle} Blotter</h2>
            <p className="mt-2">Choose a folder on the left. It opens here, so you can do the work without leaving the desk.</p>
            {waiting > 0 ? (
              <p className="mt-2 font-bold text-brand-red">
                {waiting} {waiting === 1 ? 'folder is' : 'folders are'} waiting on you at the top of the spine.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
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
