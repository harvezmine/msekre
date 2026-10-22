// Akun: siapa saya dan paket saya, lalu beberapa pengaturan yang mudah dipahami (paling banyak enam baris; tujuh di mode
// contoh bila baris Data ada). Mode akun: hanya yang sudah asli (profil, paket, nama asisten) dan pengaturan di HP ini;
// baris yang isinya masih contoh (Pemberitahuan, Keamanan, Layanan tersambung) disembunyikan.
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '@/api/ApiProvider';
import { useDataMode } from '@/api/dataMode';
import { ACCOUNT_TZ_MINUTES, HELP_TEXT, openWhatsApp, RENEW_TEXT, WA_UNAVAILABLE_TEXT } from '@/api/account';
import { formatPhoneDisplay } from '@/api/format';
import { useAccount } from '@/api/useAccount';
import { useAgenda } from '@/api/useAgenda';
import { useConnections } from '@/api/useConnections';
import { useProfile, type Profile } from '@/api/useProfile';
import { useSecurity } from '@/api/useSecurity';
import { versionText } from '@/api/version';
import { APPEARANCE_LABEL, APPEARANCE_PREFERENCES, useAppearance } from '@/theme/appearance';
import { useTheme } from '@/theme/ThemeProvider';
import { useNotifications } from '@/ui/akun/notifications';
import { DataRow } from '@/ui/akun/DataRow';
import { ProfileCard } from '@/ui/akun/ProfileCard';
import { TryRow } from '@/ui/akun/TryRow';
import { BackHeader } from '@/ui/BackHeader';
import { LogoDock } from '@/ui/connect/ServiceCard';
import { Icon } from '@/ui/Icon';
import { ListRow, Segmented } from '@/ui/kit';
import { Txt } from '@/ui/Txt';
import { useToast } from '@/ui/toastStore';

const ICON = 46;

/** Nama di kartu profil. Mode contoh memakai isian desain; mode akun dan server nama asli, nomor bila belum ada nama. */
function nameOf(p: Profile): string {
  if (p.sample) return 'Rina Wulandari';
  if (p.name) return p.name;
  return p.phone ? formatPhoneDisplay(p.phone) : 'Akun Anda';
}

export default function Akun() {
  const { c, marker } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { mode, canUseServer } = useApi();
  const { hybrid } = useDataMode();
  const profile = useProfile();
  const { account, status, retry } = useAccount();
  const appearance = useAppearance();
  const security = useSecurity();
  const connections = useConnections();
  const notifications = useNotifications(account);
  // Hari terakhir paket dihitung di zona waktu pengguna (dari agenda bila sudah dimuat, bawaan WIB).
  const { tzOffsetMinutes } = useAgenda();
  const assistant = account?.assistant.name ?? profile.assistantName;
  const linked = connections.connected.length;
  const whatsApp = async (text: string) => {
    if (!(await openWhatsApp(text))) toast(WA_UNAVAILABLE_TEXT);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title="Akun" large />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <ProfileCard
          name={nameOf(profile)}
          plan={account?.plan ?? null}
          failed={!account && status === 'error'}
          tz={tzOffsetMinutes ?? ACCOUNT_TZ_MINUTES}
          onRenew={() => void whatsApp(RENEW_TEXT)}
          onRetry={() => void retry()}
        />

        <View style={{ marginTop: 16 }}>
          {/* Mode akun: nama asisten asli, belum bisa diubah dari aplikasi (halamannya masih contoh). */}
          <ListRow
            icon="chat"
            tone="brand"
            iconSize={ICON}
            title="Asisten"
            value={assistant}
            chevron={!hybrid}
            onPress={hybrid ? undefined : () => router.push('/akun/asisten')}
          />
          {hybrid ? null : (
            <ListRow
              icon="bell"
              tone="agenda"
              iconSize={ICON}
              title="Pemberitahuan"
              value={notifications.value}
              valueColor={notifications.value === 'Perlu izin' ? marker.warn.ink : undefined}
              chevron
              onPress={() => router.push('/akun/notifikasi')}
            />
          )}
          {/* Tampilan langsung di sini: tiga pilihan, berlaku seketika, tanpa halaman sendiri. */}
          <ListRow icon="moon" tone="usaha" iconSize={ICON} title="Tampilan">
            <Segmented
              options={APPEARANCE_PREFERENCES}
              labels={APPEARANCE_LABEL}
              value={appearance.preference}
              onChange={appearance.setPreference}
              label="Tampilan"
            />
          </ListRow>
          {hybrid ? null : (
            <ListRow
              icon="shield"
              tone="terhubung"
              iconSize={ICON}
              title="Keamanan"
              value={security.state ? (security.state.pinEnabled ? 'PIN' : 'Mati') : undefined}
              chevron
              onPress={() => router.push('/akun/keamanan')}
            />
          )}
          {/* Di bawah judul: tiga logo pertama yang tersambung (dok kecil); jumlahnya di kanan. */}
          {hybrid ? null : (
            <ListRow
              icon="link"
              tone="terhubung"
              iconSize={ICON}
              title="Layanan tersambung"
              value={linked > 0 ? String(linked) : undefined}
              detail={
                linked > 0 ? <LogoDock items={connections.connected} size={24} max={3} more={false} /> : undefined
              }
              chevron
              onPress={() => router.push('/terhubung')}
            />
          )}
          {/* Akun Anda atau Contoh; hanya bila alamat server diatur. */}
          <DataRow />
          {/* Bantuan: lapor kendala lewat WhatsApp Sekretaris AI; nomor belum diatur: kalimat ramah. */}
          <ListRow icon="help" iconSize={ICON} title="Bantuan" onPress={() => void whatsApp(HELP_TEXT)} />
        </View>

        <View style={{ alignItems: 'center', marginTop: 18 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Keluar"
            onPress={() => router.push('/keluar')}
            android_ripple={{ color: c.ripple, borderless: true }}
            style={{ height: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Icon name="logout" size={20} color={marker.warn.ink} />
            <Txt weight={600} color={marker.warn.ink} style={{ fontSize: 16, lineHeight: 20 }}>
              Keluar
            </Txt>
          </Pressable>
        </View>

        <View style={{ alignItems: 'center', gap: 2, marginTop: 20 }}>
          {/* APK pratinjau tanpa server: penanda kecil bahwa isinya data contoh (tidak di Beranda, supaya Beranda tetap
              tenang). Dengan server, baris Data yang menyebutnya. */}
          {mode === 'contoh' && !canUseServer ? (
            <Txt v="micro" color={c.muted}>
              Data contoh
            </Txt>
          ) : null}
          <Txt v="micro" color={c.muted}>
            {versionText()}
          </Txt>
        </View>

        {/* Mode contoh dan build pengembangan saja: jalan pintas ke layar uji, di satu baris paling bawah. */}
        <View style={{ marginTop: 12 }}>
          <TryRow />
        </View>
      </ScrollView>
    </View>
  );
}
