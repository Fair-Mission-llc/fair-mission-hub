// Sprint 9 Revision 3.0 (schema 98): VolunteerQuarantine.return_explanation, the TransactionAttachments table and the
// phone's '📸 Attach Deposit Photo' button on Check donations (Sprint 9 Revision 4.0: Cash forms carry none).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_PATH_MAX_LENGTH,
  DEPOSIT_PHOTO_QUALITY,
  DEPOSIT_PHOTO_TITLE,
  PLATFORM_SCHEMA_VERSION,
  takesDepositPhoto,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { drivers, expectRule, MEMBER } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;
const PHOTO = 'file:///data/user/0/org.kofc.tracker/files/media/deposit-1761321600000.jpg';

describe('Schema 98', () => {
  it('adds return_explanation and TransactionAttachments, and moves every version marker to 98', () => {
    const schema = read('Schema.sql');
    expect(schema).toContain('(schema version 98)');
    expect(schema).toContain('ALTER TABLE [VolunteerQuarantine] ADD [return_explanation] VARCHAR(500) NULL;');
    expect(schema).toMatch(/ALTER TABLE \[TransactionAttachments\]\s+ADD FOREIGN KEY\(\[donation_id\]\)\s+REFERENCES \[Donation\]\(\[id\]\)/);
    expect(TABLES.TransactionAttachments.columns.map((c) => c.name)).toEqual(['id', 'donation_id', 'file_path', 'captured_at']);
    expect(TABLES.VolunteerQuarantine.columns.map((c) => c.name)).toContain('return_explanation');
    // Sprint 9 Revision 6.0 moved the platform on to schema 99.
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (99|\d{3});/);
    expect(PLATFORM_SCHEMA_VERSION).toBeGreaterThanOrEqual(99);
    // The string-prefix workaround is gone.
    expect(read('packages/shared/src/volunteer-quarantine.ts')).not.toContain('QUARANTINE_RETURN_PREFIX');
  });

  it('takes deposit photos on Check only, compressed', () => {
    expect(takesDepositPhoto('check')).toBe(true);
    for (const kind of ['cash', 'card', 'qr', 'item', 'other'] as const) expect(takesDepositPhoto(kind)).toBe(false);
    expect(DEPOSIT_PHOTO_QUALITY).toBeLessThan(0.8);
  });

  it("puts '📸 Attach Deposit Photo' on the phone's Check form only and binds it after recording", () => {
    expect(DEPOSIT_PHOTO_TITLE).toBe('📸 Attach Deposit Photo');
    const phone = read('apps/mobile/app/(app)/donate.tsx');
    expect(phone).toContain('title={DEPOSIT_PHOTO_TITLE}');
    expect(phone).toContain('quality={DEPOSIT_PHOTO_QUALITY}');
    expect(phone).toContain('const takesDeposit = takesDepositPhoto(option.kind);');
    // Sprint 9 Revision 4.0: no cash wording is left on the photo tile.
    expect(phone).not.toContain('Photograph the cash');
    expect(phone).not.toContain('Photo of the cash');
    expect(phone).toContain('db.donations.attachDepositPhoto(user.memberId, saved.id, await storeDepositPhoto(v.depositPhotoPath))');
    expect(read('apps/mobile/lib/use-photo-capture.ts')).toContain("launchCameraAsync({ mediaTypes: ['images'], quality, exif: false })");
  });
});

describe.each(drivers)('$name driver: deposit photos', (d) => {
  const setup = async () => {
    const db = await d.make();
    const options = await db.donations.listMethods(OWN);
    const typeId = (await db.donations.listTypes(OWN))[0].id;
    const base = { CouncilID: OWN, DonationTypeID: typeId, DonationAmount: 40 };
    const cash = options.find((o) => o.kind === 'cash')!;
    const check = options.find((o) => o.kind === 'check')!;
    const other = options.find((o) => !takesDepositPhoto(o.kind));
    return { db, base, cash, check, other };
  };

  it('stores a deposit photo for a Check donation and lists it back, and refuses one on Cash', async () => {
    const { db, base, cash, check } = await setup();
    const cashGift = await db.donations.record(MEMBER.member, { ...base, DonationMethodID: cash.method.id });
    await expectRule(db.donations.attachDepositPhoto(MEMBER.member, cashGift.id, PHOTO), 'INVALID_INPUT');
    const gift = await db.donations.record(MEMBER.member, { ...base, DonationMethodID: check.method.id, CheckNumber: '1187' });
    const photo = await db.donations.attachDepositPhoto(MEMBER.member, gift.id, `  ${PHOTO}  `);
    expect(photo).toMatchObject({ donation_id: gift.id, file_path: PHOTO });
    expect(photo.id).toBeGreaterThan(0);
    expect(photo.captured_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    const second = await db.donations.attachDepositPhoto(MEMBER.member, gift.id, `${PHOTO}.2`);
    expect((await db.donations.listAttachments(MEMBER.admin, gift.id)).map((a) => a.id)).toEqual([photo.id, second.id]);

    const byCheck = await db.donations.record(MEMBER.member, { ...base, DonationMethodID: check.method.id, CheckNumber: '1188' });
    expect((await db.donations.attachDepositPhoto(MEMBER.member, byCheck.id, PHOTO)).donation_id).toBe(byCheck.id);
    expect(d.count(db, 'TransactionAttachments')).toBe(3);
  });

  it('refuses another member, another method, a blank path and an unknown donation, writing nothing', async () => {
    const { db, base, check, other } = await setup();
    const gift = await db.donations.record(MEMBER.member, { ...base, DonationMethodID: check.method.id, CheckNumber: '1190' });
    await expectRule(db.donations.attachDepositPhoto(MEMBER.newMember, gift.id, PHOTO), 'ADMIN_REQUIRED');
    await expectRule(db.donations.listAttachments(MEMBER.newMember, gift.id), 'ADMIN_REQUIRED');
    await expectRule(db.donations.attachDepositPhoto(MEMBER.member, gift.id, '   '), 'INVALID_INPUT');
    await expectRule(db.donations.attachDepositPhoto(MEMBER.member, gift.id, 'x'.repeat(ATTACHMENT_PATH_MAX_LENGTH + 1)), 'INVALID_INPUT');
    await expectRule(db.donations.attachDepositPhoto(MEMBER.member, 99999, PHOTO), 'RECORD_NOT_FOUND');
    if (other) {
      const viaOther = await db.donations
        .record(MEMBER.member, { ...base, DonationMethodID: other.method.id, ...(other.kind === 'item' ? { DonationDesciption: '2 boxes of coats' } : {}) })
        .catch(() => null);
      if (viaOther) await expectRule(db.donations.attachDepositPhoto(MEMBER.member, viaOther.id, PHOTO), 'INVALID_INPUT');
    }
    expect(d.count(db, 'TransactionAttachments')).toBe(0);
  });

  it('deletes the photo rows with their donation', async () => {
    const { db, base, check } = await setup();
    const gift = await db.donations.record(MEMBER.member, { ...base, DonationMethodID: check.method.id, CheckNumber: '1191' });
    await db.donations.attachDepositPhoto(MEMBER.member, gift.id, PHOTO);
    await db.donations.remove(MEMBER.member, gift.id);
    expect(d.count(db, 'TransactionAttachments')).toBe(0);
  });
});
