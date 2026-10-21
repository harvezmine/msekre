import type { ReactNode } from 'react';
import { View } from 'react-native';
import { LaunchSplash, type SplashHost } from './LaunchSplash';
import { ToastHost } from './Toast';

/**
 * Susunan akar aplikasi. Layar pembuka animasi SELALU anak terakhir, di induk dan urutan yang sama, dengan kunci tetap, baik
 * saat sesi masih diperiksa (`ready` salah) maupun sesudahnya: berganti ke `ready` tidak memasang ulang dan tidak
 * memulai ulang gerakannya. Toast ada di urutan tetap pula dan tampil di atas layar pembuka.
 */
export function SplashShell({
  ready,
  paper,
  splash,
  children,
}: {
  ready: boolean;
  /** Warna latar saat menunggu. */
  paper: string;
  splash: SplashHost;
  /** Isi aplikasi, hanya dipasang saat `ready`. */
  children: ReactNode;
}) {
  return (
    <>
      {ready ? (
        <View
          key="app"
          style={{ flex: 1 }}
          importantForAccessibility={splash.visible ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={splash.visible}
        >
          {children}
        </View>
      ) : (
        <View key="boot" style={{ flex: 1, backgroundColor: paper }} />
      )}
      <ToastHost key="toast" />
      <LaunchSplash key="splash" state={splash} />
    </>
  );
}
