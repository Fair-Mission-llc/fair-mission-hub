// The browser half of the portal's server session (Sprint 6Z-Engine-Upgrade): sign-in also asks /api/auth/session for
// the HttpOnly cookie the Drive vault, Supreme and email routes check, and sign-out clears it. The cookie is the server's
// own decision; the browser never reads or writes it.
export const SESSION_ROUTE = '/api/auth/session';

/** Sprint 11 Revision 12.0: the server's request for a sign-in code (Admins and Super Admins). */
export interface TwoFactorPrompt {
  challenge: string;
  channel: 'sms' | 'email';
  sentTo: string;
  expiresInSeconds: number;
}

/**
 * Asks the server for its session cookie. `opened` is true when the cookie is set; `twoFactor` is set instead when the
 * server first wants a sign-in code; `message` carries the server's refusal in plain words.
 */
export async function openServerSession(username: string, password: string): Promise<{ opened: boolean; twoFactor?: TwoFactorPrompt; message?: string }> {
  const res = await fetch(SESSION_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).catch(() => null);
  if (!res) return { opened: false };
  const body = (await res.json().catch(() => ({}))) as { twoFactor?: TwoFactorPrompt; message?: string };
  return { opened: res.ok && !body.twoFactor, twoFactor: body.twoFactor, message: res.ok ? undefined : body.message };
}

/** Sprint 11 Revision 12.0: sends the typed code; resolves to null on success or the server's reason. */
export async function confirmTwoFactorCode(challenge: string, code: string): Promise<string | null> {
  const res = await fetch('/api/auth/two-factor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge, code }),
  }).catch(() => null);
  if (!res) return 'The portal server cannot be reached.';
  if (res.ok) return null;
  return ((await res.json().catch(() => ({}))) as { message?: string }).message ?? 'The code was not accepted.';
}

export async function closeServerSession(): Promise<void> {
  await fetch(SESSION_ROUTE, { method: 'DELETE' }).catch(() => null);
}

/** Sprint 7F: the Super Admin's read-only view of the portal as another member (app/api/admin/impersonate). */
export const IMPERSONATE_ROUTE = '/api/admin/impersonate';

/** Asks the server to swap the session cookie for a view-as one; throws the server's reason when it refuses. */
export async function startServerImpersonation(memberId: number): Promise<void> {
  const res = await fetch(IMPERSONATE_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId }),
  }).catch(() => null);
  if (res?.ok) return;
  const body = (await res?.json().catch(() => null)) as { message?: string } | null;
  throw new Error(body?.message ?? 'The server did not answer, so the view could not start.');
}

/** Restores the Super Admin's own session cookie (or ends the session when it cannot). */
export async function endServerImpersonation(): Promise<void> {
  await fetch(IMPERSONATE_ROUTE, { method: 'DELETE' }).catch(() => null);
}
