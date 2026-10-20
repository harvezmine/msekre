import { Tabs } from 'expo-router/js-tabs';
import { useReducedMotion } from 'react-native-reanimated';
import { TabBar } from '@/ui/TabBar';
import { tabSceneInterpolator, tabTransitionSpec } from '@/ui/tabTransition';

export default function TabsLayout() {
  // Hapus Animasi dinyalakan: pindah tab tanpa gerak.
  const reduce = useReducedMotion();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        ...(reduce
          ? { animation: 'none' as const }
          : { sceneStyleInterpolator: tabSceneInterpolator, transitionSpec: tabTransitionSpec }),
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="agenda" />
      <Tabs.Screen name="perangkat" />
      <Tabs.Screen name="usaha" />
    </Tabs>
  );
}
