import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useApi } from '@/api/ApiProvider';
import type { DataMode } from '@/api/mode';
import { useSample } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/ui/Icon';
import { Sheet, useSheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

const OPTIONS: { id: DataMode; title: string; note: string }[] = [
  { id: 'contoh', title: 'Contoh', note: 'Data tiruan di aplikasi, tanpa jaringan' },
  { id: 'server', title: 'Server', note: 'Server asli, harus masuk dengan nomor WhatsApp' },
];

// Lembar pilihan mode data (menu Coba). Server tidak bisa dipilih sebelum alamatnya diatur.
export default function Mode() {
  return (
    <Sheet onClose={() => router.back()}>
      <Pilihan />
    </Sheet>
  );
}

function Pilihan() {
  const { c } = useTheme();
  const { mode, canUseServer, setMode } = useApi();
  const { dispatch } = useSample();
  const { close } = useSheet();
  const pick = (id: DataMode) => {
    if (id === mode) return close();
    close(() => {
      void setMode(id).then((ok) => {
        if (ok) dispatch({ type: 'showToast', text: `Mode data: ${id === 'server' ? 'Server' : 'Contoh'}.` });
      });
    });
  };
  return (
    <>
      <Txt v="title" style={{ marginBottom: 8 }}>
        Mode data
      </Txt>
      <View accessibilityRole="radiogroup">
        {OPTIONS.map((o, i) => {
          const selected = o.id === mode;
          const disabled = o.id === 'server' && !canUseServer;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="radio"
              accessibilityLabel={o.title}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => pick(o.id)}
              android_ripple={{ color: c.ripple }}
              style={{
                minHeight: 64,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: disabled ? 0.5 : 1,
                borderBottomWidth: i < OPTIONS.length - 1 ? 1 : 0,
                borderBottomColor: c.line,
              }}
            >
              <View style={{ flex: 1, paddingVertical: 8 }}>
                <Txt weight={selected ? 600 : 500}>{o.title}</Txt>
                <Txt v="caption" color={c.muted}>
                  {disabled ? 'Alamat server belum diatur' : o.note}
                </Txt>
              </View>
              {selected ? <Icon name="check" size={24} color={c.green} /> : null}
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
