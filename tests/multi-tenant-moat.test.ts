// Sprint 10 Revision 3.1 (schema 101): the Financial Secretary's own setup-code button, the retired parish split card,
// the Credentials Vault home-council gate, the Local Network Server file repository, the AccountOwners table and matrix,
// vacant desk seats, the sidebar legal footer and the Application Advisory Panel.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADVISORY_PANEL_TITLE,
  ADVISORY_PANEL_VIEWS,
  ADVISORY_PANELIST_ROLE,
  assertHomeCouncilVault,
  assertMayResendSetupCode,
  canOpenAdvisoryPanel,
  canResendSetupCode,
  cleanAccountOwner,
  cleanFileRepositorySettings,
  CREDENTIAL_KEYS,
  councilFileRepository,
  fileRepositoryRef,
  isFileRepositoryRef,
  parseFileRepositoryRef,
  PLATFORM_SCHEMA_VERSION,
  portalAreas,
  repositoryFileName,
  SEAT_VACANT_MESSAGE,
  uncShareRoot,
  vacantDeskSeat,
  type MemberWriteActor,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const writer = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({ memberId: 50, councilId: 1, memberType: 'Member', active: true, roles: [], ...over });
const viewer = (memberType: string, roles: string[] = [], councilId = 1) => ({ memberId: 50, councilId, memberType: memberType as never, isOfficer: false, roles });

describe('schema 101', () => {
  it('adds AccountOwners, the file repository columns and the advisory tables', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBeGreaterThanOrEqual(101);
    expect(TABLES.AccountOwners.columns.map((c) => c.name)).toEqual(['id', 'council_id', 'account_name', 'contact_name', 'contact_number', 'contact_email', 'ein_number']);
    const council = TABLES.Council.columns.map((c) => c.name);
    expect(council).toEqual(expect.arrayContaining(['file_repository_mode', 'file_server_path', 'file_server_username']));
    expect(TABLES.AdvisoryPanelMeetings.columns.map((c) => c.name)).toEqual(['id', 'meeting_date', 'title', 'location', 'agenda', 'created_by_member_id']);
    expect(TABLES.AdvisoryFeedback.columns.map((c) => c.name)).toEqual(['id', 'member_id', 'council_id', 'topic', 'body', 'submitted_at']);
    expect(read('Seed.sql')).toContain("('Application Advisory Panelist', 0);");
  });
});

describe('1. Financial Secretary onboarding and the retired split card', () => {
  it('lets the council FS send setup codes without Admin rights', () => {
    expect(() => assertMayResendSetupCode(writer({ roles: ['Financial Secretary'] }), 1)).not.toThrow();
    expect(() => assertMayResendSetupCode(writer({ roles: ['Financial Secretary'] }), 2)).toThrow();
    expect(() => assertMayResendSetupCode(writer({ roles: ['Financial Secretary'], active: false }), 1)).toThrow();
    expect(() => assertMayResendSetupCode(writer(), 1)).toThrow();
    expect(() => assertMayResendSetupCode(writer({ memberType: 'Admin' }), 1)).not.toThrow();
    expect(canResendSetupCode(viewer('Member', ['Financial Secretary']), 1)).toBe(true);
    expect(canResendSetupCode(viewer('Member'), 1)).toBe(false);
    expect(read('apps/web/components/modules/MemberRosterDirectory.tsx')).toContain('db.members.resendWelcome(user.memberId, m.id)');
  });

  it('deletes the Parish Fundraiser Split card', () => {
    expect(existsSync(join(__dirname, '..', 'apps/web/components/ParishSplitParts.tsx'))).toBe(false);
    expect(read('apps/web/app/system-settings/council-settings/page.tsx')).not.toContain('<ParishSplitSettingsCard');
  });
});

describe('2. the Credentials Vault home-council gate', () => {
  it('refuses every other council, a Super Admin included', () => {
    expect(() => assertHomeCouncilVault({ memberId: 1, councilId: 1 }, 1)).not.toThrow();
    expect(() => assertHomeCouncilVault({ memberId: 1, councilId: 1 }, 2)).toThrow(/home council/);
    for (const route of ['apps/web/app/api/councils/credentials/route.ts', 'apps/web/app/api/councils/email-gateway/route.ts']) {
      const code = read(route);
      expect(code.match(/requireHomeCouncilVaultSession\(req, councilId,/g)).toHaveLength(2);
      expect(code).not.toContain('requirePortalSession(req');
    }
    expect(read('apps/web/services/server/vault-gate.ts')).toContain('{ status: 403 }');
    expect(read('apps/web/app/credentials-vault/page.tsx')).toContain('<CredentialsVaultPanel homeCouncilOnly showTitle />');
  });
});

describe('3. the Local Network Server file repository', () => {
  it('checks the mode, the UNC path and the username', () => {
    expect(cleanFileRepositorySettings({ file_repository_mode: 'LOCAL_NETWORK', file_server_path: '\\\\hall-server\\kofc', file_server_username: 'HALL\\portal' })).toEqual({
      file_repository_mode: 'LOCAL_NETWORK_SERVER',
      file_server_path: '\\\\hall-server\\kofc',
      file_server_username: 'HALL\\portal',
    });
    expect(cleanFileRepositorySettings({ file_repository_mode: 'LOCAL_NETWORK', file_server_path: '\\\\192.168.1.20\\share\\files' }).file_server_path).toBe('\\\\192.168.1.20\\share\\files');
    expect(() => cleanFileRepositorySettings({ file_repository_mode: 'LOCAL_NETWORK', file_server_path: '' })).toThrow(/needs the server network address/);
    expect(() => cleanFileRepositorySettings({ file_repository_mode: 'LOCAL_NETWORK', file_server_path: 'C:\\files' })).toThrow(/UNC path/);
    expect(() => cleanFileRepositorySettings({ file_repository_mode: 'FTP' as never })).toThrow(/Local Network Server/);
    // Revision 3.1's stored values read as their Revision 3.2 provider keys.
    expect(cleanFileRepositorySettings({ file_repository_mode: 'CLOUD' as never }).file_repository_mode).toBe('GOOGLE_DRIVE');
    expect(councilFileRepository({}).file_repository_mode).toBe('GOOGLE_DRIVE');
    expect(councilFileRepository({ file_repository_mode: 'LOCAL_NETWORK' }).file_repository_mode).toBe('LOCAL_NETWORK_SERVER');
    expect(uncShareRoot('\\\\hall-server\\kofc\\uploads')).toBe('\\\\hall-server\\kofc');
    expect(CREDENTIAL_KEYS).toContain('FILE_SERVER_PASSWORD');
  });

  it('stores a portal link, never a path, and refuses links that climb out of the folder', () => {
    const name = repositoryFileName('deposit-7', 'IMG 1.JPG', 'ab12cd', 1000);
    expect(name).toBe('deposit-7-1000-ab12cd.jpg');
    const ref = fileRepositoryRef(3, 'Check_Photos', name);
    expect(ref).toBe('/api/file-repository?file=c3/lan/Check_Photos/deposit-7-1000-ab12cd.jpg');
    expect(parseFileRepositoryRef(ref)).toEqual({ councilId: 3, provider: 'LOCAL_NETWORK_SERVER', folder: 'Check_Photos', fileName: name });
    // Revision 3.1 links carried no provider code and still read as network links.
    expect(parseFileRepositoryRef('/api/file-repository?file=c3/Check_Photos/a.jpg')?.provider).toBe('LOCAL_NETWORK_SERVER');
    expect(isFileRepositoryRef('/api/file-repository?file=c3/../secrets.txt')).toBe(false);
    expect(isFileRepositoryRef('/api/file-repository?file=c3/Windows/x.jpg')).toBe(false);
    expect(isFileRepositoryRef('/api/file-repository?file=c3/Media/..hidden')).toBe(false);
  });

  it('sends every upload route through the repository first', () => {
    for (const route of [
      'apps/web/app/api/drive-vault/route.ts',
      'apps/web/app/api/drive-vault/meeting-photos/route.ts',
      'apps/web/app/api/drive-vault/oral-history/route.ts',
      'apps/web/app/api/assets/photo/route.ts',
      'apps/web/app/api/sync/photo/route.ts',
    ]) {
      const code = read(route);
      expect(code, route).toContain('await fileIntoRepository(');
    }
    const serve = read('apps/web/app/api/file-repository/route.ts');
    expect(serve).toContain("claims.memberType !== 'Super Admin'");
    expect(read('packages/shared/src/file-repository.ts')).toContain('Server Network Address (UNC/IP Path)');
  });
});

describe('4. the Account Owners Matrix (pure)', () => {
  it('cleans a row', () => {
    expect(cleanAccountOwner({ account_name: ' Venmo ', contact_email: 'tr@stmarys.org', ein_number: '123456789' })).toEqual({
      account_name: 'Venmo',
      contact_name: null,
      contact_number: null,
      contact_email: 'tr@stmarys.org',
      ein_number: '12-3456789',
    });
    expect(() => cleanAccountOwner({ account_name: '' })).toThrow();
    expect(() => cleanAccountOwner({ account_name: 'Zelle', contact_email: 'not-an-email' })).toThrow(/email/);
    expect(read('apps/web/app/system-settings/council-settings/page.tsx')).toContain('<AccountOwnersMatrix council={council} />');
  });
});

describe('5. vacant seats and the legal footer', () => {
  it('reports a vacant office seat, and never a seat it cannot see', () => {
    const seats = [
      { roleName: 'Grand Knight', holder: null },
      { roleName: 'Treasurer', holder: { memberId: 7, firstName: 'T', lastName: 'R', since: null } },
    ];
    expect(vacantDeskSeat(seats, 'grand-knight')).toBe('Grand Knight');
    expect(vacantDeskSeat(seats, 'treasurer')).toBeNull();
    expect(vacantDeskSeat(seats, 'financial-secretary')).toBeNull();
    expect(vacantDeskSeat(null, 'grand-knight')).toBeNull();
    expect(vacantDeskSeat(seats, 'historian')).toBeNull();
    expect(SEAT_VACANT_MESSAGE).toBe('Seat Vacant — Open Council Roster to Assign this Officer Position');
    const page = read('apps/web/app/dashboard/page.tsx');
    expect(page.match(/<DeskSeatFrame desk="/g)).toHaveLength(5);
    expect(read('apps/web/components/DashboardDesks.tsx')).toContain('static getDerivedStateFromError()');
  });

  it('puts Terms of Service and Privacy Policy in the sidebar footer', () => {
    const sidebar = read('apps/web/components/Sidebar.tsx');
    expect(sidebar).toContain('<SidebarLegalFooter collapsed={collapsed} />');
    expect(sidebar).toContain("const SIDEBAR_LEGAL_NOTICES: readonly LegalNoticeId[] = ['terms', 'privacy'];");
  });
});

describe('6. the Application Advisory Panel', () => {
  it('opens to Super Admins and panelists of any council', () => {
    expect(ADVISORY_PANEL_TITLE).toBe('🔊 Application Advisory Panel');
    expect(ADVISORY_PANEL_VIEWS.map((v) => v.label)).toEqual(['Development Roadmap', 'Future Feature Releases', 'Panel Meeting Dates', 'Consultation Feedback']);
    expect(canOpenAdvisoryPanel(viewer('Super Admin'))).toBe(true);
    expect(canOpenAdvisoryPanel(viewer('Member', [ADVISORY_PANELIST_ROLE], 2))).toBe(true);
    expect(canOpenAdvisoryPanel(viewer('Admin'))).toBe(false);
    expect(portalAreas(viewer('Member', [ADVISORY_PANELIST_ROLE]))).toContain('advisory-panel');
    expect(portalAreas(viewer('Member'))).not.toContain('advisory-panel');
    expect(existsSync(join(__dirname, '..', 'apps/web/app/advisory-panel/page.tsx'))).toBe(true);
    expect(read('apps/web/components/Sidebar.tsx')).toContain('{ADVISORY_PANEL_TITLE}');
  });
});

describe.each(drivers)('$name driver: Revision 3.1 methods', ({ make }) => {
  it('keeps account owners per council for its Admins only', async () => {
    const db = await make();
    const admin = (await db.members.get(MEMBER.admin))!;
    const row = await db.councils.saveAccountOwner(MEMBER.admin, admin.CouncilID, { account_name: 'Venmo', contact_name: 'Pat Treasurer', ein_number: '123456789' });
    expect(row).toMatchObject({ council_id: admin.CouncilID, account_name: 'Venmo', ein_number: '12-3456789' });
    await expectRule(db.councils.saveAccountOwner(MEMBER.admin, admin.CouncilID, { account_name: 'venmo' }), 'INVALID_INPUT');
    const changed = await db.councils.saveAccountOwner(MEMBER.admin, admin.CouncilID, { id: row.id, account_name: 'Venmo', contact_number: '503-555-0100' });
    expect(changed.contact_number).toBe('503-555-0100');
    expect((await db.councils.listAccountOwners(MEMBER.admin, admin.CouncilID)).map((r) => r.account_name)).toEqual(['Venmo']);
    await expectRule(db.councils.listAccountOwners(MEMBER.member, admin.CouncilID), 'ADMIN_REQUIRED');
    await expectRule(db.councils.listAccountOwners(MEMBER.admin, admin.CouncilID + 1), 'COUNCIL_ACCESS_DENIED');
    await db.councils.removeAccountOwner(MEMBER.admin, admin.CouncilID, row.id);
    await expectRule(db.councils.removeAccountOwner(MEMBER.admin, admin.CouncilID, row.id), 'RECORD_NOT_FOUND');
  });

  it('saves the file repository mode for the council Admin', async () => {
    const db = await make();
    const admin = (await db.members.get(MEMBER.admin))!;
    const saved = await db.councils.setFileRepositorySettings(MEMBER.admin, admin.CouncilID, {
      file_repository_mode: 'LOCAL_NETWORK_SERVER',
      file_server_path: '\\\\hall-server\\kofc',
      file_server_username: 'HALL\\portal',
    });
    expect(councilFileRepository(saved)).toEqual({ file_repository_mode: 'LOCAL_NETWORK_SERVER', file_server_path: '\\\\hall-server\\kofc', file_server_username: 'HALL\\portal' });
    await expectRule(db.councils.setFileRepositorySettings(MEMBER.member, admin.CouncilID, { file_repository_mode: 'GOOGLE_DRIVE', file_server_path: null, file_server_username: null }), 'ADMIN_REQUIRED');
  });

  it('lets the council Financial Secretary send a setup code', async () => {
    const db = await make();
    const admin = (await db.members.get(MEMBER.admin))!;
    const fs = (await db.elections.listOfficerSeats(admin.CouncilID)).find((s) => s.roleName === 'Financial Secretary')?.holder;
    if (fs && fs.memberId !== MEMBER.admin) {
      const sent = db.members.resendWelcome(fs.memberId, MEMBER.newMember);
      await sent.catch((err: { code?: string }) => expect(err.code).not.toBe('ADMIN_REQUIRED'));
    }
    await expectRule(db.members.resendWelcome(MEMBER.member, MEMBER.newMember), 'ADMIN_REQUIRED');
  });

  it('runs the advisory panel: Super Admin meetings, designated panelists and their feedback', async () => {
    const db = await make();
    await expectRule(db.advisory.listMeetings(MEMBER.member), 'ADMIN_REQUIRED');
    const meeting = await db.advisory.saveMeeting(MEMBER.superAdmin, { meeting_date: '2026-11-12', title: 'Fall review', location: 'Online' });
    expect(meeting).toMatchObject({ title: 'Fall review', created_by_member_id: MEMBER.superAdmin });
    await expectRule(db.advisory.saveMeeting(MEMBER.admin, { meeting_date: '2026-11-12', title: 'x' }), 'SUPER_ADMIN_REQUIRED');
    const panel = await db.advisory.setPanelist(MEMBER.superAdmin, MEMBER.member, true);
    expect(panel.map((p) => p.memberId)).toContain(MEMBER.member);
    expect((await db.advisory.listMeetings(MEMBER.member)).map((m) => m.id)).toContain(meeting.id);
    const note = await db.advisory.submitFeedback(MEMBER.member, { topic: 'Releases', body: 'The file server option is welcome.' });
    expect(note.member_id).toBe(MEMBER.member);
    const feedback = await db.advisory.listFeedback(MEMBER.superAdmin);
    expect(feedback[0]).toMatchObject({ topic: 'Releases', memberName: expect.any(String), councilLabel: expect.any(String) });
    expect((await db.advisory.setPanelist(MEMBER.superAdmin, MEMBER.member, false)).map((p) => p.memberId)).not.toContain(MEMBER.member);
    await expectRule(db.advisory.submitFeedback(MEMBER.member, { topic: 'x', body: 'y' }), 'ADMIN_REQUIRED');
    await db.advisory.removeMeeting(MEMBER.superAdmin, meeting.id);
  });
});
