'use client';
// Member Actions (Sprint 8S Corrected): the standalone volunteer page again, opened from the sidebar's
// '[ 🙋 Member Actions ]' link (the 'member-actions' portal area, every member). It mounts the Member Desk's volunteer
// grids (DashboardDesks.tsx MemberDesk): the '🚗 Open Shifts Needing Volunteers' and 'My shifts' trackers side by side at
// equal height across the top row, the charity requests and the open expense sheets, then the multi-tab Volunteer
// Check-In & Service Center (My active shifts, Registration desk, Fraternal roster, Hour ledger). The page was deleted in
// Sprint 8R and its tabs folded into the dashboard; the Member Desk tab keeps the same grids.
import { MEMBER_ACTIONS_NAV_LABEL } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { MemberDesk } from '@/components/DashboardDesks';
import { PageTitle } from '@/components/ui';
import { useUser } from '@/lib/session';

function MemberActions() {
  const user = useUser();
  return (
    <>
      <PageTitle>{MEMBER_ACTIONS_NAV_LABEL}</PageTitle>
      <MemberDesk user={user} />
    </>
  );
}

export default function MemberActionsPage() {
  return (
    <RequireArea area="member-actions">
      <MemberActions />
    </RequireArea>
  );
}
