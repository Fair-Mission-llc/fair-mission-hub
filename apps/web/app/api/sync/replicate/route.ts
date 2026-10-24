// POST /api/sync/replicate - the pilot hub's one door (Sprint 9 Revision 4.0; hub-sync.ts). In hub mode every laptop
// and phone on the room Wi-Fi sends each data call here as { method, args }, and the hub runs it on the persistent
// vault (services/server/hub/hub-vault.ts) and answers { ok: true, result } or { ok: false, error }. Because every
// device works on the one vault, a save is in every device's next read at once: there is no copy to merge.
//
// The portal session cookie says who is calling (assertHubCallAllowed): before sign-in only HUB_PUBLIC_METHODS; a call
// that names its caller must name the signed-in member; a view-as session reads only. auth.signIn and a setup-code
// auth.signUp that succeed also set the session cookie, so a phone signs in to the hub with the same call it always made.
// GET answers whether hub mode is on, for the pilot checklist. 404 while hub mode is off (npm run build:web).
import { NextResponse } from 'next/server';
import {
  assertHubCallAllowed,
  BusinessRuleError,
  encodeHubError,
  HUB_VAULT_RELATIVE_PATH,
  PLATFORM_SCHEMA_VERSION,
  type HubCall,
  type HubReply,
} from '@kofc/shared';
import { callHub, hubModeOn } from '@/services/server/hub/hub-vault';
import { readPortalSession, signInOnServer } from '@/services/server/session';

export const runtime = 'nodejs';

const reply = (body: HubReply, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

const failure = (err: unknown, status: number) => reply({ ok: false, error: encodeHubError(err) }, status);

const hubOff = () =>
  failure(new BusinessRuleError('FEATURE_DISABLED', 'This portal is not running as the pilot hub. Build it with npm run build:pilot.', {}), 404);

/** A gate refusal's HTTP status: 401 without a session, 403 for a call the caller may not make. */
const gateStatus = (err: unknown): number =>
  err instanceof BusinessRuleError ? (err.code === 'HUB_SESSION_REQUIRED' ? 401 : err.code === 'INVALID_INPUT' ? 400 : 403) : 400;

export async function GET() {
  return NextResponse.json(
    { hub: hubModeOn(), vault: HUB_VAULT_RELATIVE_PATH, schemaVersion: PLATFORM_SCHEMA_VERSION },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: Request) {
  if (!hubModeOn()) return hubOff();
  const call = (await req.json().catch(() => null)) as HubCall | null;
  if (!call || typeof call !== 'object') return failure(new BusinessRuleError('INVALID_INPUT', 'Send { method, args }.', {}), 400);

  // Sign-in (and a setup-code sign-up) through the hub also opens the device's session.
  if (call.method === 'auth.signIn' || call.method === 'auth.signUp') {
    const [username, password] = Array.isArray(call.args) ? call.args : [];
    if (typeof username !== 'string' || typeof password !== 'string') {
      return failure(new BusinessRuleError('INVALID_INPUT', 'Send the username and password.', {}), 400);
    }
    if (call.method === 'auth.signUp') {
      try {
        await callHub(call);
      } catch (err) {
        return failure(err, 200);
      }
    }
    const outcome = await signInOnServer(username, password);
    if (outcome.ok) return reply({ ok: true, result: outcome.user }, 200, { 'Set-Cookie': outcome.cookie });
    if (outcome.status === 429) return failure(new BusinessRuleError('INVALID_INPUT', outcome.message, {}), 429);
    return reply({ ok: true, result: null });
  }

  const claims = await readPortalSession(req);
  try {
    assertHubCallAllowed(call, claims ? { memberId: claims.memberId, impersonatorId: claims.impersonatorId } : null);
  } catch (err) {
    return failure(err, gateStatus(err));
  }
  try {
    return reply({ ok: true, result: await callHub(call) });
  } catch (err) {
    // A business rule refusal is an ordinary answer; anything else is the hub's own failure.
    return failure(err, err instanceof BusinessRuleError ? 200 : 500);
  }
}
