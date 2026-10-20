import { Easing } from 'react-native';
import type { BottomTabNavigationOptions } from 'expo-router/js-tabs';

type BottomTabSceneStyleInterpolator = NonNullable<BottomTabNavigationOptions['sceneStyleInterpolator']>;
type TransitionSpec = NonNullable<BottomTabNavigationOptions['transitionSpec']>;

const SHIFT = 8;

/** Pindah tab: layar memudar sambil bergeser 8 dp (progress −1, 0, 1 = kiri, aktif, kanan). */
export const tabSceneInterpolator: BottomTabSceneStyleInterpolator = ({ current }) => ({
  sceneStyle: {
    opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
    transform: [
      { translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-SHIFT, 0, SHIFT] }) },
    ],
  },
});

export const tabTransitionSpec: TransitionSpec = {
  animation: 'timing',
  config: { duration: 220, easing: Easing.out(Easing.ease) },
};
