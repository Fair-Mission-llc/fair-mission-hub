// /api/auth/client-telemetry (Sprint 11 Revision 21.5, client-telemetry.ts): Super Admins read the sign-in client log -
// the latest version and platform per member and the recent sign-ins. 401 without a session, 403 for anyone else.
import { NextResponse } from 'next/server';
import { CLIENT_RELEASE_BASELINE, CLIENT_RELEASE_VERSION, hasSuperAdminRights } from '@kofc/shared';
import { readClientTelemetryLog } from '@/services/server/client-telemetry';
import { requirePortalSession } from '@/services/server/session';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await requirePortalSession(req, (actor) => hasSuperAdminRights(actor));
  if ('denied' in session) return session.denied;
  const log = await readClientTelemetryLog();
  return NextResponse.json(
    { release: CLIENT_RELEASE_VERSION, baseline: CLIENT_RELEASE_BASELINE, latest: Object.values(log.latestByMember), recent: log.recent },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
