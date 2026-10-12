'use client';
// /gallery: the module itself lives in components/modules/PhotoGallery.tsx (Sprint 8L) so the Active Desks mount the same code.
import { RequireArea } from '@/components/CouncilScope';
import { PhotoGallery } from '@/components/modules/PhotoGallery';

export default function GalleryPage() {
  return (
    <RequireArea area="gallery">
      <PhotoGallery />
    </RequireArea>
  );
}
