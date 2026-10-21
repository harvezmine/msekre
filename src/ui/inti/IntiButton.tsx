import { router } from 'expo-router';
import { useAssistantName } from '@/api/useProfile';
import { motion } from '@/theme/tokens';
import { haptic } from '../kit/haptics';
import { PressableScale } from '../kit/PressableScale';
import { useToast } from '../toastStore';
import { dismissTip } from '../tips';
import { useVoiceAvailable, VOICE_SOON_TEXT } from '@/voice/available';
import { holdBridge } from '@/voice/holdBridge';
import { IntiOrb } from './IntiOrb';

/** Jari boleh bergeser jauh selagi menahan: ucapan tidak terputus hanya karena jempol sedikit bergerak. */
const KEEP_HOLD = { top: 240, bottom: 240, left: 240, right: 240 };

export const INTI_HINT = 'Ketuk untuk chat, tahan untuk bicara';

/**
 * Inti yang bisa disentuh, di tengah bilah tab:
 * - ketuk: chat;
 * - tahan: Mode Suara terbuka dan langsung mendengar selagi jari masih menempel; diangkat: ucapan dikirim
 *   (`src/voice/holdBridge.ts`). Getar saat tahanan dimulai.
 * Pembaca layar: label nama asisten, aksi "Chat" dan "Bicara". Sentuhan apa pun menutup petunjuk Inti.
 */
export function IntiButton({ size, halo = false, paused = false }: { size: number; halo?: boolean; paused?: boolean }) {
  const name = useAssistantName();
  const voice = useVoiceAvailable();
  const toast = useToast();

  const chat = () => {
    dismissTip('inti');
    router.navigate('/chat');
  };
  const talk = (hold: boolean) => {
    dismissTip('inti');
    if (!voice) {
      toast(VOICE_SOON_TEXT);
      return;
    }
    if (hold) {
      haptic('medium');
      holdBridge.begin();
      router.navigate({ pathname: '/suara', params: { hold: '1' } });
    } else {
      router.navigate('/suara');
    }
  };

  return (
    <PressableScale
      testID="inti"
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
      onPress={chat}
      onLongPress={() => talk(true)}
      onPressOut={() => holdBridge.release()}
      delayLongPress={motion.longPress}
      pressRetentionOffset={KEEP_HOLD}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <IntiOrb size={size} halo={halo} paused={paused} />
    </PressableScale>
  );
}
