'use client';
// Sprint 8Q: the two accordion buckets of Council Wide Settings and what sits in them.
//   SettingsBucket           one high-visibility accordion (a <details> under a navy, gold-edged bar):
//                            '🔧 Operational Configuration' opens on arrival, '📋 System Information' on a click.
//   FeatureDeploymentMatrix  the Council Feature Deployment Matrix (feature-deployment.ts councilFeatureDeployment): one
//                            row per advanced capability and per council module, a '🟢 DEPLOYED' or '⚪ AVAILABLE / OFF'
//                            badge and where its switch lives. The Biometric Authentication row carries its own switch
//                            (councils.setBiometricLoginEnabled) for the page's editors.
//   CouncilInstanceRecord    System Information: the council's record, read only, with the platform schema version.
//   SettingsLinkCards        the System Settings pages each bucket points to, as far as the reader may open them:
//                            payment and account settings under Operational Configuration (OPERATIONAL_SETTINGS_PAGES),
//                            the read-only archives and lookups under System Information (SYSTEM_REFERENCE_PAGES).
//
// Sprint 8S Revision 2: no vertical text spill. Each bucket's body may shrink (min-w-0) and wraps long words
// (SETTINGS_BUCKET_BODY_CLASS), and the matrix gives its columns floors (FEATURE_MATRIX_COLUMN_CLASSES) so a narrow
// screen scrolls the table sideways instead of stacking a column's text one word per line.
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
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
  type CouncilSettingsBucketId,
  type FeatureDeploymentRow,
  type PortalArea,
  COUNCIL_SETTINGS_BUCKETS,
} from '@kofc/shared';
import { Button, cx, Notice, Panel, Table, Td } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useFeatureFlags, useTenantType, useUser } from '@/lib/session';
import { db } from '@/services/db';

/** The body of each accordion bucket: a column that may shrink and wraps long words instead of spilling them. */
export const SETTINGS_BUCKET_BODY_CLASS = 'min-w-0 break-words p-4';
/** The matrix's three columns: each keeps a floor width, so the table scrolls sideways rather than squeezing a column. */
export const FEATURE_MATRIX_COLUMN_CLASSES = ['min-w-[16rem]', 'min-w-[11rem] whitespace-nowrap', 'min-w-[12rem]'] as const;

/** One accordion bucket. */
export function SettingsBucket({ id, defaultOpen = false, children }: { id: CouncilSettingsBucketId; defaultOpen?: boolean; children: ReactNode }) {
  const bucket = COUNCIL_SETTINGS_BUCKETS.find((b) => b.id === id)!;
  return (
    <details open={defaultOpen} id={`settings-${id}`} className="group mb-6 rounded border-4 border-gold bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 bg-navy px-4 py-3 text-white" data-surface="navy">
        <span aria-hidden="true" className="w-4 shrink-0 text-xl transition-transform group-open:rotate-90">
          ›
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-serif text-xl font-bold">{bucket.label}</span>
          <span className="text-sm">{bucket.hint}</span>
        </span>
      </summary>
      <div className={SETTINGS_BUCKET_BODY_CLASS}>{children}</div>
    </details>
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
  const rows = councilFeatureDeployment(council);
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

/** The council's record as System Information shows it, read only. */
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

/** Operational Configuration: the pages that hold payment, account and module switches. */
export const OPERATIONAL_SETTINGS_PAGES: readonly SettingsPageLink[] = [
  { area: 'council-lookups', href: '/council-lookups', label: 'Council Lookups', hint: "Payment methods and their account owners, and the council's email gateway." },
  { area: 'credentials-vault', href: '/credentials-vault', label: 'Credentials Vault', hint: 'The sealed keys for Drive, receipt reading and mail.' },
  { area: 'feature-flags', href: '/feature-flags', label: 'Feature Flags Control Center', hint: "Switch each council's modules on or off (Super Admins)." },
  { area: 'system-settings/global-settings', href: '/system-settings/global-settings', label: 'Global System Parameters', hint: 'Dues, organization type and the platform limits (Super Admins).' },
];

/** System Information: the read-only archives and lookups. */
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
