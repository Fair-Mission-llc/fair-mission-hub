'use client';
// /donations: the module itself lives in components/modules/DonationRecords.tsx (Sprint 8P Stage 2) so the Active Desks mount the same code.
import { RequireArea } from '@/components/CouncilScope';
import { DonationsWorkspace } from '@/components/modules/DonationRecords';

export default function DonationsPage() {
  return (
    <RequireArea area="donations">
      <DonationsWorkspace />
    </RequireArea>
  );
}
