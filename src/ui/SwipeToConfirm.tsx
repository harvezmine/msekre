import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { onForest } from '@/theme/tokens';
import { Icon } from './Icon';
import { Txt } from './Txt';

const TRACK_H = 72;
const THUMB = 60;
const GAP = (TRACK_H - THUMB) / 2;
/** Lepas lewat bagian ini dari jarak geser = konfirmasi. */
export const CONFIRM_AT = 0.8;

interface Props {
  label: string;
  /** Nama aksi untuk pembaca layar, contoh "Matikan". */
  actionLabel: string;
  onConfirm: () => void;
}

/** Slider "Geser untuk ..." di layar alarm (desain 2l): jempol 60 di jalur 72, lepas lewat 80% = jadi. */
export function SwipeToConfirm({ label, actionLabel, onConfirm }: Props) {
  const x = useSharedValue(0);
  // Jarak geser terukur: nilai bersama, karena worklet tidak boleh membaca ref React (objek yang ditangkap dibekukan).
  const range = useSharedValue(0);
  const done = useRef(false);
  const [, setWidth] = useState(0);

  const confirm = () => {
    if (done.current) return;
    done.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm();
  };

  const pan = usePanGesture({
    activeOffsetX: 6,
    failOffsetY: [-30, 30],
    onUpdate: (e) => {
      'worklet';
      x.set(Math.min(Math.max(0, e.translationX), range.get()));
    },
    onDeactivate: () => {
      'worklet';
      const r = range.get();
      if (r > 0 && x.get() >= r * CONFIRM_AT) {
        x.set(r);
        scheduleOnRN(confirm);
      } else {
        x.set(withSpring(0, { damping: 18, stiffness: 220 }));
      }
    },
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    range.set(Math.max(0, w - THUMB - GAP * 2));
    setWidth(w);
  };

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [0, Math.max(range.get() * 0.6, 1)], [1, 0], 'clamp'),
  }));

  return (
    <View
      testID="swipe-to-confirm"
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityActions={[{ name: 'activate', label: actionLabel }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'activate') confirm();
      }}
      onLayout={onLayout}
      style={{
        height: TRACK_H,
        borderRadius: TRACK_H / 2,
        backgroundColor: 'rgba(236,242,234,0.1)',
        justifyContent: 'center',
      }}
    >
      <Animated.View style={[{ alignItems: 'center', paddingLeft: 40 }, labelStyle]}>
        <Txt weight={600} color={onForest.label} style={{ fontSize: 17 }}>
          {label}
        </Txt>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: GAP,
              top: GAP,
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: onForest.strong,
              alignItems: 'center',
              justifyContent: 'center',
            },
            thumbStyle,
          ]}
        >
          <Icon name="chevR" size={26} color="#0E3A2C" />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
