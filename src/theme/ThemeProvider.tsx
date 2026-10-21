import { createContext, useContext, type ReactNode } from 'react';
import { useAppearance } from './appearance';
import { darkTheme, lightTheme, type Scheme, type ThemeTokens } from './tokens';

export type { Scheme } from './tokens';

/** Tema yang berlaku: warna (`c`), aksen per bidang, bayangan, gradasi, huruf, radius, jarak, dan gerak. */
export type Theme = ThemeTokens;

/** Objek tema tetap, supaya nilai context tidak berganti di tiap render. */
export function themeFor(scheme: Scheme): Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}

const ThemeContext = createContext<Theme>(themeFor('light'));

/** `scheme` hanya untuk tes dan layar pratinjau. Biasanya pilihan Tampilan (bawaannya mengikuti mode gelap HP). */
export function ThemeProvider({ scheme, children }: { scheme?: Scheme; children: ReactNode }) {
  const appearance = useAppearance();
  const value = themeFor(scheme ?? appearance.scheme);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): Theme => useContext(ThemeContext);
