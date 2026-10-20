import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useApi } from './ApiProvider';
import { useAuth } from './useAuth';

/**
 * Setelah masuk di mode server, buka pilihan minat (`/mulai/pilih`). Dipasang di akar, di luar layar masuk: begitu
 * sesi ada, penjaga rute (`Stack.Protected`) menutup layar sapaan dan masuk, dan baru sesudah itu layar pilih dibuka.
 * Kalau layar masuk sendiri yang membuka layar pilih persis saat status berubah, penjaga masih memakai nilai lama dan
 * mengalihkannya. Mode contoh tidak punya penjaga; layar masuk membukanya sendiri.
 */
export function AfterSignIn() {
  const { mode } = useApi();
  const { status } = useAuth();
  const before = useRef(status);
  useEffect(() => {
    const was = before.current;
    before.current = status;
    if (mode === 'server' && was === 'signedOut' && status === 'signedIn') router.push('/mulai/pilih');
  }, [mode, status]);
  return null;
}
