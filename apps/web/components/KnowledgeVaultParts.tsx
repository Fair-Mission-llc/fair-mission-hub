'use client';
// The Global Operations Knowledge Vault (Sprint 8I, operations-knowledge.ts). OperationsKnowledgeVault is the Oversight
// Desk's high-contrast card: the council's Admins, Grand Knight and Deputy Grand Knight pick one of the six governance
// tags, write a note in light markdown (Write / Preview) and save it; the driver stamps the signature and the date.
// KnowledgeArchiveGrid is the read-only archive under System Settings: every entry of the council, filtered by tag,
// fraternal year and text, so a new chairman reads what the last ones learned.
import { useState } from 'react';
import {
  describeError,
  filterOperationsKnowledge,
  KNOWLEDGE_ARCHIVE_HREF,
  knowledgeFraternalYear,
  knowledgeYearsOf,
  OPERATIONS_KNOWLEDGE_CATEGORIES,
  OPERATIONS_KNOWLEDGE_CATEGORY_LABELS,
  OPERATIONS_KNOWLEDGE_MAX_LENGTH,
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

/**
 * The Oversight Desk's vault card (canWriteOperationsKnowledge): a tag picker, a markdown editor with preview, and the
 * council's three latest entries under it.
 */
export function OperationsKnowledgeVault({ user, councilId }: { user: SessionUser; councilId: number }) {
  const entries = useLoad(() => db.history.listOperationsKnowledge(user.memberId, councilId), [user.memberId, councilId]);
  const [tag, setTag] = useState<OperationsKnowledgeCategory>('RECRUITING');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

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

  const latest = (entries.data ?? []).slice(0, 3);
  return (
    <section aria-label="Global Operations Knowledge Vault" data-surface="navy" className="flex flex-col gap-3 rounded border-4 border-gold bg-navy p-4 text-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-gold pb-2">
        <h2 className="font-serif text-xl font-bold">🗝️ Global Operations Knowledge Vault</h2>
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
          <Button disabled={busy || text.trim() === ''} onClick={() => void save()}>
            Save signed entry
          </Button>
        </div>
      </div>
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

/** The read-only archive grid (assertMayReadOperationsKnowledge): tag, fraternal year and text filters over every entry. */
export function KnowledgeArchiveGrid({ user, councilId }: { user: SessionUser; councilId: number }) {
  const entries = useLoad(() => db.history.listOperationsKnowledge(user.memberId, councilId), [user.memberId, councilId]);
  const [category, setCategory] = useState<OperationsKnowledgeCategory | ''>('');
  const [year, setYear] = useState('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const all: CouncilOperationsKnowledge[] = entries.data ?? [];
  const years = knowledgeYearsOf(all);
  const rows = filterOperationsKnowledge(all, { category: category || null, fraternalYear: year || null, query });

  return (
    <div className="flex flex-col gap-3">
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
          {(id) => <Input id={id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Words in the note or the signature" />}
        </Field>
      </div>
      {entries.error ? <Notice tone="error">{entries.error}</Notice> : null}
      {!entries.data && !entries.error ? <p className="text-sm text-muted">Opening the archive…</p> : null}
      {entries.data && all.length === 0 ? <Empty>No entries yet. The Grand Knight, Deputy Grand Knight and Admins write them on the Oversight Desk.</Empty> : null}
      {entries.data && all.length > 0 && rows.length === 0 ? <Empty>No entry matches these filters.</Empty> : null}
      {rows.length > 0 ? (
        <>
          <p className="text-sm text-muted">
            {rows.length} of {all.length} entr{all.length === 1 ? 'y' : 'ies'}. Click a row to read the full note.
          </p>
          <Table caption="Operations knowledge archive" head={['Logged', 'Fraternal year', 'Tag', 'Signed by', 'Note']}>
            {rows.map((r) => {
              const open = openId === r.entry_id;
              return (
                <tr key={r.entry_id} className={cx('align-top', open && 'bg-gold/10')}>
                  <Td className="whitespace-nowrap">{dayOf(r.date_logged)}</Td>
                  <Td className="whitespace-nowrap">{knowledgeFraternalYear(r.date_logged)}</Td>
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
