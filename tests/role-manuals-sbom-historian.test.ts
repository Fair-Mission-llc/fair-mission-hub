// Sprint 9 Master Hardening Pass / Revision 7.0: the CycloneDX SBOM on every pilot build, the three role manuals split out
// of the master Administrator guide (with their desk header and 'How do I…' search), the pruned infrastructure guide,
// and the Council Historian's inherited member links.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MEMBER_BASE_AREAS,
  parseGuideTasks,
  portalAreas,
  portalSidebar,
  ROLE_MANUAL_KEYS,
  ROLE_MANUALS,
  roleManualByToken,
  roleManualForDesk,
  roleManualPdfHref,
  roleManualTasksHref,
  searchRoleManual,
} from '@kofc/shared';
// @ts-expect-error - a plain .mjs build script without type declarations
import { buildCycloneDxBom, npmPurl, sha512Hex } from '../scripts/generate-sbom.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const MANUAL_FILES = ['docs/ADMIN_USER_GUIDE.md', 'docs/TREASURER_MANUAL.md', 'docs/FINANCIAL_SECRETARY_MANUAL.md', 'docs/EXECUTIVE_GOVERNANCE_MANUAL.md'];
const sectionIds = (markdown: string) => [...markdown.matchAll(/^#{3,4}\s+(\d+(?:\.\d+)+)\s/gm)].map((m) => m[1]);

describe('CycloneDX SBOM (scripts/generate-sbom.mjs)', () => {
  const lock = {
    name: 'app',
    lockfileVersion: 3,
    packages: {
      '': { name: 'app', version: '1.0.0', workspaces: ['apps/web'] },
      'apps/web': { name: '@app/web', version: '1.0.0', dependencies: { next: '^1.0.0' }, devDependencies: { typescript: '^5' } },
      'node_modules/@app/web': { resolved: 'apps/web', link: true },
      'node_modules/next': { version: '1.2.3', resolved: 'https://registry.npmjs.org/next/-/next-1.2.3.tgz', integrity: 'sha512-AAEC', license: 'MIT', dependencies: { '@scope/lib': '2' } },
      'node_modules/next/node_modules/@scope/lib': { version: '2.0.0', integrity: 'sha512-AQID', license: '(MIT OR Apache-2.0)' },
      'node_modules/@scope/lib': { version: '1.0.0', license: 'ISC' },
      'node_modules/typescript': { version: '5.9.3', dev: true, license: 'Apache-2.0' },
    },
  };
  const bom = buildCycloneDxBom(lock, { name: 'app', version: '1.0.0' }, { timestamp: '2026-10-24T00:00:00.000Z', serialNumber: 'urn:uuid:test' });
  const byRef = (ref: string) => bom.components.find((c: { 'bom-ref': string }) => c['bom-ref'] === ref);

  it('writes a CycloneDX 1.5 document with the build metadata', () => {
    expect(bom).toMatchObject({ bomFormat: 'CycloneDX', specVersion: '1.5', serialNumber: 'urn:uuid:test', version: 1 });
    expect(bom.metadata.component).toMatchObject({ name: 'app', type: 'application', purl: 'pkg:npm/app@1.0.0' });
  });

  it('lists each package with its purl, hash, license and scope', () => {
    expect(byRef('next@1.2.3')).toMatchObject({ scope: 'required', licenses: [{ license: { id: 'MIT' } }], hashes: [{ alg: 'SHA-512', content: '000102' }] });
    expect(byRef('@scope/lib@2.0.0')).toMatchObject({ purl: 'pkg:npm/%40scope/lib@2.0.0', licenses: [{ expression: '(MIT OR Apache-2.0)' }] });
    expect(byRef('typescript@5.9.3').scope).toBe('excluded');
    expect(byRef('@app/web@1.0.0').type).toBe('application');
    expect(npmPurl('@a/b', '1')).toBe('pkg:npm/%40a/b@1');
    expect(sha512Hex('sha1-x sha512-AQID')).toBe('010203');
  });

  it('resolves dependencies through node_modules the way Node does', () => {
    const deps = (ref: string) => bom.dependencies.find((d: { ref: string }) => d.ref === ref)?.dependsOn;
    expect(deps('next@1.2.3')).toEqual(['@scope/lib@2.0.0']);
    expect(deps('@app/web@1.0.0')).toEqual(['next@1.2.3', 'typescript@5.9.3']);
    expect(deps('app@1.0.0')).toEqual(['@app/web@1.0.0']);
  });

  it('fails closed on an old or foreign lockfile', () => {
    const opts = { timestamp: 't', serialNumber: 's' };
    expect(() => buildCycloneDxBom({ ...lock, lockfileVersion: 1 }, { name: 'app', version: '1' }, opts)).toThrow(/lockfile version/);
    expect(() => buildCycloneDxBom(lock, { name: 'other', version: '1' }, opts)).toThrow(/names "app"/);
  });

  it('runs before every pilot build and has its own npm shortcut', () => {
    const pilot = read('scripts/build-pilot.mjs');
    expect(pilot).toContain("import { writeSbom } from './generate-sbom.mjs'");
    expect(pilot.indexOf('writeSbom(root)')).toBeLessThan(pilot.indexOf("spawn(process.execPath, [nextBin, 'build'"));
    expect(JSON.parse(read('package.json')).scripts.sbom).toBe('node scripts/generate-sbom.mjs');
    expect(read('.gitignore')).toContain('/sbom.json');
    const script = read('scripts/generate-sbom.mjs');
    expect(script).not.toMatch(/from 'node:(child_process|https?|net)'/);
  });
});

describe('the officer manuals (Sprint 9 Revision 7.1: sequential numbering, mirrored shared tasks)', () => {
  const manuals = Object.fromEntries(MANUAL_FILES.map((f) => [f, read(f)]));
  const admin = manuals['docs/ADMIN_USER_GUIDE.md'];
  const titles = (markdown: string) => [...markdown.matchAll(/^#{3,4}\s+\d+(?:\.\d+)+\s+(.+)$/gm)].map((m) => m[1]);
  /** One task's text from its heading to the next heading, without the heading (whose number differs per manual). */
  const sectionBody = (markdown: string, title: string) => {
    const lines = markdown.split('\n');
    const at = lines.findIndex((l) => /^#{3,4} [\d.]+ /.test(l) && l.replace(/^#{3,4} [\d.]+ /, '') === title);
    if (at < 0) return null;
    const rest = lines.slice(at + 1);
    const next = rest.findIndex((l) => /^#{2,4} /.test(l));
    return rest.slice(0, next < 0 ? undefined : next).join('\n').trim();
  };

  it('numbers every manual 1, 2, 3 with no gaps', () => {
    for (const file of MANUAL_FILES) {
      const md = manuals[file];
      const chapters = [...md.matchAll(/^## (\d+)\. /gm)].map((m) => Number(m[1]));
      expect(chapters, file).toEqual(chapters.map((_, i) => i + 1));
      for (const chapter of chapters) {
        const tops = sectionIds(md)
          .filter((id) => id.split('.').length === 2 && id.startsWith(`${chapter}.`))
          .map((id) => Number(id.split('.')[1]));
        expect(tops, `${file} chapter ${chapter}`).toEqual(tops.map((_, i) => i + 1));
      }
      expect(new Set(sectionIds(md)).size, file).toBe(sectionIds(md).length);
    }
  });

  it('prints each shared task word for word in every manual of the officers who do it', () => {
    const shared: [string, string[]][] = [
      ['Post to the ledger or reconcile a bank statement', ['TREASURER_MANUAL', 'FINANCIAL_SECRETARY_MANUAL']],
      ['Vet a charity request', ['EXECUTIVE_GOVERNANCE_MANUAL', 'TREASURER_MANUAL', 'FINANCIAL_SECRETARY_MANUAL']],
      ['Endorse an approved charity grant for payment', ['EXECUTIVE_GOVERNANCE_MANUAL', 'FINANCIAL_SECRETARY_MANUAL']],
      ["Record the council's budget vote by July 10", ['EXECUTIVE_GOVERNANCE_MANUAL', 'TREASURER_MANUAL', 'FINANCIAL_SECRETARY_MANUAL']],
      ['Change the Council Wide Settings', ['ADMIN_USER_GUIDE', 'EXECUTIVE_GOVERNANCE_MANUAL']],
      ['Pay an approved charity grant', ['TREASURER_MANUAL', 'FINANCIAL_SECRETARY_MANUAL']],
    ];
    for (const [title, files] of shared) {
      const bodies = files.map((f) => sectionBody(manuals[`docs/${f}.md`], title));
      expect(bodies.every((b) => b !== null && b.length > 200), title).toBe(true);
      // A cross-reference may name another manual in one copy; the steps themselves are identical.
      const unref = (s: string) =>
        s
          .replace(/\b(sections?|Chapter) [\d.]*\d( of the (Treasurer Manual|Financial Secretary Manual|Executive Governance Manual|Administrator User Guide))?/gi, '$1 #')
          .replace(/\((section )?[\d.]*\d( of the [^)]+)?\)/g, '(#)');
      const steps = bodies.map((b) => unref(b!.slice(b!.indexOf('**Steps:**'), b!.indexOf('**Expected result:**'))));
      for (const s of steps) expect(s, title).toBe(steps[0]);
    }
  });

  it('names the other manual whenever a reference leaves this one', () => {
    for (const file of MANUAL_FILES) {
      const md = manuals[file];
      const ids = new Set([...sectionIds(md), ...[...md.matchAll(/^## (\d+)\. /gm)].map((m) => m[1])]);
      for (const m of md.matchAll(/(?<!article \d, )\b[Ss]ections? (\d+(?:\.\d+)*)(?![\d(.])(?! of the )/g)) {
        expect(ids.has(m[1]), `${file}: ${m[0]}`).toBe(true);
      }
    }
    expect(manuals['docs/EXECUTIVE_GOVERNANCE_MANUAL.md']).toContain('article 2, section 3');
  });

  it('prunes the Administrator guide to system maintenance', () => {
    for (const officerTask of ['Issue a payment request', 'Give the final release for payment', 'Run a live meeting', 'Code sheets from the Treasurer Desk', 'Code electronic donations in a batch']) {
      expect(titles(admin)).not.toContain(officerTask);
    }
    for (const chapter of [
      '## 12. Reset the database to the seed data',
      '## 13. Network addresses, ports and configuration keys',
      '## 14. Firewall clearance',
      '## 15. The software bill of materials (SBOM)',
    ]) {
      expect(admin).toContain(chapter);
    }
    expect(admin).toContain('## 6. Data protection rules');
    expect(admin).toContain('## 7. Troubleshooting reference');
    expect(admin).toContain('`0.0.0.0`');
    expect(admin).toContain('New-NetFirewallRule');
    expect(admin).toContain('-Profile Private');
    expect(admin).toContain('npm run hub:archive');
    expect(admin).toContain('CycloneDX 1.5');
  });

  it('gives the Treasurer the double-entry primer, bulk coding and GL splits', () => {
    const t = manuals['docs/TREASURER_MANUAL.md'];
    expect(t).toContain('## 1. Double-entry bookkeeping primer');
    expect(t).toContain('### 1.2 Concept: the five account types');
    for (const title of ['Code sheets from the Treasurer Desk', 'Code electronic donations in a batch', 'Set up a split account', 'Issue a Church Disbursement Request']) {
      expect(titles(t)).toContain(title);
    }
    expect(titles(t)).not.toContain('Pay a Church Disbursement Request');
  });

  it('gives the Financial Secretary and the GK/DGK their own books', () => {
    const f = titles(manuals['docs/FINANCIAL_SECRETARY_MANUAL.md']);
    for (const title of ['Issue a payment request', 'Run the Supreme roster sync', 'Pay a Church Disbursement Request', 'Check for inactive members (the inactivity sweep)']) {
      expect(f).toContain(title);
    }
    const e = manuals['docs/EXECUTIVE_GOVERNANCE_MANUAL.md'];
    for (const title of ['Run a live meeting', 'Give the final release for payment', 'Approve or reject held volunteer time']) expect(titles(e)).toContain(title);
    expect(e).toContain('The Deputy Grand Knight holds every grant of the Grand Knight.');
  });

  it('compiles all three role books with the guides', () => {
    const compiler = read('scripts/compile_all_manuals.py');
    for (const key of ['treasurer', 'financial-secretary', 'executive']) expect(compiler).toContain(`key='${key}'`);
    for (const m of ROLE_MANUAL_KEYS.map((k) => ROLE_MANUALS[k])) {
      expect(existsSync(join(root, 'docs', m.markdown))).toBe(true);
      expect(compiler).toContain(`output='docs/${m.pdf}'`);
    }
  });
});

describe('the desk manual headers', () => {
  it('maps each officer desk to its seat manual by token', () => {
    expect(roleManualForDesk('grand-knight')?.token).toBe('EXECUTIVE_GOVERNANCE_MANUAL');
    expect(roleManualForDesk('financial-secretary')?.token).toBe('FINANCIAL_SECRETARY_MANUAL');
    expect(roleManualForDesk('treasurer')?.token).toBe('TREASURER_MANUAL');
    expect(roleManualForDesk('member')).toBeNull();
    expect(roleManualByToken('TREASURER_MANUAL').key).toBe('treasurer');
    expect(roleManualPdfHref('treasurer')).toBe('/api/manuals/pdf?manual=treasurer');
    expect(roleManualTasksHref('executive')).toBe('/api/manuals?manual=executive');
  });

  it('mounts the header on top of each officer desk', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    for (const token of ['EXECUTIVE_GOVERNANCE_MANUAL', 'FINANCIAL_SECRETARY_MANUAL', 'TREASURER_MANUAL']) {
      expect(desks).toContain(`<DeskManualHeader manual="${token}" />`);
    }
    const header = read('apps/web/components/DeskManualHeader.tsx');
    expect(header).toContain('How do I…');
    expect(header).toContain('navigator.clipboard.writeText');
  });

  it('serves the tasks and the PDF to signed-in members only', () => {
    for (const route of ['apps/web/app/api/manuals/route.ts', 'apps/web/app/api/manuals/pdf/route.ts']) {
      const src = read(route);
      expect(src).toContain('requirePortalSession');
      expect(src).toContain('isRoleManualKey');
    }
    expect(read('apps/web/app/api/manuals/pdf/route.ts')).toContain("'Content-Type': 'application/pdf'");
  });

  it("answers 'How do I…' from the seat's own manual only", () => {
    const tasks = (key: (typeof ROLE_MANUAL_KEYS)[number]) => parseGuideTasks(read(`docs/${ROLE_MANUALS[key].markdown}`));
    const treasurer = tasks('treasurer');
    expect(searchRoleManual(treasurer, 'code electronic donations in a batch')[0].title).toBe('Code electronic donations in a batch');
    expect(searchRoleManual(treasurer, 'issue a payment request').map((t) => t.title)).not.toContain('Issue a payment request');
    expect(searchRoleManual(tasks('financial-secretary'), 'issue a payment request')[0]).toMatchObject({ id: '1.2', title: 'Issue a payment request' });
    expect(searchRoleManual(tasks('executive'), 'final release for payment')[0].title).toBe('Give the final release for payment');
    expect(searchRoleManual(treasurer, 'how do I').length).toBe(0);
    expect(treasurer.find((t) => t.title === 'Pay approved reports by check')?.who).toMatch(/Treasurer/);
  });
});

describe('the Council Historian inherits the member links', () => {
  const member = { memberId: 40, councilId: 1, memberType: 'Member' as const, isOfficer: false, roles: [] as string[] };
  const historian = { ...member, memberId: 32, roles: ['Council Historian'] };
  const links = (u: typeof member) => portalSidebar(u).flatMap((g) => g.entries.map((e) => e.item as string));

  it('shows Home, the Member Actions Hub and the Visual Master Calendar', () => {
    expect(MEMBER_BASE_AREAS).toEqual(expect.arrayContaining(['home', 'member-actions', 'calendar']));
    for (const item of ['home', 'member-actions', 'calendar']) expect(links(historian)).toContain(item);
  });

  it('keeps every link a plain member has', () => {
    expect(links(historian)).toEqual(expect.arrayContaining(links(member)));
    expect(portalAreas(historian)).toEqual(expect.arrayContaining(portalAreas(member)));
  });

  it('starts every role from the base member links', () => {
    const seats = [['Grand Knight'], ['Treasurer'], ['Financial Secretary'], ['Recorder'], ['Council Historian', 'Trustee 1']];
    for (const roles of seats) {
      const areas = portalAreas({ ...member, roles, isOfficer: !roles.includes('Council Historian') || roles.length > 1 });
      for (const base of MEMBER_BASE_AREAS) expect(areas).toContain(base);
    }
    expect(read('packages/shared/src/permissions.ts')).toContain('const areas: PortalArea[] = [...MEMBER_BASE_AREAS];');
  });
});
