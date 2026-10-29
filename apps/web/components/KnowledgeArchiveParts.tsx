'use client';
// The Operations Knowledge Vault (Sprint 8I, operations-knowledge.ts). OperationsKnowledgeArchiveEntryForm is the
// high-contrast entry form at the top of the Operations Knowledge Vault drawer (Grand Knight and Financial Secretary
// Desks; Sprint 8P Stage 3 - it was the Oversight Desk's vault card): the council's Admins, Grand Knight and Deputy Grand Knight pick one of the six governance
// tags, write a note in light markdown (Write / Preview) and save it; the driver stamps the signature and the date.
// KnowledgeArchiveGrid is the read-only archive under System Settings: every entry of the council, filtered by tag,
// fraternal year and text, so a new chairman reads what the last ones learned.
// Sprint 8J: the archive spans every council, each row badged with its originating council stamp, and the "Filter by My
// Home Council Only" toggle narrows it to the viewer's council. The vault card runs the content guard and the KofC
// Charter compliance gate (charter-compliance.ts) as the officer types: the Charter Advisory Warning Panel shows each
// rule the draft breaks, and a SEVERE rule disables the save button until the text is corrected.
import { useMemo, useState } from 'react';
import {
  CHARTER_ADVISORY_PANEL_TITLE,
  CHARTER_SECTION_CHECK,
  describeError,
  filterOperationsKnowledge,
  KNOWLEDGE_ARCHIVE_HREF,
  knowledgeFraternalYear,
  knowledgeContentProblem,
  knowledgeYearsOf,
  OPERATIONS_KNOWLEDGE_CATEGORIES,
  OPERATIONS_KNOWLEDGE_CATEGORY_LABELS,
  OPERATIONS_KNOWLEDGE_MAX_LENGTH,
  reviewCharterCompliance,
  type CharterReview,
  type CouncilOperationsKnowledge,
  type OperationsKnowledgeCategory,
  type SessionUser,
} from '@kofc/shared';
import Link from 'next/link';
import { Markdown } from '@/components/Markdown';
import { Button, cx, Empty, Field, Input, Notice, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { formatFullDate } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const dayOf = (timestamp: string) => formatFullDate(timestamp.slice(0, 10));

/** The tag as a pill. */
export function KnowledgeTag({ tag }: { tag: OperationsKnowledgeCategory }) {
  return <Pill tone="gold">{OPERATIONS_KNOWLEDGE_CATEGORY_LABELS[tag]}</Pill>;
}

/** The originating council stamp as a badge (Sprint 8J). */
export function CouncilStampBadge({ stamp, home }: { stamp: string; home: boolean }) {
  return (
    <span
      title={home ? 'Your home council' : 'Written by a brother council'}
      className={cx(
        'inline-block whitespace-nowrap rounded border-2 px-2 py-0.5 text-xs font-bold',
        home ? 'border-navy bg-navy text-white' : 'border-navy bg-white text-navy',
      )}
    >
      🏛 {stamp}
    </span>
  );
}

/**
 * The Charter Advisory Warning Panel (Sprint 8J): every Charter rule the draft breaks, with its authority. Gold-bordered
 * navy for advisories; red when a SEVERE rule disables saving.
 */
export function CharterAdvisoryPanel({ review }: { review: CharterReview }) {
  if (!review.level) return null;
  const severe = review.blocksSave;
  return (
    <div role="alert" aria-label={CHARTER_ADVISORY_PANEL_TITLE} className={cx('rounded border-4 border-gold p-3 text-white', severe ? 'bg-brand-red' : 'bg-navy')}>
      <p className="font-serif text-lg font-bold tracking-wide">
        ⚠ {CHARTER_ADVISORY_PANEL_TITLE.toUpperCase()} {severe ? '- SAVING IS BLOCKED' : '- ADVISORY'}
      </p>
      <p className="mt-1 text-sm">
        {severe
          ? 'This draft crosses the non-partisan or non-profit boundaries of the Order. Correct the text to turn saving back on.'
          : 'This draft may be saved, but read the rule below first.'}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {review.findings.map((f) => (
          <li key={f.id} className="rounded border-2 border-gold bg-white px-3 py-2 text-navy">
            <p className="font-bold">
              {f.severity === 'SEVERE' ? '⛔' : 'ℹ'} {f.title}
            </p>
            <p className="text-sm">{f.rule}</p>
            {f.quotation ? <blockquote className="mt-1 border-l-4 border-gold pl-2 text-sm italic">{f.quotation}</blockquote> : null}
            <p className="mt-1 text-xs">Source Authority: {f.authority}.</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs">{CHARTER_SECTION_CHECK}</p>
    </div>
  );
}

/**
 * The archive's entry form (canWriteOperationsKnowledge), at the top of the Operations Knowledge Vault drawer: a tag picker, a markdown editor with preview, the
 * live content guard and Charter Advisory Warning Panel, and the council's three latest entries under it.
 */
export function OperationsKnowledgeArchiveEntryForm({ user, councilId }: { user: SessionUser; councilId: number }) {
  const entries = useLoad(() => db.history.listOperationsKnowledge(user.memberId), [user.memberId]);
  const [tag, setTag] = useState<OperationsKnowledgeCategory>('RECRUITING');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const review = useMemo(() => reviewCharterCompliance(text), [text]);
  const contentProblem = useMemo(() => knowledgeContentProblem(text), [text]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await db.history.addOperationsKnowledge(user.memberId, councilId, { category_tag: tag, entry_text: text });
      setMessage({ tone: 'info', text: `Saved to the vault under ${OPERATIONS_KNOWLEDGE_CATEGORY_LABELS[saved.category_tag]}, signed "${saved.officer_signature}".` });
      setText('');
      setPreview(false);
      await entries.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const latest = (entries.data ?? []).filter((e) => e.council_id === councilId).slice(0, 3);
  return (
    <section aria-label="Operations Knowledge Vault: new entry" data-surface="navy" className="flex flex-col gap-3 rounded border-4 border-gold bg-navy p-4 text-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-gold pb-2">
        <h2 className="font-serif text-xl font-bold">🗝️ Operations Knowledge Vault · New Entry</h2>
        <Link href={KNOWLEDGE_ARCHIVE_HREF} className="text-sm font-bold text-gold underline">
          Open the archive
        </Link>
      </header>
      <p className="text-sm">
        Write down what the next chairman needs to know: contacts, deadlines, what worked and what did not. Each entry is signed with your name and seat, and
        cannot be changed later.
      </p>
      <div className="rounded bg-white p-3 text-navy">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <Field label="Governance tag" className="w-56">
            {(id) => (
              <Select id={id} value={tag} onChange={(e) => setTag(e.target.value as OperationsKnowledgeCategory)}>
                {OPERATIONS_KNOWLEDGE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {OPERATIONS_KNOWLEDGE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex gap-1" role="group" aria-label="Editor view">
            <Button size="sm" variant={preview ? 'secondary' : 'primary'} aria-pressed={!preview} onClick={() => setPreview(false)}>
              Write
            </Button>
            <Button size="sm" variant={preview ? 'primary' : 'secondary'} aria-pressed={preview} onClick={() => setPreview(true)}>
              Preview
            </Button>
          </div>
        </div>
        {preview ? (
          <div className="mt-2 max-h-72 min-h-40 overflow-y-auto rounded border-2 border-line px-3 py-2">
            {text.trim() ? <Markdown source={text} idPrefix="knowledge-draft" /> : <p className="text-sm text-muted">Nothing written yet.</p>}
          </div>
        ) : (
          <Field label="Entry (# headings, - bullets, **bold**)" className="mt-2">
            {(id) => (
              <Textarea
                id={id}
                rows={8}
                value={text}
                maxLength={OPERATIONS_KNOWLEDGE_MAX_LENGTH}
                onChange={(e) => setText(e.target.value)}
                className="text-sm"
                placeholder={'## What I learned\n- Book the parish hall two months ahead\n- The pastor prefers a phone call'}
              />
            )}
          </Field>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted">
            {text.length.toLocaleString('en-US')} / {OPERATIONS_KNOWLEDGE_MAX_LENGTH.toLocaleString('en-US')} characters
          </span>
          <Button
            disabled={busy || text.trim() === '' || review.blocksSave || contentProblem !== null}
            title={review.blocksSave ? 'Correct the text the Charter Advisory Warning Panel names first' : undefined}
            onClick={() => void save()}
          >
            Save signed entry
          </Button>
        </div>
        {contentProblem ? (
          <p role="alert" className="mt-2 rounded border-2 border-brand-red px-3 py-2 text-sm font-bold text-brand-red">
            {contentProblem}
          </p>
        ) : null}
      </div>
      <CharterAdvisoryPanel review={review} />
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      {entries.error ? <Notice tone="error">{entries.error}</Notice> : null}
      <div>
        <h3 className="font-serif text-base font-bold">Latest entries</h3>
        {entries.data && latest.length === 0 ? <p className="text-sm">The vault is empty. The first entry starts the council&apos;s record.</p> : null}
        <ul className="mt-1 flex flex-col gap-2">
          {latest.map((e) => (
            <li key={e.entry_id} className="rounded border-2 border-gold px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <KnowledgeTag tag={e.category_tag} />
                <span className="font-bold">{e.officer_signature}</span>
                <span>· {dayOf(e.date_logged)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm">{e.entry_text.replace(/[#*]/g, '').trim()}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * The read-only archive grid (assertMayReadOperationsKnowledge): every council's entries with their council stamp, the
 * "Filter by My Home Council Only" toggle, and tag, fraternal year and text filters.
 */
export function KnowledgeArchiveGrid({ user }: { user: SessionUser }) {
  const entries = useLoad(() => db.history.listOperationsKnowledge(user.memberId), [user.memberId]);
  const [homeOnly, setHomeOnly] = useState(false);
  const [category, setCategory] = useState<OperationsKnowledgeCategory | ''>('');
  const [year, setYear] = useState('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const all: CouncilOperationsKnowledge[] = entries.data ?? [];
  const years = knowledgeYearsOf(all);
  const rows = filterOperationsKnowledge(all, { category: category || null, fraternalYear: year || null, query, homeCouncilId: homeOnly ? user.councilId : null });

  return (
    <div className="flex flex-col gap-3">
      <label className={cx('flex w-fit cursor-pointer items-center gap-3 rounded border-4 px-4 py-2 text-base font-bold', homeOnly ? 'border-gold bg-navy text-white' : 'border-navy bg-white text-navy')}>
        <input type="checkbox" className="h-5 w-5 accent-gold" checked={homeOnly} onChange={(e) => setHomeOnly(e.target.checked)} />
        Filter by My Home Council Only
      </label>
      <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filter the archive">
        <Field label="Governance tag" className="w-48">
          {(id) => (
            <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as OperationsKnowledgeCategory | '')}>
              <option value="">Every tag</option>
              {OPERATIONS_KNOWLEDGE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {OPERATIONS_KNOWLEDGE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fraternal year" className="w-44">
          {(id) => (
            <Select id={id} value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">Every year</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Search" className="min-w-56 flex-1">
          {(id) => <Input id={id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Words in the note, the signature or the council" />}
        </Field>
      </div>
      {entries.error ? <Notice tone="error">{entries.error}</Notice> : null}
      {!entries.data && !entries.error ? <p className="text-sm text-muted">Opening the archive…</p> : null}
      {entries.data && all.length === 0 ? <Empty>No entries yet. The Grand Knight, Deputy Grand Knight and Admins write them in the Operations Knowledge Vault drawer of the Grand Knight Desk.</Empty> : null}
      {entries.data && all.length > 0 && rows.length === 0 ? <Empty>No entry matches these filters.</Empty> : null}
      {rows.length > 0 ? (
        <>
          <p className="text-sm text-muted">
            {rows.length} of {all.length} entr{all.length === 1 ? 'y' : 'ies'}. Click a row to read the full note.
          </p>
          <Table caption="Operations knowledge archive" head={['Logged', 'Fraternal year', 'Council', 'Tag', 'Signed by', 'Note']}>
            {rows.map((r) => {
              const open = openId === r.entry_id;
              return (
                <tr key={r.entry_id} className={cx('align-top', open && 'bg-gold/10')}>
                  <Td className="whitespace-nowrap">{dayOf(r.date_logged)}</Td>
                  <Td className="whitespace-nowrap">{knowledgeFraternalYear(r.date_logged)}</Td>
                  <Td>
                    <CouncilStampBadge stamp={r.origin_council_stamp} home={r.council_id === user.councilId} />
                  </Td>
                  <Td>
                    <KnowledgeTag tag={r.category_tag} />
                  </Td>
                  <Td className="font-bold">{r.officer_signature}</Td>
                  <Td>
                    <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : r.entry_id)} className="w-full text-left">
                      {open ? (
                        <div className="rounded border-2 border-navy bg-white px-3 py-2">
                          <Markdown source={r.entry_text} idPrefix={`knowledge-${r.entry_id}`} />
                        </div>
                      ) : (
                        <span className="line-clamp-2">{r.entry_text.replace(/[#*]/g, '').trim()}</span>
                      )}
                    </button>
                  </Td>
                </tr>
              );
            })}
          </Table>
        </>
      ) : null}
    </div>
  );
}
