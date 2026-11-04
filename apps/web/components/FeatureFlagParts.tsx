'use client';
// The Master Feature Deployment Grid (Sprint 11 Revision 7.0; the Feature Flags Control Center of Sprint 6R, moved here in
// Sprint 8O so the Super Admin Desk's [ 🛠️ System Feature Flag Control Panel ] folder, /feature-flags and /super-admin
// draw the same panel). A row per module switch, a column per council, grouped as the lightweight footprint and the
// premium modules (features.ts featureFlagTier). Each checkbox saves at once (councils.setFeatureFlags); a column's
// 'Lightweight' button sets that council to LIGHTWEIGHT_FEATURE_FLAGS in one save. The drivers refuse anyone but a
// Super Admin (SUPER_ADMIN_REQUIRED), and the page is a Super Admin area, so council Admins never see it.
// Sprint 11 Revision 8.0: every switch is premium now. The top block lists the core systems (ALWAYS_ON_MODULES) with an
// 'Always on' cell per council and no checkbox.
import { useState } from 'react';
import {
  ALWAYS_ON_MODULES,
  councilFeatureFlags,
  describeError,
  FEATURE_FLAG_LABELS,
  FEATURE_FLAG_NAMES,
  featureFlagTier,
  LIGHTWEIGHT_FEATURE_FLAGS,
  type Council,
  type FeatureFlagName,
  type FeatureFlags,
} from '@kofc/shared';
import { Button, cx, Notice, Panel } from '@/components/ui';
import { useSession, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const GROUPS = [{ tier: 'premium' as const, title: 'Premium modules', note: 'Off for a new council until a Super Admin turns them on.' }];

/** The title of the grid's top block: the core systems, which have no switch. */
export const CORE_SYSTEMS_TITLE = 'Core systems (always on)';

function FlagGrid({ councils, onSaved }: { councils: Council[]; onSaved: () => Promise<void> }) {
  const user = useUser();
  const { featuresChanged } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const save = async (council: Council, changes: Partial<FeatureFlags>, done: string, key: string) => {
    setBusy(key);
    setMessage(null);
    try {
      await db.councils.setFeatureFlags(user.memberId, council.id, changes);
      await onSaved();
      if (council.id === user.councilId) featuresChanged();
      setMessage({ tone: 'info', text: done });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };

  const flagsOf = new Map(councils.map((c) => [c.id, councilFeatureFlags(c)]));

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <div className="overflow-x-auto rounded border border-line">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Module switches of every council: a row per module, a column per council</caption>
          <thead>
            <tr className="bg-navy text-left text-xs uppercase tracking-wide text-white">
              <th scope="col" className="sticky left-0 bg-navy px-3 py-2 font-bold">
                Module
              </th>
              {councils.map((c) => {
                const on = FEATURE_FLAG_NAMES.filter((n) => flagsOf.get(c.id)?.[n]).length;
                return (
                  <th key={c.id} scope="col" className="px-2 py-2 text-center font-bold">
                    <span className="block whitespace-nowrap">No. {c.CouncilNumber}</span>
                    <span className="block font-normal normal-case tracking-normal">
                      {on} / {FEATURE_FLAG_NAMES.length} on
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-1 normal-case tracking-normal"
                      disabled={busy !== null}
                      aria-label={`Set council ${c.CouncilNumber} to the lightweight footprint`}
                      onClick={() => void save(c, LIGHTWEIGHT_FEATURE_FLAGS, `Council ${c.CouncilNumber} now has the lightweight footprint.`, `${c.id}-light`)}
                    >
                      Lightweight
                    </Button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t-2 border-navy bg-gold/20">
              <th scope="rowgroup" colSpan={councils.length + 1} className="px-3 py-1.5 text-left">
                <span className="font-serif font-bold">{CORE_SYSTEMS_TITLE}</span> <span className="text-xs text-muted">Every council, with no switch.</span>
              </th>
            </tr>
            {ALWAYS_ON_MODULES.map((name, i) => (
              <tr key={name} className={cx('border-t border-line', i % 2 === 1 && 'bg-white')}>
                <th scope="row" className="sticky left-0 bg-inherit px-3 py-1.5 text-left align-top font-bold">
                  {name}
                </th>
                {councils.map((c) => (
                  <td key={c.id} className="px-2 py-1.5 text-center align-middle text-xs font-bold text-muted">
                    Always on
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {GROUPS.map((group) => (
            <tbody key={group.tier}>
              <tr className="border-t-2 border-navy bg-gold/20">
                <th scope="rowgroup" colSpan={councils.length + 1} className="px-3 py-1.5 text-left">
                  <span className="font-serif font-bold">{group.title}</span> <span className="text-xs text-muted">{group.note}</span>
                </th>
              </tr>
              {FEATURE_FLAG_NAMES.filter((n) => featureFlagTier(n) === group.tier).map((name: FeatureFlagName, i) => (
                <tr key={name} className={cx('border-t border-line', i % 2 === 1 && 'bg-white')}>
                  <th scope="row" className="sticky left-0 bg-inherit px-3 py-1.5 text-left align-top font-normal">
                    <span className="block font-bold">{FEATURE_FLAG_LABELS[name].label}</span>
                    <span className="block text-xs text-muted">
                      <code>{name}</code> · {FEATURE_FLAG_LABELS[name].hint}
                    </span>
                  </th>
                  {councils.map((c) => (
                    <td key={c.id} className="px-2 py-1.5 text-center align-middle">
                      <input
                        type="checkbox"
                        className="size-5"
                        aria-label={`${FEATURE_FLAG_LABELS[name].label} for council ${c.CouncilNumber}`}
                        checked={flagsOf.get(c.id)?.[name] ?? true}
                        disabled={busy !== null}
                        onChange={(e) =>
                          void save(
                            c,
                            { [name]: e.target.checked },
                            `${FEATURE_FLAG_LABELS[name].label} is now ${e.target.checked ? 'on' : 'off'} for council ${c.CouncilNumber}.`,
                            `${c.id}-${name}`,
                          )
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

/** The module switches of every council, loaded and ready to toggle. */
export function FeatureFlagControlPanel({ title = 'Module switches by council' }: { title?: string }) {
  const councils = useLoad(() => db.councils.list(), []);
  return (
    <Panel title={title}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Clear a box to hide that module&apos;s sidebar links, pages, desk drawers, Navigation Guide entries, phone app screens and buttons for every member of
          the council; the council&apos;s custom manuals mark its sections as disabled. {ALWAYS_ON_MODULES.join(', ')} are core systems: they have no switch and
          always show. Nothing is deleted; ticking the box again restores the module. A new council starts with the lightweight footprint.
        </p>
        {councils.error ? <Notice tone="error">{councils.error}</Notice> : null}
        {councils.data ? <FlagGrid councils={councils.data} onSaved={councils.reload} /> : <p className="text-sm text-muted">Loading councils…</p>}
      </div>
    </Panel>
  );
}
