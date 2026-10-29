'use client';
// The Admin Desk (/admin-desk, admin-desk.ts): a council Admin's own workspace, for Admins and Super Admins
// (canOpenAdminDesk).
//
// Sprint 11 Revision 3.0: the Static Top Deck (ADMIN_DESK_TOP_PANELS) sits at the top of the page and never collapses:
//   A. Council Instance Identity Record  the home council's record (councils.get)
//   B. Administration Manual PDF         the PDF link and 'Regenerate Manuals On-Demand' (POST MANUAL_REGENERATION_ROUTE)
//   C. 'How Do I...' Local Help Search   the Administration Manual's task workflows
// Below it, the left rail is a stack of six vertical drawers (ADMIN_DESK_DRAWERS) that all land closed; opening one draws
// its panel to the right of the rail, and opening another swaps it. In order:
//   1. Council Wide Settings            components/modules/CouncilWideSettings.tsx
//   2. Council Lookup Tables            components/modules/CouncilLookupTables.tsx
//   3. Secure Access Vault                pinned to the reader's home council (homeCouncilOnly; the server's vault gate agrees)
//   4. Global Charities Registry        components/modules/GlobalCharitiesRegistry.tsx
//   5. Council Asset Management         the inventory of components/modules/CouncilAssetManagement.tsx
//   6. Administrative Feedback Loops    the note to the platform owner, and the inbox for Super Admins
// A drawer's panel mounts only while it is open, so a closed drawer reads no data.
//
// Sprint 11 Revision 4.1: the Council Setup Wizard (components/modules/SetupWizard.tsx) masks the desk on its first visit
// to an unset council (councilLooksUnset) and opens again from 'Run Setup Wizard'. The desk control bar also holds the
// Practice Sandbox master switch: on adds the practice members and fundraisers, off purges them.
import { useEffect, useState } from 'react';
import {
  adminDeskDrawersFor,
  ADMIN_DESK_TITLE,
  ADMIN_DESK_TOP_PANELS,
  ADMIN_MANUAL,
  councilLooksUnset,
  describeError,
  PURGE_PRACTICE_SANDBOX_LABEL,
  formatTimestamp,
  isSuperAdmin,
  MANUAL_REGENERATION_ROUTE,
  NIGHTLY_MANUAL_REBUILD_HOUR,
  type AdminDeskDrawerId,
  type AdminDeskTopPanelId,
  type ManualRegenerationStatus,
} from '@kofc/shared';
import { DeskManualHeader } from '@/components/DeskManualHeader';
import { AdminFeedbackForm, FeedbackInbox } from '@/components/FeedbackParts';
import { CouncilAssetInventory } from '@/components/modules/CouncilAssetManagement';
import { CouncilLookups } from '@/components/modules/CouncilLookupTables';
import { CouncilWideSettings } from '@/components/modules/CouncilWideSettings';
import { CredentialsVaultPanel } from '@/components/modules/CredentialsVaultPanel';
import { GlobalCharitiesRegistry } from '@/components/modules/GlobalCharitiesRegistry';
import { SetupWizard, setupWizardWasDone } from '@/components/modules/SetupWizard';
import { Button, cx, EmbeddedModuleContext, HelpTip, Notice, PageTitle, Switch } from '@/components/ui';
import { useFeatureFlags, useTenantType, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
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

/** Panel A: the record of the council this desk works on - the signed-in Admin's home council. */
function CouncilIdentityRecord() {
  const user = useUser();
  const tenantType = useTenantType();
  const council = useLoad(() => db.councils.get(user.councilId), [user.councilId]);
  const c = council.data;
  if (council.error) return <Notice tone="error">{council.error}</Notice>;
  if (!c) return <p className="text-sm">{council.loading ? 'Loading…' : 'The council record could not be found.'}</p>;
  const rows: [string, string][] = [
    ['Council', `${c.CouncilNumber} - ${c.CouncilName}`],
    ['State', c.State || 'Not set'],
    ['EIN', c.ein_number || 'Not entered'],
    ['Phone', c.Phone || 'Not set'],
    ['Email', c.Email || 'Not set'],
    ['Instance', `Record #${c.id} · ${tenantType}`],
  ];
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="font-bold text-navy">{term}</dt>
          <dd className="break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TopPanelBody({ id }: { id: AdminDeskTopPanelId }) {
  switch (id) {
    case 'council-identity':
      return <CouncilIdentityRecord />;
    case 'admin-manual':
      return (
        <div className="flex flex-col gap-3">
          <DeskManualHeader manual={ADMIN_MANUAL.token} show="pdf" />
          <RegenerateManualsButton />
        </div>
      );
    case 'help-search':
      return <DeskManualHeader manual={ADMIN_MANUAL.token} show="search" />;
  }
}

/** The Static Top Deck: three panels in a row (stacked on narrow screens). They have no close control. */
function StaticTopDeck() {
  return (
    <section aria-label="Admin Desk top deck" className="grid items-stretch gap-4 lg:grid-cols-3">
      {ADMIN_DESK_TOP_PANELS.map((p) => (
        <article
          key={p.id}
          id={`admin-desk-top-${p.id}`}
          aria-label={p.label}
          className="flex min-w-0 flex-col gap-2 rounded border-2 border-navy border-t-8 border-t-gold bg-white p-4"
        >
          <header>
            <h2 className="font-serif text-lg font-bold text-navy">
              {p.tier}. {p.label}
            </h2>
            <p className="text-xs text-muted">{p.hint}</p>
          </header>
          <TopPanelBody id={p.id} />
        </article>
      ))}
    </section>
  );
}

function DrawerPanel({ id }: { id: AdminDeskDrawerId }) {
  switch (id) {
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

/** The Practice Sandbox master switch: on seeds the practice records, off purges them (councils.*PracticeSandbox). */
function PracticeSandboxSwitch({ version }: { version: number }) {
  const user = useUser();
  const status = useLoad(() => db.councils.getPracticeSandboxStatus(user.memberId, user.councilId), [user.memberId, user.councilId, version]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = status.data?.active === true;
  const toggle = async (next: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (next) await db.councils.seedPracticeSandbox(user.memberId, user.councilId);
      else await db.councils.purgePracticeSandbox(user.memberId, user.councilId);
      await status.reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Switch
            checked={on}
            disabled={busy || status.loading}
            onChange={(next) => void toggle(next)}
            label={PURGE_PRACTICE_SANDBOX_LABEL}
            description={
              on
                ? `On: ${status.data?.members ?? 0} practice members and ${status.data?.events ?? 0} practice fundraisers. Turn off to purge them.`
                : 'Off: no practice data. Turn on to add 10 practice members and 3 practice fundraisers.'
            }
          />
        </div>
        <HelpTip
          label="More about the Practice Sandbox"
          text="Practice records are marked by an @practice.sandbox email or a [Practice] event name. Turning the switch off removes only those records, with their shifts, sign-ups and logins."
        />
      </div>
      {status.error ? <Notice tone="error">{status.error}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
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

export function AdminDesk() {
  const [wizardOpen, setWizardOpen] = useState(false);
  // Bumped when the wizard closes, so the sandbox switch reads its state again.
  const [wizardRuns, setWizardRuns] = useState(0);
  useAutoOpenWizard(() => setWizardOpen(true));
  // Every drawer lands closed; one opens at a time, its panel drawn to the right of the rail.
  const [open, setOpen] = useState<AdminDeskDrawerId | null>(null);
  // Sprint 11 Revision 7.0: a premium module switched off takes its drawer off the desk.
  const drawers = adminDeskDrawersFor(useFeatureFlags());
  const drawer = drawers.find((d) => d.id === open) ?? null;
  return (
    <>
      {wizardOpen ? (
        <SetupWizard
          onClose={() => {
            setWizardOpen(false);
            setWizardRuns((n) => n + 1);
          }}
        />
      ) : null}
      <PageTitle>{ADMIN_DESK_TITLE}</PageTitle>
      <section aria-label="Admin Desk controls" className="mb-4 flex flex-wrap items-center gap-4">
        <Button variant="gold" onClick={() => setWizardOpen(true)}>
          Run Setup Wizard
        </Button>
        <PracticeSandboxSwitch version={wizardRuns} />
      </section>
      <EmbeddedModuleContext.Provider value={true}>
        <StaticTopDeck />
      </EmbeddedModuleContext.Provider>
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <nav aria-label="Admin Desk drawers" className="flex flex-col gap-2">
          {drawers.map((d, i) => {
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
