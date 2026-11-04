'use client';
// Sprint 11 Revision 18.0: Motion Requests (the 'motion-requests' portal area, every signed-in member; the Faith In Action
// link 'My Motion Requests'). A member submits and follows their own requests (MyMotionRequestsPanel). The Grand
// Knight's seat and the council's officers also see the council's requests (CouncilMotionRequests): the Grand Knight
// decides them, officers advise in the officer channel.
import { canReadCouncilMotionRequests, MY_MOTION_REQUESTS_TITLE } from '@kofc/shared';
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
      <MyMotionRequestsPanel user={user} />
      {officer ? <CouncilMotionRequests user={user} councilId={user.councilId} /> : null}
    </div>
  );
}

export default function MotionRequestsPage() {
  return (
    <RequireArea area="motion-requests">
      <PageTitle>{MY_MOTION_REQUESTS_TITLE}</PageTitle>
      <MotionRequestsBody />
    </RequireArea>
  );
}
