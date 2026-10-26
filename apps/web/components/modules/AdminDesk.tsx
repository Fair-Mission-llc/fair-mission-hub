'use client';
// The Admin Desk (Sprint 11 Revision 2.0, /admin-desk, admin-desk.ts): a council Admin's own workspace, for Admins and
// Super Admins (canOpenAdminDesk). The left rail is a stack of vertical drawers (ADMIN_DESK_DRAWERS) that all land closed;
// opening one draws its panel to the right of the rail, and opening another swaps it. In order:
//   1. Administration Manual PDF        the PDF link and 'Regenerate Manuals On-Demand' (POST MANUAL_REGENERATION_ROUTE)
//   2. 'How Do I...' Local Help Search  the Administration Manual's task workflows
//   3. Council Wide Settings            components/modules/CouncilWideSettings.tsx
//   4. Council Lookup Tables            components/modules/CouncilLookupTables.tsx
//   5. Credentials Vault                pinned to the reader's home council (homeCouncilOnly; the server's vault gate agrees)
//   6. Global Charities Registry        components/modules/GlobalCharitiesRegistry.tsx
//   7. Council Asset Management         the inventory of components/modules/CouncilAssetManagement.tsx
//   8. Administrative Feedback Loops    the note to the platform owner, and the inbox for Super Admins
// A panel mounts only while its drawer is open, so a closed drawer reads no data.
import { useEffect, useState } from 'react';
import {
  ADMIN_DESK_DRAWERS,
  ADMIN_DESK_TITLE,
  ADMIN_MANUAL,
  formatTimestamp,
  isSuperAdmin,
  MANUAL_REGENERATION_ROUTE,
  NIGHTLY_MANUAL_REBUILD_HOUR,
  type AdminDeskDrawerId,
  type ManualRegenerationStatus,
} from '@kofc/shared';
import { DeskManualHeader } from '@/components/DeskManualHeader';
import { AdminFeedbackForm, FeedbackInbox } from '@/components/FeedbackParts';
import { CouncilAssetInventory } from '@/components/modules/CouncilAssetManagement';
import { CouncilLookups } from '@/components/modules/CouncilLookupTables';
import { CouncilWideSettings } from '@/components/modules/CouncilWideSettings';
import { CredentialsVaultPanel } from '@/components/modules/CredentialsVaultPanel';
import { GlobalCharitiesRegistry } from '@/components/modules/GlobalCharitiesRegistry';
import { Button, cx, EmbeddedModuleContext, Notice, PageTitle } from '@/components/ui';
import { useUser } from '@/lib/session';

async function readRegenerationStatus(init?: RequestInit): Promise<ManualRegenerationStatus> {
  const res = await fetch(MANUAL_REGENERATION_ROUTE, { cache: 'no-store', ...init });
  const body = (await res.json().catch(() => null)) as (ManualRegenerationStatus & { message?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.message ?? 'The manual rebuild could not be reached.');
  return body;
}

/** 'Regenerate Manuals On-Demand': starts a rebuild of every manual PDF and follows it until it finishes. */
function RegenerateManualsButton() {
  const [status, setStatus] = useState<ManualRegenerationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void readRegenerationStatus().then(setStatus, (err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  // While a rebuild runs, look again every few seconds.
  useEffect(() => {
    if (!status?.running) return;
    const timer = window.setTimeout(() => {
      void readRegenerationStatus().then(setStatus, (err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const start = async () => {
    setError(null);
    try {
      setStatus(await readRegenerationStatus({ method: 'POST' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section aria-label="Regenerate manuals" className="flex flex-col gap-2 rounded border-2 border-navy bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void start()} disabled={status?.running === true}>
          {status?.running ? 'Rebuilding the manuals…' : 'Regenerate Manuals On-Demand'}
        </Button>
        <p className="text-sm text-muted">
          Rebuilds every manual PDF - the three role books, the member guide and this Administration Manual - from the current text. The server also
          rebuilds them every night at {NIGHTLY_MANUAL_REBUILD_HOUR}:00.
        </p>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {status && !status.running && status.finishedAt ? (
        <Notice tone={status.ok ? 'info' : 'error'}>
          {status.message} {status.trigger === 'nightly' ? 'Nightly run' : 'On-demand run'} finished {formatTimestamp(status.finishedAt)}.
        </Notice>
      ) : null}
      {status?.nextNightlyRun ? <p className="text-xs text-muted">Next nightly rebuild: {formatTimestamp(status.nextNightlyRun)}.</p> : null}
    </section>
  );
}

function AdministrativeFeedbackPanel() {
  const user = useUser();
  const [sent, setSent] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">A direct line from your council&apos;s Admins to the platform owner. Report a problem, ask for a change or share what is working.</p>
      <AdminFeedbackForm onSent={() => setSent((n) => n + 1)} />
      {isSuperAdmin(user) ? <FeedbackInbox version={sent} /> : null}
    </div>
  );
}

function DrawerPanel({ id }: { id: AdminDeskDrawerId }) {
  switch (id) {
    case 'admin-manual':
      return (
        <div className="flex flex-col gap-3">
          <DeskManualHeader manual={ADMIN_MANUAL.token} show="pdf" />
          <RegenerateManualsButton />
        </div>
      );
    case 'help-search':
      return <DeskManualHeader manual={ADMIN_MANUAL.token} show="search" />;
    case 'council-settings':
      return <CouncilWideSettings embedded />;
    case 'council-lookups':
      return <CouncilLookups embedded />;
    case 'credentials-vault':
      return <CredentialsVaultPanel homeCouncilOnly />;
    case 'charities-registry':
      return <GlobalCharitiesRegistry embedded />;
    case 'asset-management':
      return <CouncilAssetInventory />;
    case 'feedback':
      return <AdministrativeFeedbackPanel />;
  }
}

export function AdminDesk() {
  // Every drawer lands closed; one opens at a time, its panel drawn to the right of the rail.
  const [open, setOpen] = useState<AdminDeskDrawerId | null>(null);
  const drawer = ADMIN_DESK_DRAWERS.find((d) => d.id === open) ?? null;
  return (
    <>
      <PageTitle>{ADMIN_DESK_TITLE}</PageTitle>
      <div className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <nav aria-label="Admin Desk drawers" className="flex flex-col gap-2">
          {ADMIN_DESK_DRAWERS.map((d, i) => {
            const here = d.id === open;
            return (
              <button
                key={d.id}
                type="button"
                id={`admin-desk-drawer-${d.id}`}
                aria-expanded={here}
                aria-controls="admin-desk-panel"
                onClick={() => setOpen(here ? null : d.id)}
                className={cx(
                  'flex w-full flex-col gap-0.5 rounded border-2 border-navy border-l-8 px-3 py-2 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-gold',
                  here ? 'border-l-gold bg-navy text-white' : 'border-l-gold bg-white text-navy hover:bg-gold/20',
                )}
              >
                <span className="flex items-center justify-between gap-2 font-serif text-base font-bold">
                  <span>
                    {i + 1}. {d.label}
                  </span>
                  <span aria-hidden="true" className={cx('inline-block motion-safe:transition-transform', here && 'rotate-180')}>
                    ›
                  </span>
                </span>
                <span className={cx('text-xs', here ? 'text-white' : 'text-muted')}>{d.hint}</span>
              </button>
            );
          })}
        </nav>
        <section
          id="admin-desk-panel"
          aria-label={drawer ? drawer.label : 'Admin Desk panel'}
          aria-live="polite"
          className={cx('min-w-0 rounded border-2 border-navy bg-white', drawer ? 'border-t-8 border-t-gold p-4 motion-safe:animate-slide-in' : 'p-6')}
        >
          {drawer ? (
            <>
              <h2 className="mb-3 font-serif text-xl font-bold text-navy">{drawer.label}</h2>
              <EmbeddedModuleContext.Provider value={true}>
                <DrawerPanel id={drawer.id} />
              </EmbeddedModuleContext.Provider>
            </>
          ) : (
            <p className="text-sm text-muted">Every drawer is closed. Open one on the left to work in it here.</p>
          )}
        </section>
      </div>
    </>
  );
}
