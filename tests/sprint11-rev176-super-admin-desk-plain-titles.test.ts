// Sprint 11 Revision 17.6: Super Admins hold full Admin Desk clearance, page titles / panel headings / notices read as
// plain words, My Expense Reports and Propose Charity Grant sit above the Finances accordions, and the Annual Budget
// Center and the Trustee Semiannual Audit (was Financial Inspections) move into the accordions.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  adminDeskDrawersFor,
  ADMIN_DESK_DRAWERS,
  ALL_FEATURES_ON,
  canAdministerCouncil,
  canOpenAdminDesk,
  FEATURE_FLAG_LABELS,
  plainTextPiece,
  plainTitle,
  PORTAL_NAV_GROUPS,
  portalAreas,
  STANDARD_SCREEN_NAMES,
} from '@kofc/shared';

const read = (path: string) => readFileSync(path, 'utf8');
const sidebar = read('apps/web/components/Sidebar.tsx');

describe('1. Super Admins on the Admin Desk', () => {
  const superAdmin = { memberId: 9, councilId: 1, memberType: 'Super Admin' as const, isOfficer: false, roles: [] };

  it('opens the desk, every drawer and every council the drawers work on', () => {
    expect(canOpenAdminDesk(superAdmin)).toBe(true);
    expect(portalAreas(superAdmin)).toContain('admin-desk');
    expect(adminDeskDrawersFor(ALL_FEATURES_ON)).toEqual(ADMIN_DESK_DRAWERS);
    // The drawers' own gate (settings, lookups, vault) admits a Super Admin on any council, not only the home one.
    for (const councilId of [1, 2, 99]) expect(canAdministerCouncil(superAdmin, councilId)).toBe(true);
    expect(read('apps/web/app/api/admin/regenerate-manuals/route.ts')).toContain("actor.memberType === 'Super Admin'");
  });
});

describe('2. Plain titles, headings and notices', () => {
  it('strips icons and brackets from a whole title, and from one piece of a longer one', () => {
    expect(plainTitle('[ 🚗 Open Shifts Needing Volunteers ] (3)')).toBe('Open Shifts Needing Volunteers (3)');
    expect(plainTitle('🔎 Semiannual Trustee Audit Desk (Form 1295)')).toBe('Semiannual Trustee Audit Desk (Form 1295)');
    expect(plainTextPiece('🔊 ')).toBe('');
    expect(plainTextPiece('Total: ')).toBe('Total: ');
    expect(plainTextPiece('[ 📥 My Charity Requests ] ')).toBe(' My Charity Requests ');
  });

  it('draws page titles, panel headings, notices, drawers and desk drawers through the clean-up', () => {
    const ui = read('apps/web/components/ui.tsx');
    expect(ui).toContain('<div className="flex-1">{plainText(children)}</div>');
    expect(ui).toContain('{plainTitle(title)}</h2>');
    expect(ui).toContain('<h1 className="font-serif text-2xl font-bold">{plainText(children)}</h1>');
    expect(read('apps/web/components/Drawer.tsx')).toContain('{plainTitle(title)}');
    expect(read('apps/web/components/DeskDrawers.tsx')).toContain('{plainTitle(spec.title)}');
    expect(read('apps/web/components/DuesParts.tsx')).toContain('{plainTitle(title)}');
    expect(read('apps/web/components/DashboardDesks.tsx')).toContain('{plainText(title)}');
    expect(read('apps/web/app/navigation-guide/page.tsx')).toContain('{plainTitle(title)}');
  });

  it('keeps no icon in the hand-typed headings', () => {
    const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const [file, heading] of [
      ['apps/web/components/EngagementParts.tsx', 'Top 5 Volunteers Leaderboard</h2>'],
      ['apps/web/components/QuarantineDesk.tsx', 'Flagged Hours Review Desk</h2>'],
      ['apps/web/components/KnowledgeArchiveParts.tsx', 'Operations Knowledge Vault · New Entry</h2>'],
      ['apps/web/components/AdvisoryInviteCard.tsx', '>{a.Title}</h2>'],
    ] as const) {
      const src = read(file);
      const line = src.split('\n').find((l) => l.includes(heading));
      expect(line, file).toBeDefined();
      expect(EMOJI.test(line!), file).toBe(false);
    }
  });
});

describe('3 and 4. The Finances pillar', () => {
  it('pins the two member links above both accordions', () => {
    expect(sidebar).toContain("FINANCE_PINNED_ITEMS: readonly PortalNavItem[] = ['expenses', 'charities/propose']");
    const fin = PORTAL_NAV_GROUPS.find((g) => g.id === 'finances')!.items;
    expect(fin.slice(0, 2)).toEqual(['expenses', 'charities/propose']);
  });

  it('files the budget under reports and the Trustee Semiannual Audit under actions', () => {
    expect(sidebar).toContain(
      "FINANCIAL_REPORT_ITEMS: readonly PortalNavItem[] = ['finance/ledger', 'finance/balance-sheet', 'finance/dashboard', 'financials/budget']",
    );
    expect(sidebar).toMatch(
      /FINANCIAL_ACTION_ITEMS: readonly PortalNavItem\[\] = \[\s*'finance\/treasurer-desk',\s*'expenses\/audit',\s*'expenses\/authorize',\s*'finance\/audit',\s*'expenses\/disbursements',\s*'charities\/queue',\s*'donations',\s*\]/,
    );
    // Every Finances link is either pinned or in an accordion: nothing loose.
    const fin = PORTAL_NAV_GROUPS.find((g) => g.id === 'finances')!.items;
    expect(fin).toHaveLength(2 + 4 + 7);
  });

  it('renames Financial Inspections everywhere it is drawn', () => {
    expect(STANDARD_SCREEN_NAMES['finance/audit']).toBe('Trustee Semiannual Audit');
    expect(FEATURE_FLAG_LABELS.feature_advanced_audits.label).toBe('Trustee Semiannual Audit');
    expect(sidebar).toContain("label: 'Trustee Semiannual Audit'");
    expect(read('apps/web/components/modules/TrusteeAuditDesk.tsx')).not.toContain('Financial Inspections');
  });
});
