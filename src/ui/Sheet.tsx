import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { BackHandler, KeyboardAvoidingView, Pressable, useWindowDimensions, View } from 'react-native';
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
import { shouldDismiss } from './sheetMath';

const OPEN_MS = 280;
const CLOSE_MS = 200;

interface SheetControls {
  /** Menutup dengan geser keluar 200 ms, lalu `onClose`, lalu `after`. Gerak dikurangi: langsung. */
  close: (after?: () => void) => void;
}

const SheetContext = createContext<SheetControls>({ close: (after) => after?.() });

/** Untuk isi lembar yang perlu menutupnya dengan gerak (pilih tempat, simpan). */
export function useSheet(): SheetControls {
  return useContext(SheetContext);
}

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
  const panelH = useSharedValue(0);
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

  const close = useCallback(
    (after?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      if (reduce) {
        onClose();
        after?.();
        return;
      }
      ty.set(withTiming(screenH, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) }));
      timer.current = setTimeout(() => {
        onClose();
        after?.();
      }, CLOSE_MS);
    },
    [onClose, reduce, screenH, ty],
  );
  const closePlain = useCallback(() => close(), [close]);
  const controls = useMemo(() => ({ close }), [close]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closePlain();
      return true;
    });
    return () => sub.remove();
  }, [closePlain]);

  const pan = usePanGesture({
    activeOffsetY: 10,
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      'worklet';
      ty.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (shouldDismiss(ty.get(), panelH.get(), e.velocityY)) scheduleOnRN(closePlain);
      else ty.set(withTiming(0, { duration: CLOSE_MS }));
    },
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ty.get(), [0, Math.max(panelH.get(), 1)], [1, 0], 'clamp'),
  }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.get() }] }));

  return (
    // Edge-to-edge (SDK 58): jendela tidak mengecil saat keyboard muncul, jadi 'padding' menaikkan panel setinggi keyboard.
    <KeyboardAvoidingView behavior="padding" testID={testID} style={{ flex: 1, justifyContent: 'flex-end' }}>
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
        onPress={closePlain}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <GestureDetector gesture={pan}>
        <Animated.View
          accessibilityViewIsModal
          onAccessibilityEscape={closePlain}
          onLayout={(e) => {
            panelH.set(e.nativeEvent.layout.height);
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
          <SheetContext value={controls}>{children}</SheetContext>
        </Animated.View>
      </GestureDetector>
    </KeyboardAvoidingView>
  );
}
