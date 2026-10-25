'use client';
// The Super Admin Desk (Sprint 8O, super-admin-desk.ts): the platform owner's own Active Desk, mounted on /dashboard only
// for the owner's personal session (isPlatformOwner - the dashboard falls back to Home for anyone else). A row of three
// top horizontal action folders, drawn like the Active Desks folder tabs, opens one workspace at a time:
//   [ 📥 Feedback Communication Center ]         the Administrative Feedback Loops notes (FeedbackInbox)
//   [ 🔑 Council Access Request Approval Queue ] the councils asking to join the platform (InboundMailCenter)
//   [ 🛠️ System Feature Flag Control Panel ]      every council's module switches (FeatureFlagControlPanel)
// The chosen folder is remembered in this browser only (a per-viewer convenience).
// Sprint 10 Revision 3.0: under the folders, four collapsible infrastructure drawers (SUPER_ADMIN_DESK_DRAWERS): Global
// System Parameters, Global Lookup Tables, Global Charities Registry and the Credentials Vault. A drawer's body mounts
// only while it is open. The Credentials Vault drawer is pinned to the Super Admin's own home council.
import { useEffect, useState } from 'react';
import {
  isPlatformOwner,
  SUPER_ADMIN_DESK_DRAWERS,
  SUPER_ADMIN_DESK_FOLDERS,
  superAdminDeskFolder,
  type SessionUser,
  type SuperAdminDeskDrawerId,
  type SuperAdminDeskFolderId,
} from '@kofc/shared';
import { FeatureFlagControlPanel } from '@/components/FeatureFlagParts';
import { FeedbackInbox } from '@/components/FeedbackParts';
import { GlobalParametersCard } from '@/components/GlobalParametersCard';
import { CredentialsVaultPanel } from '@/components/modules/CredentialsVaultPanel';
import { GlobalCharitiesRegistry } from '@/components/modules/GlobalCharitiesRegistry';
import { GlobalLookupTables } from '@/components/modules/GlobalLookupTables';
import { InboundMailCenter } from '@/components/PlatformAccessParts';
import { PlatformSettingsCard } from '@/components/SettingsParts';
import { cx, Notice } from '@/components/ui';

const LAST_FOLDER_KEY = 'kofc.superAdminDesk.folder';

function DrawerBody({ id }: { id: SuperAdminDeskDrawerId }) {
  switch (id) {
    case 'global-parameters':
      return (
        <>
          <GlobalParametersCard />
          <PlatformSettingsCard />
        </>
      );
    case 'global-lookups':
      return <GlobalLookupTables embedded />;
    case 'charities-registry':
      return <GlobalCharitiesRegistry embedded />;
    case 'credentials-vault':
      return <CredentialsVaultPanel homeCouncilOnly />;
  }
}

/** The four infrastructure drawers; each body mounts only while its drawer is open. */
function InfrastructureDrawers() {
  const [open, setOpen] = useState<ReadonlySet<SuperAdminDeskDrawerId>>(new Set());
  return (
    <section aria-label="Platform infrastructure drawers" className="flex flex-col gap-3">
      {SUPER_ADMIN_DESK_DRAWERS.map((d) => {
        const isOpen = open.has(d.id);
        return (
          <details
            key={d.id}
            id={`super-admin-drawer-${d.id}`}
            open={isOpen}
            onToggle={(e) => {
              const now = (e.currentTarget as HTMLDetailsElement).open;
              setOpen((prev) => {
                const next = new Set(prev);
                if (now) next.add(d.id);
                else next.delete(d.id);
                return next;
              });
            }}
            className="group rounded border-2 border-navy bg-white"
          >
            <summary className="flex cursor-pointer list-none flex-col gap-0.5 border-l-8 border-l-gold px-4 py-3 hover:bg-gold/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold">
              <span className="font-serif text-lg font-bold text-navy">
                <span aria-hidden="true" className="mr-2 inline-block transition-transform group-open:rotate-90">
                  ▸
                </span>
                {d.label}
              </span>
              <span className="text-sm text-muted">{d.hint}</span>
            </summary>
            <div className="min-w-0 border-t-2 border-navy px-4 pb-4 pt-2">{isOpen ? <DrawerBody id={d.id} /> : null}</div>
          </details>
        );
      })}
    </section>
  );
}

function readLastFolder(): string | null {
  try {
    return window.localStorage.getItem(LAST_FOLDER_KEY);
  } catch {
    return null;
  }
}

function rememberFolder(id: SuperAdminDeskFolderId) {
  try {
    window.localStorage.setItem(LAST_FOLDER_KEY, id);
  } catch {
    // Storage blocked: the folder still opens, it is just not remembered.
  }
}

export function SuperAdminDesk({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState<SuperAdminDeskFolderId>('feedback');
  useEffect(() => setOpen(superAdminDeskFolder(readLastFolder())), []);

  // The tab is never offered to anyone else; this guards a hand-typed #super-admin as well.
  if (!isPlatformOwner(user)) return <Notice tone="error">The Super Admin Desk opens only for the platform owner&apos;s own account.</Notice>;

  const folder = SUPER_ADMIN_DESK_FOLDERS.find((f) => f.id === open) ?? SUPER_ADMIN_DESK_FOLDERS[0]!;
  const choose = (id: SuperAdminDeskFolderId) => {
    setOpen(id);
    rememberFolder(id);
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Super Admin Desk folders" className="flex items-end gap-1 overflow-x-auto border-b-[3px] border-navy">
        {SUPER_ADMIN_DESK_FOLDERS.map((f) => {
          const here = f.id === open;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              id={`super-admin-folder-${f.id}`}
              aria-selected={here}
              aria-controls="super-admin-folder-panel"
              onClick={() => choose(f.id)}
              className={cx(
                'relative -mb-[3px] shrink-0 whitespace-nowrap rounded-t-lg border-x-2 border-t-2 border-navy px-4 text-sm font-bold',
                here
                  ? 'z-10 border-t-[6px] border-t-gold border-b-[3px] border-b-white bg-white pb-2.5 pt-2 text-navy'
                  : 'border-b-[3px] border-b-navy bg-navy/10 py-2 text-navy hover:bg-gold/20',
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <div id="super-admin-folder-panel" role="tabpanel" aria-labelledby={`super-admin-folder-${folder.id}`} className="flex flex-col gap-3">
        <p className="text-sm text-muted">{folder.hint}</p>
        {folder.id === 'feedback' ? (
          <FeedbackInbox title="Feedback Communication Center" />
        ) : folder.id === 'access-requests' ? (
          <InboundMailCenter />
        ) : (
          <FeatureFlagControlPanel title="System Feature Flag Control Panel" />
        )}
      </div>
      <InfrastructureDrawers />
    </div>
  );
}
