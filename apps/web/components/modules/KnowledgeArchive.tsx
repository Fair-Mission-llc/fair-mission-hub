'use client';
// Sprint 8P Stage 2: moved from app/system-settings/knowledge-archive/page.tsx so the Active Desks' slide-out drawers mount the same module; the page renders KnowledgeArchive.
// The Operations Knowledge Archive (Sprint 8I, operations-knowledge.ts): a read-only, searchable grid of the
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
      <PageTitle>Operations Knowledge Archive</PageTitle>
      <p className="mb-4 text-base">
        Signed notes from the past and present leaders of every council on the platform: recruiting, treasury, clergy, compliance, devotional and logistics.
        Each note carries the badge of the council that wrote it. Tick &quot;Filter by My Home Council Only&quot; to see only your council&apos;s notes, pick a
        tag or a fraternal year, or type words to search. This archive is read-only; each council&apos;s Grand Knight, Deputy Grand Knight and Admins add
        entries from the Operations Knowledge Archive drawer of its Grand Knight Desk.
      </p>
      <KnowledgeArchiveGrid user={user} />
    </>
  );
}
