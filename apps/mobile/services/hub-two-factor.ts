// Sprint 11 Revision 12.5: the phone's half of the sign-in code step. Only the hub can send a code (the Twilio and
// SendGrid keys stay on the server), so only a hub-mode phone has a verifier; the phone's own database signs in with a
// password alone. The cookie the hub sets on a right code opens this phone's hub session, as a plain sign-in did.
import { TWO_FACTOR_ROUTE, type SessionUser } from '@kofc/shared';
import { HUB_MODE, HUB_URL } from './db';
import type { TwoFactorVerifier } from './onboarding';

async function verifyOnHub(challenge: string, code: string): Promise<{ user: SessionUser } | { message: string }> {
  const res = await fetch(`${HUB_URL}${TWO_FACTOR_ROUTE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ challenge, code }),
  }).catch(() => null);
  if (!res) return { message: 'The hub laptop cannot be reached. Check the Wi-Fi and try again.' };
  const body = (await res.json().catch(() => ({}))) as { user?: SessionUser; message?: string };
  if (res.ok && body.user) return { user: body.user };
  return { message: body.message ?? 'The code was not accepted.' };
}

export const hubTwoFactorVerifier: TwoFactorVerifier | undefined = HUB_MODE ? verifyOnHub : undefined;
