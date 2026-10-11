# AI Developer Onboarding and Succession Guide

Knights of Columbus Event Tracking and Fraternal Management Platform. Written at Sprint 7D Extension, 2026-10-11, at schema version 63.

This guide is for an engineer who takes over the platform, alone or with an AI coding assistant. It tells you how to install the repository, how the code is organized, how tenancy works, and how to give a new AI session the project's history in one paste.

Read [`ARCHITECTURAL_HISTORY.md`](ARCHITECTURAL_HISTORY.md) after this guide. That document is the full record of schema versions 1 to 63, the money workflows and the white-label rules. This guide does not repeat it; it tells you how to use it.

When this guide and the code disagree, the code wins.

---

## 1. Before you start

You need:

| Tool | Version used at Sprint 7D | Notes |
|---|---|---|
| Node.js | 24.x (CI uses 20) | npm workspaces are required |
| npm | ships with Node | Do not use Yarn or pnpm; the lockfile is `package-lock.json` |
| Git | any recent | |
| Python 3 | optional | Only for `scripts/*.py` (admin guide PDF, Form 1295, roster template). Install with `pip install -r scripts/requirements.txt` |
| Expo Go | on a phone | Only to run the phone app |

Main framework versions (from the workspace `package.json` files):

| Package | Version |
|---|---|
| Next.js | ~16.3.5 (App Router) |
| React | 19.2.3 |
| Expo | ~57.0.24 |
| React Native | 0.86.3 |
| TypeScript | ^5 |
| Vitest | ^3.2.4 |

**Next.js warning.** This Next.js version has breaking changes from older releases. `apps/web/AGENTS.md` (created by `next dev`) tells AI assistants to read `node_modules/next/dist/docs/` before writing Next.js code. Tell your AI assistant the same.

---

## 2. First-day setup

Do these steps in order, from the repository root.

1. Clone the repository and open a terminal in its root folder.
2. Install all workspaces:
   ```bash
   npm install
   ```
3. Check that the generated database files match `Schema.sql` and `Seed.sql`:
   ```bash
   npm run gen:db:check --workspace=apps/web
   ```
   If it fails, run `npm run gen:db --workspace=apps/web` and commit the result.
4. Run the three checks. All three must pass before you change anything:
   ```bash
   npm run typecheck     # tsc --noEmit for apps/web and apps/mobile
   npm test              # vitest run (75 files, 1,857 tests at Sprint 7D)
   npm run build:web     # Next.js production build
   ```
5. Start the web portal:
   ```bash
   npm run dev:web
   ```
   Open `http://localhost:3000`.
6. Optional: start the phone app with `npm run dev:mobile` and scan the QR code with Expo Go. The phone and the computer must be on the same Wi-Fi network.

### 2.1 Demo sign-ins

Every seeded account uses the password `dev-pass-secure-9912`. These are development credentials in `Seed.sql`. Never reuse them in production.

| Account | Use |
|---|---|
| `testsuperadmin@kofc.org` | Super Admin (all councils, lookups, Global System Parameters) |
| `testadmin@kofc.org` | Council Admin |
| `testmember@kofc.org` | Ordinary member |
| `tom.gk@kofc15295.org` | Grand Knight of the demo council (St. Mary's, Council 15295) |
| `david.dgk@kofc15295.org` | Deputy Grand Knight |
| `hector.trustee@kofc15295.org` | Trustee |
| `bill.treasurer@kofc15295.org` | Treasurer |
| `brian.recorder@kofc15295.org` | Recorder |

The full list is in the `[Credentials]` inserts in `Seed.sql`.

---

## 3. How the monorepo is organized

```
kofc-tracking-platform/
├── packages/shared/src/   The core. DataService contract, business rules, permissions,
│                          workflow engine, tenant rules, and pure helpers (57 modules)
├── apps/web/              Next.js App Router portal
│   ├── app/               One folder per route (dashboard, finance, expenses, governance, ...)
│   ├── app/api/           Server route handlers (Drive, email, OCR, roster, credentials vault)
│   ├── components/        Shared React components
│   └── services/
│       ├── db.ts          THE ONLY data entry point for web pages
│       ├── drivers/       memory.ts (default) and remote.ts (production stub)
│       ├── server/        Server-only code: sessions, secrets, SMTP, credentials vault
│       └── generated/     Built from Schema.sql + Seed.sql. Do not edit by hand
├── apps/mobile/           Expo Router phone app
│   ├── app/               Screens
│   └── services/
│       ├── db.ts          Phone data entry point
│       ├── drivers/       sqlite.ts (holds SCHEMA_VERSION and the schema changelog), remote.ts
│       └── generated/     Built from Schema.sql + Seed.sql. Do not edit by hand
├── tests/                 Vitest suite. Runs against BOTH drivers. tests/shims/ fakes Expo modules
├── scripts/               gen-db-assets.mjs, plus Python report generators
├── Schema.sql             T-SQL schema for Azure SQL Server (the production target)
├── Seed.sql               Baseline rows, then a `-- @presentation-data` marker, then demo rows
├── data_dictionary.md     Table and column reference
├── migration_checksheet.md  Plan for the Azure SQL migration (not done)
└── docs/                  User guides, SOPs, role matrix, history, this guide
```

### 3.1 The four rules of the codebase

1. **All data goes through `DataService`.** The contract is `export interface DataService` in `packages/shared/src/contract.ts`. Pages never touch storage directly. Web pages import `db` from `apps/web/services/db.ts`; phone screens import from `apps/mobile/services/db.ts`.
2. **Business rules live in `packages/shared`.** They are pure functions that throw `BusinessRuleError` with a stable code, such as `SELF_APPROVAL_BLOCKED`. Both drivers call the same rules, so the web and the phone behave the same. Do not put a rule in a page.
3. **Every contract change goes to every driver.** When you add a method to `DataService`, add it to `memory.ts`, `sqlite.ts`, and both `remote.ts` stubs. The stubs list every method on purpose, so the compiler tells you which one you forgot.
4. **Schema changes follow a fixed path.** See [Section 5](#5-how-to-make-a-schema-change).

### 3.2 Data drivers

| Driver | Where | When |
|---|---|---|
| Memory | `apps/web/services/drivers/memory.ts` | Web default (`NEXT_PUBLIC_DATA_DRIVER=memory`). Each browser tab has its own copy, seeded with presentation data |
| SQLite | `apps/mobile/services/drivers/sqlite.ts` | Phone. Also runs in the tests through Node's built-in SQLite |
| Remote | `apps/*/services/drivers/remote.ts` | Production Azure SQL. **Every method throws "not implemented".** Building it is the main open job |

### 3.3 Server side

Server-only code is in `apps/web/services/server/`. Import it only from `app/api` route handlers. Secrets are read only through `secrets.ts`:

| Variable | Purpose |
|---|---|
| `PORTAL_SESSION_SECRET` | Signs the `kofc_portal_session` cookie (32+ characters; random if missing, so sessions end on restart) |
| `CREDENTIALS_VAULT_SECRET` | Seals `CouncilCredentialsVault` rows (32+ characters; older name `EMAIL_GATEWAY_SECRET` still read) |
| `SENDGRID_API_KEY`, `SENDGRID_LIVE=1` | Live outbound email |
| `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`, `GOOGLE_DRIVE_SHARED_DRIVE_ID`, `DRIVE_VAULT_LIVE=1` | Live Google Drive vault |
| `ALCHEMER_API_KEY`, `ALCHEMER_API_SECRET` | Supreme (Alchemer) sync, still simulated |
| `NEXT_PUBLIC_DATA_DRIVER` | `memory` or `remote`. Anything with `NEXT_PUBLIC_` is public; never put a secret in one |

Without these variables the platform runs fully in demo mode.

---

## 4. The multi-tenant architecture

The platform is multi-tenant at two levels.

### 4.1 Council tenancy (data isolation)

- Every row that belongs to a council carries its council id.
- **Member** sees their own records and what their role allows. **Admin** and officers act only inside their own council. **Super Admin** acts across all councils and owns the lookup tables.
- Officer roles (Grand Knight, Deputy Grand Knight, Treasurer, Financial Secretary, Trustees, Recorder, Council Historian and others) grant specific powers without the Admin user type. The exact grants are in `packages/shared/src/permissions.ts` and `docs/ROLE_PERMISSIONS_MATRIX.md`.
- A member can be affiliated with more than one council. The trail is `MemberCouncilAffiliationLog` (schema 60).
- Denials use stable error codes. A record another member owns answers `RECORD_NOT_FOUND`, not "forbidden", so ids cannot be probed.

### 4.2 Organization tenancy (white label)

- `Council.tenant_type` is `KOFC` (default) or `GENERIC` (schema 39). Only a Super Admin changes it, on `/system-settings/global-settings`.
- A `GENERIC` tenant loses the fraternal areas (`FRATERNAL_AREAS`: Supreme sync, Constitutional Advisor, Faith Center). The drivers refuse those operations with `FRATERNAL_EXTENSION_REQUIRED`.
- `whiteLabel(text, tenant)` in `packages/shared/src/tenant.ts` rewrites vocabulary ("Grand Knight" → "President", "Council" → "Chapter"). It runs on the portal chrome only. Page bodies are not relabelled yet.

### 4.3 Feature flags and settings

Behavior is also switched per council by `flag_*` and `feature_*` columns on `Council` (see `/feature-flags`), by council-wide limits on `/setup/council-settings`, and by the one-row `PlatformSettings` table for platform-wide limits. Check these before you assume a screen is broken: it may be switched off.

Since Sprint 7E (schema 64) the day and hour windows are settings too, never constants. Each council sets its expense filing window, volunteer logging window and hours reminder delay and cadence (`Council` columns). Super Admins set the meeting invitation horizon and the portal session length (`PlatformSettings`). `packages/shared/src/council-settings.ts` is the source of truth: each setting has its range, its card on the settings pages, its (i) help text and an `inUse` mark. Seven settings are saved for features that do not exist yet (`inUse: false`). Read a council's values with `councilWideSettings(council)` and the platform's with `platformSettings(row)`. The old constants (`EXPENSE_SUBMISSION_GRACE_DAYS`, `HOURS_REMINDER_FIRST_DAY` and so on) are only the defaults. The live values for a signed-in member are on the **Navigation Guide** under **Your time limits**.

### 4.4 State machines

Multi-step processes are declared in `packages/shared/src/workflow.ts` with `defineWorkflow`. `nextWorkflowState` refuses illegal jumps. The expense sheet, for example, goes Draft → Submitted → Approved → Reimbursed, with three signatures in order: Financial Secretary, Treasurer, Grand Knight. Add new steps to the workflow definition, not to page code.

---

## 5. How to make a schema change

The schema is locked at version 64. To change it:

1. Edit `Schema.sql`. For a column on an existing table, append an `ALTER TABLE` at the end, in sprint order.
2. Add or change rows in `Seed.sql`. Baseline rows go above the `-- @presentation-data` marker; demo rows go below it.
3. Raise `SCHEMA_VERSION` in `apps/mobile/services/drivers/sqlite.ts` by one, and add a line to the changelog comment above it.
4. Run `npm run gen:db --workspace=apps/web`. The parser stops on any statement it does not recognize and on any foreign key that points to a missing table or column.
5. Update `data_dictionary.md`.
6. Update both drivers and both `remote.ts` stubs if the contract changed.
7. Add tests in `tests/`. Run the three checks in [Section 2](#2-first-day-setup).
8. Add a row to the schema table in `docs/ARCHITECTURAL_HISTORY.md`.

There are no incremental migrations. A raised `SCHEMA_VERSION` makes the phone rebuild its local database from scratch.

---

## 6. Guardrails you must keep

- **Brand palette.** Navy `#002855`, red `#C8102E`, gold `#D6A420`, white background. No green. `tests/web-theme.test.ts` fails if a page uses colors outside the tokens.
- **Plain English.** User guides and SOPs use Simplified Technical English. If you use Claude Code, the local `technical-writer` skill does this.
- **Seven pillars.** The web sidebar has seven always-open pillars. The phone screens are frozen except where a feature needs a change.
- **No invented facts.** The Constitutional Advisor is deterministic and cites only text in the repository. Do not add Charter citations or roadmap plans that nobody approved.
- **No hardcoded windows.** A new day or hour limit becomes a setting in `council-settings.ts` with help text, not a constant in page code. Pages read the live value (`useCouncilTimings` on the web, `lib/council-timings.ts` on the phone).
- **Money controls.** Never weaken self-approval, self-payout, separation of duties or audit period locks. Each has tests.
- **CI.** `.github/workflows/deploy.yml` builds the shared package and the web app and typechecks the phone app on every push to `main`. It does **not** run the Vitest suite, so run `npm test` yourself before you push.

---

## 7. Reloading the project history into a new AI session

An AI assistant starts every session with no memory of this project. The original development used Claude Code with a private memory folder on the owner's computer. **That folder is not in the repository**, so you will not have it. The repository itself holds everything the AI needs. The prompt below tells the AI where to look.

### 7.1 How to use it

1. Open your AI coding tool (for example Claude Code) in the repository root, so it can read files.
2. Copy the whole prompt in [Section 7.2](#72-the-prompt) and paste it as your first message.
3. Wait for the AI's summary. Check it against the "Expected answers" in [Section 7.3](#73-expected-answers). If it gets one wrong, tell it which file to re-read.
4. Then give it your first task.

If your tool cannot read files, paste `docs/ARCHITECTURAL_HISTORY.md` and this guide below the prompt instead.

### 7.2 The prompt

Copy everything inside the box.

```text
You are joining an existing project as a senior engineer: the Knights of Columbus Event
Tracking and Fraternal Management Platform. It is a TypeScript npm-workspaces monorepo with
a Next.js App Router web portal (apps/web), an Expo Router phone app (apps/mobile), and a
shared core package (packages/shared). The database schema is at version 63. Azure SQL
Server (T-SQL, Schema.sql) is the production target, but today the web runs on an
in-memory driver and the phone on expo-sqlite; the production "remote" driver is a stub.

Before you write any code, reload the project's history by reading these files in order:

1. docs/AI_DEVELOPER_README.md      - setup, layout, tenancy, change process, guardrails
2. docs/ARCHITECTURAL_HISTORY.md    - product vision, schema versions 1-63, money
                                      workflows, white-label rules, open items
3. The changelog comment above SCHEMA_VERSION in apps/mobile/services/drivers/sqlite.ts
4. packages/shared/src/contract.ts  - the DataService interface (skim the method groups)
5. packages/shared/src/workflow.ts, permissions.ts, rules.ts, tenant.ts
6. docs/ROLE_PERMISSIONS_MATRIX.md
7. apps/web/AGENTS.md - this Next.js version differs from your training data; read
   node_modules/next/dist/docs/ before writing Next.js code
8. git log --oneline -40           - recent sprint names and order

Rules you must follow in this codebase:
- All data access goes through the DataService contract. Pages import `db` from
  apps/web/services/db.ts or apps/mobile/services/db.ts and nothing else that touches data.
- Business rules are pure functions in packages/shared that throw BusinessRuleError with a
  stable code. Never put a rule only in a page.
- A contract change must be implemented in the memory driver, the sqlite driver and both
  remote.ts stubs.
- A schema change follows Section 5 of docs/AI_DEVELOPER_README.md: Schema.sql, Seed.sql
  (baseline above the @presentation-data marker), raise SCHEMA_VERSION with a changelog
  line, run `npm run gen:db --workspace=apps/web`, update data_dictionary.md, add tests.
- Never edit files under services/generated/ by hand.
- Keep the locked palette (navy #002855, red #C8102E, gold #D6A420, white; no green).
- Never weaken the expense controls (no self-approval, no self-payout, FS -> Treasurer ->
  GK separation of duties) or the Trustee audit period locks.
- Do not invent facts, citations, roadmap items or user decisions. If the repository has no
  record of something, say so and ask me.
- Before you call any work done, run: npm run typecheck, npm test, npm run build:web.
  Report the real results, including failures.

When you have read the files, reply with:
(a) a one-paragraph summary of what the platform does;
(b) the current SCHEMA_VERSION and what the last three versions added;
(c) the two levels of tenancy and how each is enforced;
(d) the expense approval sequence and its main error codes;
(e) the open items listed in Section 7 of ARCHITECTURAL_HISTORY.md.
Then wait for my first task. Do not change any file yet.
```

### 7.3 Expected answers

Use these to check the AI's summary at schema 63.

| Question | Correct answer |
|---|---|
| (b) Schema version | 63. Version 61 added `VolunteerQuarantine`; 62 added council-wide settings and `PlatformSettings`; 63 has no table change (System Settings and Global System Parameters release) |
| (c) Tenancy | Council tenancy, enforced by `permissions.ts` and `rules.ts` in both drivers; organization tenancy by `Council.tenant_type` (`KOFC` / `GENERIC`), enforced by `tenant.ts` and `TENANT_GATE_WORKFLOW` |
| (d) Expenses | Draft → Submitted → FS order → Treasurer coding → GK authorization → Approved → check recorded → Reimbursed. Codes include `SELF_APPROVAL_BLOCKED`, `SELF_PAYOUT_BLOCKED`, `DUAL_SIGNATURE_CONFLICT`, `TREASURER_REQUIRED`, `FINANCE_OFFICER_REQUIRED` |
| (e) Open items | Azure SQL migration not done; no incremental migrations; phone does not use server routes; server member copy seeded separately; white label is chrome only; placeholder assets; two budget gaps |

If a later sprint changes any of these, update this table in the same commit.

### 7.4 Keeping the reload accurate

At the end of every sprint that changes the schema or a core rule:

1. Add the schema row to `docs/ARCHITECTURAL_HISTORY.md`.
2. Update the version number at the top of this guide and in the prompt.
3. Update [Section 7.3](#73-expected-answers).

The prompt points to files, not to copied facts, so most sprints need no change to it.

---

## 8. Where to go next

| You want to | Read |
|---|---|
| Know what a table or column means | `data_dictionary.md`, `Schema.sql` |
| Know who may do what | `docs/ROLE_PERMISSIONS_MATRIX.md`, `packages/shared/src/permissions.ts` |
| See how a user does a task | `docs/MEMBER_USER_GUIDE.md`, `docs/ADMIN_USER_GUIDE.md`, `docs/sop/` |
| Plan the production database | `migration_checksheet.md`, `apps/web/services/drivers/remote.ts` |
| Understand why something is the way it is | `docs/ARCHITECTURAL_HISTORY.md`, then `git log` |

Note: the root `readme.md` is from an early sprint. Its test count (257) and its CI description are out of date. Trust this guide and `ARCHITECTURAL_HISTORY.md` instead.
