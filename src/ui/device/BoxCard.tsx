import { Pressable, View } from 'react-native';
import type { Box } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { onForest } from '@/theme/tokens';
import { Card } from '../Card';
import { Icon } from '../Icon';
import { Txt } from '../Txt';

/** Kartu Kotak Sekretaris AI di Ruang tamu (desain 2c): mic dengan Matikan/Nyalakan, speaker, suhu, kelembapan. */
export function BoxCard({ box, onMic }: { box: Box; onMic: (on: boolean) => void }) {
  const { c } = useTheme();
  const mic = box.micOn;
  return (
    <Card style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: c.forestTile,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="box" size={22} color={onForest.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="subtitle">Kotak Sekretaris AI</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              testID="titik-online"
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: box.online ? c.green : c.clay }}
            />
            <Txt v="caption" color={box.online ? c.green : c.clay}>
              {box.online ? 'Online' : 'Tidak terjangkau'}
            </Txt>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="title" tabular>
            {box.roomTemp}°
          </Txt>
          <Txt v="caption" color={c.muted}>
            Suhu ruangan
          </Txt>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="title" tabular>
            {box.humidity}%
          </Txt>
          <Txt v="caption" color={c.muted}>
            Kelembapan
          </Txt>
        </View>
      </View>
      <View
        style={{
          backgroundColor: c.mint,
          borderRadius: 16,
          paddingVertical: 12,
          paddingLeft: 16,
          paddingRight: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Icon name={mic ? 'mic' : 'micOff'} size={24} color={mic ? c.green : c.muted} />
        <View style={{ flex: 1 }}>
          <Txt weight={600}>{mic ? 'Mic menyala' : 'Mic mati'}</Txt>
          <Txt v="caption" color={c.micSub}>
            {mic ? 'Mendengar saat dipanggil "Nadia"' : 'Tidak mendengar sampai dinyalakan'}
          </Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mic ? 'Matikan mic' : 'Nyalakan mic'}
          onPress={() => onMic(!mic)}
          android_ripple={{ color: c.ripple }}
          style={{
            height: 48,
            paddingHorizontal: 16,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: c.line,
            backgroundColor: c.card,
            justifyContent: 'center',
          }}
        >
          <Txt weight={600} style={{ fontSize: 15 }}>
            {mic ? 'Matikan' : 'Nyalakan'}
          </Txt>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt color={c.muted}>Speaker</Txt>
        <Txt weight={500}>{box.speaker}</Txt>
      </View>
    </Card>
  );
}
