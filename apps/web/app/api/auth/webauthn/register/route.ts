// POST /api/auth/webauthn/register { id, clientDataJSON, publicKey, alg } - saves the passkey this browser just created
// for 'Sign in with FaceID' (Sprint 10 Revision 5.0, services/server/webauthn.ts). Needs the member's own portal session
// (401 / 403 as for the options); 400 when the answer fails a check (an old challenge, another site, an algorithm the
// portal does not accept, no public key).
import { NextResponse } from 'next/server';
import { describeError } from '@kofc/shared';
import { publicOrigin } from '@/services/server/calendar-token';
import { memberDirectory, requirePortalSession } from '@/services/server/session';
import { registerPasskey } from '@/services/server/webauthn';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await requirePortalSession(req, (actor) => actor.active);
  if ('denied' in session) return session.denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const { memberId, username } = session.claims;
    // The member's login id is kept with the passkey; a passkey whose login id no longer matches is retired at sign-in.
    const member = await (await memberDirectory()).members.get(memberId);
    if (!member) return NextResponse.json({ message: 'Your member record was not found.' }, { status: 404 });
    const saved = await registerPasskey({ memberId, username, credentialId: member.CredentialID as number }, body ?? {}, publicOrigin(req));
    return NextResponse.json({ saved: true, credentialId: saved.credentialId, username: saved.username });
  } catch (err) {
    return NextResponse.json({ message: describeError(err) }, { status: 400 });
  }
}
