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
// Sprint 8I: the Oversight Desk carries the high-contrast Operations Knowledge Archive card for the council's Admins,
// Grand Knight and Deputy Grand Knight (OperationsKnowledgeArchiveEntryForm, canWriteOperationsKnowledge): a governance tag, a
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
// Sprint 8P Stage 3 - Universal Desk Drawers: the Treasurer, Recorder and Historian Desks are blotters too (no <details>
// folders remain). The Treasurer gets the Ledger Line Coder, Expense Report (ER) Settlement and Charitable Contribution
// Matches drawers with their own alerts beside the Planning & Budgeting Workflow; the Recorder's blotter is led by the
// featured Historical Meeting Minutes Archive; the Historian's by the Fraternal Diary Entry Logs reader. The Oversight
// Desk is dissolved: the Flagged Hours Review, Shifts Awaiting Hours and the Inbound Council Mail Center are Grand Knight
// Desk drawers that light while they hold work, the desk status badges are gone (each drawer carries its own count), and
// the Operations Knowledge Archive drawer holds the entry form for its writers. The Member Desk puts its two shift
// trackers side by side at the top and keeps plain panels.
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  addDays,
  awaitsTreasurerCoding,
  awaitsWrittenOrder,
  isPayableExpenseReport,
  buildReminderStream,
  PRAYING_HANDS_LABEL,
  bulletinMonthOf,
  COMMUNITY_PRAYER_CARD_TITLE,
  councilWideSettings,
  deskDrawersFor,
  DESK_ALERT_POLL_MS,
  diaryLogRows,
  buildCharityPipeline,
  charityPipelineAlert,
  type CharityPipelineDesk,
  erSettlementAlert,
  erWorkflowAlert,
  fsPaymentRequestAlert,
  gkSignatureAlert,
  minutesArchiveRows,
  payableSheets,
  treasurerCodingAlert,
  canDisburseCharity,
  type DeskDrawerId,
  describePrayerCount,
  type PrayerIntentionDetail,
  describeError,
  driveFileViewUrl,
  HISTORIAN_BULLETIN_MAX_LENGTH,
  BULLETIN_BODY_FORMATS,
  BULLETIN_BODY_FORMAT_LABELS,
  BULLETIN_HEADLINE_MAX_LENGTH,
  type BulletinBodyFormat,
  isDriveFileId,
  MEETING_PHOTO_DRIVE_FOLDER,
  MINUTES_DESK_AHEAD_DAYS,
  MINUTES_DESK_PAST_DAYS,
  MINUTES_TEXT_MAX_LENGTH,
  minutesCountdownLabel,
  minutesDeskRows,
  LOANER_LIBRARY_HREF,
  canOpenExpenseAuditDesk,
  canOpenExpenseAuthorizeDesk,
  canOpenTreasurerDesk,
  canWriteOperationsKnowledge,
  canSetCouncilGoals,
  currentFraternalYear,
  STAR_COUNCIL_OBJECTIVES,
  dailyVerse,
  DESK_FOCUS_TARGETS,
  LEADERBOARD_SIZE,
  hoursReminderCadence,
  hoursRemindersDue,
  MEMBER_DESK_OPEN_SHIFT_DAYS,
  memberDeskOpenShifts,
  signupWindow,
  feastDayTracker,
  FEAST_TRACKER_DAYS,
  formatShiftWhen,
  HOLY_DAY_BADGE,
  NABRE_NOTICE,
  upcomingAgenda,
  minutesCheckboxes,
  setMinutesCheckbox,
  UPCOMING_AGENDA_DAYS,
  UPCOMING_EVENT_AGENDA_TITLE,
  toIsoDate,
  type ExpenseReportDetail,
  type LiveMeetingLaunch as LiveMeetingLaunchResult,
  type Meeting,
  type MinutesCountdown,
  type SessionUser,
} from '@kofc/shared';
import { BankStatementMatchWindow, BudgetVsActualsModule, MotionsLedgerModule } from '@/components/DeskModules';
import { DeskBlotter } from '@/components/DeskDrawers';
import { AuthorizationDesk as ApprovedExpenseSigning } from '@/components/modules/ApprovedExpenseSigning';
import { DisbursementLedger as ExpenseSettlement } from '@/components/modules/ExpenseSettlement';
import { TreasurerDesk as LedgerLineCoder } from '@/components/modules/LedgerLineCoder';
import { DonationsWorkspace as DonationRecords } from '@/components/modules/DonationRecords';
import { CouncilElectionWorkflow } from '@/components/modules/ElectionWorkflow';
import { ChartOfAccountsSetup } from '@/components/modules/ChartOfAccountsSetup';
import { CharityEndorsementDesk, CharityPipelineWorkflow, ExpenseReportWorkflow } from '@/components/FinanceWorkflowParts';
import { AuditQueue as ExpenseRoutingTrack } from '@/components/modules/ExpenseRoutingTrack';
import { KnowledgeArchive } from '@/components/modules/KnowledgeArchive';
import { AuditDesk as PaymentRequestDesk } from '@/components/modules/PaymentRequestDesk';
import { FraternalPlanningWorkflow } from '@/components/PlanningWorkflowParts';
import { ExpenseStatusPill } from '@/components/ExpenseParts';
import { CharityQueue as CharityCheckConsole } from '@/components/modules/CharityCheckConsole';
import { VettingDesk as CharityVettingBoard } from '@/components/modules/CharityVettingBoard';
import { Affiliations as ConnectedCouncils } from '@/components/modules/ConnectedCouncils';
import { AdvisorTerminal as ConstitutionalAdvisor } from '@/components/modules/ConstitutionalAdvisor';
import { PhotoGallery } from '@/components/modules/PhotoGallery';
import { AuditDesk as TrusteeAuditDesk } from '@/components/modules/TrusteeAuditDesk';
import { LoanerLibraryManager } from '@/components/LoanerLibraryParts';
import { IncomingAffiliationInvites } from '@/components/AffiliationsParts';
import { OperationsKnowledgeArchiveEntryForm } from '@/components/KnowledgeArchiveParts';
import { ChurchDisbursementQueue, ParishSplitConsoleCard } from '@/components/ParishSplitParts';
import { BatchTransactionCoder, CashBoxAuditPanel } from '@/components/CashAuditParts';
import { BulletinBody, LatestBulletinsFeed } from '@/components/BulletinParts';
import { TrackingSteps } from '@/components/IntakeParts';
import { Markdown } from '@/components/Markdown';
import { OralHistoryRecorder } from '@/components/OralHistoryRecorder';
import { InboundMailCenter, readAccessRequests } from '@/components/PlatformAccessParts';
import { QuarantineDesk } from '@/components/QuarantineDesk';
import { Button, cx, Empty, Field, Input, Notice, Panel, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { DeskRow } from '@/components/WorkspaceTabs';
import { formatDecimalHours, formatFullDate, formatMoney, formatPersonName, formatPhone } from '@/lib/format';
import { photoName, photoSrc } from '@/lib/media';
import { useFeatureFlags, useSession, useTenantType } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import { archiveMeetingPhoto, localFileLink } from '@/services/drive-vault-transport';

/** How far ahead the Member Desk lists the member's own shifts. */
/** One row of the Recorder's business calendar: a meeting with its minutes countdown. */
type MinutesRow = MinutesCountdown & { meeting: Meeting };

const MEMBER_DESK_SHIFT_DAYS = 30;
/** How far back the Historical Meeting Minutes Archive reads the council's meetings. */
const MINUTES_ARCHIVE_FROM = '1900-01-01';
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

/**
 * The Live Actionable Reminders card on Home. Sprint 8S: read only - each reminder is plain text, with no link into a
 * desk; the reader acts from the desk tab or the alert bell.
 */
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
              <p className="font-bold">{r.title}</p>
              <p className="text-sm">{r.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-muted">Read only. Refreshes every minute. Act on a reminder from your desk tab; the alert bell keeps the full six-month log.</p>
    </HomeCard>
  );
}

/**
 * Sprint 8S Revision 3, '[ 📅 Upcoming Event Agenda ]' (Today's Event Agenda until then): the council's events and
 * meetings over the next UPCOMING_AGENDA_DAYS days, and under them the automated Old Business - the open checkbox items
 * of last month's published minutes (meetings.listOldBusiness), read only, as the council's standing priorities.
 */
function UpcomingEventAgenda({ councilId, today }: { councilId: number; today: string }) {
  const lastDay = addDays(today, UPCOMING_AGENDA_DAYS - 1);
  const entries = useLoad(() => db.events.listCalendarRange(councilId, today, lastDay), [councilId, today, lastDay]);
  const priorities = useLoad(() => db.meetings.listOldBusiness(councilId, today), [councilId, today]);
  const rows = upcomingAgenda(entries.data ?? [], today, lastDay);
  const items = priorities.data ?? [];
  return (
    <HomeCard title={UPCOMING_EVENT_AGENDA_TITLE}>
      {entries.error ? <Notice tone="error">{entries.error}</Notice> : null}
      {entries.data && rows.length === 0 ? <Empty>No event or meeting in the next {UPCOMING_AGENDA_DAYS} days. The council calendar shows what is coming.</Empty> : null}
      {rows.length > 0 ? (
        <Table caption={`Events and meetings in the next ${UPCOMING_AGENDA_DAYS} days`} head={['When', 'What', 'Where']}>
          {rows.map((e) => (
            <tr key={`${e.kind}-${e.id}`}>
              <Td className="whitespace-nowrap font-bold">
                {shortDay(e.startDate < today ? today : e.startDate)}
                <span className="block text-xs font-normal">
                  {e.kind === 'meeting' ? shortTime(e.startTime) : e.startDate === e.endDate ? 'All day' : `Through ${shortDay(e.endDate)}`}
                </span>
              </Td>
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
      <section aria-label="Council priorities from last month's minutes" className="mt-3 border-t-2 border-gold pt-2">
        <h3 className="text-sm font-bold uppercase tracking-wide">Council priorities · Old Business</h3>
        {priorities.error ? <Notice tone="error">{priorities.error}</Notice> : null}
        {priorities.data && items.length === 0 ? <p className="text-sm text-muted">Last month&apos;s minutes leave no open item.</p> : null}
        {items.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-1 text-sm" aria-label="Unresolved items, read only">
            {items.map((i) => (
              <li key={`${i.meetingId}-${i.text}`} className="flex gap-2">
                <span aria-hidden="true">☐</span>
                <span>
                  {i.text}
                  <span className="block text-xs text-muted">
                    {i.meetingName} · {shortDay(i.meetingDate)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <p className="mt-1 text-xs text-muted">
        {formatFullDate(today)} – {formatFullDate(lastDay)}
      </p>
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
/** One intention on the Home prayer card: its text, who asked, and the one-tap '[ 🙏 Praying Hands ]' counter (prayers.pray). */
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

/**
 * The '📿 Community Prayer Request List' card on Home (Sprint 8L): the council's open prayer intentions (prayers.getBoard).
 * Sprint 8S made it read only; Sprint 8S Corrected returns the '[ 🙏 Praying Hands ]' button to each intention (once a
 * day per member), so a brother prays straight from Home. It still has no links into the desks; intentions are posted
 * on the Faith Center page.
 */
function CommunityPrayerCard({ user, councilId }: { user: SessionUser; councilId: number }) {
  const board = useLoad(() => db.prayers.getBoard(user.memberId, councilId), [user.memberId, councilId]);
  const rows = board.data?.intentions ?? [];
  return (
    <HomeCard title={COMMUNITY_PRAYER_CARD_TITLE}>
      {board.error ? <Notice tone="error">{board.error}</Notice> : null}
      {board.data && rows.length === 0 ? <Empty>No open prayer intentions.</Empty> : null}
      <ul aria-label="Open prayer intentions">
        {rows.map((item) => (
          <PrayerRequestRow key={item.intention.id} user={user} item={item} />
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Tap {PRAYING_HANDS_LABEL} once a day for each intention. Add an intention on the Faith Center page.</p>
    </HomeCard>
  );
}

/**
 * Sprint 8R Corrected: Home is purely informational, with no workflow button: the newsletters feed, the verse and the
 * feast tracker (with the Faith Center), today's agenda and the month's Top 5 Fraternal Volunteers honor board. Sprint
 * 8S: the reminders and the prayer list are back - the reminders read only, with no links into the desks. Sprint 8S
 * Corrected: the prayer list's '[ 🙏 Praying Hands ]' is the one button on Home. The shift sign-ups and the Volunteer
 * Check-In & Service Center live on the Member Actions Hub (the Member Desk keeps the shift trackers).
 */
export function HomeWidgets({ user, councilId, faithOn }: { user: SessionUser; councilId: number; faithOn: boolean }) {
  const today = toIsoDate(new Date());
  return (
    <div className={cx('grid grid-cols-1 gap-6 lg:grid-cols-2', faithOn ? '2xl:grid-cols-3' : '2xl:grid-cols-2')}>
      <LatestBulletinsFeed memberId={user.memberId} councilId={councilId} className="col-span-full" />
      {faithOn ? <VerseOfTheDay today={today} /> : null}
      <ReminderStream user={user} councilId={councilId} />
      {faithOn ? <FeastDayTracker today={today} /> : null}
      <UpcomingEventAgenda councilId={councilId} today={today} />
      <TopVolunteersCard user={user} councilId={councilId} />
      {faithOn ? <CommunityPrayerCard user={user} councilId={councilId} /> : null}
    </div>
  );
}

// ---- the Officer Desks --------------------------------------------------------------------------------

/** Re-reads a desk's queues every DESK_ALERT_POLL_MS, so the Alert Boundary Accent lights while the desk is open. */
function usePolling(reload: () => Promise<unknown>) {
  useEffect(() => {
    const timer = window.setInterval(() => void reload(), DESK_ALERT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [reload]);
}

/** A count read that must never fail the whole desk: a refused or failed read is simply no count. */
const settled = async <T,>(read: () => Promise<T>): Promise<T | null> => {
  try {
    return await read();
  } catch {
    return null;
  }
};

/**
 * Sprint 8S Revision 3: the council's charity requests for the outgoing Charitable Donation Workflow drawer, polled with
 * the desk, and that drawer's handle status (the requests waiting on the reader's own step, and its accent).
 */
function useCharityPipeline(user: SessionUser, councilId: number, desk: CharityPipelineDesk, enabled: boolean) {
  const requests = useLoad(
    () => (enabled ? db.charities.listCharitableRequestsQueue(user.memberId, councilId) : Promise.resolve(null)),
    [user.memberId, councilId, enabled],
  );
  usePolling(requests.reload);
  const rows = requests.data ?? null;
  const status = {
    count: buildCharityPipeline(desk, rows).waiting,
    alert: rows ? charityPipelineAlert(user, desk, councilId, rows) : false,
    alertText: desk === 'treasurer' ? 'Endorsed charity requests waiting for your check' : 'Approved charity requests waiting for your endorsement',
  };
  const drawer = <CharityPipelineWorkflow desk={desk} requests={rows} error={requests.error} />;
  // Sprint 8S Revision 10.6: the FS/GK Compliance Endorsements working folder reads the same requests.
  const endorsements = <CharityEndorsementDesk user={user} councilId={councilId} requests={rows} error={requests.error} onChanged={requests.reload} />;
  return { status, drawer, endorsements, reload: requests.reload };
}

/**
 * The Planning & Budgeting Workflow drawer: the council's planning banner and goals (FraternalPlanningWorkflow). Sprint 8S
 * Revision 10.6: read only - the goals are set and reviewed on Council Wide Settings.
 */
function PlanningBudgetingDrawer({ user, councilId }: { user: SessionUser; councilId: number }) {
  const council = useLoad(() => db.councils.get(councilId), [councilId]);
  return (
    <>
      {council.error ? <Notice tone="error">{council.error}</Notice> : null}
      {council.data ? <FraternalPlanningWorkflow key={council.data.id} user={user} council={council.data} readOnly /> : council.loading ? <p className="text-sm">Loading…</p> : null}
      <p className="text-sm">
        This folder is for reference. Set and review the goals on Council Wide Settings; the final budget vote stays on the Annual Budget Planner.
      </p>
    </>
  );
}

/**
 * Sprint 8S Revision 8: the '[ 📈 Council Goals & Targets ]' folder - the Star Council objectives (Membership Intake,
 * Charitable Dollars, Volunteer Hours) of the current fraternal year against the targets set in the Planning & Budgeting
 * Workflow (reports.getCouncilGoals, the same figures as the Executive Dashboard's progress wheels).
 */
function CouncilGoalsDrawer({ user, councilId }: { user: SessionUser; councilId: number }) {
  const year = currentFraternalYear(new Date());
  const progress = useLoad(() => db.reports.getCouncilGoals(user.memberId, councilId, year), [user.memberId, councilId, year]);
  const metrics = progress.data?.metrics ?? [];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Star Council objectives for fraternal year <span className="font-bold">{year}</span>. Each bar fills as the council&apos;s records reach the target.
      </p>
      {progress.error ? <Notice tone="error">{progress.error}</Notice> : null}
      {progress.loading && !progress.data ? <p className="text-sm">Loading the council&apos;s goals…</p> : null}
      {progress.data ? (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {STAR_COUNCIL_OBJECTIVES.map((objective) => {
            const m = metrics.find((x) => x.key === objective.key);
            const actual = m?.actual ?? 0;
            const target = m?.target ?? 0;
            const share = m?.percent == null ? 0 : Math.min(m.percent, 100);
            const show = (n: number) => (m?.unit === 'money' ? formatMoney(n) : m?.unit === 'hours' ? formatDecimalHours(n) : n.toLocaleString('en-US'));
            return (
              <li key={objective.key} className="flex flex-col gap-2 rounded border-2 border-navy border-t-8 border-t-gold bg-white p-3">
                <h3 className="font-serif text-lg font-bold">{objective.label}</h3>
                <p className="text-xs text-muted">{objective.detail}</p>
                <p className="text-2xl font-bold">{show(actual)}</p>
                <div
                  role="progressbar"
                  aria-label={`${objective.label} progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={share}
                  className="h-3 w-full overflow-hidden rounded bg-line"
                >
                  <div className={cx('h-full', share >= 100 ? 'bg-gold' : 'bg-navy')} style={{ width: `${share}%` }} />
                </div>
                <p className="text-sm">
                  {target > 0 ? (
                    <>
                      <span className="font-bold">{m?.percent}%</span> of the {show(target)} target
                    </>
                  ) : (
                    'No target set for this year'
                  )}
                </p>
                {share >= 100 ? <Pill tone="gold">Goal reached</Pill> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="text-xs text-muted">
        {canSetCouncilGoals(user, councilId)
          ? 'Set or change the targets in the Planning & Budgeting Workflow folder, until the goals lock on July 1.'
          : "The Grand Knight or Deputy Grand Knight sets the targets in the Planning & Budgeting Workflow folder."}
      </p>
    </div>
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
 * The Operations Knowledge Archive drawer (Sprint 8P Stage 3): the entry form for its writers (the council's Admins,
 * Grand Knight and Deputy Grand Knight, and Super Admins - canWriteOperationsKnowledge) over the read-only archive.
 */
function KnowledgeArchiveDrawer({ user, councilId }: { user: SessionUser; councilId: number }) {
  return (
    <>
      {canWriteOperationsKnowledge(user, councilId) ? <OperationsKnowledgeArchiveEntryForm user={user} councilId={councilId} /> : null}
      <KnowledgeArchive />
    </>
  );
}

/** The Flagged Hours Review drawer: the Volunteer Time Quarantine Desk while the council's flag is on. */
function FlaggedHoursDrawer({ user, councilId }: { user: SessionUser; councilId: number }) {
  const flags = useFeatureFlags();
  return flags.feature_volunteer_quarantine ? (
    <QuarantineDesk actorId={user.memberId} councilId={councilId} />
  ) : (
    <Notice tone="info">The Flagged Hours Review is switched off for this council (Feature Flags), so no time entry is held for review.</Notice>
  );
}

/**
 * The Grand Knight Desk (shared by the Deputy Grand Knight). Sprint 8P Stage 2: a desk blotter of slide-out drawers
 * (desk-drawers.ts DESK_DRAWERS) - Approved Expenses (counter-sign and release in place, with the Alert Boundary Accent
 * while a sheet waits on the reader's signature), the Charitable Grant Requests Vetting Board, the Planning & Budgeting
 * Workflow, the Council Election Workflow (the Council Election Tracker until Sprint 8S Revision 2), the Shared Loaner Library, Affiliation Invites, Connected Councils, the
 * Constitutional Advisor Panels and the Operations Knowledge Archive. Sprint 8P Stage 3: the dissolved Oversight Desk's
 * audits join it - the Flagged Hours Review (lit while an entry is held), Shifts Awaiting Hours (lit while one is
 * overdue) and, for Super Admins, the Inbound Council Mail Center (lit while a request is pending).
 */
export function GrandKnightDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  const flags = useFeatureFlags();
  const tenantType = useTenantType();
  const drawers = deskDrawersFor(user, 'grand-knight', councilId, flags, tenantType);
  const has = (id: DeskDrawerId) => drawers.some((d) => d.id === id);
  const reviewHeld = has('flagged-hours') && flags.feature_volunteer_quarantine;
  const readsHours = has('shifts-awaiting-hours');
  const readsMail = has('access-requests');
  const charity = useCharityPipeline(user, councilId, 'grand-knight', has('donation-workflow') || has('charity-endorsements'));
  const queue = useLoad(() => db.expenses.listAuthorizationQueue(user.memberId, councilId), [user.memberId, councilId]);
  const audits = useLoad(async () => {
    const [held, awaiting, council, requests] = await Promise.all([
      reviewHeld ? settled(() => db.volunteerQuarantine.listPending(user.memberId, councilId)) : null,
      readsHours ? settled(() => db.reports.listShiftsAwaitingHours(councilId)) : null,
      readsHours ? settled(() => db.councils.get(councilId)) : null,
      readsMail ? settled(() => readAccessRequests()) : null,
    ]);
    const delay = hoursReminderCadence(council).delayDays;
    const open = (awaiting ?? []).filter((r) => !r.closed);
    return {
      held: held ? held.length : null,
      hours: awaiting ? open.length : null,
      overdue: open.filter((r) => r.daysSinceShift >= delay).length,
      requests: requests ? requests.filter((r) => r.status === 'PENDING').length : null,
    };
  }, [user.memberId, councilId, reviewHeld, readsHours, readsMail]);
  usePolling(queue.reload);
  usePolling(audits.reload);
  const rows = queue.data ?? [];
  const a = audits.data;
  return (
    <div className="flex flex-col gap-4">
      {queue.error ? <Notice tone="error">{queue.error}</Notice> : null}
      <DeskBlotter
        desk="grand-knight"
        drawers={drawers}
        status={(spec) => {
          switch (spec.id) {
            case 'approved-expenses':
              return { count: queue.data ? rows.length : null, alert: gkSignatureAlert(user, rows) };
            case 'flagged-hours':
              return { count: a?.held ?? null, alert: (a?.held ?? 0) > 0, alertText: 'Time entries held for your review' };
            case 'shifts-awaiting-hours':
              return { count: a?.hours ?? null, alert: (a?.overdue ?? 0) > 0, alertText: `${a?.overdue ?? 0} past the first reminder` };
            case 'access-requests':
              return { count: a?.requests ?? null, alert: (a?.requests ?? 0) > 0, alertText: 'Access requests to review' };
            case 'charity-endorsements':
              return charity.status;
            case 'donation-workflow':
              return charity.status;
            default:
              return undefined;
          }
        }}
        onClosed={() => {
          void queue.reload();
          void audits.reload();
          void charity.reload();
        }}
        render={(spec) => {
          switch (spec.id) {
            case 'approved-expenses':
              return <ApprovedExpenseSigning />;
            case 'flagged-hours':
              return <FlaggedHoursDrawer user={user} councilId={councilId} />;
            case 'shifts-awaiting-hours':
              return <AwaitingHours councilId={councilId} />;
            case 'access-requests':
              return <InboundMailCenter />;
            case 'vetting-board':
              return <CharityVettingBoard />;
            case 'charity-endorsements':
              return charity.endorsements;
            case 'donation-workflow':
              return charity.drawer;
            case 'council-goals':
              return <CouncilGoalsDrawer user={user} councilId={councilId} />;
            case 'planning-budgeting':
              return <PlanningBudgetingDrawer user={user} councilId={councilId} />;
            case 'election-workflow':
              return <CouncilElectionWorkflow />;
            case 'loaner-library':
              return <LoanerLibraryDrawer user={user} councilId={councilId} />;
            case 'affiliation-invites':
              return <IncomingAffiliationInvites user={user} councilId={councilId} />;
            case 'connected-councils':
              return <ConnectedCouncils />;
            case 'advisor':
              return <ConstitutionalAdvisor />;
            default:
              return <KnowledgeArchiveDrawer user={user} councilId={councilId} />;
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
 * inactivity sweep to System Settings > Council Wide Settings. Sprint 8S Revision 2: the Expense Report (ER) Workflow
 * (lit like Payment Requests) and the Charitable Donation Workflow drawers (FinanceWorkflowParts.tsx) follow Payment Requests.
 */
export function FinancialSecretaryDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  const flags = useFeatureFlags();
  const tenantType = useTenantType();
  const drawers = deskDrawersFor(user, 'financial-secretary', councilId, flags, tenantType);
  const queue = useLoad(() => db.expenses.listCouncilQueue(user.memberId, councilId), [user.memberId, councilId]);
  usePolling(queue.reload);
  const all = queue.data ?? [];
  const waiting = all.filter((d) => awaitsWrittenOrder(d.report));
  const alert = fsPaymentRequestAlert(user, all);
  const erWaiting = waiting.length;
  const charity = useCharityPipeline(user, councilId, 'financial-secretary', drawers.some((d) => d.id === 'donation-workflow' || d.id === 'charity-endorsements'));
  return (
    <div className="flex flex-col gap-4">
      {queue.error ? <Notice tone="error">{queue.error}</Notice> : null}
      <DeskBlotter
        desk="financial-secretary"
        drawers={drawers}
        status={(spec) =>
          spec.id === 'payment-requests'
            ? { count: queue.data ? waiting.length : null, alert }
            : spec.id === 'er-workflow'
              ? { count: queue.data ? erWaiting : null, alert: erWorkflowAlert(user, 'financial-secretary', all), alertText: 'Payment requests waiting for your signature' }
              : spec.id === 'donation-workflow' || spec.id === 'charity-endorsements'
                ? charity.status
                : spec.id === 'er-routing-track'
                  ? { count: queue.data ? all.length : null }
                  : undefined
        }
        onClosed={() => {
          void queue.reload();
          void charity.reload();
        }}
        render={(spec) => {
          switch (spec.id) {
            case 'payment-requests':
              return <PaymentRequestDesk />;
            case 'er-workflow':
              return <ExpenseReportWorkflow desk="financial-secretary" user={user} queue={queue.data ?? null} />;
            case 'charity-endorsements':
              return charity.endorsements;
            case 'donation-workflow':
              return charity.drawer;
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
              return <KnowledgeArchiveDrawer user={user} councilId={councilId} />;
          }
        }}
      />
    </div>
  );
}

/**
 * The Treasurer Desk. Sprint 8P Stage 3: a desk blotter of slide-out drawers - the Ledger Line Coder (lit while a signed
 * sheet waits for the reader's coding), Expense Report (ER) Settlement (lit while a fully signed sheet waits for the
 * reader's check), Charitable Contribution Matches (lit while a charity request or gift waits for its check), the
 * Planning & Budgeting Workflow, the Cash Box Audit Closure Panel, the High-Volume Batch Transaction Coder, the Annual
 * Budget vs Actuals Ledger Grid, the Bank Statement Match-Window and the Parish Fundraiser Revenue Split Console.
 * Sprint 8S Revision 2: the Expense Report (ER) Workflow (lit while a sheet waits for the reader's coding or check) and
 * the Charitable Donation Workflow follow the three money drawers. Sprint 8S Revision 3: the Charitable Donation Workflow
 * tracks outgoing charity checks and lights while an endorsed request waits for the reader's check.
 */
export function TreasurerDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  const flags = useFeatureFlags();
  const tenantType = useTenantType();
  const drawers = deskDrawersFor(user, 'treasurer', councilId, flags, tenantType);
  const pays = drawers.some((d) => d.id === 'er-settlement' || d.id === 'er-workflow');
  const matches = drawers.some((d) => d.id === 'charity-matches') && canDisburseCharity(user, councilId);
  const charityPipeline = useCharityPipeline(user, councilId, 'treasurer', drawers.some((d) => d.id === 'donation-workflow'));
  const coding = useLoad(() => db.expenses.listTreasurerQueue(user.memberId, councilId), [user.memberId, councilId]);
  const money = useLoad(async () => {
    const [sheets, proposals, funded] = await Promise.all([
      pays ? settled(() => db.expenses.listCouncilQueue(user.memberId, councilId)) : null,
      matches ? settled(() => db.charities.listCouncilProposals(user.memberId, councilId)) : null,
      matches ? settled(() => db.charities.listApprovedFundingQueue(user.memberId, councilId)) : null,
    ]);
    return {
      sheets,
      charity: proposals || funded ? (proposals ?? []).filter((d) => d.proposal.Status === 'Pending').length + (funded ?? []).length : null,
    };
  }, [user.memberId, councilId, pays, matches]);
  usePolling(coding.reload);
  usePolling(money.reload);
  const codingRows = coding.data ?? [];
  const sheets = money.data?.sheets ?? null;
  const charity = money.data?.charity ?? null;
  const erOwn = sheets ? sheets.filter((d) => awaitsTreasurerCoding(d.report) || isPayableExpenseReport(d.report)).length : null;
  return (
    <div className="flex flex-col gap-4">
      {coding.error ? <Notice tone="error">{coding.error}</Notice> : null}
      <DeskBlotter
        desk="treasurer"
        drawers={drawers}
        status={(spec) => {
          switch (spec.id) {
            case 'ledger-coder':
              return { count: coding.data ? codingRows.length : null, alert: treasurerCodingAlert(user, codingRows) };
            case 'er-settlement':
              return { count: sheets ? payableSheets(sheets).length : null, alert: sheets ? erSettlementAlert(user, sheets) : false, alertText: 'Fully signed sheets waiting for your check' };
            case 'charity-matches':
              return { count: charity, alert: (charity ?? 0) > 0, alertText: 'Charity requests waiting for a check' };
            case 'er-workflow':
              return { count: erOwn, alert: sheets ? erWorkflowAlert(user, 'treasurer', sheets) : false, alertText: 'Sheets waiting for your coding or check' };
            case 'donation-workflow':
              return charityPipeline.status;
            default:
              return undefined;
          }
        }}
        onClosed={() => {
          void coding.reload();
          void money.reload();
          void charityPipeline.reload();
        }}
        render={(spec) => {
          switch (spec.id) {
            case 'ledger-coder':
              return <LedgerLineCoder />;
            case 'er-settlement':
              return <ExpenseSettlement />;
            case 'charity-matches':
              return <CharityCheckConsole />;
            case 'er-workflow':
              return <ExpenseReportWorkflow desk="treasurer" user={user} queue={sheets} />;
            case 'donation-workflow':
              return charityPipeline.drawer;
            case 'planning-budgeting':
              return <PlanningBudgetingDrawer user={user} councilId={councilId} />;
            case 'cash-box-audit':
              return <CashBoxAuditPanel user={user} councilId={councilId} />;
            case 'batch-coder':
              return <BatchTransactionCoder user={user} councilId={councilId} />;
            case 'budget-vs-actuals':
              return <BudgetVsActualsModule user={user} councilId={councilId} />;
            case 'bank-match':
              return <BankStatementMatchWindow user={user} councilId={councilId} />;
            case 'chart-of-accounts':
              return <ChartOfAccountsSetup memberId={user.memberId} councilId={councilId} />;
            default:
              return <ParishSplitConsoleCard user={user} councilId={councilId} />;
          }
        }}
      />
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
    <Panel className="h-full" title={`[ 🚗 Open Shifts Needing Volunteers ] (${rows.length})`}>
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
        The Volunteer Check-In &amp; Service Center below lists every open shift.
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
 * Sprint 8P Stage 3: the twin shift trackers - '🚗 Open Shifts Needing Volunteers' and 'My shifts' - sit side by side in
 * the desk's top row, the same height, with the charity requests and expense sheets under them. This desk keeps plain
 * panels: no drawers, so a volunteer sees their shifts at once.
 */
/**
 * The Member Desk: every member's volunteer tracking. The two shift trackers sit side by side, equal height, across the
 * top row; then the charity and expense cards; then the Volunteer Check-In & Service Center (Sprint 8R Corrected: moved
 * here from Home, which stays informational). Sprint 8S: the reminders and the prayer list went back to Home. Sprint 8S
 * Corrected: the standalone Member Actions page mounted this same component. Sprint 8S Revision: the Volunteer Check-In &
 * Service Center left this desk - it lives only on the Member Actions Hub (/member-actions) - so no card repeats.
 */
export function MemberDesk({ user }: { user: SessionUser }) {
  const flags = useFeatureFlags();
  const today = toIsoDate(new Date());
  const through = toIsoDate(new Date(Date.now() + MEMBER_DESK_SHIFT_DAYS * 86_400_000));
  const sheets = useLoad(() => db.expenses.listUserReports(user.memberId), [user.memberId]);
  const shifts = useLoad(() => db.events.listMemberShifts(user.memberId, { fromDate: today, toDate: through }), [user.memberId, today, through]);
  const open = (sheets.data ?? []).filter((d) => d.report.Status !== 'Reimbursed');
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Shift trackers" className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <OpenShiftsCard user={user} />
        <Panel className="h-full" title={`My shifts: next ${MEMBER_DESK_SHIFT_DAYS} days (${shifts.data?.length ?? 0})`}>
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
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
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
      </div>
    </div>
  );
}

/**
 * Past signups still waiting for hours (reports.listShiftsAwaitingHours), flagged once the council's first reminder is
 * due. On the Reports Desk until Sprint 8C and the Oversight Desk until Sprint 8P Stage 3, which made it a Grand Knight
 * Desk drawer and put it back on the Executive Dashboard page for every executive-audit reader.
 */
export function AwaitingHours({ councilId }: { councilId: number }) {
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

// ---- the Recorder Desk (Sprint 8B) --------------------------------------------------------------------

const countdownTone = (c: MinutesCountdown) => (c.state === 'overdue' ? 'red' : c.state === 'open' ? 'gold' : c.state === 'published' ? 'navy' : 'outline');

/**
 * Sprint 8S Revision 3: the checkbox lines of a minutes text ('- [ ] ...' / '- [x] ...') as tick boxes. Ticking one
 * rewrites that line of the text (setMinutesCheckbox); nothing else in the text changes.
 */
function MinutesChecklist({ text, onChange, label }: { text: string; onChange: (next: string) => void; label: string }) {
  const boxes = minutesCheckboxes(text);
  if (boxes.length === 0) return null;
  return (
    <fieldset className="rounded border-2 border-gold bg-gold/10 px-3 py-2">
      <legend className="px-1 text-sm font-bold">{label}</legend>
      <ul className="flex flex-col gap-1">
        {boxes.map((b) => (
          <li key={b.line}>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={b.done} onChange={(e) => onChange(setMinutesCheckbox(text, b.line, e.target.checked))} />
              <span className={b.done ? 'line-through' : undefined}>{b.text}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/**
 * The old business the launch carried into the meeting's minutes draft, as tick boxes the Recorder works during the
 * session, saved back to the draft (saveMeetingMinutes, never published from here).
 */
function CarriedOldBusiness({ user, meetingId, launch }: { user: SessionUser; meetingId: number; launch: LiveMeetingLaunchResult }) {
  const [text, setText] = useState(launch.minutesText);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const dirty = text !== launch.minutesText;
  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await db.meetings.saveMeetingMinutes(user.memberId, meetingId, { text, publish: false });
      setMessage({ tone: 'info', text: 'Saved to the minutes draft.' });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };
  if (launch.oldBusiness.length === 0) return <p className="text-sm text-muted">Last month&apos;s minutes leave no open item, so no old business was carried in.</p>;
  return (
    <div className="flex flex-col gap-2">
      <MinutesChecklist text={text} onChange={setText} label={`Old Business carried from last month (${launch.oldBusiness.length})`} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="gold" disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save ticks to the minutes draft'}
        </Button>
        <span className="text-xs text-muted">The items are already in this meeting&apos;s minutes draft. Open items carry again next month.</span>
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
 * The Start Live Meeting Sequence control: starts the live console for the chosen meeting (meetings.launchLiveMeeting)
 * and shows the council's 4-digit PIN in large type, for members outside the check-in circle. Sprint 8S Revision 3:
 * the launch also writes last month's unresolved minutes items into this meeting's minutes draft, shown here as tick
 * boxes (CarriedOldBusiness).
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
      {launch && !launch.state.meeting.minutes_published_at ? <CarriedOldBusiness key={meeting.id} user={user} meetingId={meeting.id} launch={launch} /> : null}
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
      {preview ? null : <MinutesChecklist text={text} onChange={setText} label="Checklist items in these minutes" />}
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
 * The Historical Meeting Minutes Archive drawer (Sprint 8P Stage 3): every past meeting with minutes to read
 * (minutesArchiveRows - published text or an uploaded minutes file), newest first, a search box, and the chosen meeting's
 * minutes in the reader, so the Recorder reviews the last session before opening the next.
 */
function MinutesArchive({ councilId }: { councilId: number }) {
  const today = toIsoDate(new Date());
  const meetings = useLoad(() => db.meetings.listUpcoming(councilId, { fromDate: MINUTES_ARCHIVE_FROM }), [councilId]);
  const [query, setQuery] = useState('');
  const rows = minutesArchiveRows(meetings.data ?? [], today, query);
  const [chosen, setChosen] = useState<number | null>(null);
  const current = rows.find((m) => m.id === chosen) ?? rows[0] ?? null;
  const fileLink = current ? current.GoogleDriveMinutesURL?.trim() || current.MinutesURL?.trim() || '' : '';
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        <Field label="Search the minutes">{(id) => <Input id={id} type="search" value={query} placeholder="e.g. budget, March, motion" onChange={(e) => setQuery(e.target.value)} />}</Field>
        {meetings.error ? <Notice tone="error">{meetings.error}</Notice> : null}
        {meetings.data && rows.length === 0 ? <Empty>{query ? `No minutes match “${query}”.` : 'No meeting has published minutes yet.'}</Empty> : null}
        <ul aria-label="Meetings with minutes, newest first" className="flex flex-col gap-1">
          {rows.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setChosen(m.id)}
                aria-current={current?.id === m.id ? 'true' : undefined}
                className={cx(
                  'flex w-full flex-col rounded border-l-4 px-2 py-1.5 text-left text-sm ring-1 ring-line',
                  current?.id === m.id ? 'border-gold bg-gold/20 font-bold' : 'border-navy bg-white hover:bg-gold/10',
                )}
              >
                <span className="truncate">{m['Meeting Name']}</span>
                <span className="text-xs text-muted">{shortDay(String(m.Date).slice(0, 10))}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Panel title={current ? `${current['Meeting Name']} · ${shortDay(String(current.Date).slice(0, 10))}` : 'Minutes'}>
        {!current ? <Empty>Pick a meeting to read its minutes.</Empty> : null}
        {current?.minutes_published_at && current.minutes_text?.trim() ? <Markdown source={current.minutes_text} idPrefix={`archive-${current.id}`} /> : null}
        {current && fileLink ? (
          <p className="mt-3 text-sm">
            <a href={isDriveFileId(fileLink) ? driveFileViewUrl(fileLink) : fileLink} target="_blank" rel="noreferrer" className="font-bold underline">
              Open the minutes file
            </a>
          </p>
        ) : null}
      </Panel>
    </div>
  );
}

/** The Start Live Meeting Sequence drawer: pick a meeting of the business calendar, then launch it (LiveMeetingLaunch). */
function LiveMeetingDrawer({ user, rows }: { user: SessionUser; rows: readonly MinutesRow[] }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const current = rows.find((r) => r.meeting.id === chosen) ?? rows[0] ?? null;
  if (!current) return <Empty>No meeting in the last {MINUTES_DESK_PAST_DAYS} days or the next {MINUTES_DESK_AHEAD_DAYS}.</Empty>;
  return (
    <div className="flex flex-col gap-3">
      <Field label="Meeting">
        {(id) => (
          <Select id={id} value={String(current.meeting.id)} onChange={(e) => setChosen(Number(e.target.value))}>
            {rows.map((r) => (
              <option key={r.meeting.id} value={r.meeting.id}>
                {r.meeting['Meeting Name']} · {shortDay(r.heldOn)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <LiveMeetingLaunch user={user} meeting={current.meeting} />
    </div>
  );
}

/** The Meeting Minutes Entry Desk drawer: the business calendar with each meeting's countdown beside the editor. */
function MinutesEntryDrawer({ user, rows, dueDays, onSaved }: { user: SessionUser; rows: readonly MinutesRow[]; dueDays: number | null; onSaved: () => void }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const current = rows.find((r) => r.meeting.id === chosen) ?? rows[0] ?? null;
  const waiting = rows.filter((r) => r.state === 'open' || r.state === 'overdue').length;
  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Panel title={`Business calendar (${waiting} awaiting minutes)`}>
        {rows.length === 0 ? <Empty>No meeting in the last {MINUTES_DESK_PAST_DAYS} days or the next {MINUTES_DESK_AHEAD_DAYS}.</Empty> : null}
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
        <p className="mt-2 text-xs text-muted">Minutes are due {dueDays ?? '…'} days after each meeting (Council Wide Settings).</p>
      </Panel>
      <Panel title="Meeting Minutes Entry Desk">
        {current ? <MinutesEditor user={user} meeting={current.meeting} countdown={current} onSaved={onSaved} /> : <Empty>Pick a meeting from the business calendar to write its minutes.</Empty>}
      </Panel>
    </div>
  );
}

/**
 * The Recorder Desk (Sprint 8B): the council's business calendar with each meeting's minutes countdown (the meeting's last
 * day plus Council.meeting_minutes_due_days), the Meeting Minutes Entry Desk for the chosen meeting, and the Start Live
 * Meeting Sequence launch with the 4-digit PIN bypass. For the Recorder, the council's Admins and Super Admins.
 * Sprint 8P Stage 3: a desk blotter of drawers, led by the featured Historical Meeting Minutes Archive across the top row
 * for the session-opening review; the Meeting Minutes Entry Desk lights while minutes are due or overdue.
 */
export function RecorderDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  const flags = useFeatureFlags();
  const tenantType = useTenantType();
  const today = toIsoDate(new Date());
  const from = addDays(today, -MINUTES_DESK_PAST_DAYS);
  const data = useLoad(async () => {
    const [council, meetings] = await Promise.all([db.councils.get(councilId), db.meetings.listUpcoming(councilId, { fromDate: from })]);
    return { dueDays: councilWideSettings(council).meeting_minutes_due_days, meetings };
  }, [councilId, from]);
  usePolling(data.reload);
  const rows = data.data ? minutesDeskRows(data.data.meetings, today, data.data.dueDays) : [];
  const waiting = rows.filter((r) => r.state === 'open' || r.state === 'overdue');
  const overdue = waiting.filter((r) => r.state === 'overdue').length;

  return (
    <div className="flex flex-col gap-4">
      {data.error ? <Notice tone="error">{data.error}</Notice> : null}
      <DeskBlotter
        desk="recorder"
        drawers={deskDrawersFor(user, 'recorder', councilId, flags, tenantType)}
        status={(spec) =>
          spec.id === 'minutes-entry'
            ? {
                count: data.data ? waiting.length : null,
                alert: waiting.length > 0,
                alertText: overdue > 0 ? `${overdue} meeting${overdue === 1 ? '' : 's'} past the minutes deadline` : 'Minutes due',
              }
            : undefined
        }
        onClosed={() => void data.reload()}
        render={(spec) => {
          switch (spec.id) {
            case 'minutes-archive':
              return <MinutesArchive councilId={councilId} />;
            case 'minutes-entry':
              return <MinutesEntryDrawer user={user} rows={rows} dueDays={data.data?.dueDays ?? null} onSaved={() => void data.reload()} />;
            case 'live-meeting':
              return <LiveMeetingDrawer user={user} rows={rows} />;
            case 'election-workflow':
              return <CouncilElectionWorkflow />;
            default:
              return <MotionsLedgerModule councilId={councilId} />;
          }
        }}
      />
    </div>
  );
}

// ---- the Historian Desk (Sprint 8B) -------------------------------------------------------------------

/**
 * The Historian's monthly text bulletins (CouncilHistorianBulletin): one per month, any month re-opened from the list.
 * Sprint 8Q: each has a headline and a body format - STRUCTURED (blank lines part paragraphs, '## ' headings, '- '
 * bullets) or PLAIN - with a live preview as members will read it on Home.
 */
function MonthlyBulletins({ user, councilId }: { user: SessionUser; councilId: number }) {
  const list = useLoad(() => db.history.listHistorianBulletins(user.memberId, councilId), [user.memberId, councilId]);
  const [month, setMonth] = useState(() => bulletinMonthOf(toIsoDate(new Date())));
  const stored = (list.data ?? []).find((b) => b.bulletin_month === month) ?? null;
  const [body, setBody] = useState('');
  const [headline, setHeadline] = useState('');
  const [format, setFormat] = useState<BulletinBodyFormat>('STRUCTURED');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  useEffect(() => setBody(stored?.body ?? ''), [month, stored?.body]);
  useEffect(() => setHeadline(stored?.headline ?? ''), [month, stored?.headline]);
  useEffect(() => setFormat(stored?.body_format ?? 'STRUCTURED'), [month, stored?.body_format]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await db.history.saveHistorianBulletin(user.memberId, councilId, month, body, { headline, body_format: format });
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
      <Field label="Headline">
        {(id) => <Input id={id} maxLength={BULLETIN_HEADLINE_MAX_LENGTH} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="October at the council" />}
      </Field>
      <Field label="Layout" className="w-72">
        {(id) => (
          <Select id={id} value={format} onChange={(e) => setFormat(e.target.value as BulletinBodyFormat)}>
            {BULLETIN_BODY_FORMATS.map((f) => (
              <option key={f} value={f}>
                {BULLETIN_BODY_FORMAT_LABELS[f]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Newsletter text">
        {(id) => (
          <Textarea
            id={id}
            rows={10}
            maxLength={HISTORIAN_BULLETIN_MAX_LENGTH}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={'## This month\n\nLeave a blank line between paragraphs.\n\n- Start a line with a dash for a bullet'}
          />
        )}
      </Field>
      {format === 'STRUCTURED' ? (
        <p className="text-xs text-muted">Leave a blank line between paragraphs. Start a line with ## for a section heading, or with - for a bullet.</p>
      ) : null}
      {body.trim() ? (
        <details className="rounded border border-line px-3 py-2">
          <summary className="cursor-pointer text-sm font-bold">Preview as members see it on Home</summary>
          <BulletinBody bulletin={{ body, body_format: format }} className="mt-2" />
        </details>
      ) : null}
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
 * The Fraternal Diary Entry Logs drawer (Sprint 8P Stage 3): every diary entry of the council's Team Legacy matrix
 * (diaryLogRows), newest first, narrowed by fraternal year and by words, read in place. Read-only: members write their
 * own entry on the Team Legacy page, one a day.
 */
function DiaryLogs({ user, councilId }: { user: SessionUser; councilId: number }) {
  const matrix = useLoad(() => db.history.getLegacyMatrix(user.memberId, councilId), [user.memberId, councilId]);
  const [year, setYear] = useState('');
  const [query, setQuery] = useState('');
  const years = matrix.data?.years ?? [];
  const rows = diaryLogRows(years, year, query);
  const href = (ref: string) => (isDriveFileId(ref) ? driveFileViewUrl(ref) : ref.split('#')[0]);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[14rem_minmax(0,1fr)]">
        <Field label="Fraternal year">
          {(id) => (
            <Select id={id} value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">Every year</option>
              {years.map((y) => (
                <option key={y.fraternalYear} value={y.fraternalYear}>
                  {y.fraternalYear}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Search the diary">{(id) => <Input id={id} type="search" value={query} placeholder="e.g. a name, a word, 2026-03" onChange={(e) => setQuery(e.target.value)} />}</Field>
      </div>
      {matrix.error ? <Notice tone="error">{matrix.error}</Notice> : null}
      {matrix.data && rows.length === 0 ? <Empty>{query || year ? 'No diary entry matches.' : 'No member has written a diary entry yet.'}</Empty> : null}
      <p className="text-xs text-muted" aria-live="polite">
        {matrix.data ? `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}` : 'Reading the diary…'}
      </p>
      <ol aria-label="Diary entries, newest first" className="flex flex-col divide-y divide-line">
        {rows.map((d) => (
          <li key={d.entry.id} className="py-2">
            <p className="text-sm">
              <span className="font-bold">{formatPersonName(d.authorFirstName, d.authorLastName)}</span> · {shortDay(d.entry.entry_date)} ·{' '}
              <span className="text-muted">{d.entry.fraternal_year}</span>
            </p>
            <p className="mt-1 whitespace-pre-wrap">{d.entry.diary_text}</p>
            {d.entry.audio_asset_url ? (
              <a href={href(d.entry.audio_asset_url)} target="_blank" rel="noreferrer" className="text-sm font-bold underline">
                Listen to the recording
              </a>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The Historian Desk (Sprint 8B): the Digital Fraternal Annals Scrapbook - monthly text bulletins, meeting photos filed
 * under Media / Meeting_Photos and the oral-history recordings. For the Council Historian, the council's Admins and Super
 * Admins. Sprint 8P Stage 3: a desk blotter of drawers - the Fraternal Diary Entry Logs reader, Monthly Newsletters,
 * Meeting Photos, Oral History Recordings and the Google Drive Media Gallery Sync Board.
 */
export function HistorianDesk({ user, councilId }: { user: SessionUser; councilId: number }) {
  const flags = useFeatureFlags();
  const tenantType = useTenantType();
  return (
    <DeskBlotter
      desk="historian"
      drawers={deskDrawersFor(user, 'historian', councilId, flags, tenantType)}
      render={(spec) => {
        switch (spec.id) {
          case 'diary-logs':
            return <DiaryLogs user={user} councilId={councilId} />;
          case 'bulletins':
            return <MonthlyBulletins user={user} councilId={councilId} />;
          case 'meeting-photos':
            return <MeetingPhotos user={user} councilId={councilId} />;
          case 'oral-histories':
            return <OralHistories user={user} councilId={councilId} />;
          case 'election-workflow':
            return <CouncilElectionWorkflow />;
          default:
            return <PhotoGallery />;
        }
      }}
    />
  );
}
