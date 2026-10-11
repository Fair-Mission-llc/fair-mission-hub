'use client';
// Navigation Guide (Sprint 7C Extension): "Navigation Explained" for the signed-in member, pinned above the sidebar
// pillars for everyone. navigationGuide (navigation-guide.ts) reads the member type and Role names and lists exactly the
// links this member's sidebar shows - the same feature flags and tenant gate apply - each with one plain-English
// sentence, then the header's menus. An ordinary member's guide therefore holds no leadership or finance desks. Black
// on white, bold labels, for easy reading.
// Sprint 7E: "Your time limits" lists the windows and reminder timings in force for this member right now
// (navigationTimings), read live from their council's settings and the platform's, never fixed numbers.
import Link from 'next/link';
import { navigationGuide, navigationTimings, whiteLabel } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { usePlatformSettings } from '@/components/SettingsParts';
import { NAV } from '@/components/Sidebar';
import { PageTitle } from '@/components/ui';
import { useFeatureFlags, useTenantType, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

export default function NavigationGuidePage() {
  const user = useUser();
  const tenant = useTenantType();
  const guide = navigationGuide(user, useFeatureFlags(), tenant);
  const text = (s: string) => whiteLabel(s, tenant);
  const council = useLoad(() => db.councils.get(user.councilId), [user.councilId]);
  const platform = usePlatformSettings();
  const timings = navigationTimings(user, council.data, platform);
  const inUse = timings.filter((t) => t.inUse);
  const planned = timings.filter((t) => !t.inUse);
  return (
    <RequireArea area="navigation-guide">
      <PageTitle>Navigation Guide</PageTitle>
      <div className="flex flex-col gap-5 rounded border-2 border-black bg-white p-5 text-black">
        <section aria-labelledby="guide-persona">
          <h2 id="guide-persona" className="text-lg font-bold">
            You are signed in as: {guide.persona}
            {guide.roles.length > 0 ? ` (${guide.roles.join(', ')})` : ''}
          </h2>
          <p className="text-base">{text(guide.summary)} Each link below is in your sidebar, in the same order.</p>
        </section>
        {guide.groups.map((group) => (
          <section key={group.id} aria-labelledby={`guide-${group.id}`} className="border-t-2 border-black pt-3">
            <h2 id={`guide-${group.id}`} className="mb-2 text-lg font-bold uppercase tracking-wide">
              {text(group.label)}
            </h2>
            <dl className="flex flex-col gap-2">
              {group.entries.map(({ item, explanation }) => (
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
          </section>
        ))}
        <section aria-labelledby="guide-timings" className="border-t-2 border-black pt-3">
          <h2 id="guide-timings" className="mb-1 text-lg font-bold uppercase tracking-wide">
            Your time limits
          </h2>
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
        </section>
        <section aria-labelledby="guide-top-bar" className="border-t-2 border-black pt-3">
          <h2 id="guide-top-bar" className="mb-2 text-lg font-bold uppercase tracking-wide">
            In the top bar
          </h2>
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
        </section>
      </div>
    </RequireArea>
  );
}
