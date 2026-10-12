'use client';
// Bilateral Fraternal Affiliations (Sprints 8G/8H, council-affiliations.ts): the council's Admins, Grand Knight and Deputy
// Grand Knight - and any Super Admin, who picks the council - see the other councils of their state, nearest first by
// meeting point and then in district order, and send outbound affiliation invites. An invite stays PENDING until the
// target council's Grand Knight (or Deputy Grand Knight) clicks Accept on their desk; the ACTIVE affiliation then unlocks
// loaner library sharing between the two councils (both must also have sharing on in Council Wide Settings).
import { useState } from 'react';
import { councilLabel, isSuperAdmin, sortCouncils } from '@kofc/shared';
import { AffiliationDirectoryPanel } from '@/components/AffiliationsParts';
import { RequireArea } from '@/components/CouncilScope';
import { Notice, PageTitle, Select } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

function Affiliations() {
  const user = useUser();
  const superAdmin = isSuperAdmin(user);
  const councils = useLoad(async () => (superAdmin ? sortCouncils(await db.councils.list()) : []), [superAdmin]);
  const [councilId, setCouncilId] = useState(user.councilId);
  const list = councils.data ?? [];
  return (
    <>
      <PageTitle
        actions={
          superAdmin && list.length > 1 ? (
            <label className="flex flex-col gap-1">
              <span className="text-sm uppercase tracking-wide text-muted">Council</span>
              <Select value={councilId} onChange={(e) => setCouncilId(Number(e.target.value))}>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {councilLabel(c)}
                  </option>
                ))}
              </Select>
            </label>
          ) : null
        }
      >
        Bilateral Fraternal Affiliations
      </PageTitle>
      <p className="mb-4 text-base">
        Affiliate with nearby councils in your state to lend each other equipment. Send an invite; the other council&apos;s Grand Knight accepts it on their
        Grand Knight Desk. Invites sent to your council wait at the top of this page and on your Grand Knight Desk.
      </p>
      {councils.error ? <Notice tone="error">{councils.error}</Notice> : null}
      <AffiliationDirectoryPanel key={councilId} user={user} councilId={councilId} />
    </>
  );
}

export default function AffiliationsPage() {
  return (
    <RequireArea area="system-settings/affiliations">
      <Affiliations />
    </RequireArea>
  );
}
