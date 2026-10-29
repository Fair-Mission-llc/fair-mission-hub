'use client';
// Sprint 11 Revision 9.0: the Form 1728 line the interrogation engine (form-1728.ts) reads from an event's or activity's
// title. The badge is read-only: renaming the record is the only way to refile it. The year-to-date panel totals the
// council's activity hours by line from January 1.
import { classifyForm1728, form1728YearToDate, tallyForm1728, type Form1728HoursRow } from '@kofc/shared';
import { cx, Empty, Notice, Panel, Table, Td } from '@/components/ui';
import { formatDecimalHours } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** A small pill naming the line, e.g. 'Community A'; dashed when the record filed to the default line. */
export function Form1728Badge({ title, description, live = false }: { title: string; description?: string | null; live?: boolean }) {
  const line = classifyForm1728(title, description);
  return (
    <span
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      title={`Form 1728 ${line.section} line ${line.line}: ${line.label}${line.cues.length ? ` (read from: ${line.cues.join(', ')})` : ' (no clear match, so the default line)'}`}
      className={cx(
        'inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wide',
        line.confidence === 'default' ? 'border-dashed border-line bg-white text-muted' : 'border-gold bg-gold text-navy',
      )}
    >
      {line.section} {line.line} · {line.label}
    </span>
  );
}

/** The badge with a caption, for an entry form: it updates as the title is typed. */
export function Form1728Preview({ title, description }: { title: string; description?: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-navy">Form 1728 line (filed automatically)</span>
      {title.trim() === '' ? <span className="text-sm text-muted">Type a name to see its line.</span> : <Form1728Badge title={title} description={description} live />}
    </div>
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
