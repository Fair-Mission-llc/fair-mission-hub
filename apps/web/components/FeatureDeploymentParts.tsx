'use client';
// Sprint 8Q: what sits on Council Wide Settings. Sprint 8S Revision 10.1: the page is a filing cabinet.
//   SettingsCabinet          a 25% left rail of four flat text tabs (COUNCIL_SETTINGS_CABINET_TABS) beside a 75% canvas
//                            that shows the chosen tab's cards. Every tab stays mounted (hidden when not chosen), so an
//                            unsaved number survives a tab switch.
//   FeatureDeploymentMatrix  the Council Feature Deployment Matrix (feature-deployment.ts councilFeatureDeployment): one
//                            row per advanced capability and per council module, a '🟢 DEPLOYED' or '⚪ AVAILABLE / OFF'
//                            badge and where its switch lives. The Biometric Authentication row carries its own switch
//                            (councils.setBiometricLoginEnabled) for the page's editors. Sprint 9 Revision 5.0: the
//                            Geofenced Meeting Check-In row is hidden while GPS_UI_SUPPRESSED is on.
//   CouncilInstanceRecord    the council's record, read only, with the platform schema version (Standard Bank Accounts).
//   SettingsLinkCards        the System Settings pages a tab points to, as far as the reader may open them: the payment
//                            and account pages (BANK_ACCOUNT_SETTINGS_PAGES), the module and platform switches
//                            (PLATFORM_SWITCH_PAGES) and the read-only archives and lookups (SYSTEM_REFERENCE_PAGES).
//
// Sprint 8S Revision 2: no vertical text spill. The canvas may shrink (min-w-0) and wraps long words
// (SETTINGS_CABINET_CANVAS_CLASS), and the matrix gives its columns floors (FEATURE_MATRIX_COLUMN_CLASSES) so a narrow
// screen scrolls the table sideways instead of stacking a column's text one word per line.
import Link from 'next/link';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  GPS_UI_SUPPRESSED,
  canEditCouncilWideSettings,
  councilTenantType,
  describeError,
  featureDeploymentBadge,
  councilFeatureDeployment,
  FEATURE_DEPLOYMENT_MATRIX_TITLE,
  PLATFORM_SCHEMA_VERSION,
  portalAreas,
  TENANT_VOCABULARY,
  type Council,
  type CouncilSettingsTabId,
  type FeatureDeploymentRow,
  type PortalArea,
  COUNCIL_SETTINGS_CABINET_TABS,
} from '@kofc/shared';
import { Button, cx, Notice, Panel, Table, Td } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useFeatureFlags, useTenantType, useUser } from '@/lib/session';
import { db } from '@/services/db';

/** The cabinet's right canvas: a column that may shrink and wraps long words instead of spilling them. */
export const SETTINGS_CABINET_CANVAS_CLASS = 'min-w-0 break-words';
/** The matrix's three columns: each keeps a floor width, so the table scrolls sideways rather than squeezing a column. */
export const FEATURE_MATRIX_COLUMN_CLASSES = ['min-w-[16rem]', 'min-w-[11rem] whitespace-nowrap', 'min-w-[12rem]'] as const;

/**
 * The Council Wide Settings filing cabinet (Sprint 8S Revision 10.1): a 25% left rail of four flat text tabs beside a
 * 75% canvas. Choosing a tab shows its cards on the canvas; the other tabs stay mounted but hidden. Up/Down arrows move
 * between the tabs.
 */
export function SettingsCabinet({ panels }: { panels: Record<CouncilSettingsTabId, ReactNode> }) {
  const [active, setActive] = useState<CouncilSettingsTabId>(COUNCIL_SETTINGS_CABINET_TABS[0].id);
  const current = COUNCIL_SETTINGS_CABINET_TABS.find((t) => t.id === active)!;
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = COUNCIL_SETTINGS_CABINET_TABS.findIndex((t) => t.id === active);
    const n = COUNCIL_SETTINGS_CABINET_TABS.length;
    const next = COUNCIL_SETTINGS_CABINET_TABS[(i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n].id;
    setActive(next);
    document.getElementById(`settings-tab-${next}`)?.focus();
  };
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_3fr]">
      <div role="tablist" aria-orientation="vertical" aria-label="Council Wide Settings cabinet" onKeyDown={onKey} className="flex min-w-0 flex-col gap-2 self-start md:sticky md:top-4">
        {COUNCIL_SETTINGS_CABINET_TABS.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`settings-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              className={cx(
                'w-full rounded border-2 border-navy bg-white px-3 py-2 text-left font-serif font-bold leading-tight text-navy hover:bg-gold/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold',
                selected && 'border-l-8 border-l-gold bg-gold/30',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className={SETTINGS_CABINET_CANVAS_CLASS}>
        <p className="mb-2 text-sm text-muted">{current.hint}</p>
        {COUNCIL_SETTINGS_CABINET_TABS.map((tab) => (
          <section key={tab.id} id={`settings-panel-${tab.id}`} role="tabpanel" aria-labelledby={`settings-tab-${tab.id}`} hidden={tab.id !== active} className="min-w-0">
            {panels[tab.id]}
          </section>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ row }: { row: Pick<FeatureDeploymentRow, 'deployed'> }) {
  return (
    <span
      className={cx(
        'inline-block whitespace-nowrap rounded border-2 px-2 py-0.5 text-xs font-bold',
        row.deployed ? 'border-navy bg-navy text-white' : 'border-line bg-white text-muted',
      )}
    >
      {featureDeploymentBadge(row)}
    </span>
  );
}

/** The Council Feature Deployment Matrix for one council. */
export function FeatureDeploymentMatrix({ council, onSaved }: { council: Council; onSaved: () => Promise<void> }) {
  const user = useUser();
  // Sprint 9 Revision 5.0: the GPS check-in row is hidden while GPS_UI_SUPPRESSED is on.
  const rows = councilFeatureDeployment(council).filter((r) => !(GPS_UI_SUPPRESSED && r.id === 'geofence'));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const editable = canEditCouncilWideSettings(user);
  const deployed = rows.filter((r) => r.deployed).length;

  const toggleBiometric = async (enabled: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      await db.councils.setBiometricLoginEnabled(user.memberId, council.id, enabled);
      await onSaved();
      setMessage({ tone: 'info', text: enabled ? 'Biometric sign-in is on for this council.' : "Biometric sign-in is off. Members' phones forget their keys at the next sign-in." });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const group = (g: FeatureDeploymentRow['group'], title: string) => (
    <>
      <tr className="bg-gold">
        <Td colSpan={3} className="font-serif text-base font-bold">
          {title}
        </Td>
      </tr>
      {rows
        .filter((r) => r.group === g)
        .map((r) => (
          <tr key={r.id} className="border-t border-line align-top">
            <Td className={FEATURE_MATRIX_COLUMN_CLASSES[0]}>
              <span className="block font-bold">{r.label}</span>
              <span className="block text-xs text-muted">{r.description}</span>
            </Td>
            <Td className={FEATURE_MATRIX_COLUMN_CLASSES[1]}>
              <StatusBadge row={r} />
            </Td>
            <Td className={FEATURE_MATRIX_COLUMN_CLASSES[2]}>
              {r.id === 'biometric' && editable ? (
                <Button variant="secondary" disabled={busy} onClick={() => void toggleBiometric(!r.deployed)}>
                  {r.deployed ? 'Turn off' : 'Turn on'}
                </Button>
              ) : r.href ? (
                <Link href={r.href} className="font-bold underline">
                  {r.managedOn}
                </Link>
              ) : (
                <span className="text-sm">{r.managedOn}</span>
              )}
            </Td>
          </tr>
        ))}
    </>
  );

  return (
    <Panel title={FEATURE_DEPLOYMENT_MATRIX_TITLE} className="mt-6">
      <p className="mb-3 text-base">
        Which advanced capabilities and modules are switched on for {council.CouncilName}: <strong>{deployed}</strong> of {rows.length} deployed. Each
        switch keeps its own place and its own editors.
      </p>
      <Table head={['Capability', 'Status', 'Where it is switched']} caption={`${FEATURE_DEPLOYMENT_MATRIX_TITLE} for ${council.CouncilName}`}>
        {group('capability', 'Advanced capabilities')}
        {group('module', 'Council modules')}
      </Table>
      {message ? (
        <div className="mt-3">
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        </div>
      ) : null}
    </Panel>
  );
}

/** The council's record as the Standard Bank Accounts tab shows it, read only. */
export function CouncilInstanceRecord({ council }: { council: Council }) {
  const tenant = councilTenantType(council);
  const facts: [string, ReactNode][] = [
    ['Council', `${council.CouncilNumber} – ${council.CouncilName}`],
    ['Organization type', TENANT_VOCABULARY[tenant].organizationName],
    ['District', council.district_number ?? 'Not set'],
    ['EIN', council.ein_number ?? 'Not entered'],
    ['Base dues rate', formatMoney(Number(council.base_dues_rate ?? 40))],
    ['Email gateway', council.EmailProvider ?? (council.SmtpHost ? council.SmtpHost : 'Not configured')],
    ['Bylaws last saved', council.BylawsUpdatedAt ? council.BylawsUpdatedAt.slice(0, 10) : 'Never'],
    ['Database schema version', PLATFORM_SCHEMA_VERSION],
  ];
  return (
    <Panel title="Council Instance Record">
      <p className="mb-3 text-sm text-muted">Read only. These facts change on their own pages, not here.</p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="flex flex-col border-b border-line pb-1">
            <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
            <dd className="text-base font-bold">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

interface SettingsPageLink {
  area: PortalArea;
  href: string;
  label: string;
  hint: string;
}

/** Standard Bank Accounts: the pages that hold payment methods, account owners and sealed keys. */
export const BANK_ACCOUNT_SETTINGS_PAGES: readonly SettingsPageLink[] = [
  { area: 'council-lookups', href: '/council-lookups', label: 'Council Lookups', hint: "Payment methods and their account owners, and the council's email gateway." },
  { area: 'credentials-vault', href: '/credentials-vault', label: 'Credentials Vault', hint: 'The sealed keys for Drive, receipt reading and mail.' },
];

/** System Flags & Toggles: the pages that switch modules and platform-wide parameters (Super Admins). */
export const PLATFORM_SWITCH_PAGES: readonly SettingsPageLink[] = [
  { area: 'feature-flags', href: '/feature-flags', label: 'Feature Flags Control Center', hint: "Switch each council's modules on or off (Super Admins)." },
  { area: 'system-settings/global-settings', href: '/system-settings/global-settings', label: 'Global System Parameters', hint: 'Dues, organization type and the platform limits (Super Admins).' },
];

/** System Flags & Toggles: the read-only archives and lookups. */
export const SYSTEM_REFERENCE_PAGES: readonly SettingsPageLink[] = [
  { area: 'system-settings/knowledge-archive', href: '/system-settings/knowledge-archive', label: 'Operations Knowledge Archive', hint: 'Every lesson the council has filed, by tag.' },
  { area: 'lookups', href: '/lookups', label: 'System Lookups', hint: 'The platform-wide lookup tables.' },
  { area: 'supreme-sync', href: '/supreme-sync', label: 'Supreme Sync', hint: 'The roster sync history with Supreme.' },
];

export function SettingsLinkCards({ title, pages: all }: { title: string; pages: readonly SettingsPageLink[] }) {
  const user = useUser();
  const allowed = new Set<PortalArea>(portalAreas(user, useFeatureFlags(), useTenantType()));
  const pages = all.filter((p) => allowed.has(p.area));
  if (pages.length === 0) return null;
  return (
    <Panel title={title} className="mt-6">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {pages.map((p) => (
          <li key={p.href} className="rounded border-2 border-navy px-3 py-2">
            <Link href={p.href} className="font-bold underline">
              {p.label}
            </Link>
            <span className="block text-sm text-muted">{p.hint}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
