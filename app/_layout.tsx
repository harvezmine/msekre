import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from '@expo-google-fonts/plus-jakarta-sans/useFonts';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AfterSignIn } from '@/api/AfterSignIn';
import { AccountProvider } from '@/api/AccountProvider';
import { AgendaProvider } from '@/api/AgendaProvider';
import { ApiProvider, useApi } from '@/api/ApiProvider';
import { ChatProvider } from '@/api/ChatProvider';
import { BusinessProvider } from '@/api/BusinessProvider';
import { ConnectionsProvider } from '@/api/ConnectionsProvider';
import { DevicesProvider } from '@/api/DevicesProvider';
import { HistoryProvider } from '@/api/HistoryProvider';
import { HomeProvider } from '@/api/HomeProvider';
import { canOpen } from '@/api/routeAccess';
import { PushProvider, PushTapHandler } from '@/api/usePush';
import { AlarmSyncHost } from '@/alarm/useAlarmSync';
import { AuthProvider, useAuth } from '@/api/useAuth';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { useLaunchSplash } from '@/ui/LaunchSplash';
import { SplashShell } from '@/ui/SplashShell';
import { ToastProvider } from '@/ui/toastStore';

// Tautan langsung ke /chat, /suara, /inti tetap punya tab di bawahnya.
export const unstable_settings = { anchor: '(tabs)' };

SplashScreen.preventAutoHideAsync();
/** Batas paling lama layar pembuka menunggu pemeriksaan sesi. */
const SPLASH_MAX_MS = 6000;

function Navigator() {
  const { c, scheme } = useTheme();
  const { mode } = useApi();
  const { status } = useAuth();
  // Mode server: layar aplikasi hanya setelah masuk, layar masuk hanya sebelumnya (src/api/routeAccess.ts). Penjaga
  // menutup layar yang tidak lagi boleh dibuka, juga dari sesi yang dicabut server, dan membuang riwayatnya.
  const app = canOpen('app', mode, status);
  const entry = canOpen('entry', mode, status);
  // Layar pembuka asli menunggu sampai sesi tersimpan selesai diperiksa; setelah itu tidak ada bingkai kertas kosong.
  const ready = mode === 'contoh' || status !== 'checking';
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.paper);
  }, [c.paper]);
  // Layar pembuka animasi (di atas semuanya) sudah terpasang sebelum yang asli disembunyikan; geraknya mulai sesudahnya.
  const splash = useLaunchSplash();
  const { onNativeHidden } = splash;
  const hide = ready && splash.resolved;
  useEffect(() => {
    const done = () => onNativeHidden();
    if (hide) {
      SplashScreen.hideAsync().then(done, done);
      return;
    }
    // Pemeriksaan sesi macet (sinyal buruk): jangan menahan layar pembuka selamanya.
    const t = setTimeout(() => SplashScreen.hideAsync().then(done, done), SPLASH_MAX_MS);
    return () => clearTimeout(t);
  }, [hide, onNativeHidden]);
  return (
    <SplashShell ready={ready} paper={c.paper} splash={splash}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.paper } }}>
        <Stack.Protected guard={entry} redirectTo="/">
          <Stack.Screen name="mulai/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="mulai/masuk" options={{ animation: 'slide_from_right' }} />
        </Stack.Protected>
        <Stack.Protected guard={app} redirectTo="/mulai">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chat" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="suara" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="inti" />
          <Stack.Screen
            name="agenda/tambah"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen name="perangkat/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="perangkat/tambah" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="pin"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen
            name="buka-kunci"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen name="akun" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="akun/keamanan" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="akun/asisten" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="akun/sapaan" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="akun/notifikasi" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="akun/hp" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="akun/privasi" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="akun/konfirmasi"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen name="riwayat" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="mulai/pilih" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="keluar"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen name="terhubung/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="terhubung/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="terhubung/masuk"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen
            name="terhubung/konfirmasi"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen name="terhubung/tersambung" options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen
            name="izin-notifikasi"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen
            name="izin-alarm"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen
            name="tempat"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
        </Stack.Protected>
        {/* Alarm yang berbunyi harus selalu bisa dimatikan, juga tanpa sesi (sesi habis, atau belum selesai diperiksa). */}
        <Stack.Screen name="alarm" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen
          name="mode"
          options={{
            presentation: 'transparentModal',
            animation: 'none',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </Stack>
      <AfterSignIn />
      <AlarmSyncHost />
      <PushTapHandler />
    </SplashShell>
  );
}

// Layar pembuka asli bertahan sampai huruf, mode data tersimpan (ApiProvider), dan pemeriksaan sesi selesai; Navigator
// yang menutupnya (di atas), karena hanya ia yang tahu semuanya sudah siap.
export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  if (!loaded && !error) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ToastProvider>
          <ApiProvider>
            <AuthProvider>
              <ChatProvider>
                <HomeProvider>
                  <AgendaProvider>
                    <DevicesProvider>
                      <BusinessProvider>
                        <ConnectionsProvider>
                          <HistoryProvider>
                            <AccountProvider>
                              <PushProvider>
                                <Navigator />
                              </PushProvider>
                            </AccountProvider>
                          </HistoryProvider>
                        </ConnectionsProvider>
                      </BusinessProvider>
                    </DevicesProvider>
                  </AgendaProvider>
                </HomeProvider>
              </ChatProvider>
            </AuthProvider>
          </ApiProvider>
        </ToastProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
