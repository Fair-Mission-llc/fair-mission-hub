// /api/platform-settings - the server's copy of the Platform Settings the portal server itself reads (Sprint 7E).
//
//   GET                                   reads the server's PlatformSettings row
//   POST { user_session_expiry_hours }    saves the session length on the server
//
// The portal server mints sessions from ITS OWN copy of the data (session.ts), which never sees what the browser's data
// driver saves. Global System Parameters therefore posts a changed session length here too, so the next sign-in lasts
// the new number of hours. A session that already started keeps its end time. Only an Active Super Admin's portal
// session may (401 without a session, 403 otherwise), the tier councils.setPlatformSettings applies again.
import { NextResponse } from 'next/server';
import { describeError, hasSuperAdminRights } from '@kofc/shared';
import { memberDirectory, requirePortalSession } from '@/services/server/session';

export async function GET(req: Request) {
  const session = await requirePortalSession(req, hasSuperAdminRights);
  if ('denied' in session) return session.denied;
  return NextResponse.json({ settings: await (await memberDirectory()).councils.getPlatformSettings() });
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (payload === null || typeof payload !== 'object' || Object.keys(payload).some((k) => k !== 'user_session_expiry_hours')) {
    return NextResponse.json({ message: 'Send only user_session_expiry_hours.' }, { status: 400 });
  }
  const session = await requirePortalSession(req, hasSuperAdminRights);
  if ('denied' in session) return session.denied;
  try {
    const db = await memberDirectory();
    const settings = await db.councils.setPlatformSettings(session.claims.memberId, { user_session_expiry_hours: payload.user_session_expiry_hours as number });
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json({ message: describeError(err) }, { status: 400 });
  }
}
