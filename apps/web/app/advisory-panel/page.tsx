'use client';
// The Application Advisory Panel (Sprint 10 Revision 3.1): the pinned top-level workspace for the panelists of every
// council and the Super Admins ('advisory-panel' portal area, canOpenAdvisoryPanel). The body is
// components/AdvisoryPanel.tsx.
import { ADVISORY_PANEL_TITLE } from '@kofc/shared';
import { AdvisoryPanelWorkspace } from '@/components/AdvisoryPanel';
import { RequireArea } from '@/components/CouncilScope';
import { PageTitle } from '@/components/ui';

export default function AdvisoryPanelPage() {
  return (
    <RequireArea area="advisory-panel">
      <PageTitle>{ADVISORY_PANEL_TITLE}</PageTitle>
      <p className="mb-4 text-sm text-muted">
        For the members of every council who advise on the platform: where it is heading, what is coming next, when the panel meets, and a place to send your
        feedback.
      </p>
      <AdvisoryPanelWorkspace />
    </RequireArea>
  );
}
