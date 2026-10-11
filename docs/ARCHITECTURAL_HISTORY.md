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

## 3. Schema version history (1 to 63)

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
| 58 | 6S | `ExpenseReceipts`, personal-exclusion lines, Honor Voucher columns |
| 59 | 7A | `MemberDevotionals`, `Member.flag_charter_member`, rank thresholds |
| 60 | 7A Ext | `MemberCouncilAffiliationLog` |
| 61 | 7B | `VolunteerQuarantine`, `Council.feature_volunteer_quarantine` |
| 62 | 7C | Council-wide settings columns, `PlatformSettings` |
| 63 | 7C Ext | No table change; marks the System Settings and Global System Parameters release |

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
- **Honor Voucher.** A sheet with no receipt file carries the Honor Voucher badge on every desk and needs a written reason.

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
| 2026-10-07 – 10-10 | Phase 5 (6A–6S) | Dues forecast, budget versions, asset conversion, real St. Mary's budget, budget-line binding, vetting threads, budget analyzer, history and heritage, Trustee audit, prayer intentions, fixed categories, roster snapshots, Treasurer desk, feature-module flags, multi-receipt and Honor Voucher |
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
