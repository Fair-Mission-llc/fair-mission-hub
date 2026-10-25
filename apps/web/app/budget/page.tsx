'use client';
// The Annual Budget Center page (/budget, Sprint 10 Revision 3.0 rename). The body is components/AnnualBudgetCenter.tsx.
import { RequireArea } from '@/components/CouncilScope';
import { AnnualBudgetCenter } from '@/components/AnnualBudgetCenter';

export default function AnnualBudgetCenterPage() {
  return (
    <RequireArea area="financials/budget">
      <AnnualBudgetCenter />
    </RequireArea>
  );
}
