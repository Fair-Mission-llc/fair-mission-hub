'use client';
// /expenses/audit: the module itself lives in components/modules/PaymentRequestDesk.tsx (Sprint 8P Stage 2) so the Active Desks mount the same code.
import { RequireArea } from '@/components/CouncilScope';
import { AuditDesk } from '@/components/modules/PaymentRequestDesk';

export default function ExpenseAuditPage() {
  return (
    <RequireArea area="expenses/audit">
      <AuditDesk />
    </RequireArea>
  );
}
