import { useIsFocused } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import { setTabBarShown } from '@/ui/tabBarShown';
import { TabsLiveContext } from '@/ui/TabsLiveContext';
import { useLive } from '@/ui/useLive';
import { TabBar } from '@/ui/TabBar';
import { tabSceneInterpolator, tabTransitionSpec } from '@/ui/tabTransition';

export default function TabsLayout() {
  // Hapus Animasi dinyalakan: pindah tab tanpa gerak.
  const reduce = useReducedMotion();
  // Layout ini layar di Stack akar: tidak fokus saat chat atau Mode Suara menutupi tab.
  const live = useLive();
  // Toast di akar perlu tahu apakah bilah tab terlihat (tidak ditutup chat atau Mode Suara).
  const focused = useIsFocused();
  useEffect(() => {
    setTabBarShown(focused);
    return () => setTabBarShown(false);
  }, [focused]);
  return (
    <TabsLiveContext value={live}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerShown: false,
          ...(reduce
            ? { animation: 'none' as const }
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
