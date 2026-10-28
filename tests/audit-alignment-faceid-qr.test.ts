// Sprint 10 Revision 5.0 (schema stays 101): the Council Asset Management link, web 'Sign in with FaceID' (WebAuthn,
// verified by the server), the Global Lookup Tables rename, the manual header without Copy link, the single
// 'Import Supreme Roster CSV' drop zone and the '📁 Upload QR Code Image' drop zones for donation methods.
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  IMPORT_SUPREME_ROSTER_TITLE,
  parsePaymentQrServerUrl,
  paymentQrServerUrl,
  PORTAL_NAV_GROUPS,
  portalAreas,
  repositoryFolderName,
  UPLOAD_QR_CODE_LABEL,
} from '@kofc/shared';
import { signInOnServer } from '../apps/web/services/server/session';
import { issueChallenge, parseAuthenticatorData, passkeySessionUser, readPasskeys, registerPasskey, verifyPasskeyAssertion } from '../apps/web/services/server/webauthn';
import { GET as qrGet, POST as qrPost } from '../apps/web/app/api/council/payment-qr/route';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const ORIGIN = 'https://portal.stmarys.org';
const b64 = (b: Buffer | Uint8Array) => Buffer.from(b).toString('base64url');

beforeAll(() => {
  process.env.WEBAUTHN_STORE_PATH = join(mkdtempSync(join(tmpdir(), 'webauthn-')), 'passkeys.json');
  process.env.HUB_VAULT_DIR = mkdtempSync(join(tmpdir(), 'hubdata-'));
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  delete process.env.WEBAUTHN_STORE_PATH;
  delete process.env.HUB_VAULT_DIR;
  vi.restoreAllMocks();
});

describe('1. Council Asset Management in the sidebar', () => {
  it('files the link under System Settings for the asset managers and Trustees', () => {
    expect(PORTAL_NAV_GROUPS.find((g) => g.id === 'setup')!.items).toContain('expenses/assets');
    const gk = { memberId: 8, councilId: 1, memberType: 'Member' as const, isOfficer: true, roles: ['Grand Knight'] };
    const trustee = { ...gk, roles: ['Trustee 1'] };
    const member = { ...gk, isOfficer: false, roles: [] };
    expect(portalAreas(gk)).toContain('expenses/assets');
    expect(portalAreas(trustee)).toContain('expenses/assets');
    expect(portalAreas(member)).not.toContain('expenses/assets');
    const sidebar = read('apps/web/components/Sidebar.tsx');
    expect(sidebar).toContain("'expenses/assets': { href: '/expenses/assets', label: '🛠️ Council Asset Management'");
    expect(read('apps/web/app/expenses/assets/page.tsx')).toContain('<RequireArea area="expenses/assets">');
  });
});

describe('2. Global Lookup Tables and web FaceID', () => {
  it('renames Global Governance Matrices', () => {
    expect(read('apps/web/components/Sidebar.tsx')).toContain("lookups: { href: '/lookups', label: 'Global Lookup Tables'");
    expect(read('apps/web/components/Sidebar.tsx')).not.toContain('Global Governance Matrices');
  });

  it('puts Sign in with FaceID on the sign-in card and its setup on My Profile', () => {
    expect(read('apps/web/components/Shell.tsx')).toContain('<FaceIdSignIn onError={setError} />');
    expect(read('apps/web/app/profile/page.tsx')).toContain('<FaceIdSetup remembered={passkey.remembered}') // inside the Sprint 11 Revision 8.0 2FA passkey row;
  });

  it('signs in only with a genuine, user-verified, forward-counting answer for this site', async () => {
    const memberCookie = await signInOnServer('testmember@kofc.org', 'dev-pass-secure-9912');
    if (!memberCookie.ok) throw new Error('sign-in failed');
    const user = memberCookie.user;
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const spki = publicKey.export({ format: 'der', type: 'spki' });

    // Setup: the server's one-time challenge, answered by the "device".
    const regChallenge = issueChallenge('register', user.memberId);
    const regClient = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: regChallenge, origin: ORIGIN }));
    await expect(registerPasskey(user, { id: b64(Buffer.from('cred-1')), clientDataJSON: b64(regClient), publicKey: b64(spki), alg: -7 }, 'https://evil.example')).rejects.toThrow(/another site/);
    const regChallenge2 = issueChallenge('register', user.memberId);
    const regClient2 = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: regChallenge2, origin: ORIGIN }));
    const saved = await registerPasskey(user, { id: b64(Buffer.from('cred-1')), clientDataJSON: b64(regClient2), publicKey: b64(spki), alg: -7 }, ORIGIN);
    expect((await readPasskeys()).map((p) => p.credentialId)).toContain(saved.credentialId);

    const answer = (counter: number, flags = 0x05, origin = ORIGIN) => {
      const challenge = issueChallenge('login', null);
      const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin }));
      const authData = Buffer.alloc(37);
      createHash('sha256').update('portal.stmarys.org').digest().copy(authData, 0);
      authData[32] = flags;
      authData.writeUInt32BE(counter, 33);
      const signature = sign('sha256', Buffer.concat([authData, createHash('sha256').update(clientDataJSON).digest()]), privateKey);
      return { id: saved.credentialId, clientDataJSON: b64(clientDataJSON), authenticatorData: b64(authData), signature: b64(signature) };
    };

    expect(parseAuthenticatorData(Buffer.from(answer(7).authenticatorData, 'base64url'))).toMatchObject({ userPresent: true, userVerified: true, signCount: 7 });
    await expect(verifyPasskeyAssertion(answer(1, 0x01), ORIGIN)).rejects.toThrow(/face or fingerprint/);
    const good = answer(3);
    const passkey = await verifyPasskeyAssertion(good, ORIGIN);
    expect(passkey.signCount).toBe(3);
    // The same answer cannot be used twice (its challenge is spent), and the counter must move forward.
    await expect(verifyPasskeyAssertion(good, ORIGIN)).rejects.toThrow(/timed out/);
    await expect(verifyPasskeyAssertion(answer(2), ORIGIN)).rejects.toThrow(/out of order/);
    const forged = { ...answer(9), signature: answer(10).signature };
    await expect(verifyPasskeyAssertion(forged, ORIGIN)).rejects.toThrow();

    const session = await passkeySessionUser(passkey);
    expect(session?.user).toMatchObject({ memberId: user.memberId, username: user.username, councilId: user.councilId });
  });
});

describe('3. the manual header and the roster drop zone', () => {
  it('drops Copy link and flattens the roster drawer to one drop zone', () => {
    expect(read('apps/web/components/DeskManualHeader.tsx')).not.toContain('navigator.clipboard');
    expect(IMPORT_SUPREME_ROSTER_TITLE).toBe('Import Supreme Roster CSV');
    const uploader = read('apps/web/components/modules/SupremeRosterUploader.tsx');
    expect(uploader).toContain('onDrop={(e) => {');
    expect(uploader).not.toContain('…or paste the export');
    const desks = read('apps/web/components/DashboardDesks.tsx');
    const drawer = desks.slice(desks.indexOf('function RosterImportsDrawer('), desks.indexOf('\n}\n', desks.indexOf('function RosterImportsDrawer(')));
    expect(drawer).toContain('<SupremeRosterUploader councilId={councilId} />');
    expect(drawer).not.toContain('inactivity sweep');
  });
});

describe('4. payment QR code uploads', () => {
  it('builds and reads portal-server QR links, refusing anything else', () => {
    expect(UPLOAD_QR_CODE_LABEL).toBe('📁 Upload QR Code Image');
    expect(repositoryFolderName('Payment_QR_Codes')).toBe('Payment QR Codes');
    expect(parsePaymentQrServerUrl(paymentQrServerUrl(1, 'qr-1-abc.png'))).toEqual({ councilId: 1, fileName: 'qr-1-abc.png' });
    expect(parsePaymentQrServerUrl('/api/council/payment-qr?file=c1/../../secret.png')).toBeNull();
    expect(read('apps/web/components/modules/CouncilWideSettings.tsx')).toContain('<PaymentQrUploader council={council} />');
  });

  it('lets the keepers of the donation methods upload, and serves the image to the council', async () => {
    const cookieOf = async (u: string) => {
      const out = await signInOnServer(u, 'dev-pass-secure-9912');
      if (!out.ok) throw new Error(out.message);
      return { cookie: out.cookie.split(';')[0]!, councilId: out.user.councilId };
    };
    const admin = await cookieOf('testadmin@kofc.org');
    const member = await cookieOf('testmember@kofc.org');
    const png = new File([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')], 'venmo.png', { type: 'image/png' });
    const post = (cookie: string, file: File) => {
      const form = new FormData();
      form.append('councilId', String(admin.councilId));
      form.append('file', file);
      return qrPost(new Request('http://localhost/api/council/payment-qr', { method: 'POST', headers: { cookie }, body: form }));
    };
    expect((await post(member.cookie, png)).status).toBe(403);
    expect((await post(admin.cookie, new File(['x'], 'a.gif', { type: 'image/gif' }))).status).toBe(415);
    const res = await post(admin.cookie, png);
    expect(res.status).toBe(201);
    const { url } = (await res.json()) as { url: string };
    expect(parsePaymentQrServerUrl(url)?.councilId).toBe(admin.councilId);
    const served = await qrGet(new Request(`http://localhost${url}`, { headers: { cookie: member.cookie } }));
    expect(served.status).toBe(200);
    expect(served.headers.get('Content-Type')).toBe('image/png');
  });
});
