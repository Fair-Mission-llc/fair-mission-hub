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
} as const;

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
  memberId: number;
  memberName: string;
  councilLabel: string;
  body: string;
  postedAt: string;
}

/** One entry as the panel reads it: fields, author, comments and the priority summary. */
export interface FeatureListEntry extends FeatureEntryFields {
  id: number;
  proposedBy: number;
  proposedByName: string;
  createdAt: string;
  comments: FeatureComment[];
  ratingCount: number;
  /** Average score, two decimals, or null with no ratings. */
  ratingAverage: number | null;
  /** The reader's own score, or null. */
  myRating: number | null;
  /** 1 = highest priority. Every entry has a rank; unrated entries rank after rated ones. */
  priorityRank: number;
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

const TAGGED = /^\[ffl:(comment|rating):(\d+)\]$/;

/** The entry a comment or rating row belongs to, or null. */
export function workshopRowTarget(topic: string): { kind: 'comment' | 'rating'; entryId: number } | null {
  const m = TAGGED.exec(topic.trim());
  return m ? { kind: m[1] as 'comment' | 'rating', entryId: Number(m[2]) } : null;
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
  const ratings = new Map<number, Map<number, number>>();
  for (const r of [...rows].sort((a, b) => a.submitted_at.localeCompare(b.submitted_at) || a.id - b.id)) {
    const target = workshopRowTarget(r.topic);
    if (!target) continue;
    if (target.kind === 'comment') {
      const who = names(r.member_id);
      const list = comments.get(target.entryId) ?? [];
      list.push({ id: r.id, entryId: target.entryId, memberId: r.member_id, memberName: who.name, councilLabel: who.councilLabel, body: r.body, postedAt: r.submitted_at });
      comments.set(target.entryId, list);
    } else {
      const score = Number(r.body);
      if (!Number.isInteger(score) || score < FEATURE_RATING_MIN || score > FEATURE_RATING_MAX) continue;
      const map = ratings.get(target.entryId) ?? new Map<number, number>();
      map.set(r.member_id, score);
      ratings.set(target.entryId, map);
    }
  }
  const built = entries.flatMap((r) => {
    const fields = parseFeatureEntryBody(r.body);
    if (!fields) return [];
    const scores = [...(ratings.get(r.id)?.values() ?? [])];
    const average = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null;
    return [
      {
        ...fields,
        id: r.id,
        proposedBy: r.member_id,
        proposedByName: names(r.member_id).name,
        createdAt: r.submitted_at,
        comments: comments.get(r.id) ?? [],
        ratingCount: scores.length,
        ratingAverage: average,
        myRating: ratings.get(r.id)?.get(readerId) ?? null,
        priorityRank: 0,
      },
    ];
  });
  return rankFeatureList(built);
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
}

/**
 * The Platform Calendar: every dated feature entry (scheduled releases; Ideas are left out), every panel meeting, and
 * the roadmap's dated Pilot-phase items, by date.
 */
export function platformCalendar(
  features: readonly Pick<FeatureListEntry, 'title' | 'target_date' | 'status' | 'notes'>[],
  meetings: readonly Pick<AdvisoryPanelMeeting, 'meeting_date' | 'title' | 'location'>[],
  roadmap: readonly AdvisoryRoadmapItem[],
): PlatformCalendarEntry[] {
  const out: PlatformCalendarEntry[] = [
    ...features.filter((f) => f.target_date && f.status !== 'Idea').map((f) => ({ date: f.target_date!, kind: 'release' as const, title: f.title, detail: f.status })),
    ...meetings.map((m) => ({ date: m.meeting_date, kind: 'meeting' as const, title: m.title, detail: m.location })),
    ...roadmap.filter((r) => r.phase === 'Pilot' && r.target_date).map((r) => ({ date: r.target_date!, kind: 'pilot' as const, title: r.title, detail: r.status })),
  ];
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
}
