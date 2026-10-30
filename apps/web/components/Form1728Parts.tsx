'use client';
// Sprint 11 Revision 9.0: the Form 1728 line the interrogation engine (form-1728.ts) reads from an event's or activity's
// title, as a read-only badge, and the year-to-date panel that totals the council's activity hours by line.
// Sprint 11 Revision 10.0: the event form's suggestion popup (Form1728SuggestionDialog). It shows the engine's best
// guess and its runner-up lines, plus a searchable list of every line, and the officer's pick is saved in
// Event.form_1728_line. A badge for a record with a confirmed line shows that line, marked 'Confirmed'.
// Sprint 11 Revision 11.0: the same popup confirms an activity's line (Activities.form_1728_line, schema 109) through
// useForm1728Confirm, on the Activities page and the Admin Desk's Council Lookup Tables.
// Sprint 11 Revision 15.0: the year-to-date panel reads compileForm1728Report (section subtotals and grand totals) and
// offers one-click Print (a print-ready sheet listing every line, as the paper form does) and CSV export.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  compileForm1728Report,
  form1728Line,
  form1728ReportCsv,
  form1728YearToDate,
  FORM_1728_LINES,
  isForm1728LineCode,
  resolveForm1728Line,
  searchForm1728Lines,
  suggestForm1728Lines,
  type Form1728Context,
  type Form1728HoursRow,
  type Form1728LineCode,
  type Form1728Report,
} from '@kofc/shared';
import { Button, cx, Empty, Input, Notice, Panel, Table, Td } from '@/components/ui';
import { formatDecimalHours } from '@/lib/format';
import { useTenantType } from '@/lib/session';
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

export interface Form1728Question {
  title: string;
  description?: string | null;
  context?: Form1728Context;
  /** The line already stored on the record, preselected when it is still valid. */
  initial?: string | null;
}

/**
 * Sprint 11 Revision 11.0: the suggestion popup as a promise, for a form that saves in its own handler (the activity
 * grid, the Admin Desk's Council Lookup Tables). `ask` opens the popup and resolves to the confirmed code, or null
 * when the officer cancels; render `dialog` once in the component.
 */
export function useForm1728Confirm(): { ask: (question: Form1728Question) => Promise<Form1728LineCode | null>; dialog: ReactNode } {
  const [open, setOpen] = useState<{ question: Form1728Question; resolve: (code: Form1728LineCode | null) => void } | null>(null);
  const ask = useCallback(
    (question: Form1728Question) => new Promise<Form1728LineCode | null>((resolve) => setOpen({ question, resolve })),
    [],
  );
  const close = (code: Form1728LineCode | null) => {
    open?.resolve(code);
    setOpen(null);
  };
  const dialog = open ? (
    <Form1728SuggestionDialog
      key={`${open.question.title}\u0000${open.question.initial ?? ''}`}
      title={open.question.title}
      description={open.question.description}
      context={open.question.context}
      initial={open.question.initial}
      onConfirm={(code) => close(code)}
      onCancel={() => close(null)}
    />
  ) : null;
  return { ask, dialog };
}

/**
 * Sprint 11 Revision 12.0: Form 1728 is a Knights of Columbus report, so its badges, year-to-date panel and suggestion
 * popups appear only for a 'KofC' parent organization. A SECULAR_CHARITY tenant saves events and activities without them.
 */
export function useForm1728Enabled(): boolean {
  return useTenantType() === 'KOFC';
}

/** Thrown when the officer cancels the popup: the record is not saved. */
export const FORM_1728_CANCELLED_MESSAGE = 'Not saved. Confirm a Form 1728 line to save the activity.';

/**
 * Whether saving a record should open the popup: a new record, a renamed one, or one with no confirmed line yet.
 * `storedName` and `storedLine` are null for a new record.
 */
export function needsForm1728Confirmation(name: string, storedName: string | null, storedLine: string | null | undefined): boolean {
  return storedName === null || !isForm1728LineCode(storedLine) || name.trim() !== storedName.trim();
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The report as a standalone, print-ready page: every line of the form, section subtotals and the grand total. */
export function form1728PrintHtml(report: Form1728Report, heading: string): string {
  const hours = (n: number) => escapeHtml(formatDecimalHours(n));
  const body = report.sections
    .map(
      (s) =>
        `<tr class="sec"><th colspan="5">${s.section}</th></tr>` +
        s.lines
          .map(
            (l) =>
              `<tr><td>${l.line}. ${escapeHtml(l.label)}</td><td>${escapeHtml(l.records.join(', '))}</td><td>${l.entries}</td><td>${l.volunteers}</td><td>${hours(l.hours)}</td></tr>`,
          )
          .join('') +
        `<tr class="sub"><td colspan="2">${s.section} subtotal</td><td>${s.entries}</td><td>${s.volunteers}</td><td>${hours(s.hours)}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(heading)}</title><style>
body{font:11pt Georgia,serif;margin:0.6in}h1{font-size:16pt;margin:0 0 4pt}p{margin:0 0 12pt;color:dimgray}
table{width:100%;border-collapse:collapse}th,td{border:1px solid gray;padding:3pt 5pt;text-align:left;vertical-align:top}
td:nth-child(n+3){text-align:right;white-space:nowrap}.sec th{background:gainsboro}.sub td,.tot td{font-weight:bold}
tr{page-break-inside:avoid}</style></head><body><h1>${escapeHtml(heading)}</h1>
<p>Activity hours ${report.fromDate} to ${report.toDate}. ${report.totals.volunteers} volunteers, ${report.totals.entries} entries.</p>
<table><thead><tr><th>Line</th><th>Activities</th><th>Entries</th><th>Volunteers</th><th>Hours</th></tr></thead><tbody>${body}
<tr class="tot"><td colspan="2">Total</td><td>${report.totals.entries}</td><td>${report.totals.volunteers}</td><td>${hours(report.totals.hours)}</td></tr>
</tbody></table></body></html>`;
}

/** The council's activity hours from January 1 to today, by Form 1728 line, with Print and CSV export. */
export function Form1728YearToDatePanel({ activities }: { activities: { id: number; ActivityName: string; ActivityDescription: string }[] }) {
  const ids = activities.map((a) => a.id).join(',');
  const logs = useLoad(() => Promise.all(activities.map((a) => db.activityTime.listByActivity(a.id))), [ids]);
  const span = form1728YearToDate(new Date());
  const rows: Form1728HoursRow[] = useMemo(
    () =>
      (logs.data ?? []).flatMap((log) =>
        log.entries.map((e) => ({
          title: log.activity.ActivityName,
          description: log.activity.ActivityDescription,
          line: log.activity.form_1728_line ?? null,
          date: e.row.ActivityDate,
          hours: e.row.Hours,
          memberId: e.row.MemberID,
        })),
      ),
    [logs.data],
  );
  if (logs.error) return <Notice tone="error">{logs.error}</Notice>;
  if (!logs.data) return <p className="text-sm text-muted">Totaling the Form 1728 lines…</p>;
  const year = span.fromDate.slice(0, 4);
  const heading = `Form 1728 year to date (${year})`;
  const report = compileForm1728Report(rows, span.fromDate, span.toDate);
  const print = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(form1728PrintHtml(compileForm1728Report(rows, span.fromDate, span.toDate, { includeEmptyLines: true }), heading));
    win.document.close();
    win.focus();
    win.print();
  };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([form1728ReportCsv(report)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `form-1728-${span.fromDate}-to-${span.toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const actions =
    report.totals.lines > 0 ? (
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={print}>
          Print
        </Button>
        <Button size="sm" variant="secondary" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
    ) : undefined;
  return (
    <Panel title={heading} actions={actions}>
      {report.totals.lines === 0 ? (
        <Empty>No activity hours have been logged since January 1.</Empty>
      ) : (
        <Table caption="Activity hours by Form 1728 line" head={['Line', 'Activities', 'Entries', 'Volunteers', 'Hours']}>
          {report.sections
            .filter((s) => s.lines.length > 0)
            .flatMap((s) => [
              ...s.lines.map((l) => (
                <tr key={l.code}>
                  <Td className="whitespace-nowrap font-bold">
                    {l.section} {l.line} · {l.label}
                  </Td>
                  <Td className="text-xs">{l.records.join(', ')}</Td>
                  <Td>{l.entries}</Td>
                  <Td>{l.volunteers}</Td>
                  <Td>{formatDecimalHours(l.hours)}</Td>
                </tr>
              )),
              <tr key={`${s.section}-subtotal`} className="italic">
                <Td colSpan={2} className="text-right">
                  {s.section} subtotal
                </Td>
                <Td>{s.entries}</Td>
                <Td>{s.volunteers}</Td>
                <Td>{formatDecimalHours(s.hours)}</Td>
              </tr>,
            ])}
          <tr className="font-bold">
            <Td colSpan={2} className="text-right">
              Total
            </Td>
            <Td>{report.totals.entries}</Td>
            <Td>{report.totals.volunteers}</Td>
            <Td>{formatDecimalHours(report.totals.hours)}</Td>
          </tr>
        </Table>
      )}
    </Panel>
  );
}
