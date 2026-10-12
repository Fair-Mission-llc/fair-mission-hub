'use client';
// /charities/vetting: the module itself lives in components/modules/CharityVettingBoard.tsx (Sprint 8L) so the Active Desks mount the same code.
import { RequireArea } from '@/components/CouncilScope';
import { VettingDesk } from '@/components/modules/CharityVettingBoard';

export default function CharitableVettingPage() {
  return (
    <RequireArea area="charities/vetting">
      <VettingDesk />
    </RequireArea>
  );
}
