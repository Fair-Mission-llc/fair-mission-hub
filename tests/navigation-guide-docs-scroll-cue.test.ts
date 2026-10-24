// Sprint 8S Extension (schema version 94, no change): the Navigation Guide screen gets its own guide chapter, and the
// Home tab gets the 'Scroll down for more council info ↓' cue that fades on the first downward scroll.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readOfficerManuals } from './support/officer-manuals';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

describe('the Navigation Guide chapter', () => {
  // Sprint 9 Master Hardening Pass: chapter 27 moved to the Executive Governance Manual, where the manual map closes it.
  const admin = read('docs/EXECUTIVE_GOVERNANCE_MANUAL.md');
  const chapter = admin.slice(admin.indexOf('## 27. The Navigation Guide screen'), admin.indexOf('## Manual map'));

  it('is listed in the contents and sits before the manual map', () => {
    expect(admin).toContain('- [27. The Navigation Guide screen](#27-the-navigation-guide-screen)');
    expect(admin.indexOf('## 27. The Navigation Guide screen')).toBeGreaterThan(admin.indexOf('## 26. The global search bar'));
    expect(chapter.length).toBeGreaterThan(2000);
  });

  it('documents the role depth, the closed groups and the sidebar-first levels', () => {
    for (const heading of [
      '### 27.2 Concept: the guide changes with your role',
      '### 27.3 Concept: every category group starts closed',
      '### 27.4 Concept: the sidebar-first order',
      '### 27.5 Find a page with the Navigation Guide',
    ]) {
      expect(chapter).toContain(heading);
    }
    expect(chapter).toContain('| Member (a plain volunteer) | Summary | One short sentence | One short sentence. No drawers. |');
    expect(chapter).toContain('The screen opens with all of its category groups closed. Only the **📍 Overview** block is open.');
    expect(chapter).toContain('| 3. Drawer |');
  });

  it('matches the screen: only the overview opens on arrival', () => {
    const page = read('apps/web/app/navigation-guide/page.tsx');
    expect(page.match(/<MapBlock [^>]*\bopen\b/g)).toEqual(['<MapBlock id="overview" title="📍 Overview" open']);
  });

  it('has a member guide section', () => {
    const member = read('docs/MEMBER_USER_GUIDE.md');
    expect(member).toContain('### 1.5 The Navigation Guide');
    expect(member.indexOf('### 1.5 The Navigation Guide')).toBeLessThan(member.indexOf('## 2. Get into your account'));
  });
});

describe('the Home scroll cue', () => {
  it('mounts under the Home cards only', () => {
    const page = read('apps/web/app/dashboard/page.tsx');
    const home = page.slice(page.indexOf('function HomeDesk('), page.indexOf('function Dashboard('));
    expect(home).toContain('<HomeScrollCue />');
    expect(page.match(/<HomeScrollCue \/>/g)).toHaveLength(1);
  });

  it('reads the agreed text and dismisses on the first downward wheel turn', () => {
    const cue = read('apps/web/components/HomeScrollCue.tsx');
    expect(cue).toContain("export const HOME_SCROLL_CUE_TEXT = 'Scroll down for more council info ↓';");
    expect(cue).toContain("window.addEventListener('wheel', onWheel, { passive: true });");
    expect(cue).toContain('if (e.deltaY > 0) dismiss();');
    expect(cue).toContain('fixed inset-x-0 bottom-3');
    expect(cue).toContain('aria-hidden="true"');
  });

  it('fades by a CSS opacity transition', () => {
    const css = read('apps/web/app/globals.css');
    expect(css).toMatch(/\.home-scroll-cue \{\s+opacity: 1;\s+transition: opacity 250ms ease-out;/);
    expect(css).toMatch(/\.home-scroll-cue\[data-hidden='true'\] \{\s+opacity: 0;/);
  });

  it('is documented in both guides', () => {
    for (const guide of ['docs/EXECUTIVE_GOVERNANCE_MANUAL.md', 'docs/MEMBER_USER_GUIDE.md']) expect(read(guide)).toContain('**Scroll down for more council info ↓**');
  });
});
