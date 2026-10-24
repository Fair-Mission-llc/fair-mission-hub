// /api/admin/impersonate - a Super Admin's read-only view of the portal as another member (Sprint 7F).
//   POST   { memberId }  swaps the session cookie for one carrying the member's identity (impersonatorId set) and parks
//                        the Super Admin's own signed token in IMPERSONATOR_COOKIE; answers { impersonating, user }
//   GET                  answers whether the current session is a view-as session, and whose
//   DELETE               restores the Super Admin's own session from IMPERSONATOR_COOKIE and clears it
//
// Both tokens are HMAC-signed by the server and HttpOnly, so the browser can neither read nor forge them. The view lasts
// IMPERSONATION_MAX_MINUTES at most, never reaches another Super Admin (assertMayImpersonate, checked against the
// server's own copy of the data) and is read-only: requirePortalSession refuses every non-GET route call made with it,
// and the browser's data service refuses writes while it is on (guardViewAsWrites). Each start and stop is logged.
//
// Sprint 8B: the view crosses council boundaries in full. The view-as token carries the member's own councilId, so every
// council-scoped server route (Drive vault, Supreme, email) answers for the member's council, and POST also answers the
// member's council context (impersonationCouncilContext: feature flags, tenant type, timing settings) read from the
// server's copy, which the browser switches to before it shows the first page of the view.
import { NextResponse } from 'next/server';
import { BusinessRuleError, describeError, impersonationCouncilContext, IMPERSONATION_MAX_MINUTES } from '@kofc/shared';
import { portalSessionSecret } from '@/services/server/secrets';
import { memberDirectory, readPortalSession } from '@/services/server/session';
import {
  IMPERSONATOR_COOKIE,
  PORTAL_SESSION_COOKIE,
  impersonationClaimsFor,
  readCookie,
  secureCookies,
  sessionActor,
  sessionCookieHeader,
  signSessionToken,
  verifySessionToken,
} from '@/services/server/session-token';

const secure = () => secureCookies();

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { memberId?: unknown } | null;
  const memberId = body?.memberId;
  if (typeof memberId !== 'number' || !Number.isInteger(memberId) || memberId <= 0) {
    return NextResponse.json({ impersonating: false, message: 'Send the memberId of the member to view as.' }, { status: 400 });
  }
  const claims = await readPortalSession(req);
  if (!claims) return NextResponse.json({ impersonating: false, message: 'Sign in again: there is no portal session on the server.' }, { status: 401 });
  if (claims.impersonatorId !== undefined) {
    return NextResponse.json({ impersonating: false, message: 'Return to your own account before viewing as someone else.' }, { status: 409 });
  }
  const actor = sessionActor(claims);
  if (!actor.active || actor.memberType !== 'Super Admin') {
    return NextResponse.json({ impersonating: false, message: 'Only a Super Admin may view the portal as another member.' }, { status: 403 });
  }

  const db = await memberDirectory();
  let target;
  try {
    target = await db.auth.impersonate(claims.memberId, memberId);
  } catch (err) {
    const status = err instanceof BusinessRuleError && err.code === 'RECORD_NOT_FOUND' ? 404 : 403;
    return NextResponse.json({ impersonating: false, message: describeError(err) }, { status });
  }
  const [member, statuses, council] = await Promise.all([db.members.get(memberId), db.lookups.list('MemberStatus'), db.councils.get(target.councilId)]);
  const active = member !== null && member.StatusID === statuses.find((s) => s.Status === 'Active')?.id;
  const context = council ? impersonationCouncilContext(council, claims.councilId) : null;

  const now = new Date();
  const viewAs = impersonationClaimsFor(target, active, claims, now, IMPERSONATION_MAX_MINUTES);
  const secret = portalSessionSecret();
  const ownToken = readCookie(req.headers.get('cookie'), PORTAL_SESSION_COOKIE);
  console.info(
    `[impersonation] Super Admin ${claims.memberId} (${claims.username}) began viewing the portal as member ${memberId} (${target.username})` +
      ` of council ${target.councilId}${context?.crossCouncil ? `, crossing over from council ${claims.councilId}` : ''}.`,
  );

  const res = NextResponse.json({ impersonating: true, user: target, council: context, expiresAt: new Date(viewAs.exp * 1000).toISOString() });
  res.headers.append('Set-Cookie', sessionCookieHeader(await signSessionToken(viewAs, secret), secure()));
  res.headers.append('Set-Cookie', sessionCookieHeader(ownToken, secure(), IMPERSONATOR_COOKIE));
  return res;
}

export async function GET(req: Request) {
  const claims = await readPortalSession(req);
  if (!claims) return NextResponse.json({ impersonating: false }, { status: 401 });
  return NextResponse.json({
    impersonating: claims.impersonatorId !== undefined,
    memberId: claims.memberId,
    councilId: claims.councilId,
    impersonatorId: claims.impersonatorId ?? null,
  });
}

export async function DELETE(req: Request) {
  const viewAs = await readPortalSession(req);
  const own = await verifySessionToken(readCookie(req.headers.get('cookie'), IMPERSONATOR_COOKIE), portalSessionSecret(), new Date());
  const res = NextResponse.json({ impersonating: false, restored: own !== null });
  res.headers.append('Set-Cookie', sessionCookieHeader(null, secure(), IMPERSONATOR_COOKIE));
  if (own && own.memberType === 'Super Admin' && own.impersonatorId === undefined) {
    // The parked token is the Super Admin's own, unchanged and still within its own expiry.
    res.headers.append('Set-Cookie', sessionCookieHeader(readCookie(req.headers.get('cookie'), IMPERSONATOR_COOKIE), secure()));
    console.info(`[impersonation] Super Admin ${own.memberId} stopped viewing the portal as member ${viewAs?.memberId ?? 'unknown'}.`);
  } else {
    // No valid parked session: end the view-as session too, so it can never outlive its Super Admin.
    res.headers.append('Set-Cookie', sessionCookieHeader(null, secure()));
  }
  return res;
}
