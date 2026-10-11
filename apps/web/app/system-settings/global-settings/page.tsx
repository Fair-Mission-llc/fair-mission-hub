'use client';
// Global System Parameters (Sprint 7C Extension): the Super Admin's page for the numbers that sit above any one council's
// own settings - each council's tenant type and base dues rate (GlobalParametersCard, councils.setGlobalParameters) and
// the Platform Limits every council shares: the oral history recording cap and the diary and prayer intention character
// limits (PlatformSettingsCard, councils.setPlatformSettings). Both cards used to sit on System Lookups. Sprint 7E adds the
// meeting invitation horizon, the portal sign-in length and the audit retention to the Platform Settings, which sit in
// grouped cards with (i) help popups. The Feature
// Flags Control Center keeps only its on/off module switches. Super Admins only (canOpenGlobalSystemParameters), the tier
// the data service enforces on both methods (SUPER_ADMIN_REQUIRED).
import { RequireArea } from '@/components/CouncilScope';
import { GlobalParametersCard } from '@/components/GlobalParametersCard';
import { PlatformSettingsCard } from '@/components/SettingsParts';
import { PageTitle } from '@/components/ui';

export default function GlobalSystemParametersPage() {
  return (
    <RequireArea area="system-settings/global-settings">
      <PageTitle>Global System Parameters</PageTitle>
      <p className="mb-4 text-sm text-muted">
        These numbers apply above any one council&apos;s own settings. The base dues rate and organization type are set per council; the Platform
        Settings apply to every council at once. Each council&apos;s own limits, windows and reminders are on Council Wide Settings.
      </p>
      <GlobalParametersCard />
      <PlatformSettingsCard />
    </RequireArea>
  );
}
