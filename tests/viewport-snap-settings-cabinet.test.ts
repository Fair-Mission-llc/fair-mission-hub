// Sprint 8S Revision 10.1: a desk folder click snaps the window to the top, and Council Wide Settings is a 25/75 filing
// cabinet of four flat text tabs.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNCIL_SETTINGS_DRAWERS } from '@kofc/shared';

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

describe('the Council Wide Settings drawer panels (Sprint 10 Revision 3.0, was a filing cabinet)', () => {
  const parts = read('apps/web/components/FeatureDeploymentParts.tsx');
  const drawers = parts.slice(parts.indexOf('export function SettingsDrawers('), parts.indexOf('function StatusBadge('));

  it('has five drawers in order, the matrix on its own', () => {
    expect(COUNCIL_SETTINGS_DRAWERS.map((t) => [t.id, t.label])).toEqual([
      ['bank-accounts', 'Standard Bank Accounts'],
      ['access-roster', 'User Access & Roster Control'],
      ['system-settings', 'System Settings'],
      ['feature-controls', 'Feature Controls'],
      ['feature-matrix', 'Council Feature Deployment Matrix'],
    ]);
  });

  it('stacks collapsible drawers, every one closed on arrival (Sprint 11 Revision 1.0; the first opened until then)', () => {
    expect(drawers).toContain('<details');
    expect(drawers).toContain('<summary');
    expect(drawers).toContain('open={false}');
    expect(drawers).not.toContain('open={i === 0}');
    expect(parts).not.toContain('export function SettingsCabinet(');
  });

  it('keeps every drawer body mounted, so unsaved numbers survive closing a drawer', () => {
    expect(drawers).toContain('{panels[drawer.id]}');
    expect(drawers).not.toMatch(/open \? panels|isOpen \?/);
  });
});

