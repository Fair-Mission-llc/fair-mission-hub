'use client';
// Sprint 8P Stage 2: moved from app/system-settings/knowledge-archive/page.tsx so the Active Desks' slide-out drawers mount the same module; the page renders KnowledgeArchive.
// The Operations Knowledge Vault (Sprint 8I, operations-knowledge.ts): a read-only, searchable grid of the
// council's signed operating notes. Sprint 8J opens it across councils: officers and Admins of every council, and Super Admins,
// read every council's signed operating notes, each badged with its originating council, and narrow them with the
// "Filter by My Home Council Only" toggle, the governance tag, the fraternal year and text. Entries are written in the
// archive drawer of the Grand Knight Desk (Sprint 8P Stage 3) and are never edited or deleted.
import { KnowledgeArchiveGrid } from '@/components/KnowledgeArchiveParts';
import { PageTitle } from '@/components/ui';
import { useUser } from '@/lib/session';

export function KnowledgeArchive() {
  const user = useUser();
  return (
    <>
      <PageTitle>Operations Knowledge Vault</PageTitle>
      {/* Sprint 11 Revision 16.0: one short line in place of the long introduction. */}
      <p className="mb-4 text-base">Signed operating notes from council leaders across the platform. Read-only: search, or filter by tag, year or your home council.</p>
      <KnowledgeArchiveGrid user={user} />
    </>
  );
}
