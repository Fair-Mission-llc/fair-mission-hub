'use client';
// /expenses/queue: the module itself lives in components/modules/ExpenseRoutingTrack.tsx (Sprint 8P Stage 2) so the Active Desks mount the same code.
import { RequireArea } from '@/components/CouncilScope';
import { AuditQueue } from '@/components/modules/ExpenseRoutingTrack';

export default function ExpenseQueuePage() {
  return (
    <RequireArea area="expenses/queue">
      <AuditQueue />
    </RequireArea>
  );
}
