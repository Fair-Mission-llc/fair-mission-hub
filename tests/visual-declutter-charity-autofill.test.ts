// Sprint 10 Revision 1.0 (schema 100): verified registry charities and the Propose Charity Grant auto-fill, the
// collapsible sidebar with its top-level Council Photo Gallery node, the gallery's two views, the Grand Knight Desk
// without the Inbound Council Mail Center, and the Executive Dashboard's compact drawers.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  charityGrantAutoFill,
  charityMailingAddress,
  charityVerificationStamp,
  cleanCharitySearchFilters,
  COUNCIL_PHOTO_GALLERY_TITLE,
  deskDrawersFor,
  GALLERY_VIEWS,
  galleryViewFromAnchor,
  isVerifiedCharity,
  navigationGuide,
  navigationGuideMap,
  PLATFORM_SCHEMA_VERSION,
  PORTAL_NAV_GROUPS,
  searchCharityRegistry,
  verifiedCharitiesInState,
  verifiedCharityStates,
  type GlobalCharityRegistry,
  type NewGlobalCharity,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

const row = (id: number, over: Partial<GlobalCharityRegistry> = {}): GlobalCharityRegistry => ({
  id,
  Name: `Charity ${id}`,
  Description: 'Fixture',
  EIN: null,
  State: 'OR',
  IsCatholic: 0,
  CharityType: 'Faith',
  IsAnnual: 0,
  IsVerified: 0,
  ...over,
});

const newCharity = (over: Partial<NewGlobalCharity> = {}): NewGlobalCharity => ({
  Name: 'St. Vincent de Paul Salem',
  Description: 'Food pantry and emergency rent help',
  EIN: '93-0386970',
  State: 'OR',
  Phone: '503-555-0100',
  ContactName: 'Joan Smith',
  ContactEmail: 'joan@svdp.org',
  Address: '445 Lancaster Dr NE, Salem',
  ZipCode: '97301',
  IsCatholic: true,
  CharityType: 'Food Security',
  ...over,
});

describe('schema 100: the verification columns', () => {
  it('adds IsVerified, VerifiedAt and VerifiedByMemberID to GlobalCharityRegistry', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(100);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toContain('const SCHEMA_VERSION = 100;');
    const schema = read('Schema.sql');
    expect(schema).toContain('ALTER TABLE [GlobalCharityRegistry] ADD [IsVerified] BIT NOT NULL DEFAULT 0;');
    expect(schema).toContain('ALTER TABLE [GlobalCharityRegistry] ADD [VerifiedAt] DATETIME NULL;');
    expect(schema).toContain('ALTER TABLE [GlobalCharityRegistry] ADD [VerifiedByMemberID] INTEGER NULL;');
    for (const generated of ['apps/web/services/generated/schema.generated.ts', 'apps/mobile/services/generated/schema.sqlite.ts']) {
      expect(read(generated)).toContain('VerifiedByMemberID');
    }
  });

  it('seeds four verified St. Mary\u2019s charities with sample EINs and one unverified', () => {
    const seed = read('Seed.sql');
    const block = seed.slice(seed.indexOf('INSERT INTO [GlobalCharityRegistry]'), seed.indexOf('INSERT INTO [CouncilCharityLink]'));
    expect(block).toContain('[IsVerified], [VerifiedAt], [VerifiedByMemberID]');
    expect(block.match(/'93-00001\d\d'/g)).toHaveLength(4);
    expect(block.match(/, 1, '20\d\d-\d\d-\d\d \d\d:\d\d:\d\d', 1\)/g)).toHaveLength(4);
    expect(block).toContain("'Mothers of Hope Transitional Housing'");
    expect(block).toMatch(/Mothers of Hope[^\n]*0, NULL, NULL\);/);
  });
});

describe('verified charities and the grant form auto-fill', () => {
  it('stamps and clears the verification mark', () => {
    const now = new Date('2026-10-25T15:30:00Z');
    expect(charityVerificationStamp(true, 7, now)).toEqual({ IsVerified: 1, VerifiedAt: '2026-10-25 15:30:00', VerifiedByMemberID: 7 });
    expect(charityVerificationStamp(false, 7, now)).toEqual({ IsVerified: 0, VerifiedAt: null, VerifiedByMemberID: null });
    expect(() => charityVerificationStamp('yes', 7, now)).toThrow(/verified must be true or false/);
  });

  it('lists the states with a verified charity and the verified charities of one state, A to Z', () => {
    const rows = [
      row(1, { Name: 'Zion Pantry', IsVerified: 1 }),
      row(2, { Name: 'Alpha Shelter', IsVerified: 1 }),
      row(3, { Name: 'Unverified Fund' }),
      row(4, { Name: 'Evergreen Youth', State: 'WA', IsVerified: 1 }),
      row(5, { Name: 'Idaho Only Unverified', State: 'ID' }),
    ];
    expect(verifiedCharityStates(rows)).toEqual(['OR', 'WA']);
    expect(verifiedCharitiesInState(rows, 'OR').map((c) => c.id)).toEqual([2, 1]);
    expect(verifiedCharitiesInState(rows, 'ID')).toEqual([]);
    expect(isVerifiedCharity(rows[0])).toBe(true);
    expect(isVerifiedCharity(rows[2])).toBe(false);
  });

  it('filters the registry search by verification', () => {
    const rows = [row(1, { IsVerified: 1 }), row(2)];
    expect(searchCharityRegistry(rows, cleanCharitySearchFilters({ verified: true })).map((c) => c.id)).toEqual([1]);
    expect(searchCharityRegistry(rows, cleanCharitySearchFilters({ verified: false })).map((c) => c.id)).toEqual([2]);
    expect(searchCharityRegistry(rows, cleanCharitySearchFilters({})).map((c) => c.id)).toEqual([1, 2]);
    expect(() => cleanCharitySearchFilters({ verified: 'yes' as unknown as boolean })).toThrow(/verified must be true or false/);
  });

  it('fills the form from a registry row', () => {
    const pantry = row(9, {
      Name: 'Parish Food Pantry',
      Description: 'Weekly groceries',
      EIN: '93-0000101',
      Phone: '503-555-0210',
      ContactName: 'Maria Santos',
      ContactEmail: 'pantry@example.org',
      Address: '5200 NE Alameda St, Portland',
      ZipCode: '97213',
      IsVerified: 1,
    });
    expect(charityGrantAutoFill(pantry)).toEqual({
      OrganizationName: 'Parish Food Pantry',
      OrgMission: 'Weekly groceries',
      MailingAddress: '5200 NE Alameda St, Portland, OR 97213',
      Is501c3: true,
      EIN: '93-0000101',
      ContactName: 'Maria Santos',
      ContactPhone: '503-555-0210',
      ContactEmail: 'pantry@example.org',
    });
    expect(charityGrantAutoFill(row(10)).Is501c3).toBe(false);
    expect(charityMailingAddress(row(11, { Address: '1 Main St', ZipCode: null }))).toBe('1 Main St, OR');
    expect(charityMailingAddress(row(12))).toBe('');
  });

  it('puts the cascading State and Organization dropdowns on the Propose Charity Grant form', () => {
    const page = read('apps/web/app/charities/propose/page.tsx');
    expect(page).toContain('db.charities.searchGlobalRegistry(user.memberId, { verified: true, limit: CHARITY_SEARCH_MAX_LIMIT })');
    expect(page).toContain('verifiedCharityStates(registry)');
    expect(page).toContain('verifiedCharitiesInState(registry, pickState)');
    expect(page).toContain('charityGrantAutoFill(charity ?? BLANK_CHARITY)');
    expect(page).toContain('Another organization (type it in)');
    // The State dropdown comes before the Organization dropdown, and both before the name field they fill.
    expect(page.indexOf('label="State"')).toBeLessThan(page.indexOf('label="Organization"'));
    expect(page.indexOf('label="Organization"')).toBeLessThan(page.indexOf('label="Organization or ministry name"'));
  });

  it('lets an Admin verify a registry entry on the Global Charities Registry page', () => {
    const page = read('apps/web/app/charities/registry/page.tsx');
    expect(page).toContain('db.charities.setCharityVerified(user.memberId, charity.id, verify)');
    expect(page).toContain("'Verified'");
  });
});

describe.each(drivers)('$name driver: charities.setCharityVerified', (d) => {
  it('lets an Admin verify and unverify, stamping who and when', async () => {
    const db = await d.make();
    const added = await db.charities.addGlobalCharity(MEMBER.admin, newCharity());
    expect(added.IsVerified).toBe(0);
    expect(added.VerifiedAt ?? null).toBeNull();

    const verified = await db.charities.setCharityVerified(MEMBER.admin, added.id, true);
    expect(verified).toMatchObject({ id: added.id, IsVerified: 1, VerifiedByMemberID: MEMBER.admin });
    expect(verified.VerifiedAt).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    // Setting the mark it already has changes nothing.
    expect(await db.charities.setCharityVerified(MEMBER.superAdmin, added.id, true)).toMatchObject({ VerifiedByMemberID: MEMBER.admin });

    expect((await db.charities.searchGlobalRegistry(MEMBER.member, { verified: true })).map((c) => c.id)).toEqual([added.id]);

    const cleared = await db.charities.setCharityVerified(MEMBER.superAdmin, added.id, false);
    expect(cleared).toMatchObject({ IsVerified: 0, VerifiedAt: null, VerifiedByMemberID: null });
    expect(await db.charities.searchGlobalRegistry(MEMBER.member, { verified: true })).toEqual([]);
  });

  it('refuses members, unknown charities and a non-boolean mark', async () => {
    const db = await d.make();
    const added = await db.charities.addGlobalCharity(MEMBER.admin, newCharity());
    await expectRule(db.charities.setCharityVerified(MEMBER.member, added.id, true), 'ADMIN_REQUIRED');
    await expectRule(db.charities.setCharityVerified(MEMBER.admin, 999_999, true), 'RECORD_NOT_FOUND');
    await expectRule(db.charities.setCharityVerified(MEMBER.admin, added.id, 'yes' as unknown as boolean), 'INVALID_INPUT');
    expect((await db.charities.searchGlobalRegistry(MEMBER.member)).find((c) => c.id === added.id)?.IsVerified).toBe(0);
  });

  it('never takes the verification columns from a registry write', async () => {
    const db = await d.make();
    await expectRule(db.charities.addGlobalCharity(MEMBER.admin, { ...newCharity(), IsVerified: 1 } as unknown as NewGlobalCharity), 'INVALID_INPUT');
  });
});

describe('the collapsible sidebar and the Council Photo Gallery node', () => {
  it('drops the Home link and moves the gallery out of the pillars', () => {
    const filed = PORTAL_NAV_GROUPS.flatMap((g) => g.items as readonly string[]);
    expect(filed).not.toContain('home');
    expect(filed).not.toContain('gallery');
  });

  it('pins the gallery node with its two views and a persistent hamburger toggle', () => {
    expect(COUNCIL_PHOTO_GALLERY_TITLE).toBe('📸 Council Photo Gallery');
    expect(GALLERY_VIEWS.map((v) => v.label)).toEqual(['Browse Albums', 'Gallery Management Center']);
    expect(galleryViewFromAnchor('#manage')).toBe('manage');
    expect(galleryViewFromAnchor('#browse')).toBe('browse');
    expect(galleryViewFromAnchor('')).toBe('browse');
    const sidebar = read('apps/web/components/Sidebar.tsx');
    expect(sidebar).toContain('<GalleryNode pathname={pathname} hash={hash} tenant={tenant} />');
    expect(sidebar).toContain('aria-expanded={!collapsed}');
    expect(sidebar).toContain('aria-controls="portal-sidebar-links"');
    expect(sidebar).toContain("const SIDEBAR_COLLAPSED_KEY = 'kofc.sidebarCollapsed';");
    // The toggle sits outside the hidden links, so it stays on screen when the sidebar is collapsed.
    expect(sidebar.indexOf('onClick={toggle}')).toBeLessThan(sidebar.indexOf('<div id="portal-sidebar-links" hidden={collapsed}'));
  });

  it('lists the gallery in the Navigation Guide as a pinned link', () => {
    const member = { memberId: 3, councilId: 1, memberType: 'Member' as const, isOfficer: false, roles: [] };
    expect(navigationGuide(member).pinned.map((e) => e.item)).toEqual(['gallery']);
    expect(navigationGuideMap(member).categories.flatMap((c) => c.entries.map((e) => e.item as string))).toContain('gallery');
  });

  it('splits the gallery into Browse Albums and the Gallery Management Center, drop zone above the tag fields', () => {
    const gallery = read('apps/web/components/modules/PhotoGallery.tsx');
    expect(gallery).toContain('<Tabs tabs={GALLERY_VIEWS} value={view} onChange={setView} label="Gallery views" idPrefix="gallery-view" />');
    expect(gallery).toContain("{view === 'browse' ? (");
    const upload = gallery.slice(gallery.indexOf('function UploadPhotos('));
    expect(upload.indexOf('Drag and drop photos here')).toBeLessThan(upload.indexOf('Tag these photos to'));
    const manage = gallery.slice(gallery.indexOf('aria-labelledby="gallery-view-tab-manage"'));
    expect(manage.indexOf('<UploadPhotos')).toBeLessThan(manage.indexOf('{albumsPanel(true)}'));
    // Only the management view saves or deletes albums.
    expect(gallery).toContain('{manage && canDeleteSmartAlbum(user, a) ? (');
    expect(gallery).toContain('label="Album name"');
  });
});

describe('the decluttered Grand Knight Desk and Executive Dashboard', () => {
  it('takes the Inbound Council Mail Center off the Grand Knight Desk', () => {
    const superAdmin = { memberId: 1, councilId: 1, memberType: 'Super Admin' as const, isOfficer: true, active: true, roles: ['Grand Knight'] };
    expect(deskDrawersFor(superAdmin, 'grand-knight', 1).map((d) => d.id as string)).not.toContain('access-requests');
    expect(read('apps/web/components/DashboardDesks.tsx')).not.toContain('InboundMailCenter');
  });

  it('stacks the roadmap, goals, trends and no-show audits in drawers under the primary metrics', () => {
    const page = read('apps/web/app/executive-dashboard/page.tsx');
    const summary = page.slice(page.indexOf('function ExecutiveSummary('));
    const drawers = summary.slice(summary.indexOf('aria-label="Executive Dashboard drawers"'));
    expect(summary.indexOf('<Scorecards s={s} compact />')).toBeLessThan(summary.indexOf('aria-label="Executive Dashboard drawers"'));
    for (const title of ['Annual Fraternal Roadmap', 'Annual Council Goals Progress Center', 'Year-over-Year Trends', 'No-Show Audits']) {
      expect(drawers).toContain(`title="${title}"`);
    }
    for (const body of ['<FraternalRoadmap', '<GoalsProgressCenter', '<YearOverYearTrends', '<NoShowAudit']) expect(drawers.indexOf(body)).toBeGreaterThan(-1);
    // A closed drawer mounts nothing.
    expect(page).toContain('{open ? <div className="border-t border-line p-4">{children}</div> : null}');
  });

  it('removes the Top 5 leaderboard, the shifts awaiting audit and the financial ledger grid', () => {
    const page = read('apps/web/app/executive-dashboard/page.tsx');
    expect(page).toContain('showLeaderboard={false}');
    expect(page).not.toContain('<AwaitingHours');
    expect(page).not.toContain('title="Financial ledger"');
    expect(read('apps/web/components/EngagementParts.tsx')).toContain('{showLeaderboard ? (');
    // The Council Dashboard keeps its leaderboard.
    expect(read('apps/web/app/member-center/page.tsx')).not.toContain('showLeaderboard={false}');
  });
});
