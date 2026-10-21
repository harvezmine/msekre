import { Pressable, ScrollView, View } from 'react-native';
import { APPEARANCE_LABEL, APPEARANCE_PREFERENCES, useAppearance, type AppearancePreference } from '@/theme/appearance';
import { useTheme } from '@/theme/ThemeProvider';
import { dark, light, type Palette } from '@/theme/tokens';
import { BackHeader } from '@/ui/BackHeader';
import { Txt } from '@/ui/Txt';

const HINT: Record<AppearancePreference, string | null> = {
  system: 'Terang atau gelap mengikuti pengaturan HP',
  light: null,
  dark: null,
};

/** Satu setengah petak pratinjau: kertas, kartu, dan garis tulisan dalam warna pilihan itu. */
function Half({ p }: { p: Palette }) {
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, padding: 5, gap: 3, justifyContent: 'center' }}>
      <View style={{ height: 4, width: '70%', borderRadius: 2, backgroundColor: p.text }} />
      <View style={{ height: 8, borderRadius: 3, backgroundColor: p.surface, borderWidth: 1, borderColor: p.line }} />
      <View style={{ height: 4, width: '40%', borderRadius: 2, backgroundColor: p.brand }} />
    </View>
  );
}

function Preview({ value }: { value: AppearancePreference }) {
  const { c } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 56,
        height: 40,
        flexDirection: 'row',
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      {value !== 'dark' ? <Half p={light} /> : null}
      {value !== 'light' ? <Half p={dark} /> : null}
    </View>
  );
}

// Tampilan (di bawah Akun): ikut HP, selalu terang, atau selalu gelap. Berlaku seketika dan diingat di HP ini.
export default function Tampilan() {
  const { c, shadow } = useTheme();
  const { preference, setPreference } = useAppearance();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BackHeader title="Tampilan" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 8 }}>
        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          {APPEARANCE_PREFERENCES.map((value) => {
            const on = preference === value;
            const hint = HINT[value];
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={APPEARANCE_LABEL[value]}
                accessibilityHint={hint ?? undefined}
                accessibilityState={{ checked: on }}
                onPress={() => setPreference(value)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: on ? c.brand : 'transparent',
                  backgroundColor: on ? c.brandSoft : c.surface,
                  boxShadow: on ? undefined : shadow.e1,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: on ? c.brand : c.muted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.brand }} /> : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt weight={600}>{APPEARANCE_LABEL[value]}</Txt>
                  {hint ? <Txt color={on ? c.text : c.muted}>{hint}</Txt> : null}
                </View>
                <Preview value={value} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
