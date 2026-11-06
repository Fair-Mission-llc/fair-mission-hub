// Sprint 11 Revision 21.7 (schema 113 unchanged): Secular Charity Corp and its two chapters in the seed, the Master
// Feature Deployment Grid's parent organization dropdown and pinned header, the Council History tabs with charter
// members and ledger-computed year totals, and the Admin Desk's standard drawers, pinned rail and Sample Code QR badge.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COUNCIL_HISTORY_TABS,
  COUNCIL_HISTORY_TITLE,
  currentFraternalYear,
  EDIT_FOUNDING_INFO_LABEL,
  FEATURE_FLAG_LABELS,
  PLATFORM_SCHEMA_VERSION,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { drivers, MEMBER, NOW, rawInsert } from './helpers';

const read = (path: string) => readFileSync(path, 'utf8');

describe('0. schema', () => {
  it('stays at 113', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(113);
  });
});

describe('1. Secular Charity Corp in the seed', () => {
  it('adds the parent organization and two chapters to the presentation data', async () => {
    const db = new MemoryDataService({ now: () => new Date(NOW), presentationData: true });
    await db.init();
    const orgs = await db.parentOrganizations.list();
    const corp = orgs.find((o) => o.org_name === 'Secular Charity Corp');
    expect(corp).toMatchObject({ id: 3, org_code: 'SECULAR_CHARITY_CORP', vertical_type: 'SECULAR_NONPROFIT' });
    const councils = await db.councils.list();
    const chapters = councils.filter((c) => c.CouncilName.startsWith('Secular Charity Chapter'));
    expect(chapters.map((c) => [c.id, c.CouncilName, c.parent_organization, c.tenant_type])).toEqual([
      [10, 'Secular Charity Chapter 1', 'SECULAR_CHARITY_CORP', 'GENERIC'],
      [11, 'Secular Charity Chapter 2', 'SECULAR_CHARITY_CORP', 'GENERIC'],
    ]);
    for (const c of chapters) expect(await db.parentOrganizations.resolveForCouncil(c.id)).toBe(3);
    // Cross-tenant separation: no Knights council maps to the new org, and the chapters own no members.
    const mappings = await db.parentOrganizations.listMappings();
    expect(mappings.filter((m) => m.parent_org_id === 3).map((m) => m.council_id)).toEqual([10, 11]);
    expect(await db.members.listByCouncil(10)).toEqual([]);
    expect(await db.members.listByCouncil(11)).toEqual([]);
  });

  it('keeps the baseline seed unchanged', () => {
    const seed = read('Seed.sql');
    expect(seed.indexOf("'Secular Charity Corp'")).toBeGreaterThan(seed.indexOf('-- @presentation-data'));
  });
});

describe('2. the Master Feature Deployment Grid', () => {
  const grid = read('apps/web/components/FeatureFlagParts.tsx');
  it('picks the parent organization tier from a dropdown, named from ParentOrganizations', () => {
    expect(grid).not.toContain('role="tablist"');
    expect(grid).toContain('<Select id={id} value={node.id}');
    expect(grid).toContain('db.parentOrganizations.list()');
  });
  it('pins the header row and renames column 2', () => {
    expect(grid).toContain("TABLE_HEADER_STICKY_STYLE: CSSProperties = { position: 'sticky', top: 0, zIndex: 40 }");
    expect(grid).toContain('<thead style={TABLE_HEADER_STICKY_STYLE}>');
    expect(grid).toContain("TIER_TOGGLE_COLUMN_HEADER = 'TOGGLE ALL MODULES FOR THIS ORGANIZATIONAL TIER'");
  });
});

describe('3. Council History', () => {
  it('renames the page, the sidebar link and the switch', () => {
    expect(COUNCIL_HISTORY_TITLE).toBe('Council History');
    expect(FEATURE_FLAG_LABELS.feature_council_history.label).toBe('Council History');
    expect(read('apps/web/components/Sidebar.tsx')).toContain("label: 'Council History'");
    expect(read('apps/web/app/history/page.tsx')).toContain('<PageTitle>{COUNCIL_HISTORY_TITLE}</PageTitle>');
  });

  it('has four tabs and an always-shown Edit Founding Info button', () => {
    expect(COUNCIL_HISTORY_TABS.map((t) => t.label)).toEqual(['Founding Charter', 'Oral History & Diaries', 'In Memoriam', 'Fraternal Year Summaries']);
    expect(EDIT_FOUNDING_INFO_LABEL).toBe('[ Edit Founding Info ]');
    const page = read('apps/web/app/history/page.tsx');
    expect(page).toContain('{EDIT_FOUNDING_INFO_LABEL}');
    expect(page).not.toContain('team_metrics_summary');
  });

  it.each(drivers)('lists charter members and computes year totals from the ledgers ($name)', async ({ make }) => {
    const db = await make();
    const before = await db.history.getLegacyMatrix(MEMBER.member, 1);
    const year = currentFraternalYear(NOW);
    const base = before.years.find((y) => y.fraternalYear === year)!.ledger;
    const memberId = rawInsert(db, 'Member', {
      CouncilID: 1,
      MemberNumber: 7770001,
      MemberFirstName: 'Charles',
      MemberLastName: 'Founder',
      Phone: '503-555-0777',
      StreetAddress1: '1 Charter Way',
      City: 'Portland',
      State: 'OR',
      ZipCode: '97201',
      Email: 'charles.founder@example.org',
      DateOfBirth: '1960-01-01',
      DateJoinedCouncil: '2026-08-01',
      StatusID: 1,
      DegreeID: 1,
      MemberTypeID: 1,
      CredentialID: 3,
      flag_charter_member: 1,
    });
    const after = await db.history.getLegacyMatrix(MEMBER.member, 1);
    expect(after.charterMembers).toContainEqual({ memberId, firstName: 'Charles', lastName: 'Founder', dateJoined: '2026-08-01' });
    const ledger = after.years.find((y) => y.fraternalYear === year)!.ledger;
    expect(ledger.membersRecruited).toBe(base.membersRecruited + 1);
    expect(typeof ledger.serviceHours).toBe('number');
    expect(typeof ledger.fundsRaised).toBe('number');
  });
});

describe('4. the Admin Desk', () => {
  const desk = read('apps/web/components/modules/AdminDesk.tsx');
  it('runs the Setup Wizard inside its drawer and frames every drawer like the officer desks', () => {
    expect(desk).toContain('<SetupWizard inline onClose={onWizardClosed} />');
    expect(desk).toContain('{BACK_TO_DESK_BLOTTER_LABEL}');
    expect(desk).toContain('aria-label="File cabinets"');
    expect(read('apps/web/components/modules/SetupWizard.tsx')).toContain('if (inline) {');
  });
  it('pins the rail with explicit sticky coordinates', () => {
    expect(desk).toContain("ADMIN_RAIL_STICKY_STYLE: CSSProperties = { position: 'sticky', top: 0, maxHeight: '100vh', overflowY: 'auto' }");
    expect(desk).toContain('style={ADMIN_RAIL_STICKY_STYLE}');
    expect(read('apps/web/app/globals.css')).toMatch(/\.desk-rail-lock \{\s*position: sticky;\s*top: 0;\s*max-height: 100vh;\s*overflow-y: auto;/);
  });
  it("draws a 'Sample Code' SVG badge for a payment method with no QR image", () => {
    const card = read('apps/web/components/PaymentQrUploader.tsx');
    expect(card).toContain("SAMPLE_CODE_BADGE_LABEL = 'Sample Code'");
    expect(card).toContain('<SampleCodeBadge name={name} className="size-full" />');
    expect(card).not.toContain('No QR code yet</span>');
  });
});
