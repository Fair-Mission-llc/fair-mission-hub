'use client';
// /expenses/authorize: the module itself lives in components/modules/ApprovedExpenseSigning.tsx (Sprint 8P Stage 2) so the Active Desks mount the same code.
import { RequireArea } from '@/components/CouncilScope';
import { AuthorizationDesk } from '@/components/modules/ApprovedExpenseSigning';

export default function ExpenseAuthorizePage() {
  return (
    <RequireArea area="expenses/authorize">
      <AuthorizationDesk />
    </RequireArea>
  );
}
