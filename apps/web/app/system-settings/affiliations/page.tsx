'use client';
// /system-settings/affiliations: the module itself lives in components/modules/ConnectedCouncils.tsx (Sprint 8L) so the Active Desks mount the same code.
import { RequireArea } from '@/components/CouncilScope';
import { Affiliations } from '@/components/modules/ConnectedCouncils';

export default function AffiliationsPage() {
  return (
    <RequireArea area="system-settings/affiliations">
      <Affiliations />
    </RequireArea>
  );
}
