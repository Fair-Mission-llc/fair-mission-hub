// Sprint 11 Revision 17.7: navigation and headings read as plain words (no icons, no brackets), while the in-app data
// markers keep their icons - the calendar's day markers and the members' New Member and Charter Member badges.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CHARTER_MEMBER_BADGE,
  DASHBOARD_TABS,
  DESK_CABINET_LABELS,
  DESK_DRAWERS,
  FINANCIAL_ACTIONS_ACCORDION_TITLE,
  FINANCIAL_REPORTS_ACCORDION_TITLE,
  HOLY_DAY_BADGE,
  NEW_MEMBER_BADGE_LABEL,
  SUPER_ADMIN_DESK_FOLDERS,
  SUPER_ADMIN_HEADER_LINK_LABEL,
  withNewMemberBadge,
} from '@kofc/shared';

const read = (path: string) => readFileSync(path, 'utf8');
/** An icon glyph (pictographs, dingbats, misc symbols and technical symbols) or a bracket. */
const DECORATION = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}[\]]/u;
const plain = (label: string) => expect(DECORATION.test(label), label).toBe(false);

describe('1. navigation is text only', () => {
  it('titles the two Finances accordions in plain words', () => {
    expect(FINANCIAL_REPORTS_ACCORDION_TITLE).toBe('FINANCIAL REPORTS');
    expect(FINANCIAL_ACTIONS_ACCORDION_TITLE).toBe('FINANCIAL ACTIONS');
  });

  it('keeps every sidebar link label plain', () => {
    const labels = [...read('apps/web/components/Sidebar.tsx').matchAll(/\blabel: '([^']*)'/g)].map((m) => m[1]!);
    expect(labels.length).toBeGreaterThan(40);
    labels.forEach(plain);
  });

  it('keeps the desk drawer names, desk tabs, cabinet labels and Platform Management folders plain', () => {
    DESK_DRAWERS.map((d) => d.title).forEach(plain);
    DASHBOARD_TABS.map((t) => t.label).forEach(plain);
    Object.values(DESK_CABINET_LABELS).forEach(plain);
    SUPER_ADMIN_DESK_FOLDERS.map((f) => f.label).forEach(plain);
    plain(SUPER_ADMIN_HEADER_LINK_LABEL);
  });

  it('draws page titles, buttons and tabs through the plain-text clean-up', () => {
    const ui = read('apps/web/components/ui.tsx');
    expect(ui).toContain('<h1 className="font-serif text-2xl font-bold">{plainText(children)}</h1>');
    expect(ui).toContain('{plainText(children)}\n    </button>');
    expect(ui).toContain('{plainTitle(tab.label)}');
    expect(read('apps/web/components/DeskDrawers.tsx')).toContain('{plainTitle(spec.title)}');
  });
});

describe('2. data markers keep their icons', () => {
  it('keeps the calendar day markers', () => {
    const calendar = read('apps/web/app/calendar/page.tsx');
    expect(calendar).toContain("(area && tone === 'needs' ? '⚑ ' : '')");
    expect(calendar).toContain("{observance.kind === 'holiday' ? '★ ' : '✝ '}");
    expect(calendar).toContain('🎂 {birthday.name}');
    expect(HOLY_DAY_BADGE).toBe('[ 🟥 HOLY DAY OF OBLIGATION ]');
  });

  it('keeps the member badges and shows both on the roster rows', () => {
    expect(NEW_MEMBER_BADGE_LABEL).toBe('🆕 New Member');
    expect(CHARTER_MEMBER_BADGE).toBe('📜 Charter Member');
    expect(withNewMemberBadge('Newman, Luke', { DateJoinedCouncil: '2026-01-15' }, '2026-02-01')).toBe('Newman, Luke [🆕 New Member]');
    const ui = read('apps/web/components/ui.tsx');
    expect(ui).toContain('export function CharterMemberBadge(');
    expect(ui).toContain("if (member?.flag_charter_member !== 1) return null;");
    const roster = read('apps/web/components/modules/MemberRosterDirectory.tsx');
    expect(roster).toContain('<NewMemberBadge member={m} />\n                    <CharterMemberBadge member={m} />');
  });
});
