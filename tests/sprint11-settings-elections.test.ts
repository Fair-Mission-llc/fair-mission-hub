// Sprint 11 Revision 1.0 (schema 102): unified council lookup records (Active/Inactive status, the payment method's
// account link), the Council Wide Settings header and closed drawers, the email gateway routed to the Credentials Vault,
// the QR controls on Council Lookups, the Council Election Center with its PIN-unlocked ballot drawer, the trademark
// name and the October 26, 2026 legal documents.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_IDENTITY_LABEL_COLUMN_LABEL,
  cleanLookupStatus,
  COUNCIL_ACCOUNT_TOKEN_LABEL,
  councilFeatureDeployment,
  defaultAccountIdentityLabel,
  FEATURE_FLAG_LABELS,
  isActiveLookupRow,
  LEGAL_DOCUMENT_FILES,
  LEGAL_DOCUMENTS_EFFECTIVE_DATE,
  methodAcceptsQrCode,
  PLATFORM_APP_NAME,
  PLATFORM_SCHEMA_VERSION,
  planCouncilLookupSave,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

describe('schema 102: unified council lookup records', () => {
  it('adds lookup_status to the three council lookup tables and the account link to payment methods', () => {
    expect(PLATFORM_SCHEMA_VERSION).toBe(102);
    for (const table of ['Activities', 'DonationType', 'CouncilDonationMethod']) {
      const status = TABLES[table].columns.find((c) => c.name === 'lookup_status');
      expect(status, table).toMatchObject({ notNull: true, allowed: ['Active', 'Inactive'] });
    }
    expect(TABLES.CouncilDonationMethod.columns.map((c) => c.name)).toContain('account_owner_id');
  });

  it('binds the status to Active or Inactive, Active when not given', () => {
    expect(cleanLookupStatus(undefined)).toBe('Active');
    expect(cleanLookupStatus('Inactive')).toBe('Inactive');
    expect(() => cleanLookupStatus('Archived')).toThrow();
    expect(isActiveLookupRow({ lookup_status: 'Inactive' })).toBe(false);
    expect(isActiveLookupRow({})).toBe(true);
    const plan = planCouncilLookupSave('CouncilDonationMethod', 1, [], [{ DonationMethodID: 3, account_owner_entity: 'COUNCIL', account_owner_id: 4, lookup_status: 'Inactive' }]);
    expect(plan.inserts[0]).toMatchObject({ account_owner_id: 4, lookup_status: 'Inactive' });
  });

  it('defaults the account to the Council Account token and the members-see name to the account name', () => {
    expect(COUNCIL_ACCOUNT_TOKEN_LABEL).toBe('Council Account');
    expect(ACCOUNT_IDENTITY_LABEL_COLUMN_LABEL).toBe('Account Name Members See');
    expect(defaultAccountIdentityLabel('  ', 'Parish Venmo')).toBe('Parish Venmo');
    expect(defaultAccountIdentityLabel('Own name', 'Parish Venmo')).toBe('Own name');
    expect(defaultAccountIdentityLabel(null, undefined)).toBeNull();
  });

  it('keeps QR codes off Cash, Check, card readers and Physical Items', () => {
    for (const name of ['Cash', 'Check', 'Credit Card', 'Physical Items']) expect(methodAcceptsQrCode(name), name).toBe(false);
    for (const name of ['Venmo', 'Zelle', 'Zeffy', 'Parishsoft']) expect(methodAcceptsQrCode(name), name).toBe(true);
  });
});

describe.each(drivers)('$name driver: payment method accounts', ({ make }) => {
  it("links a payment method to one of the council's own accounts and keeps a linked account", async () => {
    const db = await make();
    const councilId = (await db.members.get(MEMBER.admin))!.CouncilID;
    const account = await db.councils.saveAccountOwner(MEMBER.admin, councilId, { account_name: 'Parish Venmo' });
    const [link] = await db.lookups.listCouncilSpecific(MEMBER.admin, councilId, 'CouncilDonationMethod');
    const base = { id: link.id, DonationMethodID: link.DonationMethodID, DonationMethodURL: null, account_owner_entity: 'PARISH' };
    const [saved] = (await db.lookups.saveCouncilSpecific(MEMBER.admin, councilId, 'CouncilDonationMethod', [
      { ...base, account_owner_id: account.id, lookup_status: 'Inactive' },
    ])).filter((r) => r.id === link.id);
    expect(saved).toMatchObject({ account_owner_id: account.id, lookup_status: 'Inactive' });
    await expectRule(db.councils.removeAccountOwner(MEMBER.admin, councilId, account.id), 'RECORD_IN_USE');
    await expectRule(db.lookups.saveCouncilSpecific(MEMBER.admin, councilId, 'CouncilDonationMethod', [{ ...base, account_owner_id: 99_999 }]), 'INVALID_INPUT');
    await db.lookups.saveCouncilSpecific(MEMBER.admin, councilId, 'CouncilDonationMethod', [{ ...base, account_owner_id: null }]);
    await db.councils.removeAccountOwner(MEMBER.admin, councilId, account.id);
  });
});

describe('Council Wide Settings and Council Lookups', () => {
  it('pins the Council Instance Record, closes every drawer and routes the email gateway to the vault', () => {
    const page = read('apps/web/app/system-settings/council-settings/page.tsx');
    expect(page.indexOf('<CouncilInstanceRecord')).toBeLessThan(page.indexOf('<SettingsDrawers'));
    expect(page).not.toMatch(/BANK_ACCOUNT_SETTINGS_PAGES|href="\/council-lookups"/);
    expect(read('apps/web/components/FeatureDeploymentParts.tsx')).toContain('open={false}');
    const gateway = councilFeatureDeployment({}).find((r) => r.id === 'email-gateway')!;
    expect(gateway).toMatchObject({ href: '/credentials-vault', managedOn: 'Credentials Vault: Email Gateway' });
    expect(FEATURE_FLAG_LABELS.flag_meeting_management.hint).not.toMatch(/live console/i);
  });

  it('drops budget categories and the QR URL column, and adds the QR check box, status and account picker', () => {
    const page = read('apps/web/app/council-lookups/page.tsx');
    expect(page).toContain(".filter((t) => t !== 'CouncilBudgetCategory')");
    expect(page).not.toContain('QR code image URL');
    expect(page).toContain("kind: 'qr'");
    expect(page).toContain('type="checkbox"');
    expect(page).toContain('<QrThumbnail');
    expect(page).toContain('emptyOption: COUNCIL_ACCOUNT_TOKEN_LABEL');
    expect(page).toContain('LOOKUP_STATUSES.map');
    expect(page).toContain('<Markdown source=');
    expect(read('apps/web/components/PaymentQrUploader.tsx')).toContain('methodAcceptsQrCode(name)');
  });
});

describe('the Council Election Center', () => {
  it('pins the election progress bar and nests everything else in closed drawers', () => {
    expect(read('apps/web/app/elections/page.tsx')).toContain('<CouncilElectionCenter />');
    const module = read('apps/web/components/modules/ElectionWorkflow.tsx');
    expect(module).toContain('sticky top-0');
    expect(module).toContain("{ positions: false, nominations: false, ballot: false }");
    expect(module).toContain('<CastActiveBallot');
  });

  it('unlocks the ballot with the meeting PIN and casts an anonymous vote', () => {
    const drawer = read('apps/web/components/modules/CastActiveBallot.tsx');
    expect(drawer).toContain("geofencedCheckIn(user.memberId, meetingId, { kind: 'pin', pin })");
    expect(drawer).toContain('castAnonymousMobileVote(user.memberId, councilId, motionId, selection)');
    expect(drawer).toContain('state.viewerCheckedIn ?');
    expect(drawer).not.toMatch(/tally\.approve|tally\.deny/);
  });
});

describe('trademark and legal documents', () => {
  it('names the platform Fraternal Council Archives™ in the manuals and scripts', () => {
    expect(PLATFORM_APP_NAME).toBe('Fraternal Council Archives™');
    for (const doc of ['ADMIN_USER_GUIDE', 'MEMBER_USER_GUIDE', 'TREASURER_MANUAL', 'FINANCIAL_SECRETARY_MANUAL', 'EXECUTIVE_GOVERNANCE_MANUAL']) {
      expect(read(`docs/${doc}.md`).split('\n')[0], doc).toContain('Fraternal Council Archives™');
    }
    expect(read('scripts/admin_guide_pdf.py')).toContain("DOCUMENT_SUBTITLE = 'Fraternal Council Archives™'");
    expect(read('scripts/admin_guide_pdf.py')).not.toContain('Knights of Columbus Tracking Platform');
  });

  it('reads the October 26, 2026 Terms of Service and Privacy Policy files in the sidebar footer', () => {
    expect(LEGAL_DOCUMENTS_EFFECTIVE_DATE).toBe('2026-10-26');
    for (const file of Object.values(LEGAL_DOCUMENT_FILES)) {
      expect(existsSync(join(__dirname, '..', 'docs', file!)), file).toBe(true);
      expect(read(`docs/${file}`)).toContain('October 26, 2026');
    }
    expect(read('apps/web/app/api/legal/route.ts')).toContain('readDocsFile(file)');
    expect(read('apps/web/components/Sidebar.tsx')).toContain('<Markdown source={legalFile.markdown}');
  });
});
