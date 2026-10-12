'use client';
// The tabbed dashboard's widgets and Officer Desks (Sprint 7J, officer-desks.ts). Home carries four widgets for every
// dashboard reader - the Bible Verse of the Day, the Live Actionable Reminders Stream, the Liturgical Feast Day Tracker
// and Today's Event Agenda - and each desk is a compact grid of the queues of one physical desk, with a link to the full
// desk page for every signature. The desks never sign anything themselves: the commands stay on their own pages, behind
// their own gates (expenseOrderBlock, expenseLedgerCodeBlock, expenseCounterSignBlock).
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  awaitsWrittenOrder,
  buildReminderStream,
  canAdministerCouncil,
  canLogConcludedRevenue,
  canOpenExpenseAuditDesk,
  canOpenExpenseAuthorizeDesk,
  canOpenTreasurerDesk,
  dailyVerse,
  describeError,
  feastDayTracker,
  FEAST_TRACKER_DAYS,
  formatShiftWhen,
  HOLY_DAY_BADGE,
  NABRE_NOTICE,
  todaysAgenda,
  toIsoDate,
  type ExpenseReportDetail,
  type SessionUser,
} from '@kofc/shared';
import { ExpenseStatusPill, HonorVoucherBadge } from '@/components/ExpenseParts';
import { Button, cx, Empty, Notice, Panel, Pill, Table, Td } from '@/components/ui';
import { formatFullDate, formatMoney, formatPersonName } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** How far ahead the Member Desk lists the member's own shifts. */
const MEMBER_DESK_SHIFT_DAYS = 30;
/** How many rows a desk grid shows before pointing to the full desk. */
const DESK_ROWS = 6;

const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const shortTime = (hms: string | null) => {
  if (!hms) return 'All day';
  const [h, m] = hms.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** A desk tile: a big count (none for a plain link tile) over a label, gold-topped like the dashboard's stat tiles, linking to the full desk. */
function DeskCount({ label, count, href, cta }: { label: string; count?: number | null; href: string; cta: string }) {
  return (
    <section aria-label={label} className="flex flex-col gap-1 rounded border-2 border-navy border-t-8 border-t-gold bg-white px-4 py-3">
      <h3 className="text-sm font-bold">{label}</h3>
      {count === undefined ? null : <p className={cx('text-4xl font-bold leading-tight', count ? 'text-brand-red' : 'text-navy')}>{count ?? '…'}</p>}
      <Link href={href} className="text-sm font-bold text-navy underline">
        {cta}
      </Link>
    </section>
  );
}

/** A queue of expense sheets in a compact grid, oldest first, with the full desk one click away. */
function SheetQueue({ caption, rows, href, cta, signerColumn }: { caption: string; rows: readonly ExpenseReportDetail[]; href: string; cta: string; signerColumn?: (d: ExpenseReportDetail) => ReactNode }) {
  if (rows.length === 0) return <Empty>Nothing waits here. Every sheet has moved on.</Empty>;
  return (
    <>
      <Table caption={caption} head={['Sheet', 'Submitted by', 'Amount', ...(signerColumn ? ['Signed so far'] : []), 'Status']}>
        {rows.slice(0, DESK_ROWS).map((d) => (
          <tr key={d.report.id}>
            <Td className="font-bold">#{d.report.id}</Td>
            <Td>
              {formatPersonName(d.submitterFirstName, d.submitterLastName)}
              {d.honorVoucher ? (
                <span className="block">
                  <HonorVoucherBadge detail={d} />
                </span>
              ) : null}
            </Td>
            <Td className="text-right">{formatMoney(d.total)}</Td>
            {signerColumn ? <Td className="text-xs">{signerColumn(d)}</Td> : null}
            <Td>
              <ExpenseStatusPill report={d.report} />
            </Td>
          </tr>
        ))}
      </Table>
      <p className="mt-2 text-sm">
        {rows.length > DESK_ROWS ? `${rows.length - DESK_ROWS} more waiting. ` : ''}
        <Link href={href} className="font-bold underline">
          {cta}
        </Link>
      </p>
    </>
  );
}

// ---- Home -------------------------------------------------------------------------------------------

function VerseOfTheDay({ today }: { today: string }) {
  const verse = dailyVerse(today);
  return (
    <Panel title="Bible Verse of the Day">
      <blockquote className="border-l-8 border-gold pl-4">
        <p className="font-serif text-lg">“{verse.text}”</p>
        <p className="mt-2 font-bold">{verse.reference} (NABRE)</p>
      </blockquote>
      <p className="mt-3 text-xs text-muted">{NABRE_NOTICE}</p>
    </Panel>
  );
}

function FeastDayTracker({ today }: { today: string }) {
  const tracker = feastDayTracker(today);
  return (
    <Panel title="Liturgical Feast Day Tracker">
      <div data-surface="navy" className={cx('rounded border-l-8 bg-navy p-4 text-white', tracker.today.holyDayOfObligation ? 'border-crimson' : 'border-gold')}>
        <p className="font-serif text-lg font-bold">{tracker.today.text}</p>
        {tracker.today.holyDayOfObligation ? <p className="mt-1 inline-block rounded bg-crimson px-2 py-0.5 text-sm font-bold">{HOLY_DAY_BADGE}</p> : null}
        {tracker.today.note ? <p className="mt-1 text-sm">{tracker.today.note}</p> : null}
      </div>
      {tracker.upcoming.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No feast or holy day in the next {FEAST_TRACKER_DAYS} days.</p>
      ) : (
        <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto pr-1" aria-label={`Feasts in the next ${FEAST_TRACKER_DAYS} days`}>
          {tracker.upcoming.map((o) => (
            <li key={`${o.date}-${o.title}`} className="flex items-baseline justify-between gap-3 border-b border-line pb-1 text-sm">
              <span>
                <span className="font-bold">{shortDay(o.date)}</span> · {o.title}
                {o.holyDayOfObligation ? <span className="ml-1 font-bold text-crimson">Holy Day</span> : null}
              </span>
              <Pill tone="outline">{o.daysAway === 1 ? 'Tomorrow' : `In ${o.daysAway} days`}</Pill>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ReminderStream({ user, councilId }: { user: SessionUser; councilId: number }) {
  const { alertsVersion } = useSession();
  const stream = useLoad(async () => {
    const [alerts, written, coding, counter] = await Promise.all([
      db.notifications.listMemberAlerts(user.memberId),
      canOpenExpenseAuditDesk(user, councilId) ? db.expenses.listCouncilQueue(user.memberId, councilId).then((r) => r.filter((d) => awaitsWrittenOrder(d.report)).length) : undefined,
      canOpenTreasurerDesk(user, councilId) ? db.expenses.listTreasurerQueue(user.memberId, councilId).then((r) => r.length) : undefined,
      canOpenExpenseAuthorizeDesk(user, councilId) ? db.expenses.listAuthorizationQueue(user.memberId, councilId).then((r) => r.length) : undefined,
    ]);
    return buildReminderStream({ alerts, queues: { writtenOrder: written, ledgerCoding: coding, counterSignature: counter } });
  }, [user, councilId, alertsVersion]);
  const reload = stream.reload;
  useEffect(() => {
    const timer = setInterval(() => void reload(), 60_000);
    return () => clearInterval(timer);
  }, [reload]);
  const rows = stream.data ?? [];
  return (
    <Panel title="Live Actionable Reminders" actions={rows.length > 0 ? <Pill tone="red">{rows.length}</Pill> : null}>
      {stream.error ? <Notice tone="error">{stream.error}</Notice> : null}
      {stream.data && rows.length === 0 ? <Empty>You are all caught up. Nothing needs your action.</Empty> : null}
      {rows.length > 0 ? (
        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1" aria-label="Actionable reminders">
          {rows.map((r) => (
            <li key={r.key} className={cx('rounded border-l-4 bg-white px-3 py-2 ring-1 ring-line', r.priority === 'High' ? 'border-brand-red' : r.priority === 'Medium' ? 'border-gold' : 'border-line')}>
              <p className="font-bold">{r.href ? <Link href={r.href} className="underline">{r.title}</Link> : r.title}</p>
              <p className="text-sm">{r.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-muted">Refreshes every minute. The alert bell keeps the full six-month log.</p>
    </Panel>
  );
}

function TodaysAgenda({ councilId, today }: { councilId: number; today: string }) {
  const entries = useLoad(() => db.events.listCalendarRange(councilId, today, today), [councilId, today]);
  const rows = todaysAgenda(entries.data ?? [], today);
  return (
    <Panel title={`Today's Event Agenda · ${formatFullDate(today)}`}>
      {entries.error ? <Notice tone="error">{entries.error}</Notice> : null}
      {entries.data && rows.length === 0 ? <Empty>No event or meeting today. The council calendar shows what is coming.</Empty> : null}
      {rows.length > 0 ? (
        <Table caption="Today's events and meetings" head={['Time', 'What', 'Where']}>
          {rows.map((e) => (
            <tr key={`${e.kind}-${e.id}`}>
              <Td className="whitespace-nowrap font-bold">{e.kind === 'meeting' ? shortTime(e.startTime) : e.startDate === e.endDate ? 'All day' : `Through ${shortDay(e.endDate)}`}</Td>
              <Td>
                <Link href="/calendar" className="font-bold underline">
                  {e.title}
                </Link>
                <span className="block text-xs text-muted">{e.kind === 'event' ? 'Event' : 'Meeting'}</span>
              </Td>
              <Td>{e.location || '–'}</Td>
            </tr>
          ))}
        </Table>
      ) : null}
    </Panel>
  );
}

/** The Home tab's widget grid. The verse and the feast tracker come only with the Faith Center and a fraternal tenant. */
export function HomeWidgets({ user, councilId, faithOn }: { user: SessionUser; councilId: number; faithOn: boolean }) {
  const today = toIsoDate(new Date());
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      {faithOn ? <VerseOfTheDay today={today} /> : null}
      <ReminderStream user={user} councilId={councilId} />
      {faithOn ? <FeastDayTracker today={today} /> : null}
      <TodaysAgenda councilId={councilId} today={today} />
    </div>
  );
}

// ---- the Officer Desks --------------------------------------------------------------------------------

/** The Grand Knight Desk: the Voucher Release queue - sheets signed by the Financial Secretary and coded by the Treasurer. */
export function GrandKnightDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  const queue = useLoad(() => db.expenses.listAuthorizationQueue(user.memberId, councilId), [user.memberId, councilId]);
  const rows = queue.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DeskCount label="Vouchers waiting for release" count={queue.data ? rows.length : null} href="/expenses/authorize" cta="Open the Grand Knight Authorization Desk" />
        <DeskCount label="Released vouchers" href="/expenses/disbursements" cta="Open the disbursement vault" />
      </div>
      <Panel title={`Voucher Release queue (${rows.length})`}>
        {queue.error ? <Notice tone="error">{queue.error}</Notice> : null}
        {queue.data ? (
          <SheetQueue
            caption="Sheets waiting for the Grand Knight's final release"
            rows={rows}
            href="/expenses/authorize"
            cta="Release vouchers on the full desk"
            signerColumn={(d) => (
              <>
                FS: {d.financialSecretaryName || '–'}
                <br />
                Treasurer: {d.treasurerName || '–'}
              </>
            )}
          />
        ) : null}
      </Panel>
    </div>
  );
}

/** The Financial Secretary Desk: the written-order queue, the Excel roster import and the inactivity sweep. */
export function FinancialSecretaryDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  const queue = useLoad(() => db.expenses.listCouncilQueue(user.memberId, councilId), [user.memberId, councilId]);
  const rows = (queue.data ?? []).filter((d) => awaitsWrittenOrder(d.report));
  const admin = canAdministerCouncil(user, councilId);
  const [sweeping, setSweeping] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const sweep = async () => {
    setSweeping(true);
    setMessage(null);
    try {
      const changed = await db.members.sweepInactive(user.memberId, councilId);
      setMessage({ tone: 'info', text: changed.length === 0 ? 'No member is past the inactivity window.' : `Marked ${changed.length} member${changed.length === 1 ? '' : 's'} Inactive.` });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setSweeping(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DeskCount label="Sheets waiting for your written order" count={queue.data ? rows.length : null} href="/expenses/audit" cta="Open the Financial Secretary Audit Desk" />
        <DeskCount label="All sheets in leadership's queue" count={queue.data ? queue.data.length : null} href="/expenses/queue" cta="Open the auditing queue" />
      </div>
      <Panel title={`Written-order queue (${rows.length})`}>
        {queue.error ? <Notice tone="error">{queue.error}</Notice> : null}
        {queue.data ? <SheetQueue caption="Sheets waiting for the Financial Secretary's written order" rows={rows} href="/expenses/audit" cta="Verify & sign on the full desk" /> : null}
      </Panel>
      <Panel title="Excel imports and roster sweeps">
        <ul className="flex flex-col gap-3 text-sm">
          <li>
            <span className="font-bold">1. Build the roster.</span>{' '}
            <a className="font-bold underline" href="/templates/roster_import_template.xlsx" download>
              Download the Excel roster template
            </a>
            , fill it in, then save the Roster sheet as CSV.
          </li>
          <li>
            <span className="font-bold">2. Import it.</span> Load the CSV on the{' '}
            <Link href="/supreme-sync" className="font-bold underline">
              Supreme roster sync
            </Link>{' '}
            card. New members get the welcome email and a one-time setup code.
          </li>
          <li>
            <span className="font-bold">3. Sweep for inactive members.</span> Marks Inactive every plain member with no logged service inside the council&apos;s
            inactivity window.
          </li>
        </ul>
        {admin ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={() => void sweep()} disabled={sweeping}>
              {sweeping ? 'Checking…' : 'Check for Inactive Members'}
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">Only the council&apos;s Admins import the roster and run the sweep. Ask an Admin if the roster needs it.</p>
        )}
        {message ? (
          <div className="mt-3">
            <Notice tone={message.tone}>{message.text}</Notice>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

/** The Treasurer Desk: the Ledger Line Coder queue - written orders waiting for a budget line and a ledger account. */
export function TreasurerDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  const queue = useLoad(() => db.expenses.listTreasurerQueue(user.memberId, councilId), [user.memberId, councilId]);
  const rows = queue.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DeskCount label="Sheets waiting for ledger coding" count={queue.data ? rows.length : null} href="/finance/treasurer-desk" cta="Open the Treasurer Ledger Audit Desk" />
        <DeskCount label="General ledger" href="/finance/ledger" cta="Open the general ledger" />
      </div>
      <Panel title={`Ledger Line Coder queue (${rows.length})`}>
        {queue.error ? <Notice tone="error">{queue.error}</Notice> : null}
        {queue.data ? (
          <SheetQueue
            caption="Sheets waiting for the Treasurer's budget line and ledger account"
            rows={rows}
            href="/finance/treasurer-desk"
            cta="Categorize & lock on the full desk"
            signerColumn={(d) => <>FS: {d.financialSecretaryName || '–'}</>}
          />
        ) : null}
        {canLogConcludedRevenue(user, councilId) ? (
          <p className="mt-2 text-sm">
            Event over?{' '}
            <Link href="/finance/treasurer-desk" className="font-bold underline">
              Log its concluded revenue
            </Link>{' '}
            on the full desk.
          </p>
        ) : null}
      </Panel>
    </div>
  );
}

/** The Member Desk: the reader's own expense sheets and their shifts in the coming weeks. */
export function MemberDesk({ user }: { user: SessionUser }) {
  const today = toIsoDate(new Date());
  const through = toIsoDate(new Date(Date.now() + MEMBER_DESK_SHIFT_DAYS * 86_400_000));
  const sheets = useLoad(() => db.expenses.listUserReports(user.memberId), [user.memberId]);
  const shifts = useLoad(() => db.events.listMemberShifts(user.memberId, { fromDate: today, toDate: through }), [user.memberId, today, through]);
  const open = (sheets.data ?? []).filter((d) => d.report.Status !== 'Reimbursed');
  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      <Panel title={`My open expense sheets (${open.length})`}>
        {sheets.error ? <Notice tone="error">{sheets.error}</Notice> : null}
        {sheets.data && open.length === 0 ? <Empty>You have no open expense sheet.</Empty> : null}
        {open.length > 0 ? (
          <Table caption="Your expense sheets not yet paid" head={['Sheet', 'Amount', 'Status']}>
            {open.slice(0, DESK_ROWS).map((d) => (
              <tr key={d.report.id}>
                <Td className="font-bold">#{d.report.id}</Td>
                <Td className="text-right">{formatMoney(d.total)}</Td>
                <Td>
                  <ExpenseStatusPill report={d.report} />
                </Td>
              </tr>
            ))}
          </Table>
        ) : null}
        <p className="mt-2 text-sm">
          <Link href="/expenses" className="font-bold underline">
            Open my expenses
          </Link>
        </p>
      </Panel>
      <Panel title={`My shifts: next ${MEMBER_DESK_SHIFT_DAYS} days (${shifts.data?.length ?? 0})`}>
        {shifts.error ? <Notice tone="error">{shifts.error}</Notice> : null}
        {shifts.data && shifts.data.length === 0 ? <Empty>You are not signed up for a shift in the next {MEMBER_DESK_SHIFT_DAYS} days.</Empty> : null}
        {shifts.data && shifts.data.length > 0 ? (
          <Table caption="Your coming shifts" head={['When', 'Event', 'Shift']}>
            {shifts.data.slice(0, DESK_ROWS).map((s) => (
              <tr key={s.signup.id}>
                <Td className="whitespace-nowrap">{formatShiftWhen(s.shift)}</Td>
                <Td>{s.event.EventName}</Td>
                <Td>{s.shift.ShiftName}</Td>
              </tr>
            ))}
          </Table>
        ) : null}
        <p className="mt-2 text-sm">
          <Link href="/member-center" className="font-bold underline">
            Open the Member Center
          </Link>
        </p>
      </Panel>
    </div>
  );
}
