// Sprint 7F (Schema 65): council access requests from the sign-in page, CHECK payments in the ledger, asset photos,
// the Super Admin's read-only impersonation and the Co-Watching Remote Assistance desk.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ACCESS_REQUEST_NOTIFY_EMAIL,
  accessRequestEmail,
  assertAccessRequestTransition,
  assertMayImpersonate,
  BusinessRuleError,
  canOpenRemoteAssistanceDesk,
  cleanAccessRequest,
  cleanAssetRecordChanges,
  cleanJournalPayment,
  donationFundsBucket,
  donationMethodKind,
  guardViewAsWrites,
  isViewAsReadMethod,
  JOURNAL_PAYMENT_METHODS,
  mayImpersonateMember,
  mayRequestRemoteAssistance,
  mayWatchRemoteAssistance,
  portalAreas,
  sanitizeAssistSnapshot,
  sortAccessRequests,
  type MemberWriteActor,
  type SendGridMailRequest,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { SCHEMA_STATEMENTS } from '../apps/mobile/services/generated/schema.sqlite';
import {
  cleanAssistSnapshot,
  closeAssistRequest,
  getAssistRequest,
  listAssistRequests,
  openAssistRequest,
  resetAssistRequests,
  updateAssistSnapshot,
} from '../apps/web/services/server/assist';
import { impersonationClaimsFor, IMPERSONATOR_COOKIE, sessionClaimsFor, sessionCookieHeader, signSessionToken, verifySessionToken } from '../apps/web/services/server/session-token';
import { drivers, expectRule, MEMBER, NOW } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const PARKING_FUNDRAISING = 8; // a Revenue account

const actor = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({ memberId: 9, councilId: OWN, memberType: 'Member', active: true, roles: [], ...over });
const superAdmin = actor({ memberId: 1, memberType: 'Super Admin' });
const admin = actor({ memberId: 2, memberType: 'Admin' });
const officer = actor({ memberId: 5, officer: true, roles: ['Recorder'] });
const member = actor();
const request = { council_name: 'Council 9999 St. Joseph', contact_email: 'gk@stjoseph.org', city: 'Tacoma', state: 'WA' };

describe('Schema 65', () => {
  it('adds the asset photo, the payment method CHECK list and the access requests table, and bumps the phone version', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('Sprint 7F: ONBOARDING GATES, CHECK PAYMENTS AND ASSET PHOTOS (schema version 65)');
    expect(schema).toContain("ALTER TABLE [JournalEntry] ADD [payment_method] VARCHAR(10) NULL CHECK ([payment_method] IN ('CASH', 'CARD', 'CHECK'));");
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (6[5-9]|[7-9]\d);/);
    expect(TABLES.CouncilAssetsInventory.columns.find((c) => c.name === 'photo_url')).toMatchObject({ kind: 'text', notNull: false });
    expect(TABLES.JournalEntry.columns.find((c) => c.name === 'payment_method')).toMatchObject({ notNull: false, allowed: ['CASH', 'CARD', 'CHECK'] });
    expect(TABLES.CouncilAccessRequests.columns.map((c) => c.name)).toEqual([
      'id',
      'council_name',
      'contact_email',
      'city',
      'state',
      'status',
      'submitted_at',
      'reviewed_by_id',
      'reviewed_at',
    ]);
    expect(TABLES.CouncilAccessRequests.columns.find((c) => c.name === 'status')).toMatchObject({ default: { kind: 'literal', value: 'PENDING' } });
    // The phone's SQLite table carries the same CHECK.
    expect(SCHEMA_STATEMENTS.find((s) => s.startsWith('CREATE TABLE [JournalEntry]'))).toContain("[payment_method] TEXT CHECK ([payment_method] IN ('CASH', 'CARD', 'CHECK'))");
    expect(JOURNAL_PAYMENT_METHODS).toEqual(['CASH', 'CARD', 'CHECK']);
  });

  it('enforces the CHECK list in the web mock store', async () => {
    const db = new MemoryDataService({ now: () => new Date(NOW) });
    await db.init();
    const line = { CouncilID: OWN, GLAccountID: 1, DateLogged: '2026-09-01 00:00:00', Description: 'x', TransactionID: 't' };
    expect(() => db.debugStore.insert('JournalEntry', { ...line, payment_method: 'WIRE' })).toThrow(/CHECK constraint failed: JournalEntry.payment_method/);
    expect(db.debugStore.insert('JournalEntry', { ...line, payment_method: 'CHECK' }).payment_method).toBe('CHECK');
    expect(db.debugStore.insert('JournalEntry', line).payment_method).toBeNull();
  });

  it('adds Check as a donation method that feeds the cash column', () => {
    expect(read('Seed.sql')).toMatch(/\('Physical Items'\),\s*\('Check'\);/);
    expect(donationMethodKind('Check')).toBe('check');
    expect(donationFundsBucket('check')).toBe('cash');
  });
});

describe('council access requests (rules)', () => {
  it('cleans the four fields and refuses a missing field or a bad email', () => {
    expect(cleanAccessRequest({ ...request, city: '  Tacoma ' })).toEqual(request);
    expect(() => cleanAccessRequest({ ...request, contact_email: 'not-an-email' })).toThrow(/not an email/);
    expect(() => cleanAccessRequest({ ...request, council_name: ' ' })).toThrow(/Council name is required/);
    expect(() => cleanAccessRequest({ ...request, state: 'x'.repeat(51) })).toThrow();
  });

  it('emails the notice to the council mailbox and allows only PENDING -> APPROVED', () => {
    const email = accessRequestEmail({ id: 4, ...request, submitted_at: '2026-10-11 09:00:00' });
    expect(ACCESS_REQUEST_NOTIFY_EMAIL).toBe('council15295@stmarys.org');
    expect(email).toMatchObject({ to: 'council15295@stmarys.org', subject: 'New council access request: Council 9999 St. Joseph' });
    expect(email.text).toContain('Contact: gk@stjoseph.org');
    expect(assertAccessRequestTransition('PENDING', 'APPROVED')).toBe('APPROVED');
    expect(() => assertAccessRequestTransition('APPROVED', 'APPROVED')).toThrow(/cannot become/);
    expect(() => assertAccessRequestTransition('PENDING', 'REJECTED')).toThrow(/must be one of/);
  });

  it('lists pending requests first, newest first', () => {
    const rows = [
      { id: 1, status: 'APPROVED' as const, submitted_at: '2026-10-10 09:00:00' },
      { id: 2, status: 'PENDING' as const, submitted_at: '2026-10-09 09:00:00' },
      { id: 3, status: 'PENDING' as const, submitted_at: '2026-10-11 09:00:00' },
    ];
    expect(sortAccessRequests(rows).map((r) => r.id)).toEqual([3, 2, 1]);
  });
});

describe.each(drivers)('Sprint 7F ($name driver)', (d) => {
  it('stores an access request from anyone and lets only a Super Admin list and approve it', async () => {
    const db = await d.make();
    const saved = await db.accessRequests.submit(request);
    expect(saved).toMatchObject({ ...request, status: 'PENDING', reviewed_by_id: null });
    await expectRule(db.accessRequests.submit({ ...request, contact_email: 'nope' }), 'INVALID_INPUT');
    await expectRule(db.accessRequests.list(MEMBER.admin), 'SUPER_ADMIN_REQUIRED');
    await expectRule(db.accessRequests.setStatus(MEMBER.admin, saved.id, 'APPROVED'), 'SUPER_ADMIN_REQUIRED');
    expect(await db.accessRequests.list(MEMBER.superAdmin)).toHaveLength(1);

    const approved = await db.accessRequests.setStatus(MEMBER.superAdmin, saved.id, 'APPROVED');
    expect(approved).toMatchObject({ status: 'APPROVED', reviewed_by_id: MEMBER.superAdmin });
    await expectRule(db.accessRequests.setStatus(MEMBER.superAdmin, saved.id, 'APPROVED'), 'INVALID_INPUT');
    await expectRule(db.accessRequests.setStatus(MEMBER.superAdmin, 999, 'APPROVED'), 'RECORD_NOT_FOUND');
    expect(d.count(db, 'CouncilAccessRequests')).toBe(1);
  });

  it("builds a member's session for a Super Admin's view, and refuses anyone else or a Super Admin target", async () => {
    const db = await d.make();
    const view = await db.auth.impersonate(MEMBER.superAdmin, MEMBER.member);
    expect(view).toMatchObject({ memberId: MEMBER.member, memberType: 'Member' });
    await expectRule(db.auth.impersonate(MEMBER.admin, MEMBER.member), 'SUPER_ADMIN_REQUIRED');
    await expectRule(db.auth.impersonate(MEMBER.superAdmin, MEMBER.superAdmin), 'IMPERSONATION_REFUSED');
    await expectRule(db.auth.impersonate(MEMBER.superAdmin, 99999), 'RECORD_NOT_FOUND');
  });

  it('records a revenue posting paid by check, with its number on both lines', async () => {
    const db = await d.make();
    const past = await db.events.create(
      { EventName: 'Pancake breakfast', EventDescription: 'Hall', OwnerID: MEMBER.admin, StartDate: '2026-09-12', EndDate: '2026-09-12', Location: 'Hall', CategoryID: 1 },
      [OWN],
    );
    const input = { LinkedEventID: past.id, Amount: 300, RevenueAccountID: PARKING_FUNDRAISING, DateLogged: '2026-09-13' };
    await expectRule(db.finance.logConcludedRevenue(MEMBER.superAdmin, OWN, { ...input, payment_method: 'CHECK' }), 'INVALID_INPUT');
    await expectRule(db.finance.logConcludedRevenue(MEMBER.superAdmin, OWN, { ...input, payment_method: 'CASH', CheckNumber: '1001' }), 'INVALID_INPUT');
    const lines = await db.finance.logConcludedRevenue(MEMBER.superAdmin, OWN, { ...input, payment_method: 'CHECK', CheckNumber: ' 1001 ' });
    expect(lines.map((l) => [l.payment_method, l.CheckNumber])).toEqual([
      ['CHECK', '1001'],
      ['CHECK', '1001'],
    ]);
    const cash = await db.finance.logConcludedRevenue(MEMBER.superAdmin, OWN, { ...input, payment_method: 'CASH' });
    expect(cash[0]).toMatchObject({ payment_method: 'CASH', CheckNumber: null });
  });
});

describe('asset photos', () => {
  it('accepts a vault id or a link, clears with null, and refuses script links', () => {
    expect(cleanAssetRecordChanges({ photo_url: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345' })).toEqual({ photo_url: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345' });
    expect(cleanAssetRecordChanges({ photo_url: null })).toEqual({ photo_url: null });
    expect(() => cleanAssetRecordChanges({ photo_url: 'javascript:alert(1)' })).toThrow(/uploaded file or a web link/);
    expect(() => cleanAssetRecordChanges({ photo_url: 'x'.repeat(2001) })).toThrow();
  });

  it('saves the photo on the asset row through updateAssetRecord', async () => {
    const db = new MemoryDataService({ now: () => new Date(NOW) });
    await db.init();
    const asset = db.debugStore.insert('CouncilAssetsInventory', { council_id: OWN, asset_name: 'Grill', purchase_date: '2026-09-01 00:00:00', cost_basis: 400 });
    const saved = await db.expenses.updateAssetRecord(MEMBER.superAdmin, asset.id as number, { photo_url: 'blob:http://localhost/abc#grill.jpg' });
    expect(saved.photo_url).toBe('blob:http://localhost/abc#grill.jpg');
    await expectRule(db.expenses.updateAssetRecord(MEMBER.member, asset.id as number, { photo_url: null }), 'ADMIN_REQUIRED');
  });

  it('puts the upload control on the asset form and a thumbnail column on the inventory', () => {
    const page = read('apps/web/app/expenses/assets/page.tsx');
    expect(page).toContain('accept="image/*"');
    expect(page).toContain("archiveToDriveVault(user, 'media', file, ASSET_PHOTO_FOLDER)");
    expect(page).toContain("head={['Photo', 'Asset'");
  });
});

describe('impersonation', () => {
  it('lets only an Active Super Admin view as a member who is not a Super Admin', () => {
    expect(() => assertMayImpersonate(superAdmin, { memberId: 9, memberType: 'Member' })).not.toThrow();
    expect(() => assertMayImpersonate(admin, { memberId: 9, memberType: 'Member' })).toThrow(BusinessRuleError);
    expect(() => assertMayImpersonate({ ...superAdmin, active: false }, { memberId: 9, memberType: 'Member' })).toThrow(/Super Admin/);
    expect(() => assertMayImpersonate(superAdmin, { memberId: 7, memberType: 'Super Admin' })).toThrow(/cannot be impersonated/);
    expect(mayImpersonateMember({ memberId: 1, memberType: 'Super Admin' }, { memberId: 3, memberType: 'Member' })).toBe(true);
    expect(mayImpersonateMember({ memberId: 1, memberType: 'Super Admin' }, { memberId: 1, memberType: 'Super Admin' })).toBe(false);
    expect(mayImpersonateMember({ memberId: 2, memberType: 'Admin' }, { memberId: 3, memberType: 'Member' })).toBe(false);
  });

  it('refuses writes, never reads, while the view is on', async () => {
    let on = false;
    const calls: string[] = [];
    const service = {
      init: () => 'ready',
      members: {
        get: async (id: number) => calls.push(`get ${id}`),
        listByCouncil: async () => calls.push('list'),
        update: async () => calls.push('update'),
      },
    };
    const guarded = guardViewAsWrites(service, () => on);
    expect(guarded.init()).toBe('ready');
    await guarded.members.update();
    on = true;
    await guarded.members.get(3);
    await guarded.members.listByCouncil();
    await expectRule(guarded.members.update() as Promise<unknown>, 'VIEW_AS_READ_ONLY');
    expect(calls).toEqual(['update', 'get 3', 'list']);
    expect(['getAssetRecord', 'listInbox', 'monthlySummary', 'memberCenter'].every(isViewAsReadMethod)).toBe(true);
    expect(['update', 'markAsRead', 'compileInMemoriam', 'setStatus', 'getaway'].some(isViewAsReadMethod)).toBe(false);
  });

  it('mints a view-as token that names the Super Admin and never outlives their own session', async () => {
    const now = new Date('2026-10-11T12:00:00Z');
    const user = { credentialId: 1, memberId: 1, councilId: 1, username: 'sa', firstName: 'S', lastName: 'A', memberType: 'Super Admin' as const, roles: [], isOfficer: false, isBudgetDirector: false };
    const own = sessionClaimsFor(user, true, new Date(now.getTime() - 7.5 * 3600_000), 8 * 3600);
    const target = { ...user, credentialId: 3, memberId: 3, username: 'm', memberType: 'Member' as const };
    const view = impersonationClaimsFor(target, true, own, now, 60);
    expect(view).toMatchObject({ memberId: 3, impersonatorId: 1, exp: own.exp });
    const secret = 's'.repeat(32);
    expect(await verifySessionToken(await signSessionToken(view, secret), secret, now)).toMatchObject({ impersonatorId: 1 });
    expect(sessionCookieHeader('abc', true, IMPERSONATOR_COOKIE)).toBe(`${IMPERSONATOR_COOKIE}=abc; Path=/api; HttpOnly; SameSite=Strict; Secure`);
  });

  it('wires the route, the member grid button and the read-only server guard', () => {
    const route = read('apps/web/app/api/admin/impersonate/route.ts');
    expect(route).toContain("actor.memberType !== 'Super Admin'");
    expect(route).toContain('db.auth.impersonate(claims.memberId, memberId)');
    expect(read('apps/web/services/server/session.ts')).toContain("claims.impersonatorId !== undefined && req.method !== 'GET'");
    expect(read('apps/web/app/members/page.tsx')).toContain('👥 Impersonate User');
    expect(read('apps/web/services/db.ts')).toContain('guardViewAsWrites(createDataService(), () => viewAsActive)');
  });
});

describe('remote assistance', () => {
  afterEach(() => resetAssistRequests());

  it('lets officers and Admins ask, and only Super Admins watch', () => {
    expect([officer, admin, member, superAdmin].map(mayRequestRemoteAssistance)).toEqual([true, true, false, false]);
    expect([officer, admin, member, superAdmin].map(mayWatchRemoteAssistance)).toEqual([false, false, false, true]);
    expect(canOpenRemoteAssistanceDesk({ memberId: 1, councilId: 1, memberType: 'Super Admin', isOfficer: false, roles: [] })).toBe(true);
    expect(portalAreas({ memberId: 1, councilId: 1, memberType: 'Super Admin', isOfficer: false, roles: [] })).toContain('system-settings/remote-assistance');
    expect(portalAreas({ memberId: 2, councilId: 1, memberType: 'Admin', isOfficer: false, roles: [] })).not.toContain('system-settings/remote-assistance');
  });

  it('strips scripts, handlers, javascript links and form values from a screen copy', () => {
    const html = sanitizeAssistSnapshot(
      '<div onclick="steal()"><script>alert(1)</script><a href="javascript:x()">a</a><input name="q" value="secret"><textarea>notes</textarea><iframe src="x"></iframe>ok</div>',
    );
    expect(html).toBe('<div><a>a</a><input name="q"><textarea></textarea>ok</div>');
  });

  it('keeps one open request per member, refreshes it for its owner only, and closes it', () => {
    const snapshot = cleanAssistSnapshot({ route: '/expenses', viewport: { width: 1280, height: 800 }, html: '<main>hi</main>' });
    if (typeof snapshot === 'string') throw new Error(snapshot);
    expect(cleanAssistSnapshot({ route: 'expenses', html: '' })).toBe('Send the page path.');
    const first = openAssistRequest({ memberId: 5, councilId: 1, memberName: 'Recorder, Rob' }, 'Where is the save button?', snapshot);
    const second = openAssistRequest({ memberId: 5, councilId: 1, memberName: 'Recorder, Rob' }, '', snapshot);
    expect(listAssistRequests().map((r) => r.id)).toEqual([second.id]);
    expect(listAssistRequests()[0]).not.toHaveProperty('html');
    expect(getAssistRequest(first.id)).toBeNull();
    expect(updateAssistSnapshot(second.id, 6, { ...snapshot, html: '<main>other</main>' })).toBe(false);
    expect(updateAssistSnapshot(second.id, 5, { ...snapshot, html: '<main>new</main>' })).toBe(true);
    expect(getAssistRequest(second.id)?.html).toBe('<main>new</main>');
    expect(closeAssistRequest(second.id, 6, false)).toBe(false);
    expect(closeAssistRequest(second.id, 1, true)).toBe(true);
    expect(listAssistRequests()).toEqual([]);
  });

  it('puts the request button in the header for officers and Admins and draws the copy in a sandboxed frame', () => {
    expect(read('apps/web/components/Shell.tsx')).toContain("user.memberType !== 'Super Admin' && (user.isOfficer || user.memberType === 'Admin') ? <RemoteAssistButton />");
    expect(read('apps/web/components/PlatformAccessParts.tsx')).toContain('❓ Request Remote Officer Assistance');
    expect(read('apps/web/app/system-settings/remote-assistance/page.tsx')).toContain('sandbox=""');
  });
});

describe('sign-in gates and the mail center', () => {
  it('puts the Register Your Council button on both sign-in screens', () => {
    expect(read('apps/web/components/Shell.tsx')).toContain('🏢 Register Your Council / Request Access');
    expect(read('apps/mobile/app/sign-in.tsx')).toContain('🏢 Register Your Council / Request Access');
    expect(read('apps/mobile/app/sign-in.tsx')).toContain('db.accessRequests.submit(draft)');
  });

  it('shows the Inbound Council Mail Center to Super Admins on the Executive Dashboard', () => {
    const page = read('apps/web/app/dashboard/page.tsx');
    expect(page).toContain("user.memberType === 'Super Admin' ? (");
    expect(page).toContain('<InboundMailCenter />');
    expect(read('apps/web/components/PlatformAccessParts.tsx')).not.toMatch(/bg-black/);
  });

  it("emails the notice through the driver's email hook", async () => {
    const sent: SendGridMailRequest[] = [];
    const db = new MemoryDataService({ now: () => new Date(NOW), sendEmail: async (r) => void sent.push(r) });
    await db.init();
    await db.accessRequests.submit(request);
    expect(sent).toHaveLength(1);
    expect(sent[0].body.personalizations[0].to[0].email).toBe(ACCESS_REQUEST_NOTIFY_EMAIL);
  });
});
