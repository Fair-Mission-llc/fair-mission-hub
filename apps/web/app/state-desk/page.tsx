'use client';
// /state-desk (Sprint 11 Revision 5.0): the State Oversight Desk, components/modules/RegionalDesk.tsx.
import { RequireArea } from '@/components/CouncilScope';
import { RegionalDesk } from '@/components/modules/RegionalDesk';

export default function StateDeskPage() {
  return (
    <RequireArea area="state-desk">
      <RegionalDesk desk="state" />
    </RequireArea>
  );
}
