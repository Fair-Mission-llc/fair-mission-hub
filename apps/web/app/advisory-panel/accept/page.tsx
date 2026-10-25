'use client';
// Accept an Advisory Panel invitation (Sprint 10 Revision 3.2). The emailed link opens this page with ?token=...; the
// signed-in member selects Accept, the server checks the link names them (/api/advisory/invitations/accept), gives them
// the 'Application Advisory Panelist' role and re-issues their session, and the page opens the panel. Every signed-in
// member may open the page - the invitee is not a panelist yet - and the server decides.
import { useEffect, useState } from 'react';
import { ADVISORY_PANEL_HREF, ADVISORY_PANEL_TITLE, describeError } from '@kofc/shared';
import { Button, Notice, PageTitle, Panel } from '@/components/ui';

export default function AcceptAdvisoryInvitationPage() {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token')), []);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/advisory/invitations/accept', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const answer = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) throw new Error(answer?.message ?? `The server answered HTTP ${res.status}.`);
      setDone(true);
      // A full load picks up the re-issued session, which now carries the panelist role.
      window.location.assign(ADVISORY_PANEL_HREF);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle>Advisory Panel invitation</PageTitle>
      <Panel title={`Join the ${ADVISORY_PANEL_TITLE}`}>
        <p className="mb-3 text-base">
          You were invited to the Application Advisory Panel. Panelists from every council read the development roadmap, review the coming releases, see the
          panel meeting dates and send their feedback.
        </p>
        {!token ? <Notice tone="error">This page needs the link from your invitation email.</Notice> : null}
        {error ? (
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        ) : null}
        {done ? <Notice tone="info">Welcome to the panel. Opening it now…</Notice> : null}
        <Button variant="gold" className="mt-3" disabled={busy || !token || done} onClick={() => void accept()}>
          {busy ? 'Accepting…' : 'Accept invitation'}
        </Button>
      </Panel>
    </>
  );
}
