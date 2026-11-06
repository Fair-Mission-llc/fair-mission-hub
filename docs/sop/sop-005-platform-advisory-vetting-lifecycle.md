# SOP 005: Platform Advisory Vetting Lifecycle

## What it is

- **Application Advisory Panel:** panelists from every council and the Super Admins.
- **Idea:** any panelist posts one. Every panelist reads the idea and comments in threads. An Idea takes no priority rating and has no rank.
- **Feature:** a Super Admin converts an Idea into a feature. Panelists then rate the feature 1 (low) to 5 (high).
- **Overall Priority Rank:** features only, by average rating, then by number of ratings, then by soonest target date.
- **One way:** a feature never goes back to an Idea.
- **Release Registry:** Super Admins schedule release blocks: **Release Name**, **Target Version**, **Scheduled Date**.
- **Execute release:** the server builds the change list from the code commits since the last release and the features marked Released.
- **What's New:** Home shows the newest release to every member for 30 days, until the member selects **Got it**.
- **Platform Calendar:** a month grid of releases, panel meetings with agendas, and pilot milestones. Selecting a day opens its details.

## Vet an idea into a ranked feature

> **Who can do this:** any panelist posts and discusses ideas. Only a Super Admin converts an idea. Members who are not panelists do not see the panel.

**Goal:** Move an idea from discussion to a rated, ranked feature.

**Start point:** Sidebar → Application Advisory Panel → Future Feature List

**Steps:**
1. Select **Submit idea**. Enter the idea and why the idea matters.
2. Select **Submit idea**. The idea shows under **Ideas - open for discussion**.
3. Panelists select **Comments**, then post a comment or select **Reply** under a comment.
4. A Super Admin selects **Convert to feature** on the idea.
5. Panelists select a score from 1 to 5 beside **Your rating**.

**Expected result:** The entry moves to **Features - Overall Priority Rank** and shows its rank number.

**Common problems:**

| Problem | Cause | Fix |
| --- | --- | --- |
| The rating buttons do not show. | The entry is still an Idea. | Ask a Super Admin to select **Convert to feature**. |
| **Convert to feature** does not show. | You are not a Super Admin. | Comment on the idea. A Super Admin converts the idea. |
| The status list has no Idea choice. | A feature cannot go back to an Idea. | Keep the feature, or delete the feature and post a new idea. |

## Execute a release

> **Who can do this:** a Super Admin. Panelists read the Release Registry.
> **Warning:** a released block cannot change or be deleted.

**Goal:** Release a version and publish its change list on the Home page of every member.

**Start point:** Sidebar → Application Advisory Panel → Release Registry

**Steps:**
1. Select **Add release**.
2. Enter the **Release Name**, the **Target Version** (for example `11.22.0`) and the **Scheduled Date**.
3. Select **Save release**.
4. On the release date, select **Execute release**. You cannot undo this.
5. Select **Change list** to read the result.

**Expected result:** The block shows **Released**. Every member sees the **What's New** notice on Home.

**Common problems:**

| Problem | Cause | Fix |
| --- | --- | --- |
| Execution fails with a version message. | The target version is not higher than the last released version. | Select **Edit** and raise the **Target Version**. |
| The change list is short. | Few commits or released features since the last release. | Mark shipped features **Released** before you execute. |
| A member does not see **What's New**. | The member selected **Got it**, or 30 days have passed. | Tell the member to open the Release Registry. |
