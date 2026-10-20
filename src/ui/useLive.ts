import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// Hanya 'background' dan 'inactive' yang berarti tak terlihat; nilai belum diketahui dianggap aktif.
const isActive = (s: string | null | undefined) => s !== 'background' && s !== 'inactive';

/** Benar hanya saat layar ini terlihat (fokus) dan aplikasi aktif; dipakai untuk menghentikan animasi demi baterai. */
export function useLive(): boolean {
  const focused = useIsFocused();
  const [active, setActive] = useState(isActive(AppState.currentState));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(isActive(s)));
    return () => sub.remove();
  }, []);
  return focused && active;
}
