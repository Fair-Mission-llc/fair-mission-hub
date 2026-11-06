// Sprint 11 Revision 20.0 (schema 112; tickets moved to their own tables at schema 113): the Local Feedback Portal with ticket chat logs, the Member Desk's
// Left Vertical Action Drawers, the council-only View As Member lock, the three local database files with the seeded
// training playground and its Training Profile Selection Board, the testing LAN mesh, the data-mode banners, the
// sidebar without Admin Desk link loops and the Super Admin System Manual.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ADMIN_DESK_DRAWERS,
  ALL_FEATURES_ON,
  assertMayViewAsMember,
  contrastRatio,
  DATA_MODE_BANNER_COLORS,
  DATA_MODE_VAULT_FILES,
  dataModeBanner,
  HUB_ACTOR_FIRST_METHODS,
  isMeshReplicatedMethod,
  isRedundantAdminDeskNavItem,
  isTrainingProfileUsername,
  LIGHTWEIGHT_FEATURE_FLAGS,
  LOCAL_FEEDBACK_HREF,
  LOCAL_FEEDBACK_TITLE,
  mayViewAsMember,
  MEMBER_DESK_DRAWERS,
  MEMBER_FEEDBACK_QUEUE_TITLE,
  memberDeskDrawersFor,
  parseDataMode,
  PLATFORM_SCHEMA_VERSION,
  portalAreas,
  portalSidebar,
  readLanMeshEnvelope,
  seedTrainingPlayground,
  sortFeedbackTicketsForTriage,
  TRAINING_CASH_BOXES,
  TRAINING_PASSWORD,
  TRAINING_PROFILES,
  type DataService,
  type FeedbackTicket,
  type HubCall,
  type LanMeshEnvelope,
} from '@kofc/shared';
import { MeshReplayGuard, meshKey, meshPassphrase, openMeshPacket, sealMeshEnvelope } from '../apps/web/services/server/hub/lan-mesh';
import { hubDataMode, hubVaultFile } from '../apps/web/services/server/hub/hub-vault';
import { GET as replicateGet, POST as replicatePost } from '../apps/web/app/api/sync/replicate/route';
import { drivers, expectRule, MEMBER, NOW } from './helpers';

const read = (path: string) => readFileSync(path, 'utf8');
const OWN = 1;

/** A second plain member of council 1: the seed's new member login. */
async function otherPeople(_db: DataService) {
  return { plain: { id: MEMBER.newMember } };
}

describe('0. schema', () => {
  it('kept tickets on the messaging tables at 112; Sprint 11 Revision 21.0 gave them their own tables at 113', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBeGreaterThanOrEqual(113);
    expect(read('Schema.sql')).toContain('CREATE TABLE [LocalFeedbackTickets]');
  });
});

describe('1. the Local Feedback Portal rules', () => {
  it('orders the triage ledger Open, In Progress, then Resolved', () => {
    const t = (id: number, status: FeedbackTicket['status'], at: string) => ({ id, status, lastActivityAt: at }) as FeedbackTicket;
    expect(sortFeedbackTicketsForTriage([t(1, 'Resolved', '9'), t(2, 'Open', '1'), t(3, 'In Progress', '5'), t(4, 'Open', '3')]).map((x) => x.id)).toEqual([4, 2, 3, 1]);
  });

  it('routes every localFeedback method through the hub as actor-first', () => {
    for (const m of ['submitTicket', 'listMyTickets', 'listCouncilTickets', 'getTicketChat', 'postTicketMessage', 'setTicketStatus']) {
      expect(HUB_ACTOR_FIRST_METHODS.has(`localFeedback.${m}`), m).toBe(true);
    }
  });
});

describe.each(drivers)('2. $name driver: feedback tickets and their chat logs', (d) => {
  it('lets a member open and follow a ticket, and the council Admin triage it', async () => {
    const db = await d.make();
    const ticket = await db.localFeedback.submitTicket(MEMBER.member, { category: 'Question', subject: '  Where are my hours? ', body: 'I logged 3 hours.' });
    expect(ticket).toMatchObject({ councilId: OWN, memberId: MEMBER.member, subject: 'Where are my hours?', status: 'Open', replyCount: 0, lastReplyBy: null });
    expect((await db.localFeedback.listMyTickets(MEMBER.member)).map((t) => t.id)).toEqual([ticket.id]);

    // The council Admin sees it on the triage ledger, answers and resolves it.
    expect((await db.localFeedback.listCouncilTickets(MEMBER.admin, OWN)).map((t) => t.id)).toContain(ticket.id);
    await db.localFeedback.postTicketMessage(MEMBER.admin, ticket.id, 'They are on the Hour ledger.');
    const resolved = await db.localFeedback.setTicketStatus(MEMBER.admin, ticket.id, 'Resolved', 'Closing this one.');
    expect(resolved.ticket.status).toBe('Resolved');
    expect(resolved.entries.map((e) => e.kind)).toEqual(['opening', 'reply', 'status']);
    expect(resolved.entries[2]).toMatchObject({ status: 'Resolved', text: 'Closing this one.' });

    // The member reads the whole log and may answer; only an Admin sets the status.
    const mine = await db.localFeedback.getTicketChat(MEMBER.member, ticket.id);
    expect(mine.entries).toHaveLength(3);
    await db.localFeedback.postTicketMessage(MEMBER.member, ticket.id, 'Found them, thanks.');
    await expectRule(db.localFeedback.setTicketStatus(MEMBER.member, ticket.id, 'Open'), 'ADMIN_REQUIRED');
    expect((await db.localFeedback.listMyTickets(MEMBER.member))[0]).toMatchObject({ replyCount: 3, status: 'Resolved' });
  });

  it('keeps tickets private to the member and their own council Admins, and out of the Communications Hub', async () => {
    const db = await d.make();
    const ticket = await db.localFeedback.submitTicket(MEMBER.member, { category: 'Problem', subject: 'Broken', body: 'Details' });
    const { plain } = await otherPeople(db);
    await expectRule(db.localFeedback.getTicketChat(plain.id, ticket.id), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.localFeedback.postTicketMessage(plain.id, ticket.id, 'peek'), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.localFeedback.listCouncilTickets(MEMBER.member, OWN), 'ADMIN_REQUIRED');
    await expectRule(db.localFeedback.listCouncilTickets(MEMBER.admin, 2), 'ADMIN_REQUIRED');
    expect((await db.localFeedback.listCouncilTickets(MEMBER.superAdmin, OWN)).map((t) => t.id)).toContain(ticket.id);
    await expectRule(db.localFeedback.getTicketChat(MEMBER.member, 999_999), 'RECORD_NOT_FOUND');
    await expectRule(db.localFeedback.submitTicket(MEMBER.member, { category: 'Nope' as never, subject: 'x', body: 'y' }), 'INVALID_INPUT');
    await expectRule(db.localFeedback.submitTicket(MEMBER.member, { category: 'Question', subject: ' ', body: 'y' }), 'INVALID_INPUT');

    // Schema 113: a ticket never writes to the messaging tables, so the Communications Hub cannot show it.
    const threads = d.count(db, 'ChatThreads');
    const messages = d.count(db, 'Messages');
    await db.localFeedback.postTicketMessage(MEMBER.admin, ticket.id, 'On it.');
    expect(d.count(db, 'ChatThreads')).toBe(threads);
    expect(d.count(db, 'Messages')).toBe(messages);
  });
});

describe('3. the Feedback Support link and the Admin Desk queue', () => {
  it('puts Feedback Support in the ANSWERS pillar for every member', () => {
    const member = { memberId: 9, councilId: OWN, memberType: 'Member', isOfficer: false, roles: [] };
    expect(portalAreas(member)).toContain('answers/feedback');
    expect(portalSidebar(member).find((g) => g.id === 'answers')?.entries.map((e) => e.item)).toEqual(['help', 'answers/help', 'answers/sop', 'answers/feedback']);
    expect(read('apps/web/components/Sidebar.tsx')).toContain("'answers/feedback': { href: '/answers/feedback', label: 'Feedback Support'");
    expect(LOCAL_FEEDBACK_TITLE).toBe('Feedback Support');
    expect(LOCAL_FEEDBACK_HREF).toBe('/answers/feedback');
    expect(read('apps/web/app/answers/feedback/page.tsx')).toContain('<FeedbackSupportPortal />');
  });

  it('mounts the Member Feedback Queue drawer on the Admin Desk with the triage ledger and chat drawers', () => {
    expect(ADMIN_DESK_DRAWERS.map((x) => x.label)).toContain(MEMBER_FEEDBACK_QUEUE_TITLE);
    expect(read('apps/web/components/modules/AdminDesk.tsx')).toContain('<MemberFeedbackQueue councilId={user.councilId} />');
    const parts = read('apps/web/components/LocalFeedbackParts.tsx');
    expect(parts).toContain('caption="Member feedback tickets"');
    expect(parts).toContain('<FeedbackChatDrawer');
    expect(parts).toContain('db.localFeedback.getTicketChat(user.memberId, ticketId)');
  });
});

describe('4. the Member Desk drawers', () => {
  // Sprint 11 Revision 21.5: 'My Hours & Shifts' split into 'Record Hours' and 'My Scheduled Shifts'.
  it('opens Roster Profile, Hours, Motion Requests and Feedback Support in Left Vertical Action Drawers', () => {
    expect(MEMBER_DESK_DRAWERS.slice(0, 5).map((x) => x.label)).toEqual(['My Roster Profile', 'Record Hours', 'My Scheduled Shifts', 'My Motion Requests', 'Feedback Support']);
    expect(memberDeskDrawersFor(ALL_FEATURES_ON)).toHaveLength(7);
    expect(memberDeskDrawersFor(LIGHTWEIGHT_FEATURE_FLAGS).map((x) => x.id)).toEqual(['roster-profile', 'record-hours', 'scheduled-shifts', 'feedback-support']);
    const desks = read('apps/web/components/DashboardDesks.tsx');
    const memberDesk = desks.slice(desks.indexOf('export function MemberDesk('), desks.indexOf("/** Sprint 11 Revision 21.5: 'Record Hours'"));
    expect(memberDesk).toContain('<LeftActionDrawers');
    expect(read('apps/web/components/LeftActionDrawers.tsx')).toContain('aria-expanded={selected}');
  });
});

describe('5. View As Member stays inside the council', () => {
  const writer = (memberType: string) => ({ memberId: 2, councilId: OWN, memberType, active: true });

  it('offers and allows only rows of the matching council_id, and never a Super Admin to a council Admin', () => {
    expect(mayViewAsMember({ councilId: OWN, memberType: 'Admin' }, { councilId: OWN, memberType: 'Member' })).toBe(true);
    expect(mayViewAsMember({ councilId: OWN, memberType: 'Admin' }, { councilId: 2, memberType: 'Member' })).toBe(false);
    expect(mayViewAsMember({ councilId: OWN, memberType: 'Admin' }, { councilId: OWN, memberType: 'Super Admin' })).toBe(false);
    expect(mayViewAsMember({ councilId: OWN, memberType: 'Super Admin' }, { councilId: OWN, memberType: 'Super Admin' })).toBe(true);
    expect(() => assertMayViewAsMember(writer('Admin'), { memberId: 1, councilId: OWN, memberType: 'Super Admin' })).toThrow(/Super Admin account/);
  });

  it.each(drivers)('$name driver: refuses a council Admin the seeded Super Admin of the same council', async (d) => {
    const db = await d.make();
    await expectRule(db.members.getViewAsMirror(MEMBER.admin, MEMBER.superAdmin), 'COUNCIL_ACCESS_DENIED');
    expect((await db.members.getViewAsMirror(MEMBER.admin, MEMBER.member)).member.id).toBe(MEMBER.member);
  });
});

describe('6. the sidebar has no Admin Desk link loops', () => {
  it('drops the Admin Desk link for Admins and Super Admins and the feedback link for council Admins', () => {
    expect(isRedundantAdminDeskNavItem('Admin', 'admin-desk')).toBe(true);
    expect(isRedundantAdminDeskNavItem('Super Admin', 'admin-desk')).toBe(true);
    expect(isRedundantAdminDeskNavItem('Admin', 'system-settings/feedback')).toBe(true);
    expect(isRedundantAdminDeskNavItem('Super Admin', 'system-settings/feedback')).toBe(false);
  });
});

describe('7. the three data modes', () => {
  it('maps each mode to its own file and reads anything unknown as Production', () => {
    expect(DATA_MODE_VAULT_FILES).toEqual({ production: 'central-hub-vault.db', testing: 'testing-sandbox.db', training: 'training-playground.db' });
    expect(parseDataMode(' Testing ')).toBe('testing');
    expect(parseDataMode('bogus')).toBe('production');
    expect(hubDataMode({ KOFC_DATA_MODE: 'training' })).toBe('training');
    expect(hubVaultFile({})).toBe('central-hub-vault.db');
  });

  it('draws an amber Testing banner and a cobalt Training banner, readable, and none in Production', () => {
    expect(dataModeBanner('production')).toBeNull();
    expect(dataModeBanner('testing')).toMatchObject({ tone: 'amber', title: 'Testing Mode' });
    expect(dataModeBanner('training')).toMatchObject({ tone: 'cobalt', title: 'Training Mode' });
    expect(contrastRatio(DATA_MODE_BANNER_COLORS.ink, DATA_MODE_BANNER_COLORS.amber)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio('#FFFFFF', DATA_MODE_BANNER_COLORS.cobalt)).toBeGreaterThanOrEqual(7);
    expect(read('apps/web/app/layout.tsx')).toContain('<DataModeBanner />');
  });

  it('asks for the mode in the desktop shell and passes it to the portal server', () => {
    const main = read('apps/desktop/main.cjs');
    expect(main).toContain('KOFC_DATA_MODE: dataMode,');
    expect(main).toContain('DATA_MODE_FILES[dataMode]');
    expect(read('scripts/start-pilot.mjs')).toContain("args.indexOf('--mode')");
  });
});

describe('8. the testing LAN mesh', () => {
  const envelope = (seq: number, at = new Date().toISOString()): LanMeshEnvelope => ({ v: 1, origin: 'peer-a', seq, method: 'donations.record', args: [2, { x: 1 }], at });

  it('shares saves only - never reads, sign-ins or passkeys', () => {
    expect(isMeshReplicatedMethod('donations.record')).toBe(true);
    expect(isMeshReplicatedMethod('localFeedback.submitTicket')).toBe(true);
    expect(isMeshReplicatedMethod('donations.list')).toBe(false);
    expect(isMeshReplicatedMethod('localFeedback.getTicketChat')).toBe(false);
    expect(isMeshReplicatedMethod('auth.signIn')).toBe(false);
    expect(isMeshReplicatedMethod('passkeys.register')).toBe(false);
  });

  it('seals each packet so only a laptop with the same passphrase can open it, and drops a changed one', () => {
    const key = meshKey('hall-passphrase-123');
    const packet = sealMeshEnvelope(envelope(1), key);
    expect(packet.toString('utf8')).not.toContain('donations.record');
    expect(openMeshPacket(packet, key)).toMatchObject({ seq: 1, method: 'donations.record' });
    expect(openMeshPacket(packet, meshKey('another-passphrase'))).toBeNull();
    const tampered = Buffer.from(packet);
    tampered[tampered.length - 1] ^= 1;
    expect(openMeshPacket(tampered, key)).toBeNull();
    expect(readLanMeshEnvelope({ v: 2 })).toBeNull();
  });

  it('replays a packet once, never our own, never a stale one', () => {
    const guard = new MeshReplayGuard('me');
    const now = new Date();
    expect(guard.accept(envelope(1), now)).toBe(true);
    expect(guard.accept(envelope(1), now)).toBe(false);
    expect(guard.accept({ ...envelope(2), origin: 'me' }, now)).toBe(false);
    expect(guard.accept(envelope(3, new Date(now.getTime() - 10 * 60_000).toISOString()), now)).toBe(false);
  });

  it('stays off (standalone) without a long enough passphrase', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kofc-mesh-'));
    try {
      expect(meshPassphrase(dir, {})).toBeNull();
      expect(meshPassphrase(dir, { KOFC_MESH_PASSPHRASE: 'short' })).toBeNull();
      expect(meshPassphrase(dir, { KOFC_MESH_PASSPHRASE: 'a-long-hall-passphrase' })).toBe('a-long-hall-passphrase');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe.each(drivers)('9. $name driver: the training playground seed', (d) => {
  it('adds the ten practice members, three upcoming fundraisers and a cash box for each', async () => {
    const db = await d.make();
    const before = d.count(db, 'Donation');
    const seeded = await seedTrainingPlayground(db, { today: NOW });
    expect(seeded).toMatchObject({ members: 10, events: 3, cashBoxes: 3, cashDonations: TRAINING_CASH_BOXES.flat().length });
    expect(d.count(db, 'Donation')).toBe(before + TRAINING_CASH_BOXES.flat().length);
    // A second run on the same playground adds nothing.
    expect(await seedTrainingPlayground(db, { today: NOW })).toMatchObject({ members: 0, cashBoxes: 0 });
  });
});

describe('10. the hub in training mode', () => {
  let dir: string;
  const saved = { driver: process.env.NEXT_PUBLIC_DATA_DRIVER, vault: process.env.HUB_VAULT_DIR, mode: process.env.KOFC_DATA_MODE };
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'kofc-hub-training-'));
    process.env.NEXT_PUBLIC_DATA_DRIVER = 'hub';
    process.env.HUB_VAULT_DIR = dir;
    process.env.KOFC_DATA_MODE = 'training';
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_DATA_DRIVER = saved.driver;
    process.env.HUB_VAULT_DIR = saved.vault;
    if (saved.mode === undefined) delete process.env.KOFC_DATA_MODE;
    else process.env.KOFC_DATA_MODE = saved.mode;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows may still hold the files for a moment.
    }
  });

  const post = (call: HubCall, cookie?: string) =>
    replicatePost(new Request('http://hub/api/sync/replicate', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(call) }));

  it('creates all three database files, seeds the playground and signs every training profile in with one password', async () => {
    const status = (await (await replicateGet(new Request('http://hub/api/sync/replicate?handshake=1'))).json()) as { dataMode: string; vaultFile: string };
    expect(status).toMatchObject({ dataMode: 'training', vaultFile: 'training-playground.db' });
    for (const file of Object.values(DATA_MODE_VAULT_FILES)) expect(existsSync(join(dir, file)), file).toBe(true);

    expect(TRAINING_PROFILES.map((p) => p.username)).toEqual(['admin@training', 'gk@training', 'fs@training', 'tr@training', 'rec@training', 'hist@training', 'mem@training']);
    expect(isTrainingProfileUsername(' Admin@Training ')).toBe(true);
    for (const p of TRAINING_PROFILES) {
      const res = await post({ method: 'auth.signIn', args: [p.username, TRAINING_PASSWORD] });
      const body = (await res.json()) as { ok: boolean; result: { memberType: string; roles: string[] } | null };
      expect(body.ok, p.username).toBe(true);
      expect(body.result, p.username).not.toBeNull();
      expect(res.headers.get('set-cookie'), p.username).toMatch(/kofc_portal_session=/);
      if (p.role) expect(body.result!.roles).toContain(p.role);
      if (p.memberType === 'Admin') expect(body.result!.memberType).toBe('Admin');
    }
    // The ten practice members are on the roster of council 15295.
    const admin = await post({ method: 'auth.signIn', args: ['admin@training', TRAINING_PASSWORD] });
    const cookie = admin.headers.get('set-cookie')!.split(';')[0];
    const adminId = ((await admin.json()) as { result: { memberId: number } }).result.memberId;
    const practice = (await (await post({ method: 'councils.getPracticeSandboxStatus', args: [adminId, 1] }, cookie)).json()) as { result: { members: number; events: number } };
    expect(practice.result).toMatchObject({ members: 10, events: 3 });
  });

  it('shows the Training Profile Selection Board on the sign-in screen in training mode only', () => {
    const board = read('apps/web/components/TrainingProfileBoard.tsx');
    expect(board).toContain("if (mode !== 'training') return null;");
    expect(board).toContain('signIn(username, TRAINING_PASSWORD)');
    expect(read('apps/web/components/Shell.tsx')).toContain('<TrainingProfileBoard signIn={signIn} />');
    expect(read('apps/web/services/server/two-factor.ts')).toContain("parseDataMode(env[DATA_MODE_ENV]) === 'training' && isTrainingProfileUsername(found.user.username)");
  });
});

describe('11. the Super Admin System Manual', () => {
  it('holds the platform tracks the Administration Manual no longer has', () => {
    const sys = read('docs/SUPER_ADMIN_SYSTEM_MANUAL.md');
    const admin = read('docs/ADMIN_USER_GUIDE.md');
    for (const phrase of ['Super Admin Desk', 'ParentOrganizations', 'CouncilParentMappings', 'global_ai_confidence_cutoff', 'Master Feature Deployment Grid']) {
      expect(sys, phrase).toContain(phrase);
    }
    for (const heading of ['### 8.7 Change the platform settings', '### 8.8.1 Add a parent organization and map a council', '### 2.2 Switch a module on or off', '### 10.3 Use the Super Admin Desk']) {
      expect(admin).not.toContain(heading);
    }
    expect(admin).toContain('SUPER_ADMIN_SYSTEM_MANUAL.md');
    expect(read('scripts/compile_all_manuals.py')).toContain("source='docs/SUPER_ADMIN_SYSTEM_MANUAL.md'");
    expect(existsSync('docs/SUPER_ADMIN_SYSTEM_MANUAL.pdf')).toBe(true);
  });

  it('teaches the officers the testing and training topology', () => {
    for (const file of ['docs/ADMIN_USER_GUIDE.md', 'docs/EXECUTIVE_GOVERNANCE_MANUAL.md', 'docs/FINANCIAL_SECRETARY_MANUAL.md', 'docs/TREASURER_MANUAL.md']) {
      const text = read(file);
      expect(text, file).toContain('testing-sandbox.db');
      expect(text, file).toContain('admin@training');
    }
  });
});
