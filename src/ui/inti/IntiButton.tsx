import { router } from 'expo-router';
import { useRef } from 'react';
import { View, type GestureResponderEvent, type ViewInstance } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useAssistantName } from '@/api/useProfile';
import { reportError } from '@/crash';
import { motion } from '@/theme/tokens';
import { haptic } from '../kit/haptics';
import { PressableScale } from '../kit/PressableScale';
import { useToast } from '../toastStore';
import { dismissTip } from '../tips';
import { useVoiceAvailable, VOICE_SOON_TEXT } from '@/voice/available';
import { holdBridge, type HoldOrigin } from '@/voice/holdBridge';
import { inPlace } from '@/voice/inPlace';
import { IntiOrb } from './IntiOrb';

/** Jari boleh bergeser jauh selagi menahan: ucapan tidak terputus hanya karena jempol sedikit bergerak. */
const KEEP_HOLD = { top: 240, bottom: 240, left: 240, right: 240 };

export const INTI_HINT = 'Ketuk untuk chat, tahan untuk bicara';

/** Titik jari dari peristiwa sentuhan (koordinat halaman), bila ada. */
function fingerOf(e: GestureResponderEvent | undefined): { x: number; y: number } | null {
  const n = e?.nativeEvent;
  return n && Number.isFinite(n.pageX) && Number.isFinite(n.pageY) ? { x: n.pageX, y: n.pageY } : null;
}

/**
 * Inti yang bisa disentuh (di tengah bilah tab, dan besar di atas Beranda):
 * - ketuk: chat;
 * - tahan, `hold="screen"` (bilah tab): Mode Suara terbuka dan langsung mendengar selagi jari masih menempel; diangkat:
 *   ucapan dikirim (`src/voice/holdBridge.ts`). Tempat Inti diukur saat disentuh, jadi Mode Suara memunculkan Inti-nya
 *   tepat di bawah jari;
 * - tahan, `hold="inPlace"` (Inti besar Beranda): tidak pindah layar; Beranda mendengar di tempat
 *   (`src/voice/inPlace.ts`, `InPlaceVoice`). Geser menjauh untuk batal.
 * Getar saat tahanan dimulai. Pembaca layar: label nama asisten, aksi "Chat" dan "Bicara" (Bicara selalu membuka Mode
 * Suara layar penuh, yang tidak perlu ditahan). Sentuhan apa pun menutup petunjuk Inti.
 */
export function IntiButton({
  size,
  halo = false,
  paused = false,
  glowScale,
  testID = 'inti',
  hold = 'screen',
  level,
  thinking = false,
}: {
  size: number;
  halo?: boolean;
  paused?: boolean;
  /** Lebar cahaya sebagai kelipatan ukuran (lihat `IntiOrb`). */
  glowScale?: number;
  testID?: string;
  hold?: 'screen' | 'inPlace';
  /** Cahaya mengikuti suara (Mode Suara di tempat). */
  level?: SharedValue<number>;
  /** Cincin berpikir (Mode Suara di tempat). */
  thinking?: boolean;
}) {
  const name = useAssistantName();
  const voice = useVoiceAvailable();
  const toast = useToast();
  const box = useRef<ViewInstance>(null);
  /** Pusat Inti di jendela, diukur setiap kali disentuh (tahan = 300 ms kemudian, jadi hasilnya sudah ada). */
  const measured = useRef<HoldOrigin | null>(null);

  const measure = () => {
    measured.current = null;
    try {
      box.current?.measureInWindow((x, y, w, h) => {
        if ([x, y, w, h].every(Number.isFinite) && w > 0) measured.current = { x: x + w / 2, y: y + h / 2, size: w };
      });
    } catch {
      // Tanpa ukuran: titik jari yang dipakai.
    }
  };

  const chat = () => {
    dismissTip('inti');
    router.navigate('/chat');
  };
  // Dipanggil dari penangan sentuhan: kesalahan di sini menutup paksa aplikasi di build rilis, jadi dijaga. Getar
  // (`haptic`) sudah aman sendiri; gagal membuka Mode Suara = tahanan dilupakan dan Inti tetap bisa dipakai.
  const talk = (held: boolean, e?: GestureResponderEvent) => {
    dismissTip('inti');
    if (!voice) {
      toast(VOICE_SOON_TEXT);
      return;
    }
    try {
      if (!held) {
        router.navigate('/suara');
        return;
      }
      haptic('medium');
      const finger = fingerOf(e);
      if (hold === 'inPlace') {
        inPlace.begin({ finger, anchor: measured.current });
        return;
      }
      holdBridge.begin(measured.current ?? (finger ? { ...finger, size } : null));
      router.navigate({ pathname: '/suara', params: { hold: '1' } });
    } catch (err) {
      holdBridge.cancel();
      inPlace.close();
      reportError('Inti: buka Mode Suara', err);
    }
  };

  const release = () => {
    if (hold === 'inPlace') inPlace.release();
    else holdBridge.release();
  };

  return (
    <View
      ref={box}
      collapsable={false}
      // Peristiwa sentuhan naik dari Pressable di dalamnya: geser untuk batal (hanya Inti besar Beranda).
      onTouchMove={
        hold === 'inPlace'
          ? (e) => {
              try {
                inPlace.move(e.nativeEvent.pageX, e.nativeEvent.pageY);
              } catch (err) {
                reportError('Inti: geser', err);
              }
            }
          : undefined
      }
      style={{ width: size, height: size }}
    >
      <PressableScale
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityHint={INTI_HINT}
        accessibilityActions={[
          { name: 'activate', label: 'Chat' },
          { name: 'longpress', label: 'Bicara' },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'longpress') talk(false);
          else if (e.nativeEvent.actionName === 'activate') chat();
        }}
        onPressIn={measure}
        onPress={chat}
        onLongPress={(e) => talk(true, e)}
        onPressOut={release}
        delayLongPress={motion.longPress}
        pressRetentionOffset={KEEP_HOLD}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      >
        <IntiOrb size={size} halo={halo} paused={paused} glowScale={glowScale} level={level} thinking={thinking} />
      </PressableScale>
    </View>
  );
}
