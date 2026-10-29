'use client';
// The page body lives in components/modules/GlobalLookupTables.tsx (Sprint 10 Revision 3.0), so Platform Management
// mounts the same module in its drawer.
import { RequireArea } from '@/components/CouncilScope';
import { GlobalLookupTables } from '@/components/modules/GlobalLookupTables';

export default function LookupsPage() {
  return (
    <RequireArea area="lookups">
      <GlobalLookupTables />
    </RequireArea>
  );
}
