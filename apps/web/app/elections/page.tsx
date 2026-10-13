'use client';
// /elections: the module itself lives in components/modules/ElectionTracker.tsx (Sprint 8P Stage 2) so the Active Desks mount the same code.
import { RequireArea } from '@/components/CouncilScope';
import { NominationsDesk } from '@/components/modules/ElectionTracker';

export default function ElectionsPage() {
  return (
    <RequireArea area="elections">
      <NominationsDesk />
    </RequireArea>
  );
}
