import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { dark, motion, onVoice } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { PressableScale } from '@/ui/kit';
import { Txt } from '@/ui/Txt';

/** Lembar izin mikrofon: tenang dan singkat. Penjelasan dulu, lalu pengaturan HP kalau sudah ditolak. */
export function PermissionPanel({
  blocked,
  waiting,
  bottom,
  onAllow,
  onSettings,
  onClose,
}: {
  blocked: boolean;
  waiting: boolean;
  bottom: number;
  onAllow: () => void;
  onSettings: () => void;
  onClose: () => void;
}) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' }}>
      <Pressable
        importantForAccessibility="no"
        accessibilityElementsHidden
        onPress={onClose}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: dark.scrim }}
      />
      <Animated.View
        testID="suara-izin"
        accessibilityViewIsModal
        entering={FadeIn.duration(motion.sheet.scrim)}
        style={{
          paddingHorizontal: 24,
          paddingTop: 28,
          paddingBottom: bottom + 24,
          gap: 8,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          backgroundColor: dark.surface,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            marginBottom: 12,
            backgroundColor: dark.brandSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={blocked ? 'micOff' : 'mic'} size={26} color={dark.brandInk} />
        </View>
        <Txt v="header" color={onVoice.text} accessibilityRole="header">
          {waiting ? 'Menunggu mikrofon dinyalakan' : blocked ? 'Mikrofon sedang dimatikan' : 'Izinkan mikrofon ya'}
        </Txt>
        <Txt color={onVoice.soft}>
          {waiting
            ? 'Nyalakan di pengaturan HP, lalu kembali ke sini.'
            : blocked
              ? 'Nyalakan di pengaturan HP.'
              : 'Saya hanya mendengar saat Inti ditahan.'}
        </Txt>
        <View style={{ gap: 4, paddingTop: 20 }}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={blocked ? 'Buka pengaturan' : 'Izinkan'}
            onPress={blocked ? onSettings : onAllow}
            style={{
              minHeight: 56,
              borderRadius: 28,
              backgroundColor: dark.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt weight={600} color={dark.onBrand} style={{ fontSize: 17 }}>
              {blocked ? 'Buka pengaturan' : 'Izinkan'}
            </Txt>
          </PressableScale>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nanti saja"
            onPress={onClose}
            style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Txt weight={600} color={onVoice.label}>
              Nanti saja
            </Txt>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
