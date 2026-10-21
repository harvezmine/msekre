import { useId } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { planLine, planState, TRIAL_DAYS, trialBar } from '@/api/account';
import type { AccountPlan } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { Initials } from '../Initials';
import { GradientField, PressableScale } from '../kit';
import { Txt } from '../Txt';

/** Warna cincin avatar, searah jarum jam mulai dari 200° (papan v2 `.avbig`): hijau, teal, biru, limau, hijau. */
const RING = ['#1D7550', '#19B3A6', '#3B6FE0', '#B7E07A', '#1D7550'] as const;
const RING_START = 200;
const AVATAR = 68;
const RING_W = 3;

/** Titik di lingkaran untuk sudut gaya CSS (0° = atas, searah jarum jam). */
function at(deg: number, r: number, c: number) {
  const a = (deg * Math.PI) / 180;
  return { x: c + r * Math.sin(a), y: c - r * Math.cos(a) };
}

/**
 * Cincin gradasi brand di sekeliling avatar. SVG tidak punya gradasi menyapu, jadi cincinnya empat busur 90°, masing-
 * masing dengan gradasi lurus dari warna awal ke warna akhirnya; hasilnya mendekati `conic-gradient` di papan.
 */
function Ring({ size }: { size: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = size / 2;
  const r = c - RING_W / 2;
  const arcs = [0, 1, 2, 3].map((i) => {
    const p0 = at(RING_START + i * 90, r, c);
    const p1 = at(RING_START + (i + 1) * 90, r, c);
    return { i, p0, p1, d: `M ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y}` };
  });
  return (
    <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        {arcs.map(({ i, p0, p1 }) => (
          <LinearGradient
            key={i}
            id={`cincin${uid}${i}`}
            gradientUnits="userSpaceOnUse"
            x1={p0.x}
            y1={p0.y}
            x2={p1.x}
            y2={p1.y}
          >
            <Stop offset="0" stopColor={RING[i]} />
            <Stop offset="1" stopColor={RING[i + 1]} />
          </LinearGradient>
        ))}
      </Defs>
      {arcs.map(({ i, d }) => (
        <Path key={i} d={d} stroke={`url(#cincin${uid}${i})`} strokeWidth={RING_W} fill="none" />
      ))}
    </Svg>
  );
}

/** Avatar 68 dengan huruf awal di lingkaran hijau lembut, dikelilingi cincin gradasi brand 3 dp. */
export function ProfileAvatar() {
  const { c } = useTheme();
  const outer = AVATAR + RING_W * 2;
  return (
    <View
      testID="avatar-profil"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ring size={outer} />
      <View
        style={{
          width: AVATAR,
          height: AVATAR,
          borderRadius: AVATAR / 2,
          backgroundColor: c.brandSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Initials size={22} />
      </View>
    </View>
  );
}

/** Batang hari masa coba: ruas abu-abu = hari yang sudah lewat, hijau = sisa hari. Hiasan; kalimatnya sudah ada. */
function DayBar({ left }: { left: number }) {
  const { c } = useTheme();
  return (
    <View
      testID="batang-hari"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', gap: 5, marginTop: 12 }}
    >
      {Array.from({ length: TRIAL_DAYS }, (_, i) => (
        <View
          key={i}
          testID={i >= TRIAL_DAYS - left ? 'ruas-sisa' : 'ruas-lewat'}
          style={{
            flex: 1,
            height: 7,
            borderRadius: 4,
            backgroundColor: i >= TRIAL_DAYS - left ? c.brand : c.sunken2,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Kartu profil Akun (papan v2, bingkai 19): avatar bercincin, nama, lalu satu baris paket dengan Perpanjang (ke
 * WhatsApp) dan, selama masa coba, batang tujuh hari. Paket belum terbaca: kartu tanpa baris paket; gagal: Coba lagi.
 */
export function ProfileCard({
  name,
  plan,
  failed,
  tz,
  onRenew,
  onRetry,
}: {
  name: string;
  plan: AccountPlan | null;
  failed: boolean;
  /** Zona waktu akun (menit dari UTC) untuk hari kalender paket. */
  tz: number;
  onRenew: () => void;
  onRetry: () => void;
}) {
  const { c, marker, shadow } = useTheme();
  const ended = plan ? planState(plan, undefined, tz).kind === 'berakhir' : false;
  const left = plan ? trialBar(plan, undefined, tz) : null;
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 8,
        padding: 22,
        borderRadius: 28,
        backgroundColor: c.surface,
        boxShadow: shadow.e2,
        overflow: 'hidden',
      }}
    >
      <GradientField recipe="profile" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <ProfileAvatar />
        <Txt v="header" numberOfLines={2} style={{ flex: 1, fontSize: 21, lineHeight: 27 }}>
          {name}
        </Txt>
      </View>
      {plan ? (
        <>
          <View
            style={{
              marginTop: 20,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <Txt v="subtitle" color={ended ? marker.warn.ink : c.text} style={{ flexShrink: 1 }}>
              {planLine(plan, undefined, tz)}
            </Txt>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Perpanjang"
              onPress={onRenew}
              haptic="light"
              style={{
                height: 48,
                paddingHorizontal: 18,
                borderRadius: 24,
                backgroundColor: c.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt v="label" color={c.brandInk}>
                Perpanjang
              </Txt>
            </PressableScale>
          </View>
          {left !== null ? <DayBar left={left} /> : null}
        </>
      ) : failed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Muat paket lagi"
          onPress={onRetry}
          style={{ marginTop: 16, minHeight: 48, justifyContent: 'center' }}
        >
          <Txt v="label" color={c.brandInk}>
            Muat paket lagi
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}
