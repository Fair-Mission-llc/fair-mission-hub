// Sprint 9 Master Hardening Pass: the master Administrator guide is split into the pruned Administrator guide and three
// role manuals that share its section numbering. A guide check that used to read docs/ADMIN_USER_GUIDE.md alone reads
// all four, in master order of chapters per file, so it still finds a section wherever the split filed it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

export const OFFICER_MANUAL_FILES = [
  'docs/ADMIN_USER_GUIDE.md',
  'docs/EXECUTIVE_GOVERNANCE_MANUAL.md',
  'docs/FINANCIAL_SECRETARY_MANUAL.md',
  'docs/TREASURER_MANUAL.md',
] as const;

/** The four officer manuals, joined. */
export const readOfficerManuals = (): string => OFFICER_MANUAL_FILES.map((f) => readFileSync(join(root, f), 'utf8')).join('\n\n');
