// Sprint 11 Revision 2.0 (schema 102, no table change): the Admin Desk, the Executive and Financial Dashboard calibration,
// the built-in broadcast lists, 'Message All Attendants', the gallery re-architecture, the text-only sidebar and the
// Council Lookups clean-up.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_DESK_DRAWERS,
  ADMIN_DESK_HREF,
  ADMIN_MANUAL,
  canBroadcastToDistributionGroups,
  canMessageEventAttendees,
  canOpenAdminDesk,
  CHECK_PAYMENT_ROW_POSITION,
  deskManual,
  eventAttendeeRecipientIds,
  GALLERY_BROWSE_TABS,
  GALLERY_SAVE_ALBUM_PLACEHOLDER,
  GALLERY_SAVE_ALBUM_TITLE,
  GALLERY_SELECTION_TITLE,
  GALLERY_VIEWS,
  isDeskManualKey,
  LEGAL_DOCUMENT_FILES,
  monthlyActivityFigures,
  nextNightlyManualRebuild,
  orderPaymentMethodRows,
  plainNavLabel,
  PORTAL_NAV_GROUPS,
  portalAreas,
  portalSidebar,
  type VolunteerTurnout,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

const seat = (memberType: 'Member' | 'Admin' | 'Super Admin', roles: string[] = []) => ({
  memberId: 7,
  councilId: 1,
  memberType,
  isOfficer: roles.length > 0,
  roles,
});

describe('1. the Admin Desk', () => {
  it('lists the eight drawers in the exact order', () => {
    expect(ADMIN_DESK_DRAWERS.map((d) => d.label)).toEqual([
      'Administration Manual PDF',
      "'How Do I...' Local Help Search",
      'Council Wide Settings',
      'Council Lookup Tables',
      'Credentials Vault',
      'Global Charities Registry',
      'Council Asset Management',
      'Administrative Feedback Loops',
    ]);
  });

  it('opens for Admins and Super Admins only, at the head of the System Settings pillar', () => {
    expect(canOpenAdminDesk(seat('Admin'))).toBe(true);
    expect(canOpenAdminDesk(seat('Super Admin'))).toBe(true);
    expect(canOpenAdminDesk(seat('Member', ['Grand Knight']))).toBe(false);
    expect(portalAreas(seat('Member'))).not.toContain('admin-desk');
    expect(PORTAL_NAV_GROUPS.find((g) => g.id === 'setup')?.items[0]).toBe('admin-desk');
    const setup = portalSidebar(seat('Admin')).find((g) => g.id === 'setup')!;
    expect(setup.entries[0]?.item).toBe('admin-desk');
    expect(ADMIN_DESK_HREF).toBe('/admin-desk');
    expect(read('apps/web/app/admin-desk/page.tsx')).toContain('<RequireArea area="admin-desk">');
  });

  it('lands with every drawer closed and opens a panel to the right of the rail', () => {
    const desk = read('apps/web/components/modules/AdminDesk.tsx');
    expect(desk).toContain('useState<AdminDeskDrawerId | null>(null)');
    expect(desk).toContain('lg:grid-cols-[18rem_minmax(0,1fr)]');
    for (const mount of [
      '<DeskManualHeader manual={ADMIN_MANUAL.token} show="pdf" />',
      '<DeskManualHeader manual={ADMIN_MANUAL.token} show="search" />',
      '<CouncilWideSettings embedded />',
      '<CouncilLookups embedded />',
      '<CredentialsVaultPanel homeCouncilOnly />',
      '<GlobalCharitiesRegistry embedded />',
      '<CouncilAssetInventory />',
      '<AdminFeedbackForm',
      'Regenerate Manuals On-Demand',
    ]) {
      expect(desk).toContain(mount);
    }
    // The pages keep their routes and mount the same modules.
    expect(read('apps/web/app/system-settings/council-settings/page.tsx')).toContain('<CouncilWideSettings />');
    expect(read('apps/web/app/council-lookups/page.tsx')).toContain('<CouncilLookups />');
    expect(read('apps/web/app/expenses/assets/page.tsx')).toContain('<CouncilAssets />');
  });

  it('serves the Administration Manual to Admins only and rebuilds every manual on demand and nightly', () => {
    expect(isDeskManualKey('admin')).toBe(true);
    expect(deskManual('admin')).toMatchObject({ markdown: 'ADMIN_USER_GUIDE.md', pdf: 'ADMIN_USER_GUIDE.pdf' });
    expect(ADMIN_MANUAL.title).toBe('Administration Manual');
    const route = read('apps/web/app/api/admin/regenerate-manuals/route.ts');
    expect(route).toContain("actor.memberType === 'Admin' || actor.memberType === 'Super Admin'");
    expect(route).toContain("regenerateAllManuals('on-demand')");
    const job = read('apps/web/services/server/manual-regeneration.ts');
    expect(job).toContain("join(root, 'scripts', 'compile_all_manuals.py')");
    expect(job).toContain('if (state.current) return state.current;');
    expect(read('apps/web/instrumentation.ts')).toContain('startNightlyManualRebuild();');
    expect(nextNightlyManualRebuild(new Date(2026, 9, 26, 1, 30))).toEqual(new Date(2026, 9, 26, 2, 0));
    expect(nextNightlyManualRebuild(new Date(2026, 9, 26, 2, 0))).toEqual(new Date(2026, 9, 27, 2, 0));
    expect(nextNightlyManualRebuild(new Date(2026, 9, 31, 23, 0))).toEqual(new Date(2026, 10, 1, 2, 0));
  });
});

describe('2. financial calibration and messaging perimeters', () => {
  it('feeds the Monthly Activity card and the Net Balance tile one set of figures', () => {
    const summary = {
      uniqueMembers: 6,
      laborHours: { events: 10, activities: 2.5, total: 12.5 },
      finances: { spend: 300, expenses: 250, charitableGiving: 50, cash: 400, electronic: 150.25, raised: 550.25, net: 250.25 },
    };
    expect(monthlyActivityFigures(summary)).toEqual({ volunteers: 6, hours: 12.5, raised: 550.25, spend: 300, net: 250.25 });
    const card = read('apps/web/components/EngagementParts.tsx');
    expect(card).toContain('const figures = monthlyActivityFigures(summary);');
    expect(card).not.toContain('summary.finances.cash');
    expect(read('apps/web/app/executive-dashboard/page.tsx')).toContain('const figures = monthlyActivityFigures(s);');
  });

  it('orders the Executive view: Monthly Activity, Faith in Action, Budget Tracking, and the No-Show Audit last', () => {
    const page = read('apps/web/app/executive-dashboard/page.tsx');
    const at = (text: string) => page.indexOf(text);
    expect(at('<EngagementCards')).toBeGreaterThan(-1);
    expect(at('<EngagementCards')).toBeLessThan(at('title="Faith in Action Mission Tracking"'));
    expect(at('title="Faith in Action Mission Tracking"')).toBeLessThan(at('<BudgetTracking actorId'));
    expect(at('<BudgetTracking actorId')).toBeLessThan(at('title="Annual Fraternal Roadmap"'));
    expect(at('Monthly highlights')).toBeLessThan(at('title="No-Show Audits"'));
  });

  it('strips the dues forecast and the YOY analyzer and drawers the budgeted vs. actual grid', () => {
    const page = read('apps/web/app/finance/dashboard/page.tsx');
    expect(page).not.toContain('<DuesForecastCard');
    expect(page).not.toContain('<BudgetAnalyzerCard');
    expect(page).toContain('<FinanceDrawer title="Budgeted vs. Current Actual Spend"');
  });

  it('keeps the built-in broadcast lists for officers, Admins and Super Admins', () => {
    expect(canBroadcastToDistributionGroups(seat('Member'))).toBe(false);
    expect(canBroadcastToDistributionGroups(seat('Member', ['Recorder']))).toBe(true);
    expect(canBroadcastToDistributionGroups(seat('Admin'))).toBe(true);
    expect(canBroadcastToDistributionGroups({ memberType: 'Member', officer: true })).toBe(true);
    expect(read('apps/mobile/app/(app)/messages/new.tsx')).toContain('canBroadcastToDistributionGroups(user) ? (');
  });

  it("mounts 'Message All Attendants' on the calendar event details", () => {
    const signup = (MemberID: number) => ({ signup: { MemberID } }) as unknown as VolunteerTurnout;
    expect(eventAttendeeRecipientIds([signup(9), signup(4), signup(9), signup(7)], 7)).toEqual([4, 9]);
    expect(canMessageEventAttendees(seat('Member'), { OwnerID: 7 })).toBe(true);
    expect(canMessageEventAttendees(seat('Member'), { OwnerID: 8 })).toBe(false);
    expect(canMessageEventAttendees(seat('Member', ['Warden']), { OwnerID: 8 })).toBe(true);
    const calendar = read('apps/web/app/calendar/page.tsx');
    expect(calendar).toContain('Message All Attendants');
    expect(calendar).toContain('<MessageAttendants councilId={user.councilId}');
  });
});

describe('3. the gallery', () => {
  it('renames the views and gives Browse Gallery its three tabs', () => {
    expect(GALLERY_VIEWS.map((v) => v.label)).toEqual(['📸 Browse Gallery', 'Gallery Administration Hub']);
    expect(GALLERY_BROWSE_TABS.map((t) => t.label)).toEqual(['Event/Meeting', 'Year', 'Album Picker']);
    expect(GALLERY_SELECTION_TITLE).toBe('Pick Selections for Album');
    expect(GALLERY_SAVE_ALBUM_TITLE).toBe('Save as Album');
    expect(GALLERY_SAVE_ALBUM_PLACEHOLDER).toBe('Saves selections you picked...');
  });

  it('puts the Save as Album form directly beneath the selection grid', () => {
    const gallery = read('apps/web/components/modules/PhotoGallery.tsx');
    const block = gallery.slice(gallery.indexOf('the selection grid, with the Save as Album form directly beneath it'));
    expect(block.indexOf('{selectionPanel}')).toBeGreaterThan(-1);
    expect(block.indexOf('{selectionPanel}')).toBeLessThan(block.indexOf('{albumsPanel(true)}'));
    expect(gallery).toContain('placeholder={GALLERY_SAVE_ALBUM_PLACEHOLDER}');
    expect(gallery).toContain('<AlbumPicker');
  });
});

describe('4. the sidebar and Council Lookups', () => {
  it('draws the sidebar as plain text with no icon glyphs', () => {
    expect(plainNavLabel('📸 Council Photo Gallery')).toBe('Council Photo Gallery');
    expect(plainNavLabel('🛠️ Council Asset Management')).toBe('Council Asset Management');
    expect(plainNavLabel('📂 Council Archive Vault')).toBe('Council Archive Vault');
    expect(plainNavLabel('📸 Browse Gallery')).toBe('Browse Gallery');
    expect(plainNavLabel("St. Mary's Council")).toBe("St. Mary's Council");
    const sidebar = read('apps/web/components/Sidebar.tsx');
    expect(sidebar).toContain('{plainNavLabel(whiteLabel(label, tenant))}');
    expect(sidebar).toContain('{plainNavLabel(whiteLabel(v.label, tenant))}');
    expect(sidebar).not.toContain('<span aria-hidden="true">↗</span>');
    expect(sidebar).not.toMatch(/>\s*⚖\s*</);
  });

  it('puts the Check payment method on row 3', () => {
    const rows = ['Cash', 'Credit Card', 'Venmo', 'Zelle', 'Check'].map((name) => ({ name }));
    expect(CHECK_PAYMENT_ROW_POSITION).toBe(3);
    expect(orderPaymentMethodRows(rows, (r) => r.name).map((r) => r.name)).toEqual(['Cash', 'Credit Card', 'Check', 'Venmo', 'Zelle']);
    expect(orderPaymentMethodRows([{ name: 'Check' }, { name: 'Cash' }], (r) => r.name).map((r) => r.name)).toEqual(['Cash', 'Check']);
    expect(orderPaymentMethodRows([{ name: 'Cash' }], (r) => r.name)).toEqual([{ name: 'Cash' }]);
  });

  it('drops the owner column and the election grid, which moved to the Election Center', () => {
    const lookups = read('apps/web/components/modules/CouncilLookupTables.tsx');
    expect(lookups).toContain("hidden: { fallback: DEFAULT_ACCOUNT_OWNER_ENTITY }");
    expect(lookups).not.toContain('ACCOUNT_OWNER_COLUMN_LABEL');
    expect(lookups).not.toContain("label: 'Officer Election Parameters'");
    expect(lookups).toContain('orderPaymentMethodRows(rows.data, methodName)');
    const elections = read('apps/web/components/modules/ElectionWorkflow.tsx');
    expect(elections).toContain("label: '⚙️ Officer Election Parameters'");
    expect(elections).toContain('db.elections.toggleRoleBallotStatus');
  });

  it('waits for the council before reading the registry and lists its verified charities first', () => {
    const registry = read('apps/web/components/modules/GlobalCharitiesRegistry.tsx');
    expect(registry).toContain('db.charities.searchGlobalRegistry(user.memberId, { state, verified: true })');
    expect(registry).toContain('const councilKnown = council !== undefined;');
    const fields = read('apps/web/components/CharityParts.tsx');
    for (const label of ['Description (optional)', 'Mailing address (optional)', 'ZIP code (optional)']) expect(fields).toContain(label);
  });

  it("reads the owner's own Terms and Privacy Policy", () => {
    expect(LEGAL_DOCUMENT_FILES).toEqual({ terms: 'legal/transformed_doc/TERMS_OF_SERVICE.md', privacy: 'legal/transformed_doc/PRIVACY_POLICY.md' });
  });
});

describe.each(drivers)('$name driver: Sprint 11 Revision 2.0', (d) => {
  it("fills a blank 'Account Name Members See' from the picked account", async () => {
    const db = await d.make();
    const councilId = (await db.members.get(MEMBER.admin))!.CouncilID;
    const owner = await db.councils.saveAccountOwner(MEMBER.admin, councilId, { account_name: 'Parish Giving Portal' });
    const row = (await db.lookups.listCouncilSpecific(MEMBER.admin, councilId, 'CouncilDonationMethod'))[0]!;
    const saved = await db.lookups.saveCouncilSpecific(MEMBER.admin, councilId, 'CouncilDonationMethod', [
      { id: row.id, DonationMethodID: row.DonationMethodID, DonationMethodURL: null, account_owner_entity: 'PARISH', account_identity_label: '', account_owner_id: owner.id, lookup_status: 'Active' },
    ]);
    expect(saved.find((r) => r.id === row.id)).toMatchObject({ account_identity_label: 'Parish Giving Portal', account_owner_id: owner.id });
  });

  it('refuses the built-in lists to a plain member and sends them for an officer', async () => {
    const db = await d.make();
    await expectRule(db.messages.send({ senderId: MEMBER.member, councilId: 1, distributionGroups: ['all_members'], text: 'Hello all.' }), 'ADMIN_REQUIRED');
    const sent = await db.messages.send({ senderId: MEMBER.admin, councilId: 1, distributionGroups: ['all_members'], text: 'Hello all.' });
    expect(sent.ThreadID).toBeGreaterThan(0);
  });
});
