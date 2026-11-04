'use client';
// Sprint 11 Revision 18.0: Motion Requests (the 'motion-requests' portal area, every signed-in member). A member submits
// and follows their own requests (MyMotionRequestsPanel). The Grand Knight's seat and the council's officers also see the
// council's requests (CouncilMotionRequests): the Grand Knight decides them, officers advise in the officer channel.
// Sprint 11 Revision 18.5: the sidebar link and the heading read 'Motion Request' (MOTION_REQUEST_LABEL); the request form
// leads, and the member's own history sits apart at the foot of the page as 'My Motion Requests'.
import { canReadCouncilMotionRequests, MOTION_REQUEST_LABEL } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { CouncilMotionRequests, MyMotionRequestsPanel } from '@/components/MotionRequestParts';
import { PageTitle } from '@/components/ui';
import { useUser } from '@/lib/session';

function MotionRequestsBody() {
  const user = useUser();
  const officer = canReadCouncilMotionRequests(
    { memberId: user.memberId, councilId: user.councilId, memberType: user.memberType, active: true, roles: user.roles, officer: user.isOfficer },
    user.councilId,
  );
  return (
    <div className="flex flex-col gap-4">
      <MyMotionRequestsPanel user={user} split middle={officer ? <CouncilMotionRequests user={user} councilId={user.councilId} /> : null} />
    </div>
  );
}

export default function MotionRequestsPage() {
  return (
    <RequireArea area="motion-requests">
      <PageTitle>{MOTION_REQUEST_LABEL}</PageTitle>
      <MotionRequestsBody />
    </RequireArea>
  );
}
