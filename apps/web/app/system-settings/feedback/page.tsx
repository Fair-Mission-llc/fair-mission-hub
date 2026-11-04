'use client';
// System Settings > Administrative Feedback Loops (Sprint 8O, super-admin-desk.ts): where a council's Admins send a note or
// bug report to the platform owner (feedback.submit). The role guard (RequireArea, canOpenAdministrativeFeedback) blocks
// every session whose clearance is below ADMIN, and the drivers refuse them too (ADMIN_REQUIRED). The form used to sit on
// the Online Help Center for every member; no member or volunteer screen offers it now. Super Admins also read the
// notes here (FeedbackInbox); the platform owner reads them on the Super Admin Desk's Feedback Communication Center.
import { useState } from 'react';
import { ADMINISTRATIVE_FEEDBACK_TITLE, isSuperAdmin } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { AdminFeedbackForm, FeedbackInbox } from '@/components/FeedbackParts';
import { PageTitle } from '@/components/ui';
import { useUser } from '@/lib/session';

function AdministrativeFeedback() {
  const user = useUser();
  const [sent, setSent] = useState(0);
  return (
    <>
      <PageTitle>{ADMINISTRATIVE_FEEDBACK_TITLE}</PageTitle>
      <div className="flex max-w-4xl flex-col gap-4">
        <p className="text-base">
          A direct line from your council&apos;s Admins to the platform owner. Report a problem, ask for a change or share what is working. Members bring their
          questions to you through the Communications Hub; only Admins and Super Admins see this page.
        </p>
        <AdminFeedbackForm onSent={() => setSent((n) => n + 1)} />
        {isSuperAdmin(user) ? <FeedbackInbox version={sent} /> : null}
      </div>
    </>
  );
}

export default function AdministrativeFeedbackPage() {
  return (
    <RequireArea area="system-settings/feedback">
      <AdministrativeFeedback />
    </RequireArea>
  );
}
