# Fraternal Council Archives™ — Treasurer Manual

**Audience:** the council Treasurer.

**Covers:** the double-entry primer, the Treasurer Desk, coding sheets to a budget line and a ledger account, paying by check, batch coding of electronic donations (bulk coding), cash box audits, parish splits, split accounts (GL splits), the annual budget and the chart of accounts.

> **Open this manual from your desk.** The Treasurer Desk header has **📘 Treasurer Manual (PDF)** and a **How do I…** search that answers from this manual only.
> Signing up, logging hours and taking donations are in the [Member User Guide](MEMBER_USER_GUIDE.md).

> **Numbering and shared tasks:** this manual numbers its own chapters from 1. A task that several officers do is printed word for word in the manual of each of those officers. A reference to a section in another manual names that manual. The [manual map](#manual-map) lists the chapters of all four officer manuals.

---

## Contents

- [1. Double-entry bookkeeping primer](#1-double-entry-bookkeeping-primer)
- [2. Finances: the Treasurer's work](#2-finances-the-treasurers-work)
- [3. Supreme forms](#3-supreme-forms)
- [4. Payment methods, checks, revenue, asset photos and remote help](#4-payment-methods-checks-revenue-asset-photos-and-remote-help)
- [5. The Three-Signature Expense Flow](#5-the-three-signature-expense-flow)
- [6. The Active Desks and the Treasurer Desk](#6-the-active-desks-and-the-treasurer-desk)
- [7. The budget review and vote](#7-the-budget-review-and-vote)
- [8. The Operations Knowledge Archive](#8-the-operations-knowledge-archive)
- [9. Revenue split profiles](#9-revenue-split-profiles)
- [10. Batch coding and cash box audits](#10-batch-coding-and-cash-box-audits)
- [11. Account ownership and parish-held revenue](#11-account-ownership-and-parish-held-revenue)
- [12. Split accounts, budget categories and payment account names](#12-split-accounts-budget-categories-and-payment-account-names)
- [Manual map](#manual-map)

### How to read a tutorial

Every tutorial starts with a **Prerequisite (who can do this)** line. The line states the access privilege that the task needs. Stop when your role is not on the line.

Every tutorial then has five parts: **Goal**, **Start point**, **Steps**, **Expected result** and **Common problems**.
A **Warning** line comes before the steps when the task deletes data, sends messages, posts money or cannot be undone.

---

## 1. Double-entry bookkeeping primer
This primer explains the bookkeeping rules behind every screen in this manual. Read it before your first coding session.

### 1.1 Concept: the two sides of every transaction
The council's general ledger is a double-entry ledger. Every transaction has two sides:

- a **debit** side, on the left of the ledger;
- a **credit** side, on the right of the ledger.

The debits of a transaction always equal its credits. A transaction with unequal sides cannot be saved.

Each side names a ledger account. The accounts are listed in the chart of accounts (section 6.4.1).

### 1.2 Concept: the five account types
| Account type | Holds | A debit | A credit |
| --- | --- | --- | --- |
| **Assets** | Money and property the council owns, for example the checking account | Increases the balance | Decreases the balance |
| **Liabilities** | Money the council owes, for example a parish share not yet paid | Decreases the balance | Increases the balance |
| **Equity** | The council's net worth | Decreases the balance | Increases the balance |
| **Revenue** | Money the council earns, for example fish fry sales | Decreases the balance | Increases the balance |
| **Expenses** | Money the council spends, for example food supplies | Increases the balance | Decreases the balance |

Assets equal liabilities plus equity. The **Balance Sheet** page shows this equation for the council.

### 1.3 Concept: three examples from the Treasurer Desk
| Event | Debit | Credit |
| --- | --- | --- |
| A member gives a $50 cash donation. | Cash (Assets) $50 | Donation revenue (Revenue) $50 |
| The council pays a $120 expense report by check. | The coded expense account (Expenses) $120 | Checking (Assets) $120 |
| A $1,000 fish fry deposit posts to a 60% / 40% split account (section 12). | Checking (Assets) $1,000 | Council fish fry revenue (Revenue) $600 and Parish fish fry revenue (Revenue) $400 |

The third example is a GL split. One debit line meets two credit lines. The credits still add up to the debit. The split account itself takes no posting.

### 1.4 Concept: coding, bulk coding and GL splits
- **Coding** gives one expense report a budget line and a ledger account. The Treasurer codes each report before the Grand Knight signs it (section 6.4).
- **Bulk coding** gives one ledger account to a batch of electronic donations in one step (section 10.5).
- **A GL split** shares each posting to one Revenue line among 1 to 10 other Revenue lines by fixed percentages that add up to 100% (section 12).

Coding is mandatory. A report without a budget line and a ledger account does not reach the Grand Knight.

### 1.5 Check that the books balance
> **Prerequisite (who can do this):** You must be the council's Treasurer or Financial Secretary, a seated officer, an Admin of the council, or a Super Admin.

**Goal:** Confirm that the council's debits equal its credits before an audit or a meeting report.

**Start point:** Sidebar → Finances → **Financial Dashboard**.

**Steps:**
1. Open the **Financial Dashboard**.
2. Read the balance banner at the top of the page.
3. Open the **Balance Sheet**. Compare the total assets with the total liabilities and equity.

**Expected result:** The dashboard shows **✓ Ledger Balanced (Zero Leaks)**. The two totals of the **Balance Sheet** are equal.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The banner does not show **✓ Ledger Balanced (Zero Leaks)**. | A posting has unequal sides, or a cash box variance is not closed. | Read the newest postings in the **General Ledger Spreadsheet**. Close the cash box audit (section 10.6). |
| An account has an unexpected negative balance. | A debit and a credit were swapped. | Post a correcting transaction with the sides reversed (section 2.5). |

---

## 2. Finances: the Treasurer's work

### 2.1 Concept: the two-signature expense path
| Step | Who acts | Where | Status tag |
| --- | --- | --- | --- |
| 1. File | The member | **My Expense Reports** | **Submitted** |
| 2. Payment request | The Financial Secretary | **FS Expense Audit** → **📝 Verify & Sign Expense** | **RECORDED BY FS** |
| 3. Categorize | The Treasurer | **Treasurer Ledger Audit Desk** → **🏷️ Categorize & Lock Expense** | **CODED BY TREASURER** |
| 4. Final release | The Grand Knight | **GK Expense Authorize** → **✍️ Final Release for Payment** | **Approved** |
| 5. Pay | The FS or the Treasurer | **Bulk Check Payments Made** | **Reimbursed** |
| Return | Council leadership | **Leadership Auditing Queue** → **Reject & Return** | **Returned** |

- A Super Admin may sign either line, but never both lines of the same report.
- Each signer chooses the budget line in **Assign Ledger Budget Line Item**. The report saves the line.
- The budget counts the report only against the saved line.
- The Treasurer chooses the ledger account before the Grand Knight signs. The account decides the budget line. A green line on the **Ledger Line Coder** names the line, for example **[ Inferred Budget: Automatically Mapped to Monthly Council Meetings ]**. **🏷️ Categorize & Lock Expense** locks the account and the line.
- The officer who issued the order sees a **🔒 Collusion Guard** tag. That officer sees no **✍️ Final Release for Payment** button.
- Council Admins open both desks to follow the work. Only the seat holders or a Super Admin sign.
- A signer sees no button on a report the signer cannot sign. A tag tells who signs the report.
- A return clears both signatures and the saved budget line.

<!-- KEEP_IMAGE: my expense reports capture -->
![My Expense Reports (/expenses)](../generated/dashboard_visual_catalog/expenses.png)
<!-- /KEEP_IMAGE -->

### 2.2 Return a report to the member
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

### 2.3 Pay approved reports by check
> **Prerequisite (who can do this):** You must be the council's Financial Secretary or Treasurer, or a Super Admin. An Admin without a finance role does not see the page.
> **Warning:** a recorded check is permanent money out of the council's books.

**Goal:** Record the checks for dual-signed reports.

**Start point:** Sidebar → Finances → **Bulk Check Payments Made**.

**Steps:**
1. Tick the reports to pay. The page lists only reports with both signatures.
2. Enter the check number and the payout date for each report.
3. Save.

<!-- KEEP_IMAGE: bulk check payments made capture -->
![Bulk Check Payments Made (/expenses/disbursements)](../generated/dashboard_visual_catalog/expenses_disbursements.png)
<!-- /KEEP_IMAGE -->

**Expected result:** The member sees **Reimbursed** with the check number.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A report is missing. | The report lacks a signature. | Follow the report in the auditing queue (section 2.2). |

### 2.4 Concept: the general ledger
The general ledger is a double-entry ledger. Every transaction has debit lines and credit lines that balance.
A shared transaction id groups the lines.

| Page | Shows |
| --- | --- |
| **General Ledger Spreadsheet** | The chart of accounts with every posting |
| **Balance Sheet** | Assets against liabilities and equity |
| **Financial Dashboard** | Cash flow liquidity, the balance sheet summary and **Quick actions** (the transfer between accounts) |

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

### 2.5 Post to the ledger or reconcile a bank statement
> **Prerequisite (who can do this):** You must be the council's Financial Secretary or Treasurer, or a Super Admin.
> **Warning:** a posting changes the council's books for every reader.

**Goal:** Record a transaction, move funds or match a bank statement.

**Start point:** Sidebar → Finances → **Financial Dashboard** → **Quick actions**.

**Steps:**
1. To post: choose the debit account and the credit account. Enter the amount and the description. Save.
2. To transfer: choose two asset accounts. Enter the amount. Save.
3. To reconcile: open **Active Desks** → **Treasurer Desk** → **Bank Statement Match-Window**. Upload the bank CSV file. The Financial Dashboard has no bank statement table.
4. Read the matched rows and the unmatched rows.

**Expected result:** The dashboard shows **✓ Ledger Balanced (Zero Leaks)** when debits equal credits.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The transfer is refused. | The amount exceeds the source account balance. | Lower the amount. |
| The CSV file is refused. | The file has no Date column, or no Amount or Withdrawal/Deposit columns. | Export the statement again with a header row. |
| A bank row stays unmatched. | No posting has the same check number, or the same amount within 5 days. | Post the missing transaction. Upload again. |

### 2.6 Vet a charity request
> **Prerequisite (who can do this):** You must be a seated officer, a Trustee or an Admin of the council, or a Super Admin. The Knight Shepherd never vets the Shepherd's own request.
> **Warning:** a decline stops the request.

**Goal:** Review a member's charity request and move the request forward.

**Start point:** **Active Desks** → **Grand Knight Desk** → **Charitable Grant Requests Vetting Board** folder. Other vetting officers use Sidebar → Finances → **Charity Vetting Queue**.

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

### 2.7 Pay an approved charity grant
> **Prerequisite (who can do this):** You must be the council's Financial Secretary or Treasurer, or a Super Admin. You cannot pay a request that you endorsed or that you shepherd.
> **Warning:** the check is permanent money out of the council's books.

**Goal:** Pay a grant that the council approved and an FS or GK endorsed. This is the **[ ⛪ Treasurer Check Settlement ]** step.

**Start point:** **Active Desks** → **Treasurer Desk** → **Charitable Contribution Matches**, or **Financial Secretary Desk** → **Charity Check Issuance Console**. The same console is on Sidebar → Finances → **Charity Payments Made Ledger**.

**Steps:**
1. Find the request in **Approved requests awaiting payment**. A request without its endorsement shows **Waiting for the FS/GK compliance endorsement** and has no pay button (section 4.3.1 of the Executive Governance Manual).
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
| The request shows **Waiting for the FS/GK compliance endorsement**. | No FS, GK or DGK has endorsed it. | Ask one of them to endorse it (section 4.3.1 of the Executive Governance Manual). |
| The request shows "You endorsed this request". | The officer who endorses a request cannot pay it. | Ask another finance officer to write the check. |
| The check is refused with "already recorded check". | The council used that check number before. | Type the next unused check number. |
| The check is refused with "choose its charity type". | The organization is not in the registry yet. | Choose the **Charity type (if not registered yet)**. |

### 2.8 Record or correct a donation
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

### 2.9 Concept: the annual budget
The budget covers one fraternal year, July 1 to June 30.

| Badge | When | What editors can do |
| --- | --- | --- |
| **Not Yet Open** | Before May 1 | Read only |
| **Draft** | May 1 (00:00) to June 30 (midnight) | Run the rollup, add lines, edit proposed amounts |
| **Finalized** | From July 1 | Read only |
| **Approved** | After the council vote | Frozen for everyone |

- Every member reads the budget. Non-editors see a **Transparency view** marked **Read only**.
- Editors are the council Admins, the Treasurer, the FS, the **Designated Budget Director** and Super Admins.
- A council Admin or a Super Admin assigns the **Designated Budget Director** in **Assign Designated Budget Director** at the top of the **Annual Budget Center**. Choose a member, or **Nobody**. The choice saves at once. The roster form has no Budget Director box.
- Only a Super Admin override changes a budget outside the window. No override reopens an approved budget.

<!-- KEEP_IMAGE: annual budget projections capture -->
![Annual Budget Center (/budget)](../generated/dashboard_visual_catalog/budget.png)
<!-- /KEEP_IMAGE -->

### 2.10 Prepare the budget with the rollup
> **Prerequisite (who can do this):** You must be a council Admin, the Treasurer, the Financial Secretary, the Designated Budget Director or a Super Admin. The year must be in **Draft**.

**Goal:** Fill the next year's budget from last year's actual spend.

**Start point:** Sidebar → Finances → **Annual Budget Center**.

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

### 2.11 Approve and finalize the budget
> **Prerequisite (who can do this):** You must be a council Admin, the Treasurer, the Financial Secretary or a Super Admin. The Designated Budget Director cannot approve.
> **Warning:** approval freezes the whole year for everyone. Nothing reopens an approved budget.

**Goal:** Record the council's vote on the budget.

**Start point:** Sidebar → Finances → **Annual Budget Center**.

**Steps:**
1. Check every proposed amount.
2. Select **Approve & Finalize Entire Budget**.
3. Select **Yes, approve and finalize**. You cannot undo this step.

**Expected result:** Each proposed amount becomes the approved amount. The year shows **Approved**. The dashboard gauges use the approved amounts as caps.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The button is greyed out. | The year has no lines, or the year opens after May 1. | Run the rollup first. |

### 2.12 Concept: receipts, split tickets and Honorary Expenses
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
- When receipt reading is connected (section 5.2 of the Administrator User Guide), **🔍 Read receipt** fills in the merchant, the total and the lines from the attached photo. The member checks every figure before saving.

> **Warning:** check the reason on every Honorary Expense before you sign. The badge shows on the FS, Treasurer and GK desks and in the **Leadership Auditing Queue**.

---

## 3. Supreme forms

### 3.1 File Form 1728 or Form 1295 with Supreme
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

## 4. Payment methods, checks, revenue, asset photos and remote help

### 4.1 Concept: payment methods in the ledger
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

A donation by check counts in the cash column of the event, because the council deposits checks with the cash. The donation records the check number too (section 4.1.1).

### 4.1.1 Concept: check numbers on donations
A donation by check now records the number printed on the check. The number helps the Financial Secretary match each check to the bank deposit.

- On the phone, the **Collect** tab shows a **Check** tile when the council turned Check on. The Check form has a **CHECK NUMBER (REQUIRED)** field.
- On the web, the **Donations History** form shows a **Check number** field when **Check** is the method.
- A donation by check cannot be saved without a check number. A donation by any other method cannot have a check number.

### 4.1.2 Record a donation by check on the phone
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

### 4.2 Post a lump-sum revenue override
> **Who can do this:** The council's Treasurer or a Super Admin.
> **Warning:** The revenue posts to the general ledger at once.

**Goal:** Post a corrected cash bag count, or a block of electronic revenue taken outside the portal, in one action.

**Start point:** **Active Desks** row → **Treasurer Desk** → **High-Volume Batch Transaction Coder** → **🧾 Lump-Sum Financial Override**.

**Steps:**
1. Select the type in **Override type**: **Corrected cash bag count** or **Bulk electronic revenue block**.
2. Select the event or activity in **Event or activity**.
3. Select the method in **Payment method**. A cash bag lists the cash methods. An electronic block lists Credit Card, Venmo, Zelle, Zeffy and Parishsoft.
4. Select the **Revenue GL line**.
5. Enter the amount in **Amount**.
6. Select **Post override**. The revenue posts to the ledger at once, deposited to the batch coder's deposit account.

**Expected result:** A message shows the amount and the override type. Both ledger lines show the payment method.

The Financial Dashboard has no **💰 Log Concluded Event Revenues** card. Use this row instead.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A method, such as Zeffy, is not in the **Payment method** list. | The council did not turn that method on. | Ask an Admin to turn the method on in **Council Lookup Tables**. |
| The message says the method "is not one this council has enabled for payments." | An Admin turned the method off after the page opened. | Reload the page, then choose an enabled method. |
| The row is not on the batch coder. | You are not the council's Treasurer or a Super Admin. | Ask the Treasurer. |

### 4.3 Add a photo to a council asset
> **Who can do this:** The council's Grand Knight, Deputy Grand Knight, Trustees, Admins, Financial Secretary and Treasurer, or a Super Admin.

**Goal:** File a photo of the item in the council Google Drive and attach the photo to its asset record.

**Start point:** Sidebar → System Settings → **🛠️ Council Asset Management** → **Edit** (or **Add photo**) on the asset row. The **Council assets** link on **My Expense Reports** opens the same page.

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

### 4.4 Concept: co-watching remote assistance
An officer or Admin who needs help can share a copy of the screen with the Super Admins. The officer starts and stops the sharing. Nothing is shared until the officer selects **Share my screen**.

- The copy refreshes every 5 seconds while the officer shares.
- The copy never contains what the officer types in form fields. Passwords are never sent.
- The copy cannot run on the Super Admin's computer. The desk shows the copy as a still picture of the page.
- Sharing stops when the officer selects **Stop sharing**, when a Super Admin closes the request, or after 30 minutes without an update.

### 4.5 Ask for remote help
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

---

## 5. The Three-Signature Expense Flow

### 5.1 Concept: the Three-Signature Expense Flow
Under the roadmap, the **Three-Signature Expense Flow** draws the path of an expense report. Each box shows how many of the council's reports wait at that step.

| Box | Who acts | What the step does |
| --- | --- | --- |
| **Member submits** | Any member | The member submits the expense report. |
| **1. Payment request** | Financial Secretary | The Financial Secretary audits the report and issues the payment request. |
| **2. Ledger coding** | Treasurer | The Treasurer picks the budget line and the ledger account. |
| **3. Counter-signature** | Grand Knight | The Grand Knight signs. The report becomes Approved. |
| **Check paid** | Financial Secretary or Treasurer | The check is recorded. The report becomes Reimbursed. |

- Council leadership may return a submitted report to the member as a draft, with a reason. The return clears the report's signatures.
- Nobody signs a report that they submitted. One officer never signs two lines of the same report.

---

## 6. The Active Desks and the Treasurer Desk

### 6.1 Concept: the Active Desks row
The dashboard is a set of desks. A row of folder tabs sits under the navy header on every page. The row has the title **Active Desks**.

- Each tab looks like the tab of a paper file folder. A navy outline frames each tab.
- The open desk is white and raised. A deep gold edge runs along its top.
- **Home** is the first tab. **Member Desk** is the last tab.
- Select a tab on any page. The dashboard opens on that desk.
- Select the **Home** tab to return to **Home** from any page.
- Select **Executive Dashboard** in the sidebar to open the **Executive Summary** page. That page is not a desk tab. See section 14.11 of the Executive Governance Manual.

Every signed-in member sees the row. A plain member gets **Home** and **Member Desk**. Each officer seat adds its own desk.

A Council Historian without an officer seat and without Admin rights gets **Home**, **Historian Desk** and **Member Desk**. This Historian also gets the **Executive Dashboard** link in the sidebar (section 14.11 of the Executive Governance Manual).

After you sign in, the portal opens on the **Home** tab. This is true for every member, officer, Admin and Super Admin. When more cards are below the first screen, the line **Scroll down for more council info ↓** shows at the bottom edge. The line fades away when you start to scroll down. The four tabs of the Volunteer Check-In & Service Center are on the **Member Actions Hub** (sidebar **Member Actions Hub**). They are not on the **Member Desk** tab.

Every module that a seat works in is a folder at the top of that seat's desk (section 6.2.1). You do not use the sidebar to find these modules. The **Leadership Auditing Queue** page opens from the **Financial Secretary Desk**.

### 6.2 Concept: the desks
A desk holds the work of one seat. Every officer desk is a desk blotter of drawers (section 6.2.2). You sign, code and pay inside a drawer on the desk. The **Member Desk** has no drawers.

The portal shows a desk tab only to a reader who may do the desk's work.

| Tab | Who gets the tab | What the tab shows | Full desk page |
| --- | --- | --- | --- |
| **Grand Knight Desk** | The council's GK and DGK, the council's Admins and Super Admins | The desk blotter: one drawer for each module (section 6.2.2), with **Approved Expenses** first. Under the drawers: the **Member Roster** panel. | None. You work inside the drawers. |
| **Financial Secretary Desk** | The council's FS, the council's Admins and Super Admins | The desk blotter: one drawer for each module (section 6.2.2), with **Auditing & Return Queue** first. Under the drawers: the **Member Roster** panel. | None. You work inside the drawers. |
| **Treasurer Desk** | The council's Treasurer, the council's Admins and Super Admins | The desk blotter, with **Ledger Line Coder**, **Expense Report (ER) Settlement** and **Charitable Contribution Matches** first. | None. You work inside the drawers. |
| **Recorder Desk** | The council's Recorder, the council's Admins and Super Admins | The desk blotter, with the **Historical Meeting Minutes Archive** first on the spine. | None. You work inside the drawers. |
| **Historian Desk** | The council's Council Historian, the council's Admins and Super Admins | The desk blotter, with the **Fraternal Diary Entry Logs** first. | None. You work inside the drawers. |
| **Member Desk** | Every reader of the dashboard | Top row, side by side: **[ 🚗 Open Shifts Needing Volunteers ]** and **My shifts: next 30 days**. Under them: **[ 📥 My Charity Requests ]** and **My open expense sheets**, then the **Member Roster** panel. No drawers. | Sidebar → Finances → **My Expense Reports**; Sidebar → Performance → **Council Dashboard** |

### 6.2.1 Concept: the advanced modules on the desks
The desks no longer use module folders. Each advanced module below is a drawer on its desk (section 6.2.2). The module's own page also stays at its web address.

A drawer shows only to a reader who may open the module. A reader who may not open a module does not see its drawer.

| Desk | Module drawer | What the module does |
| --- | --- | --- |
| **Grand Knight Desk** | **Charitable Grant Requests Vetting Board** | Claim, question, advance and place charity grant requests on the agenda (section 2 of the Executive Governance Manual). |
| **Grand Knight Desk** | **Constitutional Advisor Panels** | Ask a parliamentary or bylaws question. Officers only. |
| **Grand Knight Desk** | **Connected Councils** | Invite nearby councils and answer their invites (section 7). |
| **Financial Secretary Desk** | **Semiannual Audit Form 1295 Center** | The Trustees' step-by-step audit and the Form 1295 report. |
| **Financial Secretary Desk** | **Charity Check Issuance Console** | Pay approved charity requests and gifts by check. |
| **Treasurer Desk** | **Annual Budget vs Actuals Ledger Grid** | **Budgeted vs. Current Actual Spend** and the **📊 Budget Allocation & YOY Variance Analyzer**. |
| **Treasurer Desk** | **Bank Statement Match-Window** | Match a bank statement CSV file against the general ledger. Only the FS, the Treasurer and Super Admins can run the match. |
| **Recorder Desk** | **Council Resolutions and Motions Ledger** | Every motion on the council's meetings of this fraternal year, with its meeting, presenter, source and result. |
| **Historian Desk** | **Google Drive Media Gallery Sync Board** | Upload and tag photos and build Smart Albums. Select a photo to open the viewer. |

The Deputy Grand Knight (DGK) gets the same **Grand Knight Desk** drawers as the GK.

### 6.2.2 Concept: the filing spine, the Desk Blotter and the alert boundary
Every officer desk is a split-view console: the **Grand Knight Desk**, the **Financial Secretary Desk**, the **Treasurer Desk**, the **Recorder Desk** and the **Historian Desk**. The console has two parts:

- **The filing spine** (the left quarter of the desk). The spine is a flat list of folder links, one for each module. A folder shows the module name and, for a queue, the number of sheets that wait. No folder is inside another folder.
- **The Desk Blotter** (the right three quarters of the desk). The folder that you select opens here. The full module works on the blotter. You sign, verify and look up records on the blotter. You do not go to another page.

The spine has this order from the top:

1. **Priority: waiting on you.** Every folder with work that waits for you moves to the top of the spine, inside a red box. Each of these folders has a thick red border.
2. **The cabinets** (the **Financial Secretary Desk** and the **Treasurer Desk** only). Two cabinet blocks show, one above the other:
   - **[ 📥 Inbound Operations ]**: work that comes in to you. For example, payment requests, coding, cash box counts, donation records and bank matches.
   - **[ 📤 Outbound Operations ]**: money and reports that go out. For example, checks, charity matches and the Form 1295.
3. **The other folders.** On the **Grand Knight Desk**, the **Recorder Desk** and the **Historian Desk**, the other folders show in one flat list.
4. **[ 🔧 Accounting Configuration ]** (the **Treasurer Desk** only). This block holds the **Chart of Accounts & GL Setup** folder (section 6.4.1).
5. **[ 📖 Reference Workflows ]** (every officer desk). This block is always at the bottom of the spine. It holds the workflow drawers that you read for reference (section 6.2.3). A reference folder shows its count in grey. A reference folder never gets a red border and never moves to the top. The same sheet therefore lights only one folder: the folder where you sign.

To close a folder, select **[ 🔀 Back to Desk Blotter ]** at the bottom of the blotter. You can also select **Close** or push **Esc**.

**Alert boundary:** a folder with a thick red border and a red glow has work that waits for you. It moves to the top of the spine. The folder also shows a red line that names the work, for example *"🔴 Waiting for your signature"*. The desk checks the queues again every 30 seconds.

| Desk | Folder with the alert boundary | The red border shows when |
| --- | --- | --- |
| **Grand Knight Desk** | **Approved Expenses** | A sheet in the release queue waits for your final release, and you may sign it. A sheet that you submitted, ordered or coded does not light the border. |
| **Financial Secretary Desk** | **Auditing & Return Queue** | A sheet waits for its payment request, and you may sign it. Your own sheet does not light the border. |
| **Grand Knight Desk** | **Flagged Hours Review** | A time entry is held for review (section 10 of the Executive Governance Manual). |
| **Grand Knight Desk** | **Shifts Awaiting Hours** | A volunteer is past the first hours reminder and has not logged time. |
| **Grand Knight Desk** and **Financial Secretary Desk** | **FS/GK Compliance Endorsements** | An approved charity grant waits for your endorsement, and you do not shepherd it. |
| **Treasurer Desk** | **Ledger Line Coder** | A signed sheet waits for your ledger account, and you may code it. |
| **Treasurer Desk** | **Expense Report (ER) Settlement** | A fully signed sheet waits for your check, and you may pay it. Your own sheet does not light the border. |
| **Treasurer Desk** | **Charitable Contribution Matches** | A charity request or gift waits for its check. |
| **Recorder Desk** | **Meeting Minutes Entry Desk** | The minutes of a meeting are due or overdue. The red line counts the overdue meetings. |

The folders in **[ 📖 Reference Workflows ]** never show the alert boundary. They are read only: they have no fields and no buttons. Open a reference folder to see the work that waits on each step. Do the work in the working folder that the step names. For example, the **Charitable Donation Workflow** folder counts the approved charity requests that wait for your endorsement. You endorse them in **FS/GK Compliance Endorsements**.

The drawers on each desk:

| Desk | Drawer | What you do in the drawer |
| --- | --- | --- |
| **Grand Knight Desk** | **Approved Expenses** | Select **✍️ Final Release for Payment** on each sheet. |
| **Grand Knight Desk** | **Flagged Hours Review** | Approve or reject the held time entries (section 10 of the Executive Governance Manual). |
| **Grand Knight Desk** | **Shifts Awaiting Hours** | Read the volunteers who served but have not logged time, with their phone numbers. |
| **Grand Knight Desk** | **Charitable Grant Requests Vetting Board** | Claim, question, advance and place charity grant requests on the agenda (section 2 of the Executive Governance Manual). |
| **Grand Knight Desk** | **FS/GK Compliance Endorsements** | Select **✍️ Endorse for payment** on each approved charity grant (section 4.3.1 of the Executive Governance Manual). |
| **Grand Knight Desk** | **[ 📈 Council Goals & Targets ]** | Read the Star Council objectives of this fraternal year: Membership Intake, Charitable Dollars (funds raised) and Volunteer Hours, each against its target. |
| **Grand Knight Desk** | **Shared Loaner Library** | List, lend and check in council assets (section 15.3 of the Executive Governance Manual). |
| **Grand Knight Desk** | **Affiliation Invites** | Accept or decline invites from nearby councils. |
| **Grand Knight Desk** | **Connected Councils** | Invite nearby councils (section 7). |
| **Grand Knight Desk** | **Constitutional Advisor Panels** | Ask a parliamentary or bylaws question. For example, *How much notice does a motion need?* returns the Section 122(b) rule: 10 days' previous notice and a two-thirds vote. |
| **Grand Knight Desk** | **Operations Knowledge Archive** | Write a new entry (the GK, the DGK and Admins). Search the signed operating notes of every council (section 8). |
| **Grand Knight Desk** (reference) | **Charitable Donation Workflow** | Read where each outgoing charity grant waits. Read only. |
| **Grand Knight Desk** (reference) | **Planning & Budgeting Workflow** | Read the planning steps, the goals and the budget status. Read only. Set and review the goals on **Council Wide Settings** (section 7). |
| **Grand Knight Desk** (reference) | **[ 🗳️ Council Election Workflow ]** | Read the four election steps, the progress wheels and the nominees. Read only. Nominate in the **Council Election Center** (section 6.2.3). |
| **Financial Secretary Desk** | **Auditing & Return Queue** | Select **📝 Verify & Sign Expense** on each sheet, or return a sheet to its member with a reason. The sidebar link **FS Expense Audit** opens the same queue. |
| **Financial Secretary Desk** | **Expense Report (ER) Routing Track** | Read each open sheet and the signature that it waits for. |
| **Financial Secretary Desk** | **Charitable Donation Records** | Record, check and correct council donations. |
| **Financial Secretary Desk** | **FS/GK Compliance Endorsements** | Select **✍️ Endorse for payment** on each approved charity grant (section 4.3.1 of the Executive Governance Manual). |
| **Financial Secretary Desk** | **Charity Check Issuance Console** | Pay approved charity requests and gifts by check. |
| **Financial Secretary Desk** | **Semiannual Audit Form 1295 Center** | The Trustees' step-by-step audit and the Form 1295 report. |
| **Financial Secretary Desk** | **Excel Roster Imports** | Download the roster template. Upload the Supreme roster CSV. |
| **Financial Secretary Desk** | **Operations Knowledge Archive** | Search the signed operating notes of every council (section 8). |
| **Financial Secretary Desk** (reference) | **Expense Report (ER) Workflow** | Read where each sheet waits. Read only. Sign in **Auditing & Return Queue** (section 6.2.3). |
| **Financial Secretary Desk** (reference) | **Charitable Donation Workflow** | Read where each outgoing charity grant waits. Read only. |
| **Treasurer Desk** | **Ledger Line Coder** | Pick the ledger account. Read the green **Inferred Budget** line. Select **🏷️ Categorize & Lock Expense**. Log concluded revenue. |
| **Treasurer Desk** | **Expense Report (ER) Settlement** | Pay fully signed sheets by check. |
| **Treasurer Desk** | **Charitable Contribution Matches** | Match approved charity requests and gifts to their checks, and pay them. |
| **Treasurer Desk** | **Cash Box Audit Closure Panel** | Count each concluded event's cash box and log any variance (section 10). |
| **Treasurer Desk** | **High-Volume Batch Transaction Coder** | Code many electronic donations to one Revenue line (section 10). |
| **Treasurer Desk** | **Annual Budget vs Actuals Ledger Grid** | Read budgeted against actual spend and the variance analyzer. |
| **Treasurer Desk** | **Bank Statement Match-Window** | Match a bank statement CSV file against the general ledger. |
| **Treasurer Desk** (accounting) | **Chart of Accounts & GL Setup** | Review every general ledger account, its type and its posted balance (section 6.4.1). |
| **Treasurer Desk** (reference) | **Expense Report (ER) Workflow** | Read where each sheet waits. Read only. Code in **Ledger Line Coder** and pay in **Expense Report (ER) Settlement** (section 6.2.3). |
| **Treasurer Desk** (reference) | **Charitable Donation Workflow** | Read where each outgoing charity grant waits. Read only. Pay in **Charitable Contribution Matches** (section 2.7). |
| **Treasurer Desk** (reference) | **Planning & Budgeting Workflow** | Read the planning steps and the budget status. Read only. Mark the budget reviewed on **Council Wide Settings** (section 7). |
| **Recorder Desk** | **Historical Meeting Minutes Archive** | Read the published minutes of every past meeting before you open a session (section 14.8.1 of the Executive Governance Manual). This drawer spans the top row of the desk. |
| **Recorder Desk** | **Meeting Minutes Entry Desk** | Write, save and publish the minutes (section 14.8 of the Executive Governance Manual). |
| **Recorder Desk** | **Start Live Meeting Sequence** | Start the live console and read the PIN (section 14.9 of the Executive Governance Manual). |
| **Recorder Desk** | **Council Resolutions and Motions Ledger** | Read every motion of this fraternal year and its result. |
| **Recorder Desk** (reference) | **[ 🗳️ Council Election Workflow ]** | Read the election steps and the progress wheels. |
| **Historian Desk** | **Fraternal Diary Entry Logs** | Read the council's diary entries by year, author or word (section 14.10.1 of the Executive Governance Manual). |
| **Historian Desk** | **Monthly Newsletters** | Write one newsletter a month (section 14.10 of the Executive Governance Manual). |
| **Historian Desk** | **Meeting Photos** | File each meeting's photo to Google Drive (section 14.10 of the Executive Governance Manual). |
| **Historian Desk** | **Oral History Recordings** | Listen to testimonials and record your own (section 14.10 of the Executive Governance Manual). |
| **Historian Desk** | **Google Drive Media Gallery Sync Board** | Upload and tag photos and build Smart Albums. A saved album opens at once as the active filter under **Smart Albums**. Select a photo to open the viewer. The Council Historian may tag photos to any past event or meeting of the council. |
| **Historian Desk** (reference) | **[ 🗳️ Council Election Workflow ]** | Read the election steps and the progress wheels. |

A tile shows only to a reader who may open its module. An Admin who does not hold the seat reads the drawers but cannot sign.

**Back to Desk Blotter:** some work must open another page. For example, the release of a long-term asset opens the asset form. Then a **[ 🔀 Back to Desk Blotter ]** bar shows under the tab row. Select the bar to go back to your desk.

**The Oversight Desk is gone.** Its audits are drawers on the **Grand Knight Desk**: **Flagged Hours Review** and **Shifts Awaiting Hours**. Council access requests are on the **Super Admin Desk** only (section 14.11 of the Executive Governance Manual). A saved `/dashboard#oversight` address opens your first tab.

A seat clears a desk only on the officer's own council. A Super Admin who picks another council in the council drop-down sees every desk of that council.

Earlier sections of this guide name the **Executive Dashboard** as a start point. For those tasks, select **Executive Dashboard** in the sidebar. The **Executive Summary** page opens.

Each tab has its own web address. The address is the dashboard address with the tab name after a `#` sign:

| Tab | Address |
| --- | --- |
| **Home** | `/dashboard#home` |
| **Grand Knight Desk** | `/dashboard#grand-knight` |
| **Financial Secretary Desk** | `/dashboard#financial-secretary` |
| **Treasurer Desk** | `/dashboard#treasurer` |
| **Recorder Desk** | `/dashboard#recorder` |
| **Historian Desk** | `/dashboard#historian` |
| **Member Desk** | `/dashboard#member` |

Save a desk address as a browser bookmark to open the desk directly. The browser also remembers the last tab you opened. The dashboard opens on that tab the next time. A tab you cannot open falls back to your first tab. For most readers, the first tab is **Home**.

### 6.2.3 Concept: the workflow drawers
Three drawers show a whole workflow in one place. Each workflow drawer uses the layout of the **Planning & Budgeting Workflow** drawer:

- A highlighted action bar at the top. One sentence tells you what happens now and names the working folder where you act. The bar stays gold: a reference folder never turns red.
- A row of numbered steps. The current step has a gold border and the label **(now)**. A done step has a tick.
- A step that you act on carries the tag **Your step**. A step with a queue shows the number of items waiting.
- Progress wheels. Each wheel fills as its count comes closer to complete.

| Drawer | Desks | Steps | What you do in the drawer |
| --- | --- | --- | --- |
| **Expense Report (ER) Workflow** | **Financial Secretary Desk** and **Treasurer Desk** (in **[ 📖 Reference Workflows ]**) | 1. **Payment request** (FS). 2. **Ledger coding** (Treasurer). 3. **GK approval** (Grand Knight). 4. **Check issued** (Treasurer). | Read **Every open sheet**: each sheet, its total, the step it waits at and who acts. The Financial Secretary signs in **Auditing & Return Queue**. The Treasurer codes in **Ledger Line Coder** and pays in **Expense Report (ER) Settlement**. |
| **Charitable Donation Workflow** | **Financial Secretary Desk**, **Treasurer Desk** and **Grand Knight Desk** (in **[ 📖 Reference Workflows ]**) | 1. **[ 📋 Member Charity Request ]** (Knight Shepherd, vetters, council vote). 2. **[ ✍️ FS/GK Compliance Endorsement ]** (FS, GK or DGK). 3. **[ ⛪ Treasurer Check Settlement ]** (Treasurer). | Read where each outgoing charity grant waits. The FS, GK and DGK endorse in **FS/GK Compliance Endorsements**. The Treasurer pays in **Charitable Contribution Matches** (the FS in **Charity Check Issuance Console**). Gifts coming in stay on the batch coder and cash box drawers. |
| **[ 🗳️ Council Election Workflow ]** | **Grand Knight Desk**, **Recorder Desk** and **Historian Desk** (in **[ 📖 Reference Workflows ]**) | 1. **Open the ballot** (before May 1). 2. **Nominations** (May 1 - 31). 3. **Election** (June). 4. **New term** (July 1). | Read the wheels **Offices on the ballot** and **Offices with a nominee**, and the nominees of each office. Nominate in the **Council Election Center** (Sidebar). Admins set the ballot on **Council Lookups**. |

The workflow drawers have no fields and no buttons. They read the same records as the working folders, so a sheet signed in **Auditing & Return Queue**, **Ledger Line Coder** or **Expense Report (ER) Settlement** moves to its next step in the workflow drawer.

The workflow drawers are reference folders. They sit in the **[ 📖 Reference Workflows ]** block at the bottom of the spine. They never get the red border, so a waiting sheet lights only its signing folder.

The **[ 🗳️ Council Election Workflow ]** drawer replaces the **Council Election Tracker** drawer. A mid-year election leads the action bar while its nominations are open.

### 6.3 Open a drawer on your desk
> **Who can do this:** the seat holder of the desk, the council's Admins and Super Admins. A drawer shows only when your role may open its module.

**Goal:** Work in an advanced module without leaving your desk.

**Start point:** **Active Desks** row → your desk.

**Steps:**
1. Select your desk tab.
2. Find the tile of the module. A tile with a red border has work for you.
3. Select the tile. The drawer slides out from the right.
4. Do the work in the module.
5. Select **[ 🔀 Back to Desk Blotter ]**.

**Expected result:** The module works inside the drawer the same as on its own page.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| A drawer in section 6.2.2 is not on your desk. | Your role may not open that module, or the council switched the module off. | Ask the seat holder or a Super Admin. |
| The **Bank Statement Match-Window** shows a notice and no upload box. | Only the FS, the Treasurer and Super Admins can match bank statements. | Ask the Treasurer to run the match. |
| You want the module on a larger screen. | The drawer is narrower than the full page. | Open the module's page from the sidebar. |

### 6.4 Code sheets from the Treasurer Desk
> **Who can do this:** the council's Treasurer and Super Admins code sheets. The council's Admins read the desk.

**Goal:** Code the waiting sheets and pay the fully signed sheets without leaving the desk.

**Start point:** **Active Desks** row → **Treasurer Desk**.

**Steps:**
1. Select the **Treasurer Desk** tab.
2. Select the **Ledger Line Coder** tile. A red border means that a sheet waits for your coding.
3. Pick the ledger account for each sheet in **Assign General Ledger Account**.
4. Read the green line under the account, for example **[ Inferred Budget: Automatically Mapped to Monthly Council Meetings ]**. A long line name wraps onto more lines inside the card. The account decides the budget line. You do not pick the line.
5. Select **🏷️ Categorize & Lock Expense**. The sheet goes to the Grand Knight.
6. Select **[ 🔀 Back to Desk Blotter ]**.
7. Select the **Expense Report (ER) Settlement** tile. A red border means that a fully signed sheet waits for your check.
8. Select the sheets, type the check number and the payout date, and issue the check.
9. To pay a charity request, select the **Charitable Contribution Matches** tile. The same tile pays endorsed charity grants (section 2.7). The **Charitable Donation Workflow** folder under **[ 📖 Reference Workflows ]** only shows where each grant waits.

**Expected result:** The coded sheets leave the coding queue and show on the **Grand Knight Desk**. The paid sheets show **Reimbursed**. The counts on the tiles drop when you close each drawer.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The **Treasurer Desk** tab does not show. | You do not hold the Treasurer seat on this council, and you are not an Admin. | Ask the Treasurer to code the sheets. |
| **Log its concluded revenue** does not show in the **Ledger Line Coder** drawer. | Only the Treasurer and Super Admins log concluded revenue. | Ask the Treasurer to log the revenue. |
| A sheet shows no pay control in **Expense Report (ER) Settlement**. | You submitted that sheet. | Ask the Financial Secretary to pay the sheet. |
| The green line reads **[ Inferred Budget: choose a general ledger account first ]**. | No ledger account is chosen. | Pick an account in **Assign General Ledger Account**. |

**How the account decides the budget line:**

| Ledger account | Budget line |
| --- | --- |
| An event cost account, for example **Event Operational Costs** | The event's own budget line. A sheet with no event line goes to **Miscellaneous Others**. |
| A charity account, for example **Charitable Disbursements** | The line of the linked charity request, else **Miscellaneous Others**. |
| A council operations account, for example **Council Operational Costs** | The meetings line under Fraternal Activities, for example **Monthly Council Meetings**. |
| A Supreme assessment, fee or postage account | The Administrative Operations line that names per capita or an assessment. |
| The physical property account (a long-term asset) | The line that names equipment, else the first Capital Projects line. |
| Any other account | **Miscellaneous Others**. |

#### 6.4.1 Review the chart of accounts
> **Who can do this:** the council's Treasurer, the council's Admins and Super Admins. The folder does not change any account.

**Goal:** Check the council's general ledger accounts and their posted balances before you code sheets.

**Start point:** **Active Desks** row → **Treasurer Desk** → **[ 🔧 Accounting Configuration ]** → **Chart of Accounts & GL Setup**.

**Steps:**
1. Select the **Treasurer Desk** tab.
2. Select the **Chart of Accounts & GL Setup** folder under **[ 🔧 Accounting Configuration ]**.
3. Read the **Assets** grid. Goal accounts show indented under their bank account, with the **Virtual goal** tag.
4. Read the **Revenue** and **Expenses** grids. The **Ledger Line Coder** offers the Expense accounts.
5. To read every posting of an account, select the account name.

**Expected result:** The Desk Blotter shows one grid for each account type, with the debits, credits and balance of each account.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The grid reads **This council has no chart of accounts yet.** | The council has no general ledger accounts. | Ask a Super Admin to load the council's chart of accounts. |
| The **Cash Over/Short** account is not in the grid. | The platform adds the account at the first cash box variance. | No action. The account shows after the first variance (section 10). |

The chart of accounts is not on **Council Wide Settings**. The **Treasurer Desk** is its one home.

---

## 7. The budget review and vote

### 7.1 Concept: the Annual Budget Planner
The council plans each fraternal year in the two months before the year starts. The fraternal year runs from July 1 to June 30.

| Step | When | What happens |
| --- | --- | --- |
| **Draft** | May 1 - May 31 | Leadership drafts the Annual Council Goals and the budget lines. |
| **Review** | June 1 - June 30 | Leadership checks the goals and the budget. Leadership marks each one reviewed. |
| **Lock** | July 1 | The year starts. The goals become read-only for good. The budget figures lock. |
| **Final vote** | By July 10 | The council votes the budget. The vote locks every budget line. |

The goals and the budget each show one status:

| Status | Meaning |
| --- | --- |
| **Draft** | Nobody marked the goals or the budget reviewed yet. |
| **Reviewed** | Leadership marked the goals or the budget reviewed. Leadership can still change the goals until July 1. |
| **Locked** | The year started (goals), or the council voted (budget). |

The July 1 goals lock has no exception. Nobody can change the goals of a started year, not even a Super Admin. Set the goals before July 1.

The budget vote must be recorded by July 10. After July 10, only a Super Admin can record the vote, with the override.

The **Annual Budget Planner** banner leads the **Council Wide Settings** page. The banner shows the four steps and marks the current step **(now)**. Under the steps, the banner shows the year's goals and the budget status.

### 7.2 Mark the budget reviewed
> **Who can do this:** the council's Admins, the Financial Secretary, the Treasurer, the Designated Budget Director and Super Admins.

**Goal:** Record that leadership reviewed the drafted budget in June.

**Start point:** Sidebar → Finances → **Annual Budget Center** → **Annual Budget Planner** → **Annual budget**.

**Steps:**
1. Choose the year in **Fraternal year**.
2. Select **Open the budget** to read the budget lines.
3. Go back to **Council Wide Settings**.
4. Select **Mark budget reviewed**.

**Expected result:** The budget shows the **Reviewed** status.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| **Mark budget reviewed** does not show. | The drafting window is closed, the budget has no lines, or the budget is already reviewed. | Mark the budget reviewed between May 1 and June 30. |

### 7.3 Record the council's budget vote by July 10
> **Who can do this:** the council's Admins, the Financial Secretary, the Treasurer and Super Admins.
> **Warning:** the vote locks every budget line. You cannot undo the vote.

**Goal:** Record the council's vote on the budget at the July meeting.

**Start point:** Sidebar → Finances → **Annual Budget Center**.

**Steps:**
1. Choose the fraternal year.
2. Select **Approve & Finalize Entire Budget**.
3. Confirm the approval. You cannot undo this.

**Expected result:** The budget shows **Approved**. The planning banner shows the budget as **Locked**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The portal says the vote deadline passed. | Today is after July 10. | Ask a Super Admin to record the vote with the override. |

---

## 8. The Operations Knowledge Archive

### 8.1 Search the Operations Knowledge Archive
> **Who can do this:** the officers and Admins of every council, and Super Admins. Other members do not see this page.

**Goal:** Find the notes past leaders of your council, or of brother councils, saved about one subject or one year.

**Start point:** Sidebar → System Settings → **Operations Knowledge Archive**. The address is `/system-settings/knowledge-archive`. The **Open the archive** link on the vault card opens the same page.

**Steps:**
1. Select **Filter by My Home Council Only** to see only your council's entries. Clear the box to see every council.
2. Select a tag in **Governance tag**. Select **Every tag** to see all tags.
3. Select a year in **Fraternal year**. A fraternal year runs from July 1 to June 30.
4. Type words in **Search** to find a note, a signature or a council name.
5. Select a row to read the full note. Select the row again to close the note.

**Expected result:** The grid shows the matching entries, newest first. Each row shows the date, the fraternal year, the council badge, the tag and the signature.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The grid says **No entry matches these filters.** | No entry has all the selected filters. | Select **Every tag** or **Every year**, or clear **Search**. |
| Entries from other councils show. | The archive shows every council. | Select **Filter by My Home Council Only**. |
| Your council's entries do not show. | The search words or filters exclude them. | Clear **Search**, and select **Every tag** and **Every year**. |
| You cannot add an entry here. | This page is read-only. | Write entries in the **Operations Knowledge Archive** drawer of the **Grand Knight Desk** (section 17.2 of the Executive Governance Manual). |

---

## 9. Revenue split profiles

### 9.1 Concept: revenue split profiles
Some fundraisers use parish property, for example the cathedral parking lot. The council then shares part of the money with the parish. Since Sprint 10 Revision 3.2 every revenue split comes from the chart of accounts. The parish split engine, its **Parish Fundraiser Revenue Split Console** and its **Church Disbursement Requests** are gone.

| Way to split | Where | What it does |
| --- | --- | --- |
| Split profile | **Treasurer Desk** → **Chart of Accounts & GL Setup** → **Edit split** on a Revenue account | Every posting to the account is shared out to its destination accounts by percentage, on every screen that posts. |
| Event Split Override | **Treasurer Desk** → **High-Volume Batch Transaction Coder** → **⚖️ Override Event Split** | One posting of one event's gifts is shared out by the shares you choose. Nothing is saved to the account. |

The destinations of a split are other Revenue accounts of the council. The shares total exactly 100. The last destination takes any rounding cent. The St. Mary's pilot data has the revenue line **Parish Fundraiser Share** for the parish's part.

### 9.2 Share fundraiser revenue with a split profile
> **Who can do this:** the council's Treasurer and Super Admins.

**Goal:** Share each posting to a Revenue account, for example the parish's share of a fundraiser, by percentages.

**Start point:** **Active Desks** row → **Treasurer Desk** → **Chart of Accounts & GL Setup** → **Edit split** on the Revenue account.

**Steps:**
1. Select **Edit split** on the Revenue account that receives the fundraiser's money.
2. Add a destination account and its percentage for each share, for example **Parish Fundraiser Share** at `50`.
3. Make the percentages total exactly 100.
4. Save the split.

**Expected result:** The account shows as a split account. Every posting to it is shared out to the destination accounts.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| **Edit split** is missing on an account. | Only Revenue accounts can split. | Choose a Revenue account. |
| You want to split one event's gifts only once. | A split profile applies to every posting. | Use **⚖️ Override Event Split** in the batch coder (9.3). |

### 9.3 Share one event's gifts once in the batch coder
> **Who can do this:** the council's Treasurer and Super Admins.

**Goal:** Code one event's electronic gifts and share that one posting, without saving a split on the account.

**Start point:** **Active Desks** row → **Treasurer Desk** → **High-Volume Batch Transaction Coder**.

**Steps:**
1. Tick the gifts of one event.
2. Choose the line in **Revenue GL line for the selection**, for example **Parking Fundraising**.
3. Select **⚖️ Override Event Split**.
4. Set each **Destination** and its **Share (%)**, for example **Parking Fundraising** at `50` and **Parish Fundraiser Share** at `50`. Select **Add destination** for another share.
5. Select **Code selected to this Revenue line**.

**Expected result:** The message names each share, for example *"Event Split Override: $75.00 to Parking Fundraising, $75.00 to Parish Fundraiser Share."*

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| **⚖️ Override Event Split** is unavailable. | The ticked gifts belong to more than one event, or no Revenue line is chosen. | Tick one event's gifts and choose the line. |

---

## 10. Batch coding and cash box audits

### 10.1 Concept: the event collection lifecycle
Each event's donations form one collection. The collection moves through three states:

| State | Set by | What it means |
| --- | --- | --- |
| **Session open** | Default | Phones can log donations for the event. Members can change their donations. |
| **Concluded** | A member on the phone, or the Treasurer's audit | The logs are locked. No phone can add, change or delete a donation for the event. The gate intake closes. |
| **Reconciled** | The Treasurer | The Treasurer counted the cash box and closed the audit. Nothing can change the collection after this. |

A member concludes the collection with **[ 🛑 Conclude Event Session & Lock Logs ]** on the phone. The Treasurer's audit concludes a collection that no phone concluded. Standalone donations are not part of any collection. Members can always log standalone donations.

### 10.2 Concept: batch coding of electronic donations
Card and QR-code donations (Venmo, Zelle, Zeffy and ParishSoft) arrive one by one. The Treasurer codes these donations to the general ledger in groups.

The **🧮 High-Volume Batch Transaction Coder** on the **Treasurer Desk** lists every electronic donation that has no ledger line yet. The Treasurer selects donations and picks one Revenue line. One action codes the whole selection.

Each batch posts one transaction to the general ledger:

| Line | Account | Amount |
| --- | --- | --- |
| Debit | The council's first cash account, for example **Operating Checking** | The total of the selected donations |
| Credit | The Revenue line that the Treasurer picked | The same total |

Each donation in the batch keeps the Revenue line and the batch number. Nobody can change or delete a coded donation.

Cash, check and physical-item donations do not show in the coder. The pilot data codes the rally, picnic and pancake breakfast donations already, because the ledger holds their deposits.

### 10.3 Concept: the cash box audit and the Over/Short Reconciliation Line
The phones log each cash donation. At the end of the event, the Treasurer counts the paper currency in the cash box. The count can differ from the logs.

The **💵 Cash Box Audit Closure Panel** on the **Treasurer Desk** compares the count with the logs. The difference is the variance:

- **Over $…**: the cash box holds more than the logs.
- **Short $…**: the cash box holds less than the logs.
- **Balanced**: the count matches the logs to the cent.

When the variance is not zero, the platform posts an **Over/Short Reconciliation Line** to the general ledger. The posting uses the **Cash Over/Short** ledger line. The platform adds the **Cash Over/Short** line to the chart of accounts the first time a council needs it.

| Variance | Debit | Credit |
| --- | --- | --- |
| Over | Cash account | **Cash Over/Short** |
| Short | **Cash Over/Short** | Cash account |

The phone logs never change. The adjustment lives only in the general ledger. The event row keeps the counted amount, the reason for the difference and the name of the Treasurer.

Four figures show at the top of the panel: **Events awaiting the count**, **Logged cash to verify**, **Concluded on a phone** and **Net over / short**.

### 10.4 Conclude an event session on the phone
> **Who can do this:** any active member of a council that the event belongs to.
> **Warning:** Concluding locks the donation logs for every phone. You cannot open the session again.

**Goal:** Close the event's donation intake at the end of the event.

**Start point:** Phone → **Collect** tab → the **ACCEPTING DONATIONS** card.

**Steps:**
1. Record the last donation, for example the cash box drop.
2. Tap **[ 🛑 Conclude Event Session & Lock Logs ]**.
3. Read the warning.
4. Put your thumb on the gold circle at the left of **Slide to Conclude & Lock**.
5. Drag the circle to the right end of the bar. Then let go. You cannot undo this.

**Expected result:** The message **… is concluded and its logs are locked. The Treasurer can now count the cash box.** shows. The phone leaves the session. The event is no longer in the **EVENT** list of **Start accepting donations**.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| You tapped the button by mistake. | The warning card is open. | Tap **Cancel**. |
| The circle springs back. Nothing happens. | You let go before the right end of the bar. | Drag the circle all the way to the right end. |
| A donation is refused with "collection session is concluded". | Another phone concluded the session. | Record the gift as a standalone donation and tell the Treasurer. |

### 10.5 Code electronic donations in a batch
> **Who can do this:** the council's Treasurer and Super Admins. Other officers and Admins read the coder.
> **Warning:** Coding posts money to the general ledger. You cannot undo the coding.

**Goal:** Code many electronic donations to one Revenue line in one action.

**Start point:** **Active Desks** row → **Treasurer Desk** → **🧮 High-Volume Batch Transaction Coder**.

**Steps:**
1. Read the un-coded total.
2. Select **[✓ Select All Un-coded Transactions]**, or select the checkbox on each donation.
3. Select the line in **Revenue GL line for the selection**.
4. Check the count and the total on the button.
5. Select **Code selected to this Revenue line**. You cannot undo this.

**Expected result:** The message **Coded … donations ($…) to … as one posting.** shows. The coded donations leave the grid.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The button is unavailable. | No donation is selected, or no Revenue line is chosen. | Select donations and a line. |
| A cash donation is not in the grid. | The coder lists only card and QR-code donations. | Count cash on the **💵 Cash Box Audit Closure Panel** (10.6). |
| The refusal says the donation is coded. | Another batch coded the donation already. | Reload the desk. |

### 10.6 Close a cash box audit
> **Who can do this:** the council's Treasurer and Super Admins. Other officers and Admins read the panel.
> **Warning:** Closing the audit posts any difference to the general ledger and locks the event's logs. You cannot undo the closure.

**Goal:** Record the counted cash for an event and balance any difference.

**Start point:** **Active Desks** row → **Treasurer Desk** → **💵 Cash Box Audit Closure Panel**.

**Steps:**
1. Count the paper currency from the event's cash box.
2. Find the event row. Read **Logged cash**.
3. Enter the count in **Counted cash**.
4. Read **Variance**.
5. If the variance is not **Balanced**, enter the reason in **Reason for a difference**.
6. Select **Close cash audit & lock**. You cannot undo this.

**Expected result:** The message **… is reconciled** shows. The event moves to **Closed cash box audits** with the count, the variance and your name. **Net over / short** includes the new variance.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| **Close cash audit & lock** is unavailable. | The count is empty, or the variance needs a reason. | Enter the count and the reason. |
| An event is not on the panel. | The event has no cash donations. | No count is needed. |
| The session still shows **Session open**. | No phone concluded the session. | Close the audit. The closure concludes the session. |

---

## 11. Account ownership and parish-held revenue

### 11.1 Concept: who owns a payment account
Each payment method that a council turns on pays into one account. A card reader, a Venmo page, a Zelle profile and a parish giving portal are examples.
The **Account owner** column on **Enabled donation methods** records who owns that account.

| Account owner | Meaning |
| --- | --- |
| **Council account** | The money lands in the council's own account. The council's books record the money as revenue. |
| **Parish account** | The money lands in the parish's account. The parish already holds the money. |
| **Third-party account** | The money lands in the account of a vendor or a partner charity. |

The portal does not guess the owner. A new payment method starts with no owner. The editor does not save until you choose one.
Methods that were set up before Sprint 8O read as **Council account**.

Each donation keeps the owner that its payment method had at the moment the donation was recorded.
A later change to the owner does not change past donations. The change applies only to donations recorded after the change.
Past parish splits and batch coding therefore stay the same when you correct a payment method.
An edit that moves a donation to a different payment method takes that method's owner at the moment of the edit.

### 11.2 Set the account owner of a payment method
> **Who can do this:** council Admins, the council's Financial Secretary and Treasurer, and Super Admins.

**Goal:** Record who owns the account that each payment method pays into.

**Start point:** Sidebar → System Settings → **Council Lookups** → **Enabled donation methods**.

**Steps:**
1. Find the payment method. To add a method, select **Add donation method**.
2. In **Account owner**, select **Council account**, **Parish account** or **Third-party account**.
3. Select **Save changes**.

**Expected result:** The message **Saved … donation method rows.** shows. The owner shows on the row.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| **Save changes** is unavailable and a red message says *"Choose who owns the account each payment method pays into (Council, Parish or Third party) before you save."* | A changed row shows **Choose…** in **Account owner**. | Choose the owner on each row with a red border. |
| A parish gift shows in the batch coder. | The parish's giving method was set to **Council account** when the gift was recorded. | Set the method to **Parish account** before the next event. Past donations keep their recorded owner. |
| You changed the owner, but past events did not change. | Each donation keeps the owner it was recorded under. | No fix is needed. Only new donations use the new owner. |

---

## 12. Split accounts, budget categories and payment account names

### 12.1 Concept: the split account
A split account is a Revenue line that shares each posting with other Revenue lines. Only Revenue lines can be split accounts. Asset, Liability, Equity and Expense lines cannot.

The split profile names the destination accounts and the share of each one. The shares add up to exactly 100%.

| Rule | Detail |
| --- | --- |
| Destination type | Each destination is another Revenue line. |
| Destinations not allowed | The split account itself, another split account and a virtual goal. |
| Number of destinations | 1 to 10. |
| Rounding | Each share is rounded to the cent. The last destination takes the leftover cent. |

Every posting to a split account goes to its destinations at once. The split applies to all ways of posting:

- a batch of donations on the **🧮 High-Volume Batch Transaction Coder**;
- revenue logged for a concluded event or activity;
- a manual double-entry transaction;
- any other posting to the general ledger.

For example, a $810.00 posting on a 40% / 60% split credits $324.00 and $486.00. The split account itself takes no posting. Coded donations still show the split account as their coded line.

A change to the profile applies to the next batch only. Postings made before the change stay as they are.

### 12.2 Set up a split account
> **Who can do this:** the council's Treasurer and Super Admins. Other officers and Admins see the profiles.

**Goal:** Make a ledger line share its postings with other lines.

**Start point:** **Active Desks** row → **Treasurer Desk** → **[ 🔧 Accounting Configuration ]** → **Chart of Accounts & GL Setup**.

**Steps:**
1. Find the Revenue account. Select **Edit split** on its row. Only Revenue rows show the button.
2. In **Destination 1**, choose the first account. Enter its share in **Share (%)**.
3. Repeat step 2 for each destination. Select **Add destination** for more rows.
4. Check that **Total** reads **100%**.
5. Select **Save split profile**.

**Expected result:** The account shows the **Split Account** tag. The line **Split: …** under the account name lists each destination and its share.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| *"The shares of … must add up to 100%; …"* | The shares do not total 100. | Correct the shares. |
| *"… must be a Revenue account."* | A destination is not a Revenue line. | Choose a Revenue line. |
| **Edit split** does not show on a row. | The account is not a Revenue line. | Only Revenue lines can split. |
| *"… receives a share of …, so it cannot be a Split Account itself."* | The account is a destination of another split account. | Remove the account from the other profile first. |
| **Edit split** does not show. | You are not the Treasurer. | Ask the Treasurer. |

An account is a split account while it has destinations. The editor has no on/off switch.

To stop a split, select **Edit split**. Select **Remove** on each destination. Select **Save with no split**.

### 12.2.1 Override the split for one event's batch
> **Who can do this:** the council's Treasurer and Super Admins.
> **Warning:** Coding posts money to the general ledger. You cannot undo the coding.

**Goal:** Split one event's batch of donations by different shares, one time only.

**Start point:** **Active Desks** row → **Treasurer Desk** → **🧮 High-Volume Batch Transaction Coder**.

**Steps:**
1. Select the donations of one event only.
2. Select the line in **Revenue GL line for the selection**.
3. Select **⚖️ Override Event Split**. The share table opens with the line's split, if the line has one.
4. Change the destinations and the shares. Check that **Total** reads **100%**.
5. Select **Code selected to this Revenue line**. You cannot undo this.

**Expected result:** The message ends with **Event Split Override: …** and the amount for each destination. The line's own split does not change. The next batch uses the line's split again.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| **⚖️ Override Event Split** is unavailable. | No line is chosen, or the selection holds donations of more than one event or no event. | Select one event's donations and a line. |
| *"An Event Split Override codes the donations of one event at a time: …"* | The selection changed after you opened the override. | Select only that event's donations. |
| *"… is a Split Account, so it cannot receive a share."* | A destination is a split account. | Choose an ordinary Revenue line. |

An override can also split an ordinary Revenue line. The line itself can be one of the destinations.

### 12.3 Concept: the council's budget categories
The council keeps its own list of budget categories, for example **Youth Programs** or **Charities**. Each budget line can be filed under one category. A line without a category shows under **Uncategorized**.

The **📊 Budget Allocation & YOY Variance Analyzer** groups the year by these categories in two charts:

| Chart | What the chart shows |
| --- | --- |
| **Allocation Pie** | Each category's share of the year's budget. Before the vote, the pie uses the proposed figures. After the vote, it uses the approved figures. |
| **Year-to-date spending against each cap** | Each category's spending since July 1 against its approved cap. **✖ Over** marks a category over its cap. |

A table under the charts lists each category with its figures. The first eight categories keep their colors. More categories show together as **Other**.

### 12.4 Keep the budget categories
> **Who can do this:** the council's Financial Secretary (FS), Treasurer and Admins, and Super Admins.
> **Warning:** **Delete** removes the category at once. The portal refuses to delete a category that a budget line still uses.

**Goal:** Add, rename or delete the council's budget categories.

**Start point:** Sidebar → Finances → **Budget** → **Budget categories** panel.

**Steps:**
1. To add a category, enter the name in **New category**. Select **Add category**.
2. To rename a category, change its name. Select **Rename**.
3. To delete a category, select **Delete**. You cannot undo this.
4. In **Annual Budget Center**, choose the category on each line.

**Expected result:** A message confirms the change. The category list and the line pickers show the change.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The panel does not show. | You are not the FS, the Treasurer or an Admin. | Ask the FS or the Treasurer. |
| A category cannot be deleted. | A budget line still uses the category. | Choose another category on those lines first. |
| The charts do not show on the analyzer. | You may not read the budget progress. | Ask the Grand Knight or the Treasurer. |

### 12.5 Name the account behind a payment method
> **Who can do this:** council Admins, the council's Financial Secretary and Treasurer, and Super Admins.

**Goal:** Show donors whose account a QR code pays into.

**Start point:** Sidebar → System Settings → **Council Lookups** → **Enabled donation methods**.

**Steps:**
1. Find the payment method, for example **Venmo**.
2. Check the **Account owner** (11.2).
3. In **Account Name Members See**, enter the account name as the payment app shows it, for example `St. Mary's Cathedral Parish`.
4. Select **Save changes**.

**Expected result:** On the phone, the QR code screen shows *"Pays into St. Mary's Cathedral Parish (Parish account)"* under the heading.

**Common problems:**
| Problem | Cause | Fix |
| --- | --- | --- |
| The phone shows *"Pays into the council's account"* only. | The method has no account name. | Enter the account name (step 3). |
| The phone shows the wrong owner. | The **Account owner** is wrong. | Correct the owner (11.2). |

---

## Manual map

The chapters of the four officer manuals. A shared task is printed in each manual that lists its chapter.

**Administrator User Guide**

- 1. Roles and access
- 2. Module feature flags
- 3. The Google Drive archive vault
- 4. The feedback inbox and SOP publishing
- 5. Lookup tables, service connections and global lists
- 6. Data protection rules
- 7. Troubleshooting reference
- 8. Council Wide Settings and platform settings
- 9. Access requests, impersonation and remote help
- 10. Feedback loops and the Super Admin Desk
- 11. Run a room pilot on the hub laptop
- 12. Reset the database to the seed data
- 13. Network addresses, ports and configuration keys
- 14. Firewall clearance
- 15. The software bill of materials (SBOM)
- Appendix: QR code files

**Executive Governance Manual**

- 1. Left navigation map
- 2. Governance
- 3. Faith In Action
- 4. Finances: release, vetting and endorsement
- 5. Performance
- 6. Resources
- 7. Find members with a trade skill
- 8. Automated messages reference
- 9. Member engagement
- 10. Flagged hours review
- 11. Council Wide Settings
- 12. Asset photos and remote help
- 13. Annual roadmap, meeting check-in and meeting photos
- 14. The Active Desks dashboard
- 15. The Cross-Council Loaner Library and the colour-coded calendar
- 16. Planning workflows and bilateral council affiliations
- 17. The Operations Knowledge Archive
- 18. Parish fundraiser split setup
- 19. The global search bar
- 20. The Navigation Guide screen

**Financial Secretary Manual**

- 1. Finances: the Financial Secretary's work
- 2. Members, setup codes, the Supreme roster sync and Supreme forms
- 3. The roster lifecycle
- 4. Payment methods, checks, asset photos and remote help
- 5. The Three-Signature Expense Flow
- 6. The Active Desks and the Financial Secretary Desk
- 7. The budget review and vote
- 8. The Operations Knowledge Archive
- 9. Revenue split profiles
- 10. Payment account ownership
- 11. Budget categories and payment account names

**Treasurer Manual**

- 1. Double-entry bookkeeping primer
- 2. Finances: the Treasurer's work
- 3. Supreme forms
- 4. Payment methods, checks, revenue, asset photos and remote help
- 5. The Three-Signature Expense Flow
- 6. The Active Desks and the Treasurer Desk
- 7. The budget review and vote
- 8. The Operations Knowledge Archive
- 9. Parish fundraiser splits
- 10. Batch coding and cash box audits
- 11. Account ownership and parish-held revenue
- 12. Split accounts, budget categories and payment account names
