import { useState, type ReactNode } from 'react';
import { Modal, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Sheet, useSheet } from '../Sheet';
import { Txt } from '../Txt';
import { AccentIcon, type AccentTone } from './AccentIcon';
import { PressableScale } from './PressableScale';

/** Satu kontrol kedua di "Lainnya": ikon + satu kata + kontrol (segmen, sakelar) atau chip nilai. */
export interface MoreItem {
  icon: IconName;
  /** Satu kata, contoh "Timer". */
  label: string;
  tone?: AccentTone;
  /** Kontrol di kanan (Segmented, Toggle). Baris dengan kontrol tidak menutup lembar. */
  control?: ReactNode;
  /** Chip nilai di kanan (contoh "22.00"), ditekan untuk mengubah. */
  value?: string;
  /** Aksi baris/chip; lembar menutup dulu, lalu aksi dijalankan. */
  onPress?: () => void;
}

/**
 * Pola "Lainnya" (§0.5, §7): layar hanya menampilkan 3–5 kontrol besar; sisanya di sini. Pemicunya kapsul `sunken` 44
 * tinggi "⋯ Lainnya" di kepala layar (area sentuh 48); isinya lembar bawah dengan baris 72 tinggi.
 */
export function MoreSheet({
  items,
  label = 'Lainnya',
  style,
}: {
  items: readonly MoreItem[];
  /** Tulisan tombol pemicu (juga nama untuk pembaca layar). */
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        haptic="light"
        hitSlop={{ top: 2, bottom: 2 }}
        style={[
          {
            height: 44,
            borderRadius: 22,
            paddingLeft: 14,
            paddingRight: 18,
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
            backgroundColor: c.sunken,
          },
          style,
        ]}
      >
        <Icon name="more" size={22} color={c.text} />
        <Txt v="label">{label}</Txt>
      </PressableScale>
      <Modal transparent visible={open} animationType="none" onRequestClose={() => setOpen(false)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          {open ? (
            <Sheet onClose={() => setOpen(false)} testID="lembar-lainnya">
              <MoreList title={label} items={items} />
            </Sheet>
          ) : null}
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

function MoreList({ title, items }: { title: string; items: readonly MoreItem[] }) {
  const { c } = useTheme();
  const { close } = useSheet();
  return (
    <View accessibilityLabel={title}>
      {items.map((it) => {
        const run = it.onPress ? () => close(it.onPress) : undefined;
        const right = it.control ? (
          it.control
        ) : it.value !== undefined ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${it.label}, ${it.value}`}
            onPress={run}
            android_ripple={{ color: c.ripple }}
            style={{
              height: 44,
              borderRadius: 22,
              paddingLeft: 16,
              paddingRight: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: c.sunken,
            }}
          >
            <Txt v="body" weight={600} tabular>
              {it.value}
            </Txt>
            <Icon name="chevR" size={18} color={c.muted} />
          </Pressable>
        ) : null;
        const row = (
          <>
            <AccentIcon icon={it.icon} tone={it.tone ?? 'neutral'} size={44} />
            <Txt v="row" style={{ flex: 1 }}>
              {it.label}
            </Txt>
            {right}
          </>
        );
        const rowStyle: ViewStyle = { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 16 };
        // Baris tanpa kontrol dan tanpa chip: seluruh baris yang ditekan.
        return !it.control && it.value === undefined && run ? (
          <Pressable
            key={it.label}
            accessibilityRole="button"
            accessibilityLabel={it.label}
            onPress={run}
            android_ripple={{ color: c.ripple }}
            style={rowStyle}
          >
            {row}
          </Pressable>
        ) : (
          <View key={it.label} style={rowStyle}>
            {row}
          </View>
        );
      })}
    </View>
  );
}
