'use client';
// /governance/advisor: the module itself lives in components/modules/ConstitutionalAdvisor.tsx (Sprint 8L) so the Active Desks mount the same code.
import { RequireArea } from '@/components/CouncilScope';
import { AdvisorTerminal } from '@/components/modules/ConstitutionalAdvisor';

export default function AdvisorPage() {
  return (
    <RequireArea area="governance/advisor">
      <AdvisorTerminal />
    </RequireArea>
  );
}
