'use client';
// The Executive Dashboard (Sprint 8D/8E): the Executive Summary's own page, the sidebar's Executive Dashboard link
// (EXECUTIVE_DASHBOARD_HREF). One council's month at a glance from reports.monthlySummary - four stat tiles (labor hours,
// unique Knights, net balance, outreach), the engagement row, the ledger figures behind the balance as a table and the
// month's event highlights. Open to the council's Admins, every officer of the council (canViewExecutiveDashboard,
// Sprint 5Z-2.5), the Council Historian (canOpenHistorianDesk, Sprint 8E Extension) and any Super Admin, who may pick the
// council. A Historian without an officer seat reads the month, the roadmap and the engagement row; the budget, mission
// and audit panels keep their own gates, and only officers and Admins send the roadmap's overdue alerts.
//
// Readers cleared for it (canReviewBudgetPerformance) also get the Faith-in-Action Mission Tracking card
// (reports.missionAreaFootprint) and the budget tracking gauges of the chosen month's fraternal year
// (budget.getBudgetProgress), flagged from 85%. Every reader gets the Annual Fraternal Roadmap with the Three-Signature
// Expense Flow tree (RoadmapParts) and, under the month, the no-show audit of the trailing NO_SHOW_AUDIT_MONTHS
// (reports.listNoShowsAudit) and the Shifts Awaiting Hours audit (Sprint 8P Stage 3: back from the dissolved Oversight
// Desk; the Grand Knight Desk also carries it as a drawer).
//
// History: the Executive Summary was /dashboard's whole page until Sprint 7J, the lower half of Home in Sprint 7J, the
// Reports Desk in Sprint 8A and Home's self-scrolling frame in Sprint 8C. Sprint 8D/8E gave Home back to the universal
// cards and moved the summary here, where the page scrolls as any other.
//
// Sprint 8F: two analytics panels for the general ledger's readers (canReadCouncilGoals): the Annual Council Goals
// Progress Center (GoalsProgressCenter, reports.getCouncilGoals) - progress wheels for the fraternal year's fundraising,
// recruitment, service-hour and devotional targets, which the Grand Knight or Deputy Grand Knight sets in place - and the
// Year-over-Year Trends (YearOverYearTrends), the trend lines GET /api/analytics/trends serves.
//
// Sprint 10 Revision 1.0 (the visual declutter): under the stat tiles and the monthly activity overview, the Annual
// Fraternal Roadmap, the Goals Progress Center, the Year-over-Year Trends and the no-show audit are closed drawers
// stacked one under another (DashboardDrawer); each loads only when opened. The Top 5 Volunteers Leaderboard (still on
// the Council Dashboard), the Shifts Awaiting Hours audit (still a Grand Knight Desk drawer) and the monthly financial
// ledger table are gone from this page; the net balance tile keeps the month's raised and spent figures.
//
// Sprint 11 Revision 2.0: the Net Balance tile and the Monthly Activity card read one set of figures
// (monthlyActivityFigures over the same reports.monthlySummary), which fixes the October mismatch between the card's cash
// and the tile's funds raised. The order under the tiles is now: the Monthly Activity card, the Faith in Action Mission
// Tracking drawer, Budget Tracking, the Roadmap, Goals and Year-over-Year drawers, the monthly highlights, and the
// No-Show Audit drawer on the bottom row.
import { useState, type ReactNode } from 'react';
import {
  BUDGET_WARNING_THRESHOLD_PERCENT,
  canReviewBudgetPerformance,
  canViewExecutiveAudits,
  canOpenHistorianDesk,
  canReadCouncilGoals,
  canViewExecutiveDashboard,
  currentFraternalYear,
  isAdmin,
  monthlyActivityFigures,
  NO_SHOW_AUDIT_MONTHS,
  type MonthlySummary,
} from '@kofc/shared';
import { BudgetAlertTag, BudgetGauge, formatPercent } from '@/components/BudgetParts';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { EngagementCards } from '@/components/EngagementParts';
import { MissionTracking } from '@/components/MissionTracking';
import { FraternalRoadmap, RoadmapRibbon } from '@/components/RoadmapParts';
import { GoalsProgressCenter, YearOverYearTrends } from '@/components/GoalsParts';
import { cx, Empty, Field, Notice, PageTitle, Panel, Pill, Select, Table, Td } from '@/components/ui';
import { formatDecimalHours, formatFullDate, formatMoney, formatPersonName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * A stat tile: sentence-case label, the value large in the body font, one line of context under it. Compact (Sprint 8A)
 * trims the padding and the figure so four tiles sit in one short row.
 */
function StatTile({ label, value, detail, tone = 'navy', compact = false }: { label: string; value: ReactNode; detail: ReactNode; tone?: 'navy' | 'red'; compact?: boolean }) {
  return (
    <section aria-label={label} className={cx('flex min-w-0 flex-col rounded border-2 border-navy border-t-8 border-t-gold bg-white', compact ? 'px-3 py-1.5' : 'gap-1 px-4 py-3')}>
      <h2 className="text-sm font-bold">{label}</h2>
      <p className={cx('font-bold leading-tight', compact ? 'text-2xl' : 'text-4xl', tone === 'red' ? 'text-brand-red' : 'text-navy')}>{value}</p>
      <p className="truncate text-xs text-muted">{detail}</p>
    </section>
  );
}

function Scorecards({ s, compact = false }: { s: MonthlySummary; compact?: boolean }) {
  const figures = monthlyActivityFigures(s);
  const deficit = figures.net < 0;
  const tile = { compact };
  return (
    <div className={cx('grid grid-cols-2 xl:grid-cols-4', compact ? 'gap-3' : 'gap-4 md:grid-cols-2')}>
      <StatTile
        {...tile}
        label="Total labor hours"
        value={formatDecimalHours(s.laborHours.total)}
        detail={`${formatDecimalHours(s.laborHours.events)} at events · ${formatDecimalHours(s.laborHours.activities)} on activities`}
      />
      <StatTile
        {...tile}
        label="Unique Knights participating"
        value={s.uniqueMembers.toLocaleString('en-US')}
        detail="Members who logged event or activity time"
      />
      <StatTile
        {...tile}
        label="Net balance"
        tone={deficit ? 'red' : 'navy'}
        value={formatMoney(figures.net)}
        detail={`${deficit ? 'Deficit' : figures.net > 0 ? 'Surplus' : 'Break-even'}: ${formatMoney(figures.raised)} raised − ${formatMoney(figures.spend)} spent`}
      />
      <StatTile
        {...tile}
        label="Community outreach"
        value={s.outreach.attendees.toLocaleString('en-US')}
        detail={`Attendees across ${s.outreach.events} event${s.outreach.events === 1 ? '' : 's'}`}
      />
    </div>
  );
}

/**
 * Budget tracking gauges for one fraternal year: the whole budget, then each category with an approved cap or spend.
 * Before the council approves the year there are no caps, so the panel says so and shows only what has been spent.
 */
function BudgetTracking({ actorId, councilId, fraternalYear }: { actorId: number; councilId: number; fraternalYear: string }) {
  const progress = useLoad(() => db.budget.getBudgetProgress(actorId, councilId, fraternalYear), [actorId, councilId, fraternalYear]);
  const p = progress.data;
  const active = p ? p.categories.filter((c) => c.approved > 0 || c.actual > 0) : [];
  const flagged = active.filter((c) => c.alert === 'Warning' || c.alert === 'Over Budget').length;
  return (
    <Panel
      title={`Budget tracking · ${fraternalYear}`}
      actions={flagged > 0 ? <Pill tone="red">{flagged} past {BUDGET_WARNING_THRESHOLD_PERCENT}%</Pill> : p ? <Pill tone="outline">{p.status}</Pill> : null}
    >
      {progress.error ? <Notice tone="error">{progress.error}</Notice> : null}
      {!p ? (
        progress.error ? null : <p className="text-sm text-muted">Loading the budget…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {p.status !== 'Approved' ? (
            <Notice tone="info">
              The {fraternalYear} budget has not been approved and finalized yet ({p.status.toLowerCase()}), so there are no caps to track against. Spend so far:{' '}
              {formatMoney(p.actualTotal)}.
            </Notice>
          ) : (
            <>
              <div className="rounded border-2 border-navy bg-white p-3">
                <BudgetGauge label="Whole budget" approved={p.approvedTotal} actual={p.actualTotal} percentUsed={p.utilizationPercent} alert={p.alert} />
              </div>
              {active.length === 0 ? (
                <Empty>No category has an approved cap or any spend yet.</Empty>
              ) : (
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Budget categories">
                  {active.map((c) => (
                    <li key={c.categoryId ?? 'uncategorized'}>
                      <BudgetGauge label={c.label} approved={c.approved} actual={c.actual} percentUsed={c.percentUsed} alert={c.alert} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-xs">
            <span>
              Unbudgeted spend: <span className="font-bold">{formatMoney(p.unbudgetedActual)}</span>{' '}
              {p.unbudgetedActual > 0 ? <BudgetAlertTag alert="Unbudgeted" /> : null}
              {p.miscellaneousActual > 0 ? (
                <span className="text-muted"> · {formatMoney(p.miscellaneousActual)} routed to Miscellaneous Others</span>
              ) : null}
            </span>
            <span className="text-muted">
              {formatFullDate(p.fromDate)} to {formatFullDate(p.throughDate)} · {formatPercent(p.utilizationPercent)} of the approved budget used
            </span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function NoShowAudit({ councilId }: { councilId: number }) {
  const audit = useLoad(() => db.reports.listNoShowsAudit(councilId), [councilId]);
  const rows = audit.data ?? [];
  const unexplained = rows.filter((r) => r.reason === null).length;
  return (
    <Panel
      title={`No-show audit: last ${NO_SHOW_AUDIT_MONTHS} months (${rows.length})`}
      actions={unexplained > 0 ? <Pill tone="red">{unexplained} without a reason</Pill> : null}
    >
      {audit.error ? <Notice tone="error">{audit.error}</Notice> : null}
      {audit.data && rows.length === 0 ? <Empty>No no-shows recorded in the last {NO_SHOW_AUDIT_MONTHS} months.</Empty> : null}
      {rows.length > 0 ? (
        <div className="max-h-[28rem] overflow-y-auto">
          <Table caption="No-shows in the trailing six months" head={['Member', 'Member #', 'Shift date', 'Event', 'Shift', 'Reason']}>
            {rows.map((r) => (
              <tr key={r.signup.id}>
                <Td className="font-bold">{formatPersonName(r.firstName, r.lastName)}</Td>
                <Td>{r.memberNumber}</Td>
                <Td className="whitespace-nowrap">{formatFullDate(r.shift.ShiftDate)}</Td>
                <Td>{r.event.EventName}</Td>
                <Td>
                  {r.shift.ShiftName}
                  <span className="block text-xs text-muted">Shift #{r.shift.id}</span>
                </Td>
                <Td>
                  {r.reason ? (
                    <>
                      <Pill tone="outline">{r.reason.NoShowReasonCode}</Pill> {r.reason.NoShowReasonDescription}
                    </>
                  ) : (
                    <Pill tone="red">No reason provided</Pill>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      ) : null}
    </Panel>
  );
}

/** The id of the full roadmap drawer (the ribbon's "Full roadmap" opens it and scrolls to it). */
const SUMMARY_ROADMAP_ID = 'executive-summary-roadmap';

/**
 * Sprint 10 Revision 1.0: one compact drawer of the Executive Dashboard - a closed navy-edged row naming its panel,
 * opened in place. The body mounts only while the drawer is open, so a closed drawer reads no data.
 */
function DashboardDrawer({ id, title, summary, children }: { id?: string; title: string; summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details id={id} className="group scroll-mt-2 rounded border-2 border-navy bg-white" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center gap-3 border-l-8 border-gold px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="font-bold text-navy motion-safe:transition-transform group-open:rotate-90">
          ›
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-serif text-lg font-bold leading-tight">{title}</span>
          <span className="text-xs text-muted">{summary}</span>
        </span>
      </summary>
      {open ? <div className="border-t border-line p-4">{children}</div> : null}
    </details>
  );
}

/** Opens the roadmap drawer and scrolls to it. */
const openRoadmapDrawer = () => {
  const drawer = document.getElementById(SUMMARY_ROADMAP_ID);
  if (drawer instanceof HTMLDetailsElement) drawer.open = true;
  drawer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function ExecutiveDashboard() {
  const user = useUser();
  const scope = useCouncilScope();
  // Sprint 8E Extension: the Council Historian reads the summary too, as every reader of the dashboard area does.
  const cleared = isAdmin(user) || canViewExecutiveDashboard(user, scope.councilId) || canOpenHistorianDesk(user, scope.councilId);
  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Executive Dashboard</PageTitle>
      {cleared ? (
        <div className="flex flex-col gap-4">
          <RoadmapRibbon
            user={user}
            councilId={scope.councilId}
            fullLink={
              <button
                type="button"
                className="font-bold underline"
                onClick={openRoadmapDrawer}
              >
                Full roadmap ↓
              </button>
            }
          />
          <ExecutiveSummary councilId={scope.councilId} />
        </div>
      ) : (
        <Notice tone="info">The Executive Summary is for the council&apos;s officers, Council Historian and Admins. Your desk is on the Active Desks row.</Notice>
      )}
    </>
  );
}

/** The Executive Summary (Sprints 5Z-2.5 to 7G), on its own page since Sprint 8D/8E. */
function ExecutiveSummary({ councilId }: { councilId: number }) {
  const user = useUser();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const summary = useLoad(() => db.reports.monthlySummary(councilId, year, month), [councilId, year, month]);
  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() + 1 - i);
  const s = summary.data;
  const fraternalYear = currentFraternalYear(new Date(year, month - 1, 1));

  return (
    <section aria-labelledby="executive-summary-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-2">
        <h2 id="executive-summary-title" className="font-serif text-2xl font-bold">
          Executive Summary: {MONTHS[month - 1]} {year}
        </h2>
        <div className="flex items-end gap-3">
          <Field label="Month" className="w-40">
            {(id) => (
              <Select id={id} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Year" className="w-28">
            {(id) => (
              <Select id={id} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </div>
      {summary.error ? <Notice tone="error">{summary.error}</Notice> : null}
      {!s ? (
        <p className="text-sm text-muted">Loading the month…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Scorecards s={s} compact />
          <EngagementCards councilId={councilId} year={year} month={month} monthLabel={`${MONTHS[month - 1]} ${year}`} summary={s} showLeaderboard={false} />
          {/* Sprint 11 Revision 2.0: Faith in Action right under Monthly Activity, then Budget Tracking. */}
          {canReviewBudgetPerformance(user, councilId) ? (
            <>
              <DashboardDrawer title="Faith in Action Mission Tracking" summary="This fraternal year's service across the four Supreme mission areas">
                <MissionTracking actorId={user.memberId} councilId={councilId} fraternalYear={fraternalYear} />
              </DashboardDrawer>
              <BudgetTracking actorId={user.memberId} councilId={councilId} fraternalYear={fraternalYear} />
            </>
          ) : null}
          {/* Sprint 10 Revision 1.0: the compact drawers, stacked under the primary metrics. */}
          <div className="flex flex-col gap-2" aria-label="Executive Dashboard drawers" role="group">
            <DashboardDrawer id={SUMMARY_ROADMAP_ID} title="Annual Fraternal Roadmap" summary="Nominations, elections, the July 1 term and the Three-Signature Expense Flow">
              <FraternalRoadmap user={user} councilId={councilId} />
            </DashboardDrawer>
            {canReadCouncilGoals(user, councilId) ? (
              <>
                <DashboardDrawer title="Annual Council Goals Progress Center" summary="Progress wheels for this fraternal year's council goals">
                  <GoalsProgressCenter user={user} councilId={councilId} fraternalYear={fraternalYear} />
                </DashboardDrawer>
                <DashboardDrawer title="Year-over-Year Trends" summary="This fraternal year against the two before it">
                  <YearOverYearTrends user={user} councilId={councilId} />
                </DashboardDrawer>
              </>
            ) : null}
          </div>
          <Panel title={`Monthly highlights (${s.highlights.length})`}>
            {s.highlights.length === 0 ? (
              <Empty>No event this month has highlights recorded. Add them in the post-event ledger.</Empty>
            ) : (
              <ol className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-2" aria-label="Event highlights">
                {s.highlights.map((h) => (
                  <li key={h.eventId} className="rounded border-l-4 border-gold bg-white px-3 py-2 ring-1 ring-line">
                    <p className="font-serif text-base font-bold">{h.eventName}</p>
                    <p className="text-xs text-muted">{formatFullDate(h.startDate)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{h.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          {/* Sprint 11 Revision 2.0: the No-Show Audit sits on the bottom row. */}
          {canViewExecutiveAudits(user, councilId) ? (
            <DashboardDrawer title="No-Show Audits" summary={`Missed shifts in the last ${NO_SHOW_AUDIT_MONTHS} months and their reasons`}>
              <NoShowAudit councilId={councilId} />
            </DashboardDrawer>
          ) : null}
        </div>
      )}
    </section>
  );
}

export default function ExecutiveDashboardPage() {
  return (
    <RequireArea area="dashboard">
      <ExecutiveDashboard />
    </RequireArea>
  );
}
