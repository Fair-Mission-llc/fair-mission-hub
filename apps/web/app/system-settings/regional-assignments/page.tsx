'use client';
// /system-settings/regional-assignments (Sprint 11 Revision 5.0): Super Admins and State Admins assign regional offices.
import { RequireArea } from '@/components/CouncilScope';
import { RegionalAssignmentsPanel } from '@/components/modules/RegionalAssignmentsPanel';

export default function RegionalAssignmentsPage() {
  return (
    <RequireArea area="system-settings/regional-assignments">
      <RegionalAssignmentsPanel />
    </RequireArea>
  );
}
