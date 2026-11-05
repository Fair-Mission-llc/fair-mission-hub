// Sprint 11 Revision 19.5 (schema 111 unchanged): parent organization tiers, the TF-IDF help ranker, the sticky
// navigation context locks, the Form 1728 popup calibrations, Motion Requests behind a council switch (their own since Revision 19.6), the
// leaner council Admin sidebar and the Fraternal Annals & Oral History name.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_DESK_REDUNDANT_NAV_ITEMS,
  ALL_FEATURES_ON,
  deskDrawersFor,
  FEATURE_FLAG_LABELS,
  FRATERNAL_ANNALS_TITLE,
  guideSearchTerms,
  isRedundantAdminDeskNavItem,
  normalizeSearchText,
  parentOrganizationNodeId,
  parentOrganizationNodes,
  parseGuideTasks,
  portalAreas,
  searchGuideTasks,
  stemSearchToken,
  withFeatureFlags,
} from '@kofc/shared';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('1. parent organization tiers', () => {
  const councils = [
    { id: 3, parent_organization: 'SECULAR_CHARITY' },
    { id: 1, parent_organization: 'KofC' },
    { id: 4, parent_organization: 'Food Bank Network' },
    { id: 2, parent_organization: 'kofc' },
    { id: 5, parent_organization: null, tenant_type: 'GENERIC' },
  ];

  it('reads the nodes from the council rows, known ones first, then any other value', () => {
    expect(parentOrganizationNodes(councils)).toEqual([
      { id: 'KofC', label: 'Knights of Columbus council', councilIds: [1, 2] },
      { id: 'SECULAR_CHARITY', label: 'Secular charity (non-denominational)', councilIds: [3, 5] },
      { id: 'Food Bank Network', label: 'Food Bank Network', councilIds: [4] },
    ]);
    expect(parentOrganizationNodeId({})).toBe('KofC');
    expect(parentOrganizationNodes([])).toEqual([]);
  });

  it('draws the tiers on the grid and groups the council picker', () => {
    const grid = read('apps/web/components/FeatureFlagParts.tsx');
    expect(grid).toContain('parentOrganizationNodes(councils)');
    expect(grid).toContain('saveTier');
    expect(read('apps/web/components/CouncilScope.tsx')).toContain('<optgroup');
  });
});

describe('2. the TF-IDF help ranker', () => {
  it('normalizes text, including double-decoded characters', () => {
    expect(normalizeSearchText('Fraternal Council Archivesâ„¢ â€” Café')).toBe('fraternal council archivestm - cafe');
    // UTF-8 bytes read back as Windows-1252, three times over, as a PowerShell round trip can leave them.
    const cp1252 = new Map(Object.entries({ 0x80: '€', 0x82: '‚', 0x84: '„', 0x93: '“', 0x94: '”', 0x99: '™', 0x9c: 'œ', 0xa0: ' ' }).map(([k, v]) => [Number(k), v]));
    const garble = (s: string) => [...Buffer.from(s, 'utf8')].map((b) => cp1252.get(b) ?? String.fromCharCode(b)).join('');
    expect(normalizeSearchText(`Submit ${garble(garble(garble('—')))} report`)).toBe('submit - report');
    expect(normalizeSearchText('Plain text')).toBe('plain text');
  });

  it('strips conversational filler down to the operational tokens', () => {
    expect(guideSearchTerms('Hi, could you please help me submit my expense report?')).toEqual(['submit', 'expense', 'report']);
    expect(stemSearchToken('submitted')).toBe('submit');
    expect(stemSearchToken('expenses')).toBe('expens');
  });

  it('weights rare keywords and the title above common ones in the steps', () => {
    const md = [
      '## 1. Money',
      '### 1.1 Submit an expense report',
      '**Goal:** Get paid back.',
      '**Start point:** Sidebar.',
      '**Steps:**',
      '1. Select Submit.',
      '**Expected result:** Sent.',
      '### 1.2 Read the monthly report',
      '**Goal:** See the report.',
      '**Start point:** Sidebar.',
      '**Steps:**',
      '1. Open the report. Submit nothing.',
      '**Expected result:** Read.',
    ].join('\n');
    const tasks = parseGuideTasks(md);
    expect(searchGuideTasks(tasks, 'how do I submit expenses').map((t) => t.id)).toEqual(['1.1', '1.2']);
    expect(searchGuideTasks(tasks, 'reports')[0]!.id).toBe('1.2');
  });
});

describe('3. sticky navigation context locks', () => {
  it('locks the sidebar and every desk rail', () => {
    const css = read('apps/web/app/globals.css');
    expect(css).toMatch(/\.nav-context-lock \{\s*position: sticky;\s*top: 0;\s*height: 100vh;\s*overflow-y: auto;/);
    expect(css).toContain('.desk-rail-lock');
    expect(read('apps/web/components/Sidebar.tsx')).toContain('nav-context-lock');
    expect(read('apps/web/components/DeskDrawers.tsx')).toContain('desk-rail-lock');
    expect(read('apps/web/components/modules/AdminDesk.tsx')).toContain('desk-rail-lock');
    expect(read('apps/web/components/modules/AdminDesk.tsx')).toContain('drawer-context-active');
  });
});

describe('4. Form 1728, Motion Requests, the Admin sidebar and the annals name', () => {
  it('doubles the line list, preselects nothing below the cutoff and shows the line on the activity grid', () => {
    const parts = read('apps/web/components/Form1728Parts.tsx');
    expect(parts).toContain('FORM_1728_LIST_ROWS = 12');
    expect(parts).toContain('best?.code ?? null');
    expect(parts).not.toContain('resolveForm1728Line(null, title');
    expect(read('apps/web/components/modules/CouncilLookupTables.tsx')).toContain("kind: 'form1728'");
  });

  it('hides Motion Requests with their own switch (Revision 19.6 freed them from Meeting management)', () => {
    const gk = { memberId: 1, councilId: 1, memberType: 'Member', isOfficer: true, roles: ['Grand Knight'] } as never;
    expect(withFeatureFlags(['motion-requests'], { ...ALL_FEATURES_ON, flag_motion_requests: false })).toEqual([]);
    expect(withFeatureFlags(['motion-requests'], { ...ALL_FEATURES_ON, flag_meeting_management: false })).toEqual(['motion-requests']);
    const off = deskDrawersFor(gk, 'grand-knight', 1, { ...ALL_FEATURES_ON, flag_motion_requests: false });
    expect(off.map((d) => d.id)).not.toContain('motion-requests');
    expect(portalAreas(gk, { ...ALL_FEATURES_ON, flag_motion_requests: false })).not.toContain('motion-requests');
  });

  it('drops the links the Admin Desk holds from a council Admin sidebar only', () => {
    for (const item of ADMIN_DESK_REDUNDANT_NAV_ITEMS) {
      expect(isRedundantAdminDeskNavItem('Admin', item)).toBe(true);
      expect(isRedundantAdminDeskNavItem('Super Admin', item)).toBe(false);
    }
    // Sprint 11 Revision 20.0: the sidebar's own Admin Desk link looped back to the desk the Active Desks tab opens.
    expect(isRedundantAdminDeskNavItem('Admin', 'admin-desk')).toBe(true);
    expect(isRedundantAdminDeskNavItem('Super Admin', 'admin-desk')).toBe(true);
    expect(isRedundantAdminDeskNavItem('Member', 'admin-desk')).toBe(false);
  });

  it("names the history page and its switch '[ 📜 Fraternal Annals & Oral History ]'", () => {
    expect(FRATERNAL_ANNALS_TITLE).toBe('[ 📜 Fraternal Annals & Oral History ]');
    expect(FEATURE_FLAG_LABELS.feature_council_history.label).toBe(FRATERNAL_ANNALS_TITLE);
    expect(read('apps/web/app/history/page.tsx')).toContain(`<PageTitle>${FRATERNAL_ANNALS_TITLE}</PageTitle>`);
  });
});
