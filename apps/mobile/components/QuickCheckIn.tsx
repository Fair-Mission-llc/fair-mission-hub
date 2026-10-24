// Quick Check-In for walk-in volunteers (Sprint 9 Revision 5.0, quick-check-in.ts), on the Signup and Collect tabs.
// The '⏱️ Quick Check-In' row shows only for a Shift Captain with a shift today (events.getQuickCheckInBoard: the event's
// owner, an officer or Trustee, or an Admin of its council). It slides up a sheet: the captain picks today's shift (one
// shift is picked for them), then taps a member's name on the council roster. events.quickCheckIn signs that member up
// for the shift on the spot, so the walk-in is on the volunteer log with no typing. A name already on the shift shows ✓.
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { QUICK_CHECK_IN_LABEL, type LayoutTokens, type QuickCheckInRosterEntry } from '@kofc/shared';
import { NavStripLayout } from '@/components/NavStrip';
import { AppText, Button, choiceStyle, Notice } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { useTheme } from '@/lib/layout-mode';
import { describeError, useLoad } from '@/lib/use-async';
import { db } from '@/services/db';

export function QuickCheckIn() {
  const theme = useTheme();
  const { color, space, touchTarget } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const user = useUser();
  const [open, setOpen] = useState(false);
  const [shiftId, setShiftId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const board = useLoad(() => db.events.getQuickCheckInBoard(user.memberId), [user.memberId]);
  const shifts = board.data?.shifts ?? [];
  // A captain hears nothing about this until they have a shift to run today.
  if (shifts.length === 0) return null;

  const picked = shifts.find((s) => s.shift.id === shiftId) ?? (shifts.length === 1 ? shifts[0] : null);
  const signedUp = new Set(picked?.signedUpMemberIds ?? []);

  const close = () => {
    setOpen(false);
    setMessage(null);
  };

  const checkIn = async (entry: QuickCheckInRosterEntry) => {
    if (!picked) return;
    setBusyId(entry.memberId);
    setMessage(null);
    try {
      const result = await db.events.quickCheckIn(user.memberId, picked.shift.id, entry.memberId);
      const name = `${entry.firstName} ${entry.lastName}`;
      setMessage({
        tone: 'info',
        text: result.alreadySignedUp
          ? `${name} was already on ${picked.shift.ShiftName}.`
          : `${name} is checked in to ${picked.shift.ShiftName}. They report their hours from the Report tab.`,
      });
      await board.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <View style={{ flexDirection: 'row' }}>
        <Button title={QUICK_CHECK_IN_LABEL} variant="secondary" onPress={() => setOpen(true)} style={{ flex: 1 }} />
      </View>

      <Modal transparent animationType="slide" visible={open} onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close">
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHeader}>
              <NavStripLayout
                surface="navy"
                onBack={close}
                onClose={close}
                closeLabel="Close Quick Check-In"
                title={
                  <AppText variant="heading" tone="white" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 18, lineHeight: 24 }}>
                    {QUICK_CHECK_IN_LABEL}
                  </AppText>
                }
              />
            </View>
            <View style={{ padding: space.md, gap: space.sm }}>
              {shifts.length > 1 ? (
                <>
                  <AppText variant="label">TODAY'S SHIFT</AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                    {shifts.map((s) => {
                      const selected = picked?.shift.id === s.shift.id;
                      return (
                        <Pressable
                          key={s.shift.id}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          onPress={() => setShiftId(s.shift.id)}
                          style={[styles.chip, { minHeight: touchTarget }, choiceStyle(theme, selected)]}
                        >
                          <AppText variant="label" tone={selected ? 'white' : 'navy'}>
                            {s.shift.ShiftName} · {s.shift.StartTime.slice(0, 5)}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
              {picked ? (
                <AppText variant="small" tone="muted">
                  {picked.event.EventName}, {picked.shift.ShiftName}: tap a name to check them in.
                </AppText>
              ) : (
                <AppText variant="small" tone="muted">
                  Choose the shift first.
                </AppText>
              )}
              {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            </View>
            <FlatList
              data={board.data?.roster ?? []}
              keyExtractor={(r) => String(r.memberId)}
              initialNumToRender={20}
              renderItem={({ item }) => {
                const done = signedUp.has(item.memberId);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.firstName} ${item.lastName}${done ? ', checked in' : ''}`}
                    accessibilityState={{ disabled: !picked || done || busyId !== null, busy: busyId === item.memberId }}
                    disabled={!picked || done || busyId !== null}
                    onPress={() => void checkIn(item)}
                    style={[styles.row, { borderLeftColor: done ? color.gold : color.white, opacity: busyId === item.memberId ? 0.5 : 1 }]}
                  >
                    <AppText variant={done ? 'title' : 'body'}>
                      {done ? '✓ ' : ''}
                      {item.lastName}, {item.firstName}
                    </AppText>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = ({ color, radius, space, touchTarget, border, large }: LayoutTokens) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 40, 85, 0.45)' },
    sheet: {
      maxHeight: large ? '90%' : '80%',
      backgroundColor: color.white,
      borderWidth: large ? 4 : 0,
      borderColor: color.gold,
      borderTopLeftRadius: radius.md,
      borderTopRightRadius: radius.md,
      overflow: 'hidden',
    },
    sheetHeader: { paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: color.navy },
    chip: {
      justifyContent: 'center',
      paddingHorizontal: space.md,
      borderWidth: border(2),
      borderColor: large ? color.gold : color.navy,
      borderRadius: radius.sm,
    },
    row: {
      minHeight: touchTarget,
      justifyContent: 'center',
      paddingHorizontal: space.lg,
      borderLeftWidth: large ? 12 : 6,
      borderBottomWidth: border(1),
      borderBottomColor: color.line,
      backgroundColor: color.white,
    },
  });
