'use client';
// /finance/treasurer-desk: the module itself lives in components/modules/LedgerLineCoder.tsx (Sprint 8P Stage 3) so the Active Desks mount the same code.
import { RequireArea } from '@/components/CouncilScope';
import { TreasurerDesk } from '@/components/modules/LedgerLineCoder';

export default function TreasurerDeskPage() {
  return (
    <RequireArea area="finance/treasurer-desk">
      <TreasurerDesk />
    </RequireArea>
  );
}
