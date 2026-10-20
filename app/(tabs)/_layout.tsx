import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '@/ui/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="agenda" />
      <Tabs.Screen name="perangkat" />
      <Tabs.Screen name="usaha" />
    </Tabs>
  );
}
