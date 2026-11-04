'use client';
// The Super Admin Desk (Sprint 8O, super-admin-desk.ts): the Super Admin's Active Desk on /dashboard. Sprint 11 Revision
// 17.5: every Super Admin session gets it (showsSuperAdminDeskTab - the dashboard falls back to Home for anyone else).
// Sprint 11 Revision 18.0: the tab reads 'Super Admin Desk' (was 'Platform Management'), and the horizontal folder row
// and stacked drawers are gone. The desk is the officer desks' left vertical filing spine (DeskBlotter, desk
// 'super-admin'); each drawer opens on the stage beside it:
//   Communications Cabinet: Feedback Communication Center (FeedbackInbox), Council Access Request Approval Queue
//                           (InboundMailCenter)
//   Settings Cabinet:       Global System Parameters, Global Lookup Tables, System Feature Flag Control Panel, Secure
//                           Access Vault (pinned to the Super Admin's own home council)
//   freestanding:           Global Charities Registry
import { deskDrawersFor, showsSuperAdminDeskTab, type DeskDrawerSpec, type SessionUser } from '@kofc/shared';
import { DeskBlotter } from '@/components/DeskDrawers';
import { FeatureFlagControlPanel } from '@/components/FeatureFlagParts';
import { FeedbackInbox } from '@/components/FeedbackParts';
import { GlobalParametersCard } from '@/components/GlobalParametersCard';
import { CredentialsVaultPanel } from '@/components/modules/CredentialsVaultPanel';
import { GlobalCharitiesRegistry } from '@/components/modules/GlobalCharitiesRegistry';
import { GlobalLookupTables } from '@/components/modules/GlobalLookupTables';
import { InboundMailCenter } from '@/components/PlatformAccessParts';
import { PlatformSettingsCard } from '@/components/SettingsParts';
import { Notice } from '@/components/ui';

function SuperAdminDrawerBody({ spec }: { spec: DeskDrawerSpec }) {
  switch (spec.id) {
    case 'feedback':
      return <FeedbackInbox title="Feedback Communication Center" />;
    case 'access-requests':
      return <InboundMailCenter />;
    case 'global-parameters':
      return (
        <>
          <GlobalParametersCard />
          <PlatformSettingsCard />
        </>
      );
    case 'global-lookups':
      return <GlobalLookupTables embedded />;
    case 'feature-flags':
      return <FeatureFlagControlPanel title="System Feature Flag Control Panel" />;
    case 'credentials-vault':
      return <CredentialsVaultPanel homeCouncilOnly />;
    case 'charities-registry':
      return <GlobalCharitiesRegistry embedded />;
    default:
      return null;
  }
}

export function SuperAdminDesk({ user }: { user: SessionUser }) {
  // The tab is never offered to anyone else; this guards a hand-typed #super-admin as well.
  if (!showsSuperAdminDeskTab(user)) return <Notice tone="error">The Super Admin Desk opens only for Super Admins.</Notice>;
  return <DeskBlotter desk="super-admin" drawers={deskDrawersFor(user, 'super-admin', user.councilId)} render={(spec) => <SuperAdminDrawerBody spec={spec} />} />;
}
