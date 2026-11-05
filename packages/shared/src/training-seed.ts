// =========================================================================
// THE TRAINING SEED FIXTURE (Sprint 11 Revision 21.0)
//
// The practice data once hard-coded in setup-wizard.ts and data-modes.ts lives in fixtures/training-seed.json: the ten
// practice members, the three practice fundraisers and the three training cash boxes. The Practice Sandbox
// (councils.seedPracticeSandbox) and the training playground (seedTrainingPlayground) both read it through this module,
// which checks the file's shape once at load: a broken fixture fails loudly instead of seeding half a playground.
// =========================================================================
import rawTrainingSeed from './fixtures/training-seed.json';

export interface TrainingSeedMember {
  firstName: string;
  lastName: string;
}

export interface TrainingSeedFundraiser {
  name: string;
  description: string;
  location: string;
}

export interface TrainingSeedCashBox {
  /** The Donor name the box's cash donations carry. */
  label: string;
  /** Each cash donation logged into the box, in dollars. */
  amounts: number[];
}

export interface TrainingSeed {
  version: 1;
  members: TrainingSeedMember[];
  fundraisers: TrainingSeedFundraiser[];
  cashBoxes: TrainingSeedCashBox[];
}

/** The repository path of the fixture, for the manuals and error messages. */
export const TRAINING_SEED_FIXTURE_PATH = 'packages/shared/src/fixtures/training-seed.json';

const text = (v: unknown, where: string): string => {
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`${TRAINING_SEED_FIXTURE_PATH}: ${where} must be non-empty text.`);
  return v.trim();
};

const list = (v: unknown, where: string): unknown[] => {
  if (!Array.isArray(v) || v.length === 0) throw new Error(`${TRAINING_SEED_FIXTURE_PATH}: ${where} must be a non-empty list.`);
  return v;
};

const record = (v: unknown, where: string): Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`${TRAINING_SEED_FIXTURE_PATH}: ${where} must be an object.`);
  return v as Record<string, unknown>;
};

/** Checks a parsed fixture and returns it typed; throws naming the first bad field. */
export function parseTrainingSeed(value: unknown): TrainingSeed {
  const root = record(value, 'the file');
  if (root.version !== 1) throw new Error(`${TRAINING_SEED_FIXTURE_PATH}: version must be 1.`);
  const members = list(root.members, 'members').map((m, i) => {
    const r = record(m, `members[${i}]`);
    return { firstName: text(r.firstName, `members[${i}].firstName`), lastName: text(r.lastName, `members[${i}].lastName`) };
  });
  const fundraisers = list(root.fundraisers, 'fundraisers').map((f, i) => {
    const r = record(f, `fundraisers[${i}]`);
    return {
      name: text(r.name, `fundraisers[${i}].name`),
      description: text(r.description, `fundraisers[${i}].description`),
      location: text(r.location, `fundraisers[${i}].location`),
    };
  });
  const cashBoxes = list(root.cashBoxes, 'cashBoxes').map((b, i) => {
    const r = record(b, `cashBoxes[${i}]`);
    const amounts = list(r.amounts, `cashBoxes[${i}].amounts`).map((a, j) => {
      if (typeof a !== 'number' || !Number.isFinite(a) || a <= 0) throw new Error(`${TRAINING_SEED_FIXTURE_PATH}: cashBoxes[${i}].amounts[${j}] must be a positive number.`);
      return a;
    });
    return { label: text(r.label, `cashBoxes[${i}].label`), amounts };
  });
  return { version: 1, members, fundraisers, cashBoxes };
}

/** The fixture, checked once when the module loads. */
export const TRAINING_SEED: Readonly<TrainingSeed> = parseTrainingSeed(rawTrainingSeed);
