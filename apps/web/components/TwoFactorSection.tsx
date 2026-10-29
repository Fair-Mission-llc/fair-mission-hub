'use client';
// Sprint 11 Revision 8.0: the baseline Two-Factor Authentication section (packages/shared/src/two-factor.ts). My Profile
// draws TwoFactorSection - a configuration row each for SMS text tokens, email secure passcodes and WebAuthn passkeys,
// the passkey row holding the FaceID setup and one line per device framework (Android, iOS, desktop). The Credentials
// Vault draws TwoFactorDeliveryPanel, the council's side: which second-step channels the portal can deliver today.
// Sprint 11 Revision 12.0: the SMS and email rows read what the server can send (GET /api/auth/two-factor) and whether
// the member is an Admin or Super Admin, who must type a code at each password sign-in.
// Sprint 11 Revision 12.5: the same GET reports the universal switch (TWO_FACTOR_REQUIRED=1), which asks every member.
import type { ReactNode } from 'react';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import {
  twoFactorRequiredFor,
  type TwoFactorDelivery,
  PASSKEY_PLATFORMS,
  TWO_FACTOR_METHODS,
  TWO_FACTOR_ROUTE,
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

/** What the server can send with and whether the universal switch is on (GET /api/auth/two-factor). */
function useTwoFactorDelivery() {
  return useLoad(
    async (): Promise<TwoFactorDelivery> =>
      (await fetch(TWO_FACTOR_ROUTE)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)) ?? { sms: false, email: false },
    [],
  );
}

/** The member's own section on My Profile. `passkeySetup` is the FaceID enrolment control the passkey row holds. */
export function TwoFactorSection({ facts, passkeySetup }: { facts: TwoFactorFacts; passkeySetup: ReactNode }) {
  const user = useUser();
  const delivery = useTwoFactorDelivery();
  const rows = twoFactorRows({
    ...facts,
    delivery: delivery.data ?? undefined,
    requiredForMember: twoFactorRequiredFor(user.memberType, delivery.data?.universal === true),
  });
  return (
    <Panel title={TWO_FACTOR_SECTION_TITLE}>
      <p className="mb-3 text-sm text-muted">
        A second step after your password keeps your council&apos;s records safe if your password is ever guessed. A passkey counts as the second step on
        its own. Text and email codes work once the portal has a provider connected.
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

/** The council's side, on the Secure Access Vault: which second-step channels the portal can deliver. */
export function TwoFactorDeliveryPanel({ emailGatewayConnected }: { emailGatewayConnected: boolean }) {
  const server = useTwoFactorDelivery().data;
  const universal = server?.universal === true;
  const who = universal ? 'every member' : 'Admins and Super Admins';
  const delivery: Record<(typeof TWO_FACTOR_METHODS)[number]['id'], { status: TwoFactorStatus; detail: string }> = {
    sms: server?.sms
      ? { status: 'ready', detail: `Twilio is connected. Sign-in codes are texted to ${who}.` }
      : { status: 'not-wired', detail: 'No Twilio account is connected to the portal server.' },
    email: server?.email
      ? { status: 'ready', detail: `SendGrid is connected. Codes are emailed to ${who} when no text can be sent.` }
      : emailGatewayConnected
        ? { status: 'available', detail: "Sign-in codes go through the platform's SendGrid account, not the council mail account above. SendGrid is not connected yet." }
        : { status: 'not-wired', detail: 'No SendGrid account is connected to the portal server.' },
    passkey: { status: 'ready', detail: 'Members set up a passkey on My Profile (Android, iOS and desktop browsers). A passkey sign-in needs no code.' },
  };
  return (
    <Panel title={`${TWO_FACTOR_SECTION_TITLE}: delivery channels`}>
      <p className="mb-3 text-sm" id="two-factor-universal-switch">
        <span className="font-bold">Sign-in codes for every member:</span>{' '}
        {universal
          ? server?.sms || server?.email
            ? 'On. Every member, officer and admin types a code at each password sign-in.'
            : 'On, but no provider is connected, so sign-in stays one step until Twilio or SendGrid is connected.'
          : 'Off. Only Admins and Super Admins type a code. The platform operator turns it on with TWO_FACTOR_REQUIRED=1 on the portal server.'}
      </p>
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
