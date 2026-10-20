import { Tabs } from "expo-router/js-tabs";
import { useReducedMotion } from "react-native-reanimated";
import { TabsLiveContext } from "@/ui/TabsLiveContext";
import { useLive } from "@/ui/useLive";
import { TabBar } from "@/ui/TabBar";
import { tabSceneInterpolator, tabTransitionSpec } from "@/ui/tabTransition";

export default function TabsLayout() {
  // Hapus Animasi dinyalakan: pindah tab tanpa gerak.
  const reduce = useReducedMotion();
  // Layout ini layar di Stack akar: tidak fokus saat chat atau Mode Suara menutupi tab.
  const live = useLive();
  return (
    <TabsLiveContext value={live}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerShown: false,
          ...(reduce
            ? { animation: "none" as const }
            : {
                sceneStyleInterpolator: tabSceneInterpolator,
                transitionSpec: tabTransitionSpec,
              }),
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="agenda" />
        <Tabs.Screen name="perangkat" />
        <Tabs.Screen name="usaha" />
      </Tabs>
    </TabsLiveContext>
  );
}
