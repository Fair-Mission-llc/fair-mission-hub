// Sprint 11 Revision 19.0 (schema 111, no table change): the General Ledger page's Add Account / Edit Account drawer
// carries a 'Split Revenue' toggle for a Revenue account. It edits the existing split profile (GLAccountSplitAllocation,
// schema 99) - each share to an internal ledger account or an affiliated sister council - and the posting engine
// (expandSplitJournalLines) already splits every posting, so no column, flag or engine path is added.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { maySplitAccount, PLATFORM_SCHEMA_VERSION, SPLIT_REVENUE_LABEL, SPLIT_TARGET_LABELS } from '@kofc/shared';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');

describe('0. schema', () => {
  it('stays at 111 with no split columns on GLAccount', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(113); // Sprint 11 Revision 21.0 moved the platform to schema 113.
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = 113;/);
    expect(read('Schema.sql')).not.toMatch(/is_split_enabled|split_target_type|split_target_id/);
  });
});

describe('1. labels', () => {
  it('names the toggle and the two targets', () => {
    expect(SPLIT_REVENUE_LABEL).toBe('Split Revenue');
    expect(SPLIT_TARGET_LABELS).toEqual({ account: 'Internal Ledger Account', sister: 'Affiliated Sister Council' });
  });

  it('offers the toggle only on a Revenue account that is not a virtual goal', () => {
    expect(maySplitAccount({ AccountType: 'Revenue', IsVirtualGoal: 0 })).toBe(true);
    expect(maySplitAccount({ AccountType: 'Expense', IsVirtualGoal: 0 })).toBe(false);
    expect(maySplitAccount({ AccountType: 'Revenue', IsVirtualGoal: 1 })).toBe(false);
  });
});

describe('2. the General Ledger account drawer', () => {
  const page = read('apps/web/app/finance/ledger/page.tsx');
  const rows = read('apps/web/components/SplitShareRows.tsx');

  it('shows the Split Revenue toggle to the Treasurer or a Super Admin', () => {
    expect(page).toContain('SPLIT_REVENUE_LABEL');
    expect(page).toContain('canBatchCodeDonations(user, scope.councilId)');
    expect(page).toMatch(/role="switch"/);
  });

  it('saves the account, then its split profile, and ends a split when switched off', () => {
    expect(page).toContain('db.finance.saveGLAccount');
    expect(page).toContain('db.finance.setGLSplitProfile(user.memberId, councilId, saved.id, { destinations })');
    expect(page).toContain('destinations.length > 0 || wasSplit');
  });

  it('loads the sister councils and the split rows with the target switch', () => {
    expect(page).toContain('db.finance.listSplitSisterCouncils');
    expect(page).toMatch(/<SplitShareRows[^>]*targetSwitch/);
    expect(rows).toContain('SPLIT_TARGET_LABELS');
    expect(rows).toContain('targetSwitch = false');
  });
});
