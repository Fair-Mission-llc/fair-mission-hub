'use client';
// /super-admin (Sprint 11 Revision 7.0): the Master Feature Deployment Grid at its Super Admin address. Same panel and
// same gate as /feature-flags (the 'feature-flags' area, canOpenFeatureFlagsControlCenter: Super Admins only), so a
// council Admin who opens the link sees the area's refusal, never the switches.
import { MASTER_FEATURE_GRID_TITLE } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { FeatureFlagControlPanel } from '@/components/FeatureFlagParts';
import { PageTitle } from '@/components/ui';

export default function SuperAdminPage() {
  return (
    <RequireArea area="feature-flags">
      <PageTitle>{MASTER_FEATURE_GRID_TITLE}</PageTitle>
      <FeatureFlagControlPanel />
    </RequireArea>
  );
}
