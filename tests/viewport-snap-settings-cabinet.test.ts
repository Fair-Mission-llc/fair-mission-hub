// Sprint 8S Revision 10.1: a desk folder click snaps the window to the top, and Council Wide Settings is a 25/75 filing
// cabinet of four flat text tabs.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNCIL_SETTINGS_CABINET_TABS } from '@kofc/shared';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

describe('the desk folder viewport snap', () => {
  const drawers = read('apps/web/components/DeskDrawers.tsx');

  it('scrolls the window to its very top, smoothly unless the reader prefers reduced motion', () => {
    expect(drawers).toContain('export function snapViewportToTop()');
    expect(drawers).toContain("window.scrollTo({ top: 0, left: 0, behavior: reduced ? 'auto' : 'smooth' })");
    expect(drawers).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
  });

  it('runs on every folder click of every desk blotter, and not on a badge click-through focus', () => {
    const blotter = drawers.slice(drawers.indexOf('export function DeskBlotter('));
    const click = blotter.slice(blotter.indexOf('onOpen={() => {'), blotter.indexOf('}}', blotter.indexOf('onOpen={() => {')));
    expect(click).toContain('openDrawer(spec);');
    expect(click).toContain('snapViewportToTop();');
    const focus = blotter.slice(blotter.indexOf('const onRowFocus'), blotter.indexOf('return ('));
    expect(focus).not.toContain('snapViewportToTop');
    // Every officer desk mounts this one blotter.
    expect(read('apps/web/components/DashboardDesks.tsx')).toContain("import { DeskBlotter } from '@/components/DeskDrawers';");
  });
});

describe('the Council Wide Settings filing cabinet', () => {
  const parts = read('apps/web/components/FeatureDeploymentParts.tsx');
  const cabinet = parts.slice(parts.indexOf('export function SettingsCabinet('), parts.indexOf('function StatusBadge('));

  it('has four flat text tabs in rail order', () => {
    expect(COUNCIL_SETTINGS_CABINET_TABS.map((t) => [t.id, t.label])).toEqual([
      ['bank-accounts', 'Standard Bank Accounts'],
      ['revenue-splits', 'Global Revenue Splits'],
      ['access-roster', 'User Access & Roster Control'],
      ['flags-toggles', 'System Flags & Toggles'],
    ]);
  });

  it('lays a 25% vertical tab rail beside a 75% canvas', () => {
    expect(cabinet).toContain('md:grid-cols-[1fr_3fr]');
    expect(cabinet).toContain('role="tablist" aria-orientation="vertical"');
    expect(cabinet).toContain('role="tab"');
    expect(cabinet).toContain('aria-selected={selected}');
    expect(cabinet).toContain('role="tabpanel"');
    // One level only: no accordion or nested group inside the rail.
    expect(cabinet).not.toMatch(/<details|<summary|role="group"/);
  });

  it('shows only the chosen tab and keeps the others mounted, so unsaved numbers survive a switch', () => {
    expect(cabinet).toContain('hidden={tab.id !== active}');
    expect(cabinet).toContain('onClick={() => setActive(tab.id)}');
  });
});
