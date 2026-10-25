// Sprint 10 Revision 3.2 (schema stays 101): Advisory Panel invitations (signed links, the platform owner's Invite
// Panelist drawer, acceptance that adds the panelist role and re-issues the session), the parish split engine removed
// everywhere, and the four file repository providers with a card that shows only the chosen provider's fields.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ADVISORY_INVITE_ACCEPT_PATH,
  ADVISORY_PANELIST_ROLE,
  advisoryInviteEmail,
  cleanFileRepositorySettings,
  CREDENTIAL_KEYS,
  councilFileRepository,
  FILE_REPOSITORY_MODES,
  fileRepositoryFields,
  fileRepositoryRef,
  parseFileRepositoryRef,
  sharePointSiteParts,
} from '@kofc/shared';
import { signAdvisoryInvite, verifyAdvisoryInvite } from '../apps/web/services/server/advisory-invite';
import { portalSessionSecret } from '../apps/web/services/server/secrets';
import { signInOnServer } from '../apps/web/services/server/session';
import { POST as invitePost } from '../apps/web/app/api/advisory/invitations/route';
import { POST as acceptPost } from '../apps/web/app/api/advisory/invitations/accept/route';
import { GET as sessionGet } from '../apps/web/app/api/auth/session/route';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const SECRET = 'x'.repeat(40);

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

async function cookieFor(username: string): Promise<string> {
  const outcome = await signInOnServer(username, 'dev-pass-secure-9912');
  if (!outcome.ok) throw new Error(`${username} could not sign in: ${outcome.message}`);
  return outcome.cookie.split(';')[0];
}
const post = (handler: (req: Request) => Promise<Response>, url: string, body: unknown, cookie?: string) =>
  handler(new Request(`http://localhost${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }));
const whoIs = async (cookie: string) => (await (await sessionGet(new Request('http://localhost/api/auth/session', { headers: { cookie } }))).json()) as { memberId: number; roles: string[] };

describe('1. Advisory Panel invitation links', () => {
  it('verify only genuine, unexpired links', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const token = await signAdvisoryInvite({ memberId: 3, inviterId: 1, expires: future }, SECRET);
    expect(await verifyAdvisoryInvite(token, SECRET)).toEqual({ memberId: 3, inviterId: 1, expires: future });
    expect(await verifyAdvisoryInvite(token, 'y'.repeat(40))).toBeNull();
    expect(await verifyAdvisoryInvite(token.replace(/^3\./, '4.'), SECRET)).toBeNull();
    const old = await signAdvisoryInvite({ memberId: 3, inviterId: 1, expires: Math.floor(Date.now() / 1000) - 10 }, SECRET);
    expect(await verifyAdvisoryInvite(old, SECRET)).toBeNull();
    expect(await verifyAdvisoryInvite('nonsense', SECRET)).toBeNull();
  });

  it('writes the email from the stored member, with the accept link', () => {
    const mail = advisoryInviteEmail({ to: 'a@b.org', memberName: 'Tom Lee', inviterName: 'Pat Owner', councilLabel: '15295 St. Mary', link: `https://x${ADVISORY_INVITE_ACCEPT_PATH}?token=t`, expiresOn: '2026-11-08', from: 'no-reply@x' });
    expect(mail.subject).toBe('You are invited to the Application Advisory Panel');
    expect(mail.text).toContain(`${ADVISORY_INVITE_ACCEPT_PATH}?token=t`);
    expect(mail.text).toContain('until 2026-11-08');
  });

  it('lets only the platform owner send an invitation', async () => {
    const admin = await cookieFor('testadmin@kofc.org');
    const owner = await cookieFor('testsuperadmin@kofc.org');
    const member = await whoIs(await cookieFor('testmember@kofc.org'));
    expect((await post(invitePost, '/api/advisory/invitations', { memberId: member.memberId })).status).toBe(401);
    expect((await post(invitePost, '/api/advisory/invitations', { memberId: member.memberId }, admin)).status).toBe(403);
    expect((await post(invitePost, '/api/advisory/invitations', { memberId: 999_999 }, owner)).status).toBe(404);
    const sent = await post(invitePost, '/api/advisory/invitations', { memberId: member.memberId }, owner);
    expect(sent.status).toBe(200);
    expect(await sent.json()).toMatchObject({ sent: true, expiresOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });

  it('adds the panelist role to the invited member and re-issues the session at once', async () => {
    const owner = await whoIs(await cookieFor('testsuperadmin@kofc.org'));
    const memberCookie = await cookieFor('testmember@kofc.org');
    const member = await whoIs(memberCookie);
    const token = await signAdvisoryInvite({ memberId: member.memberId, inviterId: owner.memberId, expires: Math.floor(Date.now() / 1000) + 600 }, portalSessionSecret());

    expect((await post(acceptPost, '/api/advisory/invitations/accept', { token }, await cookieFor('testadmin@kofc.org'))).status).toBe(403);
    expect((await post(acceptPost, '/api/advisory/invitations/accept', { token: 'forged.token' }, memberCookie)).status).toBe(400);
    const res = await post(acceptPost, '/api/advisory/invitations/accept', { token }, memberCookie);
    expect(res.status).toBe(200);
    const refreshed = (res.headers.get('Set-Cookie') ?? '').split(';')[0]!;
    expect(refreshed).toMatch(/^kofc_portal_session=/);
    expect((await whoIs(refreshed)).roles).toContain(ADVISORY_PANELIST_ROLE);
    // A link from someone who is no longer a Super Admin is refused.
    const bad = await signAdvisoryInvite({ memberId: member.memberId, inviterId: member.memberId, expires: Math.floor(Date.now() / 1000) + 600 }, portalSessionSecret());
    expect((await post(acceptPost, '/api/advisory/invitations/accept', { token: bad }, memberCookie)).status).toBe(403);
  });

  it('puts the Invite Panelist drawer on the panel for the platform owner, and the accept page outside the panel gate', () => {
    const panel = read('apps/web/components/AdvisoryPanel.tsx');
    expect(panel).toContain('<InvitePanelistDrawer');
    expect(panel).toContain('isPlatformOwner(user)');
    const accept = read('apps/web/app/advisory-panel/accept/page.tsx');
    expect(accept).toContain("fetch('/api/advisory/invitations/accept'");
    expect(accept).not.toContain('RequireArea');
  });
});

describe('2. the parish split engine is gone', () => {
  it('leaves no module, screen, method, drawer or seed switch behind', () => {
    for (const path of ['packages/shared/src/parish-split.ts', 'apps/web/components/ParishSplitParts.tsx']) expect(existsSync(join(__dirname, '..', path)), path).toBe(false);
    for (const path of ['packages/shared/src/contract.ts', 'apps/web/services/drivers/memory.ts', 'apps/mobile/services/drivers/sqlite.ts', 'apps/web/services/drivers/remote.ts', 'apps/mobile/services/drivers/remote.ts']) {
      expect(read(path), path).not.toMatch(/setParishSplitSettings|getParishSplitConsole|issueChurchDisbursementRequest|recordChurchDisbursementPayment/);
    }
    expect(read('packages/shared/src/desk-drawers.ts')).not.toMatch(/'parish-split'|'church-disbursements'/);
    expect(read('Seed.sql')).not.toContain('UPDATE [Council] SET [parish_split_enabled]');
  });

  it('shares revenue only through the chart-of-accounts split profiles', async () => {
    const shared = await import('@kofc/shared');
    expect(Object.keys(shared).filter((k) => /parishSplit|ChurchDisbursement|PARISH_SPLIT/i.test(k))).toEqual([]);
    expect(typeof shared.expandSplitJournalLines).toBe('function');
  });
});

describe('3. the four storage providers', () => {
  it('registers the four provider keys and reads the old values', () => {
    expect(FILE_REPOSITORY_MODES.map((m) => m.id)).toEqual(['GOOGLE_DRIVE', 'ONEDRIVE_SHAREPOINT', 'DROPBOX_BUSINESS', 'LOCAL_NETWORK_SERVER']);
    expect(councilFileRepository({ file_repository_mode: 'CLOUD' }).file_repository_mode).toBe('GOOGLE_DRIVE');
    expect(CREDENTIAL_KEYS).toEqual(expect.arrayContaining(['ONEDRIVE_CLIENT_SECRET', 'DROPBOX_ACCESS_TOKEN', 'FILE_SERVER_PASSWORD', 'GOOGLE_DRIVE_PRIVATE_KEY']));
  });

  it('shows only the chosen provider’s fields', () => {
    expect(fileRepositoryFields('GOOGLE_DRIVE').map((f) => f.label)).toEqual(['Drive service-account key']);
    expect(fileRepositoryFields('ONEDRIVE_SHAREPOINT').map((f) => f.label)).toEqual(['SharePoint Site URL', 'Application (Client) ID', 'Client Secret']);
    expect(fileRepositoryFields('DROPBOX_BUSINESS').map((f) => f.label)).toEqual(['Team Folder Path', 'Access Token']);
    expect(fileRepositoryFields('LOCAL_NETWORK_SERVER').map((f) => f.label)).toEqual(['Server Network Address (UNC/IP Path)', 'Service Account Username', 'Service Account Password']);
    const card = read('apps/web/components/FileRepositoryCard.tsx');
    expect(card).toContain('fileRepositoryFields(mode)');
    expect(card).toContain('{fields.map((f) =>');
    expect(card).not.toContain('Server Network Address (UNC/IP Path)');
  });

  it('checks each provider and clears the columns it does not use', () => {
    const od = cleanFileRepositorySettings({ file_repository_mode: 'ONEDRIVE_SHAREPOINT', file_server_path: 'https://stmarys.sharepoint.com/sites/kofc', file_server_username: '11111111-2222-3333-4444-555555555555' });
    expect(od.file_server_username).toBe('11111111-2222-3333-4444-555555555555');
    expect(() => cleanFileRepositorySettings({ file_repository_mode: 'ONEDRIVE_SHAREPOINT', file_server_path: 'https://evil.example.com/sites/x', file_server_username: '11111111-2222-3333-4444-555555555555' })).toThrow(/SharePoint site URL/);
    expect(() => cleanFileRepositorySettings({ file_repository_mode: 'ONEDRIVE_SHAREPOINT', file_server_path: 'https://stmarys.sharepoint.com/sites/kofc', file_server_username: 'app' })).toThrow(/Client\) ID/);
    expect(cleanFileRepositorySettings({ file_repository_mode: 'DROPBOX_BUSINESS', file_server_path: '/KofC Council 15295', file_server_username: 'left over' })).toEqual({
      file_repository_mode: 'DROPBOX_BUSINESS',
      file_server_path: '/KofC Council 15295',
      file_server_username: null,
    });
    expect(() => cleanFileRepositorySettings({ file_repository_mode: 'DROPBOX_BUSINESS', file_server_path: 'KofC' })).toThrow(/starting with a slash/);
    expect(cleanFileRepositorySettings({ file_repository_mode: 'GOOGLE_DRIVE', file_server_path: '\\\\old\\share', file_server_username: 'x' })).toEqual({ file_repository_mode: 'GOOGLE_DRIVE', file_server_path: null, file_server_username: null });
    expect(sharePointSiteParts('https://stmarys.sharepoint.com/sites/kofc/')).toEqual({ host: 'stmarys.sharepoint.com', sitePath: '/sites/kofc', tenant: 'stmarys.onmicrosoft.com' });
  });

  it('names the provider in every stored link', () => {
    for (const [provider, code] of [['ONEDRIVE_SHAREPOINT', 'od'], ['DROPBOX_BUSINESS', 'dbx'], ['LOCAL_NETWORK_SERVER', 'lan']] as const) {
      const ref = fileRepositoryRef(5, 'Vouchers', 'doc-1-abc.pdf', provider);
      expect(ref).toBe(`/api/file-repository?file=c5/${code}/Vouchers/doc-1-abc.pdf`);
      expect(parseFileRepositoryRef(ref)?.provider).toBe(provider);
    }
    const server = read('apps/web/services/server/file-repository.ts');
    expect(server).toContain('https://graph.microsoft.com/v1.0/sites/');
    expect(server).toContain('https://content.dropboxapi.com/2/files/upload');
  });
});
