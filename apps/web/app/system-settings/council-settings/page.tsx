'use client';
// Sprint 11 Revision 2.0: the page body lives in components/modules/CouncilWideSettings.tsx, which the Admin Desk
// (/admin-desk) also mounts in a drawer.
import { RequireArea } from '@/components/CouncilScope';
import { CouncilWideSettings } from '@/components/modules/CouncilWideSettings';

export default function CouncilSettingsPage() {
  return (
    <RequireArea area="system-settings/council-settings">
      <CouncilWideSettings />
    </RequireArea>
  );
}
