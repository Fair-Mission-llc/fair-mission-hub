// The Meeting Console's check-in drawer (Sprint 7G), shown on the agenda sheet while the meeting is live and the member
// has not checked in. '📍 Check In to Meeting' reads the phone's position once (expo-location) and sends it with its
// precision to meetings.geofencedCheckIn, which checks it against the council's meeting circle. When the phone is outside
// the circle, its fix is too rough, location is off, or the council has set no meeting point, the GPS path locks for the
// rest of the meeting and the drawer asks for the 4-digit meeting PIN the Grand Knight reads out.
//
// Once checked in, the member may add a photo from the meeting: the camera saves it in the app's media folder as
// Meeting_Photos-<meeting>-<time>.jpg and meetings.setCheckInPhoto stores the path on the check-in. The phone has no
// channel to Google Drive, so the photo stays on the phone; the web console files meeting photos in Drive
// (Media / Meeting_Photos).
//
// Sprint 9 Revision 5.0: while GPS_UI_SUPPRESSED is on, the drawer opens on the meeting PIN and never shows the GPS
// button or a distance. readPosition and the GPS path stay, so turning the flag off brings them back.
import { useState } from 'react';
import { Image, View } from 'react-native';
import * as Location from 'expo-location';
import { BusinessRuleError, CHECK_IN_BUTTON_LABEL, GPS_UI_SUPPRESSED, MEETING_PHOTO_DRIVE_FOLDER, type CheckInProof } from '@kofc/shared';
import { CapturePhotoButton } from '@/components/CapturePhotoButton';
import { AppInput, AppText, Button, Field, Notice } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { useTheme } from '@/lib/layout-mode';
import { describeError } from '@/lib/use-async';
import { db } from '@/services/db';

/** The geofence refusals that switch the drawer to the PIN. */
const GPS_LOCK_CODES = new Set(['OUTSIDE_GEOFENCE', 'GPS_PRECISION_TOO_LOW', 'GEOFENCE_NOT_CONFIGURED']);

/** Reads one position; resolves to null (with the reason) when location is off or not allowed. */
async function readPosition(): Promise<{ proof: CheckInProof } | { reason: string }> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { reason: 'Location access is off for KofC Tracker, so GPS check-in cannot be used. Enter the 4-digit meeting PIN instead.' };
  if (!(await Location.hasServicesEnabledAsync())) return { reason: "Your phone's location services are off. Enter the 4-digit meeting PIN instead." };
  const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return {
    proof: {
      kind: 'gps',
      latitude: fix.coords.latitude,
      longitude: fix.coords.longitude,
      // A phone that reports no precision is treated as too rough for any circle.
      accuracyMeters: fix.coords.accuracy ?? Number.MAX_SAFE_INTEGER,
    },
  };
}

export function GeofenceCheckIn({
  meetingId,
  checkedIn,
  photoUrl,
  onChanged,
}: {
  meetingId: number;
  /** The member is on the live roster (LiveAssemblyState.viewerCheckedIn). */
  checkedIn: boolean;
  /** The photo already on the member's check-in, when known. */
  photoUrl?: string | null;
  onChanged: () => void;
}) {
  const { color, radius, space, large } = useTheme();
  const user = useUser();
  const [busy, setBusy] = useState(false);
  const [gpsLocked, setGpsLocked] = useState(GPS_UI_SUPPRESSED);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(photoUrl ?? null);

  const send = async (proof: CheckInProof) => {
    const result = await db.meetings.geofencedCheckIn(user.memberId, meetingId, proof);
    setNotice(
      result.alreadyCheckedIn
        ? 'You were already checked in.'
        : result.method === 'gps'
          ? GPS_UI_SUPPRESSED
            ? 'Checked in.'
            : `Checked in. You are ${result.distanceMeters} m from the meeting point.`
          : 'Checked in with the meeting PIN.',
    );
    onChanged();
  };

  const checkInByGps = async () => {
    setBusy(true);
    setError(null);
    try {
      const read = await readPosition();
      if ('reason' in read) {
        setGpsLocked(true);
        setError(read.reason);
        return;
      }
      await send(read.proof);
    } catch (err) {
      if (err instanceof BusinessRuleError && GPS_LOCK_CODES.has(err.code)) setGpsLocked(true);
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const checkInByPin = async () => {
    setBusy(true);
    setError(null);
    try {
      await send({ kind: 'pin', pin: pin.trim() });
      setPin('');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const savePhoto = async (path: string) => {
    await db.meetings.setCheckInPhoto(user.memberId, meetingId, path);
    setPhoto(path);
  };

  return (
    <View
      accessibilityLabel="Chamber Check-In"
      style={{ gap: space.sm, borderWidth: large ? 6 : 4, borderColor: checkedIn ? color.navy : color.gold, borderRadius: radius.md, padding: space.md, backgroundColor: color.white }}
    >
      {checkedIn ? (
        <>
          <AppText variant="title">✓ You are checked in</AppText>
          <AppText variant="small" tone="muted">
            You may vote on any secret ballot the Grand Knight opens.
          </AppText>
          {notice ? <Notice tone="info" message={notice} onDismiss={() => setNotice(null)} /> : null}
          {photo ? (
            <Image
              source={{ uri: photo }}
              accessibilityLabel="Your photo from the meeting"
              style={{ width: '100%', height: large ? 260 : 180, borderRadius: radius.sm, borderWidth: 2, borderColor: color.navy }}
              resizeMode="cover"
            />
          ) : null}
          <CapturePhotoButton
            prefix={`${MEETING_PHOTO_DRIVE_FOLDER}-${meetingId}`}
            title={photo ? 'Replace my meeting photo' : 'Add a meeting photo'}
            onCaptured={savePhoto}
          />
        </>
      ) : (
        <>
          <AppText variant="label">CHAMBER CHECK-IN</AppText>
          {error ? <Notice tone="error" message={error} onDismiss={() => setError(null)} /> : null}
          {!gpsLocked ? (
            <Button title={busy ? 'Finding your location…' : CHECK_IN_BUTTON_LABEL} busy={busy} disabled={busy} onPress={() => void checkInByGps()} />
          ) : (
            <>
              <Field label="MEETING PIN">
                <AppInput
                  value={pin}
                  onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="4 digits"
                  accessibilityLabel="Meeting PIN, 4 digits"
                  autoComplete="off"
                />
              </Field>
              <Button title={busy ? 'Checking in…' : 'Check in with PIN'} busy={busy} disabled={busy || pin.length !== 4} onPress={() => void checkInByPin()} />
              <AppText variant="small" tone="muted">
                Ask the Grand Knight for the PIN. After 5 wrong PINs, ask an officer to check you in from the console.
              </AppText>
            </>
          )}
        </>
      )}
    </View>
  );
}
