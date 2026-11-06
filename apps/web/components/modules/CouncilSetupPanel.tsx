'use client';
// Council Setup (Sprint 11 Revision 21.5): the Council Wide Settings drawer that keeps the Setup Wizard after it leaves
// the Admin Desk, and the Practice Sandbox master switch that used to sit in the desk's control bar. Both work on the
// reader's home council (the wizard's own rule), so a Super Admin looking at another council sees a note instead.
import { useState } from 'react';
import { canAdministerCouncil, describeError, PURGE_PRACTICE_SANDBOX_LABEL, type Council } from '@kofc/shared';
import { SetupWizard } from '@/components/modules/SetupWizard';
import { Button, HelpTip, Notice, Panel, Switch } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** The Practice Sandbox master switch: on seeds the practice records, off purges them (councils.*PracticeSandbox). */
export function PracticeSandboxSwitch({ version }: { version: number }) {
  const user = useUser();
  const status = useLoad(() => db.councils.getPracticeSandboxStatus(user.memberId, user.councilId), [user.memberId, user.councilId, version]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = status.data?.active === true;
  const toggle = async (next: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (next) await db.councils.seedPracticeSandbox(user.memberId, user.councilId);
      else await db.councils.purgePracticeSandbox(user.memberId, user.councilId);
      await status.reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Switch
            checked={on}
            disabled={busy || status.loading}
            onChange={(next) => void toggle(next)}
            label={PURGE_PRACTICE_SANDBOX_LABEL}
            description={
              on
                ? `On: ${status.data?.members ?? 0} practice members, ${status.data?.events ?? 0} practice fundraisers. Off purges them.`
                : 'Off: no practice data. On adds 10 practice members and 3 practice fundraisers.'
            }
          />
        </div>
        <HelpTip
          label="More about the Practice Sandbox"
          text="Practice records: @practice.sandbox emails and [Practice] event names. Off removes only those, with their shifts, sign-ups and logins."
        />
      </div>
      {status.error ? <Notice tone="error">{status.error}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}

export function CouncilSetupPanel({ council }: { council: Council }) {
  const user = useUser();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [runs, setRuns] = useState(0);
  if (council.id !== user.councilId) return <Notice tone="info">Council Setup works on your home council only.</Notice>;
  if (!canAdministerCouncil(user, council.id)) return <Notice tone="info">Council Setup: council Admins and Super Admins.</Notice>;
  return (
    <>
      {wizardOpen ? (
        <SetupWizard
          onClose={() => {
            setWizardOpen(false);
            setRuns((n) => n + 1);
          }}
        />
      ) : null}
      <Panel title="Setup Wizard">
        <p className="mb-3 text-sm">Five-step council setup. Safe to run again.</p>
        <Button variant="gold" onClick={() => setWizardOpen(true)}>
          Run Setup Wizard
        </Button>
      </Panel>
      <Panel title="Practice Sandbox" className="mt-4">
        <PracticeSandboxSwitch version={runs} />
      </Panel>
    </>
  );
}
