# Fraternal Council Archives™ — Quick-Start Intake Guide

**Audience:** the council Admin who sets up a new council on the platform.

**Covers:** the five steps of the **Council Setup Wizard** on the **Admin Desk**. The full instructions are in the [Administrator User Guide](ADMIN_USER_GUIDE.md), chapter 16.

> **Who can do this:** council Admins and Super Admins. Other members do not see the Admin Desk or the wizard.

---

## Contents

- [1. Start the wizard, the roster, storage and email](#1-start-the-wizard-the-roster-storage-and-email)
- [2. The founding template and the practice sandbox](#2-the-founding-template-and-the-practice-sandbox)
- [3. The Quick-Start Guide and the Admin Desk](#3-the-quick-start-guide-and-the-admin-desk)

---

## 1. Start the wizard, the roster, storage and email

### 1.1 Start the Council Setup Wizard

The wizard covers the **Admin Desk** until you finish it or skip it. The wizard opens by itself when your council has no accounts and no members other than you.

**Start point:** Sidebar → System Settings → **Admin Desk**.

**Steps:**
1. If the wizard is not open, select **Run Setup Wizard** at the top of the Admin Desk.
2. Read the step title and the sentence below it.
3. Select **Next** to go to the next step. Select **Back** to go to the step before.
4. To close the wizard now, select **Skip for now**. You can open it again at any time.

**Expected result:** The wizard shows **Step 1 of 5**.

Each step has a **?** mark next to its hard fields. Select the **?** mark to read what the field does.

### 1.2 Step 1: Supreme CSV Roster Ingestion

**Goal:** Add the council's members from the Supreme roster export.

**Steps:**
1. Get the roster export from Supreme. Save it as CSV. Keep its **First Degree Date** column.
2. Drop the file on the upload area, or select the area and choose the file.
3. Make sure that the row count is correct.
4. Select **Sync**.

**Expected result:** The wizard shows how many members were added, changed or skipped. Each new member gets a welcome email with a one-time setup code.

| Problem | Cause | Fix |
| --- | --- | --- |
| A row is skipped. | The email already belongs to another member. | Correct the email in the file. Sync again. |
| You do not have the file yet. | The export is not ready. | Select **Next**. Import the roster later on the **Financial Secretary Desk**. |

### 1.3 Step 2: File Storage and Email Gateway

**Goal:** Choose where council files are kept, and connect the mail server the portal sends from.

**Steps:**
1. In **File Repository**, choose the storage provider. Fill in the folder fields. Select **Save**.
2. In **Outbound Email**, choose the email provider.
3. Type the server, the username and the password.
4. Select **Save**.

**Expected result:** The password goes to the **Secure Access Vault**. The vault seals it and keeps it for your home council only. The page never shows the password again.

> **Note:** The wizard saves keys only for your own home council. A Super Admin of another council cannot read them. Council mail goes from this server; platform notices come from `tim@fairmissionsoftware.com`.

---

## 2. The founding template and the practice sandbox

### 2.1 Step 3: Clone Founding Template

**Goal:** Copy the setup of Founding Council 15295 in one click.

**Steps:**
1. Select **⚡ Clone Founding Template**.
2. Wait for the message.

**Expected result:** The message shows how many items were copied:

| Copied | From Council 15295 |
| --- | --- |
| Accounts | The chart of accounts, with the parent of each account |
| Activities | The activity list, each **Active** or **Inactive** |
| Donation types | The donation type list |
| Payment methods | The enabled payment methods and their linked accounts |
| Settings | The **Council Wide Settings** limits |

The clone keeps every item your council already has with the same name. You can select the button again; it copies only what is missing. Contacts, QR images, savings goal accounts and sister-council accounts are not copied.

### 2.2 Step 4: Practice Sandbox

**Goal:** Try every desk with practice data before real members use the portal.

**Steps:**
1. Select **Activate Safe Practice Sandbox**.

**Expected result:** The platform adds 10 practice members and 3 practice fundraisers. Each fundraiser has one shift with 3 practice volunteers. Practice members get no email. Practice fundraisers start with **[Practice]**.

To remove the practice data, go to the top of the **Admin Desk**. Turn off the **Practice Sandbox** switch.

| Problem | Cause | Fix |
| --- | --- | --- |
| The switch says a donation is recorded. | Someone recorded a donation on a practice fundraiser. | Remove the donation. Turn off the switch again. |

---

## 3. The Quick-Start Guide and the Admin Desk

### 3.1 Step 5: Download the guide and open the desk

**Goal:** Keep this guide, then start work on the Admin Desk.

**Steps:**
1. Select **Download the Quick-Start Intake Guide**.
2. Select **Open the Admin Desk**.

**Expected result:** The wizard closes. The Admin Desk shows the top deck and the six drawers. The wizard does not open by itself again in this browser.

> **Note:** while **Financial Inspections** is off, the inspection drawers do not show on the **Financial Secretary Desk** and the **Treasurer Desk**. The drawers that pay checks stay.
