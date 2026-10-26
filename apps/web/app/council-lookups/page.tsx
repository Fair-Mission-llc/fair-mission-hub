'use client';
// Sprint 11 Revision 2.0: the page body lives in components/modules/CouncilLookupTables.tsx, which the Admin Desk
// (/admin-desk) also mounts in a drawer.
import { RequireArea } from '@/components/CouncilScope';
import { CouncilLookups } from '@/components/modules/CouncilLookupTables';

export default function CouncilLookupsPage() {
  return (
    <RequireArea area="council-lookups">
      <CouncilLookups />
    </RequireArea>
  );
}
