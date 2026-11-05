'use client';
// Sprint 11 Revision 20.0: the Training Profile Selection Board (data-modes.ts TRAINING_PROFILES). Shown under the
// sign-in card only while the server runs in training mode. One button per core seat - the Council Admin, the Grand
// Knight, Financial Secretary, Treasurer, Recorder, Council Historian and a plain member - signs in at once with the
// shared password TRAINING_PASSWORD. The accounts exist only in training-playground.db, which is rebuilt every start.
import { useState } from 'react';
import { TRAINING_PASSWORD, TRAINING_PROFILE_BOARD_TITLE, TRAINING_PROFILES } from '@kofc/shared';
import { useDataMode } from '@/components/DataModeBanner';
import { Notice } from '@/components/ui';

export function TrainingProfileBoard({ signIn }: { signIn: (username: string, password: string) => Promise<boolean> }) {
  const mode = useDataMode();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (mode !== 'training') return null;

  const enter = async (username: string) => {
    setBusy(username);
    setError(null);
    try {
      if (!(await signIn(username, TRAINING_PASSWORD))) setError(`${username} could not sign in. Restart the program to rebuild the training playground.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label={TRAINING_PROFILE_BOARD_TITLE} className="mt-4 flex w-full max-w-sm flex-col gap-3 rounded border-t-8 border-banner-cobalt bg-white p-6">
      <h2 className="font-serif text-lg font-bold">{TRAINING_PROFILE_BOARD_TITLE}</h2>
      <p className="text-sm text-muted">
        Choose a role to practice with. Every training account uses the password <strong>{TRAINING_PASSWORD}</strong>.
      </p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TRAINING_PROFILES.map((p) => (
          <li key={p.username}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void enter(p.username)}
              className="flex w-full flex-col rounded border-2 border-navy px-3 py-2 text-left text-navy hover:bg-gold/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-gold disabled:opacity-60"
            >
              <span className="font-bold">{busy === p.username ? 'Signing in…' : p.label}</span>
              <span className="text-xs text-muted">{p.username}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
