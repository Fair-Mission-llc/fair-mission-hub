'use client';
// /system-settings/knowledge-archive: the module itself lives in components/modules/KnowledgeArchive.tsx (Sprint 8P Stage 2) so the Active Desks mount the same code.
import { RequireArea } from '@/components/CouncilScope';
import { KnowledgeArchive } from '@/components/modules/KnowledgeArchive';

export default function KnowledgeArchivePage() {
  return (
    <RequireArea area="system-settings/knowledge-archive">
      <KnowledgeArchive />
    </RequireArea>
  );
}
