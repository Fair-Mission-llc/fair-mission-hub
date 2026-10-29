// Sprint 11 Revision 12.0: the second sign-in step for Admins and Super Admins (shared two-factor.ts).
//
// SERVER ONLY. After a correct password, issueTwoFactorChallenge makes a 6-digit code, sends it by Twilio SMS or by
// SendGrid email from the platform operations sender, and returns a challenge: the session it will open, the channel,
// a nonce, the expiry and an HMAC of the code, signed as a whole with a key derived from PORTAL_SESSION_SECRET. The code
// is never in the challenge. verifyTwoFactorChallenge checks the signature, the expiry and the code (constant time),
// allows TWO_FACTOR_MAX_ATTEMPTS wrong codes per challenge and spends the challenge on success, so it cannot be replayed.
// Attempts and spent nonces live in this process's memory; a restart ends every open challenge, which is safe.
//
// Delivery needs verified tokens in the environment: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER for
// SMS; SENDGRID_API_KEY with SENDGRID_LIVE=1 for email. Without either, twoFactorDelivery says so and sign-in stays one
// step, which keeps pilots, tests and the desktop build signing in as before.
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  buildSendGridMailRequest,
  buildTwilioSmsRequest,
  chooseTwoFactorChannel,
  cleanTwoFactorCode,
  generateTwoFactorCode,
  maskTwoFactorTarget,
  normalizeSmsNumber,
  TWO_FACTOR_CODE_TTL_SECONDS,
  TWO_FACTOR_MAX_ATTEMPTS,
  twoFactorEmail,
  twoFactorRequiredFor,
  twoFactorSmsText,
  type SessionUser,
  type TwoFactorChannel,
  type TwoFactorDelivery,
} from '@kofc/shared';
import { liveSendGridKey, portalSessionSecret } from './secrets';

if (typeof window !== 'undefined') {
  throw new Error('services/server/two-factor.ts was loaded in a browser. Server secrets must never reach the client bundle.');
}

type Env = Record<string, string | undefined>;

/** The Twilio account when all three tokens are set; otherwise null. */
export function twilioCredentials(env: Env = process.env): { accountSid: string; authToken: string; fromNumber: string } | null {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = normalizeSmsNumber(env.TWILIO_FROM_NUMBER);
  return accountSid && authToken && fromNumber ? { accountSid, authToken, fromNumber } : null;
}

/** What this server can send codes with. */
export const twoFactorDelivery = (env: Env = process.env): TwoFactorDelivery => ({ sms: twilioCredentials(env) !== null, email: liveSendGridKey(env) !== null });

interface ChallengeBody {
  v: 1;
  user: SessionUser;
  active: boolean;
  channel: TwoFactorChannel;
  nonce: string;
  /** Expiry, epoch seconds. */
  exp: number;
  /** HMAC of nonce + code. */
  h: string;
}

const key = (env?: Env) => `${portalSessionSecret(env)}:two-factor:v1`;
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
const unb64 = (s: string) => Buffer.from(s, 'base64url').toString('utf8');
const hmac = (data: string, env?: Env) => createHmac('sha256', key(env)).update(data).digest('base64url');
const sameText = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

const attempts = new Map<string, number>();
/** Spent nonces with their expiry; pruned once expired, since an expired challenge is refused anyway. */
const spent = new Map<string, number>();
function prune(now: number): void {
  for (const [nonce, exp] of spent) if (exp < now) spent.delete(nonce);
}

/** Sends the code; resolves when the provider accepted it. Throws in plain words otherwise. */
export type CodeSender = (channel: TwoFactorChannel, to: string, code: string) => Promise<void>;

export const liveCodeSender =
  (env: Env = process.env): CodeSender =>
  async (channel, to, code) => {
    if (channel === 'sms') {
      const twilio = twilioCredentials(env);
      if (!twilio) throw new Error('No Twilio account is connected.');
      const req = buildTwilioSmsRequest(twilio, to, twoFactorSmsText(code));
      const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
      if (!res.ok) throw new Error(`Twilio answered HTTP ${res.status}.`);
      return;
    }
    const sendGrid = liveSendGridKey(env);
    if (!sendGrid) throw new Error('No SendGrid account is connected.');
    const live = buildSendGridMailRequest(twoFactorEmail(to, code), sendGrid);
    const res = await fetch(live.url, { method: live.method, headers: live.headers, body: JSON.stringify(live.body) });
    if (!res.ok) throw new Error(`SendGrid answered HTTP ${res.status}.`);
  };

export interface TwoFactorPrompt {
  challenge: string;
  channel: TwoFactorChannel;
  /** Where the code went, masked. */
  sentTo: string;
  expiresInSeconds: number;
}

/**
 * The challenge for a member who just passed the password check, or null when the member needs no second step (not an
 * Admin or Super Admin, no delivery configured, or no usable phone or email on file).
 */
export async function issueTwoFactorChallenge(
  found: { user: SessionUser; active: boolean },
  contact: { phone?: string | null; email?: string | null },
  options: { requested?: unknown; now?: Date; env?: Env; send?: CodeSender } = {},
): Promise<TwoFactorPrompt | null> {
  if (!twoFactorRequiredFor(found.user.memberType)) return null;
  const env = options.env ?? process.env;
  const channel = chooseTwoFactorChannel(twoFactorDelivery(env), contact, options.requested);
  if (!channel) return null;
  const code = generateTwoFactorCode();
  const nonce = Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(16))).toString('base64url');
  const to = channel === 'sms' ? normalizeSmsNumber(contact.phone)! : contact.email!.trim();
  await (options.send ?? liveCodeSender(env))(channel, to, code);
  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const body: ChallengeBody = { v: 1, user: found.user, active: found.active, channel, nonce, exp: now + TWO_FACTOR_CODE_TTL_SECONDS, h: hmac(`${nonce}.${code}`, env) };
  const payload = b64(JSON.stringify(body));
  return { challenge: `${payload}.${hmac(payload, env)}`, channel, sentTo: maskTwoFactorTarget(channel, contact), expiresInSeconds: TWO_FACTOR_CODE_TTL_SECONDS };
}

export type TwoFactorVerdict =
  | { ok: true; user: SessionUser; active: boolean }
  | { ok: false; status: 400 | 401 | 429; message: string };

/** Checks a typed code against its challenge. A correct code spends the challenge. */
export function verifyTwoFactorChallenge(challenge: unknown, typed: unknown, options: { now?: Date; env?: Env } = {}): TwoFactorVerdict {
  const code = cleanTwoFactorCode(typed);
  if (typeof challenge !== 'string' || !code) return { ok: false, status: 400, message: 'Type the 6-digit code.' };
  const [payload, signature] = challenge.split('.');
  if (!payload || !signature || !sameText(signature, hmac(payload, options.env))) {
    return { ok: false, status: 401, message: 'This sign-in code request is not valid. Sign in again.' };
  }
  let body: ChallengeBody;
  try {
    body = JSON.parse(unb64(payload)) as ChallengeBody;
  } catch {
    return { ok: false, status: 401, message: 'This sign-in code request is not valid. Sign in again.' };
  }
  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);
  prune(now);
  if (body.v !== 1 || now > body.exp || spent.has(body.nonce)) {
    return { ok: false, status: 401, message: 'The code has expired. Sign in again for a new one.' };
  }
  const used = attempts.get(body.nonce) ?? 0;
  if (used >= TWO_FACTOR_MAX_ATTEMPTS) return { ok: false, status: 429, message: 'Too many wrong codes. Sign in again for a new one.' };
  if (!sameText(body.h, hmac(`${body.nonce}.${code}`, options.env))) {
    attempts.set(body.nonce, used + 1);
    const left = TWO_FACTOR_MAX_ATTEMPTS - used - 1;
    return left > 0
      ? { ok: false, status: 401, message: `That code is not correct. ${left} ${left === 1 ? 'try' : 'tries'} left.` }
      : { ok: false, status: 429, message: 'Too many wrong codes. Sign in again for a new one.' };
  }
  attempts.delete(body.nonce);
  spent.set(body.nonce, body.exp);
  return { ok: true, user: body.user, active: body.active };
}
