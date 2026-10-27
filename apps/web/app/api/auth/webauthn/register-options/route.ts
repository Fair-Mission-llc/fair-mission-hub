// POST /api/auth/webauthn/register-options - the options for setting up 'Sign in with FaceID' on this browser (Sprint 10
// Revision 5.0, services/server/webauthn.ts). Needs the member's own portal session (401 without, 403 in a view-as
// session or when the member's council switched biometric sign-in off). Answers the WebAuthn creation options with a
// one-time challenge: a platform authenticator only (Face ID, Touch ID, Windows Hello) with user verification required.
import { NextResponse } from 'next/server';
import { biometricLoginEnabled } from '@kofc/shared';
import { publicOrigin } from '@/services/server/calendar-token';
import { memberDirectory, requirePortalSession } from '@/services/server/session';
import { issueChallenge, passkeysOf, relyingPartyId, toBase64Url, WEBAUTHN_ALGORITHMS } from '@/services/server/webauthn';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await requirePortalSession(req, (actor) => actor.active);
  if ('denied' in session) return session.denied;
  const council = await (await memberDirectory()).councils.get(session.claims.councilId);
  if (!biometricLoginEnabled(council)) return NextResponse.json({ message: 'Your council has switched biometric sign-in off.' }, { status: 403 });
  const origin = publicOrigin(req);
  return NextResponse.json({
    challenge: issueChallenge('register', session.claims.memberId),
    rp: { id: relyingPartyId(origin), name: 'Knights of Columbus council portal' },
    user: { id: toBase64Url(Buffer.from(`member-${session.claims.memberId}`)), name: session.claims.username, displayName: session.claims.username },
    pubKeyCredParams: WEBAUTHN_ALGORITHMS.map((alg) => ({ type: 'public-key', alg })),
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
    attestation: 'none',
    timeout: 60_000,
    excludeCredentials: (await passkeysOf(session.claims.memberId)).map((p) => ({ type: 'public-key', id: p.credentialId })),
  });
}
