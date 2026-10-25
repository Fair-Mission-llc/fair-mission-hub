// Sprint 10 Revision 2.0: the Member Roster directory - its sidebar link under Faith In Action, the scope rule
// (home council and affiliated councils, or every council for a Super Admin with no council picker), members.listRoster
// in every driver, and its mounts on the Member, Grand Knight and Financial Secretary Desks.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  filterRosterMembers,
  memberRosterCouncilIds,
  memberRosterScope,
  PORTAL_NAV_GROUPS,
  portalAreas,
  portalSidebar,
  rosterShowsCouncilPicker,
  type Actor,
  type Member,
} from '@kofc/shared';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const actor = (over: Partial<Actor> = {}): Actor => ({ memberId: 9, councilId: 1, memberType: 'Member', isOfficer: false, roles: [], ...over }) as Actor;

describe('Member Roster link', () => {
  it('heads the Faith In Action pillar', () => {
    expect(PORTAL_NAV_GROUPS.find((g) => g.id === 'faith')!.items[0]).toBe('roster');
  });

  it('shows to every signed-in member, officer, Admin and Super Admin', () => {
    for (const u of [actor(), actor({ isOfficer: true, roles: ['Grand Knight'] }), actor({ memberType: 'Admin' }), actor({ memberType: 'Super Admin' })]) {
      expect(portalAreas(u)).toContain('roster');
      expect(portalSidebar(u).find((g) => g.id === 'faith')!.entries[0].item).toBe('roster');
    }
  });

  it('has its page and sidebar entry', () => {
    expect(read('apps/web/app/roster/page.tsx')).toContain('<RequireArea area="roster">');
    expect(read('apps/web/components/Sidebar.tsx')).toMatch(/roster: \{ href: '\/roster', label: 'Member Roster'/);
  });
});

describe('roster scope', () => {
  it('is global only for an Active Super Admin', () => {
    expect(memberRosterScope({ memberType: 'Super Admin' })).toBe('global');
    expect(memberRosterScope({ memberType: 'Super Admin', active: false })).toBe('fraternal');
    for (const t of ['Member', 'Admin', null]) expect(memberRosterScope({ memberType: t })).toBe('fraternal');
  });

  it('offers the council picker on every list, the Super Admin global list included (Sprint 10 Revision 3.0)', () => {
    expect(rosterShowsCouncilPicker('global')).toBe(true);
    expect(rosterShowsCouncilPicker('fraternal')).toBe(true);
  });

  it('covers the home council and its affiliated councils, or every council', () => {
    expect(memberRosterCouncilIds('fraternal', 1, [3], [1, 2, 3, 4])).toEqual([1, 3]);
    expect(memberRosterCouncilIds('global', 1, [3], [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });

  it('filters by council and by name or number', () => {
    const m = (id: number, CouncilID: number, first: string, last: string, MemberNumber: number) => ({ id, CouncilID, MemberFirstName: first, MemberLastName: last, MemberNumber }) as Member;
    const rows = [m(1, 1, 'Tom', 'Able', 100), m(2, 2, 'Sam', 'Baker', 200)];
    expect(filterRosterMembers(rows, 2, '').map((r) => r.id)).toEqual([2]);
    expect(filterRosterMembers(rows, null, 'able').map((r) => r.id)).toEqual([1]);
    expect(filterRosterMembers(rows, null, '200').map((r) => r.id)).toEqual([2]);
  });
});

describe.each(drivers)('members.listRoster ($name driver)', ({ make }) => {
  it('gives a member only their home council and its affiliated councils', async () => {
    const db = await make();
    const me = (await db.members.get(MEMBER.member))!;
    const sisters = (await db.councils.listAffiliated(me.CouncilID)).map((c) => c.id);
    const roster = await db.members.listRoster(MEMBER.member);
    expect(roster.scope).toBe('fraternal');
    expect(roster.councils[0].id).toBe(me.CouncilID);
    expect(new Set(roster.councils.map((c) => c.id))).toEqual(new Set([me.CouncilID, ...sisters]));
    const allowed = new Set([me.CouncilID, ...sisters]);
    expect(roster.members.length).toBeGreaterThan(0);
    expect(roster.members.every((m) => allowed.has(m.CouncilID))).toBe(true);
  });

  it('gives a Super Admin every Active member of every council', async () => {
    const db = await make();
    const roster = await db.members.listRoster(MEMBER.superAdmin);
    const councils = await db.councils.list();
    expect(roster.scope).toBe('global');
    expect(new Set(roster.councils.map((c) => c.id))).toEqual(new Set(councils.map((c) => c.id)));
    let active = 0;
    for (const c of councils) active += (await db.members.listByCouncil(c.id, { activeOnly: true })).length;
    expect(roster.members).toHaveLength(active);
    const names = roster.members.map((m) => `${m.MemberLastName}|${m.MemberFirstName}`);
    expect([...names].sort((a, b) => a.split('|')[0].localeCompare(b.split('|')[0]) || a.split('|')[1].localeCompare(b.split('|')[1]))).toEqual(names);
  });

  it('refuses an unknown actor', async () => {
    const db = await make();
    await expectRule(db.members.listRoster(999_999), 'MEMBER_NOT_FOUND');
  });
});

describe('desk mounts', () => {
  it('puts the directory on the Member, Grand Knight and Financial Secretary Desks only', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    const body = (name: string, next: string) => desks.slice(desks.indexOf(`export function ${name}`), desks.indexOf(`export function ${next}`));
    for (const [desk, next] of [
      ['GrandKnightDesk', 'FinancialSecretaryDesk'],
      ['FinancialSecretaryDesk', 'TreasurerDesk'],
      ['MemberDesk', 'AwaitingHours'],
    ]) {
      expect(body(desk, next)).toContain('<MemberRosterDirectory compact />');
    }
    expect(body('TreasurerDesk', 'MemberDesk')).not.toContain('MemberRosterDirectory');
  });

  it('shows the same directory on the Fraternal roster tab', () => {
    expect(read('apps/web/components/VolunteerCenter.tsx')).toContain("tab === 'roster' ? <MemberRosterDirectory />");
  });
});
