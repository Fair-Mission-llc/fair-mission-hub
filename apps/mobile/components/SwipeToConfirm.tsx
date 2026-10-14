// Swipe to Confirm (Sprint 8S Revision 4): the phone's lightweight guard on a critical trigger. Signing in unlocks the
// whole app, so no button inside a session asks for Face ID, a fingerprint or a passcode again; instead a trigger that
// writes something hard to take back (logging the queued hours, concluding a collection session) sits behind this bar.
// The member drags the gold thumb to the far end; letting go early springs it back and does nothing, so a phone brushing
// against a pocket cannot fire it. Screen readers activate it directly.
// Lifted out of the Report Hours screen's Slide to Log Hours bar (Sprint 6A patch); the look is unchanged.
import { useRef, useState } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import { AppText } from '@/components/ui';
import { useTheme } from '@/lib/layout-mode';

/** The thumb of the bar, and how close to the end (in points) a release still counts as a full swipe. */
const THUMB = 64;
const SLIDE_SLACK = 12;

export function SwipeToConfirm({
  title,
  accessibilityLabel,
  disabled = false,
  onConfirm,
}: {
  /** The words on the track, e.g. 'Slide to Log Hours'. */
  title: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const { color, radius, space, touchTarget, large } = useTheme();
  // Large text layout: the thumb is a full touchTarget circle, black with a gold ring.
  const thumb = large ? touchTarget : THUMB;
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const travel = Math.max(0, width - thumb - 2 * space.xs);
  const travelRef = useRef(travel);
  travelRef.current = travel;
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => x.setValue(Math.min(travelRef.current, Math.max(0, g.dx))),
      onPanResponderRelease: (_, g) => {
        if (travelRef.current > 0 && g.dx >= travelRef.current - SLIDE_SLACK) {
          Animated.timing(x, { toValue: travelRef.current, duration: 80, useNativeDriver: false }).start(() => {
            confirmRef.current();
            x.setValue(0);
          });
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    }),
  ).current;

  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'activate', label: title }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && !disabled && onConfirm()}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        height: thumb + 2 * space.xs,
        borderRadius: radius.pill,
        backgroundColor: color.navy,
        borderWidth: large ? 4 : 3,
        borderColor: color.gold,
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <AppText
        variant="title"
        tone="white"
        style={{ position: 'absolute', left: large ? thumb + space.sm : 0, right: 0, textAlign: 'center', fontSize: 19 }}
      >
        {title}
      </AppText>
      <Animated.View
        {...responder.panHandlers}
        style={{
          position: 'absolute',
          left: space.xs - 3,
          width: thumb,
          height: thumb,
          borderRadius: thumb / 2,
          backgroundColor: large ? color.navy : color.gold,
          borderWidth: large ? 6 : 0,
          borderColor: color.gold,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ translateX: x }],
        }}
      >
        <AppText style={{ color: color.navy, fontSize: 28, lineHeight: 32, fontWeight: '700' }}>›</AppText>
      </Animated.View>
    </View>
  );
}
