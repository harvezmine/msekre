import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import type { DeviceKind } from '@/api/contract';
import { AC_MAX, AC_MIN } from '@/api/constants';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Toggle } from '../Toggle';
import { Txt } from '../Txt';
import { CardButton, ChatCard } from './ChatCard';

interface DeviceCardViewProps {
  name: string;
  on: boolean;
  /** Suhu yang diatur; kosong bila perangkat tidak punya pengatur suhu. */
  temp?: number;
  /** Baris keterangan di bawah nama, contoh "Nyala · Dingin". */
  status: string;
  footer?: string;
  /** Jenis perangkat, untuk ikon. */
  kind?: DeviceKind;
  /** Sakelar nyala-mati tampil. */
  switchable?: boolean;
  /** Dijaga: hanya keadaan dan "Buka di Perangkat" (`onOpen`). */
  guarded?: boolean;
  onToggle: (on: boolean) => void;
  onTemp: (temp: number) => void;
  onOpen?: () => void;
}

const KIND_ICON: Partial<Record<DeviceKind, IconName>> = {
  ac: 'snow',
  lamp: 'bulb',
  lock: 'lock',
  camera: 'camera',
  plug: 'bolt',
  tv: 'box',
};

/** Tampilan kartu perangkat dari data kontrak; aksinya dikerjakan pemanggil (`POST /home/devices/:id`). */
export function DeviceCardView({
  name,
  on,
  temp,
  status,
  footer,
  kind = 'ac',
  switchable = true,
  guarded = false,
  onToggle,
  onTemp,
  onOpen,
}: DeviceCardViewProps) {
  const { c } = useTheme();
  const step = (d: number) => {
    if (temp === undefined || temp + d < AC_MIN || temp + d > AC_MAX) return;
    void Haptics.selectionAsync();
    onTemp(temp + d);
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
          <Icon
            name={guarded && kind !== 'lock' && kind !== 'camera' ? 'shield' : (KIND_ICON[kind] ?? 'home')}
            size={22}
            color={c.green}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight={600}>{name}</Txt>
          <Txt v="caption" color={c.muted}>
            {status}
          </Txt>
        </View>
        {switchable && !guarded ? <Toggle label={name} value={on} onChange={onToggle} /> : null}
      </View>
      {temp !== undefined && !guarded && (
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Suhu ${name}`}
          accessibilityValue={{ text: `${temp} derajat` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment') step(1);
            else if (e.nativeEvent.actionName === 'decrement') step(-1);
          }}
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
      )}
      {footer ? (
        <Txt v="caption" color={c.muted}>
          {footer}
        </Txt>
      ) : null}
      {guarded && onOpen ? <CardButton label="Buka di Perangkat" onPress={onOpen} /> : null}
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
