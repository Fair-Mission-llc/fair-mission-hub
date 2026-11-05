// The training playground's generic accounts (Sprint 11 Revision 20.0, data-modes.ts TRAINING_PROFILES). SERVER ONLY.
//
// Writes the seven training profiles straight into a freshly built training-playground.db: one Credentials row each
// (password TRAINING_PASSWORD, stored as the usual SHA-256 hex) and one Member row in the playground council, Active.
// admin@training is a council Admin. Each officer profile takes its seat: the seat's earlier holders in the playground
// council give it up first, so every seat still has one holder. The file is a throwaway copy, rebuilt on every start,
// so nothing real is touched.
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { TRAINING_PASSWORD, TRAINING_PLAYGROUND_COUNCIL_ID, TRAINING_PROFILE_MEMBER_NUMBER_BASE, TRAINING_PROFILES } from '@kofc/shared';

const sha256Hex = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

type Row = Record<string, unknown>;

/** Adds the training profiles to the database at `path`. Returns how many accounts were added. */
export function seedTrainingProfiles(path: string, councilId: number = TRAINING_PLAYGROUND_COUNCIL_ID): number {
  const db = new DatabaseSync(path);
  try {
    const one = (sql: string, ...params: (string | number)[]) => db.prepare(sql).get(...params) as Row | undefined;
    const idOf = (sql: string, ...params: (string | number)[]) => {
      const row = one(sql, ...params);
      if (!row) throw new Error(`The training seed is missing a lookup row (${sql}).`);
      return Number(row.id);
    };
    const active = idOf("SELECT [id] FROM [MemberStatus] WHERE [Status] = 'Active'");
    const degree = idOf('SELECT [id] FROM [Degree] ORDER BY [id] LIMIT 1');
    const council = one('SELECT [State] FROM [Council] WHERE [id] = ?', councilId);
    const state = typeof council?.State === 'string' && council.State ? council.State : 'OR';
    const hash = sha256Hex(TRAINING_PASSWORD);
    let added = 0;
    db.exec('BEGIN');
    try {
      for (const [i, p] of TRAINING_PROFILES.entries()) {
        if (one('SELECT [id] FROM [Credentials] WHERE LOWER([Username]) = ?', p.username)) continue;
        const type = idOf('SELECT [id] FROM [MemberType] WHERE [Type] = ?', p.memberType);
        const cred = Number(db.prepare('INSERT INTO [Credentials] ([Username], [Password]) VALUES (?, ?)').run(p.username, hash).lastInsertRowid);
        const member = Number(
          db
            .prepare(
              `INSERT INTO [Member] ([CouncilID], [MemberNumber], [MemberFirstName], [MemberLastName], [Phone], [StreetAddress1], [City], [State],
                 [ZipCode], [Email], [DateOfBirth], [StatusID], [DegreeID], [MemberTypeID], [CredentialID])
               VALUES (?, ?, ?, ?, ?, ?, 'Training', ?, '00000', ?, '1980-01-01', ?, ?, ?, ?)`,
            )
            .run(councilId, TRAINING_PROFILE_MEMBER_NUMBER_BASE + i + 1, p.firstName, p.lastName, `555-020${i}`, `${10 + i} Training Way`, state, p.username, active, degree, type, cred)
            .lastInsertRowid,
        );
        if (p.role) {
          const role = idOf('SELECT [id] FROM [Role] WHERE [Role] = ?', p.role);
          db.prepare('DELETE FROM [MemberRoles] WHERE [RoleID] = ? AND [MemberID] IN (SELECT [id] FROM [Member] WHERE [CouncilID] = ?)').run(role, councilId);
          db.prepare('INSERT INTO [MemberRoles] ([RoleID], [MemberID]) VALUES (?, ?)').run(role, member);
        }
        added += 1;
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    return added;
  } finally {
    db.close();
  }
}
