# SOP 006: Standalone Client Telemetry

## What it is

- **Sign-in record:** every password sign-in records the client release version and the device platform.
- **Clients:** the Windows desktop client, a web browser and the phone app.
- **Log:** the server keeps the last 500 sign-ins and the latest sign-in of each member.
- **Upgrade notice:** a client older than the baseline release gets the **Upgrade recommended** card at sign-in.
- **Actions:** a browser selects **Reload now**. A desktop or phone client follows the update text, then selects **Dismiss**.
- **No personal content:** the record holds the member, council, version, platform and time only.

## Answer an upgrade notice

> **Who can do this:** every signed-in member who sees the card. Super Admins read the full sign-in log.

**Goal:** Bring an old client up to the current release.

**Start point:** The **Upgrade recommended** card at the top of the portal, after sign-in.

**Steps:**
1. Read the card. The card names your client version and the baseline release.
2. On a web browser, select **Reload now**.
3. On the Windows desktop client, install the new client from your council Admin.
4. On a phone, update the app, then sign in again.
5. Select **Dismiss** to close the card.

**Expected result:** The next sign-in shows no **Upgrade recommended** card.

**Common problems:**

| Problem | Cause | Fix |
| --- | --- | --- |
| The card shows again after **Reload now**. | The browser kept the old page. | Close every portal tab, then open the portal again. |
| The desktop client shows the card every time. | The installed client is older than the baseline. | Ask the council Admin for the current installer. |
| No card shows on an old client. | The client did not send its version. | Update the client anyway. The card needs a version to compare. |
