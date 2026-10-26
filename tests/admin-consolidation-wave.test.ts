// Sprint 10 Revision 3.0 (schema stays 100): the unified roster with record keeping on /roster, the Council Wide Settings
// drawer panels, the Super Admin Desk infrastructure drawers, Admin-only impersonation and the read-only View As Member
// mirror, the Lump-Sum Financial Override row, the Supreme roster uploader on the Financial Secretary Desk and the
// Annual Budget Center with its Designated Budget Director row.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ANNUAL_BUDGET_CENTER_TITLE,
  ASSIGN_BUDGET_DIRECTOR_LABEL,
  assertMaySyncSupremeRoster,
  assertMayViewAsMember,
  canOpenViewAsMember,
  canSyncSupremeRoster,
  lumpSumMethodChoices,
  LUMP_SUM_OVERRIDE_MODES,
  mayViewAsMember,
  memberRosterManagedCouncilIds,
  PORTAL_NAV_GROUPS,
  portalAreas,
  rosterAllCouncilsLabel,
  SUPER_ADMIN_DESK_DRAWERS,
  type MemberWriteActor,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const writer = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({ memberId: 50, councilId: 1, memberType: 'Member', active: true, roles: [], ...over });
const viewer = (memberType: string, councilId = 1) => ({ memberId: 50, councilId, memberType: memberType as never, isOfficer: false, roles: [] as string[] });

describe('1. the unified roster', () => {
  it('removes the Affiliated Roster page and its area', () => {
    expect(existsSync(join(__dirname, '..', 'apps/web/app/members/page.tsx'))).toBe(false);
    expect(PORTAL_NAV_GROUPS.flatMap((g) => g.items as string[])).not.toContain('members');
    expect(portalAreas(viewer('Super Admin'))).not.toContain('members' as never);
    expect(read('apps/web/components/Sidebar.tsx')).not.toContain("href: '/members'");
  });

  it('keeps member records on /roster for Admins and Super Admins, with the Super Admin council picker back', () => {
    const roster = read('apps/web/components/modules/MemberRosterDirectory.tsx');
    expect(roster).toContain('Add Member');
    expect(roster).toContain("setEditing({ kind: 'edit', member: m })");
    expect(roster).toContain('canEditMember(user, m)');
    expect(roster).toContain('canCreateMembers(user, addTo)');
    expect(roster).toContain('rosterAllCouncilsLabel(data.scope)');
    expect(rosterAllCouncilsLabel('global')).toBe('All councils on the platform');
    expect(rosterAllCouncilsLabel('fraternal')).toBe('All: my council and sister councils');
  });

  it('widens the rows to every status only for councils the reader administers', () => {
    expect(memberRosterManagedCouncilIds({ memberType: 'Super Admin' }, 1, [1, 2, 3])).toEqual([1, 2, 3]);
    expect(memberRosterManagedCouncilIds({ memberType: 'Admin' }, 1, [1, 2])).toEqual([1]);
    expect(memberRosterManagedCouncilIds({ memberType: 'Admin', active: false }, 1, [1, 2])).toEqual([]);
    expect(memberRosterManagedCouncilIds({ memberType: 'Member' }, 1, [1, 2])).toEqual([]);
  });

  it('clears the Budget Director checkbox off the record form', () => {
    const form = read('apps/web/components/modules/MemberRecordForm.tsx');
    expect(form).not.toContain('setDirector');
    expect(form).not.toContain('IsBudgetDirector: budgetDirector');
  });
});

describe('2. Council Wide Settings drawers', () => {
  it('mounts the settings as drawer panels with no revenue splits tab or reference archives', () => {
    const page = read('apps/web/components/modules/CouncilWideSettings.tsx');
    expect(page).toContain('<SettingsDrawers');
    expect(page).not.toContain('<SettingsCabinet');
    expect(read('apps/web/components/FeatureDeploymentParts.tsx')).not.toContain('SYSTEM_REFERENCE_PAGES');
  });
});

describe('3. Super Admin Desk infrastructure drawers', () => {
  it('names the four drawers in order', () => {
    expect(SUPER_ADMIN_DESK_DRAWERS.map((d) => d.label)).toEqual(['Global System Parameters', 'Global Lookup Tables', 'Global Charities Registry', 'Credentials Vault']);
  });

  it('pins the Credentials Vault drawer to the home council', () => {
    const desk = read('apps/web/components/SuperAdminDesk.tsx');
    expect(desk).toContain('<CredentialsVaultPanel homeCouncilOnly />');
    expect(desk).toContain('<GlobalLookupTables embedded />');
    expect(desk).toContain('<GlobalCharitiesRegistry embedded />');
    expect(desk).toContain('<GlobalParametersCard />');
    const vault = read('apps/web/components/modules/CredentialsVaultPanel.tsx');
    expect(vault).toContain('const councilId = homeCouncilOnly ? user.councilId : scope.councilId;');
  });
});

describe('4. View As Member', () => {
  it('opens to council Admins and Super Admins, inside their own council only', () => {
    expect(canOpenViewAsMember(viewer('Admin'))).toBe(true);
    expect(canOpenViewAsMember(viewer('Super Admin'))).toBe(true);
    expect(canOpenViewAsMember(viewer('Member'))).toBe(false);
    expect(mayViewAsMember({ councilId: 1, memberType: 'Admin' }, { councilId: 1 })).toBe(true);
    expect(mayViewAsMember({ councilId: 1, memberType: 'Admin' }, { councilId: 2 })).toBe(false);
    expect(mayViewAsMember({ councilId: 1, memberType: 'Super Admin' }, { councilId: 2 })).toBe(false);
    expect(() => assertMayViewAsMember(writer({ memberType: 'Admin' }), { memberId: 9, councilId: 1 })).not.toThrow();
    expect(() => assertMayViewAsMember(writer({ memberType: 'Admin' }), { memberId: 9, councilId: 2 })).toThrow(/own council/);
    expect(() => assertMayViewAsMember(writer({ memberType: 'Super Admin' }), { memberId: 9, councilId: 2 })).toThrow(/own council/);
    expect(() => assertMayViewAsMember(writer(), { memberId: 9, councilId: 1 })).toThrow(/council Admin/);
    expect(read('apps/web/app/system-settings/view-as-member/page.tsx')).toContain('<RequireArea area="system-settings/view-as-member">');
  });

  it('never swaps a session token', () => {
    const mirror = read('apps/web/components/modules/ViewAsMemberMirror.tsx');
    expect(mirror).toContain('db.members.getViewAsMirror(user.memberId, memberId)');
    expect(mirror).not.toContain('impersonate(');
    expect(mirror).not.toContain('useSession');
  });
});

describe('5. the Lump-Sum Financial Override', () => {
  it('offers cash methods for a cash bag and card or QR methods for an electronic block', () => {
    const options = [
      { kind: 'cash' as const, id: 1 },
      { kind: 'card' as const, id: 2 },
      { kind: 'qr' as const, id: 3 },
      { kind: 'check' as const, id: 8 },
    ];
    expect(lumpSumMethodChoices(options, 'cash-bag').map((o) => o.id)).toEqual([1]);
    expect(lumpSumMethodChoices(options, 'electronic-block').map((o) => o.id)).toEqual([2, 3]);
    expect(LUMP_SUM_OVERRIDE_MODES.map((m) => m.label)).toEqual(['Corrected cash bag count', 'Bulk electronic revenue block']);
  });

  it('sits in the batch coder, and the dashboard drops the revenue card and bank statement table', () => {
    const coder = read('apps/web/components/CashAuditParts.tsx');
    expect(coder).toContain('<LumpSumOverrideRow');
    expect(coder).toContain('db.finance.logConcludedRevenue(user.memberId, councilId, {');
    const dashboard = read('apps/web/app/finance/dashboard/page.tsx');
    expect(dashboard).not.toContain('<ConcludedRevenueCard');
    expect(dashboard).not.toContain('<BankStatementUploader');
  });
});

describe('6. the Supreme roster uploader and the Annual Budget Center', () => {
  it('lets the council Financial Secretary, Admins and Super Admins sync the roster', () => {
    expect(() => assertMaySyncSupremeRoster(writer({ roles: ['Financial Secretary'] }), 1)).not.toThrow();
    expect(() => assertMaySyncSupremeRoster(writer({ roles: ['Financial Secretary'] }), 2)).toThrow();
    expect(() => assertMaySyncSupremeRoster(writer({ roles: ['Financial Secretary'], active: false }), 1)).toThrow();
    expect(() => assertMaySyncSupremeRoster(writer({ memberType: 'Admin' }), 1)).not.toThrow();
    expect(() => assertMaySyncSupremeRoster(writer(), 1)).toThrow();
    expect(canSyncSupremeRoster({ ...viewer('Member'), roles: ['Financial Secretary'] }, 1)).toBe(true);
    expect(canSyncSupremeRoster(viewer('Member'), 1)).toBe(false);
  });

  it('moves the uploader onto the Financial Secretary Desk only', () => {
    expect(read('apps/web/components/DashboardDesks.tsx')).toContain('<SupremeRosterUploader councilId={councilId} />');
    expect(read('apps/web/app/supreme-sync/page.tsx')).not.toContain('syncSupremeRoster');
  });

  it('renames the budget page and adds the Budget Director row', () => {
    expect(ANNUAL_BUDGET_CENTER_TITLE).toBe('Annual Budget Center');
    expect(ASSIGN_BUDGET_DIRECTOR_LABEL).toBe('Assign Designated Budget Director');
    const center = read('apps/web/components/AnnualBudgetCenter.tsx');
    expect(center).toContain('export function AnnualBudgetCenter()');
    expect(center).toContain('<BudgetDirectorAssignment councilId={councilId} />');
    expect(center).toContain('{ IsBudgetDirector: 1 }');
    expect(read('apps/web/app/budget/page.tsx')).toContain('<AnnualBudgetCenter />');
    expect(read('apps/web/components/Sidebar.tsx')).toContain("label: 'Annual Budget Center'");
  });
});

describe.each(drivers)('$name driver: Revision 3.0 member methods', ({ make }) => {
  it('mirrors a member of the Admin’s own council and refuses anyone else', async () => {
    const db = await make();
    const admin = (await db.members.get(MEMBER.admin))!;
    const mirror = await db.members.getViewAsMirror(MEMBER.admin, MEMBER.member);
    expect(mirror.member.id).toBe(MEMBER.member);
    expect(mirror.council?.id).toBe(admin.CouncilID);
    await expectRule(db.members.getViewAsMirror(MEMBER.member, MEMBER.admin), 'ADMIN_REQUIRED');
    const councils = await db.councils.list();
    const other = councils.find((c) => c.id !== admin.CouncilID);
    if (other) {
      const outsider = (await db.members.listByCouncil(other.id))[0];
      if (outsider) {
        await expectRule(db.members.getViewAsMirror(MEMBER.admin, outsider.id), 'COUNCIL_ACCESS_DENIED');
        // A Super Admin is held to their own home council too.
        if ((await db.members.get(MEMBER.superAdmin))!.CouncilID !== outsider.CouncilID) {
          await expectRule(db.members.getViewAsMirror(MEMBER.superAdmin, outsider.id), 'COUNCIL_ACCESS_DENIED');
        }
      }
    }
    await expectRule(db.members.getViewAsMirror(MEMBER.admin, 999_999), 'MEMBER_NOT_FOUND');
  });

  it('lists every status for the Admin’s own council only when asked, and never for a plain member', async () => {
    const db = await make();
    const admin = (await db.members.get(MEMBER.admin))!;
    const statuses = await db.lookups.list('MemberStatus');
    const inactive = statuses.find((s) => s.Status === 'Inactive')!;
    const target = (await db.members.listByCouncil(admin.CouncilID, { activeOnly: true })).find((m) => m.id !== MEMBER.admin && m.id !== MEMBER.member && m.id !== MEMBER.superAdmin)!;
    await db.members.update(MEMBER.admin, target.id, { StatusID: inactive.id });
    const full = await db.members.listRoster(MEMBER.admin, { allStatuses: true });
    expect(full.members.some((m) => m.id === target.id)).toBe(true);
    expect((await db.members.listRoster(MEMBER.admin)).members.some((m) => m.id === target.id)).toBe(false);
    expect((await db.members.listRoster(MEMBER.member, { allStatuses: true })).members.some((m) => m.id === target.id)).toBe(false);
  });
});
