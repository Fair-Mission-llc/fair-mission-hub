'use client';
// The Operations Knowledge Archive (Sprint 8I, operations-knowledge.ts): a read-only, searchable grid of the council's
// Global Operations Knowledge Vault. The council's officers and Admins - and any Super Admin, who picks the council -
// filter past years' signed operating notes by governance tag, fraternal year and text, so a new chairman inherits what
// the last one learned. Entries are written on the Oversight Desk and are never edited or deleted.
import { useState } from 'react';
import { councilLabel, isSuperAdmin, sortCouncils } from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { KnowledgeArchiveGrid } from '@/components/KnowledgeVaultParts';
import { Notice, PageTitle, Select } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

function KnowledgeArchive() {
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
        Operations Knowledge Archive
      </PageTitle>
      <p className="mb-4 text-base">
        Signed notes from your council&apos;s past and present leaders: recruiting, treasury, clergy, compliance, devotional and logistics. Pick a tag or a
        fraternal year, or type words to search. This archive is read-only; the Grand Knight, Deputy Grand Knight and Admins add entries on the Oversight Desk.
      </p>
      {councils.error ? <Notice tone="error">{councils.error}</Notice> : null}
      <KnowledgeArchiveGrid key={councilId} user={user} councilId={councilId} />
    </>
  );
}

export default function KnowledgeArchivePage() {
  return (
    <RequireArea area="system-settings/knowledge-archive">
      <KnowledgeArchive />
    </RequireArea>
  );
}
