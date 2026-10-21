// Sprint 8S Revision 7 (schema version 97): the Left Dual-Cabinet Rail on every officer desk (a flat left filing spine
// led by the Dynamic Priority Float, with Inbound and Outbound cabinets on the Financial Secretary and Treasurer Desks),
// the role-scoped global search guard, the Collect / Recurring Meetings wording and the pilot kit's Treasurer flow media.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CABINET_DESKS,
  DESK_CABINET_LABELS,
  DESK_DRAWERS,
  deskDrawersFor,
  deskSpineSections,
  GLOBAL_SEARCH_RESTRICTED_PREFIXES,
  isRestrictedSearchPage,
  isSearchClearedPage,
  navigationGuideMap,
  PHONE_TABS,
  PRIORITY_FLOAT_LABEL,
  portalAreas,
  searchGlobal,
  ALL_FEATURES_ON,
  type DeskDrawerSpec,
  type GlobalSearchPage,
} from '@kofc/shared';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const seat = (roles: string[], memberType: 'Member' | 'Admin' | 'Super Admin' = 'Member', memberId = 7) => ({ memberId, councilId: OWN, memberType, isOfficer: roles.length > 0, roles });
const ids = (specs: readonly DeskDrawerSpec[]) => specs.map((d) => d.id);

describe('the left filing spine', () => {
  it('files every Financial Secretary and Treasurer drawer in exactly one cabinet, and no other desk uses cabinets', () => {
    expect(CABINET_DESKS).toEqual(['financial-secretary', 'treasurer']);
    for (const d of DESK_DRAWERS) {
      if (CABINET_DESKS.includes(d.desk)) expect(['inbound', 'outbound']).toContain(d.cabinet);
      else expect(d.cabinet).toBeUndefined();
    }
    expect(DESK_CABINET_LABELS).toEqual({ inbound: '[ 📥 Inbound Operations ]', outbound: '[ 📤 Outbound Operations ]' });
  });

  it('stacks the Treasurer Desk as Inbound then Outbound, with nothing floated while no folder is lit', () => {
    const drawers = deskDrawersFor(seat(['Treasurer']), 'treasurer', OWN);
    const sections = deskSpineSections('treasurer', drawers);
    expect(sections.map((s) => s.id)).toEqual(['inbound', 'outbound']);
    expect(sections.map((s) => s.label)).toEqual([DESK_CABINET_LABELS.inbound, DESK_CABINET_LABELS.outbound]);
    expect(ids(sections[0].drawers)).toEqual(expect.arrayContaining(['ledger-coder', 'cash-box-audit', 'batch-coder', 'bank-match']));
    expect(ids(sections[1].drawers)).toEqual(expect.arrayContaining(['er-settlement', 'charity-matches', 'parish-split']));
    expect(sections.flatMap((s) => s.drawers)).toHaveLength(drawers.length);
  });

  it('floats every lit folder to the top of the spine, in display order, and never repeats it in its cabinet', () => {
    const drawers = deskDrawersFor(seat(['Financial Secretary']), 'financial-secretary', OWN);
    const lit = new Set(['charity-checks', 'payment-requests']);
    const sections = deskSpineSections('financial-secretary', drawers, (d) => lit.has(d.id));
    expect(sections[0]).toMatchObject({ id: 'priority', label: PRIORITY_FLOAT_LABEL });
    expect(ids(sections[0].drawers)).toEqual(['payment-requests', 'charity-checks']);
    const rest = sections.slice(1).flatMap((s) => ids(s.drawers));
    expect(rest).not.toContain('payment-requests');
    expect(rest).not.toContain('charity-checks');
    expect(sections.flatMap((s) => s.drawers)).toHaveLength(drawers.length);
  });

  it('lists a lean desk flat under the float, with the featured Minutes Archive first', () => {
    const drawers = deskDrawersFor(seat(['Recorder']), 'recorder', OWN);
    expect(deskSpineSections('recorder', drawers).map((s) => [s.id, s.label])).toEqual([['folders', '']]);
    const lit = deskSpineSections('recorder', drawers, (d) => d.id === 'minutes-entry');
    expect(lit.map((s) => s.id)).toEqual(['priority', 'folders']);
    expect(lit[1].drawers[0].id).toBe('minutes-archive');
  });

  it('draws the console as a 25/75 split with flat lists and the red float', () => {
    const blotter = read('apps/web/components/DeskDrawers.tsx');
    expect(blotter).toContain("md:grid-cols-[1fr_3fr]");
    expect(blotter).toContain('deskSpineSections(desk, drawers');
    expect(blotter).toContain("section.id === 'priority' && 'rounded border-4 border-brand-red");
    expect(blotter).not.toContain('<details');
    expect(blotter).not.toContain('fixed inset-0');
  });
});

describe('the role-scoped search guard', () => {
  const pages: GlobalSearchPage[] = [
    { label: 'General Ledger', hint: 'Ledger entries', href: '/finance/ledger' },
    { label: 'Bulk Check Payments Made', hint: 'Pay ledger sheets by check', href: '/expenses/disbursements' },
    { label: 'Council Wide Settings', hint: 'Ledger windows and limits', href: '/system-settings/council-settings' },
    { label: 'Annual Budget Projections', hint: 'Budget ledger lines', href: '/budget' },
  ];
  const labels = (areas: ReadonlySet<string>) => searchGlobal('ledger', { pages, areas }).filter((h) => h.kind === 'Page').map((h) => h.label);

  it('marks the finance, payables and configuration pages restricted, and leaves the budget open', () => {
    for (const href of ['/finance/ledger', '/finance/balance-sheet', '/expenses/disbursements', '/expenses/audit', '/donations', '/system-settings/global-settings', '/lookups', '/credentials-vault', '/feature-flags']) {
      expect(isRestrictedSearchPage(href)).toBe(true);
    }
    for (const href of ['/budget', '/expenses', '/calendar', '/ledger', '/dashboard#home', '/financial']) expect(isRestrictedSearchPage(href)).toBe(false);
    expect(GLOBAL_SEARCH_RESTRICTED_PREFIXES).not.toContain('/budget');
  });

  it("hides restricted pages a plain member's mask does not clear, even when a caller passes them in", () => {
    const areas = new Set<string>(portalAreas(seat([])));
    expect(labels(areas)).toEqual(['Annual Budget Projections']);
    expect(isSearchClearedPage('/finance/ledger', areas)).toBe(false);
  });

  it("shows each restricted page only to the seats whose own mask clears it", () => {
    const treasurer = new Set<string>(portalAreas(seat(['Treasurer'])));
    expect(labels(treasurer)).toEqual(expect.arrayContaining(['General Ledger', 'Bulk Check Payments Made', 'Annual Budget Projections']));
    const superAdmin = new Set<string>(portalAreas(seat([], 'Super Admin')));
    expect(labels(superAdmin)).toEqual(expect.arrayContaining(['General Ledger', 'Council Wide Settings']));
  });

  it('passes the reader mask from the header search on every query', () => {
    expect(read('apps/web/components/GlobalSearch.tsx')).toMatch(/memberHref: areas\.has\('members'\) \? '\/members' : undefined,\s+areas,/);
  });
});

describe('the Collect and Recurring Meetings wording', () => {
  it('names the phone tab Collect and its primary button Start collecting for event', () => {
    expect(PHONE_TABS).toEqual(['Home', 'Mtgs', 'Signup', 'Report', 'Collect']);
    expect(read('apps/mobile/app/(app)/_layout.tsx')).toContain("tab('Collect', 'donate')");
    expect(read('apps/mobile/app/(app)/donate.tsx')).toContain('<Button title="Start collecting for event"');
    expect(navigationGuideMap(seat([]), ALL_FEATURES_ON).phoneTabs.map((t) => t.tab)).toContain('Collect');
    for (const guide of ['docs/ADMIN_USER_GUIDE.md', 'docs/MEMBER_USER_GUIDE.md']) expect(read(guide)).not.toContain('**Donate** tab');
  });

  it('titles the cadence page Recurring Meetings everywhere a reader sees it', () => {
    expect(read('apps/web/app/meetings/cadence/page.tsx')).toContain('>Recurring Meetings</PageTitle>');
    expect(read('apps/web/components/Sidebar.tsx')).toContain("label: 'Recurring Meetings',");
    for (const file of ['docs/ADMIN_USER_GUIDE.md', 'docs/ROLE_PERMISSIONS_MATRIX.md', 'scripts/pilot_kit_pdf.py', 'packages/shared/src/council-settings.ts']) {
      const text = read(file);
      for (const old of ['Meeting Cadence', 'Annual Cadence Manager', 'Cadence Engine']) expect(text).not.toContain(old);
    }
  });
});

describe('the pilot kit', () => {
  const kit = read('scripts/pilot_kit_pdf.py');

  it("drops the Historian's Charter Member step, which needed the facilitator's Admin sign-in on his laptop (Sprint 8S Revision 10)", () => {
    expect(kit).not.toContain('Charter Member badge. Only a council Admin may mark a charter member');
    expect(kit).not.toContain('tick Charter member and save');
  });

  it("draws the Treasurer's Revenue Split lifecycle and the inferred-budget training notes", () => {
    expect(kit).toContain('class LedgerFlowDiagram(Flowable)');
    expect(kit).toContain('Graphical Ledger Flow Diagram: the Revenue Split lifecycle');
    for (const stage of ["('Gross Cash Box'", "('Parish Split GL Line'", "('Church Disbursement Request'", "('Split Check Settlement'"]) expect(kit).toContain(stage);
    expect(kit).toContain('so the same money is never entered twice');
    expect(kit).not.toContain('4900');
  });
});
