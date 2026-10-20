import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type Palette } from './tokens';

export type Scheme = 'light' | 'dark';

export interface Theme {
  scheme: Scheme;
  c: Palette;
}

export function themeFor(scheme: Scheme): Theme {
  return { scheme, c: scheme === 'dark' ? dark : light };
}

const ThemeContext = createContext<Theme>(themeFor('light'));

/** `scheme` hanya untuk tes dan layar pratinjau. Biasanya mengikuti mode gelap HP. */
export function ThemeProvider({ scheme, children }: { scheme?: Scheme; children: ReactNode }) {
  const system = useColorScheme();
  const value = themeFor(scheme ?? (system === 'dark' ? 'dark' : 'light'));
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): Theme => useContext(ThemeContext);
