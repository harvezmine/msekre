import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEFAULT_ASSISTANT } from "@/brand";
import { VOICE_SAMPLE } from "@/sample/voice";
import { useTheme } from "@/theme/ThemeProvider";
import { onForest } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import type { IconName } from "@/ui/icons";
import { Inti } from "@/ui/inti/Inti";
import { Txt } from "@/ui/Txt";
import { useTimeline } from "@/ui/useTimeline";

// Fase 0: isi contoh. Rekaman, teks langsung, dan suara balasan dibangun di Fase 6.
export default function Suara() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { step, restart } = useTimeline(VOICE_SAMPLE);
  useEffect(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: c.voice }}>
      <StatusBar style="light" />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 36,
        }}
      >
        <View style={{ paddingHorizontal: 28, gap: 8 }}>
          <Txt v="caption" color={onForest.soft}>
            Anda
          </Txt>
          <Txt
            weight={500}
            color={onForest.text}
            style={{ fontSize: 20, lineHeight: 28 }}
            maxFontSizeMultiplier={1.4}
          >
            {step.you}
            {step.youRest ? <Text style={{ color: onForest.hint }}>{step.youRest}</Text> : null}
          </Txt>
        </View>
        <View
          style={{
            flex: 1,
            minHeight: 240,
            maxHeight: 340,
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "stretch",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ulangi contoh"
            onPress={restart}
          >
            <Inti size={200} state={step.state} onDark />
          </Pressable>
          <Txt
            v="caption"
            color={onForest.soft}
            accessibilityLiveRegion="polite"
            style={{ marginTop: 12 }}
          >
            {step.label}
          </Txt>
        </View>
        <View style={{ paddingHorizontal: 28, gap: 8, minHeight: 72 }}>
          {step.reply ? (
            <>
              <Txt v="caption" color={onForest.soft}>
                {DEFAULT_ASSISTANT}
              </Txt>
              <Txt
                weight={600}
                color={onForest.strong}
                style={{ fontSize: 26, lineHeight: 34, letterSpacing: -0.26 }}
                maxFontSizeMultiplier={1.4}
              >
                {step.reply}
              </Txt>
            </>
          ) : null}
        </View>
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 24,
            flexDirection: "row",
            alignItems: "flex-start",
          }}
        >
          <RoundAction icon="micOff" label="Bisukan mic" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Selesai"
            onPress={() => router.back()}
            style={{
              height: 56,
              paddingHorizontal: 40,
              borderRadius: 28,
              backgroundColor: onForest.strong,
              justifyContent: "center",
            }}
          >
            {/* warna forest di atas tombol terang, sama di dua mode */}
            <Txt v="subtitle" color="#0E3A2C">
              Selesai
            </Txt>
          </Pressable>
          <RoundAction
            icon="keyboard"
            label="Pindah ke ketik"
            onPress={() => router.replace("/chat")}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function RoundAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: onForest.buttonLine,
          backgroundColor: onForest.button,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={24} color={onForest.text} />
      </Pressable>
      <Txt v="caption" color={onForest.label} style={{ textAlign: "center" }}>
        {label}
      </Txt>
    </View>
  );
}
