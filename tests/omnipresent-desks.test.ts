// Sprint 8L (schema version 82): the advanced modules mounted as folders on the Active Desks, the Community Prayer
// Request List on Home, the hand-set phone Donate tab, and the seed rows behind the 60-minute pilot.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { awaitsWrittenOrder, COMMUNITY_PRAYER_CARD_TITLE, DESK_MODULES, deskModulesFor, portalAreas, type DataService } from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { drivers, NOW } from './helpers';
import { openDatabases } from './shims/expo-sqlite';

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const OWN = 1;
const PASSWORD = 'dev-pass-secure-9912';

describe('schema version 82', () => {
  it('bumps the phone database and notes the sprint in Schema.sql', () => {
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (8[2-9]|9\d);/);
    expect(read('Schema.sql')).toContain('(schema version 82)');
    // No second prayer table: the card reads CouncilPrayerIntention.
    expect(read('Schema.sql')).not.toContain('CREATE TABLE [CouncilPrayers]');
  });
});

describe('module folders on the Active Desks', () => {
  it('names the nine folders on their desks', () => {
    expect(deskModulesFor('grand-knight').map((m) => m.title)).toEqual([
      'Charitable Grant Requests Vetting Board',
      'Constitutional Advisor Panels',
      'Connected Councils',
    ]);
    expect(deskModulesFor('financial-secretary').map((m) => m.title)).toEqual(['Semiannual Audit Form 1295 Center', 'Charity Check Issuance Console']);
    expect(deskModulesFor('treasurer').map((m) => m.title)).toEqual(['Annual Budget vs Actuals Ledger Grid', 'Bank Statement Match-Window']);
    expect(deskModulesFor('recorder').map((m) => m.title)).toEqual(['Council Resolutions and Motions Ledger']);
    expect(deskModulesFor('historian').map((m) => m.title)).toEqual(['Google Drive Media Gallery Sync Board']);
    expect(new Set(DESK_MODULES.map((m) => m.rowId)).size).toBe(DESK_MODULES.length);
  });

  it("clears each folder by its module's own portal area", () => {
    const gk = { memberId: 28, councilId: OWN, memberType: 'Member', isOfficer: true, roles: ['Grand Knight'] };
    const member = { memberId: 33, councilId: OWN, memberType: 'Member', isOfficer: false, roles: ['Member'] };
    const gkAreas = portalAreas(gk);
    for (const m of deskModulesFor('grand-knight')) expect(gkAreas, m.title).toContain(m.area);
    const memberAreas = portalAreas(member);
    expect(memberAreas).not.toContain('governance/advisor');
    expect(memberAreas).not.toContain('charities/queue');
  });

  it('mounts the modules on the desks and the prayer card on Home', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    for (const desk of ['grand-knight', 'financial-secretary', 'treasurer', 'recorder', 'historian']) expect(desks).toContain(`desk="${desk}"`);
    for (const module of ['<CharityVettingBoard />', '<ConstitutionalAdvisor />', '<ConnectedCouncils />', '<TrusteeAuditDesk />', '<CharityCheckConsole />', '<PhotoGallery />'])
      expect(desks).toContain(module);
    expect(desks).toContain('<BudgetVsActualsModule');
    expect(desks).toContain('<BankStatementMatchWindow');
    expect(desks).toContain('<MotionsLedgerModule');
    expect(desks).toContain('db.prayers.getBoard(user.memberId, councilId)');
    expect(COMMUNITY_PRAYER_CARD_TITLE).toBe('📿 Community Prayer Request List');
    // Sprint 8P Stage 3: the folders became drawers; the drawer gate and the embedded context moved with them.
    expect(read('packages/shared/src/desk-drawers.ts')).toContain('if (spec.area && !areas.has(spec.area)) return false;');
    expect(read('apps/web/components/DeskDrawers.tsx')).toContain('EmbeddedModuleContext.Provider');
    // The moved pages keep their own guards and render the shared module.
    expect(read('apps/web/app/charities/queue/page.tsx')).toContain("from '@/components/modules/CharityCheckConsole'");
    expect(read('apps/web/app/gallery/page.tsx')).toContain('<RequireArea area="gallery">');
  });

  it('sends nobody to the sidebar from the desks', () => {
    const desks = read('apps/web/components/DashboardDesks.tsx');
    expect(desks).not.toMatch(/(click|select|open)[^.\n]{0,40}sidebar/i);
    expect(read('docs/ADMIN_USER_GUIDE.md')).toContain('### 19.3.1 Concept: the advanced modules on the desks');
  });
});

describe('the hand-set phone Donate tab', () => {
  it('picks no event or type for the member, and fills the Amount box only from his own standard rate (Sprint 8S Revision 10)', () => {
    const donate = read('apps/mobile/app/(app)/donate.tsx');
    expect(donate).not.toContain('events[0]?.id');
    expect(donate).not.toContain('types[0]?.id');
    expect(donate).toContain("useState(isItem || defaults.amount == null ? '' : defaults.amount.toFixed(2))");
    expect(donate).toContain('STANDARD RATE (OPTIONAL)');
    const gate = read('apps/mobile/components/GateIntake.tsx');
    expect(gate).not.toContain('defaults.amount ?? 10');
    expect(gate).toContain('useState<number | null>(null)');
  });
});

describe.each(drivers)('$name driver: the Sprint 8L seed rows', (d) => {
  async function make(): Promise<DataService> {
    const now = () => new Date(NOW);
    if (d.name === 'memory') {
      const db = new MemoryDataService({ now, presentationData: true });
      await db.init();
      return db;
    }
    openDatabases.length = 0;
    const db = new SqliteDataService({ now, presentationData: true });
    await db.init();
    return db;
  }

  it('flags Member Beta for large text, opens five prayer intentions and fills the queues', async () => {
    const db = await make();
    const beta = (await db.auth.signIn('member_beta@stmarys.org', PASSWORD))!;
    expect((await db.members.get(beta.memberId))?.flag_large_text_mode).toBeTruthy();
    const alpha = (await db.auth.signIn('member_alpha@stmarys.org', PASSWORD))!;
    expect((await db.members.get(alpha.memberId))?.flag_large_text_mode).toBeFalsy();

    const board = await db.prayers.getBoard(beta.memberId, OWN);
    expect(board.intentions).toHaveLength(5);
    expect(board.intentions.some((i) => i.intention.author_member_id === beta.memberId)).toBe(true);

    const fs = (await db.auth.signIn('fs_user@stmarys.org', PASSWORD))!.memberId;
    const fsQueue = (await db.expenses.listCouncilQueue(fs, OWN)).filter((q) => awaitsWrittenOrder(q.report)).map((q) => q.report.id);
    expect(fsQueue).toEqual(expect.arrayContaining([20, 21]));
    const vetting = await db.charities.listCharitableRequestsQueue(fs, OWN);
    expect(vetting.filter((q) => q.request.RequestStatus === 'Submitted').map((q) => q.request.OrganizationName)).toEqual(
      expect.arrayContaining(['Northeast Portland Senior Meals', 'Cathedral Coat Closet']),
    );
  });
});
