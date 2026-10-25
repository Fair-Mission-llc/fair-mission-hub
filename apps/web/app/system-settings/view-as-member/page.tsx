'use client';
// View As Member (Sprint 10 Revision 3.0): the council Admin's read-only mirror of one member's portal, limited to the
// Admin's own council (canOpenViewAsMember; members.getViewAsMirror checks again). The body is
// components/modules/ViewAsMemberMirror.tsx.
import { RequireArea } from '@/components/CouncilScope';
import { ViewAsMemberMirror } from '@/components/modules/ViewAsMemberMirror';
import { PageTitle } from '@/components/ui';

export default function ViewAsMemberPage() {
  return (
    <RequireArea area="system-settings/view-as-member">
      <PageTitle>View As Member</PageTitle>
      <p className="mb-4 text-sm text-muted">
        See what one member of your council sees: their sidebar links, their desks and their coming shifts. This is a read-only picture; you stay signed in as
        yourself.
      </p>
      <ViewAsMemberMirror />
    </RequireArea>
  );
}
