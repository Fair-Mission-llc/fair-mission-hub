'use client';
// Sprint 7J Extension 2: the workspace tab row (Home and the Officer Desks the reader's seat clears, officer-desks.ts
// dashboardTabsFor) moves out of /dashboard into the portal frame. It sits under the navy header on every page, so a
// reader can browse the sidebar and come back to a desk in one click: /dashboard#<anchor>. Only readers who may open
// /dashboard (the 'dashboard' portal area) get the row. The dashboard page reads the open tab with useDashboardTab.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { dashboardTabFromAnchor, dashboardTabsFor, type DashboardTab, type DashboardTabId, type SessionUser } from '@kofc/shared';
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

/** The frame's tab row, pinned to the top of the window while the page scrolls. */
export function WorkspaceTabs({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const tabs = dashboardTabsFor(user, user.councilId);
  const open = useDashboardTab(tabs);
  const onDashboard = pathname === '/dashboard';

  return (
    <nav aria-label="Workspace tabs" className="sticky top-0 z-10 flex flex-wrap border-b-2 border-navy bg-white px-6">
      {tabs.map((tab) => {
        const here = onDashboard && tab.id === open;
        return (
          <Link
            key={tab.id}
            href={`/dashboard#${tab.anchor}`}
            aria-current={here ? 'page' : undefined}
            onClick={(e) => {
              rememberTab(tab.anchor);
              // Already on the dashboard: change the anchor only, which the page hears as a hashchange.
              if (onDashboard) {
                e.preventDefault();
                window.location.hash = tab.anchor;
              }
            }}
            className={cx('border-b-4 px-4 py-2 text-sm font-bold', here ? 'border-gold text-navy' : 'border-transparent text-muted hover:text-navy')}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
