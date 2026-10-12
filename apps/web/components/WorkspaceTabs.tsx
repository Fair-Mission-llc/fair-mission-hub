'use client';
// Sprint 7J Extension 2: the workspace tab row (Home and the Officer Desks the reader's seat clears, officer-desks.ts
// dashboardTabsFor) moves out of /dashboard into the portal frame. It sits under the navy header on every page, so a
// reader can browse the sidebar and come back to a desk in one click: /dashboard#<anchor>. Only readers who may open
// /dashboard (the 'dashboard' portal area) get the row. The dashboard page reads the open tab with useDashboardTab.
//
// Sprint 8A: the row is titled Active Desks and each tab is drawn as a card-index folder tab - a navy outline jacket with
// rounded top corners and roomy padding, the open folder raised in white with a deep gold top edge so it joins the page
// under it. DeskLink is the same one-click jump for the Home tab's status badges.
//
// Sprint 8C: a badge's DeskLink also names the workspace row it stands for (rowId, officer-desks.ts DESK_FOCUS_TARGETS):
// once the desk has drawn, the row scrolls into view, takes focus and flashes a gold ring (DeskRow). The sidebar's
// Executive Dashboard link is a DeskLink to Home, so it resets the view to the landing deck.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ACTIVE_DESKS_TITLE, dashboardTabFromAnchor, dashboardTabsFor, type DashboardTab, type DashboardTabId, type SessionUser } from '@kofc/shared';
import { cx } from '@/components/ui';

/** This browser's last dashboard tab (a per-viewer convenience; the portal works without it). */
const LAST_TAB_KEY = 'kofc.dashboard.tab';

function readLastTab(): string | null {
  try {
    return window.localStorage.getItem(LAST_TAB_KEY);
  } catch {
    return null;
  }
}

function rememberTab(anchor: string) {
  try {
    window.localStorage.setItem(LAST_TAB_KEY, anchor);
  } catch {
    // Storage blocked: the tab still opens, it is just not remembered.
  }
}

/**
 * The dashboard tab now open: the URL anchor wins; without one, the tab this browser opened last. A tab the reader
 * lacks falls back to Home. It re-reads on every page change and on every anchor change.
 */
export function useDashboardTab(tabs: readonly DashboardTab[]): DashboardTabId {
  const pathname = usePathname();
  const [tab, setTab] = useState<DashboardTabId>('home');
  const latest = useRef(tabs);
  latest.current = tabs;
  const ids = tabs.map((t) => t.id).join(',');
  useEffect(() => {
    const pick = () => setTab(dashboardTabFromAnchor(window.location.hash || readLastTab(), latest.current));
    pick();
    window.addEventListener('hashchange', pick);
    return () => window.removeEventListener('hashchange', pick);
  }, [pathname, ids]);
  // Sprint 8B: a Historian-only reader has no Home tab, so the fallback is the reader's first tab.
  return tabs.some((t) => t.id === tab) ? tab : (tabs[0]?.id ?? 'home');
}

/** How long focusDeskRow waits for the desk to draw the row (it may still be loading). */
const ROW_SEEK_MS = 5000;
const ROW_SEEK_STEP_MS = 50;

/** Scrolls the workspace row `rowId` into view once it exists, focuses it and flashes its gold ring for two seconds. */
function focusDeskRow(rowId: string) {
  let waited = 0;
  const seek = () => {
    const row = document.getElementById(rowId);
    if (!row) {
      waited += ROW_SEEK_STEP_MS;
      if (waited < ROW_SEEK_MS) window.setTimeout(seek, ROW_SEEK_STEP_MS);
      return;
    }
    row.scrollIntoView({ behavior: 'smooth', block: 'start' });
    row.focus({ preventScroll: true });
    row.dataset.deskFocus = 'true';
    window.setTimeout(() => delete row.dataset.deskFocus, 2000);
  };
  window.setTimeout(seek, 0);
}

/**
 * One workspace row of an Active Desk (Sprint 8C): the target a Home badge's click-through scrolls to. It takes focus
 * programmatically only (tabIndex -1) and draws a gold ring while it is the badge's fresh target.
 */
export function DeskRow({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div id={id} tabIndex={-1} aria-label={label} className="scroll-mt-16 rounded outline-none transition-shadow data-[desk-focus=true]:ring-4 data-[desk-focus=true]:ring-gold">
      {children}
    </div>
  );
}

/**
 * A link to one Active Desk (/dashboard#<anchor>). On the dashboard it changes only the anchor, which the page hears as a
 * hashchange; anywhere else it navigates. Either way this browser remembers the desk. With `rowId` (Sprint 8C) it then
 * brings that workspace row of the desk into view.
 */
export function DeskLink({
  anchor,
  className,
  current,
  label,
  rowId,
  children,
}: {
  anchor: string;
  className?: string;
  current?: boolean;
  label?: string;
  rowId?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const onDashboard = pathname === '/dashboard';
  return (
    <Link
      href={`/dashboard#${anchor}`}
      aria-current={current ? 'page' : undefined}
      aria-label={label}
      onClick={(e) => {
        rememberTab(anchor);
        if (onDashboard) {
          e.preventDefault();
          window.location.hash = anchor;
        }
        if (rowId) focusDeskRow(rowId);
      }}
      className={className}
    >
      {children}
    </Link>
  );
}

/** The frame's Active Desks row of folder tabs, pinned to the top of the window while the page scrolls. */
export function WorkspaceTabs({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const tabs = dashboardTabsFor(user, user.councilId);
  const open = useDashboardTab(tabs);
  const onDashboard = pathname === '/dashboard';

  return (
    <nav aria-label={ACTIVE_DESKS_TITLE} className="sticky top-0 z-10 flex items-end gap-1 overflow-x-auto border-b-[3px] border-navy bg-white px-6 pt-2">
      <span className="mb-2 mr-3 shrink-0 font-serif text-sm font-black uppercase tracking-widest text-navy">{ACTIVE_DESKS_TITLE}</span>
      {tabs.map((tab) => {
        const here = onDashboard && tab.id === open;
        return (
          <DeskLink
            key={tab.id}
            anchor={tab.anchor}
            current={here}
            className={cx(
              // A folder tab: navy outline on three sides, rounded top corners; the open one is raised, white and gold-topped
              // and laps over the row's navy rule so it reads as the front folder.
              'relative -mb-[3px] shrink-0 whitespace-nowrap rounded-t-lg border-x-2 border-t-2 border-navy px-5 text-sm font-bold',
              here
                ? 'z-10 border-t-[6px] border-t-gold border-b-[3px] border-b-white bg-white pb-2.5 pt-2 text-navy'
                : 'border-b-[3px] border-b-navy bg-navy/10 py-2 text-navy hover:bg-gold/20',
            )}
          >
            {tab.label}
          </DeskLink>
        );
      })}
    </nav>
  );
}
