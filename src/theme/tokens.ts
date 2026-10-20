/** Warna dari desain: renderVals() di design/handoff/.../Sekretaris AI.dc.html, objek L dan D. */
export const light = {
  paper: '#F6F6F0',
  card: '#FCFCF8',
  mint: '#E8F4E8',
  line: '#E2E6DE',
  ink: '#0D2B22',
  ripple: 'rgba(13,43,34,0.12)',
  muted: '#647069',
  green: '#1D7550',
  onGreen: '#FFFFFF',
  leaf: '#4DA36E',
  leafText: '#1D7550',
  sage: '#81C084',
  clay: '#A14E2E',
  clayBg: '#F5E5DB',
  track: '#CBD3C8',
  voice: '#0E3A2C',
};

export type Palette = Record<keyof typeof light, string>;

export const dark: Palette = {
  paper: '#0A1F18',
  card: '#123A2D',
  mint: '#18493A',
  line: '#1E4A3B',
  ink: '#ECF2EA',
  ripple: 'rgba(236,242,234,0.16)',
  muted: '#A9B8AE',
  green: '#4DA36E',
  onGreen: '#0A1F18',
  leaf: '#81C084',
  leafText: '#81C084',
  sage: '#81C084',
  clay: '#E39A74',
  clayBg: '#3B2A21',
  track: '#2E5C4B',
  voice: '#0A1F18',
};

/** Teks dan tombol di layar berlatar forest (Mode Suara, alarm). Sama di mode terang dan gelap. */
export const onForest = {
  text: '#ECF2EA',
  strong: '#F6F6F0',
  soft: '#A9B8AE',
  hint: '#7F948A',
  label: '#C9D4CC',
  button: 'rgba(236,242,234,0.08)',
  buttonLine: 'rgba(236,242,234,0.18)',
} as const;

export const FONT = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
} as const;

/** Skala huruf dari brief: sapaan, judul, subjudul, isi, keterangan. */
export const typeScale = {
  display: { fontSize: 32, lineHeight: 40, fontFamily: FONT[600], letterSpacing: -0.32 },
  title: { fontSize: 22, lineHeight: 28, fontFamily: FONT[600] },
  subtitle: { fontSize: 17, lineHeight: 24, fontFamily: FONT[600] },
  body: { fontSize: 16, lineHeight: 24, fontFamily: FONT[400] },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: FONT[500] },
} as const;

export const radius = { card: 24, cardSmall: 20, iconTile: 14, button: 24 } as const;
