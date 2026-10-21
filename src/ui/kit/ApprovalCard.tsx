import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { PressableScale } from './PressableScale';
import { Surface } from './Surface';

/**
 * Kartu persetujuan (§8 `ApprovalCard`): inisial penerima, nama, cuplikan satu baris, lalu Ubah dan Kirim (56 dp; Kirim
 * hijau dan 1,4 kali lebih lebar). Tidak ada yang terkirim sebelum Kirim diketuk.
 */
export function ApprovalCard({
  name,
  initial,
  preview,
  busy = false,
  compact = false,
  onEdit,
  onSend,
}: {
  name: string;
  initial: string;
  preview: string;
  busy?: boolean;
  compact?: boolean;
  onEdit: () => void;
  onSend: () => void;
}) {
  const { c, marker } = useTheme();
  return (
    <Surface variant="raised" padding={compact ? 14 : 18}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: c.sunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt weight={600} color={marker.terhubung.ink} style={{ fontSize: 18, lineHeight: 22 }}>
            {initial}
          </Txt>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="row" weight={600} numberOfLines={1}>
            {name}
          </Txt>
          <Txt numberOfLines={1} color={c.muted} style={{ fontSize: 15, lineHeight: 21 }}>
            {preview}
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: compact ? 12 : 16 }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Ubah pesan untuk ${name}`}
          disabled={busy}
          haptic="light"
          onPress={onEdit}
          style={{
            flex: 1,
            minHeight: 56,
            borderRadius: 28,
            backgroundColor: c.sunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt weight={600}>Ubah</Txt>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Kirim ke ${name}`}
          disabled={busy}
          haptic="success"
          onPress={onSend}
          style={{
            flex: 1.4,
            minHeight: 56,
            borderRadius: 28,
            backgroundColor: c.brand,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Txt weight={600} color={c.onBrand}>
            Kirim
          </Txt>
          <Icon name="send" size={20} color={c.onBrand} />
        </PressableScale>
      </View>
    </Surface>
  );
}
