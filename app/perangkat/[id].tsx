// Remote virtual satu perangkat: niatnya mengatur perangkat ini dengan satu sentuhan; tata letaknya (AC, TV, speaker,
// lampu, ...) dipilih menurut jenis dan kemampuannya, kontrol utama di zona jempol, sisanya di Lainnya.
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useDeviceControl } from '@/api/useDeviceControl';
import { useHome } from '@/api/useHome';
import { useTheme } from '@/theme/ThemeProvider';
import { BackHeader } from '@/ui/BackHeader';
import { REMOTES, RemoteContext, remoteKindOf, type RemoteApi } from '@/ui/remote';
import { useToast } from '@/ui/toastStore';
import { Txt } from '@/ui/Txt';

export default function RemotePerangkat() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const toast = useToast();
  const { home } = useHome();
  const devices = useDeviceControl(home?.place);
  const device = devices.find(typeof id === 'string' ? id : '');

  if (!device) {
    // Belum selesai dimuat: tunggu dulu, jangan langsung bilang tidak ada.
    if (!devices.data) {
      return (
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <BackHeader title="Perangkat" />
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <BackHeader title="Perangkat" />
        <View style={{ padding: 24, gap: 16, alignItems: 'flex-start' }}>
          <Txt>Perangkat ini tidak ditemukan. Mungkin sudah dihapus dari tempat ini.</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali ke Perangkat"
            onPress={() => router.back()}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Txt weight={600} color={c.brandInk}>
              Kembali ke Perangkat
            </Txt>
          </Pressable>
        </View>
      </View>
    );
  }

  const api: RemoteApi = {
    device,
    control: (req) => devices.control(device.id, req),
    adjust: (req) => devices.adjust(device.id, req),
    setFavorite: (favorite) =>
      void devices.setFavorite(device.id, favorite).then((failed) => {
        if (failed) toast(failed);
      }),
    retry: () => void devices.retry(),
    mediaUrl: devices.mediaUrl,
    box: devices.box,
    setBoxMic: (on) =>
      void devices.setBoxMic(on).then((failed) => {
        if (failed) toast(failed);
      }),
  };
  const Remote = REMOTES[remoteKindOf(device)];
  return (
    <RemoteContext value={api}>
      <Remote />
    </RemoteContext>
  );
}
