'use client';
// The Supreme roster CSV uploader (Sprint 10 Revision 3.0): moved off the Supreme Council Compliance Center onto the
// Financial Secretary Desk's 'Excel Roster Imports' drawer, its only home, as a simplified file uploader - choose the
// CSV, check the row count, sync. Supreme Headquarters' export (or the Excel roster template saved as CSV) is read in the
// browser for the preview, and again on the server (readRosterOnServer) for the rows that are stored
// (supreme.syncSupremeRoster). New members are added with their join date, wear the New Member badge for 180 days and are
// sent the welcome email with a one-time setup code. The council's Financial Secretary, its Admins and Super Admins
// (canSyncSupremeRoster; the server: assertMaySyncSupremeRoster).
import { useState } from 'react';
import { describeError, parseSupremeRosterCsv, type SupremeRosterRow, type SupremeRosterSyncResult } from '@kofc/shared';
import { Button, Field, NewMemberBadge, Notice, Panel } from '@/components/ui';
import { useUser } from '@/lib/session';
import { db } from '@/services/db';
import { readRosterOnServer } from '@/services/roster-transport';

/** Supreme Headquarters' roster export, brought into the council's Member table (supreme.syncSupremeRoster). */
export function SupremeRosterUploader({ councilId }: { councilId: number }) {
  const user = useUser();
  const [csv, setCsv] = useState('');
  const [rows, setRows] = useState<SupremeRosterRow[] | null>(null);
  const [result, setResult] = useState<SupremeRosterSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const read = (text: string) => {
    setCsv(text);
    setResult(null);
    setError(null);
    try {
      setRows(text.trim() === '' ? null : parseSupremeRosterCsv(text));
    } catch (err) {
      setRows(null);
      setError(describeError(err));
    }
  };
  const sync = async () => {
    if (!rows) return;
    setBusy(true);
    setError(null);
    try {
      // The preview above is read in the browser; the rows synced are the server's reading (Sprint 6Z-Engine-Upgrade).
      setResult(await db.supreme.syncSupremeRoster(user.memberId, councilId, await readRosterOnServer(councilId, csv)));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Supreme roster CSV upload">
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          Load Supreme Headquarters&apos; roster export (CSV: Member Number, First Name, Last Name, Email, Phone, Street, Street 2, City, State, Zip,
          Birth Date, Degree, Date Joined, Charter Member). New members are added with their join date and wear the [🆕 New Member] badge for 180 days;
          each is sent the welcome email with the Expo Go download steps and a one-time setup code the moment the roster is stored, and joins the
          council-wide distribution lists.
        </p>
        <p className="text-sm">
          Building the roster by hand?{' '}
          <a className="font-bold underline" href="/templates/roster_import_template.xlsx" download>
            Download the Excel roster template
          </a>{' '}
          (drop-down lists for Role, Degree and Charter Member, and a sample row), fill it in, then save the Roster sheet as CSV and load it here.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Roster file">
            {(id) => (
              <input
                id={id}
                type="file"
                accept=".csv,text/csv"
                className="text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void file.text().then(read);
                }}
              />
            )}
          </Field>
        </div>
        {error ? (
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        ) : null}
        <Button variant="gold" disabled={busy || !rows || rows.length === 0} onClick={() => void sync()} className="self-start">
          {busy ? 'Syncing…' : rows ? `Sync ${rows.length} roster row${rows.length === 1 ? '' : 's'} from Supreme` : 'Sync roster from Supreme'}
        </Button>
        {result ? (
          <div className="flex flex-col gap-2" aria-live="polite">
            <Notice tone="info">
              {result.created.length} new member{result.created.length === 1 ? '' : 's'} added and welcomed, {result.updated.length} join date
              {result.updated.length === 1 ? '' : 's'} updated, {result.skipped.length} row{result.skipped.length === 1 ? '' : 's'} skipped.
            </Notice>
            {result.created.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {result.created.map((m) => (
                  <li key={m.id}>
                    <strong>
                      {m.MemberLastName}, {m.MemberFirstName}
                    </strong>{' '}
                    #{m.MemberNumber} · joined {m.DateJoinedCouncil}
                    <NewMemberBadge member={m} />
                  </li>
                ))}
              </ul>
            ) : null}
            {result.skipped.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {result.skipped.map((s, i) => (
                  <li key={i} className="text-brand-red">
                    {s.memberNumber !== null ? `#${s.memberNumber}: ` : ''}
                    {s.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
