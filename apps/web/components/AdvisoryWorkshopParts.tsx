'use client';
// The Advisory Panel workshop (Sprint 11 Revision 21.5, advisory-workshop.ts; lifecycle, registry and grid Revision 22.0):
//   - FutureFeatureList    two tracks. Ideas: every panelist submits and discusses them in threaded comments; no rating,
//                          no rank. Features: a Super Admin converts an Idea (or adds a feature); panelists rate 1-5 and
//                          the list is sorted by the Overall Priority Rank.
//   - ReleaseRegistry      Super Admins add release blocks (Release Name, Target Version, Scheduled Date) and execute
//                          them; execution builds the change list on the server (release-registry.ts).
//   - PlatformCalendarView a month grid of releases, advisory meetings (with agendas) and pilot milestones. Selecting a
//                          day opens its details in a drawer.
import { useState } from 'react';
import {
  ADVISORY_RELEASES,
  ADVISORY_ROADMAP,
  CALENDAR_WEEKDAYS,
  calendarMonthGrid,
  describeError,
  FEATURE_COMMENT_MAX_LENGTH,
  FEATURE_NOTES_MAX_LENGTH,
  FEATURE_RATING_MAX,
  FEATURE_RATING_MIN,
  FEATURE_STATUSES,
  FEATURE_TITLE_MAX_LENGTH,
  FUTURE_FEATURE_LIST_TITLE,
  isSuperAdmin,
  PLATFORM_CALENDAR_KIND_LABELS,
  PLATFORM_CALENDAR_TITLE,
  platformCalendar,
  RELEASE_NAME_MAX_LENGTH,
  RELEASE_REGISTRY_TITLE,
  shiftMonth,
  type FeatureComment,
  type FeatureListEntry,
  type FeatureStatus,
  type PlatformCalendarEntry,
  type ReleaseBlock,
} from '@kofc/shared';
import { Drawer } from '@/components/Drawer';
import { Button, Empty, Field, Input, Notice, Panel, Pill, Select, Textarea } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string } | null;

const statusTone = (status: string) => (status === 'Released' ? 'navy' : status === 'In testing' ? 'gold' : 'outline');

/** Headings of the two lifecycle tracks. */
export const FEATURE_TRACK_TITLE = 'Features - Overall Priority Rank';
export const IDEA_TRACK_TITLE = 'Ideas - open for discussion';
export const CONVERT_IDEA_LABEL = 'Convert to feature';

interface Draft {
  id: number | null;
  title: string;
  target_date: string;
  status: FeatureStatus;
  notes: string;
}

const blankDraft: Draft = { id: null, title: '', target_date: '', status: 'Planned', notes: '' };

function EntryForm({ draft, onChange, onSave, onCancel, busy, idea }: { draft: Draft; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void; busy: boolean; idea: boolean }) {
  // A feature never goes back to an Idea, so editing a feature offers the feature statuses only.
  const statuses = draft.id !== null && draft.status !== 'Idea' ? FEATURE_STATUSES.filter((s) => s !== 'Idea') : FEATURE_STATUSES;
  return (
    <form
      aria-label={idea ? 'Submit a feature idea' : 'Feature entry'}
      className="mb-4 grid grid-cols-1 gap-3 rounded border-2 border-gold p-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <Field label={idea ? 'Idea' : 'Feature'}>{(id) => <Input id={id} required maxLength={FEATURE_TITLE_MAX_LENGTH} value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} />}</Field>
      {idea ? null : (
        <>
          <Field label="Target date">{(id) => <Input id={id} type="date" value={draft.target_date} onChange={(e) => onChange({ ...draft, target_date: e.target.value })} />}</Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={draft.status} onChange={(e) => onChange({ ...draft, status: e.target.value as FeatureStatus })}>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </>
      )}
      <Field label={idea ? 'Why it matters (optional)' : 'Notes (optional)'}>
        {(id) => <Textarea id={id} rows={2} maxLength={FEATURE_NOTES_MAX_LENGTH} value={draft.notes} onChange={(e) => onChange({ ...draft, notes: e.target.value })} />}
      </Field>
      <div className="flex gap-2 md:col-span-2">
        <Button type="submit" disabled={busy || !draft.title.trim()}>
          {busy ? 'Saving…' : idea ? 'Submit idea' : 'Save entry'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RatingPicker({ entry, disabled, onRate }: { entry: FeatureListEntry; disabled: boolean; onRate: (score: number) => void }) {
  const scores = Array.from({ length: FEATURE_RATING_MAX - FEATURE_RATING_MIN + 1 }, (_, i) => FEATURE_RATING_MIN + i);
  return (
    <div role="radiogroup" aria-label={`Your priority rating for ${entry.title}`} className="flex gap-1">
      {scores.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={entry.myRating === n}
          disabled={disabled}
          onClick={() => onRate(n)}
          className={`size-7 rounded border-2 text-sm font-bold ${entry.myRating === n ? 'border-navy bg-navy text-white' : 'border-navy bg-white text-navy hover:bg-gold/30'}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function CommentForm({ label, busy, onPost, onCancel }: { label: string; busy: boolean; onPost: (body: string) => Promise<boolean>; onCancel?: () => void }) {
  const [text, setText] = useState('');
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void onPost(text).then((ok) => ok && setText(''));
      }}
    >
      <Field label={label} className="min-w-[16rem] flex-1">
        {(id) => <Input id={id} maxLength={FEATURE_COMMENT_MAX_LENGTH} value={text} onChange={(e) => setText(e.target.value)} />}
      </Field>
      <Button type="submit" size="sm" disabled={busy || !text.trim()}>
        Post
      </Button>
      {onCancel ? (
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
    </form>
  );
}

function CommentThread({ comments, busy, onReply, depth = 0 }: { comments: readonly FeatureComment[]; busy: boolean; onReply: (parentId: number, body: string) => Promise<boolean>; depth?: number }) {
  const [replyTo, setReplyTo] = useState<number | null>(null);
  return (
    <ul className={`flex flex-col gap-2 ${depth > 0 ? 'ml-4 border-l-2 border-gold pl-3' : ''}`} data-comment-depth={depth}>
      {comments.map((c) => (
        <li key={c.id} className="text-sm">
          <span className="font-bold">{c.memberName}</span> <span className="text-xs text-muted">· {c.councilLabel} · {formatFullDate(c.postedAt.slice(0, 10))}</span>
          <span className="block whitespace-pre-wrap">{c.body}</span>
          <button type="button" className="text-xs font-bold text-navy underline" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
            Reply
          </button>
          {replyTo === c.id ? (
            <CommentForm label={`Reply to ${c.memberName}`} busy={busy} onCancel={() => setReplyTo(null)} onPost={(body) => onReply(c.id, body).then((ok) => (ok && setReplyTo(null), ok))} />
          ) : null}
          {c.replies.length ? <CommentThread comments={c.replies} busy={busy} onReply={onReply} depth={depth + 1} /> : null}
        </li>
      ))}
    </ul>
  );
}

function EntryComments({ entry, busy, onComment }: { entry: FeatureListEntry; busy: boolean; onComment: (body: string, parentId?: number) => Promise<boolean> }) {
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2" aria-label={`Comments on ${entry.title}`}>
      {entry.comments.length === 0 ? <p className="text-xs text-muted">No comments yet.</p> : null}
      <CommentThread comments={entry.comments} busy={busy} onReply={(parentId, body) => onComment(body, parentId)} />
      <CommentForm label={entry.lifecycle === 'idea' ? 'Discussion comment' : 'Review comment'} busy={busy} onPost={(body) => onComment(body)} />
    </div>
  );
}

export function FutureFeatureList() {
  const user = useUser();
  const keeper = isSuperAdmin(user);
  const list = useLoad(() => db.advisory.listFeatureList(user.memberId), [user.memberId]);
  const [rows, setRows] = useState<FeatureListEntry[] | null>(null);
  const entries = rows ?? list.data ?? [];
  const features = entries.filter((e) => e.lifecycle === 'feature');
  const ideas = entries.filter((e) => e.lifecycle === 'idea');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [idea, setIdea] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const run = async (work: () => Promise<FeatureListEntry[]>, done?: string): Promise<boolean> => {
    setBusy(true);
    setMessage(null);
    try {
      setRows(await work());
      if (done) setMessage({ tone: 'info', text: done });
      return true;
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    const ok = idea
      ? await run(() => db.advisory.submitFeatureIdea(user.memberId, { title: draft.title, notes: draft.notes }), 'Idea posted for discussion.')
      : await run(() => db.advisory.saveFeature(user.memberId, { ...draft, target_date: draft.target_date || null }), 'Entry saved.');
    if (ok) setDraft(null);
  };

  const loadStarter = () =>
    run(async () => {
      let out: FeatureListEntry[] = [];
      for (const r of ADVISORY_RELEASES) out = await db.advisory.saveFeature(user.memberId, { title: r.title, target_date: r.target_date, status: r.status, notes: r.notes });
      return out;
    }, 'Starter list loaded.');

  const card = (e: FeatureListEntry) => (
    <li key={e.id} data-priority-rank={e.priorityRank ?? undefined} data-lifecycle={e.lifecycle} className={`flex flex-col gap-2 rounded border-2 bg-white p-3 ${e.lifecycle === 'idea' ? 'border-dashed border-gold' : 'border-navy'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          {e.priorityRank !== null ? (
            <span aria-label={`Overall priority rank ${e.priorityRank}`} className="rounded bg-navy px-2 py-1 font-serif text-lg font-bold text-white">
              #{e.priorityRank}
            </span>
          ) : null}
          <span className="min-w-0">
            <span className="block font-bold">{e.title}</span>
            <span className="block text-xs text-muted">
              {e.lifecycle === 'feature' ? `Target: ${e.target_date ? formatFullDate(e.target_date) : 'Not set'} · ` : ''}Proposed by {e.proposedByName}
            </span>
            {e.notes ? <span className="block text-sm">{e.notes}</span> : null}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Pill tone={statusTone(e.status)}>{e.status}</Pill>
          {e.lifecycle === 'feature' ? (
            <span className="text-xs">
              Priority {e.ratingAverage === null ? 'not rated' : `${e.ratingAverage.toFixed(2)} / ${FEATURE_RATING_MAX}`} ({e.ratingCount} {e.ratingCount === 1 ? 'rating' : 'ratings'})
            </span>
          ) : (
            <span className="text-xs text-muted">No priority rating while an idea.</span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {e.lifecycle === 'feature' ? (
          <>
            <span className="text-sm font-bold">Your rating</span>
            <RatingPicker entry={e} disabled={busy} onRate={(n) => void run(() => db.advisory.rateFeature(user.memberId, e.id, n))} />
          </>
        ) : null}
        <Button size="sm" variant="secondary" aria-expanded={openId === e.id} onClick={() => setOpenId(openId === e.id ? null : e.id)}>
          Comments ({e.commentCount})
        </Button>
        {keeper && e.lifecycle === 'idea' ? (
          <Button size="sm" variant="gold" disabled={busy} onClick={() => void run(() => db.advisory.convertIdeaToFeature(user.memberId, e.id), `${e.title} is now a feature. The panel can rate it.`)}>
            {CONVERT_IDEA_LABEL}
          </Button>
        ) : null}
        {keeper ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => (setIdea(false), setDraft({ id: e.id, title: e.title, target_date: e.target_date ?? '', status: e.status, notes: e.notes ?? '' }))}
            >
              Edit
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => db.advisory.removeFeature(user.memberId, e.id), 'Entry deleted.')}>
              Delete
            </Button>
          </>
        ) : null}
      </div>
      {openId === e.id ? <EntryComments entry={e} busy={busy} onComment={(body, parentId) => run(() => db.advisory.commentOnFeature(user.memberId, e.id, body, parentId ?? null))} /> : null}
    </li>
  );

  return (
    <Panel
      title={FUTURE_FEATURE_LIST_TITLE}
      actions={
        draft ? undefined : (
          <div className="flex gap-2">
            <Button size="sm" variant="gold" onClick={() => (setIdea(true), setDraft({ ...blankDraft, status: 'Idea' }))}>
              Submit idea
            </Button>
            {keeper ? (
              <Button size="sm" onClick={() => (setIdea(false), setDraft({ ...blankDraft }))}>
                Add entry
              </Button>
            ) : null}
          </div>
        )
      }
    >
      <p className="mb-3 text-sm text-muted">Ideas: discuss, no rating. Features: rate 1 (low) to 5 (high); ranked by average.</p>
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      {list.error ? <Notice tone="error">{list.error}</Notice> : null}
      {draft ? <EntryForm draft={draft} onChange={setDraft} onSave={() => void save()} onCancel={() => setDraft(null)} busy={busy} idea={idea} /> : null}
      {list.data && entries.length === 0 ? (
        <div className="flex flex-col gap-2">
          <Empty>The list is empty.</Empty>
          {keeper ? (
            <Button variant="secondary" className="self-start" disabled={busy} onClick={() => void loadStarter()}>
              Load starter list ({ADVISORY_RELEASES.length} entries)
            </Button>
          ) : null}
        </div>
      ) : null}
      {entries.length > 0 ? (
        <div className="flex flex-col gap-5">
          <section aria-label={FEATURE_TRACK_TITLE} className="flex flex-col gap-2">
            <h3 className="font-serif text-lg font-bold text-navy">{FEATURE_TRACK_TITLE}</h3>
            {features.length === 0 ? <Empty>No features yet. A Super Admin converts an idea into a feature.</Empty> : <ol className="flex flex-col gap-3">{features.map(card)}</ol>}
          </section>
          <section aria-label={IDEA_TRACK_TITLE} className="flex flex-col gap-2">
            <h3 className="font-serif text-lg font-bold text-navy">{IDEA_TRACK_TITLE}</h3>
            {ideas.length === 0 ? <Empty>No open ideas.</Empty> : <ul className="flex flex-col gap-3">{ideas.map(card)}</ul>}
          </section>
        </div>
      ) : null}
    </Panel>
  );
}

// ---- Release Registry ---------------------------------------------------------------------------------------------------

const blankRelease = { id: null as number | null, name: '', target_version: '', scheduled_date: '' };

export function ReleaseRegistry() {
  const user = useUser();
  const keeper = isSuperAdmin(user);
  const list = useLoad(() => db.advisory.listReleases(user.memberId), [user.memberId]);
  const [rows, setRows] = useState<ReleaseBlock[] | null>(null);
  const blocks = rows ?? list.data ?? [];
  const [draft, setDraft] = useState<typeof blankRelease | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const run = async (work: () => Promise<ReleaseBlock[]>, done: string): Promise<boolean> => {
    setBusy(true);
    setMessage(null);
    try {
      setRows(await work());
      setMessage({ tone: 'info', text: done });
      return true;
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const execute = (b: ReleaseBlock) =>
    run(async () => {
      const done = await db.advisory.executeRelease(user.memberId, b.id);
      setOpenId(done.id);
      return db.advisory.listReleases(user.memberId);
    }, `${b.name} released. Change list built.`);

  return (
    <Panel title={RELEASE_REGISTRY_TITLE} actions={keeper && !draft ? <Button size="sm" onClick={() => setDraft({ ...blankRelease })}>Add release</Button> : undefined}>
      <p className="mb-3 text-sm text-muted">Release blocks: name, version, date. Execute builds the change list from code commits and released features.</p>
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      {list.error ? <Notice tone="error">{list.error}</Notice> : null}
      {draft ? (
        <form
          aria-label="Release block"
          className="mb-4 grid grid-cols-1 gap-3 rounded border-2 border-gold p-3 md:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => db.advisory.saveRelease(user.memberId, draft), 'Release block saved.').then((ok) => ok && setDraft(null));
          }}
        >
          <Field label="Release Name">{(id) => <Input id={id} required maxLength={RELEASE_NAME_MAX_LENGTH} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}</Field>
          <Field label="Target Version" hint="For example 11.22.0">
            {(id) => <Input id={id} required value={draft.target_version} onChange={(e) => setDraft({ ...draft, target_version: e.target.value })} />}
          </Field>
          <Field label="Scheduled Date">{(id) => <Input id={id} type="date" required value={draft.scheduled_date} onChange={(e) => setDraft({ ...draft, scheduled_date: e.target.value })} />}</Field>
          <div className="flex gap-2 md:col-span-3">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save release'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {list.data && blocks.length === 0 ? <Empty>No release blocks yet.</Empty> : null}
      <ul className="flex flex-col gap-3" aria-label={RELEASE_REGISTRY_TITLE}>
        {blocks.map((b) => (
          <li key={b.id} data-release-status={b.status} className="flex flex-col gap-2 rounded border-2 border-navy bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span>
                <span className="block font-bold">
                  {b.name} <span className="text-sm">v{b.target_version}</span>
                </span>
                <span className="block text-xs text-muted">
                  Scheduled {formatFullDate(b.scheduled_date)}
                  {b.executed_at ? ` · Released ${formatFullDate(b.executed_at.slice(0, 10))}` : ''}
                </span>
              </span>
              <Pill tone={b.status === 'Released' ? 'navy' : 'outline'}>{b.status}</Pill>
            </div>
            <div className="flex flex-wrap gap-2">
              {b.status === 'Released' ? (
                <Button size="sm" variant="secondary" aria-expanded={openId === b.id} onClick={() => setOpenId(openId === b.id ? null : b.id)}>
                  Change list ({b.change_list.length})
                </Button>
              ) : null}
              {keeper && b.status === 'Scheduled' ? (
                <>
                  <Button size="sm" variant="gold" disabled={busy} onClick={() => void execute(b)}>
                    Execute release
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDraft({ id: b.id, name: b.name, target_version: b.target_version, scheduled_date: b.scheduled_date })}>
                    Edit
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => db.advisory.removeRelease(user.memberId, b.id), 'Release block deleted.')}>
                    Delete
                  </Button>
                </>
              ) : null}
            </div>
            {openId === b.id ? (
              <div className="border-t border-line pt-2">
                {b.change_list.length === 0 ? <p className="text-sm text-muted">No changes found for this window.</p> : null}
                <ul className="list-disc pl-5 text-sm" aria-label={`Change list for ${b.name}`}>
                  {b.change_list.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
                {b.commits.length ? <p className="mt-2 text-xs text-muted">From {b.commits.length} code commits: {b.commits.map((c) => c.hash).join(', ')}</p> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ---- Platform Calendar (month grid) ------------------------------------------------------------------------------------

const kindTone = (kind: PlatformCalendarEntry['kind']) => (kind === 'release' ? 'navy' : kind === 'meeting' ? 'gold' : 'outline');
const kindChip = (kind: PlatformCalendarEntry['kind']) =>
  kind === 'release' ? 'bg-navy text-white' : kind === 'meeting' ? 'bg-gold text-navy' : 'border border-navy bg-white text-navy';

export function PlatformCalendarView() {
  const user = useUser();
  const data = useLoad(async () => {
    const [features, meetings, releases] = await Promise.all([db.advisory.listFeatureList(user.memberId), db.advisory.listMeetings(user.memberId), db.advisory.listReleases(user.memberId)]);
    return platformCalendar(features, meetings, ADVISORY_ROADMAP, releases);
  }, [user.memberId]);
  const today = new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState<string | null>(null);
  const entries = data.data ?? [];
  const weeks = calendarMonthGrid(month, entries);
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const picked = day ? entries.filter((e) => e.date === day) : [];

  return (
    <Panel title={PLATFORM_CALENDAR_TITLE}>
      <p className="mb-3 text-sm text-muted">Releases, advisory meetings and pilot milestones. Select a day for details.</p>
      {data.error ? <Notice tone="error">{data.error}</Notice> : null}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
          ‹ Prev
        </Button>
        <h3 className="min-w-[10rem] text-center font-serif text-lg font-bold text-navy" aria-live="polite">
          {monthLabel}
        </h3>
        <Button size="sm" variant="secondary" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
          Next ›
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setMonth(today.slice(0, 7))}>
          Today
        </Button>
        <span className="ml-auto flex flex-wrap gap-2 text-xs">
          {(['release', 'meeting', 'pilot'] as const).map((k) => (
            <Pill key={k} tone={kindTone(k)}>
              {PLATFORM_CALENDAR_KIND_LABELS[k]}
            </Pill>
          ))}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] table-fixed border-collapse" aria-label={`${PLATFORM_CALENDAR_TITLE} - ${monthLabel}`} data-calendar-grid="month">
          <thead>
            <tr>
              {CALENDAR_WEEKDAYS.map((d) => (
                <th key={d} scope="col" className="border border-line bg-navy px-1 py-1 text-xs font-bold text-white">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, w) => (
              <tr key={w}>
                {week.map((cell, i) =>
                  cell.date === null ? (
                    <td key={i} className="h-24 border border-line bg-line/30" />
                  ) : (
                    <td key={cell.date} className={`h-24 border border-line align-top ${cell.date === today ? 'bg-gold/20' : 'bg-white'}`}>
                      <button
                        type="button"
                        onClick={() => setDay(cell.date)}
                        aria-label={`${formatFullDate(cell.date)}: ${cell.entries.length} ${cell.entries.length === 1 ? 'item' : 'items'}`}
                        className="flex h-full w-full flex-col items-stretch gap-0.5 p-1 text-left hover:bg-gold/10"
                      >
                        <span className={`text-xs font-bold ${cell.date < today ? 'text-muted' : 'text-navy'}`}>{cell.day}</span>
                        {cell.entries.slice(0, 3).map((e, k) => (
                          <span key={k} data-calendar-kind={e.kind} className={`truncate rounded px-1 text-[0.65rem] font-bold ${kindChip(e.kind)}`}>
                            {e.title}
                          </span>
                        ))}
                        {cell.entries.length > 3 ? <span className="text-[0.65rem] text-muted">+{cell.entries.length - 3} more</span> : null}
                      </button>
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.data && entries.length === 0 ? <Empty>Nothing dated yet.</Empty> : null}
      {day ? (
        <Drawer title={formatFullDate(day)} onClose={() => setDay(null)}>
          {picked.length === 0 ? <Empty>Nothing on this day.</Empty> : null}
          {picked.map((e, i) => (
            <section key={i} className="flex flex-col gap-1 rounded border-2 border-navy p-3" data-calendar-kind={e.kind}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{e.title}</span>
                <Pill tone={kindTone(e.kind)}>{PLATFORM_CALENDAR_KIND_LABELS[e.kind]}</Pill>
              </div>
              {e.detail ? <span className="text-sm text-muted">{e.detail}</span> : null}
              {e.more?.length ? (
                <ul className="list-disc pl-5 text-sm">
                  {e.more.map((line, k) => (
                    <li key={k}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </Drawer>
      ) : null}
    </Panel>
  );
}
