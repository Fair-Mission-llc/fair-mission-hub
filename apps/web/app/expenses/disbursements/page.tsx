'use client';
// /expenses/disbursements: the module itself lives in components/modules/ExpenseSettlement.tsx (Sprint 8P Stage 3) so the Active Desks mount the same code.
import { RequireArea } from '@/components/CouncilScope';
import { DisbursementLedger } from '@/components/modules/ExpenseSettlement';

export default function DisbursementsPage() {
  return (
    <RequireArea area="expenses/disbursements">
      <DisbursementLedger />
    </RequireArea>
  );
}
