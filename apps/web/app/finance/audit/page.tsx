'use client';
// /finance/audit: the module itself lives in components/modules/TrusteeAuditDesk.tsx (Sprint 8L) so the Active Desks mount the same code.
import { RequireArea } from '@/components/CouncilScope';
import { AuditDesk } from '@/components/modules/TrusteeAuditDesk';

export default function TrusteeAuditPage() {
  return (
    <RequireArea area="finance/audit">
      <AuditDesk />
    </RequireArea>
  );
}
