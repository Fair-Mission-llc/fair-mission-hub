'use client';
// Member Actions Hub (Sprint 8S Revision): the standalone volunteer page, opened from the sidebar's plain 'Member Actions
// Hub' link (the 'member-actions' portal area, every member). Under the single master heading '[ 🙋 Member Actions Hub ]'
// it shows only the four-tab Volunteer Check-In & Service Center (My active shifts, Registration desk, Fraternal roster,
// Hour ledger). The shift trackers, charity requests and open expense sheets stay on the Member Desk tab, which no longer
// repeats the check-in panels. History: the page was deleted in Sprint 8R and restored around the Member Desk grids in
// Sprint 8S Corrected.
import { MEMBER_ACTIONS_HUB_HEADING } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { PageTitle } from '@/components/ui';
import { VolunteerCenter } from '@/components/VolunteerCenter';

export default function MemberActionsPage() {
  return (
    <RequireArea area="member-actions">
      <PageTitle>{MEMBER_ACTIONS_HUB_HEADING}</PageTitle>
      <VolunteerCenter />
    </RequireArea>
  );
}
