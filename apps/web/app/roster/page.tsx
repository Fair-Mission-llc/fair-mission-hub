'use client';
// Member Roster (Sprint 10 Revision 2.0): the sidebar's first Faith In Action link (the 'roster' portal area, every
// signed-in member). The directory itself is MemberRosterDirectory; members.listRoster scopes it to the reader's council
// and its sister councils, or to every council for a Super Admin.
import { MEMBER_ROSTER_TITLE } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { MemberRosterDirectory } from '@/components/MemberRosterDirectory';
import { PageTitle } from '@/components/ui';

export default function MemberRosterPage() {
  return (
    <RequireArea area="roster">
      <PageTitle>{MEMBER_ROSTER_TITLE}</PageTitle>
      <MemberRosterDirectory />
    </RequireArea>
  );
}
