'use client';
// Navigation Guide (Sprint 7C Extension): "Navigation Explained" for the signed-in member, pinned above the sidebar
// pillars for everyone. navigationGuide (navigation-guide.ts) reads the member type and Role names and lists exactly the
// links this member's sidebar shows - the same feature flags and tenant gate apply - each with one plain-English
// sentence, then the header's menus. An ordinary member's guide therefore holds no leadership or finance desks. Black
// on white, bold labels, for easy reading.
// Sprint 7E: "Your time limits" lists the windows and reminder timings in force for this member right now
// (navigationTimings), read live from their council's settings and the platform's, never fixed numbers.
//
// Sprint 8R Corrected: the page is a sidebar-first collapsible map (navigation-map.ts navigationGuideMap). The overview
// is open; every other block starts closed: the sidebar categories (Dashboard, Calendars, Rosters, Vetting, Ledgers,
// Archives, Settings), then the reader's own desk tabs, the time limits and the phone tabs. Its depth follows the
// session: a plain member reads one summary per link and desk they can open; council leadership and Super Admins read
// the full map - the leader wording, the pillar of each link and every drawer of each desk they hold.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { navigationGuide, navigationGuideMap, navigationTimings, whiteLabel } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { usePlatformSettings } from '@/components/SettingsParts';
import { NAV } from '@/components/Sidebar';
import { PageTitle } from '@/components/ui';
import { useFeatureFlags, useTenantType, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** One collapsible block of the map; only the overview passes `open`. */
function MapBlock({ id, title, open = false, children }: { id: string; title: string; open?: boolean; children: ReactNode }) {
  return (
    <details id={`guide-${id}`} open={open} className="group border-t-2 border-black pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-lg font-bold uppercase tracking-wide">
        <span aria-hidden="true" className="w-4 shrink-0 transition-transform group-open:rotate-90">
          ›
        </span>
        {title}
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}

export default function NavigationGuidePage() {
  const user = useUser();
  const tenant = useTenantType();
  const flags = useFeatureFlags();
  const guide = navigationGuide(user, flags, tenant);
  const map = navigationGuideMap(user, flags, tenant);
  const full = map.depth === 'full';
  const text = (s: string) => whiteLabel(s, tenant);
  const council = useLoad(() => db.councils.get(user.councilId), [user.councilId]);
  const platform = usePlatformSettings();
  const timings = navigationTimings(user, council.data, platform);
  const inUse = timings.filter((t) => t.inUse);
  const planned = timings.filter((t) => !t.inUse);
  return (
    <RequireArea area="navigation-guide">
      <PageTitle>Navigation Guide</PageTitle>
      <div className="flex flex-col gap-3 rounded border-2 border-black bg-white p-5 text-black">
        <MapBlock id="overview" title="📍 Overview" open>
          <h2 id="guide-persona" className="text-lg font-bold">
            You are signed in as: {guide.persona}
            {guide.roles.length > 0 ? ` (${guide.roles.join(', ')})` : ''}
          </h2>
          <p className="text-base">
            {text(guide.summary)} The portal opens on <strong>Home</strong> after you sign in.{' '}
            {full
              ? 'You see the full map: each link with the pillar it sits in, and every drawer of your desks.'
              : 'You see a short summary of each link and desk that you can open.'}{' '}
            Select a block title below to open it.
          </p>
          <h3 className="mb-1 mt-3 text-base font-bold">In the top bar</h3>
          <dl className="flex flex-col gap-2">
            {guide.topBar.map(({ item, explanation }) => (
              <div key={item}>
                <dt>
                  <Link href={NAV[item].href} className="text-base font-bold underline">
                    {text(NAV[item].label)}
                  </Link>
                </dt>
                <dd className="text-base">{text(explanation)}</dd>
              </div>
            ))}
          </dl>
        </MapBlock>

        {map.categories.map((category) => (
          <MapBlock key={category.id} id={category.id} title={`${category.label} (${category.entries.length})`}>
            <dl className="flex flex-col gap-2">
              {category.entries.map(({ item, explanation, pillar }) => (
                <div key={item}>
                  <dt>
                    <Link href={NAV[item].href} className="text-base font-bold underline">
                      {text(NAV[item].label)}
                    </Link>
                    {pillar ? <span className="text-sm"> · sidebar: {text(pillar)}</span> : null}
                  </dt>
                  <dd className="text-base">{text(explanation)}</dd>
                </div>
              ))}
            </dl>
          </MapBlock>
        ))}

        <MapBlock id="desks" title={`🗂️ Your desks (${map.desks.length})`}>
          <dl className="flex flex-col gap-3">
            {map.desks.map((desk) => (
              <div key={desk.id}>
                <dt>
                  <Link href={`/dashboard#${desk.id}`} className="text-base font-bold underline">
                    {text(desk.label)}
                  </Link>
                </dt>
                <dd className="text-base">
                  {text(desk.summary)}
                  {desk.sections.length > 0 ? (
                    <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-6 text-sm">
                      {desk.sections.map((s) => (
                        <li key={s}>{text(s)}</li>
                      ))}
                    </ul>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </MapBlock>

        <MapBlock id="timings" title="⏱️ Your time limits">
          <p className="mb-2 text-base">
            These are your council&apos;s settings right now. Council leaders change them on Council Wide Settings; Super Admins change the shared ones
            on Global System Parameters.
          </p>
          {council.loading && !council.data ? <p className="text-base">Loading your council&apos;s settings…</p> : null}
          <dl className="flex flex-col gap-2">
            {inUse.map((t) => (
              <div key={t.name}>
                <dt className="text-base font-bold">
                  {t.label}: {t.value}
                </dt>
                <dd className="text-base">
                  {t.hint} <span className="text-sm">({t.scope === 'platform' ? 'shared by every council' : t.groupTitle})</span>
                </dd>
              </div>
            ))}
          </dl>
          {planned.length > 0 ? (
            <>
              <h3 className="mb-1 mt-3 text-base font-bold">Saved for future features (not used yet)</h3>
              <ul className="flex list-disc flex-col gap-1 pl-6">
                {planned.map((t) => (
                  <li key={t.name} className="text-base">
                    {t.label}: {t.value}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </MapBlock>

        <MapBlock id="phone" title={`📱 Phone app tabs (${map.phoneTabs.length})`}>
          <dl className="flex flex-col gap-2">
            {map.phoneTabs.map(({ tab, summary }) => (
              <div key={tab}>
                <dt className="text-base font-bold">{tab}</dt>
                <dd className="text-base">{text(summary)}</dd>
              </div>
            ))}
          </dl>
        </MapBlock>
      </div>
    </RequireArea>
  );
}
