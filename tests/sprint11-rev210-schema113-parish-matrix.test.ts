// Sprint 11 Revision 21.0 (schema 113): the relational parish matrix (Parishes, Pastors, PastorParishMappings), the
// parish's General Ledger Account Owner provisioned on the home parish link, the Local Feedback Portal's own tables,
// the training seed fixture, the auto-generated testing key and the Parish & Pastors Linkage chapters of the manuals.
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  GL_ACCOUNT_NAME_MAX_LENGTH,
  HUB_ACTOR_FIRST_METHODS,
  PARISH_ACCOUNT_PREFIX,
  PARISH_BASELINE_ASSET_ACCOUNTS,
  PARISH_PASTORS_TITLE,
  PLATFORM_SCHEMA_VERSION,
  PRACTICE_FUNDRAISER_COUNT,
  PRACTICE_MEMBER_COUNT,
  TESTING_KEY_FILE,
  TRAINING_CASH_BOXES,
  TRAINING_SEED,
  TRAINING_SEED_FIXTURE_PATH,
  parishBaselineAccountName,
  parishOwnerAccountName,
  parseTrainingSeed,
  practiceFundraisers,
  practiceRosterRows,
  trainingCashBoxName,
  type NewParish,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { ensureTestingKeyFile, meshPassphrase } from '../apps/web/services/server/hub/lan-mesh';
import { drivers, expectRule, MEMBER, NOW } from './helpers';

const read = (path: string) => readFileSync(path, 'utf8');
const OWN = 1;
const OTHER = 2;

const parishFor = (councilId: number, name = "St. Mary's Cathedral Parish"): NewParish => ({
  parish_name: name,
  street_address_1: '5200 NE Alameda St',
  city: 'Portland',
  state: 'OR',
  phone: '503-555-0210',
  council_id: councilId,
});

describe('0. schema 113', () => {
  it('moves the platform and the phone database to 113', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(113);
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toContain('const SCHEMA_VERSION = 113;');
    expect(read('Schema.sql')).toContain('THE RELATIONAL PARISH MATRIX AND LOCAL FEEDBACK TICKETS (schema version 113)');
  });

  it('replaces Parish and Pastor with Parishes, Pastors and PastorParishMappings', () => {
    const tables = TABLES as Record<string, { columns: { name: string }[] }>;
    expect(tables.Parish).toBeUndefined();
    expect(tables.Pastor).toBeUndefined();
    expect(tables.Parishes.columns.map((c) => c.name)).toEqual([
      'id', 'council_id', 'parish_name', 'street_address_1', 'street_address_2', 'city', 'state', 'phone', 'associated_council_id', 'gl_account_id', 'created_at',
    ]);
    expect(tables.Pastors.columns.map((c) => c.name)).toEqual(['id', 'council_id', 'first_name', 'last_name', 'phone', 'email', 'created_at']);
    expect(tables.PastorParishMappings.columns.map((c) => c.name)).toEqual(['id', 'pastor_id', 'parish_id', 'assigned_at']);
    const schema = read('Schema.sql');
    expect(schema).toContain('CREATE UNIQUE INDEX [Parishes_AssociatedCouncil_Idx] ON [Parishes] ([associated_council_id]) WHERE [associated_council_id] IS NOT NULL;');
    expect(schema).toContain('CREATE UNIQUE INDEX [PastorParishMappings_Pair_Idx] ON [PastorParishMappings] ([pastor_id], [parish_id]);');
  });

  it('adds LocalFeedbackTickets and LocalFeedbackTicketMessages', () => {
    const tables = TABLES as Record<string, { columns: { name: string }[] }>;
    expect(tables.LocalFeedbackTickets.columns.map((c) => c.name)).toEqual([
      'id', 'council_id', 'member_id', 'category', 'subject', 'body', 'status', 'opened_at', 'last_activity_at', 'resolved_at',
    ]);
    expect(tables.LocalFeedbackTicketMessages.columns.map((c) => c.name)).toEqual(['id', 'ticket_id', 'sender_id', 'entry_kind', 'status_to', 'message_text', 'created_at']);
    expect(read('packages/shared/src/local-feedback.ts')).not.toContain('#local-feedback-ticket');
    expect(read('packages/shared/src/messaging.ts')).not.toContain('local-feedback');
  });

  it('routes the new parish and pastor methods through the hub as actor-first', () => {
    for (const m of ['parishes.setCouncilAssociation', 'pastors.assignToParish', 'pastors.unassignFromParish']) expect(HUB_ACTOR_FIRST_METHODS.has(m), m).toBe(true);
  });
});

describe('1. the parish ledger names', () => {
  it('names the Account Owner and its baseline rows after the parish, within the ledger name limit', () => {
    expect(parishOwnerAccountName("St. Mary's Cathedral Parish")).toBe("Parish - St. Mary's Cathedral Parish");
    expect(parishBaselineAccountName("St. Mary's Cathedral Parish", 'Electronic Giving')).toBe("Parish - St. Mary's Cathedral Parish - Electronic Giving");
    const long = 'P'.repeat(100);
    expect(parishOwnerAccountName(long).length).toBe(GL_ACCOUNT_NAME_MAX_LENGTH);
    for (const { suffix } of PARISH_BASELINE_ASSET_ACCOUNTS) {
      const name = parishBaselineAccountName(long, suffix);
      expect(name.length).toBeLessThanOrEqual(GL_ACCOUNT_NAME_MAX_LENGTH);
      expect(name.endsWith(` - ${suffix}`)).toBe(true);
    }
  });
});

describe.each(drivers)('2. $name driver: linking a home parish provisions its General Ledger Account Owner', (d) => {
  it('creates the PARENT_ORGANIZATION owner and its baseline Asset rows in one call', async () => {
    const db = await d.make();
    const parish = await db.parishes.create(MEMBER.admin, parishFor(OWN));
    const accounts = d.count(db, 'GLAccount');
    const result = await db.parishes.setCouncilAssociation(MEMBER.admin, OWN, parish.id);

    expect(result.accountsCreated).toBe(1 + PARISH_BASELINE_ASSET_ACCOUNTS.length);
    expect(d.count(db, 'GLAccount')).toBe(accounts + 1 + PARISH_BASELINE_ASSET_ACCOUNTS.length);
    expect(result.parish).toMatchObject({ id: parish.id, associated_council_id: OWN, gl_account_id: result.ownerAccount!.id });
    expect(result.ownerAccount).toMatchObject({
      CouncilID: OWN,
      AccountName: `${PARISH_ACCOUNT_PREFIX}St. Mary's Cathedral Parish`,
      AccountType: 'Asset',
      ownership_type: 'PARENT_ORGANIZATION',
      account_display_name: "St. Mary's Cathedral Parish",
      contact_number: '503-555-0210',
    });
    expect(result.baselineAccounts.map((a) => a.AccountName)).toEqual(PARISH_BASELINE_ASSET_ACCOUNTS.map((b) => parishBaselineAccountName(parish.parish_name, b.suffix)));
    for (const a of result.baselineAccounts) expect(a).toMatchObject({ AccountType: 'Asset', ParentAccountID: result.ownerAccount!.id, ownership_type: 'PARENT_ORGANIZATION' });

    // The owner and its rows show in the Account Owners Matrix as Parish accounts.
    const matrix = await db.councils.listCouncilAccounts(MEMBER.admin, OWN);
    for (const a of [result.ownerAccount!, ...result.baselineAccounts]) expect(matrix.find((m) => m.id === a.id)?.ownership_type).toBe('PARENT_ORGANIZATION');
  });

  it('reuses the accounts on a second link and moves the link when another parish is linked', async () => {
    const db = await d.make();
    const mary = await db.parishes.create(MEMBER.admin, parishFor(OWN));
    const patrick = await db.parishes.create(MEMBER.admin, parishFor(OWN, 'St. Patrick Parish'));
    const first = await db.parishes.setCouncilAssociation(MEMBER.admin, OWN, mary.id);
    const again = await db.parishes.setCouncilAssociation(MEMBER.admin, OWN, mary.id);
    expect(again.accountsCreated).toBe(0);
    expect(again.ownerAccount!.id).toBe(first.ownerAccount!.id);

    // associated_council_id is unique: linking St. Patrick ends St. Mary's link.
    const moved = await db.parishes.setCouncilAssociation(MEMBER.admin, OWN, patrick.id);
    expect(moved.accountsCreated).toBe(1 + PARISH_BASELINE_ASSET_ACCOUNTS.length);
    expect((await db.parishes.get(mary.id))?.associated_council_id ?? null).toBeNull();
    expect((await db.parishes.get(patrick.id))?.associated_council_id).toBe(OWN);

    // Unlinking keeps every account; linking St. Mary again finds hers through gl_account_id.
    const accounts = d.count(db, 'GLAccount');
    const unlinked = await db.parishes.setCouncilAssociation(MEMBER.admin, OWN, null);
    expect(unlinked).toMatchObject({ parish: null, ownerAccount: null, accountsCreated: 0 });
    expect(d.count(db, 'GLAccount')).toBe(accounts);
    expect((await db.parishes.listByCouncil(OWN)).every((p) => p.associated_council_id == null)).toBe(true);
    expect((await db.parishes.setCouncilAssociation(MEMBER.admin, OWN, mary.id)).ownerAccount!.id).toBe(first.ownerAccount!.id);
  });

  it('keeps a linked parish and its owner account until they are unlinked', async () => {
    const db = await d.make();
    const parish = await db.parishes.create(MEMBER.admin, parishFor(OWN));
    const { ownerAccount, baselineAccounts } = await db.parishes.setCouncilAssociation(MEMBER.admin, OWN, parish.id);
    await expectRule(db.parishes.remove(MEMBER.admin, parish.id), 'RECORD_IN_USE');
    await expectRule(db.parishes.update(MEMBER.superAdmin, parish.id, { council_id: OTHER }), 'RECORD_IN_USE');
    await expectRule(db.councils.removeCouncilAccount(MEMBER.admin, OWN, ownerAccount!.id), 'RECORD_IN_USE');
    // The owner keeps its baseline rows filed under it.
    expect(baselineAccounts.every((a) => a.ParentAccountID === ownerAccount!.id)).toBe(true);

    await db.parishes.setCouncilAssociation(MEMBER.admin, OWN, null);
    await db.parishes.remove(MEMBER.admin, parish.id);
    expect(await db.parishes.get(parish.id)).toBeNull();
  });

  it('refuses members, other councils, foreign parishes and a clashing account name, writing nothing', async () => {
    const db = await d.make();
    const own = await db.parishes.create(MEMBER.admin, parishFor(OWN));
    const other = await db.parishes.create(MEMBER.superAdmin, parishFor(OTHER, 'Our Lady of Peace Parish'));
    const accounts = d.count(db, 'GLAccount');

    await expectRule(db.parishes.setCouncilAssociation(MEMBER.member, OWN, own.id), 'ADMIN_REQUIRED');
    await expectRule(db.parishes.setCouncilAssociation(MEMBER.admin, OTHER, other.id), 'COUNCIL_ACCESS_DENIED');
    await expectRule(db.parishes.setCouncilAssociation(MEMBER.superAdmin, OWN, other.id), 'INVALID_INPUT');
    await expectRule(db.parishes.setCouncilAssociation(MEMBER.admin, OWN, 999_999), 'RECORD_NOT_FOUND');

    // An operating account already holding the owner's name is a conflict the Admin settles by renaming it.
    await db.councils.saveCouncilAccount(MEMBER.admin, OWN, { AccountName: parishOwnerAccountName(own.parish_name), ownership_type: 'INTERNAL_OPERATING' });
    await expectRule(db.parishes.setCouncilAssociation(MEMBER.admin, OWN, own.id), 'INVALID_INPUT');
    expect(d.count(db, 'GLAccount')).toBe(accounts + 1);
    expect((await db.parishes.get(own.id))?.associated_council_id ?? null).toBeNull();

    // A Super Admin may link any council to a parish that council keeps.
    expect((await db.parishes.setCouncilAssociation(MEMBER.superAdmin, OTHER, other.id)).parish?.associated_council_id).toBe(OTHER);
  });
});

describe.each(drivers)('3. $name driver: feedback tickets live in their own tables', (d) => {
  it('writes the ticket and each chat log line to LocalFeedbackTickets and LocalFeedbackTicketMessages', async () => {
    const db = await d.make();
    const threads = d.count(db, 'ChatThreads');
    const ticket = await db.localFeedback.submitTicket(MEMBER.member, { category: 'Suggestion', subject: 'More pancakes', body: 'Two griddles.' });
    expect(d.count(db, 'LocalFeedbackTickets')).toBe(1);
    await db.localFeedback.postTicketMessage(MEMBER.admin, ticket.id, 'Good idea.');
    const done = await db.localFeedback.setTicketStatus(MEMBER.admin, ticket.id, 'Resolved');
    expect(d.count(db, 'LocalFeedbackTicketMessages')).toBe(2);
    expect(d.count(db, 'ChatThreads')).toBe(threads);
    expect(done.ticket).toMatchObject({ status: 'Resolved', replyCount: 2, lastReplyBy: expect.any(String), body: 'Two griddles.' });
    expect(done.entries.map((e) => e.kind)).toEqual(['opening', 'reply', 'status']);

    // Reopening clears resolved_at and keeps the full log.
    const reopened = await db.localFeedback.setTicketStatus(MEMBER.admin, ticket.id, 'In Progress', 'Looking again.');
    expect(reopened.ticket.status).toBe('In Progress');
    expect(reopened.entries.at(-1)).toMatchObject({ kind: 'status', status: 'In Progress', text: 'Looking again.' });
  });
});

describe('4. the training seed fixture', () => {
  it('holds the ten practice members, three fundraisers and three cash boxes', () => {
    expect(existsSync(TRAINING_SEED_FIXTURE_PATH)).toBe(true);
    const raw = JSON.parse(read(TRAINING_SEED_FIXTURE_PATH));
    expect(parseTrainingSeed(raw)).toEqual(TRAINING_SEED);
    expect(TRAINING_SEED.members).toHaveLength(PRACTICE_MEMBER_COUNT);
    expect(TRAINING_SEED.fundraisers).toHaveLength(PRACTICE_FUNDRAISER_COUNT);
    expect(TRAINING_SEED.cashBoxes).toHaveLength(3);
  });

  it('feeds the practice roster, the fundraisers and the cash boxes from the file, not from code', () => {
    expect(practiceRosterRows(7, 'OR', NOW).map((r) => r.MemberFirstName)).toEqual(TRAINING_SEED.members.map((m) => m.firstName));
    expect(practiceFundraisers(NOW).map((f) => f.event.Location)).toEqual(TRAINING_SEED.fundraisers.map((f) => f.location));
    expect(TRAINING_CASH_BOXES).toEqual(TRAINING_SEED.cashBoxes.map((b) => b.amounts));
    expect(trainingCashBoxName(2)).toBe(TRAINING_SEED.cashBoxes[1]!.label);
    expect(read('packages/shared/src/setup-wizard.ts')).not.toContain("'Exampleton'");
    expect(read('packages/shared/src/setup-wizard.ts')).not.toContain("'Tootsie Roll Drive'");
    expect(read('packages/shared/src/data-modes.ts')).not.toContain('[100, 40, 12.5]');
  });

  it('refuses a broken fixture, naming the bad field', () => {
    expect(() => parseTrainingSeed({ version: 1, members: [], fundraisers: [], cashBoxes: [] })).toThrow(/members must be a non-empty list/);
    expect(() => parseTrainingSeed({ ...TRAINING_SEED, cashBoxes: [{ label: 'Box', amounts: [-5] }] })).toThrow(/cashBoxes\[0\]\.amounts\[0\]/);
    expect(() => parseTrainingSeed({ ...TRAINING_SEED, version: 2 })).toThrow(/version must be 1/);
  });
});

describe('5. the testing key file', () => {
  const dirs: string[] = [];
  const freshDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'kofc-testing-key-'));
    dirs.push(dir);
    return dir;
  };
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('writes .testing-key.json with a random passphrase on boot when none exists, and never overwrites it', () => {
    const dir = freshDir();
    expect(TESTING_KEY_FILE).toBe('.testing-key.json');
    expect(meshPassphrase(dir, {})).toBeNull();
    const written = ensureTestingKeyFile(dir, {}, NOW);
    expect(written).toBe(join(dir, TESTING_KEY_FILE));
    const key = JSON.parse(read(written!));
    expect(key).toMatchObject({ version: 1, createdAt: NOW.toISOString() });
    expect(key.passphrase.length).toBeGreaterThanOrEqual(40);
    expect(meshPassphrase(dir, {})).toBe(key.passphrase);
    expect(statSync(written!).isFile()).toBe(true);

    expect(ensureTestingKeyFile(dir, {}, NOW)).toBeNull();
    expect(JSON.parse(read(written!)).passphrase).toBe(key.passphrase);
    // A second laptop's key differs: the hall copies one file to every laptop.
    expect(JSON.parse(read(ensureTestingKeyFile(freshDir(), {}, NOW)!)).passphrase).not.toBe(key.passphrase);
  });

  it('writes nothing when KOFC_MESH_PASSPHRASE is set, and ignores an unreadable file', () => {
    const dir = freshDir();
    expect(ensureTestingKeyFile(dir, { KOFC_MESH_PASSPHRASE: 'a-long-hall-passphrase' })).toBeNull();
    expect(existsSync(join(dir, TESTING_KEY_FILE))).toBe(false);
    writeFileSync(join(dir, TESTING_KEY_FILE), 'not json');
    expect(meshPassphrase(dir, {})).toBeNull();
  });

  it('makes the launcher and the server create the key, and keeps it out of git', () => {
    expect(read('scripts/start-pilot.mjs')).toContain(".testing-key.json");
    expect(read('apps/web/services/server/hub/lan-mesh.ts')).toContain('ensureTestingKeyFile(dir, env)');
    expect(read('.gitignore')).toContain('.testing-key.json');
  });
});

describe('6. the Parish & Pastors Linkage chapters', () => {
  it('documents the linkage in the Administrator guide and keeps it in the Super Admin System Manual', () => {
    expect(PARISH_PASTORS_TITLE).toBe('Parish & Pastors Linkage');
    for (const manual of ['docs/ADMIN_USER_GUIDE.md', 'docs/SUPER_ADMIN_SYSTEM_MANUAL.md']) {
      const text = read(manual);
      expect(text, manual).toContain('Parish & Pastors Linkage');
      expect(text, manual).toContain('Link as home parish');
      expect(text, manual).toContain(`${PARISH_ACCOUNT_PREFIX}`);
    }
    expect(read('docs/ADMIN_USER_GUIDE.md')).toContain('.testing-key.json');
    expect(read('docs/ADMIN_USER_GUIDE.md')).not.toContain('testing-mesh-passphrase.txt');
  });
});
