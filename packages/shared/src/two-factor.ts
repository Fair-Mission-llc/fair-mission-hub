// =========================================================================
// TWO-FACTOR AUTHENTICATION LAYOUT (Sprint 11 Revision 8.0)
// The baseline Two-Factor Authentication section of My Profile and the Secure Access Vault: one configuration row per
// second-step method - SMS text tokens, email secure passcodes and WebAuthn hardware passkeys - and, for passkeys, one
// row per device framework (Android, iOS and desktop browsers).
//
// The passkey method is the server-verified web FaceID of Sprint 10 Revision 5.0 (apps/web/services/server/webauthn.ts,
// the UserPasskeys table since schema 104). Sprint 11 Revision 12.0 wires the SMS and email methods: when the server
// holds Twilio or SendGrid tokens, an Admin's or Super Admin's password sign-in asks for a code (see the second half of
// this file). A method's status comes from facts the page has: the member's phone and email on file, what the server
// can deliver (GET /api/auth/two-factor), whether the member must pass the step, and whether this browser holds a passkey.
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
  /** Whether the council's outbound email gateway is connected (Secure Access Vault). */
  emailGatewayConnected: boolean;
  /** Whether the browser can make a passkey at all (lib/webauthn-client.ts faceIdSupported). */
  passkeySupported: boolean;
  /** Whether this browser holds a passkey for the member (lib/webauthn-client.ts rememberedPasskey). */
  passkeyOnThisDevice: boolean;
  /** Sprint 11 Revision 12.0: what the server can send (GET /api/auth/two-factor); omitted reads as nothing. */
  delivery?: TwoFactorDelivery;
  /** Sprint 11 Revision 12.0: the member is an Admin or Super Admin (twoFactorRequiredFor). */
  requiredForMember?: boolean;
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
        if (normalizeSmsNumber(facts.phone) === null) return { method, status: 'needs-contact', detail: 'Add a cell phone under Contact details first.' };
        if (!facts.delivery?.sms) return { method, status: 'not-wired', detail: 'Your phone is on file, but the portal has no Twilio account connected, so no code can be sent.' };
        return facts.requiredForMember
          ? { method, status: 'ready', detail: 'At each password sign-in a 6-digit code is texted to the cell phone on file.' }
          : { method, status: 'available', detail: 'Codes are texted to Admins and Super Admins at sign-in. Members sign in with a password.' };
      case 'email':
        if (!hasText(facts.email)) return { method, status: 'needs-contact', detail: 'Add an email address under Contact details first.' };
        if (!facts.delivery?.email) return { method, status: 'not-wired', detail: `The portal has no SendGrid account connected, so no passcode can be emailed. Codes come from ${PLATFORM_OPERATIONS_SENDER} once it is.` };
        return facts.requiredForMember
          ? { method, status: 'ready', detail: `At each password sign-in a 6-digit passcode is emailed from ${PLATFORM_OPERATIONS_SENDER} when no text can be sent.` }
          : { method, status: 'available', detail: 'Passcodes are emailed to Admins and Super Admins at sign-in. Members sign in with a password.' };
      case 'passkey':
        if (!facts.passkeySupported) return { method, status: 'not-wired', detail: 'This browser cannot make a passkey. Try Chrome on Android or Safari on iOS.' };
        return facts.passkeyOnThisDevice
          ? { method, status: 'ready', detail: 'This device holds your passkey. Use Sign in with FaceID on the sign-in page.' }
          : { method, status: 'available', detail: "Set up a passkey with this device's face or fingerprint check." };
    }
  });
}

// =========================================================================
// SIGN-IN CODES AND MAIL SEPARATION (Sprint 11 Revision 12.0)
// Admins and Super Admins (the user's choice) get a second step at password sign-in once the server holds verified
// delivery tokens: Twilio for SMS codes (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER) or SendGrid for
// email passcodes (SENDGRID_API_KEY with SENDGRID_LIVE=1). With neither, sign-in stays one step, as before. The code
// itself never leaves the server except by SMS or email; the browser holds only a signed challenge (server
// two-factor.ts). Members sign in with their password alone.
//
// Mail separation: everything the platform sends on its own behalf - Super Admin operations notices and these sign-in
// codes - goes from PLATFORM_OPERATIONS_SENDER through SendGrid. Mail a council sends to its own members (event and
// distribution-list mail) goes through that council's own SMTP account in the Secure Access Vault, never from the
// platform address.
// =========================================================================

/** The only address platform operations mail is sent from (the user's choice). */
export const PLATFORM_OPERATIONS_SENDER = 'tim@fairmissionsoftware.com';

/** Member types that must pass the second step when a delivery channel is configured. */
export const TWO_FACTOR_REQUIRED_TYPES: readonly string[] = ['Admin', 'Super Admin'];
export const twoFactorRequiredFor = (memberType: string | null | undefined): boolean => TWO_FACTOR_REQUIRED_TYPES.includes(memberType ?? '');

export const TWO_FACTOR_CODE_LENGTH = 6;
/** A code and its challenge expire after five minutes. */
export const TWO_FACTOR_CODE_TTL_SECONDS = 300;
/** Wrong codes allowed per challenge before it is spent. */
export const TWO_FACTOR_MAX_ATTEMPTS = 5;

export type TwoFactorChannel = 'sms' | 'email';

/** What the server can send with, from its environment. */
export interface TwoFactorDelivery {
  sms: boolean;
  email: boolean;
}

/**
 * The channel a sign-in code goes by: the one asked for when it is configured and the contact is on file, else SMS,
 * else email; null when none works (sign-in then stays one step).
 */
export function chooseTwoFactorChannel(
  delivery: TwoFactorDelivery,
  contact: { phone?: string | null; email?: string | null },
  requested?: unknown,
): TwoFactorChannel | null {
  const usable: TwoFactorChannel[] = [];
  if (delivery.sms && normalizeSmsNumber(contact.phone) !== null) usable.push('sms');
  if (delivery.email && hasText(contact.email)) usable.push('email');
  if ((requested === 'sms' || requested === 'email') && usable.includes(requested)) return requested;
  return usable[0] ?? null;
}

/** A phone on file as E.164: '+' and 8-15 digits kept; 10 digits read as a US number (+1); anything else null. */
export function normalizeSmsNumber(phone: string | null | undefined): string | null {
  if (!hasText(phone)) return null;
  const raw = phone!.trim();
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/** Where the code went, without giving the whole address away: '***-***-0142', 'm***@kofc15295.org'. */
export function maskTwoFactorTarget(channel: TwoFactorChannel, contact: { phone?: string | null; email?: string | null }): string {
  if (channel === 'sms') return `***-***-${(contact.phone ?? '').replace(/\D/g, '').slice(-4)}`;
  const [name, domain] = (contact.email ?? '').split('@');
  return `${(name ?? '').slice(0, 1)}***@${domain ?? ''}`;
}

/** A six-digit code from cryptographic randomness, evenly spread (no modulo bias), leading zeros kept. */
export function generateTwoFactorCode(random: (bytes: Uint8Array) => Uint8Array = (b) => globalThis.crypto.getRandomValues(b)): string {
  const limit = 4_294_000_000; // largest multiple of 1,000,000 below 2^32
  for (;;) {
    const view = new DataView(random(new Uint8Array(4)).buffer);
    const n = view.getUint32(0);
    if (n < limit) return String(n % 1_000_000).padStart(TWO_FACTOR_CODE_LENGTH, '0');
  }
}

/** A code as typed: digits only, spaces and dashes ignored; null unless exactly six digits remain. */
export function cleanTwoFactorCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
}

export const twoFactorSmsText = (code: string): string =>
  `${code} is your sign-in code for the council portal. It expires in ${TWO_FACTOR_CODE_TTL_SECONDS / 60} minutes. Do not share it.`;

/** The email passcode, always from the platform operations sender. */
export function twoFactorEmail(to: string, code: string): { to: string; from: string; subject: string; text: string; attachments: [] } {
  return {
    to,
    from: PLATFORM_OPERATIONS_SENDER,
    subject: 'Your portal sign-in code',
    text:
      `Your sign-in code is ${code}.\n\nIt expires in ${TWO_FACTOR_CODE_TTL_SECONDS / 60} minutes. Type it on the sign-in page to finish signing in.\n` +
      'If you did not try to sign in, change your password and tell your platform administrator.',
    attachments: [],
  };
}

/** A Twilio Programmable Messaging request (POST /2010-04-01/Accounts/{sid}/Messages.json, form-encoded, Basic auth). */
export interface TwilioSmsRequest {
  method: 'POST';
  url: string;
  headers: Record<string, string>;
  body: string;
}

export function buildTwilioSmsRequest(
  credentials: { accountSid: string; authToken: string; fromNumber: string },
  to: string,
  text: string,
): TwilioSmsRequest {
  const basic = btoa(`${credentials.accountSid}:${credentials.authToken}`);
  return {
    method: 'POST',
    url: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(credentials.accountSid)}/Messages.json`,
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: credentials.fromNumber, Body: text }).toString(),
  };
}

/** Which way a piece of mail leaves the platform (the separation filter). */
export type OutboundMailRoute =
  | { via: 'platform-sendgrid'; from: typeof PLATFORM_OPERATIONS_SENDER }
  | { via: 'council-smtp' }
  | { via: 'held'; reason: string };

/**
 * Platform operations mail always goes from PLATFORM_OPERATIONS_SENDER. Council mail goes only through the council's own
 * SMTP account; without one it is held (logged), never sent from the platform address.
 */
export function outboundMailRoute(kind: 'platform-operations' | 'council-distribution', councilSmtpReady: boolean): OutboundMailRoute {
  if (kind === 'platform-operations') return { via: 'platform-sendgrid', from: PLATFORM_OPERATIONS_SENDER };
  if (councilSmtpReady) return { via: 'council-smtp' };
  return { via: 'held', reason: "The council's own mail account is not connected in the Secure Access Vault, so council mail is not sent." };
}

/** Whether a sender address is the platform's own, which council mail may never use. */
export const isPlatformOperationsSender = (address: string | null | undefined): boolean =>
  (address ?? '').trim().toLowerCase() === PLATFORM_OPERATIONS_SENDER;
