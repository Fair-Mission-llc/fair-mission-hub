'use client';
// The in-app Advisory Panel invitation card (Sprint 10 Revision 4.0, advisory-panel.ts). An invitation is an alert with
// the reserved title ADVISORY_INVITE_TITLE that the platform owner posts to one member (advisory.inviteMember); nothing
// is emailed. The card leads the member's Home while an invitation is open, and the header's alert bell shows the same
// Accept button on the invitation row. Accept calls advisory.acceptInvitation, which gives the member the panelist role
// in the data at once; the session then takes the new roles (rolesChanged), so the 🔊 Application Advisory Panel link
// appears in the sidebar without signing in again.
import { useState } from 'react';
import { ADVISORY_PANEL_HREF, alertDisplayBody, describeError, pendingAdvisoryInvites, type NotificationLog } from '@kofc/shared';
import { Button, Notice } from '@/components/ui';
import { useSession, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** The Accept button for one invitation, shared by the Home card and the bell. */
export function AcceptInvitationButton({ alert, onAccepted }: { alert: NotificationLog; onAccepted?: () => void }) {
  const user = useUser();
  const { rolesChanged, alertsChanged } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const { roles } = await db.advisory.acceptInvitation(user.memberId, alert.id);
      rolesChanged(roles);
      alertsChanged();
      onAccepted?.();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="flex flex-col gap-1">
      <Button variant="gold" size="sm" disabled={busy} onClick={() => void accept()}>
        {busy ? 'Accepting…' : 'Accept'}
      </Button>
      {error ? <span className="text-xs text-brand-red">{error}</span> : null}
    </span>
  );
}

/** The Home card: one row per open invitation; nothing at all when there is none. */
export function AdvisoryInviteCard({ className }: { className?: string }) {
  const user = useUser();
  const { alertsVersion } = useSession();
  const alerts = useLoad(() => db.notifications.listMemberAlerts(user.memberId), [user.memberId, alertsVersion]);
  const [joined, setJoined] = useState(false);
  const open = pendingAdvisoryInvites(alerts.data ?? []);
  if (joined) {
    return (
      <div className={className}>
        <Notice tone="info">
          Welcome to the Application Advisory Panel. Open it from <a href={ADVISORY_PANEL_HREF} className="font-bold underline">🔊 Application Advisory Panel</a> in the
          sidebar.
        </Notice>
      </div>
    );
  }
  if (open.length === 0) return null;
  return (
    <section aria-label="Advisory Panel invitation" className={`${className ?? ''} rounded border-2 border-gold border-l-8 bg-white p-4`}>
      {open.map((a) => (
        <div key={a.id} className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-bold text-navy">🔊 {a.Title}</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm">{alertDisplayBody(a.MessageBody)}</p>
          </div>
          <AcceptInvitationButton alert={a} onAccepted={() => setJoined(true)} />
        </div>
      ))}
    </section>
  );
}
