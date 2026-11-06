# SOP 003: Joint-Event Revenue Splitting

## What it is

- **Split Account:** a Revenue line of the chart of accounts. It holds no balance.
- **Destinations:** up to 10 rows. Each row is an internal ledger account or an affiliated sister council.
- **Shares:** percentages. The shares total exactly 100.00.
- **Effect:** every posting to the Split Account becomes one line per destination. The Split Account stays at zero.
- **Sister share:** posts to the council's own **Due to Sister Council** account. Nothing is written to the books of the other council.
- **One-time override:** the batch coder's **Override Event Split** replaces the shares for one posting only.
- **Use:** a fish fry, drive or festival run with a parish, an Assembly or a sister council.

## Set up a revenue split

> **Who can do this:** the Treasurer of the council or a Super Admin. Other members do not see the **Split Revenue** toggle.
> **Warning:** the split applies to every later posting to the account. Earlier postings do not change.

**Goal:** Divide the revenue of a joint event between the council and its partners.

**Start point:** Sidebar → Finances → General Ledger

**Steps:**
1. Select **Add Account**, or select the Revenue account of the event.
2. Turn on **Split Revenue**.
3. For each destination row, choose **Internal Ledger Account** or **Affiliated Sister Council**.
4. Choose the account or the sister council.
5. Enter the share in percent.
6. Select **Add destination** for each other partner.
7. Check that the running total shows 100%.
8. Select **Save account**.

**Expected result:** The account shows the **Split Account** label. The next posting to the account shows one line per destination.

**Common problems:**

| Problem | Cause | Fix |
| --- | --- | --- |
| The **Split Revenue** toggle does not show. | The account is not a Revenue account, or you do not hold the Treasurer seat. | Choose a Revenue account, or ask the Treasurer. |
| The save fails with a total message. | The shares do not total 100.00. | Change the shares until the total shows 100%. |
| A sister council is not in the list. | The affiliation is not Active. | Ask a council Admin to make the affiliation Active. |
| The split must stop. | The event is over. | Turn off **Split Revenue** and select **Save account**. |
