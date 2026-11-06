# SOP 007: In-Person Cooperative Testing Mesh

## What it is

- **Testing mode:** a practice copy of the records (`testing-sandbox.db`). Real records never mix with the practice copy.
- **Mesh:** laptops on the same hall Wi-Fi share the practice copy. Each save goes to the other laptops, encrypted.
- **Passphrase:** every laptop in the mesh uses the same mesh passphrase. The first start writes `.testing-key.json` beside the vault.
- **Alone:** with no network, testing mode works on one laptop.
- **Banner:** testing mode draws an amber warning banner on every page.
- **Use:** group pilot scripts and cross-desk practice in one room.

## Start a testing mesh in the hall

> **Who can do this:** the council Admin who runs the pilot session, on each Windows desktop client.
> **Warning:** do not enter real member or money data in testing mode. Every laptop in the room shares the practice copy.

**Goal:** Connect the hall laptops to one shared practice copy.

**Start point:** The Windows desktop client start-up question.

**Steps:**
1. Connect every laptop to the same hall Wi-Fi.
2. Start the desktop client on the first laptop. Select **Testing (hall Wi-Fi)**.
3. Copy the `.testing-key.json` file from beside the vault of the first laptop to a USB drive.
4. Put the file beside the vault on each other laptop.
5. Start the desktop client on each other laptop. Select **Testing (hall Wi-Fi)**.
6. Save one practice record on one laptop. Check that the record shows on another laptop.

**Expected result:** Every laptop shows the amber testing banner. A save on one laptop shows on the others.

**Common problems:**

| Problem | Cause | Fix |
| --- | --- | --- |
| A save does not show on another laptop. | The laptops use different passphrases. | Copy the same `.testing-key.json` to every laptop and restart. |
| A save does not show on another laptop. | A laptop is on a different network. | Connect every laptop to the same hall Wi-Fi. |
| The start-up question does not show. | The data mode is preset on the laptop. | Ask the Admin who installed the client to clear the preset. |
