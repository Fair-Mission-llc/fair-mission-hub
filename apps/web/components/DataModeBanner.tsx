'use client';
// Sprint 11 Revision 20.0 (data-modes.ts): the global data-mode banner, pinned to the top edge of the window on every
// page, signed in or not. Testing Mode draws the amber warning banner, Training Mode the cobalt blue notice banner;
// Production draws nothing. The mode comes from the server (GET /api/sync/replicate answers dataMode), so the banner
// always matches the database file the server actually opened. useDataMode also tells the sign-in screen whether to
// show the Training Profile Selection Board.
import { useEffect, useState } from 'react';
import { dataModeBanner, HUB_SYNC_ROUTE, parseDataMode, type DataMode } from '@kofc/shared';

let cached: Promise<DataMode> | null = null;

/** The server's data mode, asked once per page load. Production until the answer comes. */
export function useDataMode(): DataMode {
  const [mode, setMode] = useState<DataMode>('production');
  useEffect(() => {
    let live = true;
    cached ??= fetch(HUB_SYNC_ROUTE, { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<{ dataMode?: unknown }>) : null))
      .then((body) => parseDataMode(body?.dataMode))
      .catch(() => 'production' as const);
    void cached.then((m) => {
      if (live) setMode(m);
    });
    return () => {
      live = false;
    };
  }, []);
  return mode;
}

export function DataModeBanner() {
  const banner = dataModeBanner(useDataMode());
  if (!banner) return null;
  return (
    <div
      role={banner.tone === 'amber' ? 'alert' : 'status'}
      data-data-mode={banner.mode}
      className={
        banner.tone === 'amber'
          ? 'sticky top-0 z-[60] w-full border-b-4 border-banner-amber-edge bg-banner-amber px-6 py-2 text-center text-sm font-bold text-banner-ink'
          : 'sticky top-0 z-[60] w-full border-b-4 border-banner-cobalt-edge bg-banner-cobalt px-6 py-2 text-center text-sm font-bold text-white'
      }
    >
      <span className="uppercase tracking-wide">{banner.title}</span>
      <span className="mx-2" aria-hidden="true">
        ·
      </span>
      <span className="font-normal">{banner.text}</span>
    </div>
  );
}
