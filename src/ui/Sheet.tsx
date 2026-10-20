import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { BackHandler, Pressable, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '@/theme/ThemeProvider';

const OPEN_MS = 280;
const CLOSE_MS = 200;

interface Props {
  onClose: () => void;
  children: ReactNode;
  testID?: string;
}

/**
 * Lembar bawah seperti desain 2b/2e/2j: latar gelap memudar, panel naik 280 ms (sk-sheet).
 * Menutup lewat ketuk latar, tombol kembali Android, atau geser ke bawah (lewat seperempat tinggi, atau sentakan cepat).
 * Dipakai di rute `transparentModal`; animasinya diurus di sini, bukan oleh Stack.
 */
export function Sheet({ onClose, children, testID }: Props) {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { height: screenH } = useWindowDimensions();
  // Posisi panel: tinggi layar = tersembunyi, 0 = terbuka penuh.
  const ty = useSharedValue(reduce ? 0 : screenH);
  const panelH = useRef(0);
  const closing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!reduce) ty.set(withTiming(0, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) }));
  }, [reduce, ty]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (reduce) {
      onClose();
      return;
    }
    ty.set(withTiming(screenH, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) }));
    timer.current = setTimeout(onClose, CLOSE_MS);
  }, [onClose, reduce, screenH, ty]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const pan = usePanGesture({
    activeOffsetY: 10,
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      'worklet';
      ty.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      const h = panelH.current || 300;
      if (ty.get() > h * 0.25 || e.velocityY > 900) scheduleOnRN(close);
      else ty.set(withTiming(0, { duration: CLOSE_MS }));
    },
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ty.get(), [0, Math.max(panelH.current, 1)], [1, 0], 'clamp'),
  }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.get() }] }));

  return (
    <View testID={testID} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(13,43,34,0.45)' },
          backdropStyle,
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tutup"
        onPress={close}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <GestureDetector gesture={pan}>
        <Animated.View
          accessibilityViewIsModal
          onLayout={(e) => {
            panelH.current = e.nativeEvent.layout.height;
          }}
          style={[
            {
              backgroundColor: c.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 12,
              paddingHorizontal: 20,
              paddingBottom: Math.max(28, insets.bottom + 12),
              maxHeight: '90%',
            },
            panelStyle,
          ]}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: 2,
              marginBottom: 16,
              backgroundColor: scheme === 'dark' ? c.track : '#D5DBD2',
            }}
          />
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
