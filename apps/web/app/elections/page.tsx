'use client';
// /elections: the Council Election Center (Sprint 11 Revision 1.0). The module lives in components/modules/ElectionWorkflow.tsx
// (Sprint 8P Stage 2; ElectionTracker.tsx until Sprint 8S Revision 2) so the Active Desks mount the same code.
import { RequireArea } from '@/components/CouncilScope';
import { CouncilElectionCenter } from '@/components/modules/ElectionWorkflow';

export default function ElectionsPage() {
  return (
    <RequireArea area="elections">
      <CouncilElectionCenter />
    </RequireArea>
  );
}
