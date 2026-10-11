// The browser half of the portal's server session (Sprint 6Z-Engine-Upgrade): sign-in also asks /api/auth/session for
// the HttpOnly cookie the Drive vault, Supreme and email routes check, and sign-out clears it. The cookie is the server's
// own decision; the browser never reads or writes it.
export const SESSION_ROUTE = '/api/auth/session';

/** True when the server accepted the credentials and set its session cookie. */
export async function openServerSession(username: string, password: string): Promise<boolean> {
  const res = await fetch(SESSION_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).catch(() => null);
  return res?.ok ?? false;
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
