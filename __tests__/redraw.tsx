import { act } from '@testing-library/react-native';
import { useEffect, useState, type ReactNode } from 'react';

let bump = () => {};

/** Menggambar ulang anaknya atas permintaan, karena `useIsFocused` tiruan tidak reaktif. Anak berupa fungsi supaya elemennya dibuat baru. */
export function Redraw({ children }: { children: () => ReactNode }) {
  const [, set] = useState(0);
  useEffect(() => {
    bump = () => set((n) => n + 1);
  }, []);
  return children();
}

export const redraw = () => act(async () => bump());
