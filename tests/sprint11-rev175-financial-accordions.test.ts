// Sprint 11 Revision 17.5: the Platform Management tab for every Super Admin, the Member Activities wording, the two
// Finances accordions (Financial Reports and Financial Actions) and the Charity Vetting Queue under Governance.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  dashboardTabsFor,
  FINANCIAL_ACTIONS_ACCORDION_TITLE,
  FINANCIAL_REPORTS_ACCORDION_TITLE,
  PORTAL_NAV_GROUPS,
  showsSuperAdminDeskTab,
} from '@kofc/shared';

const read = (path: string) => readFileSync(path, 'utf8');
const sidebar = read('apps/web/components/Sidebar.tsx');

describe('1. Platform Management on the Active Desks row', () => {
  const superAdmin = { memberId: 9, councilId: 1, memberType: 'Super Admin' as const, isOfficer: false, roles: [], username: 'any.super@kofc.org' };

  it('is drawn for every Super Admin session, right after Home, and never for an Admin', () => {
    expect(showsSuperAdminDeskTab(superAdmin)).toBe(true);
    expect(showsSuperAdminDeskTab({ memberType: 'Admin' })).toBe(false);
    expect(dashboardTabsFor(superAdmin, 1).map((t) => t.id).slice(0, 2)).toEqual(['home', 'super-admin']);
    // Alongside the council desks, on any council.
    expect(dashboardTabsFor(superAdmin, 2).map((t) => t.id)).toContain('grand-knight');
    expect(dashboardTabsFor({ ...superAdmin, memberType: 'Admin' }, 1).map((t) => t.id)).not.toContain('super-admin');
    expect(read('apps/web/components/SuperAdminDesk.tsx')).toContain('showsSuperAdminDeskTab(user)');
  });
});

describe('2. Member Activities wording', () => {
  it('renames the sidebar link, the page title and the first tab', () => {
    expect(sidebar).toContain("label: 'Member Activities'");
    expect(sidebar).not.toContain('Standalone Activities');
    const page = read('apps/web/app/activities/page.tsx');
    expect(page).toMatch(/>\s*Member Activities\s*<\/PageTitle>/);
    expect(page).toContain('label: `Current Activities (${activeCount})`');
  });
});

describe('3. Two Finances accordions and the vetting queue under Governance', () => {
  it('titles the two accordions', () => {
    expect(FINANCIAL_REPORTS_ACCORDION_TITLE).toBe('📊 FINANCIAL REPORTS');
    expect(FINANCIAL_ACTIONS_ACCORDION_TITLE).toBe('⚡ FINANCIAL ACTIONS');
  });

  it('fills each accordion with its own links, in order, and drops the Financial Views accordion', () => {
    // Sprint 11 Revision 17.6 added the Annual Budget Center and the Trustee Semiannual Audit; the exact lists are pinned there.
    expect(sidebar).toContain('FINANCIAL_REPORT_ITEMS');
    expect(sidebar).toContain('FINANCIAL_ACTION_ITEMS');
    expect(sidebar).toContain('title={FINANCIAL_REPORTS_ACCORDION_TITLE}');
    expect(sidebar).toContain('title={FINANCIAL_ACTIONS_ACCORDION_TITLE}');
    expect(sidebar).not.toContain('FinancialViewsAccordion');
    expect(sidebar).not.toContain('FINANCIAL_VIEWS_ACCORDION_TITLE');
  });

  it('moves the Charity Vetting Queue to Governance', () => {
    const group = (id: string) => PORTAL_NAV_GROUPS.find((g) => g.id === id)!.items as string[];
    expect(group('governance')).toContain('charities/vetting');
    expect(group('finances')).not.toContain('charities/vetting');
  });
});
