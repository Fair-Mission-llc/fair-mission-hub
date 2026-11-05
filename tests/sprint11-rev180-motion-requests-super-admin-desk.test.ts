// Sprint 11 Revision 18.0 (schema 111): the Motion Request pipeline (member request, Grand Knight decision, automatic
// 5-minute agenda slot, two chat channels), the Form 1728 confidence cutoff (PlatformSettings.global_ai_confidence_cutoff),
// the Super Admin Desk's vertical filing cabinets, and the Advisory Panel limited to the platform owner and panelists.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canOpenAdvisoryPanel,
  COUNCIL_WIDE_SETTING_DEFAULTS,
  DASHBOARD_TABS,
  DEFAULT_GLOBAL_AI_CONFIDENCE_CUTOFF,
  deskDrawersFor,
  deskSpineSections,
  form1728ConfidenceCutoff,
  form1728ConfidencePercent,
  motionRequestChannelAccess,
  motionRequestEarliestDate,
  MOTION_REQUEST_SLOT_MINUTES,
  PLATFORM_SCHEMA_VERSION,
  PLATFORM_SETTING_DEFAULTS,
  portalAreas,
  portalSidebar,
  SUPER_ADMIN_DESK_TITLE,
  topForm1728Suggestions,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const OWN = 1;
const CADENCE = 1;

describe('0. schema 111', () => {
  it('adds the two motion tables, the council lead days and the platform cutoff', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(112); // Sprint 11 Revision 19.6 moved the platform to schema 112.
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toContain('const SCHEMA_VERSION = 112;');
    expect(TABLES.MotionRequest.columns.map((c) => c.name)).toEqual([
      'id', 'council_id', 'proposed_by', 'summary_what', 'rationale_why', 'financial_impact_usd', 'request_status',
      'submitted_at', 'decided_by_member_id', 'decided_at', 'decision_note', 'target_meeting_id', 'proposed_motion_id',
    ]);
    expect(TABLES.MotionRequestMessage.columns.find((c) => c.name === 'channel')!.allowed).toEqual(['MEMBER_GK', 'OFFICER_ADVISORY']);
    expect(read('Schema.sql')).toContain('ALTER TABLE [Council] ADD [motion_request_lead_days] INT NOT NULL DEFAULT 5;');
    expect(read('Schema.sql')).toContain('ALTER TABLE [PlatformSettings] ADD [global_ai_confidence_cutoff] INT NOT NULL DEFAULT 60;');
    expect(COUNCIL_WIDE_SETTING_DEFAULTS.motion_request_lead_days).toBe(5);
    expect(PLATFORM_SETTING_DEFAULTS.global_ai_confidence_cutoff).toBe(60);
  });
});

describe('1. the motion request rules', () => {
  it('needs the request in the lead days before the meeting, never earlier than today', () => {
    expect(motionRequestEarliestDate('2026-09-20 18:00:00', 5, '2026-09-20')).toBe('2026-09-25');
    expect(motionRequestEarliestDate('2026-09-01', 5, '2026-09-20')).toBe('2026-09-20');
  });

  it('keeps the officer channel from the member who proposed the motion', () => {
    const request = { council_id: OWN, proposed_by: 3 };
    const member = { memberId: 3, councilId: OWN, memberType: 'Member', active: true, roles: [], officer: false };
    const officer = { memberId: 2, councilId: OWN, memberType: 'Admin', active: true, roles: ['Financial Secretary'], officer: true };
    const gk = { memberId: 9, councilId: OWN, memberType: 'Member', active: true, roles: ['Grand Knight'], officer: true };
    expect(motionRequestChannelAccess(member, request, 'MEMBER_GK')).toEqual({ read: true, post: true });
    expect(motionRequestChannelAccess(member, request, 'OFFICER_ADVISORY').read).toBe(false);
    expect(motionRequestChannelAccess(officer, request, 'OFFICER_ADVISORY')).toEqual({ read: true, post: true });
    expect(motionRequestChannelAccess(officer, request, 'MEMBER_GK').read).toBe(false);
    expect(motionRequestChannelAccess(gk, request, 'MEMBER_GK').read).toBe(true);
    expect(motionRequestChannelAccess(gk, request, 'OFFICER_ADVISORY').read).toBe(true);
  });
});

describe.each(drivers)('$name driver: the motion request pipeline', (d) => {
  it('files an approved request as a 5-minute motion on the next eligible Monthly meeting', async () => {
    const db = await d.make();
    const preview = await db.motionRequests.preview(MEMBER.member);
    expect(preview).toMatchObject({ leadDays: 5, earliestDate: '2026-09-25', meeting: null });

    const sent = await db.motionRequests.submit(MEMBER.member, {
      summary_what: '  Buy a new grill for the fish fry ',
      rationale_why: 'The old grill failed in Lent.',
      financial_impact_usd: 1250.5,
    });
    expect(sent.request).toMatchObject({ council_id: OWN, proposed_by: MEMBER.member, summary_what: 'Buy a new grill for the fish fry', request_status: 'Pending', financial_impact_usd: 1250.5 });
    expect(sent.channels).toEqual(['MEMBER_GK']);
    expect(sent.canWithdraw).toBe(true);
    expect((await db.motionRequests.listMine(MEMBER.member)).map((r) => r.request.id)).toEqual([sent.request.id]);

    // The Grand Knight's desk list; a plain member may not read it.
    expect((await db.motionRequests.listForCouncil(MEMBER.superAdmin, OWN))[0]!.canDecide).toBe(true);
    await expectRule(db.motionRequests.listForCouncil(MEMBER.member, OWN), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.motionRequests.decide(MEMBER.member, sent.request.id, 'Approved'), 'GRAND_KNIGHT_REQUIRED');

    // No Monthly meeting yet: nothing is written.
    const motionsBefore = d.count(db, 'ProposedMotion');
    await expectRule(db.motionRequests.decide(MEMBER.superAdmin, sent.request.id, 'Approved'), 'NO_ELIGIBLE_MEETING');
    expect(d.count(db, 'ProposedMotion')).toBe(motionsBefore);

    await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, CADENCE, '2026-2027');
    expect((await db.motionRequests.preview(MEMBER.member)).meeting).toMatchObject({ date: '2026-10-06' });
    const decision = await db.motionRequests.decide(MEMBER.superAdmin, sent.request.id, 'Approved', 'Good idea.');
    expect(decision.meeting).toMatchObject({ date: '2026-10-06' });
    expect(decision.motion).toMatchObject({
      CouncilID: OWN,
      SourceType: 'GeneralMember',
      SourceRecordID: sent.request.id,
      PresenterMemberID: MEMBER.member,
      AllocatedMinutes: MOTION_REQUEST_SLOT_MINUTES,
      VoteResult: 'Pending',
      MotionText: 'Buy a new grill for the fish fry (financial impact $1,250.50)',
    });
    expect(MOTION_REQUEST_SLOT_MINUTES).toBe(5);
    expect(decision.request.request).toMatchObject({ request_status: 'Approved', decided_by_member_id: MEMBER.superAdmin, decision_note: 'Good idea.', target_meeting_id: decision.meeting!.id });
    expect(decision.request.targetMeeting).toMatchObject({ date: '2026-10-06' });
    expect((await db.meetings.listProposedMotions(decision.meeting!.id)).map((m) => m.motion.id)).toContain(decision.motion!.id);

    // Decided once only.
    await expectRule(db.motionRequests.decide(MEMBER.superAdmin, sent.request.id, 'Denied', 'No.'), 'REQUEST_STATUS_CONFLICT');
    await expectRule(db.motionRequests.withdraw(MEMBER.member, sent.request.id), 'REQUEST_STATUS_CONFLICT');
  });

  it("follows the council's lead days", async () => {
    const db = await d.make();
    await db.councils.setCouncilWideSettings(MEMBER.superAdmin, OWN, { motion_request_lead_days: 20 });
    await db.meetings.populateAnnualCadence(MEMBER.superAdmin, OWN, CADENCE, '2026-2027');
    // 2026-09-20 + 20 days = 2026-10-10, after the October 6 meeting: the request waits for November 3.
    expect(await db.motionRequests.preview(MEMBER.member)).toMatchObject({ leadDays: 20, earliestDate: '2026-10-10', meeting: { date: '2026-11-03' } });
    const sent = await db.motionRequests.submit(MEMBER.member, { summary_what: 'Plant a tree', rationale_why: 'Shade.' });
    const decision = await db.motionRequests.decide(MEMBER.superAdmin, sent.request.id, 'Approved');
    expect(decision.meeting).toMatchObject({ date: '2026-11-03' });
    expect(decision.motion!.MotionText).toBe('Plant a tree');
  });

  it('denies with a note, lets the member withdraw, and keeps the two chat channels apart', async () => {
    const db = await d.make();
    await expectRule(db.motionRequests.submit(MEMBER.member, { summary_what: ' ', rationale_why: 'x' }), 'INVALID_INPUT');
    await expectRule(db.motionRequests.submit(MEMBER.member, { summary_what: 'x', rationale_why: 'y', financial_impact_usd: -1 }), 'INVALID_INPUT');

    const a = await db.motionRequests.submit(MEMBER.member, { summary_what: 'Paint the hall', rationale_why: 'It is peeling.' });
    await expectRule(db.motionRequests.decide(MEMBER.superAdmin, a.request.id, 'Denied'), 'INVALID_INPUT');
    const denied = await db.motionRequests.decide(MEMBER.superAdmin, a.request.id, 'Denied', 'The parish paints it in spring.');
    expect(denied).toMatchObject({ motion: null, meeting: null });
    expect(denied.request.request).toMatchObject({ request_status: 'Denied', decision_note: 'The parish paints it in spring.' });

    const b = await db.motionRequests.submit(MEMBER.member, { summary_what: 'Host a picnic', rationale_why: 'Fellowship.' });
    await expectRule(db.motionRequests.withdraw(MEMBER.admin, b.request.id), 'COUNCIL_ACCESS_DENIED');
    expect((await db.motionRequests.withdraw(MEMBER.member, b.request.id)).request.request_status).toBe('Withdrawn');

    // MEMBER_GK: the member and the Grand Knight. OFFICER_ADVISORY: officers only, never the member.
    await db.motionRequests.postMessage(MEMBER.member, a.request.id, 'MEMBER_GK', 'Could the council help the parish?');
    const reply = await db.motionRequests.postMessage(MEMBER.superAdmin, a.request.id, 'MEMBER_GK', 'I will ask Father.');
    expect(reply.messages.map((m) => m.message_body)).toEqual(['Could the council help the parish?', 'I will ask Father.']);
    await db.motionRequests.postMessage(MEMBER.admin, a.request.id, 'OFFICER_ADVISORY', 'The budget has no paint line.');
    await expectRule(db.motionRequests.listMessages(MEMBER.member, a.request.id, 'OFFICER_ADVISORY'), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.motionRequests.postMessage(MEMBER.member, a.request.id, 'OFFICER_ADVISORY', 'Let me see.'), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.motionRequests.listMessages(MEMBER.admin, a.request.id, 'MEMBER_GK'), 'COUNCIL_ACCESS_DENIED');
    expect((await db.motionRequests.listMessages(MEMBER.superAdmin, a.request.id, 'OFFICER_ADVISORY')).messages).toHaveLength(1);
    const mine = (await db.motionRequests.listMine(MEMBER.member)).find((r) => r.request.id === a.request.id)!;
    expect(mine.channels).toEqual(['MEMBER_GK']);
    expect(mine.messageCounts).toEqual({ MEMBER_GK: 2 });
    expect(d.count(db, 'MotionRequestMessage')).toBe(3);
  });
});

describe('2. the Form 1728 confidence cutoff', () => {
  it('turns a score into a percent and reads the stored cutoff', () => {
    expect(form1728ConfidencePercent(5)).toBe(100);
    expect(form1728ConfidencePercent(2)).toBe(40);
    expect(form1728ConfidencePercent(9)).toBe(100);
    expect(form1728ConfidenceCutoff(undefined)).toBe(DEFAULT_GLOBAL_AI_CONFIDENCE_CUTOFF);
    expect(form1728ConfidenceCutoff(140)).toBe(100);
  });

  it('strips the cards below the cutoff instead of forcing three slots', () => {
    const strong = topForm1728Suggestions('Rosary before Mass');
    expect(strong.map((s) => s.code)).toEqual(['FAITH_C']);
    expect(strong[0]!.confidencePercent).toBe(80);
    expect(topForm1728Suggestions('Socials')).toEqual([]);
    // 'coat' alone scores 2 (40%): shown at a 40% cutoff, stripped at the 60% default.
    expect(topForm1728Suggestions('Coat closet')).toEqual([]);
    expect(topForm1728Suggestions('Coat closet', null, undefined, null, 3, 40).map((s) => s.code)).toEqual(['COMMUNITY_A']);
    expect(topForm1728Suggestions('Youth soccer and basketball day', null, undefined, null, 3, 0).length).toBeLessThanOrEqual(3);
  });

  it('reads the cutoff in the popup and offers it on Global System Parameters', () => {
    const parts = read('apps/web/components/Form1728Parts.tsx');
    // Sprint 11 Revision 19.6: the popup reads the reader's parent organization's settings.
    expect(parts).toContain('db.councils.getPlatformSettings({ councilId })');
    expect(parts).toContain('form1728ConfidenceCutoff(platform.data?.global_ai_confidence_cutoff)');
  });
});

describe('3. the Super Admin Desk filing cabinets', () => {
  const superAdmin = { memberId: 1, councilId: OWN, memberType: 'Super Admin' as const, isOfficer: true, roles: ['Grand Knight'] };

  it('names the tab Super Admin Desk and files the drawers in two cabinets plus the freestanding registry', () => {
    expect(SUPER_ADMIN_DESK_TITLE).toBe('Super Admin Desk');
    expect(DASHBOARD_TABS.find((t) => t.id === 'super-admin')!.label).toBe('Super Admin Desk');
    const sections = deskSpineSections('super-admin', deskDrawersFor(superAdmin, 'super-admin', OWN));
    expect(sections.map((s) => [s.label, s.drawers.map((d) => d.title)])).toEqual([
      ['Communications Cabinet', ['Feedback Communication Center', 'Council Access Request Approval Queue']],
      ['Settings Cabinet', ['Global System Parameters', 'Global Lookup Tables', 'System Feature Flag Control Panel', 'Secure Access Vault']],
      ['', ['Global Charities Registry']],
    ]);
    expect(deskDrawersFor({ ...superAdmin, memberType: 'Admin' }, 'super-admin', OWN)).toEqual([]);
  });

  it('drops the horizontal folder row for the left vertical spine', () => {
    const desk = read('apps/web/components/SuperAdminDesk.tsx');
    expect(desk).not.toContain('role="tablist"');
    expect(desk).toContain('<DeskBlotter desk="super-admin"');
  });

  it('gives a Super Admin both the Admin Desk link and the Super Admin Desk tab', () => {
    const setup = portalSidebar(superAdmin).find((g) => g.id === 'setup')!;
    expect(setup.entries.map((e) => e.item)).toContain('admin-desk');
    expect(read('packages/shared/src/officer-desks.ts')).toContain("'super-admin': showsSuperAdminDeskTab(u)");
  });
});

describe('4. the Motion Requests screens', () => {
  it('adds My Motion Requests under Faith In Action for every member and the lit drawer on the Grand Knight Desk', () => {
    const member = { memberId: 3, councilId: OWN, memberType: 'Member' as const, isOfficer: false, roles: [] };
    expect(portalAreas(member)).toContain('motion-requests');
    expect(portalSidebar(member).find((g) => g.id === 'faith')!.entries.map((e) => e.item)).toContain('motion-requests');
    const gk = { ...member, roles: ['Grand Knight'], isOfficer: true };
    expect(deskDrawersFor(gk, 'grand-knight', OWN).find((d) => d.id === 'motion-requests')).toMatchObject({ id: 'motion-requests', title: 'Motion Requests', alerts: true });
    expect(deskDrawersFor({ ...member, roles: ['Grand Knight'] }, 'grand-knight', 2).map((d) => d.id)).not.toContain('motion-requests');
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).toContain('<MyMotionRequestsPanel user={user} />');
    expect(desks).toContain("alertText: 'Motion requests waiting for your decision'");
    expect(read('apps/web/app/motion-requests/page.tsx')).toContain('<RequireArea area="motion-requests">');
  });
});

describe('5. the Advisory Panel (every Super Admin since Revision 18.5)', () => {
  it('opens for every Super Admin and invitation holder', () => {
    const superAdmin = { memberId: 1, councilId: OWN, memberType: 'Super Admin' as const, isOfficer: false, roles: [] };
    expect(canOpenAdvisoryPanel(superAdmin)).toBe(true);
    expect(canOpenAdvisoryPanel({ ...superAdmin, username: 'other.admin@kofc.org' })).toBe(true);
    expect(canOpenAdvisoryPanel({ ...superAdmin, username: 'testsuperadmin@kofc.org' })).toBe(true);
    expect(portalAreas({ ...superAdmin, username: 'other.admin@kofc.org' })).toContain('advisory-panel');
    expect(portalAreas({ ...superAdmin, username: 'testsuperadmin@kofc.org' })).toContain('advisory-panel');
  });

  it('still refuses a council Admin on the server', async () => {
    const d = drivers[0]!;
    const db = await d.make();
    // Member 1 is a Super Admin; Revision 18.5 no longer checks the sign-in name.
    await expect(db.advisory.listMeetings(MEMBER.superAdmin)).resolves.toBeDefined();
    await expectRule(db.advisory.listMeetings(MEMBER.admin), 'ADMIN_REQUIRED');
  });
});
