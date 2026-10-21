import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Modal } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useApi } from '@/api/ApiProvider';
import type { IconName } from '../icons';
import { ListRow } from '../kit';
import { Sheet, useSheet } from '../Sheet';
import { Txt } from '../Txt';

interface Item {
  icon: IconName;
  title: string;
  value?: string;
  route: Href;
}

/** Isi lembar Coba: tiap baris menutup lembar dulu, lalu membuka layarnya. */
function Items({ items }: { items: Item[] }) {
  const { close } = useSheet();
  return (
    <>
      <Txt v="section" accessibilityRole="header" style={{ marginBottom: 4 }}>
        Coba
      </Txt>
      {items.map((it) => (
        <ListRow
          key={it.title}
          icon={it.icon}
          title={it.title}
          value={it.value}
          chevron
          inset={0}
          onPress={() => close(() => router.push(it.route))}
        />
      ))}
    </>
  );
}

/**
 * Satu baris "Coba" paling bawah di Akun, hanya di mode contoh (APK pratinjau) dan build pengembangan. Jalan pintas ke
 * layar uji (layar pertama kali, alarm; pengembangan: mode data, pemeriksa Inti, katalog komponen) ada di lembarnya,
 * supaya tidak memenuhi daftar utama.
 */
export function TryRow() {
  const { mode } = useApi();
  const [open, setOpen] = useState(false);
  const demo = mode === 'contoh';
  if (!demo && !__DEV__) return null;
  const items: Item[] = [
    { icon: 'auto', title: 'Layar pertama kali', route: '/mulai' },
    { icon: 'clock', title: 'Alarm', route: '/alarm' },
    ...(__DEV__
      ? ([
          { icon: 'globe', title: 'Mode data', value: mode === 'server' ? 'Server' : 'Contoh', route: '/mode' },
          { icon: 'info', title: 'Pemeriksa Inti', route: '/inti' },
          { icon: 'palette', title: 'Komponen', route: '/dev/kit' },
        ] satisfies Item[])
      : []),
  ];
  return (
    <>
      <ListRow icon="sparkle" title="Coba" onPress={() => setOpen(true)} />
      <Modal transparent visible={open} animationType="none" onRequestClose={() => setOpen(false)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          {open ? (
            <Sheet onClose={() => setOpen(false)} testID="lembar-coba">
              <Items items={items} />
            </Sheet>
          ) : null}
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}
