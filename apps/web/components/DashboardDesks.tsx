'use client';
// The tabbed dashboard's widgets and Officer Desks (Sprint 7J, officer-desks.ts). Home carries four widgets for every
// dashboard reader - the Bible Verse of the Day, the Live Actionable Reminders Stream, the Liturgical Feast Day Tracker
// and Today's Event Agenda - and each desk is a compact grid of the queues of one physical desk, with a link to the full
// desk page for every signature. The desks never sign anything themselves: the commands stay on their own pages, behind
// their own gates (expenseOrderBlock, expenseLedgerCodeBlock, expenseCounterSignBlock).
//
// Sprint 8A: Home was a no-scroll cockpit of compact fixed-height cards (Sprint 8P Stage 1 retired that: the cards are
// larger, grow with their content and the page scrolls in the browser), and every queue that used to sit on Home is now one status badge (DeskStatusBadges) that opens its
// Active Desk. The Volunteer Time Quarantine Desk and the Inbound Council Mail Center move to the Oversight Desk. The
// inactivity sweep left the Financial Secretary Desk for System Settings > Council Wide Settings.
//
// Sprint 8B: two seat desks. The Recorder Desk holds the Meeting Minutes Entry Desk (the business calendar with each
// meeting's minutes countdown, a markdown-style editor that saves drafts and publishes, meetings.saveMeetingMinutes) and
// the Start Live Meeting Sequence launch, which starts the live console and shows the 4-digit PIN bypass
// (meetings.launchLiveMeeting). The Historian Desk holds the Digital Fraternal Annals Scrapbook: monthly text bulletins,
// meeting photos filed under Media / Meeting_Photos (/api/drive-vault/meeting-photos) and the oral-history recordings.
//
// Sprint 8C: every Home badge is a click-through anchor - it switches to its Active Desk and brings the workspace row it
// counts into view (DESK_FOCUS_TARGETS, DeskRow). The Shifts Awaiting Hours audit consolidates onto the Oversight Desk,
// beside the Volunteer Time Quarantine (its own reviewers only) and the Inbound Council Mail Center (global Super Admins
// only). The Member Desk gains the '🚗 Open Shifts Needing Volunteers' card (sign up in one click) and the '📥 My Charity
// Requests' card that follows each request the member shepherds through its tracking steps.
//
// Sprint 8D/8E: Home holds only the universal cards (HOME_UNIVERSAL_CARDS): the verse, the reminders, the feast tracker,
// today's agenda, the Open Volunteer Shifts signup grid (the Member Desk card's compact twin, useOpenShiftSignup) and the
// high-contrast Top 5 Fraternal Volunteers card - the council's Active members with the most hours logged this month
// (reports.councilEngagement monthlyLeaderboard). The desk status badges move to the top of the Oversight Desk.
//
// Sprint 8F: the Grand Knight Desk (shared by the Deputy Grand Knight) gains the Cross-Council Loaner Library's lending
// desk (LoanerLibraryManager): list an asset, pause it, check it out and log its return in one click.
//
// Sprints 8G/8H: the Grand Knight Desk also answers the council's incoming affiliation invites
// (IncomingAffiliationInvites): Accept makes the pair ACTIVE and unlocks loaner library sharing between the councils.
//
// Sprint 8I: the Oversight Desk carries the high-contrast Global Operations Knowledge Vault card for the council's Admins,
// Grand Knight and Deputy Grand Knight (OperationsKnowledgeVault, canWriteOperationsKnowledge): a governance tag, a
// markdown note and an automatic signature stamp. The read-only archive is under System Settings.
// Sprint 8L - Omnipresent Officer Desks: each desk opens with its module folders (DeskModuleShelf, DESK_MODULES): the
// Grand Knight Desk carries the Charitable Grant Requests Vetting Board, the Constitutional Advisor Panels and Connected
// Councils; the Financial Secretary Desk the Semiannual Audit Form 1295 Center and the Charity Check Issuance Console; the
// Treasurer Desk the Annual Budget vs Actuals Ledger Grid and the Bank Statement Match-Window; the Recorder Desk the
// Council Resolutions and Motions Ledger; the Historian Desk the Google Drive Media Gallery Sync Board. Home gains the
// '📿 Community Prayer Request List' card (Faith Center content, like the verse and the feast tracker).
// Sprint 8M Core: the Treasurer Desk carries the Parish Fundraiser Revenue Split Console (ParishSplitConsoleCard), whose
// '[ 📋 Issue Church Disbursement Request ]' sends the parish's share to the Financial Secretary Desk's Church
// Disbursement Requests card (ChurchDisbursementQueue), where the check is recorded.
// Sprint 8N: the Treasurer Desk opens with the Cash Box Audit Closure Panel (its variance metrics above the fold) and the
// High-Volume Batch Transaction Coder, which codes many un-coded electronic donations to one Revenue line at once.
// Sprint 8P Stage 2 - Zero-Traverse Action Drawers: the Grand Knight and Financial Secretary Desks are desk blotters of
// slide-out drawers (DeskDrawers.tsx, desk-drawers.ts). Every module of the two desks - the Sprint 8L folders among them -
// opens as a drawer over the desk, and the signing drawers (Approved Expenses, Payment Requests) carry the Alert
// Boundary Accent while a sheet waits on the reader's own signature. The page bodies of /expenses/authorize,
// /expenses/audit, /expenses/queue, /donations, /elections and /system-settings/knowledge-archive moved to
// components/modules so the drawers mount the same code.
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  addDays,
  awaitsWrittenOrder,
  buildReminderStream,
  bulletinMonthOf,
  canOpenRecorderDesk,
  COMMUNITY_PRAYER_CARD_TITLE,
  councilWideSettings,
  deskModulesFor,
  deskDrawersFor,
  DESK_ALERT_POLL_MS,
  fsPaymentRequestAlert,
  gkSignatureAlert,
  describePrayerCount,
  PRAYING_HANDS_LABEL,
  type DashboardTabId,
  type PrayerIntentionDetail,
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
  LOANER_LIBRARY_HREF,
  canOpenExpenseAuditDesk,
  canOpenExpenseAuthorizeDesk,
  canOpenTreasurerDesk,
  canReviewVolunteerQuarantine,
  canWriteOperationsKnowledge,
  canViewExecutiveAudits,
  dailyVerse,
  DESK_FOCUS_TARGETS,
  LEADERBOARD_SIZE,
  hoursReminderCadence,
  hoursRemindersDue,
  isSuperAdmin,
  MEMBER_DESK_OPEN_SHIFT_DAYS,
  memberDeskOpenShifts,
  signupWindow,
  type DeskBadgeKey,
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
import { BankStatementMatchWindow, BudgetVsActualsModule, DeskModule, DeskModuleShelf, MotionsLedgerModule } from '@/components/DeskModules';
import { DeskBlotter } from '@/components/DeskDrawers';
import { AuthorizationDesk as ApprovedExpenseSigning } from '@/components/modules/ApprovedExpenseSigning';
import { DonationsWorkspace as DonationRecords } from '@/components/modules/DonationRecords';
import { NominationsDesk as ElectionTracker } from '@/components/modules/ElectionTracker';
import { AuditQueue as ExpenseRoutingTrack } from '@/components/modules/ExpenseRoutingTrack';
import { KnowledgeArchive } from '@/components/modules/KnowledgeArchive';
import { AuditDesk as PaymentRequestDesk } from '@/components/modules/PaymentRequestDesk';
import { FraternalPlanningWorkflow } from '@/components/PlanningWorkflowParts';
import { ExpenseStatusPill, HonorVoucherBadge } from '@/components/ExpenseParts';
import { CharityQueue as CharityCheckConsole } from '@/components/modules/CharityCheckConsole';
import { VettingDesk as CharityVettingBoard } from '@/components/modules/CharityVettingBoard';
import { Affiliations as ConnectedCouncils } from '@/components/modules/ConnectedCouncils';
import { AdvisorTerminal as ConstitutionalAdvisor } from '@/components/modules/ConstitutionalAdvisor';
import { PhotoGallery } from '@/components/modules/PhotoGallery';
import { AuditDesk as TrusteeAuditDesk } from '@/components/modules/TrusteeAuditDesk';
import { LoanerLibraryManager } from '@/components/LoanerLibraryParts';
import { IncomingAffiliationInvites } from '@/components/AffiliationsParts';
import { OperationsKnowledgeVault } from '@/components/KnowledgeVaultParts';
import { ChurchDisbursementQueue, ParishSplitConsoleCard } from '@/components/ParishSplitParts';
import { BatchTransactionCoder, CashBoxAuditPanel } from '@/components/CashAuditParts';
import { TrackingSteps } from '@/components/IntakeParts';
import { Markdown } from '@/components/Markdown';
import { OralHistoryRecorder } from '@/components/OralHistoryRecorder';
import { InboundMailCenter, readAccessRequests } from '@/components/PlatformAccessParts';
import { QuarantineDesk } from '@/components/QuarantineDesk';
import { Button, cx, Empty, Field, Input, Notice, Panel, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { DeskLink, DeskRow } from '@/components/WorkspaceTabs';
import { formatDecimalHours, formatFullDate, formatMoney, formatPersonName, formatPhone } from '@/lib/format';
import { photoName, photoSrc } from '@/lib/media';
import { useFeatureFlags, useSession, useTenantType } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import { archiveMeetingPhoto, localFileLink } from '@/services/drive-vault-transport';

/** How far ahead the Member Desk lists the member's own shifts. */
const MEMBER_DESK_SHIFT_DAYS = 30;
/** How many rows a desk grid shows before pointing to the full desk. */
const DESK_ROWS = 6;

/**
 * A Home card (Sprint 8A): a navy-ruled title over its body. Sprint 8P Stage 1: the fixed height and the inner scroll are
 * gone - the card is at least 20rem tall (min-h-80) and grows with its content, and the page scrolls in the browser.
 * The navy tone (Sprint 8D/8E) is the high-contrast honor card: white on navy, gold-edged.
 */
function HomeCard({ title, actions, tone = 'white', children }: { title: string; actions?: ReactNode; tone?: 'white' | 'navy'; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      data-surface={tone === 'navy' ? 'navy' : undefined}
      className={cx('flex min-h-80 min-w-0 flex-col rounded', tone === 'navy' ? 'border-4 border-gold bg-navy text-white' : 'border-2 border-navy bg-white')}
    >
      <header className={cx('flex items-center justify-between gap-2 border-b-2 px-4 py-2.5', tone === 'navy' ? 'border-gold' : 'border-navy')}>
        <h2 className="truncate font-serif text-lg font-bold">{title}</h2>
        {actions}
      </header>
      <div className="flex-1 px-4 py-3 text-base">{children}</div>
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

/**
 * The Open Volunteer Shifts card on Home (Sprint 8D/8E): the Member Desk's short-handed shifts in a compact grid, each
 * signed up for in one click.
 */
function OpenShiftsHomeCard({ user }: { user: SessionUser }) {
  const { rows, ready, error, busy, message, clearMessage, signUp } = useOpenShiftSignup(user);
  return (
    <HomeCard
      title="Open Volunteer Shifts"
      actions={
        <Link href="/member-actions" className="text-xs font-bold underline">
          All shifts
        </Link>
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? (
        <Notice tone={message.tone} onDismiss={clearMessage}>
          {message.text}
        </Notice>
      ) : null}
      {ready && rows.length === 0 ? <Empty>Every shift in the next {MEMBER_DESK_OPEN_SHIFT_DAYS} days has its volunteers.</Empty> : null}
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-1.5" aria-label={`Shifts in the next ${MEMBER_DESK_OPEN_SHIFT_DAYS} days still short of volunteers`}>
          {rows.map(({ shift, event }) => (
            <li key={shift.id} className="flex items-center justify-between gap-2 border-b border-line pb-1">
              <span className="min-w-0">
                <span className="block truncate font-bold">{event.EventName}</span>
                <span className="block truncate text-xs">
                  {formatShiftWhen(shift)} · {shift.ShiftName} ·{' '}
                  <span className="font-bold text-brand-red">short {Math.max(0, shift.MinNumberVolunteers - shift.NumberVolunteersSignedUp)}</span>
                </span>
              </span>
              <Button size="sm" disabled={busy !== null} onClick={() => void signUp(shift.id, `${shift.ShiftName} (${event.EventName})`)}>
                {busy === shift.id ? 'Signing up…' : 'Sign up'}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </HomeCard>
  );
}

const HONOR_MEDALS = ['🥇', '🥈', '🥉'];

/**
 * The Top 5 Fraternal Volunteers card on Home (Sprint 8D/8E): the council's Active members with the most hours logged at
 * its events and activities this month (reports.councilEngagement monthlyLeaderboard), white on navy.
 */
function TopVolunteersCard({ user, councilId }: { user: SessionUser; councilId: number }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const engagement = useLoad(() => db.reports.councilEngagement(user.memberId, councilId, year, month), [user.memberId, councilId, year, month]);
  const rows = engagement.data?.monthlyLeaderboard ?? [];
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return (
    <HomeCard tone="navy" title={`Top ${LEADERBOARD_SIZE} Fraternal Volunteers`} actions={<span className="text-xs font-bold text-gold">{monthLabel}</span>}>
      {engagement.error ? <Notice tone="error">{engagement.error}</Notice> : null}
      {engagement.data && rows.length === 0 ? <p className="text-sm">No member has logged hours this month yet. Be the first!</p> : null}
      {rows.length > 0 ? (
        <ol className="flex flex-col gap-1" aria-label={`Top ${LEADERBOARD_SIZE} volunteers of ${monthLabel}`}>
          {rows.map((l) => (
            <li key={l.memberId} className="flex items-center gap-2 border-b border-white/20 pb-1">
              <span className="w-8 text-center text-lg font-bold" aria-label={`Rank ${l.rank}`}>
                {HONOR_MEDALS[l.rank - 1] ?? `#${l.rank}`}
              </span>
              <span className="flex-1 truncate font-bold">{formatPersonName(l.firstName, l.lastName)}</span>
              <span className="rounded bg-gold px-2 py-0.5 text-sm font-bold text-navy">{formatDecimalHours(l.hours)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <p className="mt-1 text-xs">Hours logged at the council&apos;s events and activities this month.</p>
    </HomeCard>
  );
}

/**
 * The Home tab's card grid (Sprint 8D/8E: the universal cards, HOME_UNIVERSAL_CARDS, and nothing else). Sprint 8P Stage
 * 1: wide tiles - two across, three across on very wide screens with the faith cards - that grow with their content. The verse and the feast tracker come only with the Faith Center and a fraternal tenant.
 */
/** One intention on the Home prayer card: its text, who asked, and the one-tap Praying Hands counter. */
function PrayerRequestRow({ user, item }: { user: SessionUser; item: PrayerIntentionDetail }) {
  const [count, setCount] = useState(item.prayerCount);
  const [prayed, setPrayed] = useState(item.prayedByMeToday);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pray = async () => {
    setBusy(true);
    setError(null);
    try {
      const tally = await db.prayers.pray(user.memberId, item.intention.id);
      setCount(tally.prayerCount);
      setPrayed(tally.prayedByMeToday);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="border-t border-line py-1.5 first:border-t-0 first:pt-0">
      <p>{item.intention.intention_text}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted">
          {formatPersonName(item.authorFirstName, item.authorLastName)} · {describePrayerCount(count)}
        </span>
        <Button size="sm" variant={prayed ? 'secondary' : 'gold'} disabled={busy || prayed} aria-pressed={prayed} onClick={() => void pray()}>
          {PRAYING_HANDS_LABEL}
        </Button>
      </div>
      {error ? <p className="text-xs text-brand-red">{error}</p> : null}
    </li>
  );
}

/** The '📿 Community Prayer Request List' card on Home (Sprint 8L): the council's open prayer intentions (prayers.getBoard). */
function CommunityPrayerCard({ user, councilId }: { user: SessionUser; councilId: number }) {
  const board = useLoad(() => db.prayers.getBoard(user.memberId, councilId), [user.memberId, councilId]);
  const rows = board.data?.intentions ?? [];
  return (
    <HomeCard
      title={COMMUNITY_PRAYER_CARD_TITLE}
      actions={
        <Link href="/faith-center" className="text-xs font-bold underline">
          Add an intention
        </Link>
      }
    >
      {board.error ? <Notice tone="error">{board.error}</Notice> : null}
      {board.data && rows.length === 0 ? <Empty>No open prayer intentions. Add one from the Faith Center.</Empty> : null}
      <ul aria-label="Open prayer intentions">
        {rows.map((item) => (
          <PrayerRequestRow key={item.intention.id} user={user} item={item} />
        ))}
      </ul>
    </HomeCard>
  );
}

export function HomeWidgets({ user, councilId, faithOn }: { user: SessionUser; councilId: number; faithOn: boolean }) {
  const today = toIsoDate(new Date());
  return (
    <div className={cx('grid grid-cols-1 gap-6 lg:grid-cols-2', faithOn ? '2xl:grid-cols-3' : '2xl:grid-cols-2')}>
      {faithOn ? <VerseOfTheDay today={today} /> : null}
      <ReminderStream user={user} councilId={councilId} />
      {faithOn ? <FeastDayTracker today={today} /> : null}
      <TodaysAgenda councilId={councilId} today={today} />
      <OpenShiftsHomeCard user={user} />
      <TopVolunteersCard user={user} councilId={councilId} />
      {faithOn ? <CommunityPrayerCard user={user} councilId={councilId} /> : null}
    </div>
  );
}

// ---- the Officer Desks --------------------------------------------------------------------------------

/** The module folders of one desk (Sprint 8L), each rendering its module from `render`. */
function DeskModulesFor({ user, desk, render }: { user: SessionUser; desk: DashboardTabId; render: (rowId: string) => ReactNode }) {
  return (
    <DeskModuleShelf>
      {deskModulesFor(desk).map((spec) => (
        <DeskModule key={spec.rowId} user={user} spec={spec}>
          {render(spec.rowId)}
        </DeskModule>
      ))}
    </DeskModuleShelf>
  );
}

/** Re-reads a desk's signature queue every DESK_ALERT_POLL_MS, so the Alert Boundary Accent lights while the desk is open. */
function usePolling(reload: () => Promise<unknown>) {
  useEffect(() => {
    const timer = window.setInterval(() => void reload(), DESK_ALERT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [reload]);
}

/** The Planning & Budgeting Workflow drawer: the council's planning banner and goals (FraternalPlanningWorkflow). */
function PlanningBudgetingDrawer({ user, councilId }: { user: SessionUser; councilId: number }) {
  const council = useLoad(() => db.councils.get(councilId), [councilId]);
  return (
    <>
      {council.error ? <Notice tone="error">{council.error}</Notice> : null}
      {council.data ? <FraternalPlanningWorkflow key={council.data.id} user={user} council={council.data} /> : council.loading ? <p className="text-sm">Loading…</p> : null}
      <p className="text-sm">
        The final budget vote stays on the{' '}
        <Link href="/budget" className="font-bold underline">
          Annual Budget Planner
        </Link>
        .
      </p>
    </>
  );
}

/** The Shared Loaner Library drawer: the lending desk (LoanerLibraryManager) and the way to the brother councils' items. */
function LoanerLibraryDrawer({ user, councilId }: { user: SessionUser; councilId: number }) {
  return (
    <>
      <LoanerLibraryManager user={user} councilId={councilId} />
      <p className="text-xs">
        <Link href={LOANER_LIBRARY_HREF} className="font-bold underline">
          Open the shared inventory directory
        </Link>{' '}
        to see what brother councils lend.
      </p>
    </>
  );
}

/** The Excel Roster Imports drawer on the Financial Secretary Desk. */
function RosterImportsDrawer() {
  return (
    <>
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
      <p className="text-xs text-muted">
        Looking for the inactivity sweep? It is on{' '}
        <Link href="/system-settings/council-settings" className="font-bold underline">
          System Settings: Council Wide Settings
        </Link>
        , for the council&apos;s Admins.
      </p>
    </>
  );
}

/**
 * The Grand Knight Desk (shared by the Deputy Grand Knight). Sprint 8P Stage 2: a desk blotter of slide-out drawers
 * (desk-drawers.ts DESK_DRAWERS) - Approved Expenses (counter-sign and release in place, with the Alert Boundary Accent
 * while a sheet waits on the reader's signature), the Charitable Grant Requests Vetting Board, the Planning & Budgeting
 * Workflow, the Council Election Tracker, the Shared Loaner Library, Affiliation Invites, Connected Councils, the
 * Constitutional Advisor Panels and the Operations Knowledge Archive.
 */
export function GrandKnightDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  const flags = useFeatureFlags();
  const tenantType = useTenantType();
  const queue = useLoad(() => db.expenses.listAuthorizationQueue(user.memberId, councilId), [user.memberId, councilId]);
  usePolling(queue.reload);
  const rows = queue.data ?? [];
  const alert = gkSignatureAlert(user, rows);
  return (
    <div className="flex flex-col gap-4">
      {queue.error ? <Notice tone="error">{queue.error}</Notice> : null}
      <DeskBlotter
        desk="grand-knight"
        drawers={deskDrawersFor(user, 'grand-knight', councilId, flags, tenantType)}
        status={(spec) => (spec.id === 'approved-expenses' ? { count: queue.data ? rows.length : null, alert } : undefined)}
        onClosed={() => void queue.reload()}
        render={(spec) => {
          switch (spec.id) {
            case 'approved-expenses':
              return <ApprovedExpenseSigning />;
            case 'vetting-board':
              return <CharityVettingBoard />;
            case 'planning-budgeting':
              return <PlanningBudgetingDrawer user={user} councilId={councilId} />;
            case 'election-tracker':
              return <ElectionTracker />;
            case 'loaner-library':
              return <LoanerLibraryDrawer user={user} councilId={councilId} />;
            case 'affiliation-invites':
              return <IncomingAffiliationInvites user={user} councilId={councilId} />;
            case 'connected-councils':
              return <ConnectedCouncils />;
            case 'advisor':
              return <ConstitutionalAdvisor />;
            default:
              return <KnowledgeArchive />;
          }
        }}
      />
    </div>
  );
}

/**
 * The Financial Secretary Desk. Sprint 8P Stage 2: a desk blotter of slide-out drawers - Payment Requests (verify and
 * sign in place, with the Alert Boundary Accent while a sheet waits on the reader's signature), the Expense Report (ER)
 * Routing Track, Charitable Donation Records, Church Disbursement Requests, the Charity Check Issuance Console, the
 * Semiannual Audit Form 1295 Center, Excel Roster Imports and the Operations Knowledge Archive. Sprint 8A moved the
 * inactivity sweep to System Settings > Council Wide Settings.
 */
export function FinancialSecretaryDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  const flags = useFeatureFlags();
  const tenantType = useTenantType();
  const queue = useLoad(() => db.expenses.listCouncilQueue(user.memberId, councilId), [user.memberId, councilId]);
  usePolling(queue.reload);
  const all = queue.data ?? [];
  const waiting = all.filter((d) => awaitsWrittenOrder(d.report));
  const alert = fsPaymentRequestAlert(user, all);
  return (
    <div className="flex flex-col gap-4">
      {queue.error ? <Notice tone="error">{queue.error}</Notice> : null}
      <DeskBlotter
        desk="financial-secretary"
        drawers={deskDrawersFor(user, 'financial-secretary', councilId, flags, tenantType)}
        status={(spec) =>
          spec.id === 'payment-requests'
            ? { count: queue.data ? waiting.length : null, alert }
            : spec.id === 'er-routing-track'
              ? { count: queue.data ? all.length : null }
              : undefined
        }
        onClosed={() => void queue.reload()}
        render={(spec) => {
          switch (spec.id) {
            case 'payment-requests':
              return <PaymentRequestDesk />;
            case 'er-routing-track':
              return <ExpenseRoutingTrack />;
            case 'donation-records':
              return <DonationRecords />;
            case 'church-disbursements':
              return <ChurchDisbursementQueue user={user} councilId={councilId} />;
            case 'charity-checks':
              return <CharityCheckConsole />;
            case 'form-1295':
              return <TrusteeAuditDesk />;
            case 'roster-imports':
              return <RosterImportsDrawer />;
            default:
              return <KnowledgeArchive />;
          }
        }}
      />
    </div>
  );
}

/** The Treasurer Desk: the Ledger Line Coder queue - written orders waiting for a budget line and a ledger account. */
export function TreasurerDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  const queue = useLoad(() => db.expenses.listTreasurerQueue(user.memberId, councilId), [user.memberId, councilId]);
  const rows = queue.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <DeskRow id="treasurer-cash-box-audit" label="Cash Box Audit Closure Panel">
        <CashBoxAuditPanel user={user} councilId={councilId} />
      </DeskRow>
      <DeskRow id="treasurer-batch-coder" label="High-Volume Batch Transaction Coder">
        <BatchTransactionCoder user={user} councilId={councilId} />
      </DeskRow>
      <DeskModulesFor
        user={user}
        desk="treasurer"
        render={(rowId) =>
          rowId === 'module-budget-vs-actuals' ? <BudgetVsActualsModule user={user} councilId={councilId} /> : <BankStatementMatchWindow user={user} councilId={councilId} />
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DeskCount label="Sheets waiting for ledger coding" count={queue.data ? rows.length : null} href="/finance/treasurer-desk" cta="Open the Treasurer Ledger Audit Desk" />
        <DeskCount label="General ledger" href="/finance/ledger" cta="Open the general ledger" />
      </div>
      <DeskRow id={DESK_FOCUS_TARGETS.coding.rowId} label="Ledger Line Coder queue">
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
      </DeskRow>
      <DeskRow id="treasurer-parish-split" label="Parish Fundraiser Revenue Split Console">
        <ParishSplitConsoleCard user={user} councilId={councilId} />
      </DeskRow>
    </div>
  );
}

/**
 * The short-handed shifts of the member's council over the next 30 days and the one-click sign-up, shared by the Member
 * Desk card (Sprint 8C) and Home's Open Volunteer Shifts card (Sprint 8D/8E).
 */
function useOpenShiftSignup(user: SessionUser) {
  const window30 = signupWindow(new Date());
  const feed = useLoad(
    () => db.events.listShiftFeed({ memberId: user.memberId, councilIds: [user.councilId], ...window30 }),
    [user.memberId, user.councilId, window30.fromDate],
  );
  const rows = memberDeskOpenShifts(feed.data ?? [], window30.fromDate);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const signUp = async (shiftId: number, label: string) => {
    setBusy(shiftId);
    setMessage(null);
    try {
      await db.events.signupForShift(user.memberId, shiftId);
      setMessage({ tone: 'info', text: `You are signed up for ${label}.` });
      await feed.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };

  return { rows, ready: Boolean(feed.data), error: feed.error, busy, message, clearMessage: () => setMessage(null), signUp };
}

/** The Member Desk's '🚗 Open Shifts Needing Volunteers' card (Sprint 8C): the council's short-handed shifts, signed up for in one click. */
function OpenShiftsCard({ user }: { user: SessionUser }) {
  const { rows, ready, error, busy, message, clearMessage, signUp } = useOpenShiftSignup(user);
  return (
    <Panel title={`[ 🚗 Open Shifts Needing Volunteers ] (${rows.length})`}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {ready && rows.length === 0 ? <Empty>Every shift in the next {MEMBER_DESK_OPEN_SHIFT_DAYS} days has its volunteers.</Empty> : null}
      {rows.length > 0 ? (
        <Table caption={`Shifts in the next ${MEMBER_DESK_OPEN_SHIFT_DAYS} days still short of volunteers`} head={['When', 'Event', 'Shift', 'Short by', '']}>
          {rows.slice(0, DESK_ROWS).map(({ shift, event }) => (
            <tr key={shift.id}>
              <Td className="whitespace-nowrap">{formatShiftWhen(shift)}</Td>
              <Td>{event.EventName}</Td>
              <Td>{shift.ShiftName}</Td>
              <Td className="font-bold text-brand-red">{Math.max(0, shift.MinNumberVolunteers - shift.NumberVolunteersSignedUp)}</Td>
              <Td>
                <Button size="sm" disabled={busy !== null} onClick={() => void signUp(shift.id, `${shift.ShiftName} (${event.EventName})`)}>
                  {busy === shift.id ? 'Signing up…' : 'Sign up'}
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      ) : null}
      {message ? (
        <Notice tone={message.tone} onDismiss={clearMessage}>
          {message.text}
        </Notice>
      ) : null}
      <p className="mt-2 text-sm">
        {rows.length > DESK_ROWS ? `${rows.length - DESK_ROWS} more short-handed. ` : ''}
        <Link href="/member-actions" className="font-bold underline">
          Open the Member Actions Hub
        </Link>
      </p>
    </Panel>
  );
}

/** The Member Desk's '📥 My Charity Requests' card (Sprint 8C): each request the member shepherds, along its tracking steps. */
function MyCharityRequestsCard({ user }: { user: SessionUser }) {
  const mine = useLoad(() => db.charities.listMyCharitableRequests(user.memberId), [user.memberId]);
  const rows = mine.data ?? [];
  return (
    <Panel title={`[ 📥 My Charity Requests ] (${rows.length})`}>
      {mine.error ? <Notice tone="error">{mine.error}</Notice> : null}
      {mine.data && rows.length === 0 ? <Empty>You have not carried a charity request to the council.</Empty> : null}
      {rows.length > 0 ? (
        <ul aria-label="My charity requests" className="flex flex-col divide-y divide-line">
          {rows.slice(0, DESK_ROWS).map(({ request }) => (
            <li key={request.id} className="flex flex-col gap-1 py-2">
              <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="font-bold">#{request.id}</span> {request.OrganizationName}
                </span>
                <span className="font-bold">{formatMoney(request.AmountRequested)}</span>
              </p>
              <TrackingSteps request={request} />
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-sm">
        <Link href="/charities/propose" className="font-bold underline">
          Propose or follow a charity grant
        </Link>
      </p>
    </Panel>
  );
}

/**
 * The Member Desk: the reader's own expense sheets and their shifts in the coming weeks. Sprint 8C adds the open shifts
 * needing volunteers and, while the council's charity proposals are on, the member's own charity requests.
 */
export function MemberDesk({ user }: { user: SessionUser }) {
  const flags = useFeatureFlags();
  const today = toIsoDate(new Date());
  const through = toIsoDate(new Date(Date.now() + MEMBER_DESK_SHIFT_DAYS * 86_400_000));
  const sheets = useLoad(() => db.expenses.listUserReports(user.memberId), [user.memberId]);
  const shifts = useLoad(() => db.events.listMemberShifts(user.memberId, { fromDate: today, toDate: through }), [user.memberId, today, through]);
  const open = (sheets.data ?? []).filter((d) => d.report.Status !== 'Reimbursed');
  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      <OpenShiftsCard user={user} />
      {flags.flag_charity_proposals ? <MyCharityRequestsCard user={user} /> : null}
      <DeskRow id={DESK_FOCUS_TARGETS.mine.rowId} label="My open expense sheets">
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
      </DeskRow>
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
            Open the Council Dashboard
          </Link>
        </p>
      </Panel>
    </div>
  );
}

/**
 * Past signups still waiting for hours (reports.listShiftsAwaitingHours), flagged once the council's first reminder is
 * due. On the Reports Desk until Sprint 8C, which consolidated it onto the Oversight Desk.
 */
function AwaitingHours({ councilId }: { councilId: number }) {
  const awaiting = useLoad(() => db.reports.listShiftsAwaitingHours(councilId), [councilId]);
  // Sprint 7E: the council's own reminder delay, cadence and logging window.
  const council = useLoad(() => db.councils.get(councilId), [councilId]).data;
  const cadence = hoursReminderCadence(council);
  const windowDays = councilWideSettings(council).volunteer_logging_window_days;
  const rows = awaiting.data ?? [];
  const overdue = rows.filter((r) => !r.closed && r.daysSinceShift >= cadence.delayDays).length;
  return (
    <Panel title={`Shifts awaiting hours (${rows.length})`} actions={overdue > 0 ? <Pill tone="red">{overdue} past {cadence.delayDays} days</Pill> : null}>
      {awaiting.error ? <Notice tone="error">{awaiting.error}</Notice> : null}
      {awaiting.data && rows.length === 0 ? <Empty>Every volunteer on a past shift has logged their hours.</Empty> : null}
      {rows.length > 0 ? (
        <div>
          <Table caption="Past shifts whose volunteers have not logged hours" head={['Member', 'Phone', 'Shift', 'Event', 'Days since', 'Reminders']}>
            {rows.map((r) => {
              const late = !r.closed && r.daysSinceShift >= cadence.delayDays;
              const due = hoursRemindersDue(r, cadence);
              return (
                <tr key={r.signup.id} className={cx(late && 'border-l-8 border-brand-red')}>
                  <Td className="font-bold">{formatPersonName(r.firstName, r.lastName)}</Td>
                  <Td className="whitespace-nowrap">{formatPhone(r.phone)}</Td>
                  <Td className="whitespace-nowrap">
                    {formatShiftWhen(r.shift)}
                    <span className="block text-xs text-muted">{r.shift.ShiftName}</span>
                  </Td>
                  <Td>{r.event.EventName}</Td>
                  <Td className={cx('font-bold', late && 'text-brand-red')}>{r.daysSinceShift}</Td>
                  <Td>
                    {r.closed ? (
                      <Pill tone="outline">Closed: past {windowDays} days</Pill>
                    ) : late ? (
                      <>
                        <Pill tone="red">⚠ Overdue</Pill>
                        <span className="block text-xs text-brand-red">
                          {due} text reminder{due === 1 ? '' : 's'} due so far · log by {formatFullDate(r.loggableThrough)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted">First reminder on day {cadence.delayDays}</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        Members who checked in but have not reported time. A text reminder goes out on day {cadence.delayDays} and every {cadence.cadenceDays} days
        after that, until the {windowDays}-day logging window closes. Council Wide Settings sets these numbers.
      </p>
    </Panel>
  );
}

/**
 * The Oversight Desk (Sprint 8A): the Volunteer Time Quarantine Desk for its reviewers (canReviewVolunteerQuarantine) while
 * the council's feature_volunteer_quarantine flag is on, and the Inbound Council Mail Center for global Super Admins only.
 * Sprint 8C: the Shifts Awaiting Hours audit consolidates here for every executive-audit reader (canViewExecutiveAudits).
 * Sprint 8D/8E: the desk status badges, moved off Home, lead the desk.
 * Sprint 8I: the Global Operations Knowledge Vault card for the council's Admins, Grand Knight and Deputy Grand Knight.
 */
export function OversightDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  const flags = useFeatureFlags();
  const reviewer = canReviewVolunteerQuarantine(user, councilId);
  return (
    <div className="flex flex-col gap-4">
      <DeskStatusBadges user={user} councilId={councilId} />
      {/* Sprint 8C: the council mail center is locked to global Super Admins - never a council's own Admins or officers. */}
      {isSuperAdmin(user) ? (
        <DeskRow id={DESK_FOCUS_TARGETS.access.rowId} label="Inbound Council Mail Center">
          <InboundMailCenter />
        </DeskRow>
      ) : null}
      {reviewer ? (
        <DeskRow id={DESK_FOCUS_TARGETS.quarantine.rowId} label="Flagged Hours Review Desk">
          {flags.feature_volunteer_quarantine ? (
            <QuarantineDesk actorId={user.memberId} councilId={councilId} />
          ) : (
            <Notice tone="info">The Flagged Hours Review is switched off for this council (Feature Flags), so no time entry is held for review.</Notice>
          )}
        </DeskRow>
      ) : null}
      {canViewExecutiveAudits(user, councilId) ? (
        <DeskRow id={DESK_FOCUS_TARGETS.hours.rowId} label="Shifts awaiting hours">
          <AwaitingHours councilId={councilId} />
        </DeskRow>
      ) : null}
      {canWriteOperationsKnowledge(user, councilId) ? (
        <DeskRow id="desk-row-knowledge-vault" label="Global Operations Knowledge Vault">
          <OperationsKnowledgeVault user={user} councilId={councilId} />
        </DeskRow>
      ) : null}
    </div>
  );
}

// ---- desk status badges ------------------------------------------------------------------------------

interface DeskBadge {
  key: DeskBadgeKey;
  icon: string;
  /** The wording after the count, for one and for many. */
  one: string;
  many: string;
  count: number;
}

const BADGE_ORDER: DeskBadgeKey[] = ['vouchers', 'orders', 'coding', 'minutes', 'quarantine', 'access', 'hours', 'mine'];

/**
 * The desk status badges (Sprint 8A on Home; Sprint 8D/8E at the top of the Oversight Desk): one compact badge per queue the reader is cleared for - '[ 📋 3 Vouchers
 * Pending ]' - each opening its Active Desk. A badge with work waiting is filled; an empty queue stays an outline.
 * Sprint 8C: each badge is a click-through anchor to the workspace row it counts (DESK_FOCUS_TARGETS); the hours badge opens
 * the Oversight Desk, and the access-request badge is a global Super Admin's only.
 */
export function DeskStatusBadges({ user, councilId }: { user: SessionUser; councilId: number }) {
  const flags = useFeatureFlags();
  const badges = useLoad(async () => {
    const out: DeskBadge[] = [];
    const reads: Promise<unknown>[] = [];
    const add = (key: DeskBadgeKey, icon: string, one: string, many: string, count: () => Promise<number>) =>
      reads.push(count().then((n) => out.push({ key, icon, one, many, count: n })));
    if (canOpenExpenseAuthorizeDesk(user, councilId))
      add('vouchers', '📋', 'Approved Expense Awaiting Payment', 'Approved Expenses Awaiting Payment', async () => (await db.expenses.listAuthorizationQueue(user.memberId, councilId)).length);
    if (canOpenExpenseAuditDesk(user, councilId))
      add('orders', '✍️', 'Payment Request Waiting', 'Payment Requests Waiting', async () =>
        (await db.expenses.listCouncilQueue(user.memberId, councilId)).filter((d) => awaitsWrittenOrder(d.report)).length,
      );
    if (canOpenTreasurerDesk(user, councilId))
      add('coding', '🏷️', 'Sheet to Code', 'Sheets to Code', async () => (await db.expenses.listTreasurerQueue(user.memberId, councilId)).length);
    if (canOpenRecorderDesk(user, councilId))
      add('minutes', '📝', 'Minutes Due', 'Minutes Due', async () => {
        const today = toIsoDate(new Date());
        const [council, meetings] = await Promise.all([db.councils.get(councilId), db.meetings.listUpcoming(councilId, { fromDate: addDays(today, -MINUTES_DESK_PAST_DAYS) })]);
        return minutesDeskRows(meetings, today, councilWideSettings(council).meeting_minutes_due_days).filter((r) => r.state === 'open' || r.state === 'overdue').length;
      });
    if (flags.feature_volunteer_quarantine && canReviewVolunteerQuarantine(user, councilId))
      add('quarantine', '⚠️', 'Flagged Hours Entry', 'Flagged Hours Entries', async () => (await db.volunteerQuarantine.listPending(user.memberId, councilId)).length);
    if (isSuperAdmin(user))
      add('access', '📨', 'Access Request', 'Access Requests', async () => (await readAccessRequests()).filter((r) => r.status === 'PENDING').length);
    if (canViewExecutiveAudits(user, councilId))
      add('hours', '⏳', 'Shift Awaiting Hours', 'Shifts Awaiting Hours', async () => (await db.reports.listShiftsAwaitingHours(councilId)).filter((r) => !r.closed).length);
    add('mine', '💼', 'Open Sheet of Mine', 'Open Sheets of Mine', async () =>
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
            anchor={DESK_FOCUS_TARGETS[b.key].anchor}
            rowId={DESK_FOCUS_TARGETS[b.key].rowId}
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
      <DeskModulesFor user={user} desk="recorder" render={() => <MotionsLedgerModule councilId={councilId} />} />
      {data.error ? <Notice tone="error">{data.error}</Notice> : null}
      {current ? <LiveMeetingLaunch user={user} meeting={current.meeting} /> : null}
      <DeskRow id={DESK_FOCUS_TARGETS.minutes.rowId} label="Business calendar and minutes">
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
          <Panel title={`Business calendar (${waiting} awaiting minutes)`}>
            {data.data && rows.length === 0 ? <Empty>No meeting in the last {MINUTES_DESK_PAST_DAYS} days or the next {MINUTES_DESK_AHEAD_DAYS}.</Empty> : null}
            {!data.data && !data.error ? <p className="text-sm text-muted">Reading the calendar…</p> : null}
            <ul aria-label="Meetings and their minutes" className="flex flex-col gap-1">
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
      </DeskRow>
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
        <ul aria-label="Recorded testimonials" className="flex flex-col divide-y divide-line">
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
    <div className="flex flex-col gap-4">
      <DeskModulesFor user={user} desk="historian" render={() => <PhotoGallery />} />
      <Panel title="Digital Fraternal Annals Scrapbook">
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
          <MonthlyBulletins user={user} councilId={councilId} />
          <MeetingPhotos user={user} councilId={councilId} />
          <OralHistories user={user} councilId={councilId} />
        </div>
      </Panel>
    </div>
  );
}
