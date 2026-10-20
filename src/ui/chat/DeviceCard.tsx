import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import { ROOM_TEMP } from '@/sample/chat';
import { useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Toggle } from '../Toggle';
import { Txt } from '../Txt';
import { ChatCard } from './ChatCard';

const MIN = 16;
const MAX = 30;

/** Kartu AC kamar di chat: sakelar yang sama dengan Beranda dan pengatur suhu 16–30. */
export function DeviceCard({ deviceId }: { deviceId: string }) {
  const { c } = useTheme();
  const { state, dispatch } = useSample();
  const name = state.devices.find((d) => d.id === deviceId)?.name ?? 'AC';
  const { on, temp, mode } = state.ac;
  const step = (d: number) => {
    const next = Math.min(MAX, Math.max(MIN, temp + d));
    if (next === temp) return;
    void Haptics.selectionAsync();
    dispatch({ type: 'setAc', temp: next, source: 'chat' });
  };
  return (
    <ChatCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: c.mint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="snow" size={22} color={c.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight={600}>{name}</Txt>
          <Txt v="caption" color={c.muted}>
            {on ? `Nyala · ${mode}` : 'Mati'}
          </Txt>
        </View>
        <Toggle label={name} value={on} onChange={(next) => dispatch({ type: 'setAc', on: next, source: 'chat' })} />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: c.paper,
          borderRadius: 16,
          padding: 4,
        }}
      >
        <StepButton label="Turunkan suhu" icon="minus" disabled={temp <= MIN} onPress={() => step(-1)} />
        <Txt style={{ fontSize: 28, lineHeight: 36 }} weight={600} tabular>
          {temp}°
        </Txt>
        <StepButton label="Naikkan suhu" icon="plus" disabled={temp >= MAX} onPress={() => step(1)} />
      </View>
      <Txt v="caption" color={c.muted}>
        Perintah terakhir: {temp}° {mode} · suhu ruangan sekarang {ROOM_TEMP}°
      </Txt>
    </ChatCard>
  );
}

function StepButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: 'minus' | 'plus';
  disabled: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      android_ripple={{ color: c.ripple, borderless: true, radius: 24 }}
      style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={24} color={disabled ? c.track : c.ink} />
    </Pressable>
  );
}
