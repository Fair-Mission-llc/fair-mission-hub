'use client';
// Sprint 7J Extension 2: the workspace tab row (Home and the Officer Desks the reader's seat clears, officer-desks.ts
// dashboardTabsFor) moves out of /dashboard into the portal frame. It sits under the navy header on every page, so a
// reader can browse the sidebar and come back to a desk in one click: /dashboard#<anchor>. Only readers who may open
// /dashboard (the 'dashboard' portal area) get the row. The dashboard page reads the open tab with useDashboardTab.
//
// Sprint 8A: the row is titled Active Desks and each tab is drawn as a card-index folder tab - a navy outline jacket with
// rounded top corners and roomy padding, the open folder raised in white with a deep gold top edge so it joins the page
// under it. DeskLink is the same one-click jump for the Home tab's status badges.
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
  return tabs.some((t) => t.id === tab) ? tab : 'home';
}

/**
 * A link to one Active Desk (/dashboard#<anchor>). On the dashboard it changes only the anchor, which the page hears as a
 * hashchange; anywhere else it navigates. Either way this browser remembers the desk.
 */
export function DeskLink({ anchor, className, current, label, children }: { anchor: string; className?: string; current?: boolean; label?: string; children: ReactNode }) {
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
