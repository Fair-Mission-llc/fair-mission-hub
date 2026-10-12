'use client';
// The tabbed dashboard's widgets and Officer Desks (Sprint 7J, officer-desks.ts). Home carries four widgets for every
// dashboard reader - the Bible Verse of the Day, the Live Actionable Reminders Stream, the Liturgical Feast Day Tracker
// and Today's Event Agenda - and each desk is a compact grid of the queues of one physical desk, with a link to the full
// desk page for every signature. The desks never sign anything themselves: the commands stay on their own pages, behind
// their own gates (expenseOrderBlock, expenseLedgerCodeBlock, expenseCounterSignBlock).
//
// Sprint 8A: Home is a no-scroll cockpit. Its widgets are compact fixed-height cards (a long list scrolls inside its card,
// never the page), and every queue that used to sit on Home is now one status badge (DeskStatusBadges) that opens its
// Active Desk. The Volunteer Time Quarantine Desk and the Inbound Council Mail Center move to the Oversight Desk. The
// inactivity sweep left the Financial Secretary Desk for System Settings > Council Wide Settings.
//
// Sprint 8B: two seat desks. The Recorder Desk holds the Meeting Minutes Entry Desk (the business calendar with each
// meeting's minutes countdown, a markdown-style editor that saves drafts and publishes, meetings.saveMeetingMinutes) and
// the Start Live Meeting Sequence launch, which starts the live console and shows the 4-digit PIN bypass
// (meetings.launchLiveMeeting). The Historian Desk holds the Digital Fraternal Annals Scrapbook: monthly text bulletins,
// meeting photos filed under Media / Meeting_Photos (/api/drive-vault/meeting-photos) and the oral-history recordings.
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  addDays,
  awaitsWrittenOrder,
  buildReminderStream,
  bulletinMonthOf,
  canOpenRecorderDesk,
  councilWideSettings,
  describeError,
  driveFileViewUrl,
  HISTORIAN_BULLETIN_MAX_LENGTH,
  isDriveFileId,
  MEETING_PHOTO_DRIVE_FOLDER,
  MINUTES_DESK_AHEAD_DAYS,
  MINUTES_DESK_PAST_DAYS,
  MINUTES_TEXT_MAX_LENGTH,
  minutesCountdownLabel,
  minutesDeskRows,
  canLogConcludedRevenue,
  canOpenExpenseAuditDesk,
  canOpenExpenseAuthorizeDesk,
  canOpenTreasurerDesk,
  canReviewVolunteerQuarantine,
  canViewExecutiveAudits,
  dailyVerse,
  feastDayTracker,
  FEAST_TRACKER_DAYS,
  formatShiftWhen,
  HOLY_DAY_BADGE,
  NABRE_NOTICE,
  todaysAgenda,
  toIsoDate,
  type ExpenseReportDetail,
  type LiveMeetingLaunch as LiveMeetingLaunchResult,
  type Meeting,
  type MinutesCountdown,
  type SessionUser,
} from '@kofc/shared';
import { ExpenseStatusPill, HonorVoucherBadge } from '@/components/ExpenseParts';
import { Markdown } from '@/components/Markdown';
import { OralHistoryRecorder } from '@/components/OralHistoryRecorder';
import { InboundMailCenter, readAccessRequests } from '@/components/PlatformAccessParts';
import { QuarantineDesk } from '@/components/QuarantineDesk';
import { Button, cx, Empty, Field, Input, Notice, Panel, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { DeskLink } from '@/components/WorkspaceTabs';
import { formatFullDate, formatMoney, formatPersonName } from '@/lib/format';
import { photoName, photoSrc } from '@/lib/media';
import { useFeatureFlags, useSession } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import { archiveMeetingPhoto, localFileLink } from '@/services/drive-vault-transport';

/** How far ahead the Member Desk lists the member's own shifts. */
const MEMBER_DESK_SHIFT_DAYS = 30;
/** How many rows a desk grid shows before pointing to the full desk. */
const DESK_ROWS = 6;

/**
 * A Home card (Sprint 8A): a navy-ruled title over a fixed-height body. A long list scrolls inside the card, so Home
 * itself fits one screen.
 */
function HomeCard({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex h-60 min-w-0 flex-col rounded border-2 border-navy bg-white">
      <header className="flex items-center justify-between gap-2 border-b-2 border-navy px-3 py-1.5">
        <h2 className="truncate font-serif text-base font-bold">{title}</h2>
        {actions}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 text-sm">{children}</div>
    </section>
  );
}

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
    <HomeCard title="Bible Verse of the Day">
      <blockquote className="border-l-4 border-gold pl-3">
        <p className="font-serif text-base">“{verse.text}”</p>
        <p className="mt-1 font-bold">{verse.reference} (NABRE)</p>
      </blockquote>
      <p className="mt-2 text-xs text-muted">{NABRE_NOTICE}</p>
    </HomeCard>
  );
}

function FeastDayTracker({ today }: { today: string }) {
  const tracker = feastDayTracker(today);
  return (
    <HomeCard title="Liturgical Feast Day Tracker">
      <div data-surface="navy" className={cx('rounded border-l-8 bg-navy px-3 py-2 text-white', tracker.today.holyDayOfObligation ? 'border-crimson' : 'border-gold')}>
        <p className="font-serif text-base font-bold">{tracker.today.text}</p>
        {tracker.today.holyDayOfObligation ? <p className="mt-1 inline-block rounded bg-crimson px-2 py-0.5 text-sm font-bold">{HOLY_DAY_BADGE}</p> : null}
        {tracker.today.note ? <p className="mt-1 text-sm">{tracker.today.note}</p> : null}
      </div>
      {tracker.upcoming.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No feast or holy day in the next {FEAST_TRACKER_DAYS} days.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1" aria-label={`Feasts in the next ${FEAST_TRACKER_DAYS} days`}>
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
    </HomeCard>
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
    <HomeCard title="Live Actionable Reminders" actions={rows.length > 0 ? <Pill tone="red">{rows.length}</Pill> : null}>
      {stream.error ? <Notice tone="error">{stream.error}</Notice> : null}
      {stream.data && rows.length === 0 ? <Empty>You are all caught up. Nothing needs your action.</Empty> : null}
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-1.5" aria-label="Actionable reminders">
          {rows.map((r) => (
            <li key={r.key} className={cx('rounded border-l-4 bg-white px-2 py-1 ring-1 ring-line', r.priority === 'High' ? 'border-brand-red' : r.priority === 'Medium' ? 'border-gold' : 'border-line')}>
              <p className="font-bold">{r.href ? <Link href={r.href} className="underline">{r.title}</Link> : r.title}</p>
              <p className="text-sm">{r.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-muted">Refreshes every minute. The alert bell keeps the full six-month log.</p>
    </HomeCard>
  );
}

function TodaysAgenda({ councilId, today }: { councilId: number; today: string }) {
  const entries = useLoad(() => db.events.listCalendarRange(councilId, today, today), [councilId, today]);
  const rows = todaysAgenda(entries.data ?? [], today);
  return (
    <HomeCard title="Today's Event Agenda">
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
      <p className="mt-1 text-xs text-muted">{formatFullDate(today)}</p>
    </HomeCard>
  );
}

/** The Home tab's widget grid. The verse and the feast tracker come only with the Faith Center and a fraternal tenant. */
export function HomeWidgets({ user, councilId, faithOn }: { user: SessionUser; councilId: number; faithOn: boolean }) {
  const today = toIsoDate(new Date());
  return (
    <div className={cx('grid grid-cols-1 gap-3 md:grid-cols-2', faithOn ? 'xl:grid-cols-4' : 'xl:grid-cols-2')}>
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

/**
 * The Financial Secretary Desk: the written-order queue and the Excel roster import. Sprint 8A moved the inactivity sweep
 * to System Settings > Council Wide Settings.
 */
export function FinancialSecretaryDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  const queue = useLoad(() => db.expenses.listCouncilQueue(user.memberId, councilId), [user.memberId, councilId]);
  const rows = (queue.data ?? []).filter((d) => awaitsWrittenOrder(d.report));
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
      <Panel title="Excel roster imports">
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
        </ul>
        <p className="mt-3 text-xs text-muted">
          Looking for the inactivity sweep? It is on{' '}
          <Link href="/system-settings/council-settings" className="font-bold underline">
            System Settings: Council Wide Settings
          </Link>
          , for the council&apos;s Admins.
        </p>
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

/**
 * The Oversight Desk (Sprint 8A): the Volunteer Time Quarantine Desk while the council's feature_volunteer_quarantine flag
 * is on, and for a Super Admin the Inbound Council Mail Center. Both left Home for this desk.
 */
export function OversightDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  const flags = useFeatureFlags();
  return (
    <div className="flex flex-col gap-4">
      {user.memberType === 'Super Admin' ? <InboundMailCenter /> : null}
      {flags.feature_volunteer_quarantine ? (
        <QuarantineDesk actorId={user.memberId} councilId={councilId} />
      ) : (
        <Notice tone="info">The Volunteer Time Quarantine is switched off for this council (Feature Flags), so no time entry is held for review.</Notice>
      )}
    </div>
  );
}

// ---- Home status badges ------------------------------------------------------------------------------

interface DeskBadge {
  key: string;
  icon: string;
  /** The wording after the count, for one and for many. */
  one: string;
  many: string;
  count: number;
  anchor: string;
}

const BADGE_ORDER = ['vouchers', 'orders', 'coding', 'minutes', 'quarantine', 'access', 'hours', 'mine'];

/**
 * The Home desk's status badges (Sprint 8A): one compact badge per queue the reader is cleared for - '[ 📋 3 Vouchers
 * Pending ]' - each opening its Active Desk. A badge with work waiting is filled; an empty queue stays an outline.
 */
export function DeskStatusBadges({ user, councilId }: { user: SessionUser; councilId: number }) {
  const flags = useFeatureFlags();
  const badges = useLoad(async () => {
    const out: DeskBadge[] = [];
    const reads: Promise<unknown>[] = [];
    const add = (key: string, icon: string, one: string, many: string, anchor: string, count: () => Promise<number>) =>
      reads.push(count().then((n) => out.push({ key, icon, one, many, anchor, count: n })));
    if (canOpenExpenseAuthorizeDesk(user, councilId))
      add('vouchers', '📋', 'Voucher Pending', 'Vouchers Pending', 'grand-knight', async () => (await db.expenses.listAuthorizationQueue(user.memberId, councilId)).length);
    if (canOpenExpenseAuditDesk(user, councilId))
      add('orders', '✍️', 'Written Order Waiting', 'Written Orders Waiting', 'financial-secretary', async () =>
        (await db.expenses.listCouncilQueue(user.memberId, councilId)).filter((d) => awaitsWrittenOrder(d.report)).length,
      );
    if (canOpenTreasurerDesk(user, councilId))
      add('coding', '🏷️', 'Sheet to Code', 'Sheets to Code', 'treasurer', async () => (await db.expenses.listTreasurerQueue(user.memberId, councilId)).length);
    if (canOpenRecorderDesk(user, councilId))
      add('minutes', '📝', 'Minutes Due', 'Minutes Due', 'recorder', async () => {
        const today = toIsoDate(new Date());
        const [council, meetings] = await Promise.all([db.councils.get(councilId), db.meetings.listUpcoming(councilId, { fromDate: addDays(today, -MINUTES_DESK_PAST_DAYS) })]);
        return minutesDeskRows(meetings, today, councilWideSettings(council).meeting_minutes_due_days).filter((r) => r.state === 'open' || r.state === 'overdue').length;
      });
    if (flags.feature_volunteer_quarantine && canReviewVolunteerQuarantine(user, councilId))
      add('quarantine', '⚠️', 'Item Quarantined', 'Items Quarantined', 'oversight', async () => (await db.volunteerQuarantine.listPending(user.memberId, councilId)).length);
    if (user.memberType === 'Super Admin')
      add('access', '📨', 'Access Request', 'Access Requests', 'oversight', async () => (await readAccessRequests()).filter((r) => r.status === 'PENDING').length);
    if (canViewExecutiveAudits(user, councilId))
      add('hours', '⏳', 'Shift Awaiting Hours', 'Shifts Awaiting Hours', 'reports', async () => (await db.reports.listShiftsAwaitingHours(councilId)).filter((r) => !r.closed).length);
    add('mine', '💼', 'Open Sheet of Mine', 'Open Sheets of Mine', 'member', async () =>
      (await db.expenses.listUserReports(user.memberId)).filter((d) => d.report.Status !== 'Reimbursed').length,
    );
    // A failed read drops only its own badge.
    await Promise.allSettled(reads);
    return out.sort((a, b) => BADGE_ORDER.indexOf(a.key) - BADGE_ORDER.indexOf(b.key));
  }, [user, councilId, flags.feature_volunteer_quarantine]);
  const rows = badges.data ?? [];
  return (
    <nav aria-label="Desk status" className="flex flex-wrap items-center gap-2">
      {!badges.data ? <span className="text-sm text-muted">Counting the desks…</span> : null}
      {rows.map((b) => {
        const text = `${b.count} ${b.count === 1 ? b.one : b.many}`;
        return (
          <DeskLink
            key={b.key}
            anchor={b.anchor}
            label={`${text}: open the desk`}
            className={cx(
              'whitespace-nowrap rounded border-2 px-3 py-1 text-sm font-bold',
              b.count === 0 ? 'border-navy bg-white text-navy' : b.key === 'quarantine' ? 'border-brand-red bg-brand-red text-white' : 'border-navy bg-gold text-navy',
            )}
          >
            [ {b.icon} {text} ]
          </DeskLink>
        );
      })}
    </nav>
  );
}

// ---- the Recorder Desk (Sprint 8B) --------------------------------------------------------------------

const countdownTone = (c: MinutesCountdown) => (c.state === 'overdue' ? 'red' : c.state === 'open' ? 'gold' : c.state === 'published' ? 'navy' : 'outline');

/**
 * The Start Live Meeting Sequence control: starts the live console for the chosen meeting (meetings.launchLiveMeeting)
 * and shows the council's 4-digit PIN in large type, for members outside the check-in circle.
 */
function LiveMeetingLaunch({ user, meeting }: { user: SessionUser; meeting: Meeting }) {
  const [launch, setLaunch] = useState<LiveMeetingLaunchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLaunch(null);
    setError(null);
  }, [meeting.id]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      setLaunch(await db.meetings.launchLiveMeeting(user.memberId, meeting.id));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Live meeting launch" className="flex flex-col gap-2 rounded border-2 border-navy border-t-8 border-t-brand-red bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-bold">{meeting['Meeting Name']}</span> · {formatFullDate(meeting.Date)}
          {meeting.IsLiveInProgress === 1 ? <span className="ml-2 font-bold text-brand-red">● Live now</span> : null}
        </p>
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy}
          className={cx('rounded border-2 border-navy bg-brand-red px-4 py-2 text-base font-black text-white shadow', busy ? 'opacity-60' : 'hover:bg-crimson')}
        >
          {busy ? 'Starting…' : '[ 🚀 Start Live Meeting Sequence ]'}
        </button>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {launch ? (
        <div role="status" data-surface="navy" className="flex flex-wrap items-center justify-between gap-4 rounded bg-navy px-4 py-3 text-white">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-gold">Meeting PIN bypass</p>
            <p className="text-5xl font-black tracking-[0.4em]" aria-label={`Meeting PIN ${launch.pinToken.split('').join(' ')}`}>
              {launch.pinToken}
            </p>
            <p className="text-sm">Read it out for members whose phones cannot check in by location.</p>
            {launch.pinIsDefault ? <p className="mt-1 text-sm font-bold text-gold">This is still the factory PIN 0000. Ask the Grand Knight to change it in Council Wide Settings.</p> : null}
          </div>
          <div className="flex flex-col items-start gap-1 text-sm">
            <p>
              Quorum base locked at <span className="font-bold">{launch.state.meeting.LiveQuorumRosterCount ?? '–'}</span> Active members.
            </p>
            <Link href="/meetings/live" className="font-bold text-gold underline">
              Open the Live Meeting Console →
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** The markdown-style minutes editor for one meeting: write, preview, save a draft or publish. */
function MinutesEditor({ user, meeting, countdown, onSaved }: { user: SessionUser; meeting: Meeting; countdown: MinutesCountdown; onSaved: () => void }) {
  const [text, setText] = useState(meeting.minutes_text ?? '');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  useEffect(() => {
    setText(meeting.minutes_text ?? '');
    setMessage(null);
    setPreview(false);
  }, [meeting.id, meeting.minutes_text]);

  const save = async (publish: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      await db.meetings.saveMeetingMinutes(user.memberId, meeting.id, { text, publish });
      setMessage({ tone: 'info', text: publish ? 'The minutes are published.' : 'Draft saved.' });
      onSaved();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          Held {formatFullDate(countdown.heldOn)} · due {formatFullDate(countdown.dueDate)}{' '}
          <Pill tone={countdownTone(countdown)}>{minutesCountdownLabel(countdown)}</Pill>
        </p>
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
        <div className="max-h-72 min-h-40 overflow-y-auto rounded border-2 border-line px-3 py-2">
          {text.trim() ? <Markdown source={text} idPrefix={`minutes-${meeting.id}`} /> : <p className="text-sm text-muted">Nothing written yet.</p>}
        </div>
      ) : (
        <Field label="Official meeting notes (# headings, - bullets, **bold**)">
          {(id) => (
            <Textarea
              id={id}
              rows={10}
              value={text}
              maxLength={MINUTES_TEXT_MAX_LENGTH}
              onChange={(e) => setText(e.target.value)}
              className="text-sm"
              placeholder={'# Call to order\n- Opened at 7:30 PM by the Grand Knight\n\n# Reports\n- ...'}
            />
          )}
        </Field>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted">
          {text.length.toLocaleString('en-US')} of {MINUTES_TEXT_MAX_LENGTH.toLocaleString('en-US')} characters
          {meeting.minutes_published_at ? ` · published ${meeting.minutes_published_at.slice(0, 10)}` : ''}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => void save(false)}>
            {meeting.minutes_published_at ? 'Withdraw to draft' : 'Save draft'}
          </Button>
          <Button disabled={busy || text.trim() === ''} onClick={() => void save(true)}>
            {meeting.minutes_published_at ? 'Publish changes' : 'Publish minutes'}
          </Button>
        </div>
      </div>
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
    </div>
  );
}

/**
 * The Recorder Desk (Sprint 8B): the council's business calendar with each meeting's minutes countdown (the meeting's last
 * day plus Council.meeting_minutes_due_days), the Meeting Minutes Entry Desk for the chosen meeting, and the Start Live
 * Meeting Sequence launch with the 4-digit PIN bypass. For the Recorder, the council's Admins and Super Admins.
 */
export function RecorderDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  const today = toIsoDate(new Date());
  const from = addDays(today, -MINUTES_DESK_PAST_DAYS);
  const data = useLoad(async () => {
    const [council, meetings] = await Promise.all([db.councils.get(councilId), db.meetings.listUpcoming(councilId, { fromDate: from })]);
    return { dueDays: councilWideSettings(council).meeting_minutes_due_days, meetings };
  }, [councilId, from]);
  const rows = data.data ? minutesDeskRows(data.data.meetings, today, data.data.dueDays) : [];
  const [chosen, setChosen] = useState<number | null>(null);
  const current = rows.find((r) => r.meeting.id === chosen) ?? rows[0] ?? null;
  const waiting = rows.filter((r) => r.state === 'open' || r.state === 'overdue').length;

  return (
    <div className="flex flex-col gap-4">
      {data.error ? <Notice tone="error">{data.error}</Notice> : null}
      {current ? <LiveMeetingLaunch user={user} meeting={current.meeting} /> : null}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <Panel title={`Business calendar (${waiting} awaiting minutes)`}>
          {data.data && rows.length === 0 ? <Empty>No meeting in the last {MINUTES_DESK_PAST_DAYS} days or the next {MINUTES_DESK_AHEAD_DAYS}.</Empty> : null}
          {!data.data && !data.error ? <p className="text-sm text-muted">Reading the calendar…</p> : null}
          <ul aria-label="Meetings and their minutes" className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto">
            {rows.map((r) => (
              <li key={r.meeting.id}>
                <button
                  type="button"
                  onClick={() => setChosen(r.meeting.id)}
                  aria-current={current?.meeting.id === r.meeting.id ? 'true' : undefined}
                  className={cx(
                    'flex w-full items-center justify-between gap-2 rounded border-l-4 px-2 py-1.5 text-left text-sm ring-1 ring-line',
                    r.state === 'overdue' ? 'border-brand-red' : r.state === 'open' ? 'border-gold' : 'border-line',
                    current?.meeting.id === r.meeting.id ? 'bg-gold/20 font-bold' : 'bg-white hover:bg-gold/10',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{r.meeting['Meeting Name']}</span>
                    <span className="text-xs text-muted">{shortDay(r.heldOn)}</span>
                  </span>
                  <Pill tone={countdownTone(r)}>{minutesCountdownLabel(r)}</Pill>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Minutes are due {data.data ? data.data.dueDays : '…'} days after each meeting (Council Wide Settings).
          </p>
        </Panel>
        <Panel title="Meeting Minutes Entry Desk">
          {current ? (
            <MinutesEditor user={user} meeting={current.meeting} countdown={current} onSaved={() => void data.reload()} />
          ) : (
            <Empty>Pick a meeting from the business calendar to write its minutes.</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ---- the Historian Desk (Sprint 8B) -------------------------------------------------------------------

/** The Historian's monthly text bulletins (CouncilHistorianBulletin): one per month, any month re-opened from the list. */
function MonthlyBulletins({ user, councilId }: { user: SessionUser; councilId: number }) {
  const list = useLoad(() => db.history.listHistorianBulletins(user.memberId, councilId), [user.memberId, councilId]);
  const [month, setMonth] = useState(() => bulletinMonthOf(toIsoDate(new Date())));
  const stored = (list.data ?? []).find((b) => b.bulletin_month === month) ?? null;
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  useEffect(() => setBody(stored?.body ?? ''), [month, stored?.body]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await db.history.saveHistorianBulletin(user.memberId, councilId, month, body);
      setMessage({ tone: 'info', text: 'Newsletter saved.' });
      await list.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Monthly newsletters" className="flex flex-col gap-2">
      <h3 className="font-serif text-lg font-bold">📰 Monthly newsletters</h3>
      {list.error ? <Notice tone="error">{list.error}</Notice> : null}
      <Field label="Month" className="w-48">
        {(id) => <Input id={id} type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />}
      </Field>
      <Field label="Newsletter text">
        {(id) => <Textarea id={id} rows={7} maxLength={HISTORIAN_BULLETIN_MAX_LENGTH} value={body} onChange={(e) => setBody(e.target.value)} placeholder="This month at the council…" />}
      </Field>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{stored ? `Last saved ${stored.updated_at.slice(0, 10)}` : 'Not saved yet'}</span>
        <Button disabled={busy} onClick={() => void save()}>
          Save newsletter
        </Button>
      </div>
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      {(list.data ?? []).length > 0 ? (
        <ul aria-label="Saved newsletters" className="flex flex-wrap gap-1">
          {(list.data ?? []).map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setMonth(b.bulletin_month)}
                className={cx('rounded border-2 border-navy px-2 py-0.5 text-xs font-bold', b.bulletin_month === month ? 'bg-gold' : 'bg-white')}
              >
                {b.bulletin_month}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Meeting photos filed in the council's Drive under Media / Meeting_Photos, kept with the meeting (meetings.setMeetingPhoto). */
function MeetingPhotos({ user, councilId }: { user: SessionUser; councilId: number }) {
  const today = toIsoDate(new Date());
  const from = addDays(today, -MINUTES_DESK_PAST_DAYS);
  const meetings = useLoad(() => db.meetings.listUpcoming(councilId, { fromDate: from }), [councilId, from]);
  const held = (meetings.data ?? []).filter((m) => m.Date <= today).sort((a, b) => b.Date.localeCompare(a.Date) || b.id - a.id);
  const [chosen, setChosen] = useState<number | null>(null);
  const meeting = held.find((m) => m.id === chosen) ?? held[0] ?? null;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const src = meeting?.photo_url ? photoSrc(meeting.photo_url) : null;

  const upload = async (file: File | undefined) => {
    if (!file || !meeting) return;
    setBusy(true);
    setMessage(null);
    try {
      const fileId = await archiveMeetingPhoto(file);
      await db.meetings.setMeetingPhoto(user.memberId, meeting.id, fileId ?? localFileLink(file));
      setMessage({
        tone: 'info',
        text: fileId ? `Filed in Google Drive under Media / ${MEETING_PHOTO_DRIVE_FOLDER}.` : 'The Drive vault is off, so the photo is kept in this browser only.',
      });
      await meetings.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Meeting photos" className="flex flex-col gap-2">
      <h3 className="font-serif text-lg font-bold">📷 Parish event and meeting photos</h3>
      {meetings.error ? <Notice tone="error">{meetings.error}</Notice> : null}
      {meetings.data && held.length === 0 ? <Empty>No meeting held in the last {MINUTES_DESK_PAST_DAYS} days.</Empty> : null}
      {meeting ? (
        <>
          <Field label="Meeting">
            {(id) => (
              <Select id={id} value={meeting.id} onChange={(e) => setChosen(Number(e.target.value))}>
                {held.map((m) => (
                  <option key={m.id} value={m.id}>
                    {shortDay(m.Date)} · {m['Meeting Name']}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={`Photo of ${meeting['Meeting Name']}`} className="max-h-40 w-auto self-start rounded border-2 border-navy" />
          ) : meeting.photo_url ? (
            <p className="text-sm">Photo saved on a phone: {photoName(meeting.photo_url)}</p>
          ) : (
            <p className="text-sm text-muted">No photo filed for this meeting yet.</p>
          )}
          <label className={cx('inline-flex cursor-pointer items-center self-start rounded border-2 border-navy px-3 py-1.5 text-sm font-bold', busy && 'opacity-60')}>
            {busy ? 'Uploading…' : meeting.photo_url ? 'Replace photo' : 'Upload photo'}
            <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} />
          </label>
          <p className="text-xs text-muted">Photos go to the council&apos;s Google Drive under Media / {MEETING_PHOTO_DRIVE_FOLDER}.</p>
        </>
      ) : null}
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
    </section>
  );
}

/** The council's Oral History Testimonials (diary entries with a recording), newest first, and the recorder for the Historian's own. */
function OralHistories({ user, councilId }: { user: SessionUser; councilId: number }) {
  const matrix = useLoad(() => db.history.getLegacyMatrix(user.memberId, councilId), [user.memberId, councilId]);
  const m = matrix.data;
  const recordings = (m?.years ?? [])
    .flatMap((y) => y.diary)
    .filter((d) => d.entry.audio_asset_url)
    .sort((a, b) => b.entry.entry_date.localeCompare(a.entry.entry_date) || b.entry.id - a.entry.id);
  const href = (ref: string) => (isDriveFileId(ref) ? driveFileViewUrl(ref) : ref.split('#')[0]);

  return (
    <section aria-label="Oral histories" className="flex flex-col gap-2">
      <h3 className="font-serif text-lg font-bold">🎙️ Oral history recordings</h3>
      {matrix.error ? <Notice tone="error">{matrix.error}</Notice> : null}
      {m && recordings.length === 0 ? <Empty>No member has recorded a testimonial yet.</Empty> : null}
      {recordings.length > 0 ? (
        <ul aria-label="Recorded testimonials" className="flex max-h-48 flex-col divide-y divide-line overflow-y-auto">
          {recordings.map((d) => (
            <li key={d.entry.id} className="flex items-center justify-between gap-2 py-1 text-sm">
              <span>
                <span className="font-bold">{formatPersonName(d.authorFirstName, d.authorLastName)}</span> · {shortDay(d.entry.entry_date)}
              </span>
              <a href={href(d.entry.audio_asset_url ?? '')} target="_blank" rel="noreferrer" className="font-bold underline">
                Listen
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {m && !m.myTestimonial ? (
        <OralHistoryRecorder years={m.years.map((y) => y.fraternalYear)} defaultYear={m.currentFraternalYear} todaysEntry={m.myEntryToday} onSaved={matrix.reload} />
      ) : null}
      <p className="text-xs text-muted">
        Recordings are filed in Google Drive under Oral Histories. Each member records one.{' '}
        <Link href="/history" className="font-bold underline">
          Open Council History
        </Link>
      </p>
    </section>
  );
}

/**
 * The Historian Desk (Sprint 8B): the Digital Fraternal Annals Scrapbook - monthly text bulletins, meeting photos filed
 * under Media / Meeting_Photos and the oral-history recordings. For the Council Historian, the council's Admins and Super
 * Admins.
 */
export function HistorianDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  return (
    <Panel title="Digital Fraternal Annals Scrapbook">
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <MonthlyBulletins user={user} councilId={councilId} />
        <MeetingPhotos user={user} councilId={councilId} />
        <OralHistories user={user} councilId={councilId} />
      </div>
    </Panel>
  );
}
