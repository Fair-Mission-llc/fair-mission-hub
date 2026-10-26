'use client';
// Sprint 11 Revision 1.0: the '🗳️ Cast Active Ballot' drawer of the Council Election Center, sized for a phone held in
// the meeting room. It finds the council's meeting in session (Meeting.IsLiveInProgress), and a member not yet checked in
// unlocks it with the meeting's 4-digit PIN the chair reads out (meetings.geofencedCheckIn with a PIN proof: wrong PINs
// count and lock out as on the phone). Once checked in - present in the room - the member casts a secret ballot on each
// motion whose ballot the chair has opened (meetings.castAnonymousMobileVote). The stored row never names the voter, and
// the drivers allow one ballot per member per motion. The drawer polls the meeting every few seconds while it is open, as
// the phones do; it never shows running tallies, so no one votes with the count in view.
import { useEffect, useState } from 'react';
import { BALLOT_SELECTIONS, describeError, toIsoDate, type BallotSelection, type LiveAssemblyState, type Meeting } from '@kofc/shared';
import { Button, Input, Notice } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** The drawer's title. */
export const CAST_ACTIVE_BALLOT_TITLE = '🗳️ Cast Active Ballot';
/** How often the drawer re-reads the meeting, in milliseconds. */
export const ACTIVE_BALLOT_POLL_MS = 4_000;
/** The meeting PIN is exactly four digits. */
export const isMeetingPinShape = (pin: string): boolean => /^\d{4}$/.test(pin);

const SELECTION_STYLE: Record<BallotSelection, 'primary' | 'danger' | 'secondary'> = { Approve: 'primary', Deny: 'danger', Abstain: 'secondary' };

/** How far back the drawer looks for a meeting still marked live, in days. */
export const ACTIVE_BALLOT_LOOKBACK_DAYS = 45;

/** The meeting the council has in session now, if any (a meeting still marked live, from the last ACTIVE_BALLOT_LOOKBACK_DAYS). */
function useMeetingInSession(councilId: number) {
  const fromDate = toIsoDate(new Date(Date.now() - ACTIVE_BALLOT_LOOKBACK_DAYS * 86_400_000));
  return useLoad(
    async (): Promise<Meeting | null> => (await db.meetings.listUpcoming(councilId, { fromDate })).find((m) => m.IsLiveInProgress === 1) ?? null,
    [councilId, fromDate],
  );
}

function PinUnlock({ meetingId, onUnlocked }: { meetingId: number; onUnlocked: () => Promise<void> }) {
  const user = useUser();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlock = async () => {
    setBusy(true);
    setError(null);
    try {
      await db.meetings.geofencedCheckIn(user.memberId, meetingId, { kind: 'pin', pin });
      setPin('');
      await onUnlocked();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (isMeetingPinShape(pin)) void unlock();
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-base font-bold">Enter the meeting PIN</span>
        <span className="text-sm text-muted">The chair reads the 4-digit PIN aloud in the room. It checks you in, so only members present can vote.</span>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{4}"
          maxLength={4}
          value={pin}
          aria-label="Meeting PIN"
          className="max-w-[10rem] text-center text-2xl tracking-[0.5em]"
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
      </label>
      <Button type="submit" disabled={busy || !isMeetingPinShape(pin)} className="min-h-12 text-lg">
        {busy ? 'Checking…' : '🔓 Unlock Ballot'}
      </Button>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </form>
  );
}

function OpenBallots({ councilId, state, onCast }: { councilId: number; state: LiveAssemblyState; onCast: () => Promise<void> }) {
  const user = useUser();
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<{
    tone: 'error' | 'info';
    text: string;
  } | null>(null);
  const open = state.motions.filter((m) => m.ballotOpen);
  const cast = async (motionId: number, selection: BallotSelection) => {
    setBusy(motionId);
    setMessage(null);
    try {
      await db.meetings.castAnonymousMobileVote(user.memberId, councilId, motionId, selection);
      setMessage({
        tone: 'info',
        text: 'Your secret ballot is cast. It is counted without your name.',
      });
      await onCast();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        ✅ You are checked in to <strong>{state.meeting['Meeting Name']}</strong>.
      </p>
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      {open.length === 0 ? (
        <p role="status" className="rounded border-2 border-dashed border-navy px-4 py-6 text-center text-base">
          No ballot is open right now. Keep this drawer open; the ballot appears here when the chair opens it.
        </p>
      ) : (
        open.map(({ motion, viewerHasVoted }) => (
          <article key={motion.id} className="flex flex-col gap-3 rounded border-2 border-navy border-t-8 border-t-gold bg-white p-4">
            <h3 className="font-serif text-lg font-bold">{motion.MotionText}</h3>
            {viewerHasVoted ? (
              <p role="status" className="text-base font-bold text-navy">
                🔒 Your ballot on this motion is recorded.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {BALLOT_SELECTIONS.map((selection) => (
                  <Button
                    key={selection}
                    variant={SELECTION_STYLE[selection]}
                    disabled={busy !== null}
                    className="min-h-14 text-lg"
                    onClick={() => void cast(motion.id, selection)}
                  >
                    {busy === motion.id ? 'Casting…' : selection}
                  </Button>
                ))}
              </div>
            )}
          </article>
        ))
      )}
    </div>
  );
}

/** The drawer body. `active` is false while the drawer is closed, so a closed drawer does not poll. */
export function CastActiveBallot({ councilId, active }: { councilId: number; active: boolean }) {
  const user = useUser();
  const meeting = useMeetingInSession(councilId);
  const meetingId = meeting.data?.id ?? null;
  const [state, setState] = useState<LiveAssemblyState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (meetingId === null) return setState(null);
    try {
      setState(await db.meetings.getLiveAssemblyState(user.memberId, meetingId));
      setError(null);
    } catch (err) {
      setError(describeError(err));
    }
  };

  useEffect(() => {
    if (!active || meetingId === null) return;
    void refresh();
    const timer = setInterval(() => void refresh(), ACTIVE_BALLOT_POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, meetingId, user.memberId]);

  if (meeting.error) return <Notice tone="error">{meeting.error}</Notice>;
  if (meeting.loading && !meeting.data) return <p className="text-sm text-muted">Looking for a meeting in session…</p>;
  if (meetingId === null) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-base">No council meeting is in session. Ballots open here during a live meeting.</p>
        <Button variant="secondary" onClick={() => void meeting.reload()}>
          Check again
        </Button>
      </div>
    );
  }
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!state) return <p className="text-sm text-muted">Opening the meeting…</p>;
  if (!state.isLive) return <p className="text-base">The meeting has closed. Ballots are no longer taken.</p>;
  return state.viewerCheckedIn ? (
    <OpenBallots councilId={councilId} state={state} onCast={refresh} />
  ) : (
    <PinUnlock meetingId={meetingId} onUnlocked={refresh} />
  );
}
