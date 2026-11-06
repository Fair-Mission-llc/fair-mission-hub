# SOP 008: Ephemeral Volunteer Training Simulator

## What it is

- **Training mode:** a throwaway copy of the records (`training-playground.db`). The desktop client builds the copy again at every start.
- **Practice universe:** ten practice members, three upcoming fundraisers with volunteers, and one cash box for each fundraiser.
- **Training Profile Selection Board:** one-click sign-in buttons on the sign-in screen, one for each council desk.
- **Profiles:** `admin@training` (Council Admin), `gk@training` (Grand Knight), `fs@training` (Financial Secretary), `tr@training` (Treasurer), `rec@training` (Recorder), `hist@training` (Council Historian), `mem@training` (Member).
- **Password:** every profile uses the password `training`.
- **No Super Admin:** the board lists council desks only. No Super Admin profile exists in training mode.
- **Banner:** training mode draws a cobalt blue notice banner on every page.

## Run a volunteer training session

> **Who can do this:** any volunteer at a Windows desktop client that a council Admin set up.
> **Warning:** the next start deletes everything entered in training mode. Do not enter real records.

**Goal:** Practice the work of a desk on safe, throwaway records.

**Start point:** The Windows desktop client start-up question.

**Steps:**
1. Start the desktop client. Select **Training (practice)**.
2. Find the **Training Profile Selection Board** under the sign-in form.
3. Select the button of the desk to practice, for example **Treasurer**.
4. Practice the desk tasks on the practice members, fundraisers and cash boxes.
5. Close the client to end the session.

**Expected result:** The portal opens on the chosen desk with the cobalt training banner. The next start shows fresh practice records.

**Common problems:**

| Problem | Cause | Fix |
| --- | --- | --- |
| The board does not show. | The client opened in Production or Testing mode. | Restart the client and select **Training (practice)**. |
| A profile cannot sign in. | The training copy did not build. | Restart the client to build the training copy again. |
| Practice work is gone. | Training mode starts fresh at every start. | Repeat the practice. Training records are not kept. |
