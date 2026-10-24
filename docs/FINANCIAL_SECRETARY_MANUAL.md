# Knights of Columbus Tracking Platform — Financial Secretary Manual

**Audience:** the council Financial Secretary (FS).

**Covers:** the Financial Secretary Desk, payment requests, returned reports, donations and checks, receipts and Honorary Expenses, the roster and its imports, setup codes, the Supreme roster sync, Forms 1728 and 1295, and Church Disbursement Requests.

> **Open this manual from your desk.** The Financial Secretary Desk header has **📘 Financial Secretary Manual (PDF)** and a **How do I…** search that answers from this manual only.
> Signing up, logging hours and taking donations are in the [Member User Guide](MEMBER_USER_GUIDE.md).

> **Section numbers:** the four officer manuals share one numbering. Section 6.3 is the same section in whichever manual holds it. The [manual map](#manual-map) shows which manual holds each chapter.

---

## Contents

- [6. Finances: the Financial Secretary's work](#6-finances-the-financial-secretarys-work)
- [10. Members, setup codes and the Supreme roster sync](#10-members-setup-codes-and-the-supreme-roster-sync)
- [14. The roster lifecycle](#14-the-roster-lifecycle)
- [17. Donations by check](#17-donations-by-check)
- [19. The Financial Secretary Desk](#19-the-financial-secretary-desk)
- [23. Church Disbursement Requests](#23-church-disbursement-requests)
- [Manual map](#manual-map)

### How to read a tutorial

Every tutorial starts with a **Prerequisite (who can do this)** line. The line states the access privilege that the task needs. Stop when your role is not on the line.

Every tutorial then has five parts: **Goal**, **Start point**, **Steps**, **Expected result** and **Common problems**.
A **Warning** line comes before the steps when the task deletes data, sends messages, posts money or cannot be undone.

---

## 6. Finances: the Financial Secretary's work

### 6.2 Issue a payment request

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

**Expected result:** The report leaves the desk. The member sees **RECORDED BY FS**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| No **📝 Verify & Sign Expense** button shows. | You submitted the report, or you do not hold the seat. | Another signer must act. |
| **📝 Verify & Sign Expense** is not available. | No budget line is chosen. | Choose a line in **Assign Ledger Budget Line Item**. |

### 6.4 Return a report to the member

> **Prerequisite (who can do this):** You must be a council Admin, the Financial Secretary, the Treasurer or a Super Admin.
> **Warning:** a return clears both signatures.

**Goal:** Send a report back for correction.

**Start point:** **Active Desks** row → **Financial Secretary Desk** → **Open the auditing queue**. The queue is not in the sidebar.

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

### 6.14 Concept: receipts, split tickets and Honorary Expenses

A report holds one or more receipts. Each receipt has a merchant, a gross total and a receipt file. Each line item names the receipt it comes from.

| Item | What it means | What the signers see |
| --- | --- | --- |
| Receipt | One ticket from one merchant, with its full total and its file. | A **Receipts** table with **R1**, **R2** and so on. |
| Split ticket | One receipt with council items and personal items. The member lists all items and ticks **Personal** on the member's own items. | Personal lines are struck through. The total reads **Council reimburses**. |
| Honorary Expense | The member has no receipt. The member ticks **⚠️ I have no receipt (Honorary Expense)** and writes the reason. | **⚠️ HONORARY EXPENSE - NO RECEIPT ATTACHED** with the member's reason. |

- The council pays only the lines without **Personal**. Checks, budgets, asset costs and the balance sheet leave personal lines out.
- On a submitted report, the lines of each receipt must add up to the receipt's gross total.
- On a submitted report, each receipt needs its file. An Honorary Expense lifts this rule. The reason is mandatory.
- The **⚠️ HONORARY EXPENSE - NO RECEIPT ATTACHED** badge also shows on a report that has no receipt file at all.
- When receipt reading is connected (10.8), **🔍 Read receipt** fills in the merchant, the total and the lines from the attached photo. The member checks every figure before saving.

> **Warning:** check the reason on every Honorary Expense before you sign. The badge shows on the FS, Treasurer and GK desks and in the **Leadership Auditing Queue**.

---

## 10. Members, setup codes and the Supreme roster sync

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

---

## 14. The roster lifecycle

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

> **Prerequisite (who can do this):** You must have council Admin privileges for the member's council, or Super Admin privileges. A member reads the member's own history on the **Council Dashboard**.

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

**Start point:** Sidebar → System Settings → **Council Wide Settings** → **User Access & Roster Control** → **Roster Inactivity Sweep** card.

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

## 17. Donations by check

### 17.3.1 Concept: check numbers on donations

A donation by check now records the number printed on the check. The number helps the Financial Secretary match each check to the bank deposit.

- On the phone, the **Collect** tab shows a **Check** tile when the council turned Check on. The Check form has a **CHECK NUMBER (REQUIRED)** field.
- On the web, the **Donations History** form shows a **Check number** field when **Check** is the method.
- A donation by check cannot be saved without a check number. A donation by any other method cannot have a check number.

### 17.3.2 Record a donation by check on the phone

> **Who can do this:** Every member who takes donations.

**Goal:** Record a check donation with its check number.

**Start point:** Phone → **Collect** tab.

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

---

## 19. The Financial Secretary Desk

### 19.6 Work the Financial Secretary Desk and the roster imports

> **Who can do this:** the council's Financial Secretary and Super Admins sign orders. Only the council's Admins and Super Admins import the roster.
> **Warning:** the roster import sends a welcome email to each new member. You cannot recall an email.

**Goal:** Sign the waiting expense orders without leaving the desk, and keep the roster current.

**Start point:** **Active Desks** row → **Financial Secretary Desk**.

**Steps:**
1. Select the **Financial Secretary Desk** tab.
2. Find the **Auditing & Return Queue** folder. A red glowing border means that a sheet waits for your signature.
3. Select the **Auditing & Return Queue** folder. The queue opens on the Desk Blotter.
4. Select **📝 Verify & Sign Expense** on each sheet. To send a sheet back, type the reason and select **Return to member**.
5. Select **[ 🔀 Back to Desk Blotter ]**.
6. To follow a sheet, select the **Expense Report (ER) Workflow** folder under **[ 📖 Reference Workflows ]**, or the **Expense Report (ER) Routing Track** folder. To record a donation, select the **Charitable Donation Records** tile. To endorse an approved charity grant, select the **FS/GK Compliance Endorsements** folder (section 6.8.1).
7. Select the **Excel Roster Imports** tile. Select **Download the Excel roster template**.
8. Fill in the template. Save the **Roster** sheet as CSV.
9. Select **Supreme roster sync**. Load the CSV file on that page. Each new member gets a welcome email.

**Expected result:** The signed sheets move to the Treasurer. The count on the **Auditing & Return Queue** folder drops when you close the folder. The new members show in the roster.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The inactivity sweep is not on the desk. | The sweep moved to System Settings. | Open Sidebar → System Settings → **Council Wide Settings** (section 14.9). |
| The roster file does not load. | The file is not CSV. | Save the **Roster** sheet as CSV, then load the file again. |

---

## 23. Church Disbursement Requests

### 23.4 Issue a Church Disbursement Request

> **Who can do this:** the council's Treasurer and Super Admins. The council's Admins and officers read the console.

**Goal:** Send the parish share of an event's collections to the Financial Secretary for payment.

**Start point:** **Active Desks** row → **Treasurer Desk** → **⛪ Parish Fundraiser Revenue Split Console**.

**Steps:**
1. Find the event row.
2. Check the calculation: **Collections** × the parish percentage = **Parish share**.
3. Read **To request**. This amount is the share less **Already requested**.
4. Select **[ 📋 Issue Church Disbursement Request ]** on the row.

**Expected result:** The message **Church Disbursement Request #… for $… is on the Financial Secretary Desk.** shows. The request is listed as **Pending**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The button is unavailable. | The split is off, or **To request** is $0.00. | Set up the split (23.3), or wait for new collections. |
| An event does not show. | The event has no money donations yet. | Record the donations first. |

---

## Manual map

Each chapter and the manual that holds it. A chapter split between manuals is listed once for each manual.

| Chapter | Manual |
| --- | --- |
| Primer: double-entry bookkeeping for the Treasurer | Treasurer Manual |
| 1. Roles and access | Administrator User Guide |
| 2. Left navigation map | Executive Governance Manual |
| 3. Module feature flags | Administrator User Guide |
| 4. Governance | Executive Governance Manual |
| 5. Faith In Action | Executive Governance Manual |
| 6. Finances: release, vetting and endorsement | Executive Governance Manual |
| 6. Finances: the Financial Secretary's work | Financial Secretary Manual |
| 6. Finances: the Treasurer's work | Treasurer Manual |
| 7. Performance | Executive Governance Manual |
| 8. The Google Drive archive vault | Administrator User Guide |
| 8. Resources | Executive Governance Manual |
| 9. The feedback inbox and SOP publishing | Administrator User Guide |
| 10. Lookup tables, service connections and global lists | Administrator User Guide |
| 10. Find members with a trade skill | Executive Governance Manual |
| 10. Members, setup codes and the Supreme roster sync | Financial Secretary Manual |
| 11. Data protection rules | Administrator User Guide |
| 12. Troubleshooting reference | Administrator User Guide |
| 13. Automated messages reference | Executive Governance Manual |
| 14. Member engagement | Executive Governance Manual |
| 14. The roster lifecycle | Financial Secretary Manual |
| 15. Flagged hours review | Executive Governance Manual |
| 16. Council Wide Settings and platform settings | Administrator User Guide |
| 17. Access requests, impersonation and remote help | Administrator User Guide |
| 17. Asset photos | Executive Governance Manual |
| 17. Donations by check | Financial Secretary Manual |
| 17. Payment methods and revenue | Treasurer Manual |
| 18. Annual roadmap, meeting check-in and meeting photos | Executive Governance Manual |
| 19. The Active Desks dashboard | Executive Governance Manual |
| 19. The Financial Secretary Desk | Financial Secretary Manual |
| 19. The Treasurer Desk | Treasurer Manual |
| 20. The Cross-Council Loaner Library and the colour-coded calendar | Executive Governance Manual |
| 21. Planning workflows and bilateral council affiliations | Executive Governance Manual |
| 22. The Operations Knowledge Archive | Executive Governance Manual |
| 23. Church Disbursement Requests | Financial Secretary Manual |
| 23. Parish fundraiser splits | Treasurer Manual |
| 24. Batch coding and cash box audits | Treasurer Manual |
| 25. Feedback loops and the Super Admin Desk | Administrator User Guide |
| 25. Account ownership and parish-held revenue | Treasurer Manual |
| 26. The global search bar | Executive Governance Manual |
| 27. The Navigation Guide screen | Executive Governance Manual |
| 28. Run a room pilot on the hub laptop | Administrator User Guide |
| 29. Split accounts, budget categories and payment account names | Treasurer Manual |
| 30. Reset the database to the seed data | Administrator User Guide |
| 31. Network addresses, ports and configuration keys | Administrator User Guide |
| 32. Firewall clearance | Administrator User Guide |
| 33. The software bill of materials (SBOM) | Administrator User Guide |
| Appendix: QR code files | Administrator User Guide |
