// /api/admin/regenerate-manuals (Sprint 11 Revision 2.0): the Admin Desk's 'Regenerate Manuals On-Demand' button.
//   POST starts a rebuild of every manual PDF (services/server/manual-regeneration.ts) and answers 202 at once with the
//        status; a rebuild already running is joined, not doubled.
//   GET  answers the last run's status and the time of the next nightly rebuild.
// Admins and Super Admins only: 401 without a portal session, 403 for anyone else.
import { NextResponse } from 'next/server';
import { manualRegenerationStatus, regenerateAllManuals } from '@/services/server/manual-regeneration';
import { requirePortalSession } from '@/services/server/session';

export const runtime = 'nodejs';

const isAdminActor = (actor: { memberType: string | undefined }) => actor.memberType === 'Admin' || actor.memberType === 'Super Admin';

export async function GET(req: Request) {
  const session = await requirePortalSession(req, isAdminActor);
  if ('denied' in session) return session.denied;
  return NextResponse.json(manualRegenerationStatus(), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const session = await requirePortalSession(req, isAdminActor);
  if ('denied' in session) return session.denied;
  console.log(`[manuals] member ${session.claims.memberId} asked for an on-demand rebuild`);
  void regenerateAllManuals('on-demand');
  return NextResponse.json(manualRegenerationStatus(), { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
