// Sprint 8J (schema version 80): the cross-council Operations Knowledge Archive with originating council stamps and the
// home-council toggle, the vault's content guard, and the two-stage KofC Charter compliance gate.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertCharterCompliant,
  BusinessRuleError,
  CHARTER_RULES,
  CHARTER_SECTION_CHECK,
  cleanOperationsKnowledgeEntry,
  filterOperationsKnowledge,
  knowledgeContentProblem,
  operationsKnowledgeCouncilStamp,
  reviewCharterCompliance,
  withOriginCouncilStamp,
  type CouncilOperationsKnowledge,
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

const ids = (text: string) => reviewCharterCompliance(text).findings.map((f) => f.id);

describe('schema version 80', () => {
  it('adds origin_council_stamp and moves the phone database to 80', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('(schema version 80)');
    expect(schema).toContain("ALTER TABLE [CouncilOperationsKnowledge] ADD [origin_council_stamp] VARCHAR(255) NOT NULL DEFAULT '';");
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (80|8[1-9]|9\d);/);
    expect(read('apps/mobile/services/generated/schema.sqlite.ts')).toContain('[origin_council_stamp]');
  });

  it('stamps every seeded entry and adds two brother-council entries', async () => {
    const demo = new MemoryDataService({ presentationData: true });
    await demo.init();
    const rows = demo.debugStore.rows('CouncilOperationsKnowledge') as unknown as CouncilOperationsKnowledge[];
    expect(rows).toHaveLength(7);
    expect(new Set(rows.map((r) => r.council_id))).toEqual(new Set([1, 2, 3]));
    for (const r of rows) {
      const c = demo.debugStore.rows('Council').find((x) => x.id === r.council_id)!;
      expect(r.origin_council_stamp).toBe(`Council ${c.CouncilNumber} · ${c.CouncilName}`);
    }
  });
});

describe('the originating council stamp and the home-council filter (pure)', () => {
  const row = (entry_id: number, council_id: number, stamp: string): CouncilOperationsKnowledge => ({
    entry_id,
    council_id,
    category_tag: 'LOGISTICS',
    entry_text: 'Note',
    officer_signature: 'A B, Grand Knight',
    date_logged: `2026-0${entry_id}-01 10:00:00`,
    origin_council_stamp: stamp,
  });

  it('formats the stamp and fills a blank one from the council table', () => {
    expect(operationsKnowledgeCouncilStamp({ CouncilNumber: 2042, CouncilName: 'St. Anthony Council' })).toBe('Council 2042 · St. Anthony Council');
    const filled = withOriginCouncilStamp([row(1, 2, ''), row(2, 9, ''), row(3, 1, 'Kept')], [{ id: 2, CouncilNumber: 2042, CouncilName: 'St. Anthony Council' }]);
    expect(filled.map((r) => r.origin_council_stamp)).toEqual(['Council 2042 · St. Anthony Council', 'Council #9', 'Kept']);
  });

  it('narrows to the home council and searches the stamp', () => {
    const rows = [row(1, 1, 'Council 15295 · St. Mary'), row(2, 2, 'Council 2042 · St. Anthony'), row(3, 1, 'Council 15295 · St. Mary')];
    expect(filterOperationsKnowledge(rows).map((r) => r.entry_id)).toEqual([3, 2, 1]);
    expect(filterOperationsKnowledge(rows, { homeCouncilId: 1 }).map((r) => r.entry_id)).toEqual([3, 1]);
    expect(filterOperationsKnowledge(rows, { homeCouncilId: null }).map((r) => r.entry_id)).toEqual([3, 2, 1]);
    expect(filterOperationsKnowledge(rows, { query: 'anthony' }).map((r) => r.entry_id)).toEqual([2]);
  });
});

describe('the KofC Charter compliance gate (pure)', () => {
  it('blocks endorsing or opposing a candidate for public office', () => {
    for (const text of [
      'The council should endorse the Republican candidate this fall.',
      'We will campaign for Smith for mayor.',
      'Members should oppose the political candidate on the ballot.',
      'Vote for Jones for school board, says the Grand Knight.',
    ]) {
      const r = reviewCharterCompliance(text);
      expect(r.blocksSave, text).toBe(true);
      expect(r.level).toBe('SEVERE');
      expect(ids(text)).toContain('candidate-endorsement');
    }
  });

  it('blocks council money to campaigns and parties, and private use of council funds', () => {
    expect(ids('We donated $500 from the general fund to a super PAC.')).toContain('political-contribution');
    expect(ids('Write a check to the re-election committee.')).toContain('political-contribution');
    expect(ids('He used council funds for personal expenses.')).toContain('private-benefit');
    expect(ids('Borrow charity money until payday.')).toContain('private-benefit');
  });

  it('warns without blocking on partisan material, the Order name, ballot measures and unrecorded cash', () => {
    for (const [text, id] of [
      ['No campaign signs at the pancake breakfast.', 'partisan-materials'],
      ["Don't put the Knights of Columbus emblem on a political flyer.", 'order-name-in-politics'],
      ['Ask the State Deputy before the council speaks on a ballot measure.', 'ballot-measure'],
      ['The raffle cash was kept without receipts last year.', 'off-the-books'],
    ] as const) {
      const r = reviewCharterCompliance(text);
      expect(ids(text), text).toContain(id);
      expect(r.level, text).toBe('ADVISORY');
      expect(r.blocksSave, text).toBe(false);
    }
  });

  it('leaves ordinary council vocabulary alone', () => {
    for (const text of [
      'Bring Form 100 copies for the degree candidates.',
      'Elect the new Grand Knight in May; the nominees speak first.',
      'Donate the proceeds to the Coats for Kids campaign.',
      'Give each candidate a rosary at the Exemplification.',
      'We support the seminarians and the parish school board breakfast.',
      'File Form 1728 by January 31 and deposit every check.',
    ]) {
      expect(reviewCharterCompliance(text), text).toEqual({ findings: [], level: null, blocksSave: false });
    }
  });

  it('cites authorities honestly: no invented Charter section numbers', () => {
    for (const r of CHARTER_RULES) {
      expect(r.authority).not.toMatch(/\b(section|sec\.|§)\s*\d+\b(?!\(c\))/i);
      expect(r.authority).not.toMatch(/chapter \d+|verse \d+/i);
    }
    expect(CHARTER_SECTION_CHECK).toContain('State Deputy');
    expect(reviewCharterCompliance('endorse the candidate for mayor').findings[0].quotation).toContain('any candidate for public office');
  });

  it('refuses CHARTER_VIOLATION_BLOCKED only for a SEVERE rule', () => {
    expect(code(() => assertCharterCompliant('Endorse the candidate for governor.'))).toBe('CHARTER_VIOLATION_BLOCKED');
    expect(code(() => assertCharterCompliant('No campaign signs in the hall.'))).toBe('ok');
  });
});

describe('the vault content guard (pure)', () => {
  it('refuses foul, hateful and partisan text before the Charter gate, naming the kind but not the word', () => {
    let err: unknown;
    try {
      cleanOperationsKnowledgeEntry({ category_tag: 'LOGISTICS', entry_text: 'The fryer is a piece of shit.' });
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ code: 'KNOWLEDGE_CONTENT_BLOCKED', details: { category: 'profanity' } });
    expect((err as Error).message).not.toContain('shit');
    expect(code(() => cleanOperationsKnowledgeEntry({ category_tag: 'COMPLIANCE', entry_text: 'The GOP is right.' }))).toBe('KNOWLEDGE_CONTENT_BLOCKED');
    expect(code(() => cleanOperationsKnowledgeEntry({ category_tag: 'COMPLIANCE', entry_text: 'Endorse the candidate for mayor.' }))).toBe('CHARTER_VIOLATION_BLOCKED');
    expect(code(() => cleanOperationsKnowledgeEntry({ category_tag: 'COMPLIANCE', entry_text: 'No campaign signs in the hall.' }))).toBe('ok');
    expect(knowledgeContentProblem('Book the hall early.')).toBeNull();
    expect(knowledgeContentProblem('wtf')).toContain('foul or vulgar language');
  });
});

describe.each(drivers)('the cross-council archive in the $name driver', (d) => {
  it('stamps new entries and lets an officer of any council read every council', async () => {
    const db = await d.make();
    const other = rawInsert(db, 'Council', { CouncilNumber: 2042, CouncilName: 'St. Anthony Council', State: 'OR' });
    const mine = await db.history.addOperationsKnowledge(MEMBER.admin, 1, { category_tag: 'CLERGY', entry_text: 'Call Father first.' });
    expect(mine.origin_council_stamp).toMatch(/^Council \d+ · /);
    const theirs = await db.history.addOperationsKnowledge(MEMBER.superAdmin, other, { category_tag: 'LOGISTICS', entry_text: 'Tables in the hall.' });
    expect(theirs.origin_council_stamp).toBe('Council 2042 · St. Anthony Council');

    rawInsert(db, 'MemberRoles', { RoleID: 6, MemberID: MEMBER.member }); // Treasurer: an officer of council 1
    const all = await db.history.listOperationsKnowledge(MEMBER.member);
    expect(all.map((r) => r.entry_id)).toEqual([theirs.entry_id, mine.entry_id].sort((a, b) => b - a));
    expect(filterOperationsKnowledge(all, { homeCouncilId: 1 }).map((r) => r.entry_id)).toEqual([mine.entry_id]);
  });

  it('refuses blocked content and SEVERE Charter violations without writing', async () => {
    const db = await d.make();
    await expectRule(db.history.addOperationsKnowledge(MEMBER.admin, 1, { category_tag: 'RECRUITING', entry_text: 'Tell the bastards to piss off.' }), 'KNOWLEDGE_CONTENT_BLOCKED');
    await expectRule(
      db.history.addOperationsKnowledge(MEMBER.admin, 1, { category_tag: 'TREASURY', entry_text: 'Pay $200 from the council account to the political action committee.' }),
      'CHARTER_VIOLATION_BLOCKED',
    );
    expect(d.count(db, 'CouncilOperationsKnowledge')).toBe(0);
    // An advisory still saves.
    await db.history.addOperationsKnowledge(MEMBER.admin, 1, { category_tag: 'COMPLIANCE', entry_text: 'Keep campaign signs out of the parish hall.' });
    expect(d.count(db, 'CouncilOperationsKnowledge')).toBe(1);
  });
});

describe('the Sprint 8J screens and manual', () => {
  it('puts the home-council toggle and the council badge on the archive', () => {
    const parts = read('apps/web/components/KnowledgeVaultParts.tsx');
    expect(parts).toContain('Filter by My Home Council Only');
    expect(parts).toContain('homeCouncilId: homeOnly ? user.councilId : null');
    expect(parts).toContain('<CouncilStampBadge');
  });

  it('runs the Charter gate in the vault editor and disables saving on a SEVERE rule', () => {
    const parts = read('apps/web/components/KnowledgeVaultParts.tsx');
    expect(parts).toContain('reviewCharterCompliance(text)');
    expect(parts).toContain('<CharterAdvisoryPanel review={review} />');
    expect(parts).toContain('review.blocksSave || contentProblem !== null');
  });

  it('documents the sprint in the admin guide', () => {
    const guide = read('docs/ADMIN_USER_GUIDE.md');
    expect(guide).toContain('Filter by My Home Council Only');
    expect(guide).toContain('Charter Advisory Warning');
  });
});
