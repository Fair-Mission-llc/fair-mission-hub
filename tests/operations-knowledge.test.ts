// Sprint 8I (schema version 79): the Operations Knowledge Vault on the Oversight Desk and its read-only
// Operations Knowledge Vault under System Settings.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertMayReadOperationsKnowledge,
  assertMayWriteOperationsKnowledge,
  BusinessRuleError,
  canOpenKnowledgeArchive,
  canWriteOperationsKnowledge,
  cleanOperationsKnowledgeEntry,
  filterOperationsKnowledge,
  knowledgeFraternalYear,
  knowledgeYearsOf,
  OPERATIONS_KNOWLEDGE_CATEGORIES,
  OPERATIONS_KNOWLEDGE_MAX_LENGTH,
  operationsKnowledgeSignature,
  portalAreas,
  PORTAL_NAV_GROUPS,
  type CouncilOperationsKnowledge,
  type MemberWriteActor,
  type OperationsKnowledgeCategory,
} from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { drivers, expectRule, MEMBER, rawInsert } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

const code = (fn: () => unknown): string => {
  try {
    fn();
    return 'ok';
  } catch (err) {
    return err instanceof BusinessRuleError ? err.code : String(err);
  }
};

const writer = (over: Partial<MemberWriteActor> = {}): MemberWriteActor => ({ memberId: 9, councilId: 1, memberType: 'Member', active: true, roles: [], ...over });

const portalUser = (memberType: 'Super Admin' | 'Admin' | 'Member', roles: string[] = [], councilId = 1) => ({
  memberId: 9,
  councilId,
  memberType,
  isOfficer: roles.length > 0,
  roles,
});

const entry = (entry_id: number, category_tag: OperationsKnowledgeCategory, date_logged: string, entry_text = 'Note', officer_signature = 'Tom McDougal, Grand Knight'): CouncilOperationsKnowledge => ({
  entry_id,
  council_id: 1,
  category_tag,
  entry_text,
  officer_signature,
  date_logged,
  origin_council_stamp: "Council 15295 · St. Mary's Cathedral Council",
});

describe('schema version 79', () => {
  it('adds CouncilOperationsKnowledge and moves the phone database to 79', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('(schema version 79)');
    expect(schema).toContain('CREATE TABLE [CouncilOperationsKnowledge]');
    for (const col of ['[entry_id] INT NOT NULL IDENTITY', '[council_id] INT NOT NULL', '[category_tag] VARCHAR(20) NOT NULL', '[entry_text] TEXT NOT NULL', '[officer_signature] VARCHAR(255) NOT NULL', '[date_logged] DATETIME NOT NULL']) {
      expect(schema).toContain(col);
    }
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (79|8\d|9\d|\d{3});/);
    expect(read('apps/mobile/services/generated/schema.sqlite.ts')).toContain('CREATE TABLE IF NOT EXISTS [CouncilOperationsKnowledge]');
    expect(read('Seed.sql')).toContain('INSERT INTO [CouncilOperationsKnowledge]');
  });

  it('seeds five signed St. Mary entries in the presentation data only', async () => {
    const plain = new MemoryDataService();
    await plain.init();
    expect(plain.debugStore.rows('CouncilOperationsKnowledge')).toHaveLength(0);
    const demo = new MemoryDataService({ presentationData: true });
    await demo.init();
    // Sprint 8J adds one entry each from two brother councils after St. Mary's five.
    const rows = (demo.debugStore.rows('CouncilOperationsKnowledge') as unknown as CouncilOperationsKnowledge[]).filter((r) => r.council_id === 1);
    expect(rows.map((r) => r.category_tag)).toEqual(['RECRUITING', 'TREASURY', 'CLERGY', 'COMPLIANCE', 'LOGISTICS']);
    expect(knowledgeYearsOf(rows)).toEqual(['2026-2027', '2025-2026', '2024-2025']);
    expect(rows.every((r) => /, (Grand Knight|Deputy Grand Knight)$/.test(r.officer_signature))).toBe(true);
  });
});

describe('the vault rules (pure)', () => {
  it('offers exactly the six governance tags', () => {
    expect(OPERATIONS_KNOWLEDGE_CATEGORIES).toEqual(['RECRUITING', 'TREASURY', 'CLERGY', 'COMPLIANCE', 'DEVOTIONAL', 'LOGISTICS']);
  });

  it('cleans an entry: a known tag, trimmed text, no blank and no overlong note', () => {
    expect(cleanOperationsKnowledgeEntry({ category_tag: 'CLERGY', entry_text: '  Call Father first.\r\n' })).toEqual({ category_tag: 'CLERGY', entry_text: 'Call Father first.' });
    expect(code(() => cleanOperationsKnowledgeEntry({ category_tag: 'GOSSIP' as never, entry_text: 'x' }))).toBe('INVALID_INPUT');
    expect(code(() => cleanOperationsKnowledgeEntry({ category_tag: 'TREASURY', entry_text: '   ' }))).toBe('INVALID_INPUT');
    expect(code(() => cleanOperationsKnowledgeEntry({ category_tag: 'TREASURY', entry_text: 'x'.repeat(OPERATIONS_KNOWLEDGE_MAX_LENGTH + 1) }))).toBe('INVALID_INPUT');
    expect(code(() => cleanOperationsKnowledgeEntry({ category_tag: 'TREASURY', entry_text: 'x'.repeat(OPERATIONS_KNOWLEDGE_MAX_LENGTH) }))).toBe('ok');
  });

  it('stamps the signature with the name and the highest seat', () => {
    expect(operationsKnowledgeSignature('Tom', 'McDougal', { memberType: 'Member', roles: ['Grand Knight'] })).toBe('Tom McDougal, Grand Knight');
    expect(operationsKnowledgeSignature('David', 'Reyes', { memberType: 'Admin', roles: ['Deputy Grand Knight'] })).toBe('David Reyes, Deputy Grand Knight');
    expect(operationsKnowledgeSignature('Council', 'Admin', { memberType: 'Admin', roles: ['Financial Secretary'] })).toBe('Council Admin, Admin');
    expect(operationsKnowledgeSignature('Super', 'Admin', { memberType: 'Super Admin', roles: [] })).toBe('Super Admin, Super Admin');
  });

  it('lets Admins, the Grand Knight and the Deputy Grand Knight write, and officers read', () => {
    expect(code(() => assertMayWriteOperationsKnowledge(writer({ roles: ['Grand Knight'] }), 1, 'write'))).toBe('ok');
    expect(code(() => assertMayWriteOperationsKnowledge(writer({ roles: ['Deputy Grand Knight'] }), 1, 'write'))).toBe('ok');
    expect(code(() => assertMayWriteOperationsKnowledge(writer({ memberType: 'Admin' }), 1, 'write'))).toBe('ok');
    expect(code(() => assertMayWriteOperationsKnowledge(writer({ memberType: 'Super Admin' }), 2, 'write'))).toBe('ok');
    expect(code(() => assertMayWriteOperationsKnowledge(writer({ roles: ['Treasurer'], officer: true }), 1, 'write'))).toBe('GRAND_KNIGHT_REQUIRED');
    expect(code(() => assertMayWriteOperationsKnowledge(writer({ roles: ['Grand Knight'], active: false }), 1, 'write'))).toBe('GRAND_KNIGHT_REQUIRED');
    expect(code(() => assertMayWriteOperationsKnowledge(writer({ roles: ['Grand Knight'] }), 2, 'write'))).toBe('COUNCIL_ACCESS_DENIED');

    expect(code(() => assertMayReadOperationsKnowledge(writer({ roles: ['Treasurer'], officer: true }), 'read'))).toBe('ok');
    expect(code(() => assertMayReadOperationsKnowledge(writer({ memberType: 'Admin' }), 'read'))).toBe('ok');
    expect(code(() => assertMayReadOperationsKnowledge(writer(), 'read'))).toBe('ADMIN_REQUIRED');
    expect(code(() => assertMayReadOperationsKnowledge(writer({ roles: ['Treasurer'], officer: true, active: false }), 'read'))).toBe('ADMIN_REQUIRED');
    // Sprint 8J: an officer of another council reads the shared archive too.
    expect(code(() => assertMayReadOperationsKnowledge(writer({ roles: ['Treasurer'], officer: true, councilId: 2 }), 'read'))).toBe('ok');
  });

  it('mirrors the gates in the portal', () => {
    expect(canWriteOperationsKnowledge(portalUser('Member', ['Grand Knight']), 1)).toBe(true);
    expect(canWriteOperationsKnowledge(portalUser('Member', ['Deputy Grand Knight']), 1)).toBe(true);
    expect(canWriteOperationsKnowledge(portalUser('Admin'), 1)).toBe(true);
    expect(canWriteOperationsKnowledge(portalUser('Admin'), 2)).toBe(false);
    expect(canWriteOperationsKnowledge(portalUser('Member', ['Treasurer']), 1)).toBe(false);
    expect(canWriteOperationsKnowledge(portalUser('Super Admin'), 2)).toBe(true);
    expect(canOpenKnowledgeArchive(portalUser('Member', ['Recorder']))).toBe(true);
    expect(canOpenKnowledgeArchive(portalUser('Member'))).toBe(false);
    expect(portalAreas(portalUser('Member', ['Treasurer']))).toContain('system-settings/knowledge-archive');
    expect(portalAreas(portalUser('Member'))).not.toContain('system-settings/knowledge-archive');
    expect(PORTAL_NAV_GROUPS.find((g) => g.id === 'setup')?.items).toContain('system-settings/knowledge-archive');
  });

  it('files entries by fraternal year and filters by tag, year and words', () => {
    expect(knowledgeFraternalYear('2026-06-30 23:59:00')).toBe('2025-2026');
    expect(knowledgeFraternalYear('2026-07-01 00:00:00')).toBe('2026-2027');
    const rows = [
      entry(1, 'RECRUITING', '2025-03-18 20:10:00', 'Church drive weekends'),
      entry(2, 'TREASURY', '2025-07-22 19:30:00', 'Bank signers', 'David Reyes, Deputy Grand Knight'),
      entry(3, 'TREASURY', '2026-01-12 18:45:00', 'Form 1295 audit'),
      entry(4, 'LOGISTICS', '2026-09-02 17:20:00', 'Fryer set in the garage'),
    ];
    expect(filterOperationsKnowledge(rows).map((r) => r.entry_id)).toEqual([4, 3, 2, 1]);
    expect(filterOperationsKnowledge(rows, { category: 'TREASURY' }).map((r) => r.entry_id)).toEqual([3, 2]);
    expect(filterOperationsKnowledge(rows, { fraternalYear: '2025-2026' }).map((r) => r.entry_id)).toEqual([3, 2]);
    expect(filterOperationsKnowledge(rows, { category: 'TREASURY', fraternalYear: '2025-2026', query: 'deputy' }).map((r) => r.entry_id)).toEqual([2]);
    expect(filterOperationsKnowledge(rows, { query: 'FORM audit' }).map((r) => r.entry_id)).toEqual([3]);
    expect(filterOperationsKnowledge(rows, { query: 'nothing here' })).toEqual([]);
    expect(knowledgeYearsOf(rows)).toEqual(['2026-2027', '2025-2026', '2024-2025']);
  });
});

describe.each(drivers)('the Operations Knowledge Vault in the $name driver', (d) => {
  it('appends signed entries and lists them newest first', async () => {
    const db = await d.make(); // 2026-09-20 12:00
    // The seeded Super Admin holds the Grand Knight seat; the Council Admin is the Financial Secretary.
    const first = await db.history.addOperationsKnowledge(MEMBER.superAdmin, 1, { category_tag: 'CLERGY', entry_text: '  Call Father first.  ' });
    expect(first).toMatchObject({ council_id: 1, category_tag: 'CLERGY', entry_text: 'Call Father first.', officer_signature: 'Super Admin, Grand Knight' });
    expect(first.date_logged.slice(0, 10)).toBe('2026-09-20');
    const second = await db.history.addOperationsKnowledge(MEMBER.admin, 1, { category_tag: 'TREASURY', entry_text: '**Two** signers at the bank.' });
    expect(second.officer_signature).toBe('Council Admin, Admin');
    expect(second.entry_id).toBeGreaterThan(first.entry_id);

    const list = await db.history.listOperationsKnowledge(MEMBER.admin);
    expect(list.map((r) => r.entry_id)).toEqual([second.entry_id, first.entry_id]);
    expect(d.count(db, 'CouncilOperationsKnowledge')).toBe(2);
  });

  it('signs a Deputy Grand Knight by seat and lets other officers read only', async () => {
    const db = await d.make();
    rawInsert(db, 'MemberRoles', { RoleID: 2, MemberID: MEMBER.member }); // Deputy Grand Knight
    const dgk = await db.history.addOperationsKnowledge(MEMBER.member, 1, { category_tag: 'DEVOTIONAL', entry_text: 'Rosary before every meeting.' });
    expect(dgk.officer_signature).toBe('Brother Knight, Deputy Grand Knight');

    const fresh = await d.make();
    rawInsert(fresh, 'MemberRoles', { RoleID: 6, MemberID: MEMBER.member }); // Treasurer: an officer, not a writer
    expect(await fresh.history.listOperationsKnowledge(MEMBER.member)).toEqual([]);
    await expectRule(fresh.history.addOperationsKnowledge(MEMBER.member, 1, { category_tag: 'TREASURY', entry_text: 'x' }), 'GRAND_KNIGHT_REQUIRED');
    expect(d.count(fresh, 'CouncilOperationsKnowledge')).toBe(0);
  });

  it('rejects plain members, other councils and bad input without writing', async () => {
    const db = await d.make();
    await expectRule(db.history.listOperationsKnowledge(MEMBER.member), 'ADMIN_REQUIRED');
    await expectRule(db.history.addOperationsKnowledge(MEMBER.member, 1, { category_tag: 'RECRUITING', entry_text: 'x' }), 'GRAND_KNIGHT_REQUIRED');
    const other = rawInsert(db, 'Council', { CouncilNumber: 2042, CouncilName: 'St. Anthony Council', State: 'OR' });
    await expectRule(db.history.addOperationsKnowledge(MEMBER.admin, other, { category_tag: 'RECRUITING', entry_text: 'x' }), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.history.addOperationsKnowledge(MEMBER.admin, 1, { category_tag: 'GOSSIP' as never, entry_text: 'x' }), 'INVALID_INPUT');
    await expectRule(db.history.addOperationsKnowledge(MEMBER.admin, 1, { category_tag: 'RECRUITING', entry_text: ' ' }), 'INVALID_INPUT');
    await expectRule(db.history.addOperationsKnowledge(MEMBER.superAdmin, 9999, { category_tag: 'RECRUITING', entry_text: 'x' }), 'INVALID_INPUT');
    expect(d.count(db, 'CouncilOperationsKnowledge')).toBe(0);
    // A Super Admin writes for any council.
    expect((await db.history.addOperationsKnowledge(MEMBER.superAdmin, other, { category_tag: 'COMPLIANCE', entry_text: 'File Form 1728.' })).council_id).toBe(other);
  });
});

describe('the vault and archive screens', () => {
  it('puts the vault card on the Oversight Desk for its writers', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).toContain('OperationsKnowledgeArchiveEntryForm');
    expect(desks).toContain('canWriteOperationsKnowledge(user, councilId)');
    const parts = read('apps/web/components/KnowledgeArchiveParts.tsx');
    expect(parts).toContain('Operations Knowledge Vault');
    expect(parts).toContain('addOperationsKnowledge');
    expect(parts).toContain('<Markdown');
    expect(parts).toContain('data-surface="navy"');
  });

  it('serves the read-only archive under System Settings', () => {
    const page = read('apps/web/app/system-settings/knowledge-archive/page.tsx');
    expect(page).toContain('area="system-settings/knowledge-archive"');
    // Sprint 8P Stage 2: the body moved to a module so the GK and FS desk drawers mount it too.
    const archive = read('apps/web/components/modules/KnowledgeArchive.tsx');
    expect(archive).not.toContain('setCouncilId');
    expect(archive).toContain('KnowledgeArchiveGrid');
    const parts = read('apps/web/components/KnowledgeArchiveParts.tsx');
    expect(parts).toContain('filterOperationsKnowledge');
    expect(parts.slice(parts.indexOf('export function KnowledgeArchiveGrid'))).not.toContain('addOperationsKnowledge');
    expect(read('apps/web/components/Sidebar.tsx')).toContain("'system-settings/knowledge-archive'");
  });

  it('documents the sprint in the admin guide', () => {
    const guide = read('docs/ADMIN_USER_GUIDE.md');
    expect(guide).toContain('Operations Knowledge Vault');
    expect(guide).toContain('Operations Knowledge Vault');
  });
});
