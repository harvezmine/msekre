import { Pressable, View } from 'react-native';
import type { Part } from '@/api/contract';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import { Txt } from '../Txt';
import { ChatCard } from './ChatCard';

type AudioPart = Extract<Part, { type: 'audio' }>;

/** Pesan suara: baris sederhana dengan tulisannya (transkrip). Pemutar suara dibangun di Fase 6. */
export function AudioRow({ audio, onPlay }: { audio: AudioPart; onPlay: () => void }) {
  const { c } = useTheme();
  return (
    <ChatCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Putar pesan suara"
          onPress={onPlay}
          android_ripple={{ color: c.ripple, borderless: true }}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: c.mint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="wave" size={24} color={c.green} />
        </Pressable>
        <Txt weight={600} style={{ flex: 1 }}>
          Pesan suara
        </Txt>
      </View>
      {audio.transcript ? <Txt color={c.muted}>{audio.transcript}</Txt> : null}
    </ChatCard>
  );
}
