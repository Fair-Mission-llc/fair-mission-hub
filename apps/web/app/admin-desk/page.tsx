'use client';
// /admin-desk (Sprint 11 Revision 2.0): the Admin Desk, for Admins and Super Admins. The desk lives in
// components/modules/AdminDesk.tsx.
import { RequireArea } from '@/components/CouncilScope';
import { AdminDesk } from '@/components/modules/AdminDesk';

export default function AdminDeskPage() {
  return (
    <RequireArea area="admin-desk">
      <AdminDesk />
    </RequireArea>
  );
}
