'use client';
// The Active Desks hub. Until Sprint 8D/8E this page also carried the Executive Summaries: one council's month at a glance from reports.monthlySummary. Four stat tiles (labor
// hours, unique Knights, net balance, outreach), the ledger figures behind the balance as a table, and the
// month's event highlights as a scrollable feed. Open to the council's Admins, every officer of the council - Grand
// Knight, Deputy Grand Knight, Financial Secretary, Treasurer, Recorder, Trustees and the other seated officers
// (canViewExecutiveDashboard, Sprint 5Z-2.5) - and any Super Admin (who may pick the council).
//
// Under the month, the same readers (canViewExecutiveAudits) also get two personnel audits:
// every no-show of the trailing NO_SHOW_AUDIT_MONTHS (reports.listNoShowsAudit, with or without a reason), and every
// past signup still waiting for hours (reports.listShiftsAwaitingHours), flagged once the day-5 reminder is due.
//
// Beside the scorecards (Sprint 5Y-4), the same readers (canReviewBudgetPerformance) get budget tracking gauges for the
// fraternal year of the chosen month (budget.getBudgetProgress): each budget category's actual spend so far - events,
// approved and reimbursed expenses, and charity checks - against its ApprovedBudgetAmount cap, flagged from 85%.
//
// Above them (Sprint 5Z-2) the same readers get the Faith-in-Action Mission Tracking card (reports.missionAreaFootprint):
// the fraternal year's donations and volunteer service hours by mission area (Faith, Family, Community, Life).
//
// Under the scorecards (Sprint 7A) every reader gets the engagement row (EngagementParts): the high-contrast monthly
// activity overview - volunteers, cash collected and who served - and the gold-bordered Top 5 Volunteers Leaderboard.
//
// At the top (Sprint 7B) the council's Grand Knight, Deputy Grand Knight and Admins, and any Super Admin
// (canReviewVolunteerQuarantine), get the Volunteer Time Quarantine Desk while feature_volunteer_quarantine is on.
//
// Above it (Sprint 7F) Super Admins get the Inbound Council Mail Center: the access requests councils file from the
// sign-in page (/api/access-requests), each with an Approve button.
//
// Under the desks (Sprint 7G) every reader gets the Annual Fraternal Roadmap (RoadmapParts): Nominations, Elections and
// the July 10 Budget Lock for the council's current cycle, with overdue steps pushed to council leadership, and the
// Three-Signature Expense Flow tree with the live count waiting at each signature.
//
// Sprint 7J: the page is a tabbed cockpit (officer-desks.ts dashboardTabsFor). Home leads with four widgets for every
// reader - the Bible Verse of the Day, the Live Actionable Reminders Stream, the Liturgical Feast Day Tracker and
// Today's Event Agenda (DashboardDesks) - and keeps the whole Executive Summary under them. Beside it, each reader gets
// the Officer Desks their seat clears: the Grand Knight Desk (Voucher Release queue), the Financial Secretary Desk
// (written orders, Excel roster imports and the inactivity sweep), the Treasurer Desk (Ledger Line Coder queue) and the
// Member Desk. Each tab has a URL anchor (/dashboard#treasurer), and the last tab opened is remembered in this browser.
// The left sidebar is unchanged and still reaches every desk page.
//
// Sprint 7J Extension 2: the tab row moved into the portal frame (WorkspaceTabs in Shell.tsx), so it stays under the
// header on every page; this page only renders the tab the anchor (or this browser's last tab) names.
//
// Sprint 8A: Home is a no-scroll cockpit. It holds only the single-line roadmap ribbon (RoadmapRibbon), the desk status
// badges (DeskStatusBadges: '[ 📋 3 Vouchers Pending ]', '[ ⚠️ 2 Items Quarantined ]', each opening its Active Desk), the
// month's four stat tiles in compact form and the four fixed-height widgets. Every queue, form and list left Home: the
// Volunteer Time Quarantine Desk and the Inbound Council Mail Center live on the Oversight Desk, and the full Executive
// Summary - month picker, roadmap card, budget and mission tracking, ledger, highlights and personnel audits - on the
// Reports Desk. The inactivity sweep lives on System Settings > Council Wide Settings.
//
// Sprint 8B: the Recorder Desk (Meeting Minutes Entry Desk and the Start Live Meeting Sequence launch) and the Historian
// Desk (Digital Fraternal Annals Scrapbook), each for its seat, the council's Admins and Super Admins. A Council
// Historian without an officer seat opens this page for the Historian Desk alone (no Home or Reports Desk).
//
// Sprint 8C: the Reports Desk is dismantled and the Executive Summary merges into Home, the Executive Dashboard's own
// canvas: under the ribbon, the click-through badges and the four widgets, the month's charts, ledger table, budget and
// mission tracking and the no-show audit sit in a frame that scrolls inside itself, so Home still fits one screen. The
// month's stat tiles open that frame. The Shifts Awaiting Hours audit moved to the Oversight Desk. The sidebar's Executive
// Dashboard link always lands here on Home.
//
// Sprint 8D/8E: Home holds only the universal cards (HOME_UNIVERSAL_CARDS) - the Bible Verse of the Day, the Live
// Actionable Reminders, the Liturgical Feast Day Tracker, Today's Event Agenda, the Open Volunteer Shifts signup grid and
// the Top 5 Fraternal Volunteers leaderboard of the month - in one screen with no scrolling. The roadmap ribbon and the
// Executive Summary moved to their own page, /executive-dashboard (the sidebar's Executive Dashboard link), and the
// desk status badges to the top of the Oversight Desk.
//
// Sprint 8O: the Super Admin Desk (SuperAdminDesk) - the platform owner's own cockpit, a tab only their personal session
// is given (super-admin-desk.ts isPlatformOwner): the Feedback Communication Center, the Council Access Request Approval
// Queue and the System Feature Flag Control Panel.
import { dashboardTabsFor, isFraternalTenant } from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import {
  FinancialSecretaryDesk,
  GrandKnightDesk,
  HistorianDesk,
  HomeWidgets,
  MemberDesk,
  OversightDesk,
  RecorderDesk,
  TreasurerDesk,
} from '@/components/DashboardDesks';
import { SuperAdminDesk } from '@/components/SuperAdminDesk';
import { useDashboardTab } from '@/components/WorkspaceTabs';
import { PageTitle } from '@/components/ui';
import { useFeatureFlags, useTenantType, useUser } from '@/lib/session';

/**
 * The Home desk (Sprint 8A, Sprint 8D/8E): one screen, no page scroll - only the universal cards. All the work sits one
 * click away on its Active Desk, and the Executive Summary on the Executive Dashboard page.
 */
function HomeDesk({ councilId, faithOn }: { councilId: number; faithOn: boolean }) {
  const user = useUser();
  return <HomeWidgets user={user} councilId={councilId} faithOn={faithOn} />;
}

function Dashboard() {
  const user = useUser();
  const flags = useFeatureFlags();
  const tenantType = useTenantType();
  const scope = useCouncilScope();
  const tabs = dashboardTabsFor(user, scope.councilId);
  // Sprint 7J Extension 2: the tab row lives in the portal frame (WorkspaceTabs); the page shows the tab it opened.
  const shown = useDashboardTab(tabs);
  // The verse and the feast tracker are Faith Center content, a Knights of Columbus extension.
  const faithOn = flags.feature_faith_center && isFraternalTenant(tenantType);

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>{tabs.find((t) => t.id === shown)?.label ?? 'Home'}</PageTitle>
      <div id="dashboard-panel" aria-label={tabs.find((t) => t.id === shown)?.label ?? 'Home'}>
        {shown === 'home' ? (
          <HomeDesk councilId={scope.councilId} faithOn={faithOn} />
        ) : shown === 'grand-knight' ? (
          <GrandKnightDesk user={user} councilId={scope.councilId} />
        ) : shown === 'financial-secretary' ? (
          <FinancialSecretaryDesk user={user} councilId={scope.councilId} />
        ) : shown === 'treasurer' ? (
          <TreasurerDesk user={user} councilId={scope.councilId} />
        ) : shown === 'recorder' ? (
          <RecorderDesk user={user} councilId={scope.councilId} />
        ) : shown === 'historian' ? (
          <HistorianDesk user={user} councilId={scope.councilId} />
        ) : shown === 'oversight' ? (
          <OversightDesk user={user} councilId={scope.councilId} />
        ) : shown === 'super-admin' ? (
          <SuperAdminDesk user={user} />
        ) : (
          <MemberDesk user={user} />
        )}
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <RequireArea area="dashboard">
      <Dashboard />
    </RequireArea>
  );
}
