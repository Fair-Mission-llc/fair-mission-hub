'use client';
// The Admin Desk Setup Wizard (Sprint 11 Revision 4.1, setup-wizard.ts): a five-step overlay that masks the Admin Desk
// until the Admin finishes or skips it. Every step works on the Admin's own home council (user.councilId), so the
// email gateway's password goes to that council's vault entry only (/api/councils/email-gateway and vault-gate.ts
// refuse any other council).
//   1. Supreme CSV Roster Ingestion   SupremeRosterUploader
//   2. File Storage and Email Gateway FileRepositoryCard + EmailGatewayPanel
//   3. Clone Founding Template        councils.cloneFoundingTemplate
//   4. Practice Sandbox               councils.seedPracticeSandbox (purged from the desk's Practice Sandbox switch)
//   5. Quick-Start Guide              /api/manuals/pdf?manual=quickstart, then the desk opens
import { useEffect, useRef, useState } from 'react';
import {
  ACTIVATE_PRACTICE_SANDBOX_LABEL,
  CLONE_FOUNDING_TEMPLATE_LABEL,
  describeError,
  FOUNDING_COUNCIL_NUMBER,
  PRACTICE_FUNDRAISER_COUNT,
  PRACTICE_MEMBER_COUNT,
  QUICK_START_GUIDE,
  SETUP_WIZARD_STEPS,
  SETUP_WIZARD_TITLE,
  setupWizardDoneKey,
  type FoundingTemplateCloneResult,
  type PracticeSandboxSeedResult,
} from '@kofc/shared';
import { EmailGatewayPanel } from '@/components/EmailGatewayPanel';
import { FileRepositoryCard } from '@/components/FileRepositoryCard';
import { SupremeRosterUploader } from '@/components/modules/SupremeRosterUploader';
import { Button, cx, EmbeddedModuleContext, HelpTip, Notice } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

export const QUICK_START_PDF_HREF = `/api/manuals/pdf?manual=${QUICK_START_GUIDE.key}`;

/** Remembers, in this browser only, that the wizard was finished or skipped for the council. */
export function markSetupWizardDone(councilId: number): void {
  try {
    window.localStorage.setItem(setupWizardDoneKey(councilId), '1');
  } catch {
    // Storage may be blocked; the wizard then simply offers itself again next time.
  }
}

export function setupWizardWasDone(councilId: number): boolean {
  try {
    return window.localStorage.getItem(setupWizardDoneKey(councilId)) === '1';
  } catch {
    return false;
  }
}

function StorageAndEmailStep({ councilId }: { councilId: number }) {
  const council = useLoad(() => db.councils.get(councilId), [councilId]);
  return (
    <div className="flex flex-col gap-4">
      {council.error ? <Notice tone="error">{council.error}</Notice> : null}
      {council.data ? <FileRepositoryCard council={council.data} onSaved={council.reload} /> : <p className="text-sm">Loading…</p>}
      <EmailGatewayPanel councilId={councilId} />
    </div>
  );
}

function FoundingTemplateStep({ councilId }: { councilId: number }) {
  const user = useUser();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FoundingTemplateCloneResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clone = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await db.councils.cloneFoundingTemplate(user.memberId, councilId));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Copies Founding Council {FOUNDING_COUNCIL_NUMBER}&apos;s chart of accounts, Council Lookup Tables rows (activities, donation types and payment methods)
        and Council Wide Settings onto your council. Anything your council already has with the same name stays as it is.
      </p>
      <div className="flex items-center gap-2">
        <Button variant="gold" onClick={() => void clone()} disabled={busy}>
          {busy ? 'Cloning…' : CLONE_FOUNDING_TEMPLATE_LABEL}
        </Button>
        <HelpTip
          label="More about the founding template"
          text="Safe to select again: it copies only what is missing. Contacts, QR images, savings goal accounts and sister-council accounts are not copied."
        />
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {result ? (
        <Notice tone="info">
          Copied {result.accounts} accounts, {result.activities} activities, {result.donationTypes} donation types, {result.paymentMethods} payment methods and{' '}
          {result.settings} council settings.
        </Notice>
      ) : null}
    </div>
  );
}

function PracticeSandboxStep({ councilId }: { councilId: number }) {
  const user = useUser();
  const status = useLoad(() => db.councils.getPracticeSandboxStatus(user.memberId, councilId), [user.memberId, councilId]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PracticeSandboxSeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activate = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await db.councils.seedPracticeSandbox(user.memberId, councilId));
      await status.reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };
  const on = status.data?.active === true;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Adds {PRACTICE_MEMBER_COUNT} practice members and {PRACTICE_FUNDRAISER_COUNT} practice fundraisers, each with a shift and volunteers, so you can try every
        desk end to end. Practice members get no email. Turn the sandbox off later with the Practice Sandbox switch at the top of the Admin Desk.
      </p>
      <div className="flex items-center gap-2">
        <Button onClick={() => void activate()} disabled={busy || on || status.loading}>
          {busy ? 'Adding practice data…' : on ? 'Practice Sandbox is on' : ACTIVATE_PRACTICE_SANDBOX_LABEL}
        </Button>
        <HelpTip
          label="More about the practice sandbox"
          text="Practice members have emails ending in @practice.sandbox. Practice fundraisers start with [Practice]. Purging removes only these records."
        />
      </div>
      {status.error ? <Notice tone="error">{status.error}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {result ? (
        <Notice tone="info">
          Added {result.members} practice members, {result.events} practice fundraisers and {result.signups} shift sign-ups.
        </Notice>
      ) : null}
      <p className="text-xs text-muted">This step is optional. Select Next to go on without practice data.</p>
    </div>
  );
}

function QuickStartStep() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        The {QUICK_START_GUIDE.title} is a short printable guide to these five steps. Keep it beside you while you set up the council.
      </p>
      <a
        href={QUICK_START_PDF_HREF}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit items-center gap-2 rounded border-2 border-navy bg-white px-4 py-2 font-bold text-navy hover:bg-gold/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold"
      >
        Download the {QUICK_START_GUIDE.title} (PDF)
      </a>
    </div>
  );
}

/** The overlay. `onClose(finished)` runs when the Admin opens the desk (true) or skips (false). */
export function SetupWizard({ onClose }: { onClose: (finished: boolean) => void }) {
  const user = useUser();
  const councilId = user.councilId;
  const [index, setIndex] = useState(0);
  const step = SETUP_WIZARD_STEPS[index]!;
  const last = index === SETUP_WIZARD_STEPS.length - 1;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Each new step takes the focus, so a screen reader reads its title.
  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  const close = (finished: boolean) => {
    markSetupWizardDone(councilId);
    onClose(finished);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-navy/80 p-4 sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-wizard-step-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') close(false);
        }}
        className="flex w-full max-w-3xl flex-col gap-4 rounded border-2 border-navy border-t-8 border-t-gold bg-white p-5"
      >
        <header className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            {SETUP_WIZARD_TITLE} · Step {step.number} of {SETUP_WIZARD_STEPS.length}
          </p>
          <ol aria-label="Setup steps" className="flex flex-wrap gap-1">
            {SETUP_WIZARD_STEPS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? 'step' : undefined}
                  className={cx(
                    'rounded border-2 border-navy px-2 py-0.5 text-xs font-bold focus:outline-none focus-visible:ring-4 focus-visible:ring-gold',
                    i === index ? 'bg-navy text-white' : i < index ? 'bg-gold/30 text-navy' : 'bg-white text-navy',
                  )}
                >
                  {s.number}. {s.title}
                </button>
              </li>
            ))}
          </ol>
          <h2 id="setup-wizard-step-title" ref={headingRef} tabIndex={-1} className="font-serif text-2xl font-bold text-navy focus:outline-none">
            Step {step.number}: {step.title}
          </h2>
          <p className="text-sm">{step.prompt}</p>
        </header>

        <EmbeddedModuleContext.Provider value={true}>
          <section aria-label={step.title} className="min-w-0">
            {step.id === 'roster' ? <SupremeRosterUploader councilId={councilId} /> : null}
            {step.id === 'storage-email' ? <StorageAndEmailStep councilId={councilId} /> : null}
            {step.id === 'founding-template' ? <FoundingTemplateStep councilId={councilId} /> : null}
            {step.id === 'practice-sandbox' ? <PracticeSandboxStep councilId={councilId} /> : null}
            {step.id === 'quick-start' ? <QuickStartStep /> : null}
          </section>
        </EmbeddedModuleContext.Provider>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-line pt-3">
          <Button variant="secondary" onClick={() => close(false)}>
            Skip for now
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>
              Back
            </Button>
            {last ? <Button onClick={() => close(true)}>Open the Admin Desk</Button> : <Button onClick={() => setIndex((i) => i + 1)}>Next</Button>}
          </div>
        </footer>
      </div>
    </div>
  );
}
