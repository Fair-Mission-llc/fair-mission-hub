'use client';
// The Secure Access Vault page. Its body is components/modules/CredentialsVaultPanel.tsx (Sprint 10 Revision 3.0), which the
// Platform Management also mounts. Sprint 10 Revision 3.1: the page is pinned to the reader's home council too - the server
// refuses any other council's keys with 403 (vault-gate.ts) - so it has no council picker.
import { RequireArea } from '@/components/CouncilScope';
import { CredentialsVaultPanel } from '@/components/modules/CredentialsVaultPanel';

export default function CredentialsVaultPage() {
  return (
    <RequireArea area="credentials-vault">
      <CredentialsVaultPanel homeCouncilOnly showTitle />
    </RequireArea>
  );
}
