'use client';
// The Admin Desk (/admin-desk, admin-desk.ts): a council Admin's own workspace, for Admins and Super Admins
// (canOpenAdminDesk).
//
// Sprint 11 Revision 21.5: one left rail of drawers (ADMIN_DESK_DRAWERS), all closed on landing. The Static Top Deck and
// the control bar are gone. File cabinets (Administration Manual, Help Search) carry a cobalt edge, working drawers a gold
// one (DESK_HANDLE_TONES). In order:
//   Setup Wizard                     shown until the wizard has run once (setupWizardWasDone)
//   Administration Manual            the PDF link and 'Regenerate Manuals On-Demand' (POST MANUAL_REGENERATION_ROUTE)
//   'How Do I...' Help Search        the Administration Manual's task workflows
//   Council Wide Settings            components/modules/CouncilWideSettings.tsx (Instance Record and Council Setup inside)
//   Council Lookup Tables            components/modules/CouncilLookupTables.tsx
//   Secure Access Vault              pinned to the reader's home council (homeCouncilOnly; the server's vault gate agrees)
//   Global Charities Registry        components/modules/GlobalCharitiesRegistry.tsx
//   Council Asset Management         the inventory of components/modules/CouncilAssetManagement.tsx
//   Member Feedback Queue            the triage ledger of the council's member feedback tickets
//   Administrative Feedback Loops    the note to the platform owner, and the inbox for Super Admins
// A drawer's panel mounts only while it is open, so a closed drawer reads no data.
//
// Sprint 11 Revision 4.1: the Council Setup Wizard (components/modules/SetupWizard.tsx) masks the desk on its first visit
// to an unset council (councilLooksUnset). The Practice Sandbox switch lives in Council Wide Settings: Council Setup
// (components/modules/CouncilSetupPanel.tsx).
import { useEffect, useState } from 'react';
import {
  adminDeskDrawersFor,
  ADMIN_DESK_TITLE,
  ADMIN_MANUAL,
  councilLooksUnset,
  DESK_HANDLE_TONES,
  formatTimestamp,
  isSuperAdmin,
  MANUAL_REGENERATION_ROUTE,
  NIGHTLY_MANUAL_REBUILD_HOUR,
  plainTitle,
  type AdminDeskDrawerId,
  type ManualRegenerationStatus,
} from '@kofc/shared';
import { DeskManualHeader } from '@/components/DeskManualHeader';
import { AdminFeedbackForm, FeedbackInbox } from '@/components/FeedbackParts';
import { MemberFeedbackQueue } from '@/components/LocalFeedbackParts';
import { CouncilAssetInventory } from '@/components/modules/CouncilAssetManagement';
import { CouncilLookups } from '@/components/modules/CouncilLookupTables';
import { CouncilWideSettings } from '@/components/modules/CouncilWideSettings';
import { CredentialsVaultPanel } from '@/components/modules/CredentialsVaultPanel';
import { GlobalCharitiesRegistry } from '@/components/modules/GlobalCharitiesRegistry';
import { SetupWizard, setupWizardWasDone } from '@/components/modules/SetupWizard';
import { Button, cx, EmbeddedModuleContext, Notice, PageTitle } from '@/components/ui';
import { useFeatureFlags, useUser } from '@/lib/session';
import { db } from '@/services/db';

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
        <p className="text-sm text-muted">Rebuilds every manual PDF from current text. Nightly rebuild: {NIGHTLY_MANUAL_REBUILD_HOUR}:00.</p>
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
      <p className="text-sm">Admin line to the platform owner: problems, change requests, praise.</p>
      <AdminFeedbackForm onSent={() => setSent((n) => n + 1)} />
      {isSuperAdmin(user) ? <FeedbackInbox version={sent} /> : null}
    </div>
  );
}

function DrawerPanel({ id, onRunWizard }: { id: AdminDeskDrawerId; onRunWizard: () => void }) {
  switch (id) {
    case 'setup-wizard':
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm">Five-step first-run setup: roster, storage and email, founding template, practice data, quick-start guide.</p>
          <Button variant="gold" className="self-start" onClick={onRunWizard}>
            Run Setup Wizard
          </Button>
          <p className="text-xs text-muted">Leaves the desk after it runs. Council Wide Settings: Council Setup keeps it.</p>
        </div>
      );
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
    case 'member-feedback':
      return <MemberFeedbackQueuePanel />;
    case 'feedback':
      return <AdministrativeFeedbackPanel />;
  }
}

/** Sprint 11 Revision 20.0: the council's member feedback tickets (local-feedback.ts), for the reader's home council. */
function MemberFeedbackQueuePanel() {
  const user = useUser();
  return <MemberFeedbackQueue councilId={user.councilId} />;
}

/** Opens the wizard on its own once per browser, for a council with no accounts and no members besides the Admin. */
function useAutoOpenWizard(open: () => void) {
  const user = useUser();
  useEffect(() => {
    if (setupWizardWasDone(user.councilId)) return;
    let live = true;
    void Promise.all([db.councils.listCouncilAccounts(user.memberId, user.councilId), db.members.listByCouncil(user.councilId)]).then(
      ([accounts, members]) => {
        if (live && councilLooksUnset({ accounts: accounts.length, members: members.length })) open();
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.memberId, user.councilId]);
}

/** `embedded` (Sprint 11 Revision 18.5): drawn as a Super Admin's Active Desks tab, under the dashboard's own title. */
export function AdminDesk({ embedded = false }: { embedded?: boolean } = {}) {
  const user = useUser();
  const [wizardOpen, setWizardOpen] = useState(false);
  // Bumped when the wizard closes, so the rail re-reads whether the wizard has run.
  const [wizardRuns, setWizardRuns] = useState(0);
  useAutoOpenWizard(() => setWizardOpen(true));
  // Every drawer lands closed; one opens at a time, its panel drawn to the right of the rail.
  const [open, setOpen] = useState<AdminDeskDrawerId | null>(null);
  // Sprint 11 Revision 7.0: a premium module switched off takes its drawer off the desk. Sprint 11 Revision 21.5: so does
  // the Setup Wizard once it has run (this browser's mark, setupWizardWasDone).
  const [wizardDone, setWizardDone] = useState(true);
  useEffect(() => setWizardDone(setupWizardWasDone(user.councilId)), [user.councilId, wizardRuns]);
  const drawers = adminDeskDrawersFor(useFeatureFlags(), { setupWizardDone: wizardDone });
  const drawer = drawers.find((d) => d.id === open) ?? null;
  return (
    <>
      {wizardOpen ? (
        <SetupWizard
          onClose={() => {
            setWizardOpen(false);
            setWizardRuns((n) => n + 1);
            setOpen((o) => (o === 'setup-wizard' ? null : o));
          }}
        />
      ) : null}
      {embedded ? null : <PageTitle>{ADMIN_DESK_TITLE}</PageTitle>}
      <div className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Sprint 11 Revision 19.5: the rail stays in place (desk-rail-lock) and the open drawer keeps its active border. */}
        <nav aria-label="Admin Desk drawers" className="desk-rail-lock flex flex-col gap-2 py-1">
          {drawers.map((d, i) => {
            const here = d.id === open;
            return (
              <button
                key={d.id}
                type="button"
                id={`admin-desk-drawer-${d.id}`}
                aria-expanded={here}
                aria-current={here ? 'true' : undefined}
                aria-controls="admin-desk-panel"
                data-drawer-state={here ? 'open' : 'closed'}
                data-handle-kind={d.kind}
                onClick={() => setOpen(here ? null : d.id)}
                className={cx(
                  'flex w-full flex-col gap-0.5 rounded border-2 border-navy border-l-8 px-3 py-2 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-gold',
                  DESK_HANDLE_TONES[d.kind].edge,
                  here ? 'drawer-context-active bg-navy text-white' : 'bg-white text-navy hover:bg-gold/20',
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
          data-handle-kind={drawer?.kind}
          className={cx(
            'min-w-0 rounded border-2 border-navy bg-white',
            drawer ? cx('border-t-8 p-4 motion-safe:animate-slide-in', drawer.kind === 'cabinet' ? 'border-t-mission-community' : 'border-t-gold') : 'p-6',
          )}
        >
          {drawer ? (
            <>
              <h2 className="mb-3 font-serif text-xl font-bold text-navy">{plainTitle(drawer.label)}</h2>
              <EmbeddedModuleContext.Provider value={true}>
                <DrawerPanel id={drawer.id} onRunWizard={() => setWizardOpen(true)} />
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
