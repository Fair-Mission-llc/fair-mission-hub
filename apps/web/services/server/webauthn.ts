// Sign in with FaceID on the web (Sprint 10 Revision 5.0): the browser's own platform authenticator - Face ID or Touch ID
// on a Mac, iPhone or iPad, Windows Hello on a PC - through WebAuthn. It mirrors the phone's 'Sign In with FaceID /
// Biometrics' (apps/mobile/services/biometric-login.ts), but the web must also earn the server's session cookie, so the
// server checks every sign-in itself:
//
//   Setup (a signed-in member, on My Profile): the server issues a one-time challenge; the browser creates a passkey that
//   only opens with the device's face or fingerprint check (userVerification 'required', platform attachment) and sends
//   back its public key (PublicKeyCredential.response.getPublicKey(): SubjectPublicKeyInfo DER) and algorithm. The server
//   checks the challenge, the type and the origin, and stores { credential id, member, login id, username, public key,
//   algorithm, sign counter }. Sprint 11 Revision 5.0 (schema 104): the rows live in the UserPasskeys table of the
//   server's own data (memberDirectory: the hub vault in hub mode), with the public key sealed (AES-256-GCM under the
//   credentials vault key, bound to the credential id). Keys left in the old JSON file (WEBAUTHN_STORE_FILE) are moved
//   into the table on first use; in hub mode the file is then renamed *.migrated. Only the web server reaches the
//   'passkeys' methods: the hub refuses them from devices. No attestation is required ('none'): the key is trusted
//   because a signed-in member created it.
//
//   Sign-in (the sign-in card): the server issues a one-time challenge (5 minutes); the browser asks the device for the
//   face or fingerprint check and signs; the server checks the challenge, the type, the origin, the relying-party hash,
//   the user-present and user-verified flags, the signature over authenticatorData || SHA-256(clientDataJSON) with the
//   stored key (ES256 or RS256) and that the sign counter moved forward. It then re-reads the member from its own data
//   copy - the login must still be theirs, and their council must not have switched biometric sign-in off - and issues
//   the session cookie exactly as a password sign-in does.
//
// The private key never leaves the device; the server holds only public keys.
import { createCipheriv, createDecipheriv, createHash, randomBytes, verify as verifySignature, constants as cryptoConstants } from 'node:crypto';
import { existsSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { biometricLoginEnabled, type SessionUser } from '@kofc/shared';
import { hubDataDir, hubModeOn } from '@/services/server/hub/hub-vault';
import { credentialsVaultSecret } from '@/services/server/secrets';
import { memberDirectory } from '@/services/server/session';

export const WEBAUTHN_STORE_FILE = 'webauthn-credentials.json';
const CHALLENGE_TTL_MS = 5 * 60_000;
/** COSE algorithm ids the server verifies: ES256 and RS256. */
export const WEBAUTHN_ALGORITHMS = [-7, -257] as const;

export interface StoredPasskey {
  credentialId: string;
  memberId: number;
  /** Member.CredentialID when the passkey was made; a new login retires the passkey. */
  loginId: number;
  username: string;
  publicKey: string;
  alg: number;
  signCount: number;
  createdAt: string;
}

// ---- base64url -------------------------------------------------------------------------------------------------------

export const toBase64Url = (bytes: Uint8Array | Buffer): string => Buffer.from(bytes).toString('base64url');
export const fromBase64Url = (text: unknown): Buffer => {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('A WebAuthn field is not base64url.');
  return Buffer.from(text, 'base64url');
};

// ---- sealing the public keys ---------------------------------------------------------------------------------------

const sealKey = (secret: string): Buffer => createHash('sha256').update(`kofc-passkeys:${secret}`).digest();

/** Seals a passkey's public key (base64url SPKI) for the UserPasskeys row, bound to its credential id. */
export function sealPublicKey(publicKey: string, credentialId: string, secret: string = credentialsVaultSecret()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', sealKey(secret), iv);
  cipher.setAAD(Buffer.from(`kofc-passkey:${credentialId}`, 'utf8'));
  const body = Buffer.concat([cipher.update(publicKey, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

/** The public key inside a sealed one, or null when it does not open (another vault key, another credential, damage). */
export function unsealPublicKey(sealed: string, credentialId: string, secret: string = credentialsVaultSecret()): string | null {
  const [v, iv, tag, body] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || body === undefined) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', sealKey(secret), Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(`kofc-passkey:${credentialId}`, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ---- the UserPasskeys table ------------------------------------------------------------------------------------------

/** The legacy JSON file (Sprint 10 Revision 5.0), read once to move its keys into the table. */
const legacyStorePath = (env: NodeJS.ProcessEnv = process.env) => env.WEBAUTHN_STORE_PATH?.trim() || join(/*turbopackIgnore: true*/ hubDataDir(env), WEBAUTHN_STORE_FILE);
let legacyChecked = false;

const timestamp = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

/** Moves keys from the old JSON file into UserPasskeys once per process; in hub mode the file is then renamed. */
export async function migrateLegacyPasskeys(): Promise<number> {
  if (legacyChecked) return 0;
  legacyChecked = true;
  const path = legacyStorePath();
  if (!existsSync(path)) return 0;
  let rows: StoredPasskey[] = [];
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    rows = Array.isArray(parsed) ? (parsed as StoredPasskey[]) : [];
  } catch {
    rows = [];
  }
  const db = await memberDirectory();
  const held = new Set((await db.passkeys.list()).map((r) => r.credential_id));
  let moved = 0;
  for (const p of rows) {
    if (!p?.credentialId || held.has(p.credentialId)) continue;
    try {
      await db.passkeys.save({
        credential_id: p.credentialId,
        member_id: p.memberId,
        login_id: p.loginId,
        username: p.username,
        public_key_sealed: sealPublicKey(p.publicKey, p.credentialId),
        alg: p.alg,
        sign_count: p.signCount ?? 0,
        created_at: timestamp(new Date(p.createdAt || Date.now())),
      });
      moved += 1;
    } catch (err) {
      // A key whose member or login is gone is left behind.
      console.warn(`[webauthn] passkey ${p.credentialId} was not moved into UserPasskeys: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  // The hub vault keeps the rows across restarts, so the file has done its job there. The plain server's data copy is
  // rebuilt at every start, so it keeps reading the file.
  if (hubModeOn()) renameSync(path, `${path}.migrated`);
  if (moved > 0) console.info(`[webauthn] moved ${moved} passkey(s) from ${WEBAUTHN_STORE_FILE} into UserPasskeys.`);
  return moved;
}

/** For tests: read the legacy file again on the next call. */
export const resetLegacyPasskeyMigration = (): void => {
  legacyChecked = false;
};

/** Every stored passkey whose sealed key opens. */
export async function readPasskeys(): Promise<StoredPasskey[]> {
  await migrateLegacyPasskeys();
  const rows = await (await memberDirectory()).passkeys.list();
  const out: StoredPasskey[] = [];
  for (const r of rows) {
    const publicKey = unsealPublicKey(r.public_key_sealed, r.credential_id);
    if (publicKey === null) continue;
    out.push({
      credentialId: r.credential_id,
      memberId: r.member_id,
      loginId: r.login_id,
      username: r.username,
      publicKey,
      alg: r.alg,
      signCount: r.sign_count,
      createdAt: r.created_at,
    });
  }
  return out;
}

export const passkeysOf = async (memberId: number): Promise<StoredPasskey[]> => (await readPasskeys()).filter((p) => p.memberId === memberId);

export async function forgetPasskey(credentialId: string): Promise<void> {
  await (await memberDirectory()).passkeys.remove(credentialId);
}

// ---- challenges ------------------------------------------------------------------------------------------------------

const challenges = new Map<string, { purpose: 'register' | 'login'; memberId: number | null; expires: number }>();

export function issueChallenge(purpose: 'register' | 'login', memberId: number | null, now = Date.now()): string {
  for (const [key, c] of challenges) if (c.expires <= now) challenges.delete(key);
  const challenge = toBase64Url(randomBytes(32));
  challenges.set(challenge, { purpose, memberId, expires: now + CHALLENGE_TTL_MS });
  return challenge;
}

/** Spends a challenge once: true only for an unexpired challenge of this purpose (and member, for setup). */
function spendChallenge(challenge: string, purpose: 'register' | 'login', memberId: number | null, now = Date.now()): boolean {
  const found = challenges.get(challenge);
  challenges.delete(challenge);
  return !!found && found.purpose === purpose && found.expires > now && (purpose === 'login' || found.memberId === memberId);
}

// ---- checks ----------------------------------------------------------------------------------------------------------

/** The relying party is the portal's own host name. */
export const relyingPartyId = (origin: string): string => new URL(origin).hostname;

function readClientData(encoded: unknown, type: 'webauthn.create' | 'webauthn.get', origin: string): { raw: Buffer; challenge: string } {
  const raw = fromBase64Url(encoded);
  const data = JSON.parse(raw.toString('utf8')) as { type?: string; challenge?: string; origin?: string };
  if (data.type !== type) throw new Error('The browser answered for the wrong WebAuthn step.');
  if (data.origin !== origin) throw new Error('The FaceID answer came from another site.');
  if (typeof data.challenge !== 'string') throw new Error('The FaceID answer has no challenge.');
  return { raw, challenge: data.challenge };
}

/** authenticatorData: the relying-party hash, the flags and the sign counter. */
export function parseAuthenticatorData(data: Buffer): { rpIdHash: Buffer; userPresent: boolean; userVerified: boolean; signCount: number } {
  if (data.length < 37) throw new Error('The authenticator data is too short.');
  const flags = data[32]!;
  return { rpIdHash: data.subarray(0, 32), userPresent: (flags & 0x01) !== 0, userVerified: (flags & 0x04) !== 0, signCount: data.readUInt32BE(33) };
}

/** Saves a new passkey after checking the setup answer. Throws a plain-words Error when anything is off. */
export async function registerPasskey(
  user: Pick<SessionUser, 'memberId' | 'credentialId' | 'username'>,
  body: { id?: unknown; clientDataJSON?: unknown; publicKey?: unknown; alg?: unknown },
  origin: string,
  now = new Date(),
): Promise<StoredPasskey> {
  const client = readClientData(body.clientDataJSON, 'webauthn.create', origin);
  if (!spendChallenge(client.challenge, 'register', user.memberId, now.getTime())) throw new Error('The FaceID setup timed out. Try again.');
  const credentialId = toBase64Url(fromBase64Url(body.id));
  if (!credentialId) throw new Error('The browser sent no passkey id.');
  const alg = Number(body.alg);
  if (!(WEBAUTHN_ALGORITHMS as readonly number[]).includes(alg)) throw new Error('This device signs with an algorithm the portal does not accept.');
  const publicKey = fromBase64Url(body.publicKey);
  if (publicKey.length < 32) throw new Error('This browser did not share the passkey public key. Use a current browser.');
  const row: StoredPasskey = {
    credentialId,
    memberId: user.memberId,
    loginId: user.credentialId,
    username: user.username,
    publicKey: toBase64Url(publicKey),
    alg,
    signCount: 0,
    createdAt: now.toISOString(),
  };
  await migrateLegacyPasskeys();
  await (await memberDirectory()).passkeys.save({
    credential_id: row.credentialId,
    member_id: row.memberId,
    login_id: row.loginId,
    username: row.username,
    public_key_sealed: sealPublicKey(row.publicKey, row.credentialId),
    alg: row.alg,
    sign_count: 0,
    created_at: timestamp(now),
  });
  return row;
}

/** Checks a sign-in answer and moves the stored counter on; returns the passkey it signed with. */
export async function verifyPasskeyAssertion(
  body: { id?: unknown; clientDataJSON?: unknown; authenticatorData?: unknown; signature?: unknown },
  origin: string,
  now = new Date(),
): Promise<StoredPasskey> {
  const credentialId = toBase64Url(fromBase64Url(body.id));
  const stored = (await readPasskeys()).find((p) => p.credentialId === credentialId);
  if (!stored) throw new Error('This FaceID passkey is not set up on the portal. Sign in with your password, then set FaceID up again on My Profile.');
  const client = readClientData(body.clientDataJSON, 'webauthn.get', origin);
  if (!spendChallenge(client.challenge, 'login', null, now.getTime())) throw new Error('The FaceID sign-in timed out. Try again.');
  const authData = fromBase64Url(body.authenticatorData);
  const parsed = parseAuthenticatorData(authData);
  if (!parsed.rpIdHash.equals(createHash('sha256').update(relyingPartyId(origin)).digest())) throw new Error('The FaceID answer was made for another site.');
  if (!parsed.userPresent || !parsed.userVerified) throw new Error('The device did not check your face or fingerprint.');
  const signed = Buffer.concat([authData, createHash('sha256').update(client.raw).digest()]);
  const key = { key: fromBase64Url(stored.publicKey), format: 'der' as const, type: 'spki' as const };
  const ok =
    stored.alg === -7
      ? verifySignature('sha256', signed, { ...key, dsaEncoding: 'der' }, fromBase64Url(body.signature))
      : verifySignature('sha256', signed, { ...key, padding: cryptoConstants.RSA_PKCS1_PADDING }, fromBase64Url(body.signature));
  if (!ok) throw new Error('The FaceID signature did not match.');
  if ((parsed.signCount > 0 || stored.signCount > 0) && parsed.signCount <= stored.signCount) throw new Error('This passkey was used out of order. Sign in with your password.');
  const next = { ...stored, signCount: parsed.signCount };
  await (await memberDirectory()).passkeys.setSignCount(credentialId, parsed.signCount);
  return next;
}

/**
 * The member a passkey signs in, re-read from the server's own data: null (and the passkey forgotten) when the login is
 * no longer theirs or their council switched biometric sign-in off.
 */
export async function passkeySessionUser(passkey: StoredPasskey): Promise<{ user: SessionUser; active: boolean } | null> {
  const db = await memberDirectory();
  const member = await db.members.get(passkey.memberId);
  if (!member || member.CredentialID !== passkey.loginId) {
    await forgetPasskey(passkey.credentialId);
    return null;
  }
  const [roles, types, statuses, council] = await Promise.all([
    db.members.listRoles(member.id),
    db.lookups.list('MemberType'),
    db.lookups.list('MemberStatus'),
    db.councils.get(member.CouncilID),
  ]);
  if (!biometricLoginEnabled(council)) {
    await forgetPasskey(passkey.credentialId);
    return null;
  }
  const user: SessionUser = {
    credentialId: passkey.loginId,
    memberId: member.id,
    councilId: member.CouncilID,
    username: passkey.username,
    firstName: member.MemberFirstName,
    lastName: member.MemberLastName,
    memberType: (types.find((t) => t.id === member.MemberTypeID)?.Type ?? 'Member') as SessionUser['memberType'],
    roles: roles.map((r) => r.Role),
    isOfficer: roles.some((r) => r.Officer === 1),
    isBudgetDirector: member.IsBudgetDirector === 1,
  };
  return { user, active: member.StatusID === statuses.find((s) => s.Status === 'Active')?.id };
}
