'use client';
// Sprint 11 Revision 8.0: the baseline Two-Factor Authentication section (packages/shared/src/two-factor.ts). My Profile
// draws TwoFactorSection - a configuration row each for SMS text tokens, email secure passcodes and WebAuthn passkeys,
// the passkey row holding the FaceID setup and one line per device framework (Android, iOS, desktop). The Credentials
// Vault draws TwoFactorDeliveryPanel, the council's side: which second-step channels the portal can deliver today.
// Only passkeys work; the other rows say plainly that nothing is sent yet.
import type { ReactNode } from 'react';
import {
  PASSKEY_PLATFORMS,
  TWO_FACTOR_METHODS,
  TWO_FACTOR_SECTION_TITLE,
  TWO_FACTOR_STATUS_LABELS,
  twoFactorRows,
  type TwoFactorFacts,
  type TwoFactorStatus,
} from '@kofc/shared';
import { cx, Panel } from '@/components/ui';

const STATUS_TONE: Record<TwoFactorStatus, string> = {
  ready: 'border-green bg-green text-white',
  available: 'border-navy bg-white text-navy',
  'needs-contact': 'border-gold bg-gold/20 text-navy',
  'not-wired': 'border-line bg-white text-muted',
};

function StatusTag({ status }: { status: TwoFactorStatus }) {
  return <span className={cx('whitespace-nowrap rounded border px-2 py-0.5 text-xs font-bold', STATUS_TONE[status])}>{TWO_FACTOR_STATUS_LABELS[status]}</span>;
}

/** The member's own section on My Profile. `passkeySetup` is the FaceID enrolment control the passkey row holds. */
export function TwoFactorSection({ facts, passkeySetup }: { facts: TwoFactorFacts; passkeySetup: ReactNode }) {
  const rows = twoFactorRows(facts);
  return (
    <Panel title={TWO_FACTOR_SECTION_TITLE}>
      <p className="mb-3 text-sm text-muted">
        A second step after your password keeps your council&apos;s records safe if your password is ever guessed. Passkeys work today; text and email codes
        will follow once the council connects a provider.
      </p>
      <ul className="flex flex-col divide-y divide-line rounded border border-line" aria-label="Second-step methods">
        {rows.map(({ method, status, detail }) => (
          <li key={method.id} id={`two-factor-${method.id}`} className="flex flex-col gap-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">{method.label}</span>
              <StatusTag status={status} />
            </div>
            <p className="text-sm">{method.summary}</p>
            <p className="text-xs text-muted">{detail}</p>
            {method.id === 'passkey' ? (
              <>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
                  {PASSKEY_PLATFORMS.map((p) => (
                    <div key={p.id} className="contents">
                      <dt className="font-bold">{p.label}</dt>
                      <dd className="text-muted">{p.how}</dd>
                    </div>
                  ))}
                </dl>
                {passkeySetup}
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** The council's side, on the Credentials Vault: which second-step channels the portal can deliver. */
export function TwoFactorDeliveryPanel({ emailGatewayConnected }: { emailGatewayConnected: boolean }) {
  const delivery: Record<(typeof TWO_FACTOR_METHODS)[number]['id'], { status: TwoFactorStatus; detail: string }> = {
    sms: { status: 'not-wired', detail: 'No SMS provider is connected to the portal yet.' },
    email: emailGatewayConnected
      ? { status: 'available', detail: "The council's mail account above can carry passcodes once sign-in asks for them." }
      : { status: 'not-wired', detail: 'Connect the council mail account above first.' },
    passkey: { status: 'ready', detail: 'Members set up a passkey on My Profile (Android, iOS and desktop browsers).' },
  };
  return (
    <Panel title={`${TWO_FACTOR_SECTION_TITLE}: delivery channels`}>
      <ul className="flex flex-col divide-y divide-line rounded border border-line" aria-label="Second-step delivery channels">
        {TWO_FACTOR_METHODS.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <span>
              <span className="block font-bold">{m.label}</span>
              <span className="block text-xs text-muted">{delivery[m.id].detail}</span>
            </span>
            <StatusTag status={delivery[m.id].status} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
