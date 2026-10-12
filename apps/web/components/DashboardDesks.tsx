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
import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import {
  awaitsWrittenOrder,
  buildReminderStream,
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
  type SessionUser,
} from '@kofc/shared';
import { ExpenseStatusPill, HonorVoucherBadge } from '@/components/ExpenseParts';
import { InboundMailCenter, readAccessRequests } from '@/components/PlatformAccessParts';
import { QuarantineDesk } from '@/components/QuarantineDesk';
import { cx, Empty, Notice, Panel, Pill, Table, Td } from '@/components/ui';
import { DeskLink } from '@/components/WorkspaceTabs';
import { formatFullDate, formatMoney, formatPersonName } from '@/lib/format';
import { useFeatureFlags, useSession } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

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

const BADGE_ORDER = ['vouchers', 'orders', 'coding', 'quarantine', 'access', 'hours', 'mine'];

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
