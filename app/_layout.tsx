import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from '@expo-google-fonts/plus-jakarta-sans/useFonts';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

// Tautan langsung ke /chat, /suara, /inti tetap punya tab di bawahnya.
export const unstable_settings = { anchor: '(tabs)' };

SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { c, scheme } = useTheme();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.paper);
  }, [c.paper]);
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="suara" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="inti" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);
  if (!loaded && !error) return null;
  return (
    <ThemeProvider>
      <Navigator />
    </ThemeProvider>
  );
}
