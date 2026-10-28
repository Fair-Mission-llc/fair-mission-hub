// Report Hours. Sprint 6A replaced the hour and minute drop-downs with taps:
//   - Activities (the default): a high-contrast grid with one button per council activity. Each tap logs 15 minutes
//     for today at once (activityTime.addQuarterHour), and another tap on the same button grows that day's entry by
//     15 minutes more; a toast flashes the new total. Taps queue, so rapid taps never race each other's transaction.
//     Sprint 6A patch: bigger tiles. Sprint 8S Revision 4: signing in unlocks the whole app, so a tap no longer asks
//     for Face ID or a fingerprint (lib/pocket-gate.ts is gone). Every tap waits in a queue and the member drags the
//     Slide to Log Hours bar (components/SwipeToConfirm.tsx) to save them, so a pocket brush logs nothing.
//   - A shift I worked: pick a shift (back to the council's logging
//     window, Council.volunteer_logging_window_days since Sprint 7E), then
//     step the time in 15-minute steps and save. A shift with no hours logged yet starts at its own length
//     (shifts.getShiftDefaultLength, Sprint 5Y-6).
// Sprint 5Z-6: a shift whose event has not started, or ended more than the council's
// er_submission_window_days ago (expenseWindowState; 30 by default), is padlocked
// and grayed, and Save stays disabled while it is chosen.
// Sprint 6C: in the large text layout (useTheme) the tiles fill the width one per row and stand at least 140 points
// tall, black with a thick gold edge and large white type; the slide bar's thumb and every button grow to match.
// Sprint 9 Revision 1.1: entries a reviewer returned for correction (DRAFT, volunteerQuarantine.listReturned) sit at
// the top, above both modes, each with the reviewer's reason, a 15-minute stepper starting at the reported hours, and
// Resubmit, which sends the corrected report back to review (volunteerQuarantine.resubmit).
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import {
  isActiveLookupRow,
  eventExpenseSpan,
  expenseWindowLockMessage,
  formatDate,
  formatHours,
  formatShiftWhen,
  HOURS_STEP,
  isQuarantinedHours,
  quarantinedHoursMessage,
  councilWideSettings,
  loggingWindowStart,
  MAX_HOURS_PER_ENTRY,
  toIsoDate,
  type Activities,
  type ReturnedTimeEntry,
} from '@kofc/shared';
import { SwipeToConfirm } from '@/components/SwipeToConfirm';
import { AppInput, AppText, Button, Card, EmptyState, Field, Loading, Notice, Screen, Section } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { useTheme } from '@/lib/layout-mode';
import { describeError, useLoad } from '@/lib/use-async';
import { db } from '@/services/db';

type Mode = 'activity' | 'shift';
/** How long a confirmation toast stays up, in milliseconds. */
const TOAST_MS = 1800;

function Segmented({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const { color, touchTarget, large } = useTheme();
  const tab = (mode: Mode, label: string) => (
    <Pressable
      key={mode}
      accessibilityRole="tab"
      accessibilityState={{ selected: value === mode }}
      onPress={() => onChange(mode)}
      style={{
        flex: 1,
        minHeight: touchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: large ? 12 : 4,
        borderBottomColor: value === mode ? color.gold : large ? color.navy : color.line,
      }}
    >
      <AppText variant="title" tone={value === mode ? 'navy' : 'muted'} style={{ textAlign: 'center' }}>
        {label}
      </AppText>
    </Pressable>
  );
  return <View style={{ flexDirection: 'row' }}>{[tab('activity', 'Activities'), tab('shift', 'A shift I worked')]}</View>;
}

type Toast = { tone: 'info' | 'error'; text: string };

/** A confirmation that flashes over the foot of the screen and fades away by itself. */
function useToast() {
  const { color, radius, space, large } = useTheme();
  const [toast, setToast] = useState<Toast | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const show = (next: Toast) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(next);
    opacity.setValue(1);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setToast(null));
    }, TOAST_MS);
  };
  const view = toast ? (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: space.lg,
        right: space.lg,
        bottom: space.lg,
        opacity,
        backgroundColor: toast.tone === 'error' ? color.red : color.green,
        borderRadius: radius.md,
        borderWidth: large ? 4 : 2,
        borderColor: large ? color.gold : color.white,
        padding: space.md,
      }}
    >
      <AppText variant="title" tone="white" style={{ textAlign: 'center' }}>
        {toast.text}
      </AppText>
    </Animated.View>
  ) : null;
  return { show, view };
}

/**
 * One activity's button: navy with white type and a gold edge (12.6:1), today's total and any queued taps underneath.
 * Large text layout: full width, at least touchTarget tall, black with an 8-point gold edge that turns white while
 * pressed (a gold flash would put white type on gold).
 */
function ActivityTile({ activity, today, queued, onPress }: { activity: Activities; today: number; queued: number; onPress: () => void }) {
  const { color, radius, space, touchTarget, large } = useTheme();
  const status = [today > 0 ? `${formatHours(today).toUpperCase()} TODAY` : null, queued > 0 ? `+${formatHours(queued * HOURS_STEP).toUpperCase()} QUEUED` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Log 15 minutes of ${activity.ActivityName}`}
      accessibilityHint={status ? status.toLowerCase() : 'Nothing logged today yet'}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        // Sprint 6A patch: large targets with a heavy edge, for members with less steady hands or eyesight.
        flexBasis: large ? '100%' : '46%',
        flexGrow: 1,
        minHeight: Math.max(128, touchTarget),
        paddingVertical: large ? space.lg : space.xl,
        paddingHorizontal: space.lg,
        gap: space.sm,
        justifyContent: 'center',
        borderRadius: radius.md,
        borderWidth: large ? 8 : 5,
        borderColor: large && pressed ? color.text : color.gold,
        backgroundColor: !large && pressed ? color.gold : color.navy,
      })}
    >
      {({ pressed }) => (
        <>
          <AppText variant="title" style={{ fontSize: 21, lineHeight: 27, color: pressed ? color.navy : color.white }}>
            {activity.ActivityName}
          </AppText>
          <AppText variant="label" style={{ fontSize: 15, lineHeight: 20, color: pressed ? color.navy : color.gold }}>
            {status || '+15 MIN'}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

/**
 * Slide to Log Hours: a white footer pinned to the foot of the screen with the queued total, Clear, and the swipe bar.
 * Dragging the thumb to the far end commits the queued taps; letting go early springs it back and logs nothing.
 */
function SlideToLog({ label, onConfirm, onClear }: { label: string; onConfirm: () => void; onClear: () => void }) {
  const { color, space, large } = useTheme();
  return (
    <View
      style={{
        gap: space.sm,
        padding: space.lg,
        paddingTop: space.md,
        backgroundColor: color.white,
        borderTopWidth: large ? 4 : 2,
        borderTopColor: large ? color.gold : color.navy,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
        <AppText variant="title" style={{ flex: 1 }}>
          {label}
        </AppText>
        <Button title="Clear" variant="secondary" onPress={onClear} />
      </View>
      <SwipeToConfirm title="Slide to Log Hours" accessibilityLabel={`Slide to log hours. ${label}`} onConfirm={onConfirm} />
    </View>
  );
}

/**
 * The rapid-tap tracker behind the grid: today's totals and the taps queued for the slide bar.
 * Every save goes through one queue, so taps and slides never race each other's transaction.
 */
function useActivityTracker(onToast: (toast: Toast) => void) {
  const user = useUser();
  const [today] = useState(() => toIsoDate(new Date()));
  const state = useLoad(async () => {
    // Sprint 11 Revision 1.0: an Inactive activity is not offered.
    const activities = (await db.activities.listByCouncil(user.councilId)).filter(isActiveLookupRow);
    const logs = await Promise.all(activities.map((a) => db.activityTime.listByActivity(a.id)));
    const totals = new Map(
      logs.map((log) => [
        log.activity.id,
        log.entries.filter((e) => e.row.MemberID === user.memberId && e.row.ActivityDate === today).reduce((sum, e) => sum + e.row.Hours, 0),
      ]),
    );
    return { activities, totals };
  }, [user.memberId, user.councilId, today]);
  // Today's totals per activity; the ref is the running count the queued saves add to, the state what is drawn.
  const [totals, setTotals] = useState<ReadonlyMap<number, number>>(new Map());
  const running = useRef(new Map<number, number>());
  useEffect(() => {
    if (!state.data) return;
    running.current = new Map(state.data.totals);
    setTotals(running.current);
  }, [state.data]);

  // Taps waiting for the slide bar: quarter hours per activity.
  const [queued, setQueued] = useState<ReadonlyMap<number, number>>(new Map());
  const queuedRef = useRef(new Map<number, number>());
  const setQueue = (next: Map<number, number>) => {
    queuedRef.current = next;
    setQueued(next);
  };
  const enqueue = (activity: Activities) => {
    setQueue(new Map(queuedRef.current).set(activity.id, (queuedRef.current.get(activity.id) ?? 0) + 1));
    onToast({ tone: 'info', text: `Queued +15 min · ${activity.ActivityName}. Slide below to log.` });
  };

  const saves = useRef<Promise<void>>(Promise.resolve());
  /** The day's logged total after the tap, or null when the tap was held for leadership review (Sprint 7B). */
  const saveQuarter = async (activityId: number): Promise<number | null> => {
    const result = await db.activityTime.addQuarterHour(user.memberId, activityId, today);
    if (isQuarantinedHours(result)) return null;
    const total = (running.current.get(activityId) ?? 0) + HOURS_STEP;
    running.current = new Map(running.current).set(activityId, total);
    setTotals(running.current);
    return total;
  };

  // Sprint 8S Revision 4: no scan inside a session - a tap only queues, and the slide bar saves.
  const tap = enqueue;

  const commitQueued = () => {
    const batch = queuedRef.current;
    setQueue(new Map());
    saves.current = saves.current.then(async () => {
      let saved = 0;
      let held = 0;
      const left = new Map<number, number>();
      for (const [activityId, quarters] of batch) {
        for (let i = 0; i < quarters; i++) {
          try {
            if ((await saveQuarter(activityId)) === null) held++;
            else saved++;
          } catch (err) {
            left.set(activityId, quarters - i);
            onToast({ tone: 'error', text: describeError(err) });
            break;
          }
        }
      }
      // A refused save stays queued, so nothing tapped is silently lost.
      if (left.size > 0) {
        const merged = new Map(queuedRef.current);
        for (const [id, n] of left) merged.set(id, (merged.get(id) ?? 0) + n);
        setQueue(merged);
      }
      if (held > 0 && left.size === 0) {
        onToast({ tone: 'info', text: `Logged ${formatHours(saved * HOURS_STEP)}; ${formatHours(held * HOURS_STEP)} sent to leadership review (over the daily limit).` });
      } else if (saved > 0 && left.size === 0) onToast({ tone: 'info', text: `Logged ${formatHours(saved * HOURS_STEP)} for today.` });
    });
  };

  const queuedQuarters = [...queued.values()].reduce((sum, n) => sum + n, 0);
  return { state, totals, queued, queuedQuarters, tap, commitQueued, clearQueued: () => setQueue(new Map()) };
}

type Tracker = ReturnType<typeof useActivityTracker>;

/** The rapid-tap grid: one tap queues 15 minutes against the activity for today; the slide bar saves them. */
function ActivityGrid({ tracker }: { tracker: Tracker }) {
  const { space } = useTheme();
  const { state, totals, queued, tap } = tracker;
  const { data } = state;
  return (
    <>
      {state.error ? <Notice tone="error" message={state.error} /> : null}
      {!data && state.loading ? <Loading /> : null}
      {data ? (
        <Section title="Tap an activity: 15 minutes per tap">
          <AppText tone="muted">Taps wait in a queue. When you are done, drag the Slide to Log Hours bar at the bottom to save them.</AppText>
          {data.activities.length === 0 ? (
            <EmptyState message="Your council has no activities yet. An admin can add them." />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
              {data.activities.map((a) => (
                <ActivityTile key={a.id} activity={a} today={totals.get(a.id) ?? 0} queued={queued.get(a.id) ?? 0} onPress={() => tap(a)} />
              ))}
            </View>
          )}
        </Section>
      ) : null}
    </>
  );
}

/** Minus and plus 15 minutes around the total, in place of the old hour and minute drop-downs. */
function QuarterStepper({ value, onChange }: { value: number; onChange: (hours: number) => void }) {
  const { space, large } = useTheme();
  const step = (delta: number) => onChange(Math.min(MAX_HOURS_PER_ENTRY, Math.max(0, value + delta)));
  const total = (
    <AppText variant="heading" style={{ minWidth: 96, textAlign: 'center' }} accessibilityLiveRegion="polite">
      {value > 0 ? formatHours(value) : '0 m'}
    </AppText>
  );
  const minus = <Button title="− 15 min" variant="secondary" style={{ flex: 1 }} disabled={value <= 0} onPress={() => step(-HOURS_STEP)} />;
  const plus = <Button title="+ 15 min" variant="secondary" style={{ flex: 1 }} disabled={value >= MAX_HOURS_PER_ENTRY} onPress={() => step(HOURS_STEP)} />;
  // Large text layout: the total gets its own line above the two buttons, which would not fit beside it.
  if (large) {
    return (
      <View style={{ gap: space.md }}>
        {total}
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {minus}
          {plus}
        </View>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      {minus}
      {total}
      {plus}
    </View>
  );
}

function ShiftReport({ onToast }: { onToast: (toast: Toast) => void }) {
  const { color, space, touchTarget, large } = useTheme();
  const user = useUser();
  const [shiftId, setShiftId] = useState<number | null>(null);
  const [hours, setHours] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const state = useLoad(async () => {
    const today = new Date();
    // Sprint 7E: the council's own logging window and expense window.
    const settings = councilWideSettings(await db.councils.get(user.councilId));
    const shifts = await db.events.listMemberShifts(user.memberId, {
      fromDate: loggingWindowStart(today, settings.volunteer_logging_window_days),
      toDate: toIsoDate(today),
    });
    return { today: toIsoDate(today), shifts: shifts.reverse(), settings };
  }, [user.memberId, user.councilId]);
  const { data } = state;

  // The shift the time is being filled for, so a slow default for a shift no longer chosen is dropped.
  const picking = useRef<number | null>(null);
  const pickShift = (id: number) => {
    picking.current = id;
    setShiftId(id);
    const logged = data?.shifts.find((s) => s.shift.id === id)?.hoursLogged;
    if (logged != null) {
      setHours(logged);
      return;
    }
    setHours(0);
    db.shifts.getShiftDefaultLength(id).then(
      (length) => {
        if (picking.current === id && length > 0) setHours(length);
      },
      () => undefined, // no default: the member steps the time themselves
    );
  };

  // Low-click default: the most recent shift still missing hours, with its length filled in.
  useEffect(() => {
    if (!data || shiftId !== null) return;
    const first = data.shifts.find((s) => s.hoursLogged === null) ?? data.shifts[0];
    if (first) pickShift(first.shift.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, shiftId]);

  const lockOf = (event: Parameters<typeof eventExpenseSpan>[0]) => (data ? expenseWindowLockMessage(eventExpenseSpan(event), data.today, data.settings.er_submission_window_days) : null);
  const chosen = data?.shifts.find((s) => s.shift.id === shiftId);
  const locked = chosen ? lockOf(chosen.event) : null;
  const canSave = shiftId !== null && hours > 0 && !busy && locked === null;

  const save = async () => {
    if (!canSave || shiftId === null) return;
    setBusy(true);
    try {
      const result = await db.eventTime.logHours(user.memberId, shiftId, hours, notes.trim() || undefined);
      if (isQuarantinedHours(result)) onToast({ tone: 'info', text: quarantinedHoursMessage(result.quarantined) });
      else onToast({ tone: 'info', text: `Saved ${formatHours(hours)} to ${chosen?.shift.ShiftName ?? 'the shift'}` });
      setNotes('');
      await state.reload();
    } catch (err) {
      onToast({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {state.error ? <Notice tone="error" message={state.error} /> : null}
      {!data && state.loading ? <Loading /> : null}
      {data ? (
        <Section title="Which shift?">
          {data.shifts.length === 0 ? (
            <EmptyState message={`You have no shifts in the last ${data.settings.volunteer_logging_window_days} days to report time for.`} />
          ) : (
            data.shifts.map(({ shift, event, hoursLogged }) => {
              const selected = shift.id === shiftId;
              const lock = lockOf(event);
              return (
                <Pressable key={shift.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => pickShift(shift.id)}>
                  <Card
                    accent={selected ? color.gold : color.line}
                    // Large text layout: every card edge is gold, so the chosen shift is ringed in white.
                    style={[{ minHeight: touchTarget }, large && selected ? { borderColor: color.text, borderWidth: 8 } : null]}
                  >
                    <AppText variant="title" tone={lock ? 'muted' : 'navy'}>
                      {lock ? '🔒 ' : ''}
                      {shift.ShiftName}
                    </AppText>
                    <AppText variant="small" tone="muted">
                      {event.EventName} · {formatShiftWhen(shift)}
                    </AppText>
                    {lock ? (
                      <AppText variant="small" tone="muted">
                        {lock}
                      </AppText>
                    ) : hoursLogged === null ? (
                      <AppText variant="label" tone="red">
                        NO TIME LOGGED YET
                      </AppText>
                    ) : (
                      <AppText variant="label">LOGGED {formatHours(hoursLogged).toUpperCase()} · TAP TO CHANGE</AppText>
                    )}
                  </Card>
                </Pressable>
              );
            })
          )}
        </Section>
      ) : null}
      {data && data.shifts.length > 0 ? (
        <>
          <Section title="How long?">
            <QuarterStepper value={hours} onChange={setHours} />
          </Section>
          <Field label="NOTES (OPTIONAL)">
            <AppInput value={notes} onChangeText={setNotes} multiline style={{ minHeight: 72, textAlignVertical: 'top', paddingTop: space.md }} maxLength={255} />
          </Field>
          <Button title={locked ? '🔒 Reporting locked' : 'Save time'} busy={busy} disabled={!canSave} onPress={() => void save()} />
        </>
      ) : null}
    </>
  );
}

/** One returned entry: the reviewer's reason, the corrected hours and Resubmit. */
function ReturnedReport({ entry, onDone }: { entry: ReturnedTimeEntry; onDone: (toast: Toast) => void }) {
  const { color, space } = useTheme();
  const user = useUser();
  const [hours, setHours] = useState(entry.row.hours_reported);
  const [notes, setNotes] = useState(entry.row.notes ?? '');
  const [busy, setBusy] = useState(false);

  const resubmit = async () => {
    if (hours <= 0 || busy) return;
    setBusy(true);
    try {
      await db.volunteerQuarantine.resubmit(user.memberId, entry.row.id, hours, notes);
      onDone({ tone: 'info', text: `Resubmitted ${formatHours(hours)} for review.` });
    } catch (err) {
      onDone({ tone: 'error', text: describeError(err) });
      setBusy(false);
    }
  };

  return (
    <Card accent={color.red} style={{ gap: space.sm }}>
      <AppText variant="label" tone="red">
        RETURNED FOR CORRECTION
      </AppText>
      <AppText variant="title">{entry.activityLabel}</AppText>
      <AppText variant="small" tone="muted">
        {formatDate(entry.row.activity_date)} · reported {formatHours(entry.row.hours_reported)}
      </AppText>
      <View style={{ gap: space.xs, borderLeftWidth: 4, borderLeftColor: color.red, paddingLeft: space.md }}>
        <AppText variant="label">{entry.returnedByName ? `${entry.returnedByName.toUpperCase()} SAYS` : 'THE REVIEWER SAYS'}</AppText>
        <AppText accessibilityLabel={`Reason for returning: ${entry.returnReason}`}>{entry.returnReason}</AppText>
      </View>
      <Field label="CORRECTED HOURS">
        <QuarterStepper value={hours} onChange={setHours} />
      </Field>
      <Field label="NOTES (OPTIONAL)">
        <AppInput value={notes} onChangeText={setNotes} multiline style={{ minHeight: 72, textAlignVertical: 'top', paddingTop: space.md }} maxLength={255} />
      </Field>
      <Button title="Resubmit for review" busy={busy} disabled={hours <= 0 || busy} onPress={() => void resubmit()} />
    </Card>
  );
}

/** The member's own time entries a reviewer sent back; nothing shows when there are none. */
function ReturnedReports({ onToast }: { onToast: (toast: Toast) => void }) {
  const user = useUser();
  const state = useLoad(() => db.volunteerQuarantine.listReturned(user.memberId), [user.memberId]);
  const rows = state.data ?? [];
  if (state.error) return <Notice tone="error" message={state.error} />;
  if (rows.length === 0) return null;
  return (
    <Section title="Returned for correction">
      <AppText tone="muted">A reviewer sent these back. Read the reason, fix the hours and resubmit.</AppText>
      {rows.map((entry) => (
        <ReturnedReport
          key={entry.row.id}
          entry={entry}
          onDone={(toast) => {
            onToast(toast);
            if (toast.tone === 'info') void state.reload();
          }}
        />
      ))}
    </Section>
  );
}

export default function LogScreen() {
  const { color, large } = useTheme();
  const [mode, setMode] = useState<Mode>('activity');
  const toast = useToast();
  const tracker = useActivityTracker(toast.show);
  const slider = mode === 'activity' && tracker.queuedQuarters > 0;

  return (
    <View style={{ flex: 1, backgroundColor: color.white }}>
      <View style={{ flex: 1 }}>
        <Screen>
          <AppText variant="heading" accessibilityRole="header">
            Report Hours
          </AppText>
          <ReturnedReports onToast={toast.show} />
          <Segmented value={mode} onChange={setMode} />
          {mode === 'activity' ? <ActivityGrid tracker={tracker} /> : <ShiftReport onToast={toast.show} />}
          <View style={{ height: large ? 160 : 72 }} />
        </Screen>
        {toast.view}
      </View>
      {slider ? (
        <SlideToLog label={`${formatHours(tracker.queuedQuarters * HOURS_STEP)} queued`} onConfirm={tracker.commitQueued} onClear={tracker.clearQueued} />
      ) : null}
    </View>
  );
}
