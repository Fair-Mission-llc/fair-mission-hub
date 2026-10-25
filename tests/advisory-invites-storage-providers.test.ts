// Sprint 10 Revision 3.2 (schema stays 101): Advisory Panel invitations (signed links, the platform owner's Invite
// Panelist drawer, acceptance that adds the panelist role and re-issues the session), the parish split engine removed
// everywhere, and the four file repository providers with a card that shows only the chosen provider's fields.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ADVISORY_INVITE_TITLE,
  ADVISORY_PANELIST_ROLE,
  advisoryInviteBody,
  advisoryInviteOf,
  alertDisplayBody,
  cleanAlertPayload,
  cleanFileRepositorySettings,
  CREDENTIAL_KEYS,
  councilFileRepository,
  FILE_REPOSITORY_MODES,
  fileRepositoryFields,
  fileRepositoryRef,
  parseFileRepositoryRef,
  pendingAdvisoryInvites,
  sharePointSiteParts,
  deskDrawersFor,
  generateMeetingPin,
  OFFICIAL_MANUALS_FOLDER,
  repositoryFolderName,
  DRIVE_VAULT_FOLDERS,
  type DataService,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { drivers, expectRule, MEMBER, NOW } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterAll(() => vi.restoreAllMocks());

describe('1. in-app Advisory Panel invitations (Sprint 10 Revision 4.0)', () => {
  it('marks an invitation in its body, hides the marker and expires it after 14 days', () => {
    const body = advisoryInviteBody(1, 'Pat Owner');
    const alert = { Title: ADVISORY_INVITE_TITLE, MessageBody: body, SentAt: '2026-10-20 10:00:00' };
    expect(advisoryInviteOf(alert, new Date('2026-10-25T10:00:00'))).toEqual({ inviterId: 1, accepted: false, expired: false });
    expect(advisoryInviteOf(alert, new Date('2026-11-10T10:00:00'))?.expired).toBe(true);
    expect(alertDisplayBody(body)).not.toContain('[advisory-invite');
    expect(pendingAdvisoryInvites([alert, { ...alert, Title: 'Something else' }], new Date('2026-10-25T10:00:00'))).toHaveLength(1);
  });

  it('reserves the invitation title, so no other alert can pose as one', () => {
    expect(() => cleanAlertPayload({ title: 'advisory panel invitation ', body: 'x' })).toThrow(/reserved/);
  });

  it('sends nothing by email', () => {
    for (const path of ['apps/web/app/api/advisory', 'apps/web/services/server/advisory-invite.ts', 'apps/web/app/advisory-panel/accept']) expect(existsSync(join(__dirname, '..', path)), path).toBe(false);
    const panel = read('apps/web/components/AdvisoryPanel.tsx');
    expect(panel).toContain('db.advisory.inviteMember(user.memberId, memberId)');
    expect(panel).not.toMatch(/fetch\(|\/api\/advisory|sendEmail|deliverServerEmail/);
    expect(read('apps/web/components/DashboardDesks.tsx')).toContain('<AdvisoryInviteCard className="col-span-full" />');
    expect(read('apps/web/components/AlertBell.tsx')).toContain('<AcceptInvitationButton alert={alert} />');
    expect(read('apps/mobile/app/(app)/index.tsx')).toContain('<AdvisoryInviteCard version={prayerVersion} />');
    expect(read('apps/web/app/api/auth/session/route.ts')).toContain('export async function PATCH(');
  });
});

describe.each(drivers)('$name driver: in-app invitations', ({ make }) => {
  it('lets only the platform owner invite, and gives the role the moment the member accepts', async () => {
    const db = await make();
    await expectRule(db.advisory.inviteMember(MEMBER.admin, MEMBER.member), 'SUPER_ADMIN_REQUIRED');
    const invite = await db.advisory.inviteMember(MEMBER.superAdmin, MEMBER.member);
    expect(invite).toMatchObject({ TargetMemberID: MEMBER.member, Title: ADVISORY_INVITE_TITLE, Priority: 'High' });
    const mine = await db.notifications.listMemberAlerts(MEMBER.member);
    expect(pendingAdvisoryInvites(mine, NOW).map((a) => a.id)).toEqual([invite.id]);
    await expectRule(db.advisory.acceptInvitation(MEMBER.admin, invite.id), 'RECORD_NOT_FOUND');
    const { roles } = await db.advisory.acceptInvitation(MEMBER.member, invite.id);
    expect(roles).toContain(ADVISORY_PANELIST_ROLE);
    expect((await db.members.listRoles(MEMBER.member)).map((r) => r.Role)).toContain(ADVISORY_PANELIST_ROLE);
    expect(pendingAdvisoryInvites(await db.notifications.listMemberAlerts(MEMBER.member), NOW)).toEqual([]);
    expect((await db.advisory.acceptInvitation(MEMBER.member, invite.id)).roles).toContain(ADVISORY_PANELIST_ROLE);
    await expectRule(db.advisory.inviteMember(MEMBER.superAdmin, MEMBER.member), 'INVALID_INPUT');
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

describe('4. the meeting PIN on the Recorder Desk (Sprint 10 Revision 4.0)', () => {
  it('never generates the default 0000', () => {
    const rolls = [0, 0, 1234];
    expect(generateMeetingPin(() => rolls.shift()!)).toBe('1234');
    expect(generateMeetingPin(() => 7)).toBe('0007');
  });

  it('puts the PIN drawer on the Recorder Desk and, for an absent Recorder, the Grand Knight Desk', () => {
    const recorder = { memberId: 9, councilId: 1, memberType: 'Member' as const, isOfficer: true, roles: ['Recorder'] };
    const gk = { memberId: 8, councilId: 1, memberType: 'Member' as const, isOfficer: true, roles: ['Grand Knight'] };
    expect(deskDrawersFor(recorder, 'recorder', 1).map((d) => d.id)).toContain('meeting-pin');
    expect(deskDrawersFor(gk, 'grand-knight', 1).map((d) => d.id)).toContain('meeting-pin');
    expect(read('apps/web/components/MeetingCheckInCard.tsx')).toContain('🔢 Generate new PIN');
  });
});

describe.each(drivers)('$name driver: the Recorder sets the meeting PIN', (d) => {
  it('lets the council Recorder change the PIN, and still refuses a plain member', async () => {
    const db: DataService = await d.make();
    await expectRule(db.councils.setMeetingGeofence(MEMBER.member, 1, { radiusMeters: 100, pinToken: '4821' }), 'GRAND_KNIGHT_REQUIRED');
    if (d.name === 'memory') (db as MemoryDataService).debugStore.insert('MemberRoles', { RoleID: 4, MemberID: MEMBER.member });
    else openDatabases.at(-1)!.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) VALUES (?, ?)').run(4, MEMBER.member);
    expect((await db.councils.setMeetingGeofence(MEMBER.member, 1, { radiusMeters: 100, pinToken: '4821' })).pinToken).toBe('4821');
  });
});

describe('5. custom manuals filed in the repository (Sprint 10 Revision 4.0)', () => {
  it("names the 'Official Manuals' folder on every provider", () => {
    expect(OFFICIAL_MANUALS_FOLDER).toBe('Official Manuals');
    expect(repositoryFolderName('Official_Manuals')).toBe('Official Manuals');
    expect(repositoryFolderName('Vouchers')).toBe('Vouchers');
    expect(DRIVE_VAULT_FOLDERS.manual).toBe('Official Manuals');
  });

  it('files every compiled guide and reports where it went', () => {
    const route = read('apps/web/app/api/council/compile-manual/route.ts');
    expect(route).toContain('await fileManualIntoRepository(payload.council.id, fileName, new Uint8Array(pdf))');
    expect(route).toContain("'X-Official-Manuals': archive");
    const server = read('apps/web/services/server/file-repository.ts');
    expect(server).toContain("upload('manual', { name: fileName, mimeType: 'application/pdf', data: pdf })");
    expect(server).toContain("mode: overwrite ? 'overwrite' : 'add'");
    expect(read('apps/web/services/custom-manual-transport.ts')).toContain("res.headers.get('X-Official-Manuals')");
  });
});
