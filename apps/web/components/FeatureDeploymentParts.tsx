'use client';
// Sprint 8Q: what sits on Council Wide Settings. Sprint 10 Revision 3.0: the page is a stack of drawer panels.
//   SettingsDrawers          one collapsible drawer per COUNCIL_SETTINGS_DRAWERS group, every one closed on arrival
//                            (Sprint 11 Revision 1.0); a closed drawer keeps its cards mounted, so an unsaved number
//                            survives.
//   FeatureDeploymentMatrix  the Council Feature Deployment Matrix (feature-deployment.ts councilFeatureDeployment): one
//                            row per advanced capability and per council module, a '🟢 DEPLOYED' or '⚪ AVAILABLE / OFF'
//                            badge and where its switch lives. The Biometric Authentication row carries its own switch
//                            (councils.setBiometricLoginEnabled) for the page's editors. Sprint 9 Revision 5.0: the
//                            Geofenced Meeting Check-In row is hidden while GPS_UI_SUPPRESSED is on.
//   CouncilInstanceRecord    the council's record, read only, with the platform schema version. Sprint 11 Revision 1.0:
//                            pinned above the drawers as the page's permanent header; it never collapses.
//   SettingsLinkCards        the System Settings pages a drawer points to, as far as the reader may open them: the
//                            payment and account pages (BANK_ACCOUNT_SETTINGS_PAGES) and the module and platform switches
//                            (PLATFORM_SWITCH_PAGES). The Reference Archives links are gone (Sprint 10 Revision 3.0).
//
// Sprint 8S Revision 2: no vertical text spill. The canvas may shrink (min-w-0) and wraps long words
// (SETTINGS_DRAWER_BODY_CLASS), and the matrix gives its columns floors (FEATURE_MATRIX_COLUMN_CLASSES) so a narrow
// screen scrolls the table sideways instead of stacking a column's text one word per line.
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  GPS_UI_SUPPRESSED,
  canEditCouncilWideSettings,
  canOpenFeatureFlagsControlCenter,
  councilTenantType,
  describeError,
  featureDeploymentBadge,
  councilFeatureDeployment,
  FEATURE_DEPLOYMENT_MATRIX_TITLE,
  councilParentOrganization,
  DEPLOYMENT_MATRIX_TITLES,
  tenantFeatureDeployment,
  PLATFORM_SCHEMA_VERSION,
  portalAreas,
  TENANT_VOCABULARY,
  type Council,
  type CouncilSettingsDrawerId,
  type FeatureDeploymentRow,
  type PortalArea,
  COUNCIL_SETTINGS_DRAWERS,
} from '@kofc/shared';
import { Button, cx, Notice, Panel, Table, Td } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useFeatureFlags, useTenantType, useUser } from '@/lib/session';
import { db } from '@/services/db';

/** A drawer's body: a column that may shrink and wraps long words instead of spilling them. */
export const SETTINGS_DRAWER_BODY_CLASS = 'min-w-0 break-words';
/** The matrix's three columns: each keeps a floor width, so the table scrolls sideways rather than squeezing a column. */
export const FEATURE_MATRIX_COLUMN_CLASSES = ['min-w-[16rem]', 'min-w-[11rem] whitespace-nowrap', 'min-w-[12rem]'] as const;

/**
 * The Council Wide Settings drawer panels (Sprint 10 Revision 3.0, COUNCIL_SETTINGS_DRAWERS): one collapsible <details>
 * drawer per group, stacked top to bottom. Sprint 11 Revision 1.0: every drawer lands closed. A closed drawer keeps its
 * cards mounted, so an unsaved number survives closing and reopening it.
 */
export function SettingsDrawers({ panels }: { panels: Record<CouncilSettingsDrawerId, ReactNode> }) {
  return (
    <div className="flex flex-col gap-3">
      {COUNCIL_SETTINGS_DRAWERS.map((drawer) => (
        <details key={drawer.id} id={`settings-drawer-${drawer.id}`} open={false} className="group rounded border-2 border-navy bg-white">
          <summary className="flex cursor-pointer list-none flex-col gap-0.5 border-l-8 border-l-gold px-4 py-3 hover:bg-gold/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold">
            <span className="font-serif text-lg font-bold text-navy">
              <span aria-hidden="true" className="mr-2 inline-block transition-transform group-open:rotate-90">
                ▸
              </span>
              {drawer.label}
            </span>
            <span className="text-sm text-muted">{drawer.hint}</span>
          </summary>
          <div className={cx(SETTINGS_DRAWER_BODY_CLASS, 'border-t-2 border-navy px-4 pb-4 pt-2')}>{panels[drawer.id]}</div>
        </details>
      ))}
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

/**
 * The Council Feature Deployment Matrix for one council. Sprint 11 Revision 12.0: a SECULAR_CHARITY tenant sees the
 * non-denominational Organization Feature Matrix (tenantFeatureDeployment): fraternal switches masked, corporate wording.
 */
export function FeatureDeploymentMatrix({ council, onSaved }: { council: Council; onSaved: () => Promise<void> }) {
  const user = useUser();
  // Sprint 9 Revision 5.0: the GPS check-in row is hidden while GPS_UI_SUPPRESSED is on.
  const rows = tenantFeatureDeployment(council).filter((r) => !(GPS_UI_SUPPRESSED && r.id === 'geofence'));
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
              ) : r.href && (r.href !== '/feature-flags' || canOpenFeatureFlagsControlCenter(user)) ? (
                // Sprint 11 Revision 7.0: only a Super Admin gets a link to the Master Feature Deployment Grid.
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
    <Panel title={DEPLOYMENT_MATRIX_TITLES[councilParentOrganization(council)]} className="mt-6">
      <p className="mb-3 text-base">
        Which advanced capabilities and modules are switched on for {council.CouncilName}: <strong>{deployed}</strong> of {rows.length} deployed. Each
        switch keeps its own place and its own editors.
      </p>
      <Table head={['Capability', 'Status', 'Where it is switched']} caption={`${DEPLOYMENT_MATRIX_TITLES[councilParentOrganization(council)]} for ${council.CouncilName}`}>
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

/** The council's record, read only: the permanent header of Council Wide Settings (Sprint 11 Revision 1.0). */
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
    <Panel title="Council Instance Record" className="border-t-8 border-t-gold">
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
  { area: 'credentials-vault', href: '/credentials-vault', label: 'Secure Access Vault', hint: 'The sealed keys for Drive, receipt reading and mail.' },
];

/** Feature Controls: the pages that switch modules and platform-wide parameters (Super Admins). */
export const PLATFORM_SWITCH_PAGES: readonly SettingsPageLink[] = [
  { area: 'feature-flags', href: '/feature-flags', label: 'Master Feature Deployment Grid', hint: "Switch each council's modules on or off (Super Admins)." },
  { area: 'system-settings/global-settings', href: '/system-settings/global-settings', label: 'Global System Parameters', hint: 'Dues, organization type and the platform limits (Super Admins).' },
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
