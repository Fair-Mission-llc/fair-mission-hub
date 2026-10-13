'use client';
// Feature Flags Control Center (Sprint 6R): every council's optional modules on one dense grid - a row per feature flag
// (features.ts: the five Sprint 6A 'flag_*' switches and the six Sprint 6R 'feature_*' ones), a column per council. Each
// checkbox saves at once (councils.setFeatureFlags); a module switched off disappears from that council's sidebar,
// pages, phone tabs and buttons. Super Admins only (canOpenFeatureFlagsControlCenter), the tier the drivers enforce
// (SUPER_ADMIN_REQUIRED). The panel used to sit on the Councils page. Sprint 8O: the grid lives in
// components/FeatureFlagParts.tsx, shared with the Super Admin Desk's System Feature Flag Control Panel folder.
import { RequireArea } from '@/components/CouncilScope';
import { FeatureFlagControlPanel } from '@/components/FeatureFlagParts';
import { PageTitle } from '@/components/ui';

function ControlCenter() {
  return (
    <>
      <PageTitle>Feature Flags Control Center</PageTitle>
      <FeatureFlagControlPanel />
    </>
  );
}

export default function FeatureFlagsPage() {
  return (
    <RequireArea area="feature-flags">
      <ControlCenter />
    </RequireArea>
  );
}
