// =========================================================================
// THE RELEASE REGISTRY AND WHAT'S NEW (Sprint 11 Revision 22.0, schema 113, no table change)
//
// Super Admins keep release blocks on the Advisory Panel's Release Registry view: Release Name, Target Version and
// Scheduled Date. A block is 'Scheduled' until a Super Admin executes it. Execution (executeRelease on the drivers):
//   - the target version must be higher than every released version (assertVersionIncrement);
//   - the server builds the change list (aggregateReleaseChange):
//       1. every Future Feature List entry with status 'Released' that no earlier release listed and whose target date
//          is on or before the scheduled date (or not set);
//       2. every commit in the release commit manifest (RELEASE_COMMIT_LOG, written at build time by
//          scripts/gen-release-log.mjs) dated after the previous release and not after now: its body bullets, or its
//          subject when it has none;
//   - the block becomes 'Released' with executed_at, change_list, commits and feature_ids, and is read-only from then.
// Every signed-in member reads the newest release (advisory.getLatestRelease). The portal Home shows it as the
// 'What's New' notice when its version is newer than the version the viewer last dismissed, for WHATS_NEW_WINDOW_DAYS.
//
// Storage: an AdvisoryFeedback row with the reserved topic WORKSHOP_TOPIC.release (advisory-workshop.ts); the body holds
// the block as JSON. Consultation feedback never shows these rows.
// =========================================================================
import { compareClientVersions, normalizeClientVersion } from './client-telemetry';
import rawReleaseCommits from './fixtures/release-commits.json';
import { assertIsoDate, assertText, BusinessRuleError } from './rules';
import type { AdvisoryFeedback } from './advisory-panel';
import type { FeatureListEntry } from './advisory-workshop';

export const RELEASE_REGISTRY_TITLE = 'Release Registry';
export const WHATS_NEW_TITLE = "What's New";
export const RELEASE_STATUSES = ['Scheduled', 'Released'] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const RELEASE_NAME_MAX_LENGTH = 120;
/** At most this many commits feed one change list. */
export const RELEASE_COMMIT_CAP = 40;
/** At most this many lines in one change list. */
export const RELEASE_CHANGE_LIST_CAP = 60;
/** Home shows a release's What's New notice for this many days after it is executed. */
export const WHATS_NEW_WINDOW_DAYS = 30;
/** The browser key that holds the last version a viewer dismissed (a per-viewer convenience only). */
export const WHATS_NEW_SEEN_KEY = 'kofc.whatsNew.seenVersion';

/** One commit in the release commit manifest. `date` is UTC, 'YYYY-MM-DD HH:MM:SS'. */
export interface ReleaseCommit {
  hash: string;
  date: string;
  subject: string;
  bullets: string[];
}

/** The newest commits, read from Git when the portal is built (scripts/gen-release-log.mjs). */
export const RELEASE_COMMIT_LOG: readonly ReleaseCommit[] = rawReleaseCommits as ReleaseCommit[];

export interface ReleaseBlockFields {
  name: string;
  /** 'major.minor.patch'. */
  target_version: string;
  /** YYYY-MM-DD. */
  scheduled_date: string;
  status: ReleaseStatus;
  /** When the block was executed (UTC 'YYYY-MM-DD HH:MM:SS'), or null while scheduled. */
  executed_at: string | null;
  /** The summary change list, built on execution. */
  change_list: string[];
  /** The commits the change list was built from. */
  commits: { hash: string; subject: string }[];
  /** The Future Feature List entries this release shipped. */
  feature_ids: number[];
}

export interface ReleaseBlock extends ReleaseBlockFields {
  id: number;
  createdBy: number;
  createdByName: string;
  createdAt: string;
}

export interface ReleaseBlockInput {
  id?: number | null;
  name: string;
  target_version: string;
  scheduled_date: string;
}

/** Checks a Super Admin's block; resolves to the fields of a new (or still scheduled) block. */
export function cleanReleaseBlock(input: ReleaseBlockInput): Pick<ReleaseBlockFields, 'name' | 'target_version' | 'scheduled_date'> {
  if (input === null || typeof input !== 'object') throw new BusinessRuleError('INVALID_INPUT', 'Send the release as an object.', {});
  const version = normalizeClientVersion(input.target_version);
  if (!version) throw new BusinessRuleError('INVALID_INPUT', 'Target version must look like 11.22.0.', { field: 'target_version' });
  return {
    name: assertText(input.name, 'Release name', RELEASE_NAME_MAX_LENGTH),
    target_version: version,
    scheduled_date: assertIsoDate(input.scheduled_date, 'Scheduled date'),
  };
}

export const scheduledReleaseFields = (clean: Pick<ReleaseBlockFields, 'name' | 'target_version' | 'scheduled_date'>): ReleaseBlockFields => ({
  ...clean,
  status: 'Scheduled',
  executed_at: null,
  change_list: [],
  commits: [],
  feature_ids: [],
});

export const releaseBlockBody = (fields: ReleaseBlockFields): string => JSON.stringify(fields);

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** A release row's fields, or null when its body cannot be read. */
export function parseReleaseBlockBody(body: string): ReleaseBlockFields | null {
  try {
    const raw = JSON.parse(body) as Partial<ReleaseBlockFields>;
    if (typeof raw.name !== 'string' || typeof raw.target_version !== 'string' || typeof raw.scheduled_date !== 'string') return null;
    if (!RELEASE_STATUSES.includes(raw.status as ReleaseStatus)) return null;
    return {
      name: raw.name,
      target_version: raw.target_version,
      scheduled_date: raw.scheduled_date,
      status: raw.status as ReleaseStatus,
      executed_at: typeof raw.executed_at === 'string' ? raw.executed_at : null,
      change_list: strings(raw.change_list),
      commits: Array.isArray(raw.commits) ? raw.commits.filter((c) => c && typeof c.hash === 'string' && typeof c.subject === 'string') : [],
      feature_ids: Array.isArray(raw.feature_ids) ? raw.feature_ids.filter((n) => Number.isInteger(n)) : [],
    };
  } catch {
    return null;
  }
}

/** The registry, newest scheduled date first. `rows` are the release rows only. */
export function buildReleaseRegistry(rows: readonly AdvisoryFeedback[], names: (memberId: number) => { name: string }): ReleaseBlock[] {
  return rows
    .flatMap((r) => {
      const fields = parseReleaseBlockBody(r.body);
      return fields ? [{ ...fields, id: r.id, createdBy: r.member_id, createdByName: names(r.member_id).name, createdAt: r.submitted_at }] : [];
    })
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date) || compareClientVersions(b.target_version, a.target_version) || b.id - a.id);
}

/** A released block is read-only. */
export function assertReleaseScheduled(block: Pick<ReleaseBlockFields, 'status' | 'name'>): void {
  if (block.status !== 'Scheduled') throw new BusinessRuleError('INVALID_INPUT', `${block.name} is already released and cannot change.`, { field: 'status' });
}

/** Executing a release must raise the version: higher than every released block's. */
export function assertVersionIncrement(target: string, registry: readonly Pick<ReleaseBlockFields, 'status' | 'target_version'>[]): void {
  const top = registry.filter((b) => b.status === 'Released').reduce<string | null>((max, b) => (max === null || compareClientVersions(b.target_version, max) > 0 ? b.target_version : max), null);
  if (top !== null && compareClientVersions(target, top) <= 0) {
    throw new BusinessRuleError('INVALID_INPUT', `Target version ${target} must be higher than the released version ${top}.`, { field: 'target_version' });
  }
}

const ms = (timestamp: string) => Date.parse(`${timestamp.replace(' ', 'T')}Z`);

export interface ReleaseChange {
  change_list: string[];
  commits: { hash: string; subject: string }[];
  feature_ids: number[];
}

/**
 * The change list for executing `block`: released features no earlier release listed (target date on or before the
 * scheduled date, or none), then the commits dated after the previous release and not after `now`, newest first.
 */
export function aggregateReleaseChange(args: {
  block: Pick<ReleaseBlockFields, 'scheduled_date'>;
  registry: readonly Pick<ReleaseBlockFields, 'status' | 'executed_at' | 'feature_ids'>[];
  features: readonly Pick<FeatureListEntry, 'id' | 'title' | 'status' | 'target_date'>[];
  commits?: readonly ReleaseCommit[];
  now: Date;
}): ReleaseChange {
  const released = args.registry.filter((b) => b.status === 'Released');
  const shipped = new Set(released.flatMap((b) => b.feature_ids));
  const since = released.reduce((max, b) => (b.executed_at ? Math.max(max, ms(b.executed_at)) : max), Number.NEGATIVE_INFINITY);
  const features = args.features.filter((f) => f.status === 'Released' && !shipped.has(f.id) && (!f.target_date || f.target_date <= args.block.scheduled_date));
  const nowMs = args.now.getTime();
  const commits = [...(args.commits ?? RELEASE_COMMIT_LOG)]
    .filter((c) => {
      const t = ms(c.date);
      return t > since && t <= nowMs;
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RELEASE_COMMIT_CAP);
  const lines: string[] = features.map((f) => `New feature: ${f.title}`);
  for (const c of commits) lines.push(...(c.bullets.length ? c.bullets : [c.subject]));
  const unique = [...new Set(lines.map((l) => l.trim()).filter(Boolean))].slice(0, RELEASE_CHANGE_LIST_CAP);
  return { change_list: unique, commits: commits.map((c) => ({ hash: c.hash, subject: c.subject })), feature_ids: features.map((f) => f.id) };
}

/** The newest released block (by version), or null. */
export function latestRelease<T extends Pick<ReleaseBlockFields, 'status' | 'target_version'>>(registry: readonly T[]): T | null {
  return registry.filter((b) => b.status === 'Released').reduce<T | null>((top, b) => (top === null || compareClientVersions(b.target_version, top.target_version) > 0 ? b : top), null);
}

/**
 * Whether Home shows the What's New notice for `release`: executed within WHATS_NEW_WINDOW_DAYS of `now`, and newer
 * than the version the viewer last dismissed (`seenVersion`, null when none).
 */
export function shouldShowWhatsNew(release: Pick<ReleaseBlockFields, 'status' | 'target_version' | 'executed_at'> | null, seenVersion: string | null, now: Date): boolean {
  if (!release || release.status !== 'Released' || !release.executed_at) return false;
  if (now.getTime() - ms(release.executed_at) > WHATS_NEW_WINDOW_DAYS * 86_400_000) return false;
  const seen = normalizeClientVersion(seenVersion);
  return seen === null || compareClientVersions(release.target_version, seen) > 0;
}
