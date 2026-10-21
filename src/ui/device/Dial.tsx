import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureDetector, GestureStateManager, usePanGesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { AC_MAX, AC_MIN } from '@/api/constants';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from '../Txt';
import {
  angleOf,
  arcFromTemp,
  arcPath,
  arcPosFromAngle,
  DIAL,
  onRing,
  pointAt,
  stepArc,
  tempFromArc,
  tempToAngle,
} from './dialMath';

interface Props {
  name: string;
  temp: number;
  /** Tulisan di bawah angka: mode ("Dingin") atau "Mati". */
  caption: string;
  /** AC mati: busur abu-abu. */
  dimmed?: boolean;
  onChange: (temp: number) => void;
}

/**
 * Putaran suhu 16–30° (desain 2d): busur 270°, jempol yang bisa digeser (pan) dan angka besar di tengah.
 * Geseran membulat ke derajat bulat. Untuk pembaca layar: satu kontrol `adjustable` (naik/turun satu derajat).
 */
export function Dial({ name, temp, caption, dimmed = false, onChange }: Props) {
  const { c, marker } = useTheme();
  // Semua nilai yang dibaca worklet berupa nilai bersama (worklet tidak boleh menangkap ref atau objek biasa).
  const last = useSharedValue(temp); // suhu terakhir yang dikirim
  const pos = useSharedValue(arcFromTemp(temp)); // posisi busur 0–270 yang sedang dilacak
  const prevAngle = useSharedValue(0);
  const dragging = useSharedValue(false);
  // Selama jari di putaran, nilai prop tidak boleh menimpa pelacakan (menghindari kiriman dobel).
  useEffect(() => {
    if (dragging.get()) return;
    last.set(temp);
    pos.set(arcFromTemp(temp));
  }, [temp, last, pos, dragging]);

  const emit = (t: number) => {
    void Haptics.selectionAsync();
    onChange(t);
  };
  const publish = () => {
    'worklet';
    const t = tempFromArc(pos.get());
    if (t === last.get()) return;
    last.set(t);
    scheduleOnRN(emit, t);
  };
  // Aktivasi manual: hanya sentuhan di pita cincin yang mengambil gestur; selain itu ScrollView/anak-anaknya yang memegang.
  const pan = usePanGesture({
    manualActivation: true,
    onTouchesDown: (e) => {
      'worklet';
      const t = e.changedTouches[0];
      if (!t || !onRing(t.x, t.y)) {
        GestureStateManager.fail(e.handlerTag);
        return;
      }
      const angle = angleOf(t.x, t.y);
      const jump = arcPosFromAngle(angle);
      // Mengetuk cincin = langsung ke titik itu; di celah bawah tidak loncat, lanjut dari posisi sekarang.
      pos.set(jump ?? arcFromTemp(last.get()));
      prevAngle.set(angle);
      dragging.set(true);
      GestureStateManager.activate(e.handlerTag);
    },
    onActivate: () => {
      'worklet';
      publish();
    },
    onUpdate: (e) => {
      'worklet';
      const angle = angleOf(e.x, e.y);
      pos.set(stepArc(pos.get(), prevAngle.get(), angle));
      prevAngle.set(angle);
      publish();
    },
    onFinalize: () => {
      'worklet';
      dragging.set(false);
    },
  });

  const step = (d: number) => {
    const next = Math.min(AC_MAX, Math.max(AC_MIN, temp + d));
    if (next !== temp) emit(next);
  };

  const a1 = DIAL.start + DIAL.sweep;
  const av = tempToAngle(temp);
  const knob = pointAt(av);
  const fill = dimmed ? c.sunken2 : marker.terhubung.base;

  return (
    <View
      testID="putaran-suhu"
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Suhu ${name}`}
      accessibilityValue={{ text: `${temp} derajat` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') step(1);
        else if (e.nativeEvent.actionName === 'decrement') step(-1);
      }}
      style={{ width: DIAL.size, height: DIAL.size, alignSelf: 'center', marginTop: 4 }}
    >
      <GestureDetector gesture={pan}>
        <View collapsable={false} style={{ width: DIAL.size, height: DIAL.size }}>
          <Svg width={DIAL.size} height={DIAL.size} viewBox={`0 0 ${DIAL.size} ${DIAL.size}`}>
            <Path
              d={arcPath(DIAL.start, a1)}
              fill="none"
              stroke={c.sunken2}
              strokeWidth={DIAL.stroke}
              strokeLinecap="round"
            />
            {av > DIAL.start ? (
              <Path
                d={arcPath(DIAL.start, av)}
                fill="none"
                stroke={fill}
                strokeWidth={DIAL.stroke}
                strokeLinecap="round"
              />
            ) : null}
            <Circle cx={knob.x} cy={knob.y} r={DIAL.knob} fill={c.surface} stroke={fill} strokeWidth={3} />
          </Svg>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <Txt tabular style={{ fontSize: 64, lineHeight: 72, letterSpacing: -1.28 }} weight={600}>
              {temp}°
            </Txt>
            <Txt color={c.muted}>{caption}</Txt>
          </View>
          <Txt
            v="caption"
            color={c.muted}
            style={{ position: 'absolute', left: 34, bottom: 12 }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {AC_MIN}°
          </Txt>
          <Txt
            v="caption"
            color={c.muted}
            style={{ position: 'absolute', right: 30, bottom: 12 }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {AC_MAX}°
          </Txt>
        </View>
      </GestureDetector>
    </View>
  );
}
