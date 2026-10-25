// The phone's Advisory Panel invitation card (Sprint 10 Revision 4.0, advisory-panel.ts). The platform owner's in-app
// invitation (advisory.inviteMember) is pushed to the phone and shows here on Home, on top, until the member accepts it
// or it expires. Accept (advisory.acceptInvitation) gives the member the 'Application Advisory Panelist' role at once;
// the panel itself is on the web portal, so the card then says where to find it. Nothing shows without an invitation.
import { useState } from 'react';
import { View } from 'react-native';
import { alertDisplayBody, describeError, pendingAdvisoryInvites } from '@kofc/shared';
import { AppText, Button, Card, Notice } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { useLoad } from '@/lib/use-async';
import { useTheme } from '@/lib/layout-mode';
import { db } from '@/services/db';

export function AdvisoryInviteCard({ version = 0 }: { version?: number }) {
  const { color, space } = useTheme();
  const user = useUser();
  const alerts = useLoad(() => db.notifications.listMemberAlerts(user.memberId), [user.memberId, version]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const open = pendingAdvisoryInvites(alerts.data ?? []);

  const accept = async (alertId: number) => {
    setBusy(alertId);
    setError(null);
    try {
      await db.advisory.acceptInvitation(user.memberId, alertId);
      setJoined(true);
      await alerts.reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  if (joined) return <Notice tone="info" message="You joined the Application Advisory Panel. Open it on the web portal from the 🔊 Application Advisory Panel link in the sidebar." />;
  if (open.length === 0) return null;
  return (
    <View style={{ gap: space.sm }}>
      {error ? <Notice tone="error" message={error} /> : null}
      {open.map((a) => (
        <Card key={a.id} accent={color.gold}>
          <AppText variant="heading" accessibilityRole="header">
            🔊 {a.Title}
          </AppText>
          <AppText>{alertDisplayBody(a.MessageBody)}</AppText>
          <Button title="Accept" onPress={() => void accept(a.id)} busy={busy === a.id} disabled={busy !== null} />
        </Card>
      ))}
    </View>
  );
}
