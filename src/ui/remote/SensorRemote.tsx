// Sensor: satu niat, membaca keadaan ruangan; bacaan besar berurutan dan baterai kecil di bawah. Tidak ada yang diatur.
import { View } from 'react-native';
import { deviceStateOf } from '@/api/devices';
import { useTheme } from '@/theme/ThemeProvider';
import { BigNumber } from '../kit/BigNumber';
import { byLayout } from '../kit/layout';
import { Txt } from '../Txt';
import { decimal, unitText } from '../device/present';
import { capOf } from './caps';
import { SmallReading, useRemoteSizes } from './parts';
import { RemoteFrame } from './RemoteFrame';
import { useRemote } from './RemoteContext';

export function SensorRemote() {
  const { c } = useTheme();
  const { device } = useRemote();
  const sizes = useRemoteSizes();
  const s = deviceStateOf(device);
  const sensor = capOf(device, 'sensor');
  const battery = capOf(device, 'battery');
  const readings: { label: string; value: number; unit: string }[] = sensor
    ? sensor.readings.flatMap((r) => {
        const v = s.readings?.[r.id];
        return v === undefined ? [] : [{ label: r.label, value: v, unit: unitText(r.unit).trim() }];
      })
    : [
        ...(s.roomTemp !== undefined ? [{ label: 'Suhu', value: s.roomTemp, unit: '°' }] : []),
        ...(s.humidity !== undefined ? [{ label: 'Kelembapan', value: s.humidity, unit: '%' }] : []),
      ];

  const top = (
    <View
      style={{
        paddingHorizontal: 28,
        paddingTop: sizes.lead + 24,
        gap: byLayout(sizes.cls, { compact: 16, regular: 28, tall: 36 }),
      }}
    >
      {readings.length === 0 ? (
        <Txt v="headline" color={c.muted}>
          {device.status}
        </Txt>
      ) : (
        readings.map((r, i) => (
          <View key={r.label} testID={`bacaan-${i}`}>
            <BigNumber
              value={decimal(r.value)}
              unit={r.unit || undefined}
              size={i === 0 ? byLayout(sizes.cls, { compact: 72, regular: 88, tall: 96 }) : 56}
              accessibilityLabel={`${r.label} ${decimal(r.value)}${r.unit === '°' ? ' derajat' : r.unit}`}
            />
            <Txt v="label" color={c.muted}>
              {r.label}
            </Txt>
          </View>
        ))
      )}
    </View>
  );

  const bottom =
    battery && s.battery !== undefined ? <SmallReading icon="battery" text={`${s.battery}%`} label="Baterai" /> : null;

  return <RemoteFrame top={top} bottom={bottom} favorite={false} />;
}
