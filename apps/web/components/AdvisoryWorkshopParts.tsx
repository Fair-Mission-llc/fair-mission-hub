'use client';
// The Advisory Panel workshop (Sprint 11 Revision 21.5, advisory-workshop.ts):
//   - FutureFeatureList   the ranked list. Super Admins add, edit and delete entries; every panelist submits ideas, rates
//                         an entry's priority (1-5) and posts review comments. The list is sorted by the overall rank.
//   - PlatformCalendarView scheduled releases, advisory meetings and the pilot timeline, by date.
import { useState } from 'react';
import {
  ADVISORY_RELEASES,
  ADVISORY_ROADMAP,
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
  type FeatureListEntry,
  type FeatureStatus,
} from '@kofc/shared';
import { Button, Empty, Field, Input, Notice, Panel, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string } | null;

const statusTone = (status: string) => (status === 'Released' ? 'navy' : status === 'In testing' ? 'gold' : 'outline');

interface Draft {
  id: number | null;
  title: string;
  target_date: string;
  status: FeatureStatus;
  notes: string;
}

const blankDraft: Draft = { id: null, title: '', target_date: '', status: 'Planned', notes: '' };

function EntryForm({ draft, onChange, onSave, onCancel, busy, idea }: { draft: Draft; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void; busy: boolean; idea: boolean }) {
  return (
    <form
      aria-label={idea ? 'Submit a feature idea' : 'Feature entry'}
      className="mb-4 grid grid-cols-1 gap-3 rounded border-2 border-gold p-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <Field label="Feature">{(id) => <Input id={id} required maxLength={FEATURE_TITLE_MAX_LENGTH} value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} />}</Field>
      {idea ? null : (
        <>
          <Field label="Target date">{(id) => <Input id={id} type="date" value={draft.target_date} onChange={(e) => onChange({ ...draft, target_date: e.target.value })} />}</Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={draft.status} onChange={(e) => onChange({ ...draft, status: e.target.value as FeatureStatus })}>
                {FEATURE_STATUSES.map((s) => (
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

function EntryComments({ entry, busy, onComment }: { entry: FeatureListEntry; busy: boolean; onComment: (body: string) => Promise<boolean> }) {
  const [text, setText] = useState('');
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2">
      {entry.comments.length === 0 ? <p className="text-xs text-muted">No review comments.</p> : null}
      <ul className="flex flex-col gap-1" aria-label={`Comments on ${entry.title}`}>
        {entry.comments.map((c) => (
          <li key={c.id} className="text-sm">
            <span className="font-bold">{c.memberName}</span> <span className="text-xs text-muted">· {c.councilLabel} · {formatFullDate(c.postedAt.slice(0, 10))}</span>
            <span className="block whitespace-pre-wrap">{c.body}</span>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void onComment(text).then((ok) => ok && setText(''));
        }}
      >
        <Field label="Review comment" className="min-w-[16rem] flex-1">
          {(id) => <Input id={id} maxLength={FEATURE_COMMENT_MAX_LENGTH} value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
        <Button type="submit" size="sm" disabled={busy || !text.trim()}>
          Post
        </Button>
      </form>
    </div>
  );
}

export function FutureFeatureList() {
  const user = useUser();
  const keeper = isSuperAdmin(user);
  const list = useLoad(() => db.advisory.listFeatureList(user.memberId), [user.memberId]);
  const [rows, setRows] = useState<FeatureListEntry[] | null>(null);
  const entries = rows ?? list.data ?? [];
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
      ? await run(() => db.advisory.submitFeatureIdea(user.memberId, { title: draft.title, notes: draft.notes }), 'Idea added to the list.')
      : await run(() => db.advisory.saveFeature(user.memberId, { ...draft, target_date: draft.target_date || null }), 'Entry saved.');
    if (ok) setDraft(null);
  };

  const loadStarter = () =>
    run(async () => {
      let out: FeatureListEntry[] = [];
      for (const r of ADVISORY_RELEASES) out = await db.advisory.saveFeature(user.memberId, { title: r.title, target_date: r.target_date, status: r.status, notes: r.notes });
      return out;
    }, 'Starter list loaded.');

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
      <p className="mb-3 text-sm text-muted">Ranked by panel priority. Rate 1 (low) to 5 (high).</p>
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
        <ol aria-label={FUTURE_FEATURE_LIST_TITLE} className="flex flex-col gap-3">
          {entries.map((e) => (
            <li key={e.id} data-priority-rank={e.priorityRank} className="flex flex-col gap-2 rounded border-2 border-navy bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                  <span aria-label={`Priority rank ${e.priorityRank}`} className="rounded bg-navy px-2 py-1 font-serif text-lg font-bold text-white">
                    #{e.priorityRank}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold">{e.title}</span>
                    <span className="block text-xs text-muted">
                      Target: {e.target_date ? formatFullDate(e.target_date) : 'Not set'} · Proposed by {e.proposedByName}
                    </span>
                    {e.notes ? <span className="block text-sm">{e.notes}</span> : null}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Pill tone={statusTone(e.status)}>{e.status}</Pill>
                  <span className="text-xs">
                    Priority {e.ratingAverage === null ? 'not rated' : `${e.ratingAverage.toFixed(2)} / ${FEATURE_RATING_MAX}`} ({e.ratingCount} {e.ratingCount === 1 ? 'rating' : 'ratings'})
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-bold">Your rating</span>
                <RatingPicker entry={e} disabled={busy} onRate={(n) => void run(() => db.advisory.rateFeature(user.memberId, e.id, n))} />
                <Button size="sm" variant="secondary" aria-expanded={openId === e.id} onClick={() => setOpenId(openId === e.id ? null : e.id)}>
                  Comments ({e.comments.length})
                </Button>
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
              {openId === e.id ? <EntryComments entry={e} busy={busy} onComment={(body) => run(() => db.advisory.commentOnFeature(user.memberId, e.id, body))} /> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </Panel>
  );
}

export function PlatformCalendarView() {
  const user = useUser();
  const data = useLoad(async () => {
    const [features, meetings] = await Promise.all([db.advisory.listFeatureList(user.memberId), db.advisory.listMeetings(user.memberId)]);
    return platformCalendar(features, meetings, ADVISORY_ROADMAP);
  }, [user.memberId]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Panel title={PLATFORM_CALENDAR_TITLE}>
      <p className="mb-3 text-sm text-muted">Scheduled releases, advisory meetings and pilot milestones by date.</p>
      {data.error ? <Notice tone="error">{data.error}</Notice> : null}
      {data.data && data.data.length === 0 ? <Empty>Nothing dated yet.</Empty> : null}
      {(data.data?.length ?? 0) > 0 ? (
        <div className="overflow-x-auto">
          <Table caption={PLATFORM_CALENDAR_TITLE} head={['Date', 'Type', 'Item', 'Detail']}>
            {data.data!.map((c, i) => (
              <tr key={`${c.kind}-${c.date}-${i}`} data-calendar-kind={c.kind} className={c.date < today ? 'text-muted' : undefined}>
                <Td className="whitespace-nowrap font-bold">{formatFullDate(c.date)}</Td>
                <Td>
                  <Pill tone={c.kind === 'release' ? 'navy' : c.kind === 'meeting' ? 'gold' : 'outline'}>{PLATFORM_CALENDAR_KIND_LABELS[c.kind]}</Pill>
                </Td>
                <Td>{c.title}</Td>
                <Td>{c.detail ?? '–'}</Td>
              </tr>
            ))}
          </Table>
        </div>
      ) : null}
    </Panel>
  );
}
