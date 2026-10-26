'use client';
// Sprint 11 Revision 2.0: the page body lives in components/modules/CouncilAssetManagement.tsx, which the Admin Desk
// (/admin-desk) also mounts in a drawer.
import { Suspense } from 'react';
import { RequireArea } from '@/components/CouncilScope';
import { CouncilAssets } from '@/components/modules/CouncilAssetManagement';

export default function CouncilAssetsPage() {
  return (
    <RequireArea area="expenses/assets">
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <CouncilAssets />
      </Suspense>
    </RequireArea>
  );
}
