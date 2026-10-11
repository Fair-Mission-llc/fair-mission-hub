// /api/access-requests - councils that are not on the platform asking for access (Sprint 7F, CouncilAccessRequests).
//   POST  { council_name, contact_email, city, state }  public: the sign-in page's Register Your Council form. Stored
//         PENDING in the server's data copy, which emails the notice to ACCESS_REQUEST_NOTIFY_EMAIL (notify.ts).
//         Three requests per contact email, and ten per caller address, per hour; more are refused with 429.
//   GET                                               Super Admins: every request, pending first
//   PATCH { id, status: 'APPROVED' }                  Super Admins: approve one
// The server copy is not persisted (session.ts), so requests last as long as the server process does.
import { NextResponse } from 'next/server';
import { BusinessRuleError, describeError, hasSuperAdminRights, type AccessRequestInput } from '@kofc/shared';
import { memberDirectory, requirePortalSession } from '@/services/server/session';
import { SignInThrottle } from '@/services/server/session-token';

const HOUR_MS = 60 * 60 * 1000;
const perEmail = new SignInThrottle(3, HOUR_MS);
const perCaller = new SignInThrottle(10, HOUR_MS);

const failureStatus = (err: unknown): number =>
  err instanceof BusinessRuleError ? (err.code === 'RECORD_NOT_FOUND' ? 404 : err.code === 'SUPER_ADMIN_REQUIRED' ? 403 : 400) : 500;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Partial<AccessRequestInput> | null;
  const email = typeof body?.contact_email === 'string' ? body.contact_email.trim().toLowerCase() : '';
  const caller = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const now = Date.now();
  if (perEmail.isLocked(email, now) || perCaller.isLocked(caller, now)) {
    return NextResponse.json({ submitted: false, message: 'Too many requests. Try again in an hour.' }, { status: 429 });
  }
  try {
    const saved = await (await memberDirectory()).accessRequests.submit(body as AccessRequestInput);
    perEmail.fail(email, now);
    perCaller.fail(caller, now);
    return NextResponse.json({ submitted: true, id: saved.id });
  } catch (err) {
    return NextResponse.json({ submitted: false, message: describeError(err) }, { status: failureStatus(err) });
  }
}

export async function GET(req: Request) {
  const session = await requirePortalSession(req, hasSuperAdminRights, { requests: [] });
  if ('denied' in session) return session.denied;
  try {
    return NextResponse.json({ requests: await (await memberDirectory()).accessRequests.list(session.claims.memberId) });
  } catch (err) {
    return NextResponse.json({ requests: [], message: describeError(err) }, { status: failureStatus(err) });
  }
}

export async function PATCH(req: Request) {
  const session = await requirePortalSession(req, hasSuperAdminRights, { updated: false });
  if ('denied' in session) return session.denied;
  const body = (await req.json().catch(() => null)) as { id?: unknown; status?: unknown } | null;
  if (typeof body?.id !== 'number') return NextResponse.json({ updated: false, message: 'Send the id of the request.' }, { status: 400 });
  try {
    const request = await (await memberDirectory()).accessRequests.setStatus(session.claims.memberId, body.id, body.status as 'APPROVED');
    return NextResponse.json({ updated: true, request });
  } catch (err) {
    return NextResponse.json({ updated: false, message: describeError(err) }, { status: failureStatus(err) });
  }
}
