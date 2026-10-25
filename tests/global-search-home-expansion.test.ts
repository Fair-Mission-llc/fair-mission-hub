// Sprint 8P Stage 1 (schema version 87): the header's global search bar, the understated '[ 🔑 Request Access ]' link and
// the larger, page-scrolling Home tiles.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readOfficerManuals } from './support/officer-manuals';
import {
  GLOBAL_SEARCH_MAX_PER_KIND,
  GLOBAL_SEARCH_MIN_CHARS,
  helpArchiveHits,
  navigationGuide,
  searchGlobal,
  type GlobalSearchSources,
} from '@kofc/shared';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

const sources: GlobalSearchSources = {
  pages: [
    { label: 'Annual Budget Planner', hint: 'Budget lines for the fraternal year', href: '/budget' },
    { label: 'Visual Master Calendar', hint: 'Events, shifts and meetings by date', href: '/calendar' },
    { label: 'Donations History', hint: 'Record and review council donations', href: '/donations' },
  ],
  events: [
    { id: 1, name: 'Lenten Fish Fry', date: '2027-03-05T17:00:00', location: "St. Mary's Hall" },
    { id: 2, name: 'Pancake Breakfast', date: '2026-11-01T08:00:00', location: 'Parish Center' },
  ],
  members: [
    { id: 7, firstName: 'Tom', lastName: 'Ferris', memberNumber: 1234567 },
    { id: 8, firstName: 'David', lastName: 'Budd', memberNumber: 7654321 },
  ],
  eventHref: '/events',
  memberHref: '/members',
};

describe('searchGlobal', () => {
  it('stays closed below the minimum length', () => {
    expect(GLOBAL_SEARCH_MIN_CHARS).toBe(2);
    expect(searchGlobal('', sources)).toEqual([]);
    expect(searchGlobal('b', sources)).toEqual([]);
    expect(searchGlobal(' ! ', sources)).toEqual([]);
  });

  it('finds pages, events and members by word prefix, then always adds the two help archives', () => {
    const hits = searchGlobal('bud', sources);
    expect(hits.map((h) => [h.kind, h.label])).toEqual([
      ['Page', 'Annual Budget Planner'],
      ['Member', 'David Budd'],
      ['Help', 'Search the Online Help Center for “bud”'],
      ['Help', 'Ask the Interactive Help Desk about “bud”'],
    ]);
    expect(hits[1].href).toBe('/members');
  });

  it('opens events where the reader may go and matches the location too', () => {
    const [fish] = searchGlobal('fish fry', sources);
    expect(fish).toEqual({ kind: 'Event', label: 'Lenten Fish Fry', detail: "2027-03-05 · St. Mary's Hall", href: '/events' });
    expect(searchGlobal('parish', { ...sources, eventHref: undefined })[0]).toMatchObject({ kind: 'Event', href: '/calendar' });
  });

  it('ranks a hit with every word above one with fewer words', () => {
    const hits = searchGlobal('master calendar', sources).filter((h) => h.kind === 'Page');
    expect(hits[0].label).toBe('Visual Master Calendar');
  });

  it('finds members by number and never without a roster link', () => {
    expect(searchGlobal('7654', sources).find((h) => h.kind === 'Member')?.label).toBe('David Budd');
    expect(searchGlobal('budd', { ...sources, memberHref: undefined }).some((h) => h.kind === 'Member')).toBe(false);
  });

  it('caps each kind', () => {
    const pages = Array.from({ length: 12 }, (_, i) => ({ label: `Report ${i}`, hint: '', href: `/r${i}` }));
    expect(searchGlobal('report', { pages }).filter((h) => h.kind === 'Page')).toHaveLength(GLOBAL_SEARCH_MAX_PER_KIND);
  });

  it('carries the words into both help pages', () => {
    expect(helpArchiveHits('reset password').map((h) => h.href)).toEqual(['/help?q=reset%20password', '/answers/help?q=reset%20password']);
  });

  it("builds page hits from the reader's own sidebar only", () => {
    const member = { memberId: 7, councilId: 1, memberType: 'Member' as const, isOfficer: false, roles: [] };
    const items = navigationGuide(member).groups.flatMap((g) => g.entries.map((e) => e.item));
    expect(items).not.toContain('members');
    const code = read('apps/web/components/GlobalSearch.tsx');
    expect(code).toContain('navigationGuide(user, features, tenantType)');
    expect(code).toContain("memberHref: areas.has('roster') ? '/roster' : undefined");
  });
});

describe('the header and the help pages', () => {
  it('puts the search bar in the header row', () => {
    const shell = read('apps/web/components/Shell.tsx');
    const header = shell.slice(shell.indexOf('<header data-surface="navy"'), shell.indexOf('</header>'));
    expect(header).toContain('<GlobalSearch />');
    expect(header.indexOf('<GlobalSearch />')).toBeLessThan(header.indexOf('<MessagingMenu'));
  });

  it('starts both help pages with the ?q= words', () => {
    for (const page of ['apps/web/app/help/page.tsx', 'apps/web/app/answers/help/HelpDesk.tsx']) {
      expect(read(page)).toContain("new URLSearchParams(window.location.search).get('q')");
    }
  });
});

describe('Home expansion', () => {
  it('opens the desk inner scroll lists onto the page', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).not.toContain('max-h-[28rem] overflow-y-auto');
    expect(desks).not.toContain('max-h-48 flex-col divide-y divide-line overflow-y-auto');
  });

  it('moves the phone database to version 87', () => {
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (8[7-9]|9\d|\d{3});/);
    expect(read('Schema.sql')).toContain('(schema version 87)');
  });

  it('documents the search bar and the request access link', () => {
    const admin = readOfficerManuals();
    expect(admin).toContain('## 19. The global search bar');
    expect(admin).toContain('**[ 🔑 Request Access ]**');
    expect(admin).not.toContain('Register Your Council / Request Access');
  });
});
