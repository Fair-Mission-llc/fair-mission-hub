// The browser half of 'Sign in with FaceID' (Sprint 10 Revision 5.0; the server half is services/server/webauthn.ts).
// It turns the server's WebAuthn options into the browser's ArrayBuffers, asks the device for its face or fingerprint
// check (Face ID, Touch ID, Windows Hello) and sends the answer back. The passkey this browser set up is remembered in
// localStorage (only its id and the username, never a secret), so the sign-in card offers it first; storage may be
// blocked, and the device can then still offer any passkey it holds for this site.
import type { SessionUser } from '@kofc/shared';

const REMEMBER_KEY = 'kofc.faceIdPasskey';

export interface RememberedPasskey {
  credentialId: string;
  username: string;
}

const toBytes = (b64url: string): ArrayBuffer => {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};
const fromBytes = (buf: ArrayBuffer | null): string => {
  if (!buf) return '';
  let bin = '';
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Whether this browser can do WebAuthn at all (a platform authenticator is checked when it is used). */
export const faceIdSupported = (): boolean => typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function' && !!navigator.credentials;

export function rememberedPasskey(): RememberedPasskey | null {
  try {
    const raw = window.localStorage.getItem(REMEMBER_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<RememberedPasskey>) : null;
    return parsed && typeof parsed.credentialId === 'string' && typeof parsed.username === 'string' ? (parsed as RememberedPasskey) : null;
  } catch {
    return null;
  }
}

export function forgetRememberedPasskey(): void {
  try {
    window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // Storage blocked: nothing was remembered.
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  const answer = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok || !answer) throw new Error(answer?.message ?? `The server answered HTTP ${res.status}.`);
  return answer;
}

const cancelled = (err: unknown) => err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError');

/** Sets FaceID sign-in up on this browser for the signed-in member. */
export async function enrollFaceId(): Promise<RememberedPasskey> {
  const options = await postJson<{
    challenge: string;
    rp: PublicKeyCredentialRpEntity;
    user: { id: string; name: string; displayName: string };
    pubKeyCredParams: PublicKeyCredentialParameters[];
    authenticatorSelection: AuthenticatorSelectionCriteria;
    attestation: AttestationConveyancePreference;
    timeout: number;
    excludeCredentials: { type: 'public-key'; id: string }[];
  }>('/api/auth/webauthn/register-options', {});
  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.create({
      publicKey: {
        ...options,
        challenge: toBytes(options.challenge),
        user: { ...options.user, id: toBytes(options.user.id) },
        excludeCredentials: options.excludeCredentials.map((c) => ({ type: c.type, id: toBytes(c.id) })),
      },
    })) as PublicKeyCredential | null;
  } catch (err) {
    throw new Error(cancelled(err) ? 'FaceID setup was cancelled or this computer has no face or fingerprint sign-in.' : 'This browser could not set FaceID up.');
  }
  if (!credential) throw new Error('This browser could not set FaceID up.');
  const response = credential.response as AuthenticatorAttestationResponse;
  if (typeof response.getPublicKey !== 'function' || typeof response.getPublicKeyAlgorithm !== 'function') {
    throw new Error('This browser is too old for FaceID sign-in. Update it and try again.');
  }
  const saved = await postJson<{ credentialId: string; username: string }>('/api/auth/webauthn/register', {
    id: fromBytes(credential.rawId),
    clientDataJSON: fromBytes(response.clientDataJSON),
    publicKey: fromBytes(response.getPublicKey()),
    alg: response.getPublicKeyAlgorithm(),
  });
  const remembered = { credentialId: saved.credentialId, username: saved.username };
  try {
    window.localStorage.setItem(REMEMBER_KEY, JSON.stringify(remembered));
  } catch {
    // Storage blocked: the device still offers the passkey at sign-in.
  }
  return remembered;
}

/** Signs in with the device's face or fingerprint check; resolves to the member the server signed in. */
export async function signInWithFaceIdOnServer(): Promise<SessionUser> {
  const remembered = rememberedPasskey();
  const options = await postJson<{ challenge: string; rpId: string; userVerification: UserVerificationRequirement; timeout: number; allowCredentials: { type: 'public-key'; id: string; transports?: AuthenticatorTransport[] }[] }>(
    '/api/auth/webauthn/login-options',
    { credentialId: remembered?.credentialId },
  );
  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.get({
      publicKey: {
        challenge: toBytes(options.challenge),
        rpId: options.rpId,
        userVerification: options.userVerification,
        timeout: options.timeout,
        allowCredentials: options.allowCredentials.map((c) => ({ type: c.type, id: toBytes(c.id), transports: c.transports })),
      },
    })) as PublicKeyCredential | null;
  } catch (err) {
    throw new Error(cancelled(err) ? 'FaceID sign-in was cancelled. Try again, or sign in with your password.' : 'This browser could not use FaceID.');
  }
  if (!credential) throw new Error('This browser could not use FaceID.');
  const response = credential.response as AuthenticatorAssertionResponse;
  const answer = await postJson<{ user: SessionUser }>('/api/auth/webauthn/login', {
    id: fromBytes(credential.rawId),
    clientDataJSON: fromBytes(response.clientDataJSON),
    authenticatorData: fromBytes(response.authenticatorData),
    signature: fromBytes(response.signature),
  });
  return answer.user;
}
