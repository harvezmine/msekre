import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import { AC_MAX, AC_MIN, deviceById, useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Toggle } from '../Toggle';
import { Txt } from '../Txt';
import { ChatCard } from './ChatCard';

/** Kartu AC di chat: sakelar yang sama dengan Beranda dan pengatur suhu 16–30, untuk perangkat `deviceId`. */
export function DeviceCard({ deviceId }: { deviceId: string }) {
  const { c } = useTheme();
  const { state, dispatch } = useSample();
  const device = deviceById(state, deviceId);
  if (!device?.ac) return null;
  const { name, on, roomTemp } = device;
  const { temp, mode } = device.ac;
  const step = (d: number) => {
    if (temp + d < AC_MIN || temp + d > AC_MAX) return;
    void Haptics.selectionAsync();
    dispatch({ type: 'setAc', deviceId, temp: temp + d, source: 'chat' });
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
        <Toggle
          label={name}
          value={on}
          onChange={(next) => dispatch({ type: 'setAc', deviceId, on: next, source: 'chat' })}
        />
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
        <StepButton label="Turunkan suhu" icon="minus" disabled={temp <= AC_MIN} onPress={() => step(-1)} />
        <Txt style={{ fontSize: 28, lineHeight: 36 }} weight={600} tabular>
          {temp}°
        </Txt>
        <StepButton label="Naikkan suhu" icon="plus" disabled={temp >= AC_MAX} onPress={() => step(1)} />
      </View>
      <Txt v="caption" color={c.muted}>
        Perintah terakhir: {temp}° {mode}
        {roomTemp !== undefined ? ` · suhu ruangan sekarang ${roomTemp}°` : ''}
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
