'use client';
// Sprint 11 Revision 9.0: the Form 1728 line the interrogation engine (form-1728.ts) reads from an event's or activity's
// title, as a read-only badge, and the year-to-date panel that totals the council's activity hours by line.
// Sprint 11 Revision 10.0: the event form's suggestion popup (Form1728SuggestionDialog). It shows the engine's best
// guess and its runner-up lines, plus a searchable list of every line, and the officer's pick is saved in
// Event.form_1728_line. A badge for a record with a confirmed line shows that line, marked 'Confirmed'.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  form1728Line,
  form1728YearToDate,
  FORM_1728_LINES,
  isForm1728LineCode,
  resolveForm1728Line,
  searchForm1728Lines,
  suggestForm1728Lines,
  tallyForm1728,
  type Form1728Context,
  type Form1728HoursRow,
  type Form1728LineCode,
} from '@kofc/shared';
import { Button, cx, Empty, Input, Notice, Panel, Table, Td } from '@/components/ui';
import { formatDecimalHours } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/**
 * A small pill naming the line, e.g. 'Community A'. Gold when an officer confirmed it (`stored`) or the engine is sure;
 * dashed when the record fell to the default line.
 */
export function Form1728Badge({
  title,
  description,
  stored,
  context,
  live = false,
}: {
  title: string;
  description?: string | null;
  stored?: string | null;
  context?: Form1728Context;
  live?: boolean;
}) {
  const line = resolveForm1728Line(stored, title, description, context);
  const vague = !line.confirmed && line.code === 'COMMUNITY_N';
  return (
    <span
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      title={`Form 1728 ${line.section} line ${line.line}: ${line.label}${line.confirmed ? ' (confirmed by an officer)' : ' (read from the title)'}`}
      className={cx(
        'inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wide',
        vague ? 'border-dashed border-line bg-white text-muted' : 'border-gold bg-gold text-navy',
      )}
    >
      {line.section} {line.line} · {line.label}
      {line.confirmed ? ' · Confirmed' : ''}
    </span>
  );
}

/** The badge with a caption, for an entry form: it updates as the title is typed. */
export function Form1728Preview({
  title,
  description,
  stored,
  context,
}: {
  title: string;
  description?: string | null;
  stored?: string | null;
  context?: Form1728Context;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-navy">Form 1728 line</span>
      {title.trim() === '' && !stored ? (
        <span className="text-sm text-muted">Type a name to see its line.</span>
      ) : (
        <Form1728Badge title={title} description={description} stored={stored} context={context} live />
      )}
    </div>
  );
}

/**
 * The suggestion popup. Opens over the event form when the officer saves; Esc, Cancel or the backdrop close it without
 * saving. `initial` is the line already stored on the event, if any.
 */
export function Form1728SuggestionDialog({
  title,
  description,
  context,
  initial,
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string | null;
  context?: Form1728Context;
  initial?: string | null;
  onConfirm: (code: Form1728LineCode) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const suggestions = useMemo(() => suggestForm1728Lines(title, description, context), [title, description, context]);
  const best = suggestions[0];
  const [chosen, setChosen] = useState<Form1728LineCode>(isForm1728LineCode(initial) ? initial : best.code);
  const [query, setQuery] = useState('');
  const matches = searchForm1728Lines(query);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);
  const picked = form1728Line(chosen);
  return (
    <dialog
      ref={ref}
      aria-labelledby="form-1728-dialog-title"
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
      className="w-[min(40rem,calc(100vw-2rem))] rounded border-4 border-navy bg-white p-0 text-black shadow-xl backdrop:bg-navy/70"
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 id="form-1728-dialog-title" className="font-serif text-xl font-bold text-navy">
          Confirm the Form 1728 line
        </h2>
        <p className="text-sm">
          For <span className="font-bold">{title || 'this event'}</span>, the system suggests:
        </p>
        <div className="rounded border-l-8 border-gold bg-white px-4 py-3 ring-1 ring-line">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Best guess{best.confidence === 'default' ? ' (no clear match, so the general line)' : best.confidence === 'strong' ? ' (strong match)' : ' (likely match)'}
          </p>
          <p className="text-lg font-bold">
            {best.section} line {best.line} · {best.label}
          </p>
          {best.cues.length > 0 ? <p className="text-xs text-muted">Read from: {best.cues.join(', ')}</p> : null}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-navy">Suggested lines</legend>
          {suggestions.map((s) => (
            <label key={s.code} className="flex items-center gap-2 text-sm">
              <input type="radio" name="form-1728-suggestion" className="size-4" checked={chosen === s.code} onChange={() => setChosen(s.code)} />
              <span>
                {s.section} line {s.line} · {s.label}
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-2">
          <label htmlFor="form-1728-search" className="text-xs font-bold uppercase tracking-wide text-navy">
            Or choose any line
          </label>
          <Input id="form-1728-search" type="search" placeholder="Search, e.g. rosary, Life, blood" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select
            aria-label="Every Form 1728 line"
            size={6}
            className="w-full rounded border border-line bg-white p-1 text-sm"
            value={chosen}
            onChange={(e) => setChosen(e.target.value as Form1728LineCode)}
          >
            {(matches.length > 0 ? matches : FORM_1728_LINES).map((l) => (
              <option key={l.code} value={l.code}>
                {l.section} line {l.line} · {l.label}
              </option>
            ))}
          </select>
          {query !== '' && matches.length === 0 ? <p className="text-xs text-muted">No line matches; showing every line.</p> : null}
        </div>
        <p className="text-sm">
          Selected:{' '}
          <span className="font-bold">
            {picked.section} line {picked.line} · {picked.label}
          </span>
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(chosen)}>Confirm line and save</Button>
        </div>
      </div>
    </dialog>
  );
}

/** The council's activity hours from January 1 to today, by Form 1728 line. */
export function Form1728YearToDatePanel({ activities }: { activities: { id: number; ActivityName: string; ActivityDescription: string }[] }) {
  const ids = activities.map((a) => a.id).join(',');
  const logs = useLoad(() => Promise.all(activities.map((a) => db.activityTime.listByActivity(a.id))), [ids]);
  const span = form1728YearToDate(new Date());
  if (logs.error) return <Notice tone="error">{logs.error}</Notice>;
  if (!logs.data) return <p className="text-sm text-muted">Totaling the Form 1728 lines…</p>;
  const rows: Form1728HoursRow[] = logs.data.flatMap((log) =>
    log.entries.map((e) => ({
      title: log.activity.ActivityName,
      description: log.activity.ActivityDescription,
      date: e.row.ActivityDate,
      hours: e.row.Hours,
      memberId: e.row.MemberID,
    })),
  );
  const lines = tallyForm1728(rows, span.fromDate, span.toDate);
  const total = lines.reduce((n, l) => n + l.hours, 0);
  return (
    <Panel title={`Form 1728 year to date (${span.fromDate.slice(0, 4)})`}>
      {lines.length === 0 ? (
        <Empty>No activity hours have been logged since January 1.</Empty>
      ) : (
        <Table caption="Activity hours by Form 1728 line" head={['Line', 'Activities', 'Entries', 'Volunteers', 'Hours']}>
          {lines.map((l) => (
            <tr key={l.code}>
              <Td className="whitespace-nowrap font-bold">
                {l.section} {l.line} · {l.label}
              </Td>
              <Td className="text-xs">{l.records.join(', ')}</Td>
              <Td>{l.entries}</Td>
              <Td>{l.volunteers}</Td>
              <Td>{formatDecimalHours(l.hours)}</Td>
            </tr>
          ))}
          <tr className="font-bold">
            <Td colSpan={4} className="text-right">
              Total
            </Td>
            <Td>{formatDecimalHours(total)}</Td>
          </tr>
        </Table>
      )}
    </Panel>
  );
}
