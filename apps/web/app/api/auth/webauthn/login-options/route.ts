// POST /api/auth/webauthn/login-options { credentialId? } - a one-time challenge for 'Sign in with FaceID' on the sign-in
// card (Sprint 10 Revision 5.0, services/server/webauthn.ts). No session is needed: the challenge alone opens nothing,
// and the answer must be signed by a passkey a member set up while signed in. The credential the browser remembers is
// offered first; without it the device offers any passkey it holds for this site.
import { NextResponse } from 'next/server';
import { publicOrigin } from '@/services/server/calendar-token';
import { issueChallenge, relyingPartyId } from '@/services/server/webauthn';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { credentialId?: unknown } | null;
  const id = typeof body?.credentialId === 'string' && /^[A-Za-z0-9_-]{8,1400}$/.test(body.credentialId) ? body.credentialId : null;
  return NextResponse.json({
    challenge: issueChallenge('login', null),
    rpId: relyingPartyId(publicOrigin(req)),
    userVerification: 'required',
    timeout: 60_000,
    allowCredentials: id ? [{ type: 'public-key', id, transports: ['internal'] }] : [],
  });
}
