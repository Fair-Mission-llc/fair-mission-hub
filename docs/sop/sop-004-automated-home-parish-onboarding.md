# SOP 004: Automated Home Parish Onboarding

## What it is

- **Home parish:** the one parish the council links to. A council links one parish at a time.
- **Automatic accounts:** linking a parish adds its money accounts to the council's General Ledger in one step.
- **Account Owner:** an Asset account named `Parish - <parish name>`. Gifts paid into the Account Owner belong to the parish, not to the council.
- **Baseline rows:** two Asset accounts under the owner: **Electronic Giving** and **Cash & Check Collections**.
- **No duplicates:** a second link reuses the accounts that exist.
- **Unlink:** keeps every account and its history.

## Link the home parish

> **Who can do this:** a council Admin for the Admin's own council, or a Super Admin for any council.

**Goal:** Link the council to its home parish and add the parish accounts to the General Ledger.

**Start point:** Sidebar → Setup → Parish & Pastors Linkage

**Steps:**
1. Add the parish if the parish is not in the **Parishes** list.
2. Select the parish in the list.
3. Select **Link as home parish**.
4. Read the panel. Check the Account Owner and the two baseline rows.
5. Assign the pastors who serve the parish.

**Expected result:** The parish shows the **Home parish** badge. The General Ledger shows the `Parish - <parish name>` account and its two baseline rows.

**Common problems:**

| Problem | Cause | Fix |
| --- | --- | --- |
| The link fails with a name conflict. | A non-parish account already has the same name. | Rename that account in the General Ledger, then link again. |
| A different parish was the home parish. | A council links one parish at a time. | Select **Unlink home parish** on the old parish first. |
| The parish cannot be deleted. | The parish is the home parish or has pastors assigned. | Unlink the parish and end the pastor assignments first. |
