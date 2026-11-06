'use client';
// Sprint 11 Revision 21.5 (client-telemetry.ts): the actionable notice card a sign-in from a client older than
// CLIENT_RELEASE_BASELINE gets. A browser reloads to the current portal; a desktop or phone client is told how to update.
import { useSession } from '@/lib/session';
import { Button } from '@/components/ui';

export function UpgradeNoticeCard() {
  const { upgradeNotice, dismissUpgradeNotice } = useSession();
  if (!upgradeNotice) return null;
  return (
    <section role="alert" aria-label={upgradeNotice.title} data-upgrade-notice="true" className="flex flex-wrap items-center gap-3 border-b-4 border-gold bg-gold/20 px-6 py-3 text-navy">
      <div className="min-w-0 flex-1">
        <p className="font-serif font-bold">{upgradeNotice.title}</p>
        <p className="text-sm">{upgradeNotice.body}</p>
      </div>
      {upgradeNotice.actionLabel === 'Reload now' ? (
        <Button variant="gold" onClick={() => window.location.reload()}>
          {upgradeNotice.actionLabel}
        </Button>
      ) : null}
      <Button variant="secondary" onClick={dismissUpgradeNotice}>
        Dismiss
      </Button>
    </section>
  );
}
