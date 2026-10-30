// Sprint 11 Revision 15.0 (schema stays 110): desktop bundle compaction, the Financial Inspections masking of the
// Financial Secretary and Treasurer desks' inner drawers, and the compiled Form 1728 report with its CSV export.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALL_FEATURES_ON,
  compileForm1728Report,
  deskDrawerMasked,
  deskDrawersFor,
  FINANCIAL_INSPECTION_DRAWERS,
  form1728ReportCsv,
  FORM_1728_LINES,
  type FeatureFlags,
  type Form1728HoursRow,
} from '@kofc/shared';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const superAdmin = { memberId: 1, councilId: 1, memberType: 'Super Admin' as const, isOfficer: true, roles: ['Grand Knight', 'Financial Secretary', 'Treasurer'] };
const auditsOff: FeatureFlags = { ...ALL_FEATURES_ON, feature_advanced_audits: false };
const ids = (desk: 'financial-secretary' | 'treasurer', flags: FeatureFlags) => deskDrawersFor(superAdmin, desk, 1, flags).map((d) => d.id as string);

describe('1. desktop bundle compaction', () => {
  const config = JSON.parse(read('electron-builder.json'));

  it('compresses at maximum and ships only the en-US Electron locale', () => {
    expect(config.compression).toBe('maximum');
    expect(config.electronLanguages).toEqual(['en-US']);
  });

  it('prunes source maps, build caches and test framework folders from the packed portal', () => {
    const filter: string[] = config.extraResources[0].filter;
    expect(filter[0]).toBe('**/*');
    for (const rule of ['!**/*.map', '!**/.next/cache/**', '!**/vitest/**', '!**/@vitest/**', '!**/__tests__/**']) expect(filter).toContain(rule);
    expect(config.files).toContain('!**/node_modules/**/*');
  });

  it("filters the afterPack node_modules copy the same way", () => {
    const hook = read('apps/desktop/after-pack.cjs');
    expect(hook).toContain('filter: keep');
    expect(hook).toMatch(/PRUNED_DIRS = new Set\(\['\.cache', '__tests__', 'vitest', '@vitest'\]\)/);
  });
});

describe('2. Financial Inspections masks the inner finance drawers', () => {
  it('keeps every inspection drawer while the switch is on', () => {
    expect(ids('financial-secretary', ALL_FEATURES_ON)).toEqual(expect.arrayContaining(['form-1295', 'er-routing-track', 'donation-records']));
    expect(ids('treasurer', ALL_FEATURES_ON)).toEqual(expect.arrayContaining(['cash-box-audit', 'bank-match']));
  });

  it('strips the audit, expense log and donation history drawers when it is off', () => {
    const fs = ids('financial-secretary', auditsOff);
    const tr = ids('treasurer', auditsOff);
    for (const id of FINANCIAL_INSPECTION_DRAWERS['financial-secretary']!) expect(fs).not.toContain(id);
    for (const id of FINANCIAL_INSPECTION_DRAWERS.treasurer!) expect(tr).not.toContain(id);
  });

  it('leaves the drawers that move money, so no sheet is stranded', () => {
    expect(ids('financial-secretary', auditsOff)).toEqual(expect.arrayContaining(['payment-requests', 'charity-checks']));
    expect(ids('treasurer', auditsOff)).toEqual(expect.arrayContaining(['ledger-coder', 'er-settlement', 'charity-matches']));
  });

  it('reads no flags as all on, and only masks its own desk', () => {
    expect(deskDrawerMasked('treasurer', 'cash-box-audit')).toBe(false);
    expect(deskDrawerMasked('treasurer', 'cash-box-audit', auditsOff)).toBe(true);
    expect(deskDrawerMasked('grand-knight', 'donation-workflow', auditsOff)).toBe(false);
  });

  it('guards the inner render of both desks', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).toContain("if (deskDrawerMasked('financial-secretary', spec.id, flags)) return null;");
    expect(desks).toContain("if (deskDrawerMasked('treasurer', spec.id, flags)) return null;");
  });
});

describe('3. the compiled Form 1728 report', () => {
  const rows: Form1728HoursRow[] = [
    { title: 'Coats for Kids drive', date: '2026-02-01', hours: 2, memberId: 1 },
    { title: 'Coats for Kids drive', date: '2026-02-01', hours: 1.5, memberId: 2 },
    { title: 'Parish rosary', date: '2026-03-01', hours: 1, memberId: 1 },
    { title: 'Monthly social', line: 'LIFE_C', date: '2026-04-01', hours: 3, memberId: 3 },
    { title: 'Coats for Kids drive', date: '2025-12-31', hours: 9, memberId: 4 },
  ];
  const report = compileForm1728Report(rows, '2026-01-01', '2026-10-29');

  it('groups lines under their sections with subtotals and grand totals', () => {
    expect(report.sections.map((s) => s.section)).toEqual(['Faith', 'Family', 'Community', 'Life']);
    const community = report.sections.find((s) => s.section === 'Community')!;
    expect(community).toMatchObject({ hours: 3.5, entries: 2, volunteers: 2 });
    expect(community.lines.map((l) => l.code)).toEqual(['COMMUNITY_A']);
    expect(report.sections.find((s) => s.section === 'Life')!.lines[0].code).toBe('LIFE_C');
    expect(report.totals).toEqual({ hours: 7.5, entries: 4, volunteers: 3, lines: 3 });
  });

  it('lists every catalog line for the printed sheet', () => {
    const full = compileForm1728Report(rows, '2026-01-01', '2026-10-29', { includeEmptyLines: true });
    expect(full.sections.flatMap((s) => s.lines)).toHaveLength(FORM_1728_LINES.length);
    expect(full.totals).toEqual(report.totals);
  });

  it('exports CSV with subtotal and total rows, quoting cells that need it', () => {
    const csv = form1728ReportCsv(compileForm1728Report([{ title: 'Coat drive, "winter"', date: '2026-01-05', hours: 1, memberId: 1 }], '2026-01-01', '2026-12-31'));
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('Section,Line,Label,Records,Entries,Volunteers,Hours');
    expect(lines).toContain('Community,A,Coats for Kids,"Coat drive, ""winter""",1,1,1');
    expect(lines).toContain('Community,,Community subtotal,,1,1,1');
    expect(lines.at(-1)).toBe('All,,Total 2026-01-01 to 2026-12-31,,1,1,1');
  });

  it('gives the year-to-date panel one-click Print and CSV export', () => {
    const panel = read('apps/web/components/Form1728Parts.tsx');
    expect(panel).toContain('compileForm1728Report(rows, span.fromDate, span.toDate, { includeEmptyLines: true })');
    expect(panel).toContain('form1728ReportCsv(report)');
  });
});
