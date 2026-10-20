import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '@/api/ApiProvider';
import type { AgendaItem } from '@/api/contract';
import { useAgenda } from '@/api/useAgenda';
import { useAssistantName } from '@/api/useProfile';
import { ALARM_SAMPLE_ID } from '@/sample/agenda';
import { dayLabel } from '@/sample/dates';
import { useSampleDispatch } from '@/sample/store';
import { light, onForest } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { Inti } from '@/ui/inti/Inti';
import { SwipeToConfirm } from '@/ui/SwipeToConfirm';
import { Txt } from '@/ui/Txt';
import { useLive } from '@/ui/useLive';

const BUZZ_MS = 2000;

/** Berapa menit "Tunda" menunda alarm. */
export const SNOOZE_MINUTES = 10;

// Alarm layar penuh (desain 2l). Dibuka dari alarm di HP (`sekretarisai://alarm?id=`) atau dengan menahan sebuah
// pengingat di Agenda. Itemnya dimuat lewat kontrak; getarnya berpola dan berulang selama layar terbuka.
export default function Alarm() {
  const assistantName = useAssistantName();
  const insets = useSafeAreaInsets();
  const live = useLive();
  const toast = useSampleDispatch();
  const { mode } = useApi();
  const agenda = useAgenda();
  const { id: param } = useLocalSearchParams<{ id?: string }>();
  // Mode contoh tanpa id (dibuka dari menu uji): pengingat contoh. Mode server tanpa id: tidak ada yang dibunyikan.
  const id = param ?? (mode === 'contoh' ? ALARM_SAMPLE_ID : undefined);
  const [loaded, setLoaded] = useState<AgendaItem | null>(null);
  const item = agenda.items.find((a) => a.id === id) ?? (loaded?.id === id ? loaded : null);
  const { item: load } = agenda;
  useEffect(() => {
    if (!id || agenda.items.some((a) => a.id === id)) return;
    let stale = false;
    void load(id).then((found) => {
      if (!stale) setLoaded(found);
    });
    return () => {
      stale = true;
    };
  }, [id, load, agenda.items]);

  // Getar hanya selama layar ini terlihat dan aplikasi aktif; setelah pindah ke chat atau ke latar, berhenti.
  useEffect(() => {
    if (!live) return;
    const buzz = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    buzz();
    const t = setInterval(buzz, BUZZ_MS);
    return () => clearInterval(t);
  }, [live]);

  if (!item) return null;
  const isFlight = item.id === ALARM_SAMPLE_ID;

  const snooze = async () => {
    // Dari saat alarm ini berbunyi (atau jadwal tundaan sebelumnya), jadi menunda berkali-kali terus maju.
    const base = Date.parse(item.snoozedUntil ?? item.at);
    const failed = await agenda.snooze(item.id, new Date(base + SNOOZE_MINUTES * 60_000).toISOString());
    if (failed) return toast({ type: 'showToast', text: failed });
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: light.voice }}>
      <StatusBar style="light" />
      <View style={{ alignItems: 'center', paddingTop: insets.top + 56, paddingHorizontal: 28, gap: 8 }}>
        <Inti size={96} onDark paused={!live} />
        <View style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="bell" size={16} color={onForest.soft} />
          <Txt weight={600} color={onForest.soft} style={{ fontSize: 15, lineHeight: 20 }}>
            Pengingat · {dayLabel(item.date)}
          </Txt>
        </View>
        <Txt
          weight={600}
          tabular
          color={onForest.strong}
          maxFontSizeMultiplier={1.2}
          style={{ fontSize: 96, lineHeight: 104, letterSpacing: -2.9 }}
        >
          {item.time}
        </Txt>
        <Txt weight={600} color={onForest.strong} style={{ fontSize: 28, lineHeight: 36, textAlign: 'center' }}>
          {item.title}
        </Txt>
        {item.note ? (
          <View
            style={{
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: 'rgba(236,242,234,0.12)',
              backgroundColor: 'rgba(236,242,234,0.07)',
              paddingVertical: 14,
              paddingHorizontal: 18,
            }}
          >
            <Icon name={isFlight ? 'plane' : 'note'} size={22} color="#81C084" />
            <Txt color={onForest.text} style={{ flexShrink: 1, fontSize: 17 }}>
              {item.note}
            </Txt>
          </View>
        ) : null}
      </View>

      <View style={{ position: 'absolute', left: 20, right: 20, bottom: Math.max(40, insets.bottom + 16), gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <AlarmButton label={`Tunda ${SNOOZE_MINUTES} menit`} onPress={() => void snooze()} />
          <AlarmButton label={`Tanya ${assistantName}`} onPress={() => router.replace('/chat')}>
            <Inti size={24} onDark paused />
          </AlarmButton>
        </View>
        <SwipeToConfirm label="Geser untuk mematikan" actionLabel="Matikan" onConfirm={() => router.back()} />
      </View>
    </View>
  );
}

function AlarmButton({ label, onPress, children }: { label: string; onPress: () => void; children?: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: 'rgba(236,242,234,0.16)' }}
      style={{
        flex: 1,
        height: 56,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: onForest.buttonLine,
        backgroundColor: onForest.button,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {children}
      <Txt weight={600} color={onForest.text}>
        {label}
      </Txt>
    </Pressable>
  );
}
