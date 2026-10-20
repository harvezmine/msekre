import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type Palette } from './tokens';

export type Scheme = 'light' | 'dark';

export interface Theme {
  scheme: Scheme;
  c: Palette;
}

const LIGHT: Theme = { scheme: 'light', c: light };
const DARK: Theme = { scheme: 'dark', c: dark };

/** Objek tema tetap, supaya nilai context tidak berganti di tiap render. */
export function themeFor(scheme: Scheme): Theme {
  return scheme === 'dark' ? DARK : LIGHT;
}

const ThemeContext = createContext<Theme>(themeFor('light'));

/** `scheme` hanya untuk tes dan layar pratinjau. Biasanya mengikuti mode gelap HP. */
export function ThemeProvider({ scheme, children }: { scheme?: Scheme; children: ReactNode }) {
  const system = useColorScheme();
  const value = themeFor(scheme ?? (system === 'dark' ? 'dark' : 'light'));
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): Theme => useContext(ThemeContext);
