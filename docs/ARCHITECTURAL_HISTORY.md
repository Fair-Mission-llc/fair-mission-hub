# Architectural History

Knights of Columbus Event Tracking and Fraternal Management Platform. Written at Sprint 7D, 2026-10-11, at schema version 63.

This document records what the platform is, how it got here, and the rules that shape its money and tenant handling. Every statement below comes from the repository: the code, `Schema.sql`, `data_dictionary.md`, the schema changelog in `apps/mobile/services/drivers/sqlite.ts`, and the Git history. Where the repository has no record (for example, a Phase 7 roadmap), this document says so and does not invent one.

When this document and the code disagree, the code wins. The authoritative sources are listed in [Section 9](#9-where-the-truth-lives).

---

## 1. Product vision

### 1.1 The original brief

`Specifications.txt` is the first statement of intent. It asks for one application that many Knights of Columbus councils use to:

- schedule events, shifts, meetings and ongoing activities;
- let members sign up for shifts in their own and affiliated councils;
- let members record time against shifts and activities;
- send messages and keep distribution lists;
- keep a lessons-learned knowledge base from past events.

It names three user types: **Super Admin** (all councils, plus the lookup tables), **Admin** (their own council) and **Member**. It asks for iPhone, Android and web, on React Native, Expo and Azure SQL Server (T-SQL), with Next.js for the denser desktop layouts.

### 1.2 What it grew into

Over roughly three weeks of sprints (2026-09-20 to 2026-10-10, 144 commits), the platform grew from a volunteer-hours tracker into a council operating system. The main areas today:

| Area | What it holds |
|---|---|
| Service and volunteering | Events, shifts (including All-Hands shifts), activities, rapid-tap hour logging, volunteer quarantine desk, planning hours |
| Meetings and governance | Meeting types, agenda templates, parliamentary cadence, proposed motions, live meeting console, check-ins, secret ballots, hand-vote tallies, bylaws vault, Constitutional Advisor, officer elections |
| Money | Annual budget forecast with versions, double-entry general ledger, three-signature expense approval, check disbursements, Trustee semiannual audit, assets inventory, dues forecast, revenue logging |
| Charity | Charitable request intake, vetting desk with threads, council vote, charitable disbursements |
| Members | Roster with lifecycle hooks, onboarding setup codes, password reset, biometric sign-in, multi-council affiliation log, Member Center, devotionals |
| Heritage and faith | Council history annals, spiritual diary, oral-history recordings, In Memoriam roll, liturgical calendar, prayer intentions |
| Communications | Messaging, private and council-wide distribution lists, push alerts, per-council SMTP gateway, Marketing Factory flyers |
| Platform | Feature flags, council-wide settings, platform limits, global system parameters, credentials vault, multi-tenant white-label gate |

### 1.3 Multi-tenant model

The platform is multi-tenant at two levels:

1. **Council tenancy.** Every council's data is isolated. Admins and officers act only inside their own council; Super Admins act across all councils. The rules live in `packages/shared/src/rules.ts` and `packages/shared/src/permissions.ts` and are enforced in both data drivers.
2. **Organization tenancy (white label).** Since schema 39, `Council.tenant_type` says what kind of organization a tenant is. `KOFC` keeps all Knights of Columbus extensions. `GENERIC` is a neutral community organization. See [Section 5](#5-white-label-terminology-guards).

### 1.4 Design guardrails

- **Brand palette is locked.** Navy `#002855`, red `#C8102E`, gold `#D6A420`, white background. `tests/web-theme.test.ts` fails the build if a page uses colors outside the tokens. There is no green.
- **Plain English.** User guides and SOPs are written in Simplified Technical English (the local `technical-writer` skill). Button labels were moved to plain words in Sprint 7C.
- **Seven pillars.** Since Sprint 6Z the web sidebar is organized into seven always-open pillars. The phone app's screens were frozen at that point; later sprints change them only where a feature needs it.

---

## 2. Technical architecture

### 2.1 Monorepo layout

```
kofc-tracking-platform/
├── packages/shared/   DataService contract, business rules, permissions, workflow engine, pure helpers
├── apps/web/          Next.js App Router portal (in-memory MemoryDataService driver, plus server routes)
├── apps/mobile/       Expo Router phone app (expo-sqlite driver)
├── tests/             Vitest suite run against both drivers
├── Schema.sql         T-SQL schema for Azure SQL Server (the target production database)
├── Seed.sql           Baseline lookups plus the @presentation-data demo set
└── docs/              User guides, SOPs, role matrix, this document
```

### 2.2 The data-service abstraction

All reads and writes go through one `DataService` contract in `packages/shared`. Two drivers implement it today:

- **Memory driver** (web): in-browser arrays, seeded from the same data as `Seed.sql`.
- **SQLite driver** (phone): `apps/mobile/services/drivers/sqlite.ts`, a 1:1 translation of `Schema.sql`.

The production plan (`migration_checksheet.md`) swaps these for Azure SQL: the web gets a real SQL client, and the phone calls Next.js API routes instead of a local database. That migration has **not** been done.

### 2.3 Rules and the workflow engine

- **Business rules** are pure functions in `packages/shared/src/` that throw `BusinessRuleError` with a stable code (for example `SELF_APPROVAL_BLOCKED`, `TREASURER_REQUIRED`, `FRATERNAL_EXTENSION_REQUIRED`). Both drivers call the same rules, so the web and the phone behave the same.
- **Workflow engine** (`packages/shared/src/workflow.ts`, Sprint 6Z-Engine-Upgrade). `defineWorkflow` declares states and legal transitions; `nextWorkflowState` refuses illegal jumps. Defined workflows: `EXPENSE_WORKFLOW`, `ONBOARDING_WORKFLOW`, `EVENT_PHASE_WORKFLOW`, `INTAKE_SESSION_WORKFLOW`, `BUDGET_LINE_WORKFLOW`, `FEATURE_GATE_WORKFLOW`, `TENANT_GATE_WORKFLOW`.

### 2.4 Server side

`apps/web/services/server/` holds HMAC-signed HttpOnly cookie sessions (`kofc_portal_session`) that gate the server routes: Google Drive vault, Supreme (Alchemer) sync, roster import, outbound email, receipt OCR, and the credentials vault. Server secrets are read only through `secrets.ts`. Per-council secrets (SMTP password, Drive key, OCR keys) live in `CouncilCredentialsVault`, which only the web server reads.

Known limit: the server's member copy is seeded separately from the browser's in-memory copy, so a member who exists only in a browser tab gets no server session.

### 2.5 Schema versioning

`SCHEMA_VERSION` in `apps/mobile/services/drivers/sqlite.ts` is stored in SQLite's `PRAGMA user_version`. When it rises, the phone rebuilds its local database from scratch. There are no incremental migrations yet; the code comment says "Migrations are a later concern." Columns added after a table's first release are appended to `Schema.sql` with `ALTER TABLE`, in sprint order.

---

## 3. Schema version history (1 to 64)

Taken from the changelog comment above `SCHEMA_VERSION` in `apps/mobile/services/drivers/sqlite.ts`. Version 1 is the original schema from `Specifications.txt` (councils, parishes, pastors, members, events, shifts, meetings, activities, time logs, messages, distribution lists, lessons learned and the lookup tables). **Version 20 was skipped**; the numbering goes from 19 to 21.

| Ver. | Sprint | Change |
|---|---|---|
| 1 | Phase 1 | Original schema |
| 2 | Phase 2 | Donations, member skills, training and working status |
| 3 | 5K | `Donation.RecordedBy` |
| 4 | 5L | `view_NoShows` LEFT JOINs `NoShowReason` |
| 5 | 5P | `SystemFeedback` |
| 6 | 5Q | `Event.PhotoGalleryURL`, `Meeting.GoogleDriveMinutesURL`, `GoogleDriveFlyerURL` |
| 7 | 5Q | `Meeting.OwnerID` |
| 8 | 5R | `ExpenseDisbursement`, `ExpenseReport`, `ExpenseLineItem` |
| 9 | 5R-1.5 | `ExpenseReport.RejectionReason` |
| 10 | 5S | `Member.ProfilePhotoURL`, `Member.Biography` |
| 11 | 5T | `Member.ExpoPushToken`, `NotificationLog`, `SupremeReportingSync` |
| 12 | 5U | `CouncilElectionBallot`, `OfficerNominations`, `CouncilLeadershipHistory`; Priest and Lector renamed Chaplain and Lecturer |
| 13 | 5V | `GlobalCharityRegistry`, `CouncilCharityLink`, `CharityDonationProposal`, `CharitableDisbursementLedger` |
| 14 | 5V-2 | `CharitableDisbursementLedger.ProposalID`, `CharityDonationProposal.RejectionReason` |
| 15 | 5Y | `Event.IsAnnual`, `GlobalCharityRegistry.IsAnnual`, `CouncilBudgetForecast` |
| 16 | 5Y-3 | `CouncilBudgetCategory`, `CouncilBudgetForecast.BudgetCategoryID`, `Member.IsBudgetDirector` |
| 17 | 5Y-4 | `CouncilBudgetForecast.ProposedBudgetAmount`, `BudgetStatus` |
| 18 | 5Y-5 | `CouncilMeetingType`, `CouncilAgendaTemplate`, `MeetingInvites.ResponseStatus`, `Meeting.IsMultiDay`, `MeetingTypeID`, `Event.IsMultiDay` |
| 19 | 5Y-6 | `Meeting.EndDate` |
| 20 | — | Skipped |
| 21 | 5Z-1 | `CouncilRelationshipType`, `CouncilMissionArea`, `CharitableRequest`, `Event.MissionAreaID`, `Meeting.MissionAreaID` |
| 22 | 5Z-2 | `CharitableRequest.MissionAreaID`, `TargetBudgetLineID` |
| 23 | 5Z-3 | `ExpenseReport` FS and GK signature columns (dual approval) |
| 24 | 5Z-5 | `CouncilCadenceConfig`, `ProposedMotion` |
| 25 | 5Z-6 | `Meeting.InviteReleaseDate`, `CouncilCadenceConfig.DefaultRecipientGroup` |
| 26 | 5Z-7 | `GLAccount`, `JournalEntry`, `Event.IntakeSessionStatus` |
| 27 | 5Z-8 | `JournalEntry.TransactionID`, Opening Balance Equity account |
| 28 | 5Z-9 | Live meeting columns on `Meeting`, `ProposedMotion.BallotOpenedAt`, `LiveAttendance`, `BallotVote` |
| 29 | 5Z-10.8 | `DistributionLists.IsCouncilWide` |
| 30 | 6A | Council feature flags (`flag_mobile_elections`, `flag_fundraising_inflow`, `flag_charity_proposals`, `flag_complex_shifts`, `flag_meeting_management`) |
| 31 | 6B | `MeetingAgendaItem`, `MotionHandTally` |
| 32 | 6B Patch | `Meeting.ActiveAgendaLineKey`, `Member.DateJoinedCouncil`, `MemberEnrollmentToken` |
| 33 | 6B Security | `PasswordResetToken`; welcome setup code becomes mandatory |
| 34 | 6C | `Member.flag_large_text_mode` |
| 35 | 6Z | `Council.BylawsMarkdown`, `BylawsUpdatedAt` |
| 36 | 6C (Phase 4) | `Event.GoogleDriveFlyerFileID` |
| 37 | 6Z-Email-Proxy | Council SMTP gateway columns |
| 38 | Phase 4.5 | `Shift.IsAllHands` |
| 39 | 6Z-Dual-Gate-Model | `Council.tenant_type` |
| 40 | 6Y | `CouncilCredentialsVault`; `Council.EmailPasswordEncrypted` dropped |
| 41 | 6A (Phase 5) | `Council.base_dues_rate` |
| 42 | 6D | `CouncilBudgetForecast.quantity`, `unit_cost`, `budget_version` |
| 43 | 6E | `ExpenseReport.is_long_term_asset`, `CouncilAssetsInventory` |
| 44 | 6F | `CouncilBudgetForecast.universal_category`; Council 15295's real 2026-2027 budget seeded |
| 45 | 6G Ext | `ExpenseReport.budget_line_id`, `charity_request_id` |
| 46 | 6H | `CharitableRequestThread`, `CharitableRequestThreadMessage` |
| 47 | 6I | `Event.Budget` and `Event.Spend` dropped |
| 48 | 6K | `CouncilHistoryAnnals`, `CouncilSpiritualDiary` |
| 49 | 6L | Council Historian role seeded |
| 50 | 6M | `CouncilBudgetForecast.target_spending_ceiling` |
| 51 | 6N | `CouncilAudits`, `AuditVerifiedLines` |
| 52 | 6L Ext 3 | `CouncilPrayerIntention`, `CouncilPrayerIntentionPrayer` |
| 53 | 6L Ext 4 | `Category.SupremeMissionArea` for the six fixed categories |
| 54 | 6L Ext 5 | Seventh fixed category (Life); `CouncilInMemoriam`; `Meeting.CategoryID` and `CharitableRequest.CategoryID` withdrawn |
| 55 | 6P | `CouncilLeadershipSnapshot`, asset serial and location, `EventPlanningTime`, `CouncilMediaVault`, `MediaSmartAlbums`; All-Hands target 0 |
| 56 | 6Q | `ExpenseReport.TreasurerMemberID`, `TreasurerReviewedAt`, `general_ledger_account_id`, `LinkedActivityID`; `JournalEntry.LinkedActivityID` |
| 57 | 6R | `Council.ein_number`, six `feature_*` module flags |
| 58 | 6S | `ExpenseReceipts`, personal-exclusion lines, Honorary Expense columns |
| 59 | 7A | `MemberDevotionals`, `Member.flag_charter_member`, rank thresholds |
| 60 | 7A Ext | `MemberCouncilAffiliationLog` |
| 61 | 7B | `VolunteerQuarantine`, `Council.feature_volunteer_quarantine` |
| 62 | 7C | Council-wide settings columns, `PlatformSettings` |
| 63 | 7C Ext | No table change; marks the System Settings and Global System Parameters release |
| 64 | 7E | Timing settings: ten `Council` columns (expense window, logging window, reminder delay and cadence, six saved for future features) and three `PlatformSettings` columns (invitation horizon, session hours, audit retention) |
| 65 | 7F | `CouncilAccessRequests` table, `JournalEntry.payment_method` (CASH/CARD/CHECK, the first CHECK constraint), `CouncilAssetsInventory.photo_url`, a 'Check' donation method; Super Admin read-only impersonation and the Co-Watching Remote Assistance desk (no tables) |
| 66 | 7F Ext | `JournalEntry.payment_method` and its CHECK dropped for `payment_method_id` (FK `DonationMethod`: Cash, Credit Card, Venmo, Zelle, Zeffy, Parishsoft, Check); asset photos saved on the portal server's disk, uploadable by the Deputy Grand Knight and Trustees |
| 67 | 7F Ext 2 | `Donation.CheckNumber` (required for Check donations, phone and web); asset photos back in Google Drive under Assets / <asset name> (disk folder removed); Deputy Grand Knight made a full asset manager; phone Council Assets screen |
| 68 | 7G | `Council.meeting_latitude`, `meeting_longitude`, `meeting_geofence_radius_meters`, `meeting_pin_token` (geofenced phone check-in with a 4-digit PIN bypass, PIN dropped from council reads); `LiveAttendance.photo_url`, `Meeting.photo_url` (Drive Media / Meeting_Photos); Annual Fraternal Roadmap with overdue push alerts and the Three-Signature Expense Flow tree (no tables); `scripts/compile_all_manuals.py` builds both guide PDFs |
| 69 | 7H | No table change. Council 15295 renamed St. Mary's Cathedral Council in `Seed.sql`; the live console welcome reads the council's held elected chairs (`assemblyWelcomeLine`) instead of fixed demo names; `Council.shift_signup_lock_hours` now sets the phone's gate-donation window (replaced `GATE_LEAD_HOURS`); on-demand custom user guides (`customizeManualMarkdown`, `/api/council/compile-manual`, Council Wide Settings buttons); stray root `tsconfig.json` removed. |
| 70 | 7I | No table change. Every St. Jude place renamed St. Mary's Cathedral in the seeds; seven anonymous Conference Room Pilot personas (`*@stmarys.org`, Member 28-34) with expense reports 14-19 waiting at the FS, Treasurer and GK desks, two held time entries and the Parish Parking Event (Event 9); Python runs through `py` on Windows; `scripts/pilot_kit_pdf.py` compiles the fillable pilot scripts and three 11x17 posters; custom guides also kept under `generated/custom_manuals/`. |
| 71 | 7J | No table change. `/dashboard` becomes a tabbed cockpit (`officer-desks.ts`: `dashboardTabsFor`, `dashboardTabFromAnchor`, `buildReminderStream`, `feastDayTracker`, `todaysAgenda`; `components/DashboardDesks.tsx`). Home: Bible Verse of the Day, Live Actionable Reminders, Liturgical Feast Day Tracker, Today's Event Agenda, then the Executive Summary. Officer Desks reuse the full desks' gates: Grand Knight (`canOpenExpenseAuthorizeDesk`, Voucher Release queue), Financial Secretary (`canOpenExpenseAuditDesk`, written orders + Excel roster import + inactivity sweep), Treasurer (`canOpenTreasurerDesk`, Ledger Line Coder queue), Member (everyone). URL anchors `/dashboard#<desk>`; last tab in browser storage only. Sidebar unchanged. |
| 72 | 7J Ext 2 | No table change. The Home / Officer Desk tab row moves from `/dashboard` into the portal frame (`components/WorkspaceTabs.tsx`, rendered by `Shell.tsx` under the header, sticky) for readers with the `dashboard` area; tabs link to `/dashboard#<anchor>` and `useDashboardTab` picks the open tab. `app/page.tsx` redirects `/` to `/dashboard` (or `/member-actions` when the seat lacks the `dashboard` area). |
| 73 | 8A | No table change. The frame tab row is titled **Active Desks** (`ACTIVE_DESKS_TITLE`) and drawn as navy-outlined folder tabs with a gold top on the open one; `DeskLink` jumps to `/dashboard#<anchor>`. Home is a no-scroll cockpit: `RoadmapRibbon` (one-line roadmap), `DeskStatusBadges` (counts linking to each desk), compact stat tiles, four fixed-height widgets. New desks: **Oversight** (`canReviewVolunteerQuarantine`; Quarantine Desk, plus the Inbound Council Mail Center for Super Admins) and **Reports** (everyone; the full Executive Summary, roadmap card and audits). Council Wide Settings moved to `/system-settings/council-settings` (area key renamed; `/setup/council-settings` redirects) and is the only home of the inactivity sweep (removed from `/members` and the FS Desk). `landingRouteFor` sends officers and Admins from `/` to `/dashboard` first. |
| 74 | 8B | `Meeting.minutes_text`, `Meeting.minutes_published_at`, `CouncilHistorianBulletin`. Two seat desks (`recorder-historian.ts`): **Recorder Desk** (`canOpenRecorderDesk`; Meeting Minutes Entry Desk with the minutes countdown from `meeting_minutes_due_days`, now in use; `meetings.saveMeetingMinutes`; the Start Live Meeting Sequence button, `meetings.launchLiveMeeting`, which shows the meeting PIN) and **Historian Desk** (`canOpenHistorianDesk`; monthly bulletins, meeting photos via `/api/drive-vault/meeting-photos`, oral histories). A Historian without an officer seat opens `/dashboard` for the Historian and Member desks only. View-as sessions adopt the viewed member's council at once (`impersonationCouncilContext`); `/system-settings/impersonate` is the Super Admin Council → clearance group → person lookup. New codes `RECORDER_REQUIRED`, `HISTORIAN_REQUIRED`. |
| 75 | 8C | No table change. The Shared Member Center is renamed the **Council Dashboard** (web and phone; route `/member-center` kept). The Reports Desk tab is gone: the Executive Summary merges into Home in a self-scrolling frame, and the sidebar's Executive Dashboard link (`EXECUTIVE_DASHBOARD_HOME_HREF`, a `DeskLink`) always resets to Home. The Deputy Grand Knight holds every Grand Knight grant (`GRAND_KNIGHT_AUTHORITY_ROLE_NAMES`, `holdsGrandKnightAuthority`, `holdsGrandKnightSeat`): counter-signature and authorization desk, appointments, fraternal-year conclusion, agenda templates, cadence, bylaws, live agenda, meeting check-in and PIN, council lookups, base dues rate. `expenses/queue` left the sidebar (`PortalNavItem` excludes it; the page stays an area). Home badges are click-through anchors to desk rows (`DESK_FOCUS_TARGETS`, `DeskRow`); Shifts Awaiting Hours moved to the Oversight Desk (`canOpenOversightDesk` adds every executive-audit reader); the Inbound Council Mail Center stays Super Admin only. Member Desk cards: Open Shifts Needing Volunteers (`memberDeskOpenShifts`, one-click sign-up) and My Charity Requests. Canonization Rank benchmarks are edited only on Council Wide Settings (`RankThresholdsCard`); elsewhere read-only (`RankThresholdsInfo`). |
| 76 | 8D/8E | No table change. Home holds only the universal cards (`HOME_UNIVERSAL_CARDS`): Bible Verse of the Day, Live Actionable Reminders, Liturgical Feast Day Tracker, Today's Event Agenda, Open Volunteer Shifts (one-click sign-up, `useOpenShiftSignup` shared with the Member Desk) and the new **Top 5 Fraternal Volunteers** card - the council's Active members ranked by the current month's hours (`CouncilEngagement.monthlyLeaderboard`, built in `buildCouncilEngagement` beside the all-time `leaderboard`). The desk status badges move to the top of the Oversight Desk. The Executive Summary and the roadmap ribbon leave Home for their own page, `/executive-dashboard` (`EXECUTIVE_DASHBOARD_HREF`, replacing `EXECUTIVE_DASHBOARD_HOME_HREF`); the sidebar hides the link from a Historian-only reader. |
| 77 | 8F | `CouncilGoals` (one row per council and fraternal year: fundraising, new members, hours, rosaries, adorations, confessions targets) and `CouncilAssetsInventory.is_loanable`, `loan_status`, `borrower_name`, `borrower_council`, `expected_return_date`. `council-goals.ts`: `reports.getCouncilGoals` / `setCouncilGoals` (GK/DGK, Admins, Super Admins) and `reports.yearOverYearTrends` over the fiscal months' `monthlySummary`, served by `GET /api/analytics/trends` (`analytics-transport.ts` falls back to the browser driver); readers = general ledger readers. `loaner-library.ts`: `expenses.listLoanerLibrary` (any Active member; no cost, serial, notes or storage place) and `updateAssetLoan` (`planAssetLoanChange`; GK/DGK + Super Admin). Executive Dashboard gains `GoalsProgressCenter` and `YearOverYearTrends` (`components/GoalsParts.tsx`); new area `inventory/loaner-library` in the Resources pillar; `LoanerLibraryManager` on the Grand Knight Desk. Calendar event blocks colour-coded by `Category.SupremeMissionArea` (`MISSION_AREA_COLORS`, `.calendar-mission-*` in globals.css). Presentation seed: St. Mary's 2026-2027 goals and three loanable assets. |
| 78 | 8G/8H | `Council.is_loaner_library_enabled` (INT DEFAULT 0) and `district_number`; `CouncilAffiliations` (PENDING / ACTIVE / DECLINED handshake, `date_established`); `budget_status` (DRAFT / REVIEWED / LOCKED) on `CouncilGoals` and `CouncilBudgetForecast`. `planning-workflow.ts`: Draft May, Review June, goals immutable from July 1 (`COUNCIL_GOALS_LOCKED`, no override), budget vote by July 10 (`BUDGET_VOTE_DEADLINE_PASSED`, Super Admin override); `reports.markCouncilGoalsReviewed`, `budget.markBudgetYearReviewed`; Fraternal Planning & Budgeting Workflow banner on Council Wide Settings. `council-affiliations.ts`: `councils.listAffiliationDirectory` (same State, haversine distance between meeting points, then district), `requestAffiliation` (Admins/GK/DGK), `respondToAffiliation` (target GK/DGK); new area `system-settings/affiliations`; invites on the Grand Knight Desk. Loaner library dual flags: a brother council item shows only to an ACTIVE affiliate with sharing on in both councils (`visibleInLoanerLibrary`). Presentation seed: five neighbouring councils (one in WA), one ACTIVE and two PENDING affiliations, two shared items. |
| 79 | 8I | `CouncilOperationsKnowledge` (entry_id, council_id, category_tag RECRUITING / TREASURY / CLERGY / COMPLIANCE / DEVOTIONAL / LOGISTICS, entry_text, officer_signature, date_logged). `operations-knowledge.ts`: append-only entries, automatic '<name>, <seat>' signature stamp; `history.addOperationsKnowledge` (Admins/GK/DGK, Super Admins) and `history.listOperationsKnowledge` (officers and Admins, Super Admins). High-contrast Global Operations Knowledge Vault card on the Oversight Desk; new area `system-settings/knowledge-archive` with the read-only archive grid filtered by tag, fraternal year and text. Presentation seed: five signed St. Mary's entries across three fraternal years. |
| 80 | 8J | `CouncilOperationsKnowledge.origin_council_stamp` (VARCHAR(255) DEFAULT '', 'Council <number> · <name>' written at save). `history.listOperationsKnowledge(actorId)` now returns every council's entries to any officer/Admin of any council and Super Admins; archive gains the council badge column and the **Filter by My Home Council Only** toggle (Super Admin council picker removed). Vault saves pass the content guard (`KNOWLEDGE_CONTENT_BLOCKED`) and the new deterministic `charter-compliance.ts` gate: ADVISORY rules show the Charter Advisory Warning panel, SEVERE rules disable **Save signed entry** and drivers refuse `CHARTER_VIOLATION_BLOCKED`. No invented Charter section numbers. Presentation seed: two brother-council entries (St. Anthony, Holy Redeemer). |
| 82 | 8L | No table change; phone `SCHEMA_VERSION` 82. Omnipresent Officer Desks: `DESK_MODULES` (officer-desks.ts) mounts nine module folders on the Active Desks (`DeskModule`, cleared by each module's portal area); six page bodies moved to `apps/web/components/modules/`; new `MotionsLedger`, `BudgetVsActualsModule`, `BankStatementMatchWindow`; `EmbeddedModuleContext` drops a mounted module's title to a sub-heading. Home's seventh card, the **📿 Community Prayer Request List**, reads the existing `CouncilPrayerIntention` (no second prayer table). Phone Donate: no auto-picked event/type, empty AMOUNT (standard rate is a hint), gate overlay starts with no amount. Seed: 3 prayer intentions, Member Beta `flag_large_text_mode`, ExpenseReport 20-23, CharitableRequest 6-7. Pilot kit: 30+30 minute session, desk-folder paths, floor vote and charity check in the group flow, large-print Beta pages. |
| 83 | 8M Core | `Council.parish_split_enabled` / `parish_split_percentage` (DECIMAL(5,2) DEFAULT 50.00) / `parish_split_gl_line_id` (FK GLAccount, required while on: `PARISH_SPLIT_GL_LINE_REQUIRED`) and `ParishDisbursementRequest` (PENDING / PAID); phone `SCHEMA_VERSION` 83. parish-split.ts: Parish Fundraiser Revenue Split Console on the Treasurer Desk (event money collections × percentage, less earlier requests), **[ 📋 Issue Church Disbursement Request ]** (Treasurer), Church Disbursement Requests card on the Financial Secretary Desk (check number + Record Payment Made posts debit GL line / credit cash). Parish Fundraiser Split card on Council Wide Settings with the front-end GL-line gate. Seed: GLAccount 16 Parish Fundraiser Share. Phone Donate: no Check tile (`phoneDonationOptions`), $25.00 rate hint, EVENT DESCRIPTION label. Donation sessions stay per member per device (no event lock). |
| 83 | 8M Extension | No table change. `parish_split_gl_line_id` may be a Revenue line (a contra-revenue debit) or an Expense line (`PARISH_SPLIT_LINE_TYPES`); seeded GLAccount 16 Parish Fundraiser Share is now Revenue. Phone Check tile restored. Seed: ExpenseReport 16 fully signed (Approved, waits for the Treasurer's check), Event 9 first-weekend Donations ($250 cash + $150 Venmo). Pilot kit: no individual step waits on another persona (Treasurer pays report 16, new Chapter 2 Parish Revenue Split Console), volunteers take Venmo at $25.00 with no check logging, six group flows (vetting-only Flow 5, Flow 6 Parish Fundraiser Revenue Settlement with check 1404; phone parking collections, floor vote and grant check out of the group), Beta's pages at 1.45x type plus `LARGE_PRINT_SPACING` 1.3. Admin guide section 23; manuals recompiled. |
| 84 | 8N | `Event.collection_status` (OPEN / CONCLUDED / RECONCILED, `EVENT_COLLECTION_WORKFLOW`), its conclusion stamp, `verified_cash_amount` (DECIMAL NULL), `cash_discrepancy_reason` (VARCHAR NULL), the verifier stamp and `cash_over_short_transaction_id`; `Donation.revenue_gl_account_id` / `coding_batch_id` / `coded_by_member_id` / `coded_at`; phone `SCHEMA_VERSION` 84. cash-audit.ts: phone **[ 🛑 Conclude Event Session & Lock Logs ]** (`events.concludeCollectionSession`, any member running the event's intake) locks the logs (`COLLECTION_SESSION_CONCLUDED`); Treasurer Desk opens with the **💵 Cash Box Audit Closure Panel** (variance metrics above the fold, counted cash + reason, Over/Short Reconciliation Line against an auto-created 'Cash Over/Short' Expense line, Donation rows untouched) and the **🧮 High-Volume Batch Transaction Coder** (**[✓ Select All Un-coded Transactions]**, one Revenue drop-down, one balanced posting per batch, `DONATION_ALREADY_CODED`). Seed: rally/picnic/pancake donations stamped with their seeded deposits. Pilot kit: Member Alpha's script ends with the conclude step. Admin guide section 24. |
| 85 | 8O | `CouncilDonationMethod.account_owner_entity` (COUNCIL / PARISH / THIRD_PARTY, named CHECK, required on every editor save) and `ParishDisbursementRequest.settlement_method` (CHECK / PARISH_HELD); phone `SCHEMA_VERSION` 85. account-ownership.ts + parish-split.ts: electronic donations through a PARISH-owned method are Revenue Held by Parish - the split console shows the **Revenue Held by Parish Settlement Notice** in place of the check steps and **[ ⛪ Log Parish-Held Settlement Credit ]** stores a PAID tracking credit with no posting; the batch coder never codes them. Feedback form off the Online Help Center, onto System Settings > **Administrative Feedback Loops** (Admins and higher, `ADMIN_REQUIRED`). **Super Admin Desk** tab for the platform owner's own account only (`isPlatformOwner`): Feedback Communication Center, Council Access Request Approval Queue, System Feature Flag Control Panel. Admin guide section 25. |
| 86 | 8O Ext | `Donation.historical_account_owner_entity` (named CHECK, DEFAULT 'COUNCIL'): the payment method's owner frozen when `donations.record` writes the row (re-stamped only when an edit changes the method); phone `SCHEMA_VERSION` 86. The split console and the batch coder read the snapshot (`donationAccountOwner`), never the live lookup. `PLATFORM_OWNER_USERNAMES` adds the developer's local sign-in `tim`. Admin guide 25.1/25.2. |
| 87 | 8P Stage 1 | No table change; phone `SCHEMA_VERSION` 87. global-search.ts: header **global search bar** (`GlobalSearch.tsx`) over the reader's role-filtered pages (`navigationGuide`), the council's events (`events.listByCouncil`, opening /events for planners, else /calendar) and, for roster readers, active members (/members), plus the Online Help Center and Interactive Help Desk links carrying `?q=`. Sign-in access request button is the understated **[ 🔑 Request Access ]** link (`ACCESS_REQUEST_LINK_LABEL`) on web and phone. Home cards: no fixed height or inner scroll (`min-h-80`, two across, three on 2xl with faith cards), page scrolls; desk inner scroll lists opened out. |
| 88 | 8P Stage 2 | No table change; phone `SCHEMA_VERSION` 88. desk-drawers.ts: GK and FS Desks are **desk blotters** of slide-out drawers (`DESK_DRAWERS`, `deskDrawersFor`, components/DeskDrawers.tsx) replacing the 8L folders and queue grids there; the bodies of /expenses/authorize, /expenses/audit, /expenses/queue, /donations, /elections and /system-settings/knowledge-archive moved to components/modules. **Alert Boundary Accent** (`gkSignatureAlert`, `fsPaymentRequestAlert`, 30-second poll, `animate-alert-boundary`). **[ 🔀 Back to Desk Blotter ]** at each drawer foot and in the frame after a deep traverse (sessionStorage `kofc.deskReturn`). Phone password prompt **[ 🔘 Enable FaceID / Biometric Login ]** (`BiometricLogin.enrollAfterScan`, `submitPassword(..., { enableBiometric })`). Admin guide 19.3.2, 19.5, 19.6; member guide 2.4.1. |
| 89 | 8P Stage 3 | No table change; phone `SCHEMA_VERSION` 89. Every officer desk is a drawer blotter (`DESK_DRAWERS` for five desks, `DrawerDeskId`); the 8L `<details>` folders (`DeskModule`, `DeskModuleShelf`) are removed. Treasurer: Ledger Line Coder, **Expense Report (ER) Settlement**, **Charitable Contribution Matches** (`treasurerCodingAlert`, `erSettlementAlert`, pending-check count), Planning & Budgeting, cash box, batch coder, budget grid, bank match, parish split; /finance/treasurer-desk and /expenses/disbursements bodies moved to components/modules. Recorder: featured **Historical Meeting Minutes Archive** (`minutesArchiveRows`, published text or minutes file) spanning the top row, minutes entry (alert when due/overdue), live launch, motions ledger. Historian: **Fraternal Diary Entry Logs** reader (`diaryLogRows`), bulletins, photos, oral histories, gallery. **Oversight Desk tab dissolved** (`canOpenOversightDesk` removed): Flagged Hours Review, Shifts Awaiting Hours and the Inbound Council Mail Center are GK drawers with alerts; `DeskStatusBadges` removed; `DESK_FOCUS_TARGETS` quarantine/access/hours anchor to `grand-knight`; Shifts Awaiting Hours also on /executive-dashboard. Lexicon: Global Operations Knowledge Vault → **Operations Knowledge Archive** (`KnowledgeArchiveParts.tsx`, `OperationsKnowledgeArchiveEntryForm`, `OPERATIONS_KNOWLEDGE_ARCHIVE_TITLE`); entry form sits in the archive drawer. Member Desk: shift trackers side by side at the top, no drawers. Admin guide 19.2-19.12, new 19.10.1 and 19.12.1, section 22 renamed. |
| 90 | 8Q | `Council.biometric_login_enabled` (DEFAULT 1); `CouncilHistorianBulletin.headline` and `body_format` ('STRUCTURED' / 'PLAIN'); phone `SCHEMA_VERSION` 90. Lexicon: Honor Voucher → **Honorary Expense** everywhere (`HONORARY_EXPENSE_BADGE`, `isHonoraryExpenseSheet`, `ExpenseReportDetail.honoraryExpense`, `HonoraryExpenseBadge`; tests/multi-receipt-honorary-expense.test.ts). Council Wide Settings split into two accordion buckets (`COUNCIL_SETTINGS_BUCKETS`, `SettingsBucket`): **🔧 Operational Configuration** (every settings card, Payment & Account Settings links, the **Council Feature Deployment Matrix**: `councilFeatureDeployment`, '🟢 DEPLOYED' / '⚪ AVAILABLE / OFF', `councils.setBiometricLoginEnabled`) and **📋 System Information** (Council Instance Record with `PLATFORM_SCHEMA_VERSION`, Reference Archives, Custom User Guides). The phone honours the council switch (`councilAllowsBiometric`, reason `councilOff`). Structured newsletters (`parseBulletinBlocks`, `cleanBulletinLayout`, headline + layout + preview on the Historian Desk) and the **[ 📰 Latest Council Newsletters & Bulletins ]** feed (`history.listBulletinFeed`, `LatestBulletinsFeed`) leading Home and Member Actions. Admin guide 16.2.1, 16.2.2, 16.4.1, 19.2, 19.4, 19.12; member guide 2.4, 9.8. |
| 91 | 8R | No table change; phone `SCHEMA_VERSION` 91. **Universal Home landing**: `landingRouteFor` always returns `HOME_LANDING_ROUTE` ('/dashboard'); the `member-actions` portal area became `home` (route /dashboard) for every member, `dashboardTabsFor` gives everyone Home, the Active Desks row shows for every member. /member-actions deleted; its tabs are Home's **🙋 Volunteer Check-In & Service Center** (`VolunteerCenter`, `/dashboard#volunteer-center`) under the bulletin feed. Admin guide part 2 is a **Left navigation map** of collapsible `<details>` blocks (overview open; Dashboard, Calendars, Rosters, Vetting, Ledgers, Archives, Settings closed, then the desks and the phone tabs); member guide 1.4 likewise; admin_guide_pdf.py prints `<summary>` as bookmarked sub-headings (outline entries start closed). Root `tsconfig.json` (Expo stub) ignored by git and tolerated by tests/tech-debt-custom-manuals.test.ts. **8R Corrected** (still 91): Home purely informational (`HOME_UNIVERSAL_CARDS` = feed, verse, feast tracker, today's agenda, Top 5; `OpenShiftsHomeCard` removed); `VolunteerCenter`, reminders and the prayer card on the restored Member Desk (`MEMBER_DESK_SECTIONS`) under the twin shift trackers; navigation-map.ts `navigationGuideMap` (categories, desks, timings, phone tabs; `summary` vs `full` depth) drives a collapsible /navigation-guide; admin guide 2.5 timed settings map, 2.7-2.8 Navigation Guide, 19.2/19.4/19.8 rewritten. |
| 92 | 8S | No table change; phone `SCHEMA_VERSION` 92. Sidebar **[ 🙋 Member Actions ]** restored right after Home in Faith In Action: the `member-actions` portal area (every member) routes to `/dashboard#member` (`PORTAL_AREA_ROUTES`, `MEMBER_ACTIONS_HREF`), the Member Desk tab; Home's sidebar link is `/dashboard#home` and `isCurrent` reads the URL anchor so only one of the two is marked. Live Actionable Reminders and the Community Prayer Request List back on Home as read-only cards (plain-text reminder titles, no Praying Hands button, no links; `PrayerRequestRow` removed); off the Member Desk (`MEMBER_DESK_SECTIONS`). Admin guide 2.1-2.4, 2.7, 19.2, 19.4, 19.8 and member guide 1.4 and start points updated. |
| 93 | 8S Corrected | No table change; phone `SCHEMA_VERSION` 93. Standalone **/member-actions** page restored (`RequireArea area="member-actions"`, mounts `MemberDesk`: twin shift trackers at equal height, charity requests, open sheets, Volunteer Check-In & Service Center); the sidebar link and `MEMBER_ACTIONS_HREF` point there (the `PORTAL_AREA_ROUTES` override is gone); the Member Desk tab keeps the same grids. **Forced Home logins**: `HOME_LANDING_ROUTE` = `/dashboard#home`; `SessionProvider.signIn` `router.replace(HOME_LANDING_ROUTE)` after every successful sign-in, the root redirect and view-as sessions land there, so the remembered tab never wins. Home prayer list: `PrayerRequestRow` with **[ 🙏 Praying Hands ]** restored (the one button on Home); reminders stay read only. Admin guide 2.1-2.4, 19.2, 19.3, 19.4, 19.8 (retitled for the Member Actions page) and member guide 1.4 updated. |
| 94 | 8S Revision | No table change; phone `SCHEMA_VERSION` 94. **Member Actions Hub**: sidebar label `MEMBER_ACTIONS_NAV_LABEL` = `Member Actions Hub` (no emoji); `/member-actions` renders only `VolunteerCenter` (four tabs) under `MEMBER_ACTIONS_HUB_HEADING` `[ 🙋 Member Actions Hub ]`, the section's own h2 dropped (aria-label kept); `MemberDesk` no longer mounts `VolunteerCenter` and `MEMBER_DESK_SECTIONS` drops it. Expense chips (`expenseStatusBadge`): `Order Issued` → `RECORDED BY FS`, `Ledger Coded` → `CODED BY TREASURER` (accurate labels chosen over the requested `APPROVED BY GK`, which would have claimed a GK signature not yet given). Council Wide Settings: the Fraternal Planning banner moved inside `🔧 Operational Configuration`, so the canvas is only the two accordions. Phone DB guard: `gen-db-assets.mjs` emits `TABLE_COLUMNS`; `SqliteDataService.open()` compares every table's `PRAGMA table_info` and, on an older version or any column disparity, copies the file to `kofc.backup-<timestamp>.db` (`backupDatabaseAsync`), deletes it and rebuilds - fixing the seed INSERT failure on pre-84 `Donation` tables lacking `revenue_gl_account_id` (kept `INTEGER` FK to GLAccount, not VARCHAR). |
| 95 | 8S Revision 2 | No table change; phone `SCHEMA_VERSION` 95. Council Wide Settings held to its two accordions (`SETTINGS_BUCKET_BODY_CLASS` min-w-0 + break-words; `FEATURE_MATRIX_COLUMN_CLASSES` floor widths so the matrix scrolls instead of spilling text vertically; `Panel` header wraps). New `desk-workflows.ts`: `buildExpenseWorkflow` (payment request → ledger coding → GK approval → check, counts per step, the desk's own steps marked), `buildDonationWorkflow` (record → code to revenue → close the cash box), `buildElectionWorkflow` / `electionPhaseOf` (ballot before May 1 → May nominations → June election → July 1 term, mid-year headline). Drawers `er-workflow` **Expense Report (ER) Workflow** and `donation-workflow` **Charitable Donation Workflow** on the FS and Treasurer desks (`FinanceWorkflowParts.tsx`, mounting PaymentRequestDesk / LedgerLineCoder + ExpenseSettlement, ExpenseRoutingTrack, DonationRecords / BatchTransactionCoder + CashBoxAuditPanel), alerts `erWorkflowAlert` and `donationWorkflowAlert`; the Treasurer's three money drawers stay first. GK `election-tracker` → `election-workflow` **[ 🗳️ Council Election Workflow ]** (`modules/ElectionTracker.tsx` → `ElectionWorkflow.tsx`, `CouncilElectionWorkflow`). Shared layout `WorkflowParts.tsx` (`WorkflowActionBar`, `WorkflowStepRow`, `WorkflowWheels`, `stepsWheel`) now also draws the Planning & Budgeting banner. Admin guide 16.2.1, 19.3.2, new 19.3.3, 19.6, 19.7. |
| 96 | 8S Revision 3 | `CharitableRequest.compliance_endorsed_by_member_id` (FK Member) and `compliance_endorsed_at`; phone `SCHEMA_VERSION` 96. **Outgoing charity pipeline** (`charity-pipeline.ts`): the Charitable Donation Workflow drawer (FS, Treasurer and now GK desks, `useCharityPipeline`, `CharityPipelineWorkflow`) tracks money going OUT - **[ 📋 Member Charity Request ]** › **[ ✍️ FS/GK Compliance Endorsement ]** › **[ ⛪ Treasurer Check Settlement ]** (the Charity Check Issuance Console mounted in place); `buildDonationWorkflow` (incoming gifts) removed. `charities.endorseApprovedRequest` (FS, GK, DGK or Super Admin; `CHARITY_ENDORSER_REQUIRED`, `SELF_ENDORSEMENT_BLOCKED`); `payApprovedRequest` now needs the endorsement (`CHARITY_ENDORSEMENT_REQUIRED`) from a different officer (`ENDORSER_PAYOUT_BLOCKED`); `charityPipelineAlert`, gate `charity-endorsement`. No backfill. **Old Business engine** (`old-business.ts`): open `- [ ]` lines of the previous calendar month's published minutes (`oldBusinessItems`, `meetings.listOldBusiness`) show on Home's renamed **[ 📅 Upcoming Event Agenda ]** (next 7 days, `upcomingAgenda`; was Today's Event Agenda) as read-only priorities, and `launchLiveMeeting` writes them once into the unpublished draft under `OLD_BUSINESS_HEADING` (`withOldBusiness`), returning `oldBusiness` + `minutesText`; tick boxes in the launch drawer (`CarriedOldBusiness`) and the minutes editor (`MinutesChecklist`, `setMinutesCheckbox`). Seed: Meeting 2, September Business Meeting, published minutes with the teak furniture and storage room items. Admin guide new 6.8.1 and 19.10.2; 6.9, 19.2, 19.3.2, 19.3.3, 19.4, 19.6, 19.7, 19.11 updated; pilot kit posters. |
| 97 | 8S Revision 4 | No table change; phone `SCHEMA_VERSION` 97. **Session unlock:** `apps/mobile/lib/pocket-gate.ts` removed - sign-in unlocks the phone app and no in-session tap asks for Face ID or a passcode. `components/SwipeToConfirm.tsx` (lifted from the Slide to Log Hours bar) guards Report Hours (every tap queues) and Donate's Conclude & Lock. **Compressed Home** (`mobile-home.ts`, `MOBILE_HOME_SECTIONS`): My Active Shifts first; `Drawer` (ui.tsx) folds PrayerIntentions into `[ 📿 Active Spiritual Intentions Drawer ]` and DevotionalTracker plus today's verse into `[ 📖 Daily Devotional Drawer ]`, both closed by default. |
| 97 | 8S Revision 7 | No table change. **Left Dual-Cabinet Rail** (`desk-drawers.ts` `deskSpineSections`, `DeskBlotter` in `DeskDrawers.tsx`): every officer desk is a 25% left filing spine of flat folder links beside a 75% right Desk Blotter stage (the module mounts in place, no overlay). The spine's top is the Dynamic Priority Float (`PRIORITY_FLOAT_LABEL`, every folder with a lit Alert Boundary, red box); the Financial Secretary and Treasurer Desks (`CABINET_DESKS`) then stack **[ 📥 Inbound Operations ]** and **[ 📤 Outbound Operations ]** (`DeskDrawerSpec.cabinet`); lean desks list folders flat. **Search guard** (`global-search.ts`): `searchGlobal` takes the reader's `areas` mask on every query and drops `GLOBAL_SEARCH_RESTRICTED_PREFIXES` pages (finance, payables, donations, Supreme sync, settings, lookups, credentials, feature flags) the mask does not clear; `/budget` stays open. **Wording:** phone Donate tab reads Collect (route still `donate`; `PHONE_TABS`), its button Start collecting for event; the cadence page and sidebar read Recurring Meetings. Pilot kit: Historian Charter Member step (via the council Admin login), Treasurer `LedgerFlowDiagram` of the Revenue Split lifecycle and inferred-budget training notes. Admin guide 19.3.2 and 26.1 updated. |
| 97 | 8S Revision 8 | No table change. **Council Goals & Targets** folder `[ 📈 Council Goals & Targets ]` on the Grand Knight Desk (`desk-drawers.ts` id `council-goals`, gate `council-goals` = `canReadCouncilGoals`; `CouncilGoalsDrawer`): the Star Council objectives `STAR_COUNCIL_OBJECTIVES` - Membership Intake, Charitable Dollars (funds raised), Volunteer Hours - from `reports.getCouncilGoals` for the current fraternal year. **Launch splash** (`LaunchSplash` in `Shell.tsx`): emblem + `PLATFORM_APP_NAME` 'Fraternal Council Archives', held 1.2 s once per tab. **Sign-in footer** (`LegalFooter.tsx`, `legal-notices.ts`): About (ends 'Engineered by Fair Mission, LLC'), Terms of Service, Privacy Policy, shown in place of the card. Development login hint removed from the sign-in card. **Pilot kit** web-only from a 6:15 PM gavel: Intro 6:15-6:20, Individual 6:20-6:40, Group 6:40-7:20 (flows 9/6/6/4/9/6 min), Exploration 7:20-7:40, Listening 7:40-8:00 (105 min); members report hours on the Member Actions Hub Hour ledger; phone collection steps, the gate-donation matrix row and 'secret smartphone ballot' removed. |
| 97 | 8S Revision 9 | No table change. **Pilot kit** (`scripts/pilot_kit_pdf.py`): in the 6:20-6:40 Individual phase (now labelled mobile and web) Member Alpha and Member Beta work on the phone app again - the Collect tab parking collection set up by hand (Venmo at $25.00; Alpha's $180.00 cash box drop, then Conclude Event Session & Lock Logs), activity hours on the Report tab's tap grid (Alpha 1 h Planning, Beta 2 h Ushering, Slide to Log Hours) and a new expense report from phone Home > My expense reports (Alpha Dollar Tree $12.00, Beta Walgreens $6.49). Officer scripts and the 6:40-7:20 Group phase stay web-only. Facilitator prep clears the two phones; financial and permissions posters carry the phone Collect lines again. |
| 97 | 8S Revision 10 | No table change. **Seated pilot kit** (`scripts/pilot_kit_pdf.py`): each persona stays on his own laptop all session (each browser keeps its own pilot data copy), so the 40-minute Group phase is three flows on seeded records - Flow 1 expense pipeline gate by gate (Alpha files a new report; FS signs 21, Treasurer codes 22, GK releases 23, Treasurer pays 13 with check 1401; 16 min), Flow 2 charity request (Alpha proposes the food bank; DGK claims request 6, Request More Info, Advance to vote, Place on next agenda = Nov 3; 14 min), Flow 3 Flagged Hours Review (Alpha's 7 h held; DGK rejects the seeded 6.5 h entry; 10 min). Old Flows 2-6, the wireless display and the Historian's Admin sign-in/Charter step and report-status step removed; the DGK's individual script decides Beta's entry only. **Seed**: `gen-db-assets.mjs` accepts `UPDATE [T] SET ... WHERE [id] = n`; the presentation seed pre-activates Council 1's parish split (50%, GLAccount 16), so the Treasurer's chapter changes no setting. **Phone**: the Collect Amount box opens filled with the session's standard rate (reverses the Sprint 8L empty-box rule); Beta starts on Alpha's spoken 'Gate open' (no cross-phone link). |
| 97 | 8S Revision 10.1 | No table change. **Viewport snap**: every desk folder click (`DeskDrawers.tsx` `DeskBlotter`, used by all officer desks) calls `snapViewportToTop()` - `window.scrollTo({ top: 0 })`, smooth unless prefers-reduced-motion; a badge click-through focus does not snap. **Council Wide Settings cabinet** (`SettingsCabinet`, `COUNCIL_SETTINGS_CABINET_TABS` replaces `COUNCIL_SETTINGS_BUCKETS`): 25% rail of four flat tabs beside a 75% canvas (tabs stay mounted, hidden) - Standard Bank Accounts (Council Lookups + Credentials Vault links, Council Instance Record), Global Revenue Splits (Parish Fundraiser Split, Annual Budget Planner), User Access & Roster Control (Meeting Check-In, Inactivity Sweep, Rank Benchmarks), System Flags & Toggles (timing/limit cards, Feature Deployment Matrix, Loaner Library Sharing, Feature Flags + Global Parameters links, Reference Archives, Custom Guides). Matrix "where it is switched" names the tab; Admin Guide 16.2.1 rewritten. |
| 97 | 8S Revision 10.2 | No table or app change. **Separate phone tracks** (`scripts/pilot_kit_pdf.py`): Member Alpha alone sets up the Parish Parking Event session, records the Venmo gift and $180 cash box drop and concludes (his Conclude step now names the Slide to Conclude & Lock bar, not the old Yes button). Member Beta's duplicate session setup and 'Gate open' wait are gone; he records one standalone $50.00 Cash gift (type Unsolicited, donor Rita Kowalski) from the Collect tab's payment tiles without starting a session. |
| 97 | 8S Revision 10.6 | No table change. **Pilot timeline** (`packages/shared/src/pilot-timeline.ts`): when the presentation data loads (and on each phone open of a current database), both drivers move the Parish Parking Event, its six shifts, its donations and the shift time held against it by whole weeks (`pilotTimelineOffsetDays`) so the pilot day is 2-8 days after its first Saturday; Seed.sql keeps the October 10-31 design dates. **Ledger Line Coder**: the green inferred-budget label wraps (`flex-wrap`, `whitespace-normal`, `break-words`, `max-w-full`). **Gallery**: header Play slideshow button removed; a saved Smart Album opens as the active filter. **Reference Workflows are read only**: the ER, charity, planning and election drawers mount no module, form or button and their action bar never turns red; the FS/GK endorse button moved to a new working folder, `charity-endorsements` ('FS/GK Compliance Endorsements', GK Desk and FS outbound cabinet, lights and floats). |
| 98 | 9 Revision 3.0 | `VolunteerQuarantine.return_explanation` (the reviewer's reason on a returned time entry; replaces the Revision 1.1 `quarantine_reason` prefix) and `TransactionAttachments` (deposit photos on Check donations - Cash too until 9 Revision 4.0 - `donations.attachDepositPhoto` / `listAttachments`, phone '📸 Attach Deposit Photo' at JPEG quality 0.5). |
| 98 | 9 Revision 4.0 | No table change. **Pilot hub**: `npm run build:pilot` (`NEXT_PUBLIC_DATA_DRIVER=hub`) makes the laptop the one database for a room pilot - `packages/backend/data/central-hub-vault.db`, opened by `SqliteDataService` with the new `sqlite` (node:sqlite file adapter, WAL, synchronous FULL) and `persistent` options (never wiped, reset refused, pilot event not re-anchored on open). Every browser and phone calls `POST /api/sync/replicate` (`hub-sync.ts`: public sign-in methods only before a session; `actorId`-first and self-argument methods must name the signed-in member; view-as reads only; calls serialized); `memberDirectory()` is the vault in hub mode. Check photos upload to `/api/sync/photo`. `npm run hub:archive` moves the vault aside. Next aliases `expo-sqlite`/`expo-crypto`/`expo-secure-store` to Node stand-ins. **Deposit photo**: Check form only (Cash dropped). |

---

## 4. Financial workflows

### 4.1 The three-signature expense approval (FS → Treasurer → GK)

An expense sheet moves through `EXPENSE_WORKFLOW`: **Draft → Submitted → Approved → Reimbursed**. A returned sheet goes back to Draft and its signatures are cleared. Three officers sign a Submitted sheet in order:

1. **Financial Secretary — the order.** `expenses.financialSecretaryAuditOrder`. Desk: `/expenses/audit`. (Sprint 5Z-3, schema 23.)
2. **Treasurer — the ledger coding.** `expenses.treasurerLedgerAudit` picks the budget line and the general-ledger account. Both are mandatory. Desk: `/finance/treasurer-desk`. (Sprint 6Q, schema 56.)
3. **Grand Knight — the authorization.** `grandKnightAuthorizeOrder` moves the sheet to **Approved**. Desk: `/expenses/authorize`.

Then a Financial Secretary or Treasurer records the check (`recordDisbursement`), which moves the sheet to **Reimbursed**.

Controls that apply to all three signatures:

| Control | Rule | Code |
|---|---|---|
| No self-approval | Nobody approves a sheet they submitted, Super Admins included | `SELF_APPROVAL_BLOCKED` |
| No self-payout | Nobody issues the check for their own sheet | `SELF_PAYOUT_BLOCKED` |
| Separation of duties | One person cannot sign two lines; the Treasurer cannot be the FS who issued the order; the GK cannot be the Treasurer who coded it | `DUAL_SIGNATURE_CONFLICT` |
| Treasurer stage required | GK cannot sign before the Treasurer codes the sheet | `TREASURER_REQUIRED` |
| Finance officers pay | Only an Active FS or Treasurer (or Super Admin) records disbursements | `FINANCE_OFFICER_REQUIRED` |
| Privacy | A member sees only their own sheets; another member's id answers "not found" | `RECORD_NOT_FOUND` |

Rule and transition sources: `packages/shared/src/workflow.ts`, `packages/shared/src/treasurer-desk.ts`, `packages/shared/src/rules.ts`.

Sheets approved before Sprint 6Q (FS and GK only) remain payable.

### 4.2 What happens on approval

- **Budget charge.** The engine charges approved and reimbursed spend only to the sheet's `budget_line_id`. Personal-exclusion lines on a split ticket are left out of every council figure.
- **Asset conversion.** A sheet marked `is_long_term_asset` becomes one `CouncilAssetsInventory` row in the same transaction as its move to Approved (`planExpenseAssetConversion`).
- **Catch-all.** An approved charitable request with no target line is charged to the year's "Miscellaneous Others" line, if the council has one.
- **Honorary Expense.** A sheet with no receipt file carries the Honorary Expense badge on every desk and needs a written reason.

### 4.3 The general ledger and the audit

- Double-entry `GLAccount` and `JournalEntry`. Every line of one posting shares a `TransactionID`. Only the FS, the Treasurer or a Super Admin posts; officers and Admins read.
- The **Trustee Semiannual Audit** (`/finance/audit`) covers July–December and January–June. A Trustee ticks every line, then signs; the first signature locks the period, and the ledger then refuses postings dated inside it (`AUDIT_PERIOD_LOCKED`). Form 1295 is generated by `scripts/form_1295_report.py`.
- **Revenue** after a concluded event or activity is posted by the Treasurer with `finance.logConcludedRevenue`.

### 4.4 Budgeting

- Annual budget lines in `CouncilBudgetForecast` (Draft → Proposed → Approved), with quantity × unit-cost lines and immutable approved versions. Mid-year amendments create new versions until June 30.
- A concluded event's budget is its approved Event line; its spend is the line items on Approved and Reimbursed sheets linked to it. `Event.Budget` and `Event.Spend` were dropped in schema 47.
- The dues forecast multiplies `Council.base_dues_rate` by Active and Inactive members. Only the council's Active GK or FS sets it (`setDuesRate`); a Super Admin sets it from Global System Parameters (`setGlobalParameters`).

---

## 5. White-label terminology guards

Source: `packages/shared/src/tenant.ts`, guarded by `TENANT_GATE_WORKFLOW` in `workflow.ts`.

### 5.1 The gate

- `Council.tenant_type` is `KOFC` (default) or `GENERIC`. Blank reads as `KOFC`; any other value reads as `GENERIC`.
- Only a Super Admin changes it, through `councils.setGlobalParameters` on `/system-settings/global-settings`. Other callers get `SUPER_ADMIN_REQUIRED`.
- `FRATERNAL_AREAS` are removed for a `GENERIC` tenant: `supreme-sync`, `governance/advisor` and `faith-center`. The drivers reject the `supreme.*` operations with `FRATERNAL_EXTENSION_REQUIRED` (`assertFraternalExtension`). The liturgical overlay is hidden; federal holidays stay.

### 5.2 Vocabulary

`TENANT_VOCABULARY`:

| | KOFC | GENERIC |
|---|---|---|
| Organization name | Knights of Columbus | Community Service Portal |
| Local unit | Council | Chapter |
| Presiding officer | Grand Knight | President |

`whiteLabel(text, tenant)` applies these replacements for a `GENERIC` tenant. Patterns match whole words and run longest first, so "Deputy Grand Knight" is replaced before "Grand Knight" and "Supreme Council" before "Supreme":

| Fraternal term | White-label term |
|---|---|
| Knights of Columbus | Community Service Portal |
| Deputy Grand Knight, DGK | Vice President |
| Grand Knight(s), GK | President(s) |
| Supreme Council | National Office |
| Supreme | National |
| brother Knight(s) | fellow member(s) |
| Knight(s) | Member(s) |
| Fraternal / fraternal | Community / community |
| Faith In Action, Faith-in-Action | Service In Action, Service-in-Action |
| Council(s) / council(s) | Chapter(s) / chapter(s) |

### 5.3 Limits of the white label

- `whiteLabel` is applied to the portal chrome: sidebar labels and hints, pillar names, the Messaging menu and the header. **Page bodies are not relabelled.** The emblem is hidden.
- There is no self-service path to create a new `GENERIC` organization; a Super Admin switches an existing council's tenant type.

---

## 6. Development history by phase

Dates are commit dates. Sprint names follow the commit messages.

| Dates | Phase / sprints | Highlights |
|---|---|---|
| 2026-09-20 | Phases 1–3 | Initial schema, shared business rules (15-minute increments, backdating locks), onboarding, Expo app, Next.js portal |
| 2026-09-26 – 09-27 | Phase 2 and 5K–5Q | Donations, skills, security hardening, roster, council maintenance, executive audits, lessons registry, user guides, photo galleries, calendar |
| 2026-09-28 – 09-29 | 5R–5Y | Expense reporting, push alerts, Supreme sync, officer elections, charitable giving, annual budget forecasting, meeting types and agenda templates |
| 2026-09-30 – 10-03 | 5Z series | Charitable intake and vetting, dual-signature expenses, parliamentary cadence, general ledger, live meetings and ballots, distribution lists, demo data, visual manuals |
| 2026-10-06 – 10-07 | 6A–6D, 6Z, Phase 4, Phase 4.5 | Feature flags, St. Mary's agenda, password reset, large-text mode, biometrics, seven-pillar navigation, help desk, Advisor, Marketing Factory, workflow engine, server sessions, SMTP gateway, liturgical calendar, dual-gate tenant model, credentials vault |
| 2026-10-07 – 10-10 | Phase 5 (6A–6S) | Dues forecast, budget versions, asset conversion, real St. Mary's budget, budget-line binding, vetting threads, budget analyzer, history and heritage, Trustee audit, prayer intentions, fixed categories, roster snapshots, Treasurer desk, feature-module flags, multi-receipt and Honorary Expense |
| 2026-10-10 | 7A–7C | Roster import and lifecycle, devotionals, affiliation log, Member Center, volunteer quarantine, council-wide settings, platform limits, System Settings and Global System Parameters, Navigation Guide |
| 2026-10-11 | 7D | This document |

The full list is in `git log`.

---

## 7. Phase 7 commercial scaling roadmap

**No Phase 7 roadmap is recorded in the repository.** No file, commit or code comment describes commercial plans, pricing, customer targets or a scaling schedule. This section is left for the owner to write, so that the record does not contain plans nobody agreed to.

What the repository *does* record are open items that any scaling effort would have to address. They are facts about the current code, not a plan:

1. **Production database.** The Azure SQL migration in `migration_checksheet.md` is not done. Both drivers are development drivers (browser memory and phone SQLite).
2. **Schema migrations.** There are no incremental migrations. A schema bump rebuilds the phone's local database.
3. **Phone-to-server path.** The phone reads its own local database; the planned design routes it through Next.js API routes.
4. **Server session data.** The server's member copy is seeded separately from the browser's, so live server actions see only seeded members.
5. **White label depth.** Only the chrome is relabelled; page bodies still use fraternal vocabulary. There is no onboarding flow for a new non-KofC organization.
6. **Placeholders.** The QR codes, the 24 phone screenshots in `generated/mobile_app_catalog/`, the admin guide PDF disclaimer and several NABRE verses in the liturgical calendar are placeholders or need verification.
7. **Budget gaps.** "Monthly Council Meetings" does not match the engine's "Council Meetings" line name, and there is no UI to view or edit a line's universal category.

---

## 8. Verification at Sprint 7D

Run on 2026-10-11, at schema version 63, before this document was committed:

| Check | Result |
|---|---|
| `npm run typecheck` (web and mobile, `tsc --noEmit`) | Passed, 0 errors |
| `vitest run` | 75 test files, 1,857 tests, all passed |
| `npm run build:web` (Next.js production build) | Passed |

The phone app has no production build script. Its code is checked by the mobile typecheck and by the tests that run against the SQLite driver.

---

## 9. Where the truth lives

| Topic | Authoritative source |
|---|---|
| Tables and columns | `Schema.sql`, `data_dictionary.md` |
| Schema version log | `apps/mobile/services/drivers/sqlite.ts` (comment above `SCHEMA_VERSION`) |
| Business rules and error codes | `packages/shared/src/rules.ts` and siblings |
| Who may see what | `packages/shared/src/permissions.ts`, `docs/ROLE_PERMISSIONS_MATRIX.md` |
| State machines | `packages/shared/src/workflow.ts` |
| Tenant and white label | `packages/shared/src/tenant.ts` |
| Production migration plan | `migration_checksheet.md` |
| User-facing behavior | `docs/MEMBER_USER_GUIDE.md`, `docs/ADMIN_USER_GUIDE.md`, `docs/sop/` |
| Change history | `git log` |
