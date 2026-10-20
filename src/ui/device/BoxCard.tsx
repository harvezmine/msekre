import { Pressable, View } from 'react-native';
import { BOX } from '@/sample/devices';
import { useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { onForest } from '@/theme/tokens';
import { Card } from '../Card';
import { Icon } from '../Icon';
import { Txt } from '../Txt';

/** Kartu Kotak Sekretaris AI di Ruang tamu (desain 2c): mic dengan Matikan/Nyalakan, speaker, suhu, kelembapan. */
export function BoxCard() {
  const { c } = useTheme();
  const { state, dispatch } = useSample();
  const mic = state.boxMic;
  return (
    <Card style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: '#0E3A2C',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="box" size={22} color={onForest.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="subtitle">Kotak Sekretaris AI</Txt>
          <Txt v="caption" color={c.green}>
            Online
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="title" tabular>
            {BOX.temp}°
          </Txt>
          <Txt v="caption" color={c.muted}>
            Suhu ruangan
          </Txt>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="title" tabular>
            {BOX.humidity}%
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
          <Txt v="caption" color={c.muted}>
            {mic ? 'Mendengar saat dipanggil "Nadia"' : 'Tidak mendengar sampai dinyalakan'}
          </Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mic ? 'Matikan' : 'Nyalakan'}
          onPress={() => dispatch({ type: 'setBoxMic', on: !mic })}
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
        <Txt weight={500}>{BOX.speaker}</Txt>
      </View>
    </Card>
  );
}
