'use client';
// The Credentials Vault page. Its body is components/modules/CredentialsVaultPanel.tsx (Sprint 10 Revision 3.0), which the
// Super Admin Desk also mounts, pinned to the Super Admin's own home council.
import { RequireArea } from '@/components/CouncilScope';
import { CredentialsVaultPanel } from '@/components/modules/CredentialsVaultPanel';

export default function CredentialsVaultPage() {
  return (
    <RequireArea area="credentials-vault">
      <CredentialsVaultPanel />
    </RequireArea>
  );
}
