// The Secure Access Vault's tenancy boundary on the server (Sprint 10 Revision 3.1). Every vault route calls
// requireHomeCouncilVaultSession before it reads a form or touches a key:
//   - 401 without a portal session;
//   - 403 Forbidden when the council named in the request is not the session's own home council - for every member
//     type, a Super Admin included (assertHomeCouncilVault). The screen pins the vault to the home council too, but the
//     server no longer trusts the screen;
//   - 403 unless the session may maintain that council's records (an Active Admin, or a Super Admin of that council).
import { NextResponse } from 'next/server';
import { assertHomeCouncilVault, assertMayMaintainCouncilRecords, describeError, type MemberWriteActor } from '@kofc/shared';
import { readPortalSession, requirePortalSession } from '@/services/server/session';
import { sessionActor, type PortalSessionClaims } from '@/services/server/session-token';

export async function requireHomeCouncilVaultSession(
  req: Request,
  councilId: number,
  action: string,
): Promise<{ claims: PortalSessionClaims; actor: MemberWriteActor } | { denied: NextResponse }> {
  const claims = await readPortalSession(req);
  if (claims) {
    try {
      assertHomeCouncilVault(sessionActor(claims), councilId);
    } catch (err) {
      console.warn(`[vault] member ${claims.memberId} of council ${claims.councilId} was refused council ${councilId}'s vault.`);
      return { denied: NextResponse.json({ message: describeError(err) }, { status: 403 }) };
    }
  }
  return requirePortalSession(req, (actor) => {
    try {
      assertHomeCouncilVault(actor, councilId);
      assertMayMaintainCouncilRecords(actor, councilId, action);
      return true;
    } catch {
      return false;
    }
  });
}
