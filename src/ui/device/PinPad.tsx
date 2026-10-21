import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { PIN_LENGTH } from '@/sample/devices';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';

/** Hasil memeriksa PIN: `true` diterima; `false` salah; teks = salah dengan pesan ini (menggantikan pesan bawaan). */
export type PinVerdict = boolean | string;

interface Props {
  subtitle: string;
  /** Judul di atas titik. Bawaan "Masukkan PIN". */
  title?: string;
  /**
   * Dipanggil saat enam angka terisi. `true` bila diterima; `false` (atau teks pesan) menggetarkan titik dan mengosongkan
   * isian. Boleh berupa janji: selagi menunggu, isian terkunci.
   */
  onSubmit: (pin: string) => PinVerdict | Promise<PinVerdict>;
  onCancel: () => void;
  /** "Lupa PIN?" disembunyikan bila kosong. */
  onForgot?: () => void;
  /** Kata untuk pembaca layar pada titik, "PIN" bawaan ("Kode" untuk kode dari WhatsApp). */
  noun?: string;
}

const WRONG_PIN = 'PIN belum cocok, coba lagi.';

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
] as const;

/** Isi lembar PIN (desain 2e): kunci, enam titik, tombol angka, Batal dan Hapus. */
export function PinPad({ subtitle, title = 'Masukkan PIN', onSubmit, onCancel, onForgot, noun = 'PIN' }: Props) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState<string | null>(null);
  const shake = useSharedValue(0);

  // Isian dilacak di ref supaya dua ketukan cepat sebelum render tidak saling menimpa; `pin` hanya untuk tampilan.
  const typed = useRef('');
  const setTyped = (value: string) => {
    typed.current = value;
    setPin(value);
  };

  const reject = (message: string) => {
    setTyped('');
    setWrong(message);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    AccessibilityInfo.announceForAccessibility(message);
    if (!reduce) {
      shake.set(
        withSequence(
          withTiming(-10, { duration: 50 }),
          withTiming(10, { duration: 80 }),
          withTiming(-8, { duration: 80 }),
          withTiming(8, { duration: 80 }),
          withTiming(0, { duration: 50 }),
        ),
      );
    }
  };
  const waiting = useRef(false);
  const judge = (verdict: PinVerdict) => {
    waiting.current = false;
    if (verdict === true) return;
    reject(typeof verdict === 'string' ? verdict : WRONG_PIN);
  };

  const press = (digit: string) => {
    if (typed.current.length >= PIN_LENGTH) return;
    void Haptics.selectionAsync();
    const next = typed.current + digit;
    if (next.length < PIN_LENGTH) {
      setTyped(next);
      setWrong(null);
      return;
    }
    setTyped(next);
    const verdict = onSubmit(next);
    if (typeof verdict === 'object') {
      // Janji: enam titik tetap terisi (terkunci) sampai jawabannya datang.
      waiting.current = true;
      verdict.then(judge, () => judge(false));
    } else {
      judge(verdict);
    }
  };
  const back = () => {
    if (!waiting.current) setTyped(typed.current.slice(0, -1));
  };

  const dotsStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  return (
    <View style={{ alignItems: 'center', gap: 20 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: c.mint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="lock" size={26} color={c.green} />
      </View>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Txt v="title" accessibilityRole="header">
          {title}
        </Txt>
        <Txt color={c.muted} style={{ textAlign: 'center' }}>
          {subtitle}
        </Txt>
      </View>
      <Animated.View
        testID="pin-titik"
        accessible
        accessibilityLabel={`${noun} terisi ${pin.length} dari ${PIN_LENGTH}`}
        style={[{ flexDirection: 'row', gap: 16, paddingVertical: 4 }, dotsStyle]}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: i < pin.length ? c.ink : 'transparent',
              borderWidth: i < pin.length ? 0 : 1.75,
              borderColor: wrong ? c.clay : c.dotEmpty,
            }}
          />
        ))}
      </Animated.View>
      {wrong ? (
        <Txt accessibilityRole="alert" accessibilityLiveRegion="polite" color={c.clay} weight={600}>
          {wrong}
        </Txt>
      ) : null}
      <View style={{ width: '100%', gap: 8 }}>
        {ROWS.map((row) => (
          <View key={row.join('')} style={{ flexDirection: 'row', gap: 8 }}>
            {row.map((d) => (
              <Key key={d} label={d} onPress={() => press(d)} />
            ))}
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Key label="Batal" plain small onPress={onCancel} />
          <Key label="0" onPress={() => press('0')} />
          <Key label="Hapus" plain onPress={back} icon />
        </View>
      </View>
      {onForgot ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lupa PIN?"
          onPress={onForgot}
          android_ripple={{ color: c.ripple }}
          style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 }}
        >
          <Txt weight={600} color={c.green}>
            Lupa PIN?
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

function Key({
  label,
  onPress,
  plain = false,
  small = false,
  icon = false,
}: {
  label: string;
  onPress: () => void;
  plain?: boolean;
  small?: boolean;
  icon?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: c.ripple }}
      style={{
        flex: 1,
        height: 64,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: plain ? 'transparent' : c.quiet,
      }}
    >
      {icon ? (
        <Icon name="backspace" size={26} color={c.ink} />
      ) : (
        <Txt weight={600} style={small ? undefined : { fontSize: 24, lineHeight: 32 }}>
          {label}
        </Txt>
      )}
    </Pressable>
  );
}
