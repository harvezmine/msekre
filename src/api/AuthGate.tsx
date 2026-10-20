import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useApi } from './ApiProvider';
import { useAuth } from './useAuth';

/** Layar yang boleh dibuka tanpa sesi: sapaan dan masuk. `/mulai/pilih` baru terbuka setelah kode cocok. */
const OPEN_WITHOUT_SESSION = new Set(['/mulai', '/mulai/masuk']);

/**
 * Gerbang masuk, hanya di mode `server` (mode `contoh` tidak memaksa masuk, seperti 0b):
 * - selama sesi diperiksa: menutupi layar dengan kertas polos, supaya isi aplikasi tidak sempat terlihat;
 * - tanpa sesi: membuka `/mulai` dengan tumpukan bersih.
 * Dipasang sesudah navigator di akar aplikasi.
 */
export function AuthGate() {
  const { mode } = useApi();
  const { status } = useAuth();
  const { c } = useTheme();
  const pathname = usePathname();
  const redirect = mode === 'server' && status === 'signedOut' && !OPEN_WITHOUT_SESSION.has(pathname);

  useEffect(() => {
    if (!redirect) return;
    router.dismissTo('/');
    router.replace('/mulai');
  }, [redirect]);

  if (mode === 'server' && (status === 'checking' || redirect)) {
    return (
      <View
        pointerEvents="auto"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.paper }}
      />
    );
  }
  return null;
}
