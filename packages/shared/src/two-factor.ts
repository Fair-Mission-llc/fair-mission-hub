// =========================================================================
// TWO-FACTOR AUTHENTICATION LAYOUT (Sprint 11 Revision 8.0)
// The baseline Two-Factor Authentication section of My Profile and the Credentials Vault: one configuration row per
// second-step method - SMS text tokens, email secure passcodes and WebAuthn hardware passkeys - and, for passkeys, one
// row per device framework (Android, iOS and desktop browsers).
//
// These are layout hooks. Only the passkey method works today: it is the server-verified web FaceID of Sprint 10
// Revision 5.0 (apps/web/services/server/webauthn.ts, the UserPasskeys table since schema 104). Sign-in does not yet
// ask for a second step, no SMS provider is connected, and no passcode is ever sent; each row says so in plain words
// instead of offering a switch that would do nothing. A method's status comes from facts the page already has: the
// member's phone and email on file, the council's email gateway and whether this browser holds a passkey.
// =========================================================================

export const TWO_FACTOR_SECTION_TITLE = 'Two-Factor Authentication';

export const TWO_FACTOR_METHOD_IDS = ['sms', 'email', 'passkey'] as const;
export type TwoFactorMethodId = (typeof TWO_FACTOR_METHOD_IDS)[number];

export interface TwoFactorMethod {
  id: TwoFactorMethodId;
  label: string;
  /** One line on what the second step is. */
  summary: string;
}

export const TWO_FACTOR_METHODS: readonly TwoFactorMethod[] = [
  { id: 'sms', label: 'SMS text tokens', summary: 'A 6-digit code sent by text message to the cell phone on file.' },
  { id: 'email', label: 'Email secure passcodes', summary: 'A one-time passcode sent to the email address on file.' },
  {
    id: 'passkey',
    label: 'WebAuthn biometric hardware passkeys',
    summary: "The device's own face or fingerprint check unlocks a passkey; no code is typed and nothing is sent.",
  },
];

/** Where a passkey can live. The native phone app keeps its own biometric key (expo-local-authentication), not WebAuthn. */
export const PASSKEY_PLATFORMS = [
  { id: 'android', label: 'Android', how: 'Chrome with fingerprint or face unlock; the passkey is kept in Google Password Manager.' },
  { id: 'ios', label: 'iOS and iPadOS', how: 'Safari with Face ID or Touch ID; the passkey is kept in iCloud Keychain.' },
  { id: 'desktop', label: 'Desktop browsers', how: 'Windows Hello, Touch ID on a Mac, or a USB / NFC security key.' },
] as const;
export type PasskeyPlatformId = (typeof PASSKEY_PLATFORMS)[number]['id'];

/** ready: works now; available: can be set up now; needs-contact: a phone or email must be on file first; not-wired: no delivery yet. */
export type TwoFactorStatus = 'ready' | 'available' | 'needs-contact' | 'not-wired';

export const TWO_FACTOR_STATUS_LABELS: Record<TwoFactorStatus, string> = {
  ready: 'Set up',
  available: 'Ready to set up',
  'needs-contact': 'Add contact details first',
  'not-wired': 'Not connected yet',
};

export interface TwoFactorFacts {
  /** The member's phone on file (Member.Phone). */
  phone?: string | null;
  /** The member's email on file (Member.Email). */
  email?: string | null;
  /** Whether the council's outbound email gateway is connected (Credentials Vault). */
  emailGatewayConnected: boolean;
  /** Whether the browser can make a passkey at all (lib/webauthn-client.ts faceIdSupported). */
  passkeySupported: boolean;
  /** Whether this browser holds a passkey for the member (lib/webauthn-client.ts rememberedPasskey). */
  passkeyOnThisDevice: boolean;
}

export interface TwoFactorRow {
  method: TwoFactorMethod;
  status: TwoFactorStatus;
  /** The plain-English line under the status. */
  detail: string;
}

const hasText = (v: string | null | undefined): boolean => typeof v === 'string' && v.trim() !== '';

/** The three configuration rows, in TWO_FACTOR_METHODS order. */
export function twoFactorRows(facts: TwoFactorFacts): TwoFactorRow[] {
  return TWO_FACTOR_METHODS.map((method): TwoFactorRow => {
    switch (method.id) {
      case 'sms':
        return hasText(facts.phone)
          ? { method, status: 'not-wired', detail: 'Your phone is on file, but no SMS provider is connected to the portal yet, so no code can be sent.' }
          : { method, status: 'needs-contact', detail: 'Add a cell phone under Contact details first. No SMS provider is connected yet either.' };
      case 'email':
        if (!hasText(facts.email)) return { method, status: 'needs-contact', detail: 'Add an email address under Contact details first.' };
        return facts.emailGatewayConnected
          ? { method, status: 'not-wired', detail: "The council's mail account is connected, but sign-in does not ask for a passcode yet." }
          : { method, status: 'not-wired', detail: "The council's mail account is not connected in the Credentials Vault, and sign-in does not ask for a passcode yet." };
      case 'passkey':
        if (!facts.passkeySupported) return { method, status: 'not-wired', detail: 'This browser cannot make a passkey. Try Chrome on Android or Safari on iOS.' };
        return facts.passkeyOnThisDevice
          ? { method, status: 'ready', detail: 'This device holds your passkey. Use Sign in with FaceID on the sign-in page.' }
          : { method, status: 'available', detail: "Set up a passkey with this device's face or fingerprint check." };
    }
  });
}
