'use client';
// The page body lives in components/modules/GlobalCharitiesRegistry.tsx (Sprint 10 Revision 3.0), so the Super Admin Desk
// mounts the same module in its drawer.
import { RequireArea } from '@/components/CouncilScope';
import { GlobalCharitiesRegistry } from '@/components/modules/GlobalCharitiesRegistry';

export default function CharityRegistryPage() {
  return (
    <RequireArea area="charities/registry">
      <GlobalCharitiesRegistry />
    </RequireArea>
  );
}
