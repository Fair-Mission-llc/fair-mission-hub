'use client';
// /charities/queue: the module itself lives in components/modules/CharityCheckConsole.tsx (Sprint 8L) so the Active Desks mount the same code.
import { RequireArea } from '@/components/CouncilScope';
import { CharityQueue } from '@/components/modules/CharityCheckConsole';

export default function CharityQueuePage() {
  return (
    <RequireArea area="charities/queue">
      <CharityQueue />
    </RequireArea>
  );
}
