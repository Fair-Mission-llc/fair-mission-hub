// =========================================================================
// THE ADVISORY PANEL WORKSHOP (Sprint 11 Revision 21.5, schema 113, no table change)
//
// The Application Advisory Panel's 'Future Feature List' (was 'Future Feature Releases', kept in code) becomes data the
// panel works on:
//   - Super Admins add, edit and delete entries (title, calendar target date, status, notes);
//   - panelists submit feature ideas, which join the list with status 'Idea';
//   - panelists post review comments on an entry;
//   - panelists rate an entry's priority 1-5 (one rating each, changeable). The ratings sum up into an average and an
//     overall priority rank, and the list is sorted by that rank (rankFeatureList).
// The 'Platform Calendar' view merges the entries' target dates, the panel meetings and the roadmap's pilot timeline
// (platformCalendar).
//
// Sprint 11 Revision 22.0 - the Idea vs. Feature lifecycle:
//   - an Idea (status 'Idea') is open to every advisor for threaded comments (a reply names its parent comment), but it
//     takes no priority rating and has no rank (priorityRank null). rateFeature refuses an Idea (assertRateable);
//   - a Super Admin converts an Idea into a feature (convertIdeaToFeature: status 'Planned' unless another is given).
//     The feature then takes 1-5 ratings, and the features alone are ranked into the Overall Priority Rank;
//   - a feature never goes back to an Idea (assertLifecycleEdit).
// The calendar also carries the Release Registry's blocks (release-registry.ts) and each meeting's agenda, and
// calendarMonthGrid lays the entries out as a month grid for the click-to-drill view.
//
// Storage without a schema change: every workshop row is an AdvisoryFeedback row whose topic starts with a reserved tag
// (WORKSHOP_TOPIC). The body holds the entry as JSON, the comment text, or the score. listFeedback leaves tagged rows
// out, and submitFeedback refuses a topic that starts with the reserved prefix (assertPlainFeedbackTopic).
// =========================================================================
import { assertIsoDate, assertText, BusinessRuleError, optionalText } from './rules';
import type { AdvisoryFeedback, AdvisoryPanelMeeting, AdvisoryRoadmapItem } from './advisory-panel';

export const FUTURE_FEATURE_LIST_TITLE = 'Future Feature List';
export const PLATFORM_CALENDAR_TITLE = 'Platform Calendar';

export const FEATURE_STATUSES = ['Idea', 'Planned', 'In testing', 'Released'] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export const FEATURE_RATING_MIN = 1;
export const FEATURE_RATING_MAX = 5;
export const FEATURE_TITLE_MAX_LENGTH = 120;
export const FEATURE_NOTES_MAX_LENGTH = 1200;
export const FEATURE_COMMENT_MAX_LENGTH = 1000;

/** The reserved topic tags. Every tag starts with WORKSHOP_TOPIC_PREFIX. */
export const WORKSHOP_TOPIC_PREFIX = '[ffl:';
export const WORKSHOP_TOPIC = {
  entry: '[ffl:entry]',
  comment: (entryId: number) => `[ffl:comment:${entryId}]`,
  rating: (entryId: number) => `[ffl:rating:${entryId}]`,
  /** Sprint 11 Revision 22.0: a reply to comment `parentId` on entry `entryId`. */
  reply: (entryId: number, parentId: number) => `[ffl:comment:${entryId}:${parentId}]`,
  /** Sprint 11 Revision 22.0: a Release Registry block (release-registry.ts). */
  release: '[ffl:release]',
} as const;

/** Sprint 11 Revision 22.0: the LIKE pattern (SQL) of every reply row on entry `entryId`. */
export const workshopReplyPattern = (entryId: number): string => `[ffl:comment:${entryId}:%`;

/** Whether a workshop row belongs to entry `entryId` (its comments, replies and ratings). */
export const belongsToFeatureEntry = (topic: string, entryId: number): boolean => workshopRowTarget(topic)?.entryId === entryId;

export const isWorkshopTopic = (topic: string): boolean => topic.trim().toLowerCase().startsWith(WORKSHOP_TOPIC_PREFIX);

/** submitFeedback: a plain note may not use a reserved workshop tag. */
export function assertPlainFeedbackTopic(topic: string): void {
  if (isWorkshopTopic(topic)) throw new BusinessRuleError('INVALID_INPUT', `A feedback topic may not start with ${WORKSHOP_TOPIC_PREFIX}.`, { field: 'topic' });
}

export interface FeatureEntryFields {
  title: string;
  /** Calendar target date (YYYY-MM-DD), or null when not set. */
  target_date: string | null;
  status: FeatureStatus;
  notes: string | null;
}

export interface FeatureEntryInput {
  id?: number | null;
  title: string;
  target_date?: string | null;
  status?: FeatureStatus | string | null;
  notes?: string | null;
}

export interface FeatureIdeaInput {
  title: string;
  notes?: string | null;
}

export interface FeatureComment {
  id: number;
  entryId: number;
  /** Sprint 11 Revision 22.0: the comment this one answers, or null for a top-level comment. */
  parentId: number | null;
  /** Answers to this comment, oldest first (nested). */
  replies: FeatureComment[];
  memberId: number;
  memberName: string;
  councilLabel: string;
  body: string;
  postedAt: string;
}

export type FeatureLifecycle = 'idea' | 'feature';

/** Sprint 11 Revision 22.0: an Idea is unranked; any other status is a feature. */
export const lifecycleOf = (status: FeatureStatus): FeatureLifecycle => (status === 'Idea' ? 'idea' : 'feature');

/** One entry as the panel reads it: fields, author, comments and the priority summary. */
export interface FeatureListEntry extends FeatureEntryFields {
  id: number;
  proposedBy: number;
  proposedByName: string;
  createdAt: string;
  lifecycle: FeatureLifecycle;
  /** Top-level comments, oldest first, each with its nested replies. */
  comments: FeatureComment[];
  /** Every comment and reply. */
  commentCount: number;
  ratingCount: number;
  /** Average score, two decimals, or null with no ratings. */
  ratingAverage: number | null;
  /** The reader's own score, or null. */
  myRating: number | null;
  /**
   * The Overall Priority Rank: 1 = highest. Every feature has a rank (unrated features rank after rated ones). Sprint 11
   * Revision 22.0: an Idea has none (null) and lists after the features.
   */
  priorityRank: number | null;
}

export function cleanFeatureEntry(input: FeatureEntryInput): FeatureEntryFields {
  if (input === null || typeof input !== 'object') throw new BusinessRuleError('INVALID_INPUT', 'Send the feature as an object.', {});
  const status = (input.status ?? 'Planned') as FeatureStatus;
  if (!FEATURE_STATUSES.includes(status)) throw new BusinessRuleError('INVALID_INPUT', `Status must be one of ${FEATURE_STATUSES.join(', ')}.`, { field: 'status' });
  const date = input.target_date === undefined || input.target_date === null || input.target_date === '' ? null : assertIsoDate(input.target_date, 'Target date');
  return {
    title: assertText(input.title, 'Feature title', FEATURE_TITLE_MAX_LENGTH),
    target_date: date,
    status,
    notes: optionalText(input.notes, 'Notes', FEATURE_NOTES_MAX_LENGTH),
  };
}

export const cleanFeatureIdea = (input: FeatureIdeaInput): FeatureEntryFields => cleanFeatureEntry({ title: input?.title, notes: input?.notes, status: 'Idea', target_date: null });

export const cleanFeatureComment = (body: unknown): string => assertText(body, 'Comment', FEATURE_COMMENT_MAX_LENGTH);

/** Sprint 11 Revision 22.0: an Idea takes no priority rating until a Super Admin converts it into a feature. */
export function assertRateable(fields: Pick<FeatureEntryFields, 'status' | 'title'>): void {
  if (fields.status === 'Idea') throw new BusinessRuleError('INVALID_INPUT', `${fields.title} is an idea. A Super Admin converts it into a feature before the panel rates it.`, { field: 'status' });
}

/** Sprint 11 Revision 22.0: a feature never goes back to an Idea. */
export function assertLifecycleEdit(before: Pick<FeatureEntryFields, 'status'>, after: Pick<FeatureEntryFields, 'status'>): void {
  if (before.status !== 'Idea' && after.status === 'Idea') throw new BusinessRuleError('INVALID_INPUT', 'A feature cannot go back to an idea.', { field: 'status' });
}

export interface IdeaConversionInput {
  target_date?: string | null;
  status?: FeatureStatus | string | null;
}

/** Sprint 11 Revision 22.0: the fields of Idea `fields` converted into a feature ('Planned' unless another status is given). */
export function convertIdeaFields(fields: FeatureEntryFields, input: IdeaConversionInput = {}): FeatureEntryFields {
  if (fields.status !== 'Idea') throw new BusinessRuleError('INVALID_INPUT', `${fields.title} is already a feature.`, { field: 'status' });
  const status = (input?.status ?? 'Planned') as FeatureStatus;
  if (status === 'Idea') throw new BusinessRuleError('INVALID_INPUT', 'Choose a feature status other than Idea.', { field: 'status' });
  const target = input?.target_date === undefined ? fields.target_date : input.target_date;
  return cleanFeatureEntry({ title: fields.title, notes: fields.notes, status, target_date: target });
}

export function cleanFeatureRating(score: unknown): number {
  const n = Number(score);
  if (!Number.isInteger(n) || n < FEATURE_RATING_MIN || n > FEATURE_RATING_MAX) {
    throw new BusinessRuleError('INVALID_INPUT', `A priority rating is a whole number from ${FEATURE_RATING_MIN} to ${FEATURE_RATING_MAX}.`, { field: 'score' });
  }
  return n;
}

/** The body an entry row stores. */
export const featureEntryBody = (fields: FeatureEntryFields): string => JSON.stringify(fields);

/** An entry row's fields, or null when its body cannot be read. */
export function parseFeatureEntryBody(body: string): FeatureEntryFields | null {
  try {
    const raw = JSON.parse(body) as Partial<FeatureEntryFields>;
    if (typeof raw.title !== 'string' || !FEATURE_STATUSES.includes(raw.status as FeatureStatus)) return null;
    return { title: raw.title, target_date: typeof raw.target_date === 'string' ? raw.target_date : null, status: raw.status as FeatureStatus, notes: typeof raw.notes === 'string' ? raw.notes : null };
  } catch {
    return null;
  }
}

const TAGGED = /^\[ffl:(comment|rating):(\d+)(?::(\d+))?\]$/;

/** The entry a comment, reply or rating row belongs to (and a reply's parent comment), or null. */
export function workshopRowTarget(topic: string): { kind: 'comment' | 'rating'; entryId: number; parentId: number | null } | null {
  const m = TAGGED.exec(topic.trim());
  if (!m || (m[1] === 'rating' && m[3] !== undefined)) return null;
  return { kind: m[1] as 'comment' | 'rating', entryId: Number(m[2]), parentId: m[3] === undefined ? null : Number(m[3]) };
}

/** Ranks entries: highest average first, then more ratings, then soonest target date, then title. */
export function rankFeatureList<T extends Pick<FeatureListEntry, 'ratingAverage' | 'ratingCount' | 'target_date' | 'title'>>(entries: readonly T[]): (T & { priorityRank: number })[] {
  const sorted = [...entries].sort(
    (a, b) =>
      (b.ratingAverage ?? -1) - (a.ratingAverage ?? -1) ||
      b.ratingCount - a.ratingCount ||
      (a.target_date ?? '9999-12-31').localeCompare(b.target_date ?? '9999-12-31') ||
      a.title.localeCompare(b.title),
  );
  return sorted.map((e, i) => ({ ...e, priorityRank: i + 1 }));
}

/**
 * Builds the Future Feature List from the raw AdvisoryFeedback rows. `names` gives a member's name and council label.
 * Comments are oldest first; the last rating a member posted on an entry counts.
 */
export function buildFeatureList(
  rows: readonly AdvisoryFeedback[],
  readerId: number,
  names: (memberId: number) => { name: string; councilLabel: string },
): FeatureListEntry[] {
  const entries = rows.filter((r) => r.topic === WORKSHOP_TOPIC.entry);
  const comments = new Map<number, FeatureComment[]>();
  const byId = new Map<number, FeatureComment>();
  const ratings = new Map<number, Map<number, number>>();
  for (const r of [...rows].sort((a, b) => a.submitted_at.localeCompare(b.submitted_at) || a.id - b.id)) {
    const target = workshopRowTarget(r.topic);
    if (!target) continue;
    if (target.kind === 'comment') {
      const who = names(r.member_id);
      const comment: FeatureComment = { id: r.id, entryId: target.entryId, parentId: target.parentId, replies: [], memberId: r.member_id, memberName: who.name, councilLabel: who.councilLabel, body: r.body, postedAt: r.submitted_at };
      byId.set(r.id, comment);
      // A reply hangs under its parent; one whose parent is gone (or on another entry) shows at the top level.
      const parent = target.parentId === null ? undefined : byId.get(target.parentId);
      if (parent && parent.entryId === target.entryId) parent.replies.push(comment);
      else {
        const list = comments.get(target.entryId) ?? [];
        list.push(comment);
        comments.set(target.entryId, list);
      }
    } else {
      const score = Number(r.body);
      if (!Number.isInteger(score) || score < FEATURE_RATING_MIN || score > FEATURE_RATING_MAX) continue;
      const map = ratings.get(target.entryId) ?? new Map<number, number>();
      map.set(r.member_id, score);
      ratings.set(target.entryId, map);
    }
  }
  const countAll = (list: readonly FeatureComment[]): number => list.reduce((n, c) => n + 1 + countAll(c.replies), 0);
  const built = entries.flatMap((r) => {
    const fields = parseFeatureEntryBody(r.body);
    if (!fields) return [];
    const lifecycle = lifecycleOf(fields.status);
    // An Idea carries no priority: a rating stored before Revision 22.0 is ignored until the Idea becomes a feature.
    const scores = lifecycle === 'idea' ? [] : [...(ratings.get(r.id)?.values() ?? [])];
    const average = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null;
    const thread = comments.get(r.id) ?? [];
    return [
      {
        ...fields,
        id: r.id,
        proposedBy: r.member_id,
        proposedByName: names(r.member_id).name,
        createdAt: r.submitted_at,
        lifecycle,
        comments: thread,
        commentCount: countAll(thread),
        ratingCount: scores.length,
        ratingAverage: average,
        myRating: lifecycle === 'idea' ? null : (ratings.get(r.id)?.get(readerId) ?? null),
        priorityRank: null as number | null,
      },
    ];
  });
  const ranked = rankFeatureList(built.filter((e) => e.lifecycle === 'feature'));
  const ideas = built.filter((e) => e.lifecycle === 'idea').sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  return [...ranked, ...ideas];
}

// ---- the Platform Calendar ---------------------------------------------------------------------------------------------

export type PlatformCalendarKind = 'release' | 'meeting' | 'pilot';

export const PLATFORM_CALENDAR_KIND_LABELS: Readonly<Record<PlatformCalendarKind, string>> = {
  release: 'Scheduled release',
  meeting: 'Advisory meeting',
  pilot: 'Pilot timeline',
};

export interface PlatformCalendarEntry {
  date: string;
  kind: PlatformCalendarKind;
  title: string;
  detail: string | null;
  /** Sprint 11 Revision 22.0: the drill-down text - a meeting's agenda, a release's change list, a pilot item's summary. */
  more?: string[];
}

/** Sprint 11 Revision 22.0: a Release Registry block as the calendar reads it. */
export interface CalendarReleaseBlock {
  name: string;
  target_version: string;
  scheduled_date: string;
  status: string;
  change_list: readonly string[];
}

/**
 * The Platform Calendar: every dated feature entry (scheduled releases; Ideas are left out), every panel meeting, and
 * the roadmap's dated Pilot-phase items, by date.
 */
export function platformCalendar(
  features: readonly Pick<FeatureListEntry, 'title' | 'target_date' | 'status' | 'notes'>[],
  meetings: readonly (Pick<AdvisoryPanelMeeting, 'meeting_date' | 'title' | 'location'> & { agenda?: string | null })[],
  roadmap: readonly AdvisoryRoadmapItem[],
  releases: readonly CalendarReleaseBlock[] = [],
): PlatformCalendarEntry[] {
  const lines = (text: string | null | undefined) => (text ? text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : []);
  const out: PlatformCalendarEntry[] = [
    ...releases.map((r) => ({
      date: r.scheduled_date,
      kind: 'release' as const,
      title: `${r.name} (v${r.target_version})`,
      detail: r.status,
      more: r.change_list.length ? [...r.change_list] : ['The change list builds when a Super Admin executes the release.'],
    })),
    ...features.filter((f) => f.target_date && f.status !== 'Idea').map((f) => ({ date: f.target_date!, kind: 'release' as const, title: f.title, detail: f.status, more: lines(f.notes) })),
    ...meetings.map((m) => ({ date: m.meeting_date, kind: 'meeting' as const, title: m.title, detail: m.location, more: lines(m.agenda) })),
    ...roadmap.filter((r) => r.phase === 'Pilot' && r.target_date).map((r) => ({ date: r.target_date!, kind: 'pilot' as const, title: r.title, detail: r.status, more: [r.summary] })),
  ];
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
}

/** Sprint 11 Revision 22.0: one cell of the calendar month grid. `date` is null for a blank cell outside the month. */
export interface CalendarGridCell {
  date: string | null;
  day: number | null;
  entries: PlatformCalendarEntry[];
}

export const CALENDAR_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Sprint 11 Revision 22.0: lays `entries` out on the month grid of `month` ('YYYY-MM'): weeks of seven cells, Sunday
 * first, blank cells before day 1 and after the last day.
 */
export function calendarMonthGrid(month: string, entries: readonly PlatformCalendarEntry[]): CalendarGridCell[][] {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new BusinessRuleError('INVALID_INPUT', 'Month must look like 2026-11.', { field: 'month' });
  const year = Number(m[1]);
  const mon = Number(m[2]);
  const first = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const cells: CalendarGridCell[] = Array.from({ length: first }, () => ({ date: null, day: null, entries: [] }));
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    cells.push({ date, day: d, entries: entries.filter((e) => e.date === date) });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null, entries: [] });
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** Sprint 11 Revision 22.0: 'YYYY-MM' moved by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, mo] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y!, mo! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
