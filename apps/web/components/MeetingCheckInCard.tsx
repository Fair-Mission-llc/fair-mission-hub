'use client';
// Sprint 10 Revision 4.0: the card left Council Wide Settings. It is the Recorder Desk's 'Meeting Check-In PIN' drawer and,
// for a night the Recorder is absent, the Grand Knight Desk's drawer (the GK, the DGK and the council's Admins open that
// desk). The Recorder may set the PIN now, and 'Generate new PIN' makes and saves a random one in one click.
// Meeting Check-In (Sprint 7G): the card on Council Wide Settings where the Grand Knight, the council's Admins and Super
// Admins set where the council meets, how close a phone must be to check in by GPS, and the 4-digit meeting PIN for
// members outside the circle (councils.getMeetingGeofence / setMeetingGeofence, geofence.ts). Other readers of the page
// do not see the card: the PIN is never sent to them.
// Sprint 9 Revision 5.0: while GPS_UI_SUPPRESSED is on, the card shows only the PIN. The meeting point and radius are
// hidden but still sent back unchanged on save, so nothing stored is lost.
import { useState, type FormEvent } from 'react';
import {
  DEFAULT_MEETING_PIN_TOKEN,
  describeError,
  GPS_UI_SUPPRESSED,
  hasMeetingPoint,
  holdsGrandKnightSeat,
  MEETING_GEOFENCE_MAX_RADIUS_METERS,
  MEETING_GEOFENCE_MIN_RADIUS_METERS,
  type MeetingGeofence,
  type MeetingGeofenceChanges,
  type SessionUser,
  generateMeetingPin,
  MEETING_PIN_KEEPER_ROLE,
} from '@kofc/shared';
import { Button, Field, Input, Notice } from '@/components/ui';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/**
 * The council's Recorder (Sprint 10 Revision 4.0), Grand Knight, Deputy Grand Knight (Sprint 8C) or Admins, or a Super
 * Admin (mayManageMeetingGeofence on the session).
 */
export const mayManageMeetingCheckIn = (user: SessionUser, councilId: number) =>
  user.memberType === 'Super Admin' ||
  (user.councilId === councilId && (user.memberType === 'Admin' || holdsGrandKnightSeat(user) || (user.roles ?? []).includes(MEETING_PIN_KEEPER_ROLE)));

function CheckInForm({ user, councilId, fence, onSaved }: { user: SessionUser; councilId: number; fence: MeetingGeofence; onSaved: () => Promise<void> }) {
  const [latitude, setLatitude] = useState(fence.latitude === null ? '' : String(fence.latitude));
  const [longitude, setLongitude] = useState(fence.longitude === null ? '' : String(fence.longitude));
  const [radius, setRadius] = useState(String(fence.radiusMeters));
  const [pin, setPin] = useState(fence.pinToken);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const submit = async (e: FormEvent | null, pinOverride?: string) => {
    e?.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const point = latitude.trim() === '' && longitude.trim() === '' ? { latitude: null, longitude: null } : { latitude: Number(latitude), longitude: Number(longitude) };
      const changes: MeetingGeofenceChanges = { ...point, radiusMeters: Number(radius), pinToken: (pinOverride ?? pin).trim() };
      const saved = await db.councils.setMeetingGeofence(user.memberId, councilId, changes);
      await onSaved();
      setMessage({
        tone: 'info',
        text: pinOverride
          ? `New meeting PIN ${pinOverride} saved. Read it out at the meeting; members type it on the phone to check in.`
          : GPS_UI_SUPPRESSED
          ? 'Saved. Members check in with this PIN.'
          : hasMeetingPoint(saved)
          ? `Saved. Phones within ${saved.radiusMeters} m of the meeting point can check in by GPS; others use the PIN.`
          : 'Saved. No meeting point is set, so members check in with the PIN only.',
      });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GPS_UI_SUPPRESSED ? null : (
          <>
            <Field label="Meeting point latitude" hint="Decimal degrees, e.g. 47.606200. Leave both blank to switch GPS check-in off.">
              {(id) => <Input id={id} inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} />}
            </Field>
            <Field label="Meeting point longitude" hint="Decimal degrees, e.g. -122.332100.">
              {(id) => <Input id={id} inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} />}
            </Field>
            <Field label="Check-in radius (meters)" hint={`From ${MEETING_GEOFENCE_MIN_RADIUS_METERS} to ${MEETING_GEOFENCE_MAX_RADIUS_METERS.toLocaleString('en-US')}. The phone's location must also be this precise.`}>
              {(id) => <Input id={id} inputMode="numeric" value={radius} onChange={(e) => setRadius(e.target.value)} />}
            </Field>
          </>
        )}
        <Field label="Meeting PIN" hint={GPS_UI_SUPPRESSED ? '4 digits. Read it out at the meeting; members type it on the phone to check in.' : '4 digits. Read it out at the meeting for members outside the circle.'}>
          {(id) => <Input id={id} inputMode="numeric" maxLength={4} autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} />}
        </Field>
      </div>
      {pin === DEFAULT_MEETING_PIN_TOKEN ? (
        <Notice tone="error">The PIN is still the default 0000, which any member can guess. Choose a new PIN before the next meeting.</Notice>
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <div className="flex flex-wrap gap-3">
        {/* Sprint 10 Revision 4.0: one click makes and saves a fresh random PIN, never 0000. */}
        <Button
          variant="gold"
          disabled={busy}
          onClick={() => {
            const next = generateMeetingPin(() => globalThis.crypto.getRandomValues(new Uint32Array(1))[0]! % 10_000);
            setPin(next);
            void submit(null, next);
          }}
        >
          🔢 Generate new PIN
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save meeting check-in'}
        </Button>
      </div>
    </form>
  );
}

/** The Meeting Check-In card, or nothing for a reader who may not see the PIN. */
export function MeetingCheckInCard({ user, councilId }: { user: SessionUser; councilId: number }) {
  const allowed = mayManageMeetingCheckIn(user, councilId);
  const fence = useLoad(async () => (allowed ? db.councils.getMeetingGeofence(user.memberId, councilId) : null), [allowed, user.memberId, councilId]);
  if (!allowed) return null;
  return (
    <section aria-labelledby="meeting-check-in" className="mt-5 rounded border-2 border-navy bg-white text-black">
      <header className="border-b-2 border-navy bg-navy px-4 py-2 text-white" data-surface="navy">
        <h2 id="meeting-check-in" className="font-serif text-xl font-bold">
          {GPS_UI_SUPPRESSED ? '🔢' : '📍'} Meeting Check-In
        </h2>
        <p className="text-sm">
          {GPS_UI_SUPPRESSED ? 'The 4-digit PIN members type on the phone to check in to a meeting.' : 'Where members check in by GPS from the phone, and the PIN for members outside the circle.'}
        </p>
      </header>
      <div className="p-4 sm:p-5">
        {fence.error ? <Notice tone="error">{fence.error}</Notice> : null}
        {fence.data ? (
          <CheckInForm key={`${councilId}-${JSON.stringify(fence.data)}`} user={user} councilId={councilId} fence={fence.data} onSaved={fence.reload} />
        ) : (
          <p className="text-sm text-muted">Loading the meeting check-in…</p>
        )}
      </div>
    </section>
  );
}
