'use client';
// /district-desk (Sprint 11 Revision 5.0): the District Deputy Desk, components/modules/RegionalDesk.tsx.
import { RequireArea } from '@/components/CouncilScope';
import { RegionalDesk } from '@/components/modules/RegionalDesk';

export default function DistrictDeskPage() {
  return (
    <RequireArea area="district-desk">
      <RegionalDesk desk="district" />
    </RequireArea>
  );
}
