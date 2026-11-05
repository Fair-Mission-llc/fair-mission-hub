// Sprint 11 Revision 16.0 (schema version 110, unchanged): the workspace nomenclature and layout pass - the Form 1728 Top 3
// suggestions, the Event Planner truncation, the cadence and bylaws names, the /council-lookups hook-order crash, the
// roster deactivation and locked merit checkboxes, and the unified accounting names.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  bylawsTokenFeed,
  CHARITABLE_GRANTS_REGISTRY_TITLE,
  CHART_OF_ACCOUNTS_FOLDER_TITLE,
  compileForm1728Report,
  DESK_DRAWERS,
  DISBURSED_CHECK_REGISTRY_TITLE,
  evaluatedMeritFlags,
  FORM_1728_TOP_SUGGESTION_COUNT,
  FS_AUDIT_FOLDER_TITLE,
  FS_EXPENSE_AUDIT_QUEUE_TITLE,
  GENERAL_LEDGER_TITLE,
  isShieldCircleTenure,
  MEMBER_ROSTER_DESKS,
  MEMBER_ROSTER_TITLE,
  PLATFORM_SCHEMA_VERSION,
  STANDARD_BYLAWS_TEMPLATE,
  topForm1728Suggestions,
  TRANSFER_FUNDS_TITLE,
  TREASURER_LEDGER_AUDIT_TITLE,
  type Council,
} from '@kofc/shared';

const read = (path: string) => readFileSync(path, 'utf8');

describe('0. schema', () => {
  it('stays at version 110', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(112); // Sprint 11 Revision 19.6 moved the platform to schema 112.
  });
});

// Sprint 11 Revision 18.0 replaced the always-three rule: cards below the confidence cutoff are left out
// (tests/sprint11-rev180-motion-requests-super-admin-desk.test.ts covers the cutoff).
describe('1. Form 1728 suggestions (at most three)', () => {
  it('offers at most three distinct lines, each with its own selection target', () => {
    for (const title of ['Rosary before Mass', 'Socials', 'Youth soccer and basketball day', '']) {
      const top = topForm1728Suggestions(title);
      expect(top.length).toBeLessThanOrEqual(FORM_1728_TOP_SUGGESTION_COUNT);
      expect(new Set(top.map((s) => s.code)).size).toBe(top.length);
      expect(top.map((s) => s.rank)).toEqual(top.map((_, i) => i + 1));
      for (const s of top) expect(s.targetId).toBe(`form-1728-pick-${s.code}`);
    }
  });

  it('puts the engine match first and no longer pads with Community N', () => {
    const top = topForm1728Suggestions('Rosary before Mass');
    expect(top[0]!.section).toBe('Faith');
    expect(top[0]!.source).toBe('engine');
    expect(top.map((s) => s.code)).not.toContain('COMMUNITY_N');
  });

  it("no longer fills slots from the council's compiled report", () => {
    const rows = [
      { title: 'Blood drive', description: null, line: 'LIFE_A', date: '2026-03-01', hours: 9, memberId: 1 },
      { title: 'Coats for kids', description: null, line: 'COMMUNITY_B', date: '2026-03-02', hours: 3, memberId: 2 },
    ];
    const report = compileForm1728Report(rows, '2026-01-01', '2026-12-31');
    expect(topForm1728Suggestions('Socials', null, undefined, report)).toEqual([]);
  });

  it('draws the three as separate cards in the popup', () => {
    const parts = read('apps/web/components/Form1728Parts.tsx');
    expect(parts).toContain('topForm1728Suggestions(');
    expect(parts).toContain('id={s.targetId}');
    expect(parts).toContain('aria-pressed={chosen === s.code}');
  });
});

describe('1b. Event Planner truncation', () => {
  it('defines the three truncation properties and applies them to the event list and sidebar', () => {
    const css = read('apps/web/app/globals.css');
    const rule = css.slice(css.indexOf('.sidebar-truncate {'));
    for (const p of ['text-overflow: ellipsis;', 'white-space: nowrap;', 'overflow: hidden;']) expect(rule).toContain(p);
    expect(read('apps/web/app/events/page.tsx')).toContain('sidebar-truncate block text-sm font-bold');
    expect(read('apps/web/components/Sidebar.tsx')).toContain('<span className="sidebar-truncate">');
  });
});

describe('2. cadence, bylaws and knowledge vault', () => {
  it('renames the cadence button and status pill', () => {
    const page = read('apps/web/app/meetings/cadence/page.tsx');
    expect(page).toContain('View Scheduled Releases');
    // Sprint 11 Revision 17.0: the badge text lives in CADENCE_CARD_BADGES (Scheduled, Held, Past).
    expect(page).toContain('CADENCE_CARD_BADGES');
    expect(page).not.toMatch(/>\s*Canvas\s*</);
    expect(page).not.toContain('Not laid down');
  });

  it('ships a bylaws template the clause feed numbers like saved bylaws', () => {
    const feed = bylawsTokenFeed({ BylawsMarkdown: STANDARD_BYLAWS_TEMPLATE } as Council);
    expect(feed.clauseCount).toBeGreaterThan(20);
    expect(STANDARD_BYLAWS_TEMPLATE).toContain('# Article I - Name and Authority');
    const page = read('apps/web/app/governance/bylaws/page.tsx');
    expect(page).toContain('<Markdown source={STANDARD_BYLAWS_TEMPLATE}');
    expect(page).toContain("'AI Parliamentary Reasoning Stream'");
    expect(page).toContain('<HelpTip');
    expect(page).not.toContain('Parliamentary engine feed');
  });

  it('keeps the knowledge vault introduction to one short line', () => {
    const vault = read('apps/web/components/modules/KnowledgeArchive.tsx');
    const intro = vault.slice(vault.indexOf('<p className="mb-4 text-base">'), vault.indexOf('</p>'));
    expect(intro.length).toBeLessThan(200);
  });
});

describe('3. /council-lookups and the roster', () => {
  it('calls every LookupEditor hook before its loading return (the hook-order crash)', () => {
    const src = read('apps/web/components/modules/CouncilLookupTables.tsx');
    const editor = src.slice(src.indexOf('function LookupEditor('), src.indexOf('function AgendaTemplates('));
    const early = editor.indexOf('if (!columns) return');
    expect(early).toBeGreaterThan(0);
    expect(editor.indexOf('useForm1728Confirm()')).toBeLessThan(early);
    expect(editor.indexOf('useForm1728Enabled()')).toBeLessThan(early);
    expect(editor.slice(early)).not.toMatch(/\buse[A-Z]\w*\(/);
  });

  it('keeps the portal frame and session through a page error', () => {
    const boundary = read('apps/web/app/error.tsx');
    expect(boundary).toContain("'use client'");
    expect(boundary).toContain('retry()');
  });

  it('renames the roster and adds the deactivation modal', () => {
    expect(MEMBER_ROSTER_TITLE).toBe('Council Roster');
    const dir = read('apps/web/components/modules/MemberRosterDirectory.tsx');
    expect(dir).toContain("DEACTIVATE_MEMBER_LABEL = 'Deactivate Member'");
    expect(dir).toContain('showModal()');
    expect(dir).toContain('db.members.update(user.memberId, m.id, { StatusID: inactiveStatusId })');
  });

  it('reads the charter and Shield Circle checkboxes from the membership dates', () => {
    expect(isShieldCircleTenure('2000-11-02', '2026-11-02')).toBe(true);
    expect(isShieldCircleTenure('2001-11-03', '2026-11-02')).toBe(false);
    expect(evaluatedMeritFlags({ join_date: '2020-01-15' }, '2020-01-01', '2026-11-02')).toMatchObject({ charter: true, shield: false });
    expect(evaluatedMeritFlags({ join_date: '2020-03-15' }, '2020-01-01', '2026-11-02')).toMatchObject({ charter: false, shield: false });
    expect(evaluatedMeritFlags({ DateJoinedCouncil: '1990-05-01' }, null, '2026-11-02')).toMatchObject({ charter: false, shield: true });
    // A flag stored before the lock stays on.
    expect(evaluatedMeritFlags({ join_date: '2024-01-01', flag_charter_member: 1, flag_honorary_shield: 1 }, null, '2026-11-02')).toEqual({
      charter: true,
      shield: true,
      charterKept: true,
      shieldKept: true,
    });
    const form = read('apps/web/components/modules/MemberRecordForm.tsx');
    expect(form).toContain('evaluatedMeritFlags(');
    expect(form.match(/checked=\{(charter|honorary)\} disabled readOnly/g)).toHaveLength(2);
  });
});

describe('4. the treasurer and FS drawers', () => {
  it('spells each accounting name exactly', () => {
    expect(GENERAL_LEDGER_TITLE).toBe('General Ledger'); // Sprint 11 Revision 18.5
    expect(CHART_OF_ACCOUNTS_FOLDER_TITLE).toBe(GENERAL_LEDGER_TITLE);
    expect(TRANSFER_FUNDS_TITLE).toBe('Transfer Funds');
    expect(TREASURER_LEDGER_AUDIT_TITLE).toBe('Treasurer Ledger Audit');
    expect(DISBURSED_CHECK_REGISTRY_TITLE).toBe('Disbursed Check Registry');
    expect(CHARITABLE_GRANTS_REGISTRY_TITLE).toBe('Charitable Grants Registry');
    expect(FS_EXPENSE_AUDIT_QUEUE_TITLE).toBe('FS Expense Audit Queue');
    expect(FS_AUDIT_FOLDER_TITLE).toBe(FS_EXPENSE_AUDIT_QUEUE_TITLE);
  });

  it('titles the desk drawers with the unified names', () => {
    const title = (desk: string, id: string) => DESK_DRAWERS.find((d) => d.desk === desk && d.id === id)?.title;
    expect(title('treasurer', 'ledger-coder')).toBe(TREASURER_LEDGER_AUDIT_TITLE);
    expect(title('treasurer', 'er-settlement')).toBe(DISBURSED_CHECK_REGISTRY_TITLE);
    expect(title('treasurer', 'charity-matches')).toBe(CHARITABLE_GRANTS_REGISTRY_TITLE);
    expect(title('treasurer', 'chart-of-accounts')).toBe(GENERAL_LEDGER_TITLE);
    expect(title('financial-secretary', 'charity-checks')).toBe(CHARITABLE_GRANTS_REGISTRY_TITLE);
    expect(title('financial-secretary', 'payment-requests')).toBe(FS_EXPENSE_AUDIT_QUEUE_TITLE);
  });

  it('labels the sidebar links and pages', () => {
    const sidebar = read('apps/web/components/Sidebar.tsx');
    for (const name of ['GENERAL_LEDGER_TITLE', 'TREASURER_LEDGER_AUDIT_TITLE', 'FS_EXPENSE_AUDIT_QUEUE_TITLE', 'DISBURSED_CHECK_REGISTRY_TITLE', 'CHARITABLE_GRANTS_REGISTRY_TITLE'])
      expect(sidebar).toContain(`label: ${name}`);
    for (const old of ["'Transaction Ledger'", "'Bulk Check Payments Made'", "'Charity Payments Made Ledger'", "'FS Expense Audit'", "'Treasurer Ledger Audit Desk'"]) expect(sidebar).not.toContain(old);
    expect(read('apps/web/components/modules/ExpenseSettlement.tsx')).toContain('{DISBURSED_CHECK_REGISTRY_TITLE}</PageTitle>');
    expect(read('apps/web/components/modules/CharityCheckConsole.tsx')).toContain('{CHARITABLE_GRANTS_REGISTRY_TITLE}</PageTitle>');
    expect(read('apps/web/components/modules/LedgerLineCoder.tsx')).toContain('{TREASURER_LEDGER_AUDIT_TITLE}</PageTitle>');
    expect(read('apps/web/components/modules/PaymentRequestDesk.tsx')).toContain('{FS_EXPENSE_AUDIT_QUEUE_TITLE}</PageTitle>');
  });

  it('offers Transfer Funds on the ledger page and the chart folder', () => {
    for (const file of ['apps/web/app/finance/ledger/page.tsx', 'apps/web/components/modules/ChartOfAccountsSetup.tsx']) {
      const src = read(file);
      expect(src).toContain('{TRANSFER_FUNDS_TITLE}');
      expect(src).toContain('<TransferDrawer');
      expect(src).toContain('canPostGeneralLedger(');
    }
  });

  it('folds the financial views into an accordion; the endorsements folder still opens by ?folder=', () => {
    const sidebar = read('apps/web/components/Sidebar.tsx');
    expect(sidebar).toContain('<details open={open}');
    // Sprint 11 Revision 17.5: two accordions replace the single Financial Views accordion.
    expect(sidebar).toContain('FINANCIAL_REPORTS_ACCORDION_TITLE');
    expect(sidebar).toContain('FINANCIAL_ACTIONS_ACCORDION_TITLE');
    // Sprint 11 Revision 17.0: the endorsements link moved into the Charitable Grants Registry page as a tab.
    expect(read('apps/web/components/modules/CharityCheckConsole.tsx')).toContain('CHARITY_ENDORSEMENT_FOLDER_TITLE');
    expect(read('apps/web/components/DeskDrawers.tsx')).toContain('new URLSearchParams(window.location.search).get(DESK_FOLDER_PARAM)');
  });

  it('mounts the check registry on the Treasurer Desk and drops the roster from the FS Desk', () => {
    expect(MEMBER_ROSTER_DESKS).toEqual(['member', 'grand-knight']);
    const desks = read('apps/web/components/DashboardDesks.tsx');
    const body = (name: string, next: string) => desks.slice(desks.indexOf(`export function ${name}`), desks.indexOf(`export function ${next}`));
    expect(body('FinancialSecretaryDesk', 'TreasurerDesk')).not.toContain('<MemberRosterDirectory');
    expect(body('TreasurerDesk', 'MemberDesk')).toContain('<ExpenseSettlement />');
    expect(body('TreasurerDesk', 'MemberDesk')).toContain('treasurer-disbursed-check-registry');
  });

  it('turns the donation cards into a searchable, paginated table', () => {
    const src = read('apps/web/components/modules/DonationRecords.tsx');
    expect(src).toContain('DONATION_LEDGER_PAGE_SIZE = 10');
    expect(src).toContain('<EventDonationLedger');
    expect(src).toContain('label="Search events"');
    expect(src).toContain('label="Search donations"');
    expect(src).not.toContain('aria-label="Event donation summaries"');
  });
});

describe('5. the manuals', () => {
  it('uses the new names and drops the old ones', () => {
    const old = /Roster & Achievements|Transaction Ledger|Chart of Accounts & GL Setup|Ledger Line Coder|Bulk Check Payments Made|Charity Payments Made Ledger|Charitable Contribution Matches|Auditing & Return Queue|Parliamentary engine feed/;
    for (const f of ['ADMIN_USER_GUIDE', 'MEMBER_USER_GUIDE', 'TREASURER_MANUAL', 'FINANCIAL_SECRETARY_MANUAL', 'EXECUTIVE_GOVERNANCE_MANUAL']) {
      expect(read(`docs/${f}.md`), f).not.toMatch(old);
    }
    expect(read('docs/TREASURER_MANUAL.md')).toContain('Transfer Funds');
    expect(read('docs/EXECUTIVE_GOVERNANCE_MANUAL.md')).toContain('View Scheduled Releases');
    expect(read('docs/ADMIN_USER_GUIDE.md')).toContain('**Locked checkboxes on the member record:**');
  });
});
