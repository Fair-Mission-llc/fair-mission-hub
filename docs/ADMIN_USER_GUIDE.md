# Knights of Columbus Tracking Platform — Administrator User Guide

**Audience:** Council Admins, Super Admins, the Grand Knight (GK), the Deputy Grand Knight (DGK), the Financial Secretary (FS), the Treasurer, Trustees and other council officers.

**Covers:** the management pages of the web portal, grouped by the seven sidebar pillars.

> **Every administrator is also a member.** Signing up, logging hours and taking donations are in the [Member User Guide](MEMBER_USER_GUIDE.md).
> The full access table is in the [Role Permissions Matrix](ROLE_PERMISSIONS_MATRIX.md).

---

## Contents

1. [Roles and access](#1-roles-and-access)
2. [The seven pillars](#2-the-seven-pillars)
3. [Module feature flags](#3-module-feature-flags)
4. [Governance](#4-governance)
5. [Faith In Action](#5-faith-in-action)
6. [Finances](#6-finances)
7. [Performance](#7-performance)
8. [Resources and the Google Drive archive vault](#8-resources-and-the-google-drive-archive-vault)
9. [Answers](#9-answers)
10. [System Settings and the Supreme roster sync](#10-system-settings-and-the-supreme-roster-sync)
11. [Data protection rules](#11-data-protection-rules)
12. [Troubleshooting reference](#12-troubleshooting-reference)
13. [Automated messages reference](#13-automated-messages-reference)
14. [Member engagement and the roster lifecycle](#14-member-engagement-and-the-roster-lifecycle)
15. [Volunteer time quarantine](#15-volunteer-time-quarantine)
16. [Council Wide Settings and platform settings](#16-council-wide-settings-and-platform-settings)
17. [Access requests, check payments, asset photos, impersonation and remote help](#17-access-requests-check-payments-asset-photos-impersonation-and-remote-help)
18. [Annual roadmap, meeting check-in and meeting photos](#18-annual-roadmap-meeting-check-in-and-meeting-photos)
19. [The Active Desks dashboard](#19-the-active-desks-dashboard)
20. [Appendix: QR code files](#appendix-qr-code-files)

### How to read a tutorial

Every tutorial starts with a **Prerequisite (who can do this)** line. The line states the access privilege that the task needs. Stop when your role is not on the line.

Every tutorial then has five parts: **Goal**, **Start point**, **Steps**, **Expected result** and **Common problems**.
A **Warning** line comes before the steps when the task deletes data, sends messages, posts money or cannot be undone.

---

## 1. Roles and access

### 1.1 Member types and officer roles

A member has one member type. A member may also hold one or more officer roles.

| Member type | Scope |
| --- | --- |
| **Member** | The member's own records and the shared member pages. |
| **Admin** | The Admin's own council only. |
| **Super Admin** | Every council. |

| Officer role | Extra access |
| --- | --- |
| **Grand Knight** and **Deputy Grand Knight** | The executive dashboard and the charity vetting desk. The GK also counter-signs expenses and keeps the cadence and agenda templates. |
| **Financial Secretary** | Issues written orders on expenses. Posts to the general ledger. Pays checks. |
| **Treasurer** | Posts to the general ledger. Pays checks. |
| **Trustee** | Vets charity requests. Follows up on grants after 6 months. |
| **Recorder** | Edits the live agenda. Records hand tallies. |
| Any other seated officer | Reads the dashboards. Schedules meetings. Runs the live console. |

### 1.2 Access rules

- An Admin acts only on the Admin's own council. A Super Admin acts on any council.
- The data service checks every rule. A refused action shows a message and changes nothing.
- Nobody signs or pays an expense report that the same person submitted. The rule includes Super Admins.
- One person never signs both lines of the same expense report.

> **Caution:** finance access follows the role names **Treasurer** and **Financial Secretary**.
> A renamed role removes finance access from the officers who hold the role. Keep both names exactly as written.

<!-- KEEP_IMAGE: member actions hub with the role-filtered sidebar -->
![Member Actions Hub with the role-filtered sidebar (/member-actions)](../generated/dashboard_visual_catalog/member-actions.png)
<!-- /KEEP_IMAGE -->

### 1.3 Choose the council

Most management pages have a **Council** selector at the top.

- An Admin sees the Admin's own council.
- A Super Admin may choose any council.

The navy header shows your own council, your name, your member type and your officer status.

---

## 2. The seven pillars

### 2.1 Concept: pillar navigation

The sidebar has seven pillars. Every pillar is always open. A pillar shows only the links that your role may open.
A pillar with no allowed links does not show.

A link that your role cannot open does not show. The sidebar never shows a locked or greyed-out link.
The rule includes the five officer desks: **Live Meeting Console**, **Annual Cadence Manager**, **FS Expense Audit**, **GK Expense Authorize** and **Charity Vetting Queue**.

| Pillar | Links, in sidebar order | Main audience |
| --- | --- | --- |
| **Governance** | Live Meeting Console, Annual Cadence Manager, Meeting Center, Council Officer Nominations, Appointed Leadership Matrix, Constitutional Bylaws, Constitutional Advisor | Officers, the GK, Admins. The Constitutional Advisor shows to officers, Admins and Super Admins only. |
| **Faith In Action** | Standalone Activities, Member Actions Hub, Event Planner, Visual Master Calendar | Admins plan. Members volunteer. |
| **Finances** | General Ledger Spreadsheet, Balance Sheet, Financial Dashboard, My Expense Reports, Leadership Auditing Queue, Bulk Check Disbursements, FS Expense Audit, GK Expense Authorize, Charity Vetting Queue, Propose Charity Grant, Charitable Disbursements Ledger, Donations History, Annual Budget Projections | Finance officers, the GK, Admins |
| **Performance** | Executive Dashboard, Growth & Hours Charts, Post-event Ledger, Lessons Registry | Seated officers, Admins |
| **Resources** | Fraternal Photo Gallery, Council Artifacts, Marketing Factory, 📂 Council Archive Vault | Every member. The Marketing Factory and the vault link show to officers and Admins only. |
| **Answers** | Online Help Center, SOP Center | Every member |
| **System Settings** | Councils, Feature Flags Control Center, Global System Parameters, Council Wide Settings, Affiliated Roster, Supreme Council Sync, Council Lookup Tables, Credentials Vault, Global Charities Registry, Global Governance Matrices, Parish & Pastors Linkage | Admins, finance officers, Super Admins. The Council Wide Settings and the Credentials Vault show to officers, Admins and Super Admins only. Global System Parameters shows to Super Admins only. |

Three pages open from the header, not from the sidebar.

- **Messaging** (envelope icon) → **Council Messages & Alerts** and **My Distribution Lists**.
- **Help** (question-mark icon) → **Online Help Center**.
- Your name → **My Profile**.

The **System Settings** pillar had the name **Setup** in earlier versions of the portal. The links in the pillar did not change.

### 2.2 Concept: the Navigation Guide

The **Navigation Guide** link is at the top of the sidebar, above the seven pillars. Every member sees the link.

The **Navigation Guide** page reads your member type and your officer roles. The page then lists only the links that your own sidebar shows.
Each link has one plain-English sentence that tells what the page does.

| You sign in as | The guide shows |
| --- | --- |
| Member | The member pages only. The guide shows no leadership, finance desk or settings page. |
| Council Officer | The member pages and the desks of your office, for example **GK Expense Authorize** for the Grand Knight. |
| Council Admin | The member pages and the leadership, finance and settings pages of your council. |
| Super Admin | Every page, including **Global System Parameters**. |

A few pages read differently for leaders. For example, a member reads that **Annual Budget Projections** shows the budget. A leader also reads that budget keepers draft and approve the budget there.
A module that your council switched off is not in the guide, because the module is not in your sidebar.

The **Your time limits** part of the guide lists the time windows and reminder days in force for you now. The guide reads the numbers from your council's settings and the platform settings each time the page opens. A member sees the limits that a member meets: the expense window, the logging window, the hours reminders, the invitation lead time and the sign-in length. A leader also sees every other time setting. The settings that no feature uses yet are listed last under **Saved for future features (not used yet)**.

### 2.3 Read your Navigation Guide

> **Prerequisite (who can do this):** Every signed-in member.

**Goal:** Learn what each link in your sidebar does.

**Start point:** Sidebar → **Navigation Guide** (at the top, above the pillars).

**Steps:**
1. Select **Navigation Guide**.
2. Read the first line. The line shows how you are signed in, for example *You are signed in as: Council Officer (Grand Knight)*.
3. Read each pillar. The pillars and links are in the same order as your sidebar.
4. Select a link name to open that page.
5. Read **Your time limits** for your council's time windows and reminder days.
6. Read **In the top bar** for the Messaging menu and your name menu.

**Expected result:** The page lists every link that your sidebar shows, with one sentence for each link. **Your time limits** shows your council's current numbers.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A page that a colleague uses is not in your guide. | Your role cannot open the page. | Ask a council Admin about your role. |
| A whole module is missing from the guide. | Your council switched the module off (section 3). | Ask a Super Admin to switch the module on. |

---

## 3. Module feature flags

### 3.1 Concept: backend logic of the flags

Each council row has twelve on/off columns. Each column is a module feature flag. A new council has every flag on.

| Flag column | Label in the Feature Flags Control Center | Web pages hidden when off | Phone items hidden when off |
| --- | --- | --- | --- |
| `flag_mobile_elections` | **Officer elections** | Council Officer Nominations, Appointed Leadership Matrix | None |
| `flag_fundraising_inflow` | **Fundraising inflow** | Donations History | **Donate** |
| `flag_charity_proposals` | **Charity proposals** | Propose Charity Grant, Charity Vetting Queue | None |
| `flag_complex_shifts` | **Event shifts** | Event Planner, the shift tabs of Member Actions Hub | **Signup**, and the shift mode of **Report** |
| `flag_meeting_management` | **Meeting management** | Meeting Center, Annual Cadence Manager, Live Meeting Console | **Mtgs** |
| `feature_expense_reporting` | **Expense reporting** | My Expense Reports, Leadership Auditing Queue, FS Expense Audit, Treasurer Ledger Audit Desk, GK Expense Authorize, Bulk Check Disbursements | The expense screen and the **Expense reports** card on **Home** |
| `feature_faith_center` | **Faith Center** | Faith Center | The feast-day banner, the Daily Bible Quote, the praying hands and the prayer intentions |
| `feature_constitutional_advisor` | **Constitutional Advisor** | Constitutional Advisor | None |
| `feature_council_bylaws` | **Council bylaws** | Constitutional Bylaws | None |
| `feature_council_history` | **Council history** | Council history (Team Legacy) | None |
| `feature_live_meeting_console` | **Live meeting console** | Live Meeting Console | None |
| `feature_volunteer_quarantine` | **Volunteer time quarantine** | The **Volunteer Time Quarantine Desk** on the **Oversight Desk** of the dashboard. Members' hours also stop going to review (section 15). | None |

The flags follow four rules.

1. A flag that is off hides the module from every member of the council. The rule includes Admins.
2. A hidden desk is gone from the sidebar.
3. A hidden page refuses a typed web address. The phone sends a member on a hidden screen back to **Home**.
4. A flag never deletes data. A flag that is switched back on restores the module with all records.

The general ledger, the budget and the activity hour log have no flag. They stay on for every council.

### 3.2 Switch a module on or off

> **Prerequisite (who can do this):** You must have Super Admin privileges. Council Admins do not see the Feature Flags Control Center.
> **Warning:** a switched-off module disappears at once for every member of the council, on the web and on the phone.

**Goal:** Turn one optional module on or off for one council.

**Start point:** Sidebar → System Settings → **Feature Flags Control Center**.

**Steps:**
1. Find the row of the module. Each row shows the label, the flag column and the pages the flag hides.
2. Find the column of the council. Each column shows the council number and how many modules are on.
3. Clear the box to hide the module. Select the box to show the module.

**Expected result:** The platform saves each switch at once. Members of the council see the change the next time each page loads.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A member still sees a phone tab. | The phone read the flags before the change. | Ask the member to sign out and sign in again. |
| *"… is not a feature flag"* | The request named an unknown flag. | Use one of the twelve flags in 3.1. |

---

## 4. Governance

### 4.1 Run a live meeting

> **Prerequisite (who can do this):** You must be a seated officer of the council, a council Admin, the meeting owner or a Super Admin. Other members do not see this desk.
> **Warning:** **Passed**, **Failed** and **Tabled** record the council's decision on the motion.

**Goal:** Chair a council meeting from one screen.

**Start point:** Sidebar → Governance → **Live Meeting Console**.

**Steps:**
1. Choose the meeting in **Meeting**.
2. Select **Start live console**.
3. Check in members in **Live attendance**. Use **Find a member** to search.
4. Select a line in **Order of Business** to put the line on the floor.
5. Set **Allotted minutes** for the topic.
6. For a motion, select **Launch secret smartphone ballot**. Members vote **Approve**, **Deny** or **Abstain** on their phones.
7. Select **Passed**, **Failed** or **Tabled**.
8. Select **Close the console** after the last item.

<!-- KEEP_IMAGE: live meeting console capture -->
![Live Meeting Console (/meetings/live)](../generated/dashboard_visual_catalog/meetings_live.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The top bar shows **Now on the floor** and the countdown. Phones that follow the agenda show the same line.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| *"Start the console first"* | The console is not live. | Select **Start live console**. |
| *"Decide the open ballot first"* | A ballot is still open. | Decide the open motion. Then continue. |
| **Passed** is greyed out. | The smartphone ballot has no more Approve votes than Deny votes. | Select **Failed** or **Tabled**. |
| *"No meeting from the past week on is yours to run."* | No meeting is in range for you. | Schedule the meeting in the **Meeting Center**. |

### 4.2 Record a hand tally

> **Prerequisite (who can do this):** You must be the council's Grand Knight or Recorder, a council Admin or a Super Admin.
> **Warning:** **Save tally & decide the motion** decides the motion. A tie fails the motion.

**Goal:** Record a vote by raised hands.

**Start point:** Sidebar → Governance → **Live Meeting Console** → the motion → **Record Hand Tally**.

**Steps:**
1. Count the hands for the motion. Enter the count in **Approved hands**.
2. Count the hands against the motion. Enter the count in **Denied hands**.
3. Select **Save tally & decide the motion**.
4. Optional: for a passed motion that releases money, choose the posting in **General-ledger posting**. Select **Save link**.

**Expected result:** The motion shows **Passed** or **Failed**. A linked motion shows **Ledger linked**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| *"Type both counts; at least one hand."* | A count is empty, or both counts are 0. | Enter both counts. |
| The hand tally is refused. | A smartphone ballot already opened on the motion. | Decide the motion from the ballot result. |

### 4.3 Correct a live agenda line

> **Prerequisite (who can do this):** You must be the council's Grand Knight or Recorder, a council Admin or a Super Admin.

**Goal:** Fix or add an agenda line during the meeting.

**Start point:** Sidebar → Governance → **Live Meeting Console** → **Order of Business**.

**Steps:**
1. Select the line. The line opens for editing.
2. Correct the text. Press Enter to save. Press Escape to cancel.
3. For a new topic, select **Blank last-minute line - click to write it**.

**Expected result:** The corrected line shows on the console and on members' phones.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A line does not open for editing. | The DGK and other officers do not edit the agenda. | Ask the GK or the Recorder. |

### 4.4 Lay down the year's meetings with a cadence

> **Prerequisite (who can do this):** You must be a council Admin, the Grand Knight or a Super Admin. Other members do not see this desk.
> **Warning:** **Populate the year** creates up to 12 meetings and their invitations.

**Goal:** Create the fraternal year's regular meetings in one step.

**Start point:** Sidebar → Governance → **Annual Cadence Manager**.

**Steps:**
1. Select **Add cadence**.
2. Choose the **Meeting type**.
3. Set **Recurrence pattern: week** and **Recurrence pattern: day**, for example First and Tuesday.
4. Set **Start time**, **Default location** and **Default recipient group**.
5. Select **Save cadence**.
6. Choose the **Fraternal year**. Select **Populate the year**.

<!-- KEEP_IMAGE: annual cadence manager capture -->
![Annual Cadence Manager (/meetings/cadence)](../generated/dashboard_visual_catalog/meetings_cadence.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The platform creates one meeting per month, July through June. Each meeting lasts 120 minutes.
Invitations are released 5 days before each meeting by default. A Super Admin sets the number of days for every council (section 16.6).

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A month has no new meeting. | A meeting of the same type already exists on that date. | No action. The platform skips the date. |

### 4.5 Schedule a single meeting

> **Prerequisite (who can do this):** You must be a seated officer of the council, a council Admin or a Super Admin.
> **Warning:** **Schedule meeting** sends invitations at once.

**Goal:** Create one meeting and invite members.

**Start point:** Sidebar → Governance → **Meeting Center**.

**Steps:**
1. Select **New meeting**.
2. Fill in **Meeting name**, **Type**, **Date**, **Location**, **Starts** and **Ends**.
3. Check the **Agenda**. The **Type** fills the agenda from the council's template.
4. For a meeting over several days, tick **Multi-Day Assembly / Extended Event**. Set the **End date**.
5. Choose the invitees: **All active members**, **Officers only** or **Choose members…**.
6. Select **Schedule meeting**.
7. After the meeting, select **Upload minutes**. Tick each attendee. Save.

<!-- KEEP_IMAGE: meeting center capture -->
![Meeting Center (/meetings)](../generated/dashboard_visual_catalog/meetings.png)
<!-- /KEEP_IMAGE -->

**Expected result:** A message shows *"Meeting scheduled and invitations sent."*

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| New members are not invited. | The members joined after the meeting was scheduled. | Select **Invite all active members**. |
| A multi-day assembly adds no hours. | Multi-day assemblies add no meeting hours by design. | No action. |

### 4.6 Keep the meeting agenda templates

> **Prerequisite (who can do this):** You must be a council Admin, the Grand Knight or a Super Admin.

**Goal:** Set the default agenda for one meeting type.

**Start point:** Sidebar → System Settings → **Council Lookup Tables** → **Meeting Agenda Templates**.

**Steps:**
1. Choose the **Meeting type**.
2. Write the outline in **Default agenda outline**.
3. Select **Save template**.
4. To remove a template, clear the text. Select **Save template**.

**Expected result:** A new meeting of the type starts with the outline.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A meeting kept the old agenda. | The officer typed an agenda before choosing the type. | Select **Use the template** on the meeting form. |

### 4.7 Manage nominations and appointments

> **Prerequisite (who can do this):** You must be an active member to nominate. You must be the Grand Knight, a council Admin or a Super Admin to appoint officers.

**Goal:** Fill the council's elected and appointed seats.

**Start point:** Sidebar → Governance → **Council Officer Nominations** or **Appointed Leadership Matrix**.

**Steps:**
1. Open **Council Officer Nominations** to nominate a Brother Knight for office.
2. Open **Appointed Leadership Matrix** to fill an appointed seat.
3. Choose the member for each vacant seat. Save.

<!-- KEEP_IMAGE: nominations and elections capture -->
![Nominations and elections (/elections)](../generated/dashboard_visual_catalog/elections.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: appointed positions capture -->
![Appointed positions (/elections/appointments)](../generated/dashboard_visual_catalog/elections_appointments.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The seat shows the member's name.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| Both pages are missing. | The council switched off **Officer elections**. | Ask a Super Admin (section 3). |

### 4.8 Concept: the Council Bylaws Data Vault

The vault holds one bylaws document per council. Every member of the council reads the bylaws.

- The vault stores the bylaws as text in the `Council.BylawsMarkdown` column. The limit is 100,000 characters.
- The vault also stores the save time in `BylawsUpdatedAt`.
- A line that starts with `# ` starts an article. A line that starts with `## ` starts a section.
- The vault splits the text into clauses. The clause id `A2.S3` means article 2, section 3. The id `A0` holds text before the first article.
- The **Parliamentary engine feed** panel lists every clause with its id, heading and word count.
- The parliamentary engines read the same clauses. A motion or a ruling cites a clause by the clause id.

### 4.9 Edit the council bylaws

> **Prerequisite (who can do this):** You must be the council's Grand Knight, a council Admin or a Super Admin. Other members see no **Edit bylaws** button.
> **Warning:** **Save bylaws** replaces the stored text for every member. The vault keeps no earlier version.

**Goal:** Change the council bylaws.

**Start point:** Sidebar → Governance → **Constitutional Bylaws**.

**Steps:**
1. Copy the current text to a file as a backup.
2. Select **Edit bylaws**. An empty vault starts from an outline.
3. Change the text in **Bylaws text**.
4. Check the **Preview** panel.
5. Check the clause ids in **Parliamentary engine feed**.
6. Select **Save bylaws**.

**Expected result:** A message shows *"The bylaws are saved."*

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A section has no clause id. | The heading has no `## ` at the start. | Add `## ` and a space at the start of the line. |
| The text stops at the limit. | The text has 100,000 characters. | Shorten the text. |

The SOP Center holds the same procedure: **Answers → SOP Center → Edit the council bylaws**.

---

## 5. Faith In Action

### 5.1 Create an event

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.

**Goal:** Create an event that volunteers can sign up for.

**Start point:** Sidebar → Faith In Action → **Event Planner**.

**Steps:**
1. Select **New event**.
2. Fill in **Event name**, **Description**, **Starts**, **Ends** and **Location**.
3. Choose the **Category** and the **Owner**.
4. Optional: enter **Budget ($)** and **Planned attendees**.
5. Tick each council in **Councils sharing this event**.
6. Tick **Is Annual** for an event that repeats each year (see 6.12).
7. Save.

<!-- KEEP_IMAGE: event planner capture -->
![Event Planner split screen (/events)](../generated/dashboard_visual_catalog/events.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: council calendar capture -->
![Council calendar (/calendar)](../generated/dashboard_visual_catalog/calendar.png)
<!-- /KEEP_IMAGE -->

**Expected result:** A message shows *"Event created. Add its shifts below."*

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The date is refused. | **Ends** is before **Starts**. | Correct the dates. |
| The save is refused. | No council is ticked. | Tick at least one council. |

### 5.2 Add shifts to an event

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.
> **Warning:** a shift with sign-ups or logged hours cannot be deleted.

**Goal:** Give the event the time slots that volunteers fill.

**Start point:** Sidebar → Faith In Action → **Event Planner** → the event → **Shifts** panel.

**Steps:**
1. Enter the **Shift name**.
2. Enter a **Date** inside the event dates.
3. Enter the start time and the end time.
4. Enter **Volunteers needed**.
5. Select **Add shift**.
6. Repeat steps 1 to 5 for each day and time slot.

<!-- KEEP_IMAGE: shift grid placeholder -->
![Image: Shift Grid]
<!-- /KEEP_IMAGE -->

**Expected result:** The shift shows in the grid with a status pill.

| Pill | Meaning |
| --- | --- |
| **Full** (navy) | The shift has its volunteers. Extra members may join as honorary volunteers. |
| **Needs *n* soon** (red) | The shift starts within 48 hours and needs volunteers. |
| **Needs *n*** (gold) | Nobody has signed up, or the shift starts within 7 days. |
| **Needs *n*** (outline) | The shift has time to fill. |

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The shift date is refused. | The date is outside the event dates. | Change the shift date or the event dates. |
| **Delete** is refused. | Members signed up or logged hours. | Keep the shift. |

### 5.3 Copy an event as a twin

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.

**Goal:** Repeat a past event with the same shift pattern.

**Start point:** Sidebar → Faith In Action → **Event Planner** → the past event → **Copy as a twin**.

**Steps:**
1. Check **New event name**. Change the name if needed.
2. Set **New first day**.
3. Select **Copy event**.
4. Check every shift of the twin.

<!-- KEEP_IMAGE: copy as twin placeholder -->
![Image: Copy As Twin]
<!-- /KEEP_IMAGE -->

**Expected result:** A message shows *"Copied. The twin is open on the right."*

| Copied | Not copied |
| --- | --- |
| Details, councils, owner, budget, the **Is Annual** tag | Sign-ups and logged hours |
| Every shift, moved by the same number of days | Post-event results and lessons |

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A shift is on the wrong weekday. | The new first day is on a different weekday. | Pick a first day on the same weekday. |

### 5.4 Keep the council activities

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.

**Goal:** Keep the list of ongoing activities that members log time against.

**Start point:** Sidebar → Faith In Action → **Standalone Activities**.

**Steps:**
1. Add an activity with a name, a description and a category.
2. Save.

<!-- KEEP_IMAGE: activities catalog capture -->
![Activities catalog (/activities)](../generated/dashboard_visual_catalog/activities.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The activity shows as a tile on the phone **Report** tab.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A sister council does not see the activity. | Activities belong to one council. | Add the activity in each council. |

---

## 6. Finances

### 6.1 Concept: the two-signature expense path

| Step | Who acts | Where | Status tag |
| --- | --- | --- | --- |
| 1. File | The member | **My Expense Reports** | **Submitted** |
| 2. Written order | The Financial Secretary | **FS Expense Audit** → **📝 Verify & Sign Expense** | **Order Issued** |
| 3. Categorize | The Treasurer | **Treasurer Ledger Audit Desk** → **🏷️ Categorize & Lock Expense** | **Order Issued** |
| 4. Final release | The Grand Knight | **GK Expense Authorize** → **✍️ Final Release for Payment** | **Approved** |
| 5. Pay | The FS or the Treasurer | **Bulk Check Disbursements** | **Reimbursed** |
| Return | Council leadership | **Leadership Auditing Queue** → **Reject & Return** | **Returned** |

- A Super Admin may sign either line, but never both lines of the same report.
- Each signer chooses the budget line in **Assign Ledger Budget Line Item**. The report saves the line.
- The budget counts the report only against the saved line.
- The Treasurer chooses the budget line and the ledger account before the Grand Knight signs. **🏷️ Categorize & Lock Expense** locks both choices.
- The officer who issued the order sees a **🔒 Collusion Guard** tag. That officer sees no **✍️ Final Release for Payment** button.
- Council Admins open both desks to follow the work. Only the seat holders or a Super Admin sign.
- A signer sees no button on a report the signer cannot sign. A tag tells who signs the report.
- A return clears both signatures and the saved budget line.

<!-- KEEP_IMAGE: my expense reports capture -->
![My Expense Reports (/expenses)](../generated/dashboard_visual_catalog/expenses.png)
<!-- /KEEP_IMAGE -->

### 6.2 Issue a written order

> **Prerequisite (who can do this):** You must be the council's Financial Secretary or a Super Admin. Council Admins read the desk only.
> **Warning:** the order is a signature. The report moves to the Grand Knight.

**Goal:** Approve a report's receipts as the first signature.

**Start point:** Sidebar → Finances → **FS Expense Audit**.

**Steps:**
1. Open the submitted report.
2. Check each receipt against its line.
3. Check the line in **Assign Ledger Budget Line Item**. A meeting report starts on the fraternal activities meetings line, for example **Monthly Council Meetings**.
4. Select **📝 Verify & Sign Expense**.

<!-- KEEP_IMAGE: FS audit desk capture -->
![FS Audit Desk (/expenses/audit)](../generated/dashboard_visual_catalog/expenses_audit.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The report leaves the desk. The member sees **Order Issued**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| No **📝 Verify & Sign Expense** button shows. | You submitted the report, or you do not hold the seat. | Another signer must act. |
| **📝 Verify & Sign Expense** is not available. | No budget line is chosen. | Choose a line in **Assign Ledger Budget Line Item**. |

### 6.3 Give the final release for payment

> **Prerequisite (who can do this):** You must be the council's Grand Knight or a Super Admin. Council Admins read the desk only.
> **Warning:** the final release approves the report for payment.

**Goal:** Give the second signature, which releases the report for payment.

**Start point:** Sidebar → Finances → **GK Expense Authorize**.

**Steps:**
1. Open the ordered report.
2. Check the order and the receipts.
3. Check the line in **Assign Ledger Budget Line Item**. The line starts on the Treasurer's choice.
4. Select **✍️ Final Release for Payment**.

<!-- KEEP_IMAGE: GK authorization desk capture -->
![GK Authorization Desk (/expenses/authorize)](../generated/dashboard_visual_catalog/expenses_authorize.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The member sees **Approved**. The report shows in **Bulk Check Disbursements**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| **🔒 Collusion Guard** shows. | You issued the written order. | Another signer must give the final release. |

### 6.4 Return a report to the member

> **Prerequisite (who can do this):** You must be a council Admin, the Financial Secretary, the Treasurer or a Super Admin.
> **Warning:** a return clears both signatures.

**Goal:** Send a report back for correction.

**Start point:** Sidebar → Finances → **Leadership Auditing Queue**.

**Steps:**
1. Find the report.
2. Select **Reject & Return**.
3. Write the reason. The member reads the reason.
4. Confirm.

<!-- KEEP_IMAGE: leadership auditing queue capture -->
![Leadership Auditing Queue (/expenses/queue)](../generated/dashboard_visual_catalog/expenses_queue.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The member sees a red **Returned** tag with the reason.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The reason is too vague. | The member cannot fix the report. | Name the receipt and the change. |

### 6.5 Pay approved reports by check

> **Prerequisite (who can do this):** You must be the council's Financial Secretary or Treasurer, or a Super Admin. An Admin without a finance role does not see the page.
> **Warning:** a recorded check is permanent money out of the council's books.

**Goal:** Record the checks for dual-signed reports.

**Start point:** Sidebar → Finances → **Bulk Check Disbursements**.

**Steps:**
1. Tick the reports to pay. The page lists only reports with both signatures.
2. Enter the check number and the payout date for each report.
3. Save.

<!-- KEEP_IMAGE: bulk check disbursements capture -->
![Bulk Check Disbursements (/expenses/disbursements)](../generated/dashboard_visual_catalog/expenses_disbursements.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The member sees **Reimbursed** with the check number.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A report is missing. | The report lacks a signature. | Follow the report in the **Leadership Auditing Queue**. |

### 6.6 Concept: the general ledger

The general ledger is a double-entry ledger. Every transaction has debit lines and credit lines that balance.
A shared transaction id groups the lines.

| Page | Shows |
| --- | --- |
| **General Ledger Spreadsheet** | The chart of accounts with every posting |
| **Balance Sheet** | Assets against liabilities and equity |
| **Financial Dashboard** | Cash flow liquidity, the balance sheet summary, **Quick actions** and the **Electronic bank statement audit** |

Seated officers and Admins read the three pages. Only the FS, the Treasurer and Super Admins post, transfer or upload bank statements.

<!-- KEEP_IMAGE: financial dashboard capture -->
![Financial Dashboard (/finance/dashboard)](../generated/dashboard_visual_catalog/finance_dashboard.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: general ledger spreadsheet capture -->
![General Ledger Spreadsheet (/finance/ledger)](../generated/dashboard_visual_catalog/finance_ledger.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: balance sheet capture -->
![Balance Sheet (/finance/balance-sheet)](../generated/dashboard_visual_catalog/finance_balance-sheet.png)
<!-- /KEEP_IMAGE -->

### 6.7 Post to the ledger or reconcile a bank statement

> **Prerequisite (who can do this):** You must be the council's Financial Secretary or Treasurer, or a Super Admin.
> **Warning:** a posting changes the council's books for every reader.

**Goal:** Record a transaction, move funds or match a bank statement.

**Start point:** Sidebar → Finances → **Financial Dashboard** → **Quick actions**.

**Steps:**
1. To post: choose the debit account and the credit account. Enter the amount and the description. Save.
2. To transfer: choose two asset accounts. Enter the amount. Save.
3. To reconcile: open **Electronic bank statement audit**. Upload the bank CSV file.
4. Read the matched rows and the unmatched rows.

**Expected result:** The dashboard shows **✓ Ledger Balanced (Zero Leaks)** when debits equal credits.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The transfer is refused. | The amount exceeds the source account balance. | Lower the amount. |
| The CSV file is refused. | The file has no Date column, or no Amount or Withdrawal/Deposit columns. | Export the statement again with a header row. |
| A bank row stays unmatched. | No posting has the same check number, or the same amount within 5 days. | Post the missing transaction. Upload again. |

### 6.8 Vet a charity request

> **Prerequisite (who can do this):** You must be a seated officer, a Trustee or an Admin of the council, or a Super Admin. The Knight Shepherd never vets the Shepherd's own request.
> **Warning:** a decline stops the request.

**Goal:** Review a member's charity request and move the request forward.

**Start point:** Sidebar → Finances → **Charity Vetting Queue**.

**Steps:**
1. Claim the request.
2. Check the organization, the 501(c)(3) status and the amount.
3. Advance the request, or decline the request.
4. For an advanced request, select **Place on next agenda**.

<!-- KEEP_IMAGE: propose charity grant capture -->
![Propose Charity Grant (/charities/propose)](../generated/dashboard_visual_catalog/charities_propose.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: charity vetting queue capture -->
![Charity Vetting Queue (/charities/vetting)](../generated/dashboard_visual_catalog/charities_vetting.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The request goes on a Monthly meeting at least 10 days away. The council votes in the **Live Meeting Console**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| **Place on next agenda** is refused. | No Monthly meeting is at least 10 days away. | Schedule the meeting. |
| The desk is missing. | The council switched off **Charity proposals**. | Ask a Super Admin. |

### 6.9 Pay an approved charity grant

> **Prerequisite (who can do this):** You must be the council's Financial Secretary or Treasurer, or a Super Admin.
> **Warning:** the check is permanent money out of the council's books.

**Goal:** Pay a grant that the council approved.

**Start point:** Sidebar → Finances → **Charitable Disbursements Ledger**.

**Steps:**
1. Find the request in **Approved requests awaiting payment**.
2. Click **Pay approved request**.
3. Type the **Check number**. Check the **Payout date**.
4. Choose the **Charity type (if not registered yet)**. The portal uses it only when the organization is not in the Global Charities Registry.
5. Optional: type **Notes (optional)**.
6. Click **Issue check for** the approved amount.

The check is always for the amount the council approved. The Knight Shepherd of the request cannot pay it.

<!-- KEEP_IMAGE: charity funding queue capture -->
![Charity funding queue (/charities/queue)](../generated/dashboard_visual_catalog/charities_queue.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The request leaves **Approved requests awaiting payment**. The check is listed against the charity, the charity is added to the registry if it was not there, the request's target budget line is charged, and the Shepherd's **My requests** shows the request as paid.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The request is missing. | The council has not passed the motion. | Check the motion in the meeting. |
| The check is refused with "already recorded check". | The council used that check number before. | Type the next unused check number. |
| The check is refused with "choose its charity type". | The organization is not in the registry yet. | Choose the **Charity type (if not registered yet)**. |

### 6.10 Record or correct a donation

> **Prerequisite (who can do this):** You must be a council Admin, the Treasurer, the Financial Secretary or a Super Admin. The recorder and the event owner may also correct a donation.

**Goal:** Keep the council's donation records complete.

**Start point:** Sidebar → Finances → **Donations History**.

**Steps:**
1. Choose the **Method**, the **Type** and the **Amount**. For items, enter **Estimated value ($)**.
2. Choose the **Date** and the **Event**, or *Standalone (no event)*.
3. Optional: add the **Donor**, a **Description** and a **Photo link**. Items need a description.
4. Save.

<!-- KEEP_IMAGE: recorded donations history capture -->
![Donations History (/donations)](../generated/dashboard_visual_catalog/donations.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The donation shows under **Event donations** or **Standalone donations**. An event card with cash or electronic donations shows **✓ Automatically Logged to Treasury Ledger**.

To see the donations of one event, select its card. The card gets a thick gold border. The page scrolls down to the list of donations for that event.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The date is refused. | An event donation is dated before the event start. | Use a date on or after the event start. |
| The council or the recorder cannot change. | The platform fixes both fields. | Delete the donation. Record the donation again. |

### 6.11 Concept: the annual budget

The budget covers one fraternal year, July 1 to June 30.

| Badge | When | What editors can do |
| --- | --- | --- |
| **Not Yet Open** | Before May 1 | Read only |
| **Draft** | May 1 (00:00) to June 30 (midnight) | Run the rollup, add lines, edit proposed amounts |
| **Finalized** | From July 1 | Read only |
| **Approved** | After the council vote | Frozen for everyone |

- Every member reads the budget. Non-editors see a **Transparency view** marked **Read only**.
- Editors are the council Admins, the Treasurer, the FS, the **Designated Budget Director** and Super Admins.
- Only a Super Admin override changes a budget outside the window. No override reopens an approved budget.

<!-- KEEP_IMAGE: annual budget projections capture -->
![Annual Budget Projections (/budget)](../generated/dashboard_visual_catalog/budget.png)
<!-- /KEEP_IMAGE -->

### 6.12 Prepare the budget with the rollup

> **Prerequisite (who can do this):** You must be a council Admin, the Treasurer, the Financial Secretary, the Designated Budget Director or a Super Admin. The year must be in **Draft**.

**Goal:** Fill the next year's budget from last year's actual spend.

**Start point:** Sidebar → Finances → **Annual Budget Projections**.

**Steps:**
1. Choose the **Fraternal year**.
2. Select **Initialize Automated Prior Year Baseline Rollup**.
3. Type the proposed amount and **Notes** on each line. Each change saves when you leave the box.
4. Pick the **Category** of each line.
5. For a running cost, select **+ Add Custom Council Operational Line**. Enter the **Line item name** and the **Proposed budget amount**.

**Expected result:** Each line shows a **Pre-Populated Baseline**. The rollup reads three sources.

| Source | Baseline |
| --- | --- |
| Each event tagged **Is Annual** | Last year's approved expenses linked to the event |
| Each charity tagged **Is Annual** | Last year's charity checks |
| Last year's custom lines | Last year's approved amount |

A new rollup refreshes the baselines only. The rollup never changes proposed amounts, approved amounts or notes.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| *"The … budget opens for drafting on May 1"* | The window has not opened. | Wait for May 1. |
| An annual event is missing. | The event has no **Is Annual** tag, or the event started outside last year. | Tick **Is Annual**. Run the rollup again. |
| *"…already has a line named…"* | The custom line exists. | Edit the existing line. |

### 6.13 Approve and finalize the budget

> **Prerequisite (who can do this):** You must be a council Admin, the Treasurer, the Financial Secretary or a Super Admin. The Designated Budget Director cannot approve.
> **Warning:** approval freezes the whole year for everyone. Nothing reopens an approved budget.

**Goal:** Record the council's vote on the budget.

**Start point:** Sidebar → Finances → **Annual Budget Projections**.

**Steps:**
1. Check every proposed amount.
2. Select **Approve & Finalize Entire Budget**.
3. Select **Yes, approve and finalize**. You cannot undo this step.

**Expected result:** Each proposed amount becomes the approved amount. The year shows **Approved**. The dashboard gauges use the approved amounts as caps.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The button is greyed out. | The year has no lines, or the year opens after May 1. | Run the rollup first. |

### 6.14 Concept: receipts, split tickets and Honor Vouchers

A report holds one or more receipts. Each receipt has a merchant, a gross total and a receipt file. Each line item names the receipt it comes from.

| Item | What it means | What the signers see |
| --- | --- | --- |
| Receipt | One ticket from one merchant, with its full total and its file. | A **Receipts** table with **R1**, **R2** and so on. |
| Split ticket | One receipt with council items and personal items. The member lists all items and ticks **Personal** on the member's own items. | Personal lines are struck through. The total reads **Council reimburses**. |
| Honor Voucher | The member has no receipt. The member ticks **⚠️ I have no receipt (Honor Voucher)** and writes the reason. | **⚠️ HONOR VOUCHER - NO RECEIPT ATTACHED** with the member's reason. |

- The council pays only the lines without **Personal**. Checks, budgets, asset costs and the balance sheet leave personal lines out.
- On a submitted report, the lines of each receipt must add up to the receipt's gross total.
- On a submitted report, each receipt needs its file. An Honor Voucher lifts this rule. The reason is mandatory.
- The **⚠️ HONOR VOUCHER - NO RECEIPT ATTACHED** badge also shows on a report that has no receipt file at all.
- When receipt reading is connected (10.8), **🔍 Read receipt** fills in the merchant, the total and the lines from the attached photo. The member checks every figure before saving.

> **Warning:** check the reason on every Honor Voucher before you sign. The badge shows on the FS, Treasurer and GK desks and in the **Leadership Auditing Queue**.

---

## 7. Performance

### 7.1 Read the executive dashboard

> **Prerequisite (who can do this):** You must be a seated officer or an Admin of the council, or a Super Admin. Only Admins and Super Admins see the audits.

**Goal:** Review one month of council activity.

**Start point:** Sidebar → Performance → **Executive Dashboard** → **Reports Desk** tab. **Home** shows only this month's four tiles.

**Steps:**
1. Choose the **Month** and the **Year**.
2. Read the four scorecard tiles.
3. Read the **Budget tracking** gauges.
4. Admins: read **Executive audits** for no-shows and shifts that need hours.

<!-- KEEP_IMAGE: executive dashboard capture -->
![Executive Dashboard Summaries (/dashboard)](../generated/dashboard_visual_catalog/dashboard.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: executive audits placeholder -->
![Image: Executive Audits]
<!-- /KEEP_IMAGE -->

**Expected result:** The tiles show four measures.

| Tile | Measures |
| --- | --- |
| **Total labor hours** | Shift hours plus activity hours in the month |
| **Unique Knights participating** | Members who logged any time in the month |
| **Net balance** | Funds raised minus the month's approved expenses and charity checks |
| **Community outreach** | Actual attendees at the month's events |

A budget gauge turns gold at 85% of the cap. The gauge turns red past 100%.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The hours look low. | Members log hours up to 90 days later, by default (section 16.3). | Check the month again later. |
| The gauges show no caps. | The budget is not approved. | Approve the budget (6.13). |

### 7.2 Read the growth and hours charts

> **Prerequisite (who can do this):** You must be a seated officer or an Admin of the council, or a Super Admin.

**Goal:** See membership growth and labor hours over 12 months.

**Start point:** Sidebar → Performance → **Growth & Hours Charts**.

**Steps:**
1. Read the new-members chart. The chart counts active members by join month.
2. Read the labor-hours chart.

**Expected result:** Each chart shows one bar per month.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A new member is missing. | The member has no join date. | Run the Supreme roster sync (10.3). |

### 7.3 Record an event's results

> **Prerequisite (who can do this):** You must be the event owner, an elected officer or Admin of a council linked to the event, or a Super Admin. Other members do not see the event on the ledger.

**Goal:** Close out an event with attendance, funds and lessons.

**Start point:** Sidebar → Performance → **Post-event Ledger** → **Active queue**.

**Steps:**
1. Choose the event with **Results needed**.
2. Enter **Actual attendees**. The event's costs come from the expense reports linked to it, not from this page.
3. Enter **Cash raised ($)** and **Electronic raised ($)** if the fields are open.
4. Write **Highlights** for the monthly summary.
5. Select **Save results**.
6. Add lessons: choose a **Category**. Write **What did we learn?**. Select **Add lesson**.

<!-- KEEP_IMAGE: post-event ledger capture -->
![Post-event Ledger (/ledger)](../generated/dashboard_visual_catalog/ledger.png)
<!-- /KEEP_IMAGE -->

**Expected result:** A message shows *"Results saved."* The event moves to **Historic archive**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The cash fields show **Synced from donations**. | Donations drive the totals. | Correct the donations (6.10). |

### 7.4 Mark or clear a no-show

> **Prerequisite (who can do this):** You must be an Admin of a council linked to the event, or a Super Admin.
> **Warning:** a no-show shows in the member's history and in the executive audits.

**Goal:** Record that a volunteer missed a shift.

**Start point:** Sidebar → Performance → **Post-event Ledger** → the event → **Fraternal Volunteer Turnout Summary**.

**Steps:**
1. Select **Mark no-show** on the volunteer's row.
2. Choose the reason.
3. Select **Confirm**.
4. To remove a mistake, select **Clear** on the row.

**Expected result:** The row shows a red edge and a **No-show** pill.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| **Mark no-show** is missing. | The volunteer logged hours, or the event is not linked to your council. | Correct the hours first. |

### 7.5 Search the lessons registry

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.

**Goal:** Learn from other councils' events.

**Start point:** Sidebar → Performance → **Lessons Registry**.

**Steps:**
1. Filter by text, dates, councils or categories.
2. Read the lessons. Your council's lessons show in gold.

<!-- KEEP_IMAGE: lessons registry capture -->
![Lessons Registry (/lessons-registry)](../generated/dashboard_visual_catalog/lessons-registry.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The newest events show first.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| You cannot edit a lesson here. | The registry is read only. | Edit the lesson on the **Post-event Ledger**. |

---

## 8. Resources and the Google Drive archive vault

### 8.1 Concept: backend logic of the Drive archive vault

The vault files council documents in the council's shared Google Drive. The vault has one root folder and three sub-folders.

| Folder path | Holds | Filled from | Accepted files |
| --- | --- | --- | --- |
| `Fraternal Enterprise Suite / Minutes` | Meeting minutes | **Meeting Center** → **Upload minutes** | PDF, text, Word |
| `Fraternal Enterprise Suite / Vouchers` | Expense receipts | **My Expense Reports** | PDF, images |
| `Fraternal Enterprise Suite / Media` | Event photos and video | **Fraternal Photo Gallery** | Images, video, PDF |

The vault follows five rules.

1. Only Admin and Super Admin uploads go to the vault.
2. The largest accepted file is 25 MB.
3. The record stores only the Drive file id. The id goes in the record's existing link column.
4. The web server holds the Drive credentials. The browser never sees the credentials.
5. Live uploads are off by default. The server needs four settings to turn uploads on.

| Server setting | Value |
| --- | --- |
| `GOOGLE_DRIVE_CLIENT_EMAIL` | The service account email |
| `GOOGLE_DRIVE_PRIVATE_KEY` | The service account private key |
| `GOOGLE_DRIVE_SHARED_DRIVE_ID` | The shared drive id. The service account must be a Content manager. |
| `DRIVE_VAULT_LIVE` | `1` |

> **Security warning:** the portal has no server-side sessions yet. The upload route cannot confirm that the caller is an Admin.
> Set `DRIVE_VAULT_LIVE=1` only behind an authenticating proxy. Without the four settings, the screen keeps a browser link for the file.

### 8.2 Turn on live Drive uploads

> **Prerequisite (who can do this):** You must be the platform's server operator. A Super Admin approves the change.
> **Warning:** an open upload route lets anyone who reaches the server write files to the shared drive.

**Goal:** Send Admin uploads to the shared Google Drive.

**Start point:** The web server's environment settings.

**Steps:**
1. Create a Google service account.
2. Add the service account to the shared drive as a Content manager.
3. Set `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY` and `GOOGLE_DRIVE_SHARED_DRIVE_ID`.
4. Put the portal behind an authenticating proxy.
5. Set `DRIVE_VAULT_LIVE` to `1`.
6. Restart the web server.

**Expected result:** A new Admin upload creates a file under `Fraternal Enterprise Suite`.

A council can use its own Drive private key instead of the server key. A council Admin saves the key on the **Credentials Vault** page (10.8).

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| Files stay as browser links. | A setting is missing, or `DRIVE_VAULT_LIVE` is not `1`. | Check all four settings. |
| *"… is larger than 25 MB."* | The file is too large. | Compress or split the file. |

### 8.3 Open the Council Archive Vault folder

> **Prerequisite (who can do this):** You must be a seated officer, a council Admin or a Super Admin. Members do not see the link.

**Goal:** Open the council's shared Google Drive folder.

**Start point:** Sidebar → Resources → **📂 Council Archive Vault**.

**Steps:**
1. Select **📂 Council Archive Vault**.

**Expected result:** The Drive folder opens in a new browser tab.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| Google Drive refuses access. | Drive sharing settings decide who opens the folder. | Ask the folder owner to share the folder with you. |

### 8.4 Share photos and council artifacts

> **Prerequisite (who can do this):** You must be a signed-in member to read both pages. You must be an Admin or a Super Admin to upload to the gallery vault.

**Goal:** Publish event photos, flyers and minutes for the council.

**Start point:** Sidebar → Resources → **Fraternal Photo Gallery** or **Council Artifacts**.

**Steps:**
1. In the gallery, choose the **Event**.
2. Drag photos onto **Drag and drop photos here**.
3. In **Council Artifacts**, filter the cards with **Show**.

<!-- KEEP_IMAGE: photo gallery capture -->
![Photo gallery (/gallery)](../generated/dashboard_visual_catalog/gallery.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The photos show in the slideshow. **Council Artifacts** shows a card for each meeting flyer, set of minutes, event flyer and event photo album.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A council artifact card is missing. | The meeting or the event has no Drive link. | Add the link on the meeting or the event. |

### 8.5 Ask the Microsoft Co-Pilot for collateral

> **Prerequisite (who can do this):** You must be a seated officer, a council Admin or a Super Admin. Other members do not see the **Marketing Factory**.
> **Warning:** the Microsoft Co-Pilot is an AI service from Microsoft (Copilot Studio). The portal sends your request and the facts of the chosen event to Microsoft.

**Goal:** Get a draft of a notice, a post or other collateral for a council event.

**Start point:** Sidebar → Resources → **Marketing Factory**.

**Steps:**
1. Choose the **Event**.
2. In **🤖 Ask Microsoft Co-Pilot to Design Advanced Collateral**, type what you need. The limit is 2,000 characters.
3. Select **Design Advanced Collateral**. The answer can take up to 30 seconds.
4. Read **The co-pilot's draft**. Check every fact, date and name.
5. Select **Copy the draft**.

**Expected result:** The draft shows under the prompt box.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| **Design Advanced Collateral** is grey. Its tooltip says *"The Microsoft Co-Pilot is not connected yet"*. | The council has no Co-Pilot key in the Credentials Vault. | Select the tooltip's link to the Credentials Vault. A council Admin saves the key there (10.8). |
| *"Microsoft refused the saved Co-Pilot key."* | The key was changed or removed in Copilot Studio. | Ask a council Admin to save the new key (10.8). |
| *"The Microsoft Co-Pilot did not answer in time."* | The agent took more than 30 seconds. | Type a shorter request. Try again. |
| **Rewrite in plain, warm words** shows. | The draft uses business jargon. | Edit the words before you use the draft. |

---

## 9. Answers

### 9.1 Read the feedback inbox

> **Prerequisite (who can do this):** You must have Super Admin privileges.

**Goal:** Read members' feedback and bug reports.

**Start point:** Sidebar → Answers → **Online Help Center** → **Feedback inbox**.

**Steps:**
1. Scroll below **Submit System Feedback or Bug Report**.
2. Read each report. The newest report shows first.

<!-- KEEP_IMAGE: online help center capture -->
![Online Help Center with the Feedback inbox (/help)](../generated/dashboard_visual_catalog/help.png)
<!-- /KEEP_IMAGE -->

**Expected result:** Each report shows the sender's name, council, phone, email and time (UTC).

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The inbox is missing. | Only Super Admins see the inbox. | Ask a Super Admin. |

### 9.2 Publish a standard operating procedure

> **Prerequisite (who can do this):** You must be a platform maintainer with write access to the code repository.
> **Warning:** the SOP Center reads the files when the portal is built. A new SOP shows only after a rebuild.

**Goal:** Add a procedure to the **SOP Center**.

**Start point:** The repository folder `docs/sop/`.

**Steps:**
1. Create a Markdown file in `docs/sop/`.
2. Start the file with a `# ` title.
3. Write each task with **Goal**, **Start point**, **Steps**, **Expected result** and **Common problems**.
4. Rebuild the web portal.

**Expected result:** The SOP shows in Sidebar → Answers → **SOP Center**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The SOP is missing. | The portal was not rebuilt. | Run the web build again. |
| A test fails. | The SOP lacks a title or one of the five headings. | Add the missing heading. |

The SOP Center holds the full procedure: **Publish a standard operating procedure**.

---

## 10. System Settings and the Supreme roster sync

### 10.1 Add a member

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.
> **Warning:** **Add member** sends a welcome email with a setup code at once.

**Goal:** Put a new Brother Knight on the roster.

**Start point:** Sidebar → System Settings → **Affiliated Roster**.

**Steps:**
1. Select **Add member**.
2. Fill in the form. **Email (also the login)** is the member's sign-in name.
3. Choose the **Member type**. Admins grant Admin or Member. Only a Super Admin grants Super Admin.
4. Optional: tick **Designated Budget Director**.
5. Select **Add member**.

<!-- KEEP_IMAGE: affiliated roster capture -->
![Affiliated Roster (/members)](../generated/dashboard_visual_catalog/members.png)
<!-- /KEEP_IMAGE -->

**Expected result:** A message confirms that a welcome email was queued. The member shows a **🆕 New Member** badge for 180 days.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The new member cannot create a password. | The setup code expired after 14 days, or the email is wrong. | Check the email. Select **Send new setup code**. |
| You cannot move a member to another council. | Admins act on their own council only. | Ask a Super Admin. |

### 10.2 Send a new setup code

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.
> **Warning:** a new code replaces the old code.

**Goal:** Help a member who lost or used up the setup code.

**Start point:** Sidebar → System Settings → **Affiliated Roster** → the member.

**Steps:**
1. Open the member's record.
2. Select **Send new setup code**.

**Expected result:** The member gets a new welcome email. The new code is valid for 14 days.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The member already has a password. | A registered member does not need a code. | Tell the member to use **Forgot Password?**. |

### 10.3 Concept: backend logic of the Supreme roster sync

The sync reads the roster export from Supreme Headquarters. The sync adds new members and updates join dates.

- The input is a CSV file with a header row. Save the Supreme Excel export as CSV first.
- The columns are Member Number, First Name, Last Name, Email, Phone, Street, Street 2, City, State, Zip, Birth Date, Degree, Date Joined and Charter Member.
- Admins can download a ready Excel roster template with drop-down lists (14.8).
- Header case and spacing do not matter.
- The file must have the member number, the names, the email and the join date columns.

| Row type | What the sync does |
| --- | --- |
| A new member number | Adds the member with the join date. Sends the welcome email with the Expo Go steps and a setup code. |
| A member number already on the roster | Updates the join date only. Other fields stay unchanged. |
| A row that fails a check | Skips the row. The result names the reason. |

A setup code has 20 characters, expires after 14 days and works one time. The platform stores only a hash of the code.
The platform has no background scheduler. An Admin runs the sync by hand.

### 10.4 Run the Supreme roster sync

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges. The Treasurer and the FS see the page but not the roster panel.
> **Warning:** each new row sends a welcome email at once.

**Goal:** Bring the Supreme roster into the platform.

**Start point:** Sidebar → System Settings → **Supreme Council Sync** → **Supreme roster sync - new member onboarding**.

**Steps:**
1. Save the Supreme Excel export as a CSV file.
2. Choose the file in **Roster file**. You can also paste the rows in **…or paste the export**.
3. Check the row count on the button.
4. Select **Sync *n* roster rows from Supreme**.
5. Read the skipped rows and the reasons.

<!-- KEEP_IMAGE: supreme sync capture -->
![Supreme sync (/supreme-sync)](../generated/dashboard_visual_catalog/supreme-sync.png)
<!-- /KEEP_IMAGE -->

**Expected result:** A message counts the new members, the updated join dates and the skipped rows. Each new member shows a **🆕 New Member** badge.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The file is refused. | A required column is missing. | Add the missing column header. |
| A row is skipped. | The row has a bad email or a missing value. | Correct the row. Sync again. |

### 10.5 File Form 1728 or Form 1295 with Supreme

> **Prerequisite (who can do this):** You must be a council Admin, the Financial Secretary, the Treasurer or a Super Admin.
> **Warning:** **Transmit Report to Supreme via Alchemer API** sends the report to Supreme.

**Goal:** File a Supreme report from the council's records.

**Start point:** Sidebar → System Settings → **Supreme Council Sync**.

**Steps:**
1. Choose the **Supreme form**.
2. Choose a completed **Reporting period**. Form 1728 covers a calendar year. Form 1295 covers a half-year.
3. Check the figures in **Simulate and Audit Compliance Report**.
4. Enter the **Alchemer survey id**.
5. Select **Transmit Report to Supreme via Alchemer API**.

**Expected result:** The attempt shows in **Sync history**. A gold dot marks success. A red dot marks a failure with the reason.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The period is not offered. | The period has not ended. | Wait for the period end. |
| *"The transmission failed and was logged"* | Supreme refused the post. | Read the reason. Correct the figures. Transmit again. |

### 10.6 Find members with a trade skill

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.
> **Warning:** **Send to *n* members** sends a message at once.

**Goal:** Find and message members with a skill.

**Start point:** Sidebar → System Settings → **Affiliated Roster** → **Skills**.

**Steps:**
1. Choose a skill in the **Council skills** drawer.
2. Read **Members with *skill***.
3. Optional: write a note. Select **Send to *n* members**.

<!-- KEEP_IMAGE: skills filter drawer placeholder -->
![Image: Skills Filter Drawer]
<!-- /KEEP_IMAGE -->

**Expected result:** Active members with the skill get the message. Replies arrive in **Council Messages & Alerts**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| *"No member of this council has recorded a skill yet."* | Members have no skills on file. | Ask members to add skills in **My Profile**. |

### 10.7 Keep the council lookup tables

> **Prerequisite (who can do this):** You must be a council Admin or a Super Admin for every tab. The Treasurer and the FS may edit the donation tabs and **Budget categories** only.
> **Warning:** **Save changes** saves every row together. One refused row saves nothing.

**Goal:** Keep the council's own lists.

**Start point:** Sidebar → System Settings → **Council Lookup Tables**.

**Steps:**
1. Open the tab: **Activities**, **Donation types**, **Enabled donation methods**, **Budget categories** or **Meeting Agenda Templates**.
2. Edit the rows. Each changed row shows **Edited**.
3. For a QR method, paste the image link in **QR code image URL**.
4. Select **Save changes**.

<!-- KEEP_IMAGE: council lookup tables capture -->
![Council Lookup Tables (/council-lookups)](../generated/dashboard_visual_catalog/council-lookups.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The changes save. Phones show the new values on the next load.

The outbound email settings are not on this page. Set them on the **Credentials Vault** page (10.8). The base dues rate is not on this page either. A Super Admin sets the rate on **Global System Parameters** (16.8).

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| *"Your role cannot maintain this council's lookups."* | You are on another council, or you have no finance role. | Ask a council Admin. |
| A budget category will not delete. | Budget lines use the category. | Move the lines to another category. |

### 10.8 Connect the council email, Google Drive, Microsoft Co-Pilot and receipt reading

> **Prerequisite (who can do this):** You must be a council Admin or a Super Admin to save or remove a connection. Seated officers see the status lines only. Other members do not see the **Credentials Vault**.
> **Warning:** **Remove** deletes the saved password or key at once. The council goes back to the portal default.

**Goal:** Connect the council's own mail account, Google Drive, Copilot Studio agent and Azure receipt reader.

**Start point:** Sidebar → System Settings → **Credentials Vault**.

**Steps:**
1. Read the status lines at the top. A line with ✓ is a connection that is on.
2. For email, go to the **Outbound email** panel.
3. Choose the **Email service**. Google Workspace and Microsoft 365 fill in the **Mail server**.
4. Enter the **Sign-in email** and the **Password**. Use an app password if the service asks for one.
5. Select **Save**.
6. For Google Drive, paste the key in **Drive key** in the **Google Drive** panel. Select **Save**.
7. For the Microsoft Co-Pilot, paste the Direct Line secret in **Co-Pilot key**. Select **Save**. Copilot Studio shows the secret under Settings → Security → Web channel security.
8. For receipt reading, open the council's Azure Document Intelligence resource in the Azure portal. Go to **Keys and Endpoint**.
9. Paste the endpoint in **Azure endpoint**. Select **Save**. The endpoint looks like `https://name.cognitiveservices.azure.com/`.
10. Paste **KEY 1** in **Azure key**. Select **Save**.

**Expected result:** The status line of each saved connection shows ✓. **Receipt reading** shows ✓ only when both Azure values are saved. The page never shows a saved password or key again.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The panels are missing. | You are an officer but not an Admin. | Ask a council Admin. |
| A message about the mail server or the sign-in email shows. | The mail server name or the email is not valid. | Copy both values from your mail service. |
| Saved keys stop working after a server restart. | The server has no fixed vault secret. | Ask the server operator to set `CREDENTIALS_VAULT_SECRET`. Save the keys again. |
| A message says the endpoint must be a cognitiveservices.azure.com address. | The value is not the Azure endpoint. | Copy **Endpoint** from **Keys and Endpoint**. |

### 10.9 Keep the global lists, councils, parishes and charities

> **Prerequisite (who can do this):** You must be a Super Admin for **Global Governance Matrices** and **Councils**. You must be a council Admin or a Super Admin for **Parish & Pastors Linkage**. You must be a charity registry keeper for **Global Charities Registry**.
> **Warning:** a value marked **Built in** cannot be renamed or deleted.

**Goal:** Keep the lists that every council shares.

**Start point:** Sidebar → System Settings.

**Steps:**
1. Open the page.
2. Edit the row.
3. Save.

<!-- KEEP_IMAGE: global governance matrices capture -->
![Global Governance Matrices (/lookups)](../generated/dashboard_visual_catalog/lookups.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: councils capture -->
![Councils (/councils)](../generated/dashboard_visual_catalog/councils.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: parishes and pastors capture -->
![Parishes and pastors (/parishes)](../generated/dashboard_visual_catalog/parishes.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: global charities registry capture -->
![Global Charities Registry (/charities/registry)](../generated/dashboard_visual_catalog/charities_registry.png)
<!-- /KEEP_IMAGE -->

The base dues rate, the tenant type and the **Platform Settings** are not on **Global Governance Matrices**. A Super Admin sets them on **Global System Parameters** (sections 16.5 to 16.8).

**Expected result:** Every council sees the new value.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| Finance officers lost access. | A role named Treasurer or Financial Secretary was renamed. | Restore the exact role name. |

---

## 11. Data protection rules

- **Nothing cascades.** The platform refuses to delete a record that other records use. The message names the record in use.
- Examples: a shift with sign-ups, a member with logged hours, a lookup value in use.
- One exception: a deleted distribution list also deletes the list's member entries.
- **Time windows** protect records. Shift hours and activity hours close after the council's logging window. The default is 90 days (section 16.3).
- **Approved budgets** are frozen for everyone.

---

## 12. Troubleshooting reference

| Symptom or message | Cause | Fix |
| --- | --- | --- |
| A page is missing from the sidebar | Your role has no access, or a feature flag is off. | Check section 1 and section 3. |
| An officer desk is missing from the sidebar | Your role cannot open the desk. | Ask the seat holder. |
| *"…cannot …"* refusal on save | You act outside your council or role. | Switch the **Council** selector, or ask a Super Admin. |
| Delete refused (record in use) | Other records depend on the record. | Clear the dependants first, or keep the record. |
| Shift date refused | The date is outside the event dates. | Adjust the shift date or the event dates. |
| Cash fields locked on the ledger | Donations drive the totals. | Correct the donations. |
| Budget inputs greyed out | The year is **Not Yet Open**, **Finalized** or **Approved**. | Edit only from May 1 to June 30. |
| **Transparency view** on the budget | You are not a budget editor. | Ask a council Admin to tick **Designated Budget Director**. Sign in again. |
| New member cannot create a password | The setup code expired or the email is wrong. | Select **Send new setup code**. |
| Roster sync file refused | A required column is missing. | Check the CSV header (10.3). |
| Drive uploads stay as browser links | Live uploads are off. | See 8.2. |
| **Edit bylaws** missing | You are not the GK or an Admin. | Ask the Grand Knight. |
| *"Decide the open ballot first"* | A ballot is still open. | Decide the open motion. |

Quick answers are also in **Answers → Online Help Center**.

---

## 13. Automated messages reference

> **Delivery in this version:** the platform prepares emails and texts. The email and text services are not connected yet.
> High-priority alerts always reach each recipient's bell. Use the screens in the **Where to follow** column.

> **Hybrid messaging rule:** an email or a text is only a short nudge. The nudge sends the member back to the platform.
> Conversations stay in **Council Messages & Alerts**. Audit notes stay in the **General Ledger** and on the desks.
> Decisions stay on the status tags and desks. No dollar amount, audit finding or private reason goes by email or text.

### Charity grant requests

| Step | Message | Recipient | Where to follow |
| --- | --- | --- | --- |
| Request filed | A tracking message with the three steps and the follow-up date | The Knight Shepherd | **Charity Vetting Queue** |
| 1. Vetting | None | — | **Charity Vetting Queue** |
| 2. Presentation | None | — | The meeting agenda and the **Live Meeting Console** |
| 3. Disbursement | None | — | **Charitable Disbursements Ledger** |
| 6 months after filing | The Trustees ask the Shepherd for a status report. The app sends no reminder. | The Trustees | The date in the Shepherd's tracking message |

### Expense reports

The platform sends no message when an expense report changes status. The member reads the status tag. Officers follow the desks (6.1).

### Volunteer service and onboarding

| Trigger | Message | Recipient | Where to follow |
| --- | --- | --- | --- |
| A shift starts in 24 hours | A reminder email with a calendar file | Every volunteer on the shift | The event's shift roster |
| A meeting starts in 24 hours | A reminder email with a calendar file and the agenda | Every invitee | **Meeting Center** |
| Day 5 after a shift with no hours (the council can change the day, section 16.3) | A text reminder | The volunteer | **Executive Dashboard** → **Reports Desk** → **Shifts awaiting hours** |
| Every 7 days after that (the council can change the days, section 16.3) | A follow-up text, until the shift is older than the logging window (90 days by default) | The volunteer | Same panel. The row shows **Closed** when the window ends. |
| An officer sends an urgent alert | A phone push alert and a bell entry, kept 6 months | Members with the chosen skills or shifts | **Council Messages & Alerts** → **Dispatch High-Priority Push Notification Alert** |
| A member is added or synced | A welcome email with the app steps and a setup code | The new member | The confirmation on **Affiliated Roster** or **Supreme Council Sync** |
| A member requests a password reset | An email with a 6-digit code, valid 15 minutes | The member | None. The member resets the password alone. |

Only the Financial Secretary, the Treasurer, council Admins and Super Admins see the urgent alert tile.

<!-- KEEP_IMAGE: council messages and alerts capture -->
![Council Messages & Alerts (/messages)](../generated/dashboard_visual_catalog/messages.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: distribution lists capture -->
![My Distribution Lists (/distribution-lists)](../generated/dashboard_visual_catalog/distribution-lists.png)
<!-- /KEEP_IMAGE -->

---

## 14. Member engagement and the roster lifecycle

### 14.1 Concept: the Shared Member Center

The **Shared Member Center** shows every member how the council is doing. The page has no money on it.
Cash, budgets and the general ledger stay on the **Executive Dashboard** and the Finances pages. Plain members cannot open those pages.

| Card | What the card shows |
| --- | --- |
| **Council volunteers** | The month's volunteer count, the hours served and the name of each member who served |
| **Our combined devotions** | The rosaries, hours of adoration and confessions of all members, added together |
| **Top 5 Volunteers Leaderboard** | The 5 active members with the most hours ever logged at council events and activities |
| **My impact** | The reader's own events attended, personal hours, canonization shield and council history |

- The combined devotions show only totals. No card shows the devotions of one member.
- Members with equal hours share a place on the leaderboard.
- A white-label organization does not see the devotions card or the shield.

### 14.2 Open the Shared Member Center

> **Prerequisite (who can do this):** Every active member of the council. A Super Admin opens the page for the Super Admin's own council.

**Goal:** See the council's month and your own impact.

**Start point:** Sidebar → Performance → **Shared Member Center**. On the phone: Home → **Open the Member Center**.

**Steps:**
1. Choose the **Month** and the **Year**. The phone always shows the current month.
2. Read the **Council volunteers** card.
3. Read **Our combined devotions** and the **Top 5 Volunteers Leaderboard**.
4. Read the **My impact** card.

**Expected result:** The cards show the month's volunteers and your own figures.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A volunteer is missing from the month. | The volunteer did not log hours yet. | Ask the volunteer to log the hours. Hours close after the logging window, 90 days by default. |
| The devotions card shows 0. | No member logged devotions on the phone. | Tell members about **My devotions** on the phone Home screen. |

### 14.3 Concept: personal impact and the canonization shield

The **My impact** card shows three personal measures.

| Measure | How the platform counts the measure |
| --- | --- |
| **Events attended** | The events where the member logged shift hours, each event counted one time |
| **Personal hours** | All shift hours and activity hours the member logged |
| Canonization shield | The member's level, from the logged hours and events against the council's thresholds |

The shield has four levels. A member reaches a level when both the hours and the events meet the level's share.

| Level | Share of both thresholds |
| --- | --- |
| Servant of God | The starting level |
| Venerable | One third |
| Blessed | Two thirds |
| Saint | The full thresholds |

- The default thresholds are 100 hours and 10 events.
- Devotions do not change the shield. The shield counts logged service only.
- The member logs devotions on the phone: Home → **My devotions** → **Log devotions**. Only the member sees the member's own tally.

### 14.4 Set the canonization shield thresholds

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.

**Goal:** Set the hours and events that make a Saint in your council.

**Start point:** Sidebar → Performance → **Executive Dashboard** → **Reports Desk** → **Top 5 Volunteers Leaderboard**.

**Steps:**
1. Find **Canonization shield thresholds** under the leaderboard.
2. Enter the **Hours**. Use a whole number from 1 to 10,000.
3. Enter the **Events**. Use a whole number from 1 to 1,000.
4. Select **Save**.

**Expected result:** The message **Shield thresholds saved.** shows. Every member's shield uses the new thresholds at once.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The thresholds are refused. | A value is 0, a decimal or too large. | Enter a whole number in the allowed range. |
| You do not see the thresholds. | Only Admins and Super Admins set the thresholds. | Ask a council Admin. |

### 14.5 Read the monthly activity overview

> **Prerequisite (who can do this):** You must be a seated officer or an Admin of the council, or a Super Admin.

**Goal:** See the month's volunteers next to the cash collected.

**Start point:** Sidebar → Performance → **Executive Dashboard** → **Reports Desk** tab.

**Steps:**
1. Choose the **Month** and the **Year**.
2. Read the navy **Monthly activity overview** card.
3. Read the **Top 5 Volunteers Leaderboard** beside the overview.

**Expected result:** The overview shows the volunteer count, the cash collected, the hours served and each volunteer's name.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The cash collected differs from the deposits. | The overview counts the cash raised at the month's events. | Check the **Financial ledger** panel on the same page. |

### 14.6 Concept: the council membership history

The platform keeps a history of every council that a member belongs to. The history does not change when a member moves.

| Event | What the history records |
| --- | --- |
| A member is added or synced | A new membership in the council, from the join date when known |
| A Super Admin moves a member to another council | The old membership closes as **Former**. A new **Active** membership opens in the new council. |
| A status changes in the same council | The open membership shows the new status. **Deceased** or **Former** also closes the membership. |

- A transferred member is always **Active** in the new council.
- A transfer takes the member off the old council's distribution lists.
- A transfer puts the member on the new council's council-wide distribution lists.
- A member marked **Deceased** or **Former** leaves every distribution list.
- A new member joins the council-wide distribution lists of the member's council.
- A member added before the history began shows the current council only, from the join date.

### 14.7 Read a member's council membership history

> **Prerequisite (who can do this):** You must have council Admin privileges for the member's council, or Super Admin privileges. A member reads the member's own history on the **Shared Member Center**.

**Goal:** See every council a member belonged to.

**Start point:** Sidebar → System Settings → **Affiliated Roster** → the member.

**Steps:**
1. Select the member's name in the roster.
2. Read the **Council membership history** card under the member form.

**Expected result:** The card lists each council, oldest first, with the status, the date joined and the date left. The current membership shows **current**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| You cannot move a member to another council. | Only a Super Admin moves members between councils. | Ask a Super Admin. |
| The join date shows **Not recorded**. | The member has no join date. | Enter the **Date joined council** on the member form. |

### 14.8 Download the Excel roster template

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.
> **Warning:** each new row sends a welcome email at once when you sync the roster.

**Goal:** Build a roster file by hand in Excel and load the file.

**Start point:** Sidebar → System Settings → **Supreme Council Sync** → **Supreme roster sync - new member onboarding**.

**Steps:**
1. Select **Download the Excel roster template**.
2. Open the file in Excel. Row 2 is a sample. Replace the sample with a real member.
3. Fill one row for each member. Use the drop-down lists for **Role**, **Degree** and **Charter Member**.
4. Read the **Instructions** sheet for the rules of each column.
5. Save the **Roster** sheet as CSV (File → Save As → CSV UTF-8).
6. Load the CSV file in **Roster file**.
7. Select **Sync *n* roster rows from Supreme**. Each new member gets a welcome email at once.

**Expected result:** A message counts the new members, the updated join dates and the skipped rows.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A member's office is not set. | The sync does not assign offices from the **Role** column. | Fill offices through the elections and the Grand Knight's appointments. |
| Excel refuses a value. | The value is not on the drop-down list or is not a date. | Choose a value from the list. Enter dates as YYYY-MM-DD. |
| A **Charter Member** mark is missing. | The cell was not **Yes**. | Tick **Charter member** on the member form. |

### 14.9 Check for inactive members (the inactivity sweep)

> **Prerequisite (who can do this):** You must have council Admin privileges for the council, or Super Admin privileges.
> **Warning:** the check changes the status of many members at once. The check has no undo button.

**Goal:** Mark members **Inactive** after more days without logged service than the council allows.

**Start point:** Sidebar → System Settings → **Council Wide Settings** → **Roster Inactivity Sweep** card.

The **Roster Inactivity Sweep** card is the only place to run the check. The roster page and the **Financial Secretary Desk** do not show the button.

**Steps:**
1. Check the number of days in **Days without service before a member counts as inactive** (section 16.3). The default is 365 days.
2. Scroll to the **Roster Inactivity Sweep** card.
3. Select **🔍 Check for Inactive Members**. The check starts at once. You cannot undo the check.
4. Read the message. The message names each member marked **Inactive**.

**Expected result:** Each named member shows **Inactive** in the roster.

The sweep follows these rules:
- The sweep checks active members of the type **Member** only. The sweep never changes an Admin or a Super Admin.
- The sweep counts shift hours and activity hours. A member with no hours is measured from the join date.
- The sweep skips a member with no hours and no join date.
- The platform has no background scheduler. An Admin runs the check by hand.
- The council sets the number of days in **Days without service before a member counts as inactive**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A member was marked **Inactive** by mistake. | The member served but did not log hours. | Set the member's **Status** to **Active** on the member form. Ask the member to log hours. |
| A quiet member stays **Active**. | The member has no join date, or is an Admin. | Enter the **Date joined council**. Change an Admin's status by hand. |
| The card says *"Only the council's Admins and Super Admins run the sweep."* | Officers may open **Council Wide Settings**, but only Admins run the check. | Ask a council Admin to run the check. |

---

## 15. Volunteer time quarantine

### 15.1 Concept: the volunteer time quarantine

The volunteer time quarantine protects the council's hour totals from over-reporting.
The platform holds some hour entries for leadership review. A held entry is in quarantine.
A held entry does not count anywhere until a leader clears it. The rule covers these totals:

- The council's monthly summary and the **Executive Dashboard** hours.
- The member's canonization shield and personal hours.
- The **Top 5 Volunteers Leaderboard** and the **Shared Member Center**.

The member sees this message when the platform holds an entry: "... hours sent to leadership review before they count toward your totals."
The message also gives the reason.

### 15.2 Concept: the 5/5 over-reporting rules

The platform holds a regular member's entry when either 5/5 rule applies.
The numbers 5 and 5.0 are the defaults. Each council can change them in **Council Wide Settings** (section 16.3).

| Rule | The platform holds the entry when | Example |
| --- | --- | --- |
| **5 activities** | The entry is the member's sixth different activity on the same day. | A member logs 5 activities on Saturday. The sixth activity on Saturday goes to review. |
| **5.0 hours** | The entry puts more than 5.0 hours against one activity on one day. | A member logs 3 hours of **Food drive**. A second entry of 2.25 hours on the same day goes to review. |

The two rules count in this way:
- A shift counts on the shift date. A council activity counts on the activity date.
- Held entries count toward both rules. A member cannot split hours to get past a rule.
- A second entry on an activity that the member already logged that day is not a new activity.
- On the phone **Report** tab, taps past a rule go to one held entry. The hours logged before the limit still count.

### 15.3 Concept: the +1 hour shift padding rule

A regular member may report up to 1.0 hour more than the scheduled shift. Set-up and clean-up often take extra time.
The 1.0 hour is the default. Each council can change it in **Extra hours allowed past a scheduled shift** (section 16.3).
The platform holds a shift report that is more than 1.0 hour over the scheduled length.

| Scheduled shift | Largest report that counts at once | Report that goes to review |
| --- | --- | --- |
| 08:00 to 11:00 (3 hours) | 4 hours | 4.25 hours or more |
| 18:00 to 20:00 (2 hours) | 3 hours | 3.25 hours or more |

A shift report of more than 5.0 hours also goes to review under the 5.0-hour rule. A new report on the same shift replaces the member's report that waits for review.

### 15.4 Concept: who the rules do not apply to

The rules apply to regular members only. These members are exempt. The platform always logs their hours at once:

| Exempt member | Why |
| --- | --- |
| Admins and Super Admins | They keep the council records. |
| Elected officers: Grand Knight (GK), Deputy Grand Knight (DGK), Chancellor, Recorder, Treasurer, Warden, Advocate, Inside Guard and Outside Guard | The council elected them to lead. |
| Trustees 1, 2 and 3 | The council elected them too. |
| The owner of the event | The owner runs the shift. The exemption covers only the shifts of the owner's own event. |

Appointed officers, such as the Financial Secretary (FS), follow the rules.

A Super Admin can switch the quarantine off. The Super Admin turns off **Volunteer time quarantine** in the Feature Flags Control Center (section 3).
When the switch is off, every entry counts at once. The desk is hidden. Entries that wait for review stay in quarantine until the switch is on again.

### 15.5 Approve or reject held volunteer time

> **Prerequisite (who can do this):** The Grand Knight (GK), the Deputy Grand Knight (DGK) or an Admin of the council, or a Super Admin. Other members do not see the desk.
> **Warning:** each decision is final. You cannot change an approved or rejected entry on the desk.

**Goal:** Decide each held entry, so that true hours count and false hours never count.

**Start point:** **Active Desks** row → **Oversight Desk** → **🚨 Volunteer Time Quarantine Desk**. On **Home**, the **[ ⚠️ 2 Items Quarantined ]** badge opens the same desk.

**Steps:**
1. Read the count of pending entries in the desk header.
2. Read each entry: the member name, the shift or activity, the date and the hours.
3. Read the **Description** that the member wrote. Read the red reason under the description.
4. Ask the member or the event owner about the time when the entry is not clear.
5. Select **[ 🟢 Approve & Add to Time Log ]** for true hours. The hours count in every total at once.
6. Select **[ 🔴 Reject & Remove ]** for false hours. The hours never count. You cannot undo this.

**Expected result:** The entry leaves the desk. A message confirms the decision. An approved entry shows in the council's hours and on the member's shield.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The desk is not on the dashboard. | Your role is not GK, DGK or Admin, or the quarantine switch is off. | Ask a Super Admin to check your role and the **Volunteer time quarantine** switch. |
| The desk says "has switched Volunteer time quarantine off". | A Super Admin opened another council, and that council has the switch off. | Turn the switch on for that council, or choose another council. |
| An approved shift report replaced other hours. | A member has one report for each shift. Approval writes the held report over the old one. | Ask the member to report the correct hours again. |
| An approved activity entry is missing. | Someone deleted the activity after the member logged the time. | Restore the activity. Ask the member to log the time again. |
| A member says the hours are lost. | The entry waits on the desk. | Decide the entry. Tell the member that held hours count after a leader approves them. |

---

## 16. Council Wide Settings and platform settings

### 16.1 Concept: council settings and platform settings

Some numbers belong to one council. Other numbers belong to every council at once.

| Kind | Who changes it | Where | What it holds |
| --- | --- | --- | --- |
| Council Wide Settings | The council's Admins and officers, or a Super Admin | Sidebar → System Settings → **Council Wide Settings** | The volunteer time limits, the time windows and the reminder timing of one council. The **Roster Inactivity Sweep** card (council Admins and Super Admins run it). |
| Platform Settings | Super Admins only | Sidebar → System Settings → **Global System Parameters** → **Platform Settings** | The invitation lead time, the sign-in length, the record retention, the recording time limit and two character limits for every council |
| Base dues rate and tenant type | Super Admins only | Sidebar → System Settings → **Global System Parameters** → **Global Council Parameters Dashboard** | The dues rate and the organization type of one council |

A new council starts with the default values. A change applies to the next entry that a member saves. A change never moves hours that are already logged or held.

The time windows and reminder days were fixed numbers in earlier versions. Each council now sets its own numbers.

The page address is `/system-settings/council-settings`. Every administration and setup page sits under the System Settings pillar. An old bookmark to `/setup/council-settings` opens the new address.

### 16.2 Concept: the setting cards and the (i) help

Both settings pages group the fields into cards. Each card has a navy title bar and its own save button.

| Page | Cards, in order |
| --- | --- |
| **Council Wide Settings** | **Financial Submissions**, **Volunteer & Meeting Operations**, **Reminder Cadences** |
| **Global System Parameters** → **Platform Settings** | **Reminder Cadences**, **Sign-in & Records**, **Recording & Text Limits** |

Each field has a round **(i)** button beside its label. Select **(i)** to open a help window. The help window tells where the number is used and what the number changes. The help window also shows the allowed values. Select **Close**, press **Esc** or select outside the window to close it.

Some fields show a red **Not used yet** tag. The portal saves the number for a future feature. The number changes nothing today. The help window of the field says the same.

<!-- KEEP_IMAGE: council wide settings capture -->
![Council Wide Settings (/setup/council-settings)](../generated/dashboard_visual_catalog/setup_council-settings.png)
<!-- /KEEP_IMAGE -->

The screenshot above shows the page before the cards were added. The fields and their labels are the same.

### 16.3 Concept: the council settings

**Financial Submissions** card:

| On-screen label | Default | Allowed values | What the setting controls |
| --- | --- | --- | --- |
| **Days after an event or meeting to submit expenses** | 30 days | 1 to 365 | The expense filing window (section 6). A report that names an event or a meeting can be submitted from its first day through this many days after it ends. |
| **Days before an unsubmitted expense draft expires** | 90 days | 7 to 730 | **Not used yet.** Drafts do not expire today. |
| **Days a charity proposal stays open for a vote** | 14 days | 1 to 90 | **Not used yet.** The council votes at the next Monthly meeting at least 10 days away. |

**Volunteer & Meeting Operations** card:

| On-screen label | Default | Allowed values | What the setting controls |
| --- | --- | --- | --- |
| **Most activities a member may report in one day** | 5 | 1 to 24 | The 5-activity rule (section 15.2) |
| **Most hours a member may report on one activity in one day** | 5.0 hours | 0.25 to 24, in quarter hours | The 5.0-hour rule (section 15.2) |
| **Extra hours allowed past a scheduled shift** | 1.0 hour | 0 to 8, in quarter hours | The shift padding rule (section 15.3) |
| **Days without service before a member counts as inactive** | 365 days | 30 to 3,650 | **🔍 Check for Inactive Members** (section 14.9) |
| **Days back a member may log volunteer time** | 90 days | 7 to 730 | The logging window. A member may log shift time and activity time this many days back. |
| **Hours before an event that gate donations open** | 2 hours | 0 to 72, in quarter hours | How long before an event begins the phone's **Donate** screen offers it for gate donations. With 0, an event is offered only once it is under way. Members may still sign up until a shift ends. |
| **Days after a meeting that the minutes are due** | 7 days | 1 to 60 | The **Recorder Desk** counts down to the due date: the meeting's last day plus this number. Minutes not published by then show as overdue. |
| **Days of notice before a special election** | 60 days | 1 to 365 | **Not used yet.** A mid-year nomination stays open for 14 days. |

**Reminder Cadences** card:

| On-screen label | Default | Allowed values | What the setting controls |
| --- | --- | --- | --- |
| **Days after a shift before the first hours reminder** | 5 days | 1 to 60 | The first text reminder to a volunteer with no logged hours (section 13) |
| **Days between follow-up hours reminders** | 7 days | 1 to 60 | The follow-up text reminders (section 13) |
| **Days before an officer is reminded to sign an expense report** | 3 days | 1 to 60 | **Not used yet.** No signature reminder is sent today. |

A value of 0 for **Extra hours allowed past a scheduled shift** sends every report longer than the scheduled shift to review.

The logging window replaces two older limits: 3 months for shift time and 6 months for activity time. A council that wants the old activity limit can enter `183` days.

The logging window also ends the hours reminders. A shift older than the window shows **Closed** on the **Shifts awaiting hours** panel, and the reminders stop.

### 16.4 Change the Council Wide Settings

> **Prerequisite (who can do this):** You must be a council Admin or a council officer of the council, or a Super Admin. Other members do not see this page.

**Goal:** Set your council's volunteer time limits, time windows and reminder timing.

**Start point:** Sidebar → System Settings → **Council Wide Settings**.

**Steps:**
1. Super Admins only: choose the council in **Council** at the top of the page.
2. Find the card that holds the setting (section 16.3).
3. Optional: select **(i)** beside the field to read what the setting does. Select **Close**.
4. Enter the new number.
5. Select the save button of the card, for example **Save Financial Submissions**.

**Expected result:** A message says "Saved for council" with the council number. The new numbers apply from now on.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The page is not in the sidebar. | You are not an Admin or an officer of the council. | Ask a council Admin to make the change. |
| A number in another card went back to its old value. | Each card saves only its own fields. | Enter the number again and select the save button of that card. |
| The message says the value "must be a multiple of 0.25 hours". | Hours use 15-minute steps. | Enter a value such as `4.5` or `4.75`. |
| The message says the value must be "from" one number "to" another. | The value is outside the allowed range (section 16.3). | Enter a value inside the range. |
| The message says "Nothing changed." | Every number in the card is the same as the saved value. | Change a number, then save. |
| A field with **Not used yet** has no effect. | No feature reads the number yet. | No fix is needed. Keep the default. |

### 16.5 Concept: the Global System Parameters page

The **Global System Parameters** page holds the numbers that sit above the settings of one council. Only Super Admins see the page.

| Card | What the card holds | Applies to |
| --- | --- | --- |
| **Global Council Parameters Dashboard** | The base dues rate and the tenant type (Knights of Columbus council or a white-labelled organization) | One council at a time |
| **Platform Settings** | Three cards of numbers (section 16.6) | Every council at once |

The **Platform Settings** card had the name **Platform Limits** in earlier versions. The cards were on **Global Governance Matrices** before that. The **Feature Flags Control Center** holds only the on/off module switches.

### 16.6 Concept: the platform settings

| Card | On-screen label | Default | Allowed values | What the setting controls |
| --- | --- | --- | --- | --- |
| **Reminder Cadences** | **Days before a scheduled meeting that invitations appear** | 5 days | 1 to 60 | When the invitations of a cadence meeting reach the members (section 4). Meetings that are already built keep their release dates. |
| **Sign-in & Records** | **Hours a portal sign-in lasts** | 8 hours | 1 to 168 | When the portal server ends a web sign-in. The member then signs in again. |
| **Sign-in & Records** | **Days to keep audit records** | 180 days | 30 to 3,650 | **Not used yet.** The portal keeps every record today. |
| **Recording & Text Limits** | **Oral history recording time limit** | 900 seconds | 60 to 3,600 | The oral history recorder |
| **Recording & Text Limits** | **Diary entry character limit** | 4,000 characters | 100 to 4,000 | The spiritual diary and the testimonial note |
| **Recording & Text Limits** | **Prayer intention character limit** | 500 characters | 50 to 500 | The Council Prayer Intentions List |

A sign-in that already started keeps its old end time. The new sign-in length applies from the next sign-in.

### 16.7 Change the platform settings

> **Prerequisite (who can do this):** You must be a Super Admin.
> **Warning:** the settings apply to every council at once.

**Goal:** Set the numbers that every council shares.

**Start point:** Sidebar → System Settings → **Global System Parameters** → **Platform Settings**.

**Steps:**
1. Find the card that holds the setting (section 16.6).
2. Optional: select **(i)** beside the field to read what the setting does. Select **Close**.
3. Enter the new number.
4. Select the save button of the card, for example **Save Sign-in & Records**. The new numbers apply to every council at once.

**Expected result:** A message says "Platform settings saved." When you change **Hours a portal sign-in lasts**, the message also says that the portal server uses the new sign-in length from the next sign-in.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A character limit does not go above its default. | The default is the largest size that the council records can store. | Keep the limit at the default or lower. |
| A recording stopped early. | The recording time limit is lower than the speaker needed. | Raise the limit. The largest value is 3,600 seconds (60 minutes). |
| The message says that the portal server did not take the new sign-in length. | Your web sign-in on the server ended. | Sign out. Sign in again. Save the number again. |
| Meeting invitations still appear 5 days before the meeting. | The meetings were built before the change. | No fix is needed. Meetings built after the change use the new number. |

### 16.8 Set a council's base dues rate and tenant type

> **Prerequisite (who can do this):** You must be a Super Admin.
> **Warning:** a new tenant type changes the sidebar and the labels of every member of the council at once.

**Goal:** Set the base dues rate and the tenant type of one council.

**Start point:** Sidebar → System Settings → **Global System Parameters** → **Global Council Parameters Dashboard**.

**Steps:**
1. Choose the council in **Council**.
2. Choose the **Tenant type**: `KOFC` or `GENERIC`.
3. Enter the **Base dues rate** in dollars.
4. Select **Save council parameters**.

**Expected result:** A message shows the council number, the tenant type and the new base dues. The dues forecast uses the new rate.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The message says "Enter a base dues rate." | The rate box is empty. | Enter the rate, then save. |
| The Faith Center and the Supreme Council Sync left the sidebar. | The tenant type is a white-labelled organization. | Choose the Knights of Columbus tenant type again. |

---

## 17. Access requests, check payments, asset photos, impersonation and remote help

### 17.1 Concept: council access requests

A council that is not on the platform can ask for access from the sign-in page. The sign-in page has a **🏢 Register Your Council / Request Access** button on the web and on the phone.

The form asks for four items: the council name, a contact email, the city and the state. Anyone can send the form. The person does not need an account.

The platform saves each request as **Pending**. The platform also emails a notice to `council15295@stmarys.org`. Super Admins read the requests in the **Inbound Council Mail Center** card on the **Oversight Desk** of the dashboard.

Approving a request marks the request as reviewed. Approving does not create the council. A Super Admin adds the council on the **Councils** page.

| Rule | Value |
| --- | --- |
| Requests from one contact email | 3 in one hour |
| Requests from one network address | 10 in one hour |
| Status values | Pending, Approved |

> The web portal keeps requests on the portal server. A server restart clears them until the production database is connected. A request sent from the phone stays on that phone.

### 17.2 Approve a council access request

> **Who can do this:** Super Admins. Other members do not see the Inbound Council Mail Center.

**Goal:** Mark a council's access request as reviewed.

**Start point:** **Active Desks** row → **Oversight Desk** → **Inbound Council Mail Center**. On **Home**, the **📨 Access Requests** badge opens the same desk.

**Steps:**
1. Read the council name, the city, the state and the contact email of the request.
2. Select the contact email to write to the council, if you need more information.
3. Select **Approve**.
4. Open Sidebar → System Settings → **Councils** to add the council.

**Expected result:** The request shows a gold **Approved** label. The pending count in the card title goes down by 1.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The card says "No council has asked for access yet." | No request reached the portal server. | Ask the council to send the form again from the web sign-in page. |
| The card shows an error about the session. | Your server session ended. | Sign out, then sign in again. |

### 17.3 Concept: payment methods in the ledger

The ledger records how money came in. The **Payment method** list on the revenue card uses the same payment methods as the donation screens.

| Payment method | Kind | Check number |
| --- | --- | --- |
| Cash | Paper money | No |
| Credit Card | Card payment | No |
| Venmo | Electronic payment by QR code | No |
| Zelle | Electronic payment by QR code | No |
| Zeffy | Electronic payment by QR code | No |
| Parishsoft | Electronic payment by QR code | No |
| Check | Paper check | Yes, required |

- The list shows only the methods that the council turned on. An Admin turns methods on in Sidebar → System Settings → **Council Lookup Tables**.
- **Physical Items** is never a payment method, because items are not money.
- An older ledger line, or a line that is not a payment, has no payment method.

A donation by check counts in the cash column of the event, because the council deposits checks with the cash. The donation records the check number too (section 17.3.1).

### 17.3.1 Concept: check numbers on donations

A donation by check now records the number printed on the check. The number helps the Financial Secretary match each check to the bank deposit.

- On the phone, the **Donate** tab shows a **Check** tile when the council turned Check on. The Check form has a **CHECK NUMBER (REQUIRED)** field.
- On the web, the **Donations History** form shows a **Check number** field when **Check** is the method.
- A donation by check cannot be saved without a check number. A donation by any other method cannot have a check number.

### 17.3.2 Record a donation by check on the phone

> **Who can do this:** Every member who takes donations.

**Goal:** Record a check donation with its check number.

**Start point:** Phone → **Donate** tab.

**Steps:**
1. Tap the **Check** tile.
2. Enter the amount in **AMOUNT**.
3. Enter the number printed on the check in **CHECK NUMBER (REQUIRED)**.
4. Choose the **DONATION TYPE**.
5. Enter the donor name, if the donor gives it.
6. Tap **Record donation**.

**Expected result:** A message says "Recorded" with the amount and "by Check". The donation shows in the list.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The message says "Enter the check number printed on the check." | The **CHECK NUMBER (REQUIRED)** field is empty. | Enter the check number, then tap **Record donation** again. |
| There is no **Check** tile. | The council did not turn Check on. | Ask an Admin to turn Check on in **Council Lookup Tables**. |

### 17.4 Log revenue and its payment method

> **Who can do this:** The council's Treasurer or a Super Admin.
> **Warning:** The revenue posts to the general ledger at once.

**Goal:** Record event or activity revenue and how the council received the money.

**Start point:** Sidebar → Finances → **Financial Dashboard** → **💰 Log Concluded Event Revenues**.

**Steps:**
1. Select the event or activity in **Event or activity**.
2. Enter the amount in **Funds collected**.
3. Select the **Revenue account** and the **Deposited to** account.
4. Select the method in **Payment method**: Cash, Credit Card, Venmo, Zelle, Zeffy, Parishsoft or Check.
5. If you selected **Check**, enter the number in **Check number**.
6. Select **Save to the ledger**. The revenue posts to the ledger at once.

**Expected result:** A message shows the amount and the revenue account. Both ledger lines show the payment method. A check payment also shows the check number.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The message says "Enter the check number of a payment by check." | The **Check number** box is empty. | Enter the check number, then save. |
| A method, such as Zeffy, is not in the **Payment method** list. | The council did not turn that method on. | Ask an Admin to turn the method on in **Council Lookup Tables**. |
| The message says the method "is not one this council has enabled for payments." | An Admin turned the method off after the page opened. | Reload the page, then choose an enabled method. |

### 17.5 Concept: asset photos in Google Drive

Each council asset can have one photo. The portal files every asset photo in the council's shared Google Drive. Each asset has its own folder:

`Fraternal Enterprise Suite / Assets / <asset name>`

The asset record keeps the Drive file. The photo stays with the asset for every member who opens the asset, on any computer and on the phone. An Admin does not need to upload the photo.

| Who | Sees the inventory | Adds or removes a photo | Changes the name, status, serial number, location and notes |
| --- | --- | --- | --- |
| Grand Knight, Deputy Grand Knight (DGK), Admins, Financial Secretary, Treasurer, Super Admins | Yes | Yes | Yes |
| Trustees | Yes | Yes | No |
| Other members | No | No | No |

The Deputy Grand Knight is a full asset manager because the DGK directs the council's programs and their equipment.

The portal accepts image files up to 25 MB. The council's Google Drive must be connected in **Credentials Vault**. When Drive is not connected, the portal saves no photo.

On the phone, the **Council assets** button on the **Home** tab opens a list of the assets with their photos. The phone list is for viewing only.

### 17.6 Add a photo to a council asset

> **Who can do this:** The council's Grand Knight, Deputy Grand Knight, Trustees, Admins, Financial Secretary and Treasurer, or a Super Admin.

**Goal:** File a photo of the item in the council Google Drive and attach the photo to its asset record.

**Start point:** Sidebar → Finances → **My Expense Reports** → **Council assets** → **Edit** (or **Add photo**) on the asset row.

**Steps:**
1. Select **Upload photo** in the **Asset photo** box.
2. Choose an image file. The portal files the photo in Drive at once.
3. To change the photo, select **Replace photo** and choose another image.
4. To remove the photo from the asset, select **Remove photo**. The file stays in Drive.

**Expected result:** The photo shows on the asset form. The message says "Saved the photo of" and the asset name. The photo is in Drive under **Assets / <asset name>**. The inventory and the phone list show the photo.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The message says "The Drive vault is not configured." or "DRIVE_VAULT_LIVE is not on." | The council's Google Drive is not connected or not switched on. | Ask an Admin to connect Google Drive in **Credentials Vault**. Ask the portal host to switch the Drive vault on. |
| The message says the file "is not a file type the Assets folder takes." | The file is not an image. | Choose a photo file. |
| The message says "Google Drive did not accept the photo. Try again later." | Google Drive did not answer. | Wait a few minutes, then upload the photo again. |
| The form shows the details but no **Save asset details** button. | You are a Trustee. | Ask an asset manager to change the details. You can still add the photo. |

### 17.7 Concept: user impersonation (view as a member)

A Super Admin can see the portal exactly as one member sees the portal. Use this to check a member's sidebar, pages and permissions.

| Rule | Value |
| --- | --- |
| Who can start the view | Active Super Admins only |
| Who can be viewed | Any member except yourself and other Super Admins |
| Saving in the view | Not possible. Every save is refused. |
| Longest view | 60 minutes, or until your own sign-in ends |
| Record | The portal server logs each start and stop |

The portal server holds both sign-ins in signed cookies. The browser cannot read or change them. A gold bar across the top of the portal shows whose view is open.

The view uses the member's own council. The member can belong to a council other than your council. The portal then switches to that council's settings before the first page opens:

- the council's modules (the feature flags)
- the council's organization type and its labels
- the council's timing settings, for example the expense filing window
- the council's ledgers, desks and rosters

The gold bar names the member's council. When you select **Return to my account**, the portal switches back to your own council.

Super Admins find members in two places. The **Affiliated Roster** shows one council at a time. The **View-As Member Lookup** page shows every council in one tree.

### 17.8 View the portal as another member

> **Who can do this:** Super Admins. Other members do not see the **👥 Impersonate User** button.

**Goal:** See the portal with one member's sidebar, pages and permissions.

**Start point:** Sidebar → System Settings → **Affiliated Roster**.

**Steps:**
1. Find the member in the roster table.
2. Select **👥 Impersonate User** in the **Actions** column.
3. Look at the pages. The portal opens on the member's hub.
4. Select **Return to my account** in the gold bar to end the view.

**Expected result:** The gold bar says "You are viewing the portal as" and the member's name. After **Return to my account**, your own sidebar comes back.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A save fails with "You are viewing the portal as another member, so nothing can be saved." | The view is read-only. | Select **Return to my account**, then make the change as yourself. |
| The row has no **👥 Impersonate User** button. | The member is you or another Super Admin. | You cannot view as a Super Admin. |
| An error says "The server did not answer, so the view could not start." | The portal server cannot see the member or your session ended. | Sign out, sign in again, then try again. |

### 17.8.1 Find a member in any council and view as that member

> **Who can do this:** Super Admins. Other members do not see this page.

**Goal:** Find one member among all councils without a long scroll, then view the portal as that member.

**Start point:** Sidebar → System Settings → **View-As Member Lookup**.

**Steps:**
1. Type part of a name, member number, email, role or council number in the search box.
2. Read the suggested names under the box. Names that start with your text come first.
3. Select **👥 View as** beside the member. Go to step 7.
4. To browse without a search, select a council in the **Council directory**. The council opens.
5. Select a group in the council: **Executive Officers**, **Finance Officers**, **Recorder & Historian**, **Other Officers**, **Council Admins**, **Appointed Seats** or **Members**.
6. Select **👥 View as** beside the member.
7. Look at the pages. The portal opens on the member's hub, with the member's council settings.
8. Select **Return to my account** in the gold bar to end the view.

**Expected result:** The gold bar names the member and the member's council. The sidebar, desks and settings are the member's own.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A member is not in the tree. | The member is you or another Super Admin. | You cannot view as a Super Admin. |
| *"Nobody you may view as matches"* | No member matches every word you typed. | Type fewer words. |
| A member shows in one group only. | Each member shows in the group of the highest seat. A Grand Knight who is also an Admin shows under **Executive Officers**. | Look in the group of the member's highest seat. |

### 17.9 Concept: co-watching remote assistance

An officer or Admin who needs help can share a copy of the screen with the Super Admins. The officer starts and stops the sharing. Nothing is shared until the officer selects **Share my screen**.

- The copy refreshes every 5 seconds while the officer shares.
- The copy never contains what the officer types in form fields. Passwords are never sent.
- The copy cannot run on the Super Admin's computer. The desk shows the copy as a still picture of the page.
- Sharing stops when the officer selects **Stop sharing**, when a Super Admin closes the request, or after 30 minutes without an update.

### 17.10 Ask for remote help

> **Who can do this:** Officers and Admins. Members and Super Admins do not see the button.

**Goal:** Let a Super Admin see your screen while you get help.

**Start point:** The portal header → **❓ Request Remote Officer Assistance**.

**Steps:**
1. Select **❓ Request Remote Officer Assistance**.
2. Enter what you need in **What do you need help with? (optional)**.
3. Select **Share my screen**.
4. Go to the page you need help with. The Super Admin sees each page you open.
5. Select **Stop sharing** when you finish.

**Expected result:** The header button turns red and says **● Sharing screen · Stop sharing**. After **Stop sharing**, the button goes back to **❓ Request Remote Officer Assistance**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The request fails with a session message. | Your server session ended. | Sign out, then sign in again. |
| The red button changed back by itself. | A Super Admin closed the request, or 30 minutes passed. | Send a new request if you still need help. |

### 17.11 Watch an officer's screen

> **Who can do this:** Super Admins. Other members do not see the Remote Assistance Desk.

**Goal:** See the screen an officer shares and guide the officer.

**Start point:** Sidebar → System Settings → **Remote Assistance Desk**.

**Steps:**
1. Select a request in **Open requests**.
2. Read the officer's note and the page name.
3. Look at the screen copy in the right panel. The copy refreshes every 5 seconds.
4. Guide the officer by phone or by message.
5. Select **Close request** when the officer has the answer.

**Expected result:** The right panel shows the officer's page at the officer's window size. After **Close request**, the request leaves the list.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The panel says "That request is closed." | The officer stopped sharing. | Ask the officer to send a new request. |
| The form fields in the copy are empty. | The platform never sends what the officer types. | Ask the officer to read the values to you. |

---

## 18. Annual roadmap, meeting check-in and meeting photos

### 18.1 Concept: the Annual Fraternal Roadmap

The **Annual Fraternal Roadmap** is a card on the **Reports Desk** of the dashboard. **Home** shows the same steps as one line, the roadmap ribbon. The card shows the three steps that hand the council over to its next fraternal year. A cycle carries the calendar year of its steps. The 2027 cycle elects and budgets the 2027-2028 fraternal year.

| Step | Window | The portal marks the step done when |
| --- | --- | --- |
| **Nominations** | May 1 - May 31 | A nomination is recorded for the coming fraternal year, or the officers are seated. |
| **Elections** | June 1 - June 30 | An officer is seated for the coming fraternal year. Concluding the fraternal year seats the officers. |
| **Budget Lock** | July 1 - July 10 | The coming year's budget is approved. |

Each step has one of four looks:

| Look | Label | Meaning |
| --- | --- | --- |
| Navy circle with ✓ | **Done** | The database shows the step done. |
| Heavy gold border | **Up next** | The first step that is not done and not past its due date. |
| Red circle with ! | **Overdue** | The due date passed and the step is not done. |
| Plain outline | **Later** | A step after the next one. |

The card opens on the current cycle. The current cycle changes to the next year 30 days after the July 10 Budget Lock. Use the year arrows to see an earlier or later cycle.

**Overdue alerts.** When a step is overdue, the card sends a push alert to the council's leaders. The leaders are the Grand Knight, the Deputy Grand Knight, the Financial Secretary, the Treasurer and the council's Admins. Each leader gets one alert for each overdue step in each cycle. The alert title is **Overdue: Nominations 2027**, **Overdue: Elections 2027** or **Overdue: Budget Lock 2027**. The alert also shows in each leader's alert list on the phone.

### 18.2 Read the roadmap and send the overdue alerts

> **Who can do this:** the council's Admins and officers, and Super Admins. Other members do not see the **Executive Dashboard**.
> **Warning:** opening the card with an overdue step sends a push alert to the council's leaders. You cannot recall an alert.

**Goal:** See where the council stands on its yearly hand-over, and alert the leaders to a missed step.

**Start point:** **Active Desks** row → **Reports Desk**. On **Home**, select **Full roadmap →** in the roadmap ribbon.

**Steps:**
1. Scroll to the **Annual Fraternal Roadmap** card.
2. Find the step with the gold border. That step is next.
3. Read the line under each step. The line says what the database shows.
4. Check for a red step. When a red step shows, the card sends the overdue alert at once.
5. Read the note under the steps. The note says how many leaders got the alert.
6. Optional: select **← 2026** or **2028 →** to see another cycle. Select **Back to the current cycle** to return.

<!-- KEEP_IMAGE: roadmap card, current cycle -->
![Annual Fraternal Roadmap with Nominations up next (/dashboard)](../generated/dashboard_visual_catalog/dashboard_roadmap.png)
<!-- /KEEP_IMAGE -->

<!-- KEEP_IMAGE: roadmap card, completed cycle -->
![Annual Fraternal Roadmap with all three steps done (/dashboard)](../generated/dashboard_visual_catalog/dashboard_roadmap_2026.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The card shows the three steps of the cycle. After an alert, the note says *"Push alert sent to 4 council leaders for 1 overdue step."*

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| *"Council leadership already has the alert for each overdue step."* | The leaders got the alert on an earlier visit. | No action. The portal sends each alert one time. |
| **Elections** stays **Overdue** after the vote. | The fraternal year is not concluded, so no officer is seated for the new year. | Conclude the fraternal year on the elections page. |
| **Budget Lock** stays **Overdue**. | The coming year's budget is still Draft or Proposed. | Approve the budget on the budget page. |
| A leader got no push on the phone. | The leader's phone has no registered device. | The alert still shows in the leader's alert list. |

### 18.3 Concept: the Three-Signature Expense Flow

Under the roadmap, the **Three-Signature Expense Flow** draws the path of an expense report. Each box shows how many of the council's reports wait at that step.

| Box | Who acts | What the step does |
| --- | --- | --- |
| **Member submits** | Any member | The member submits the expense report. |
| **1. Written order** | Financial Secretary | The Financial Secretary audits the report and issues the written order. |
| **2. Ledger coding** | Treasurer | The Treasurer picks the budget line and the ledger account. |
| **3. Counter-signature** | Grand Knight | The Grand Knight signs. The report becomes Approved. |
| **Check paid** | Financial Secretary or Treasurer | The check is recorded. The report becomes Reimbursed. |

- Council leadership may return a submitted report to the member as a draft, with a reason. The return clears the report's signatures.
- Nobody signs a report that they submitted. One officer never signs two lines of the same report.

### 18.4 Concept: meeting check-in by GPS or PIN

Members check in to a live meeting from the phone with **📍 Check In to Meeting**. The phone sends its location one time. The portal accepts the check-in when two things are true:

- The phone is inside the council's circle: no farther from the meeting point than the check-in radius (100 m by default).
- The phone's location is at least as precise as the check-in radius.

When the location check fails, the phone asks for the 4-digit **meeting PIN**. The Grand Knight reads out the PIN at the meeting. After 5 wrong PINs, the PIN box locks for that member and that meeting. An officer then checks the member in on the **Live Meeting Console**.

- The default meeting PIN is `0000`. Change the PIN before the first meeting.
- Only the Grand Knight, the council's Admins and Super Admins see or change the PIN. The PIN is not sent to members' phones.
- Without a meeting point, GPS check-in is off and every member uses the PIN.

### 18.5 Set the meeting location and the meeting PIN

> **Who can do this:** the council's Grand Knight and Admins, and Super Admins. Other officers do not see the **📍 Meeting Check-In** card.
> **Warning:** a new PIN takes effect at once. Members who know only the old PIN cannot check in with the PIN.

**Goal:** Set where the council meets, how close a phone must be, and the meeting PIN.

**Start point:** Sidebar → System Settings → **Council Wide Settings** → **📍 Meeting Check-In**.

**Steps:**
1. Find the meeting hall on a map. Copy its latitude and longitude in decimal degrees.
2. Enter the latitude in **Meeting point latitude**, for example `47.606200`.
3. Enter the longitude in **Meeting point longitude**, for example `-122.332100`.
4. Enter the circle size in **Check-in radius (meters)**, from 25 to 5,000.
5. Enter 4 digits in **Meeting PIN**.
6. Select **Save meeting check-in**.

<!-- KEEP_IMAGE: meeting check-in card on council settings -->
![Meeting Check-In card with the default PIN warning (/setup/council-settings)](../generated/dashboard_visual_catalog/council_settings_meeting_check_in.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The card says *"Saved. Phones within 100 m of the meeting point can check in by GPS; others use the PIN."*

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| *"The PIN is still the default 0000, which any member can guess. …"* | The PIN is `0000`. | Enter a new 4-digit PIN. Select **Save meeting check-in**. |
| *"The meeting PIN must be exactly 4 digits."* | The PIN has letters, or too few or too many digits. | Enter 4 digits. |
| *"Enter the latitude and the longitude together."* | One coordinate is empty. | Fill in both coordinates, or clear both. |
| *"The check-in radius must be a whole number of meters from 25 to 5,000; …"* | The radius is out of range. | Enter a whole number from 25 to 5,000. |
| Members inside the hall get *"Your phone's location is only accurate to … m, …"* | Phones are less precise indoors. | Enter a larger radius, for example 150. |
| *"Saved. No meeting point is set, so members check in with the PIN only."* | Both coordinates are blank. | Enter both coordinates to turn GPS check-in on. |

### 18.6 File a meeting photo with the minutes

> **Who can do this:** the meeting's chair: the meeting owner, the council's Admins and officers, and Super Admins.

**Goal:** Keep one photo of the meeting with its minutes, in the council's Google Drive.

**Start point:** Sidebar → Governance → **Live Meeting Console** → **Meeting photo**.

**Steps:**
1. Pick the meeting and start the console.
2. Scroll to the **Meeting photo** panel, under **Live attendance**.
3. Select **Upload photo**.
4. Choose the photo file.
5. To change the photo, select **Replace photo**. To remove the photo, select **Remove photo**.

**Expected result:** The photo shows in the panel. An Admin's upload is filed in Google Drive under **Fraternal Enterprise Suite / Media / Meeting_Photos**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The photo is gone after you reload the page. | The upload was not filed in Drive: the uploader is not an Admin, or the council's Drive is off. | Ask an Admin to upload the photo. Turn on Drive in the **Credentials Vault**. |
| *"Google Drive did not accept the file."* | Drive refused the upload. | Try again later. |
| Members' own photos are not in the panel. | A member's check-in photo stays on the member's phone. | Ask the member to send the photo to an Admin. |

---

## 19. The Active Desks dashboard

### 19.1 Concept: the Active Desks row

The **Executive Dashboard** is a set of desks. A row of folder tabs sits under the navy header on every page. The row has the title **Active Desks**.

- Each tab looks like the tab of a paper file folder. A navy outline frames each tab.
- The open desk is white and raised. A deep gold edge runs along its top.
- **Home** is the first tab. **Member Desk** is the last tab.
- Select a tab on any page. The dashboard opens on that desk.

Only readers who may open the dashboard see the row. These readers are the council's Admins and officers, the Council Historian, and Super Admins.

A Council Historian without an officer seat and without Admin rights gets two tabs only: **Historian Desk** and **Member Desk**. This Historian does not get **Home** or the **Reports Desk**.

After you sign in, the portal opens on the dashboard **Home** desk when you hold an officer seat or Admin rights. A member without an officer seat or Admin rights opens on **Member Actions**.

The left sidebar does not change. Every desk page stays in the sidebar.

### 19.2 Concept: the Home desk

The **Home** desk fits on one screen. You do not scroll the page. **Home** holds four rows and no work lists.

| Row on Home | What the row shows |
| --- | --- |
| Roadmap ribbon | The **Annual Fraternal Roadmap** steps on one line. Each step shows its status and due date. **Full roadmap →** opens the **Reports Desk**. |
| Status badges | One badge for each queue you may work, with its count. Select a badge to open its desk. |
| Stat tiles | This month's labor hours, unique Knights, net balance and community outreach. |
| Widgets | **Bible Verse of the Day**, **Live Actionable Reminders**, **Liturgical Feast Day Tracker** and **Today's Event Agenda**. A long list scrolls inside its own card. |

The status badges:

| Badge | Desk it opens | Who sees the badge |
| --- | --- | --- |
| **[ 📋 3 Vouchers Pending ]** | **Grand Knight Desk** | The Grand Knight (GK), the council's Admins and Super Admins |
| **[ ✍️ 2 Written Orders Waiting ]** | **Financial Secretary Desk** | The Financial Secretary (FS), the council's Admins and Super Admins |
| **[ 🏷️ 1 Sheet to Code ]** | **Treasurer Desk** | The Treasurer, the council's Admins and Super Admins |
| **[ 📝 2 Minutes Due ]** | **Recorder Desk** | The Recorder, the council's Admins and Super Admins |
| **[ ⚠️ 2 Items Quarantined ]** | **Oversight Desk** | The GK, the Deputy Grand Knight (DGK), the council's Admins and Super Admins, while **Volunteer time quarantine** is on |
| **[ 📨 1 Access Request ]** | **Oversight Desk** | Super Admins |
| **[ ⏳ 4 Shifts Awaiting Hours ]** | **Reports Desk** | Every reader of the dashboard |
| **[ 💼 2 Open Sheets of Mine ]** | **Member Desk** | Every reader of the dashboard |

A badge with work waiting is filled with gold. The quarantine badge is red. A badge with a count of 0 is white.

The **Bible Verse of the Day** and the **Liturgical Feast Day Tracker** show only while the council's **Faith Center** module is on. A white-label organization does not see the two faith widgets.

### 19.3 Concept: the desks

A desk summarizes the work of one seat. A desk links to its full desk page. You sign on the full desk page. The desks never sign, code or release a sheet.

The portal shows a desk tab only to a reader who may do the desk's work.

| Tab | Who gets the tab | What the tab shows | Full desk page |
| --- | --- | --- | --- |
| **Grand Knight Desk** | The council's GK, the council's Admins and Super Admins | The **Voucher Release queue**: sheets that carry the FS order and the Treasurer's coding. A link to the disbursement vault. | Sidebar → Finances → **GK Expense Authorize** |
| **Financial Secretary Desk** | The council's FS, the council's Admins and Super Admins | The **Written-order queue**, the count of all sheets in the leadership queue, and the **Excel roster imports** card. | Sidebar → Finances → **FS Expense Audit** |
| **Treasurer Desk** | The council's Treasurer, the council's Admins and Super Admins | The **Ledger Line Coder queue**: sheets that wait for a budget line and a ledger account. A link to the general ledger. | Sidebar → Finances → **Treasurer Ledger Audit Desk** |
| **Recorder Desk** | The council's Recorder, the council's Admins and Super Admins | The **🚀 Start Live Meeting Sequence** button with the meeting PIN, the **Business calendar** with the minutes countdown of each meeting, and the **Meeting Minutes Entry Desk**. | None. The desk is the full page. |
| **Historian Desk** | The council's Council Historian, the council's Admins and Super Admins | The **Digital Fraternal Annals Scrapbook**: monthly newsletters, meeting photos and oral history recordings. | Sidebar → Performance → **Council History** |
| **Oversight Desk** | The council's GK and DGK, the council's Admins and Super Admins | The **🚨 Volunteer Time Quarantine Desk** (section 15). Super Admins also get the **Inbound Council Mail Center** (section 17). | None. The desk is the full page. |
| **Reports Desk** | Every reader of the dashboard | The full **Executive Summary**: the month and year pickers, the **Annual Fraternal Roadmap** card, the stat tiles, the budget gauges, the ledger, the highlights and the **Executive audits**. | None. The desk is the full page. |
| **Member Desk** | Every reader of the dashboard | **My open expense sheets** and **My shifts: next 30 days**. | Sidebar → Finances → **My Expense Reports**; Sidebar → Performance → **Shared Member Center** |

A seat clears a desk only on the officer's own council. A Super Admin who picks another council in the council drop-down sees every desk of that council.

Earlier sections of this guide name the **Executive Dashboard** as a start point. For those tasks, open the **Reports Desk**.

Each tab has its own web address. The address is the dashboard address with the tab name after a `#` sign:

| Tab | Address |
| --- | --- |
| **Home** | `/dashboard#home` |
| **Grand Knight Desk** | `/dashboard#grand-knight` |
| **Financial Secretary Desk** | `/dashboard#financial-secretary` |
| **Treasurer Desk** | `/dashboard#treasurer` |
| **Recorder Desk** | `/dashboard#recorder` |
| **Historian Desk** | `/dashboard#historian` |
| **Oversight Desk** | `/dashboard#oversight` |
| **Reports Desk** | `/dashboard#reports` |
| **Member Desk** | `/dashboard#member` |

Save a desk address as a browser bookmark to open the desk directly. The browser also remembers the last tab you opened. The dashboard opens on that tab the next time. A tab you cannot open falls back to your first tab. For most readers, the first tab is **Home**.

### 19.4 Read the Home desk

> **Who can do this:** the council's Admins and officers, and Super Admins. Other members do not see the **Dashboard**.
> **Warning:** when the roadmap ribbon shows an overdue step, the portal sends a push alert to the council's leaders. You cannot recall an alert.

**Goal:** See the council's state and the work that waits for you, on one screen.

**Start point:** **Active Desks** row → **Home**.

**Steps:**
1. Select the **Home** tab. The portal opens on **Home** after you sign in.
2. Read the roadmap ribbon. The gold step is next. A red step is overdue.
3. Read the status badges. A gold or red badge has work waiting.
4. Select a badge. The badge's desk opens.
5. Read the four stat tiles for this month.
6. Read the four widgets. Select a reminder link to open its full desk page.
7. Select **Reports Desk** for other months, the budget gauges and the audits.

**Expected result:** **Home** shows the ribbon, the badges, the tiles and the widgets without a page scroll.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The verse and the feast tracker do not show. | The council's **Faith Center** module is off, or the organization is white-label. | Ask a Super Admin to turn on **Faith Center** on the **Feature Flags** page. |
| A badge you expect does not show. | Your seat does not clear that desk, or the module is off. | Ask the officer who holds the seat. |
| *"You are all caught up. Nothing needs your action."* | No sheet waits for your signature, and you have no unread alert. | No action. |
| The page scrolls on a small screen. | The screen is shorter than a laptop screen. | Use a laptop or desktop screen, or zoom the browser out. |
| *"No event or meeting today."* | The council calendar has nothing on today's date. | Open the council calendar to see coming events. |

### 19.5 Release vouchers from the Grand Knight Desk

> **Who can do this:** the council's Grand Knight and Super Admins sign. The council's Admins read the desk.
> **Warning:** the final release sets the sheet to **Approved** and sends the sheet to payment. You cannot undo the release.

**Goal:** Find the sheets that wait for the final release, and release them.

**Start point:** **Active Desks** row → **Grand Knight Desk**.

**Steps:**
1. Select the **Grand Knight Desk** tab.
2. Read the **Vouchers waiting for release** count.
3. Read the **Voucher Release queue** grid. The **Signed so far** column names the FS and the Treasurer.
4. Select **Release vouchers on the full desk**. The **GK Expense Authorize** page opens.
5. Select **✍️ Final Release for Payment** on each sheet. You cannot undo the release.

**Expected result:** The released sheets leave the queue. The count on the **Grand Knight Desk** drops when you open the tab again.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The **Grand Knight Desk** tab does not show. | You do not hold the Grand Knight seat on this council, and you are not an Admin. | Use the **Home** tab. Ask the Grand Knight to release the sheets. |
| A sheet shows no release button on the full desk. | You submitted, ordered or coded that sheet (the collusion guard). | Ask a Super Admin to release the sheet. |

### 19.6 Work the Financial Secretary Desk and the roster imports

> **Who can do this:** the council's Financial Secretary and Super Admins sign orders. Only the council's Admins and Super Admins import the roster.
> **Warning:** the roster import sends a welcome email to each new member. You cannot recall an email.

**Goal:** Sign the waiting expense orders, and keep the roster current.

**Start point:** **Active Desks** row → **Financial Secretary Desk**.

**Steps:**
1. Select the **Financial Secretary Desk** tab.
2. Read the **Sheets waiting for your written order** count.
3. Select **Verify & sign on the full desk**. The **FS Expense Audit** page opens.
4. Select **📝 Verify & Sign Expense** on each sheet. Return to the dashboard.
5. In the **Excel roster imports** card, select **Download the Excel roster template**.
6. Fill in the template. Save the **Roster** sheet as CSV.
7. Select **Supreme roster sync**. Load the CSV file on that page. Each new member gets a welcome email.

**Expected result:** The signed sheets move to the Treasurer. The new members show in the roster.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The inactivity sweep is not on the desk. | The sweep moved to System Settings. | Open Sidebar → System Settings → **Council Wide Settings** (section 14.9). |
| The roster file does not load. | The file is not CSV. | Save the **Roster** sheet as CSV, then load the file again. |

### 19.7 Code sheets from the Treasurer Desk

> **Who can do this:** the council's Treasurer and Super Admins code sheets. The council's Admins read the desk.

**Goal:** Find the sheets that wait for a budget line and a ledger account, and code them.

**Start point:** **Active Desks** row → **Treasurer Desk**.

**Steps:**
1. Select the **Treasurer Desk** tab.
2. Read the **Sheets waiting for ledger coding** count.
3. Read the **Ledger Line Coder queue** grid. The **Signed so far** column names the FS who ordered each sheet.
4. Select **Categorize & lock on the full desk**. The **Treasurer Ledger Audit Desk** opens.
5. Pick the budget line and the ledger account for each sheet.
6. Select **🏷️ Categorize & Lock Expense**. The sheet goes to the Grand Knight.

**Expected result:** The coded sheets leave the queue. The sheets show on the **Grand Knight Desk**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The **Treasurer Desk** tab does not show. | You do not hold the Treasurer seat on this council, and you are not an Admin. | Ask the Treasurer to code the sheets. |
| **Log its concluded revenue** does not show. | Only the Treasurer and Super Admins log concluded revenue. | Ask the Treasurer to log the revenue. |

### 19.8 Check your own work on the Member Desk

> **Who can do this:** every reader of the dashboard.

**Goal:** See your own unpaid expense sheets and your shifts for the next 30 days.

**Start point:** **Active Desks** row → **Member Desk**.

**Steps:**
1. Select the **Member Desk** tab.
2. Read **My open expense sheets**. The status pill shows where each sheet stands.
3. Select **Open my expenses** to edit a draft or submit a sheet.
4. Read **My shifts: next 30 days**.
5. Select **Open the Member Center** for the council's service record and your own impact card.

**Expected result:** The desk lists each unpaid sheet and each coming shift.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A paid sheet does not show. | The desk lists only sheets that are not **Reimbursed**. | Open **My Expense Reports** to see paid sheets. |
| A shift after 30 days does not show. | The desk lists the next 30 days only. | Open the council calendar. |

### 19.9 Concept: the minutes countdown

The **Recorder Desk** lists the council's meetings from 90 days ago to 30 days ahead. This list is the **Business calendar**. Each meeting has one countdown pill.

| Pill | Meaning |
| --- | --- |
| **Not held yet** | The meeting is in the future. |
| **Due in 3 days** | The meeting is over. The minutes are due in 3 days. |
| **Due today** | The minutes are due today. |
| **2 days overdue** | The due date has passed. Nobody published the minutes. |
| **Published** | The Recorder published the minutes. The countdown stops. |

The due date is the meeting's last day plus the **Days after a meeting that the minutes are due** setting (section 16.3). The default is 7 days. Overdue meetings come first in the list.

### 19.10 Write and publish the meeting minutes

> **Who can do this:** the council's Recorder, the council's Admins and Super Admins. Other members do not see the **Recorder Desk**.
> **Warning:** **Publish minutes** shows the minutes as the council's official record.

**Goal:** Write the official minutes of a meeting and publish them before the due date.

**Start point:** **Active Desks** row → **Recorder Desk**.

**Steps:**
1. Select the **Recorder Desk** tab.
2. Select a meeting in the **Business calendar**. Overdue meetings are at the top.
3. In **Meeting Minutes Entry Desk**, type the minutes. Start a heading with `#`. Start a bullet with `-`.
4. Select **Preview** to read the minutes as members see them. Select **Write** to go back.
5. Select **Save draft** to keep the minutes without publishing them.
6. Select **Publish minutes**. The pill changes to **Published**.

**Expected result:** The message *"The minutes are published."* shows. The meeting moves to the end of the list.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| **Publish minutes** is not available. | The minutes are blank. | Type the minutes first. |
| You must correct published minutes. | Published minutes stay open for changes. | Change the text, then select **Publish changes**. The first publication date stays. |
| You published the wrong meeting. | You selected another meeting in the list. | Select **Withdraw to draft**. The minutes go back to a draft. |
| The **Recorder Desk** tab does not show. | You do not hold the Recorder seat on this council, and you are not an Admin. | Ask the Grand Knight to check your seat. |

### 19.11 Start the live meeting from the Recorder Desk

> **Who can do this:** the council's Recorder, the council's Admins and Super Admins.
> **Warning:** the start locks the quorum count to the council's Active members at that moment. You cannot change the locked count.

**Goal:** Open the live meeting and read the meeting PIN to the members in the hall.

**Start point:** **Active Desks** row → **Recorder Desk**.

**Steps:**
1. Select the meeting in the **Business calendar**.
2. Select **[ 🚀 Start Live Meeting Sequence ]**. The quorum count locks. You cannot change the locked count.
3. Read the 4-digit **Meeting PIN bypass** in the navy box.
4. Read the PIN aloud. Members whose phones cannot check in by location type the PIN.
5. Select **Open the Live Meeting Console →** to run the agenda.

**Expected result:** The navy box shows the PIN and the locked quorum base. The meeting shows **● Live now**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The box says the PIN is still the factory PIN 0000. | Nobody changed the council's PIN. | Ask the Grand Knight to set a new PIN (section 18.5). |
| The meeting was already live. | Someone started the meeting before you. | No action. The first quorum count stays. |

### 19.12 Keep the Digital Fraternal Annals Scrapbook

> **Who can do this:** the council's Council Historian, the council's Admins and Super Admins. Other members do not see the **Historian Desk**.

**Goal:** Write the monthly newsletter, file meeting photos and check the oral history recordings.

**Start point:** **Active Desks** row → **Historian Desk**.

**Steps:**
1. Select the **Historian Desk** tab.
2. In **📰 Monthly newsletters**, select the **Month**.
3. Type the newsletter text. Select **Save newsletter**.
4. To open an earlier newsletter, select its month button under the text box.
5. In **📷 Parish event and meeting photos**, select the **Meeting**.
6. Select **Upload photo**, then pick the image file.
7. In **🎙️ Oral history recordings**, select **Listen** beside a recording to play it.
8. To record your own testimonial, use the recorder under the list.

**Expected result:** The newsletter shows *"Newsletter saved."* The photo shows under the meeting name. The portal files the photo in the council's Google Drive under **Media / Meeting_Photos**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| *"The Drive vault is off, so the photo is kept in this browser only."* | The council's Google Drive is not connected. | Ask a Super Admin to connect Google Drive (section 10.8). |
| The recorder does not show. | You recorded your one testimonial before. | No action. Each member records one testimonial. |
| One month shows only one newsletter. | The council keeps one newsletter for each month. | Change the text and select **Save newsletter**. The new text replaces the old text. |

---

## Appendix: QR code files

The two onboarding codes are in `apps/web/public/assets/images/qr/`. Print or project the codes for new members.
The phone **Donate** screen shows the collection codes. The phone shows the council's image link first.
When the link is missing or broken, the phone shows the code that ships with the app.

To put a real code in place, replace the file. Keep the file name.

<!-- KEEP_IMAGE: QR code file table -->
| Code | File |
|---|---|
| ![Mobile App Expo Go Sync QR code](../apps/web/public/assets/images/qr/expo-go-sync.png) | `apps/web/public/assets/images/qr/expo-go-sync.png` |
| ![Member Sign-Up QR code](../apps/web/public/assets/images/qr/member-sign-up.png) | `apps/web/public/assets/images/qr/member-sign-up.png` |
| ![ParishSoft collection QR code](../apps/mobile/assets/images/qr/parishsoft-collection.png) | `apps/mobile/assets/images/qr/parishsoft-collection.png` |
| ![Venmo collection QR code](../apps/mobile/assets/images/qr/venmo-collection.png) | `apps/mobile/assets/images/qr/venmo-collection.png` |
| ![Zeffy collection QR code](../apps/mobile/assets/images/qr/zeffy-collection.png) | `apps/mobile/assets/images/qr/zeffy-collection.png` |
| ![Zelle collection QR code](../apps/mobile/assets/images/qr/zelle-collection.png) | `apps/mobile/assets/images/qr/zelle-collection.png` |
<!-- /KEEP_IMAGE -->
