'use client';
// Sprint 11 Revision 20.0: Feedback Support (/answers/feedback), the Local Feedback Portal's page under ANSWERS. Every
// member sends feedback to their own council's Admins and follows each ticket's chat log here, inside Left Vertical
// Action Drawers (components/LocalFeedbackParts.tsx). The Admins triage the tickets on the Admin Desk's Member Feedback
// Queue drawer.
import { LOCAL_FEEDBACK_TITLE } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { FeedbackSupportPortal } from '@/components/LocalFeedbackParts';
import { PageTitle } from '@/components/ui';

export default function FeedbackSupportPage() {
  return (
    <RequireArea area="answers/feedback">
      <PageTitle>{LOCAL_FEEDBACK_TITLE}</PageTitle>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        A direct line to your council&apos;s Admins. Send a question, a problem or an idea, then follow the answers on the ticket&apos;s chat log. Only you and
        your council&apos;s Admins read your tickets.
      </p>
      <FeedbackSupportPortal />
    </RequireArea>
  );
}
