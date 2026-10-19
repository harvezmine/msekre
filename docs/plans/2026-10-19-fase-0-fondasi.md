# Fase 0: Fondasi Visual — Rencana Implementasi

> **Untuk agen yang mengerjakan:** WAJIB memakai skill superpowers:subagent-driven-development (disarankan) atau
> superpowers:executing-plans untuk mengerjakan rencana ini tugas demi tugas. Langkah memakai kotak centang
> (`- [ ]`) untuk melacak kemajuan.

**Tujuan:** aplikasi Expo yang bisa dipasang di HP Android dan menampilkan Beranda, Chat kosong, dan Mode Suara
persis seperti desain, dengan Inti yang hidup dan tab bar. Datanya masih contoh, belum terhubung ke server.

**Arsitektur:**
- Expo dengan expo-router. Rute ada di `app/`, kode lain di `src/` dengan alias `@/`.
- Token warna dan huruf dibaca lewat `ThemeProvider` yang mengikuti mode gelap HP.
- Komponen inti: `Inti` (pita logo dengan 5 keadaan, dianimasikan dengan reanimated), `Orbit` (cincin ekosistem dari
  react-native-svg), dan `TabBar` kustom.
- Ukuran dan warna diambil dari `design/handoff/sekretaris-ai-mobile-app-design/project/`.

**Teknologi:**
- Expo SDK terbaru (dibuat dengan `create-expo-app@latest`), TypeScript, expo-router.
- react-native-reanimated, react-native-svg, expo-haptics, @expo-google-fonts/plus-jakarta-sans.
- Jest dengan jest-expo dan @testing-library/react-native.

**Aturan untuk seluruh rencana:**
- Semua perintah dijalankan dari `/Users/rafaeljosh/dev/milo-ai/mobile` **setelah `source dev-env.sh`**, kecuali disebut
  lain.
- Commit di repo `mobile` (branch `dev`), bukan di milo-ai.
- Pesan commit tanpa baris Co-Authored-By.
- Teks di layar memakai bahasa Indonesia sehari-hari, tanpa istilah teknis dan tanpa emoji.

## Penyesuaian setelah Tugas 1 (20 Okt 2026)

Yang terpasang ternyata Expo SDK 58: React Native 0.88, React 19.3, reanimated 4.7, expo-router 58, TypeScript 6,
Jest 30, React Native Testing Library (RNTL) 14. Rencana ini ditulis dengan acuan API yang lebih lama, jadi aturan
berikut **menggantikan** kode di tugas-tugas di bawah bila bertentangan.

1. **Tes asinkron (RNTL 14).**
   - Setiap tes ditulis `async`. Gunakan `await render(...)`, `await fireEvent.press(...)`,
     `await fireEvent(el, 'longPress')`, dan `await screen.unmount()`.
   - Query (`screen.getBy…`) tetap sinkron.
   - Baca `node_modules/@testing-library/react-native/docs/guides/llm-guidelines.md` sebelum menulis tes.
2. **Reanimated dengan React Compiler.** React Compiler aktif (`experiments.reactCompiler`). Di dalam komponen dan
   worklet, pakai `sv.set(nilai)` dan `sv.get()`, bukan `sv.value`.
3. **Tab memakai `expo-router/js-tabs`.**
   - `Tabs` diimpor dari `expo-router/js-tabs`, bukan dari `expo-router`, dan tipe `BottomTabBarProps` juga dari sana.
   - Tab bar kustom menerima `{ state, descriptors, emitter, navigateToTab, insets }`; tidak ada objek `navigation`.
   - Tugas 11 sudah ditulis ulang mengikuti ini.
4. **Cek API di versi terpasang.** Kalau kode di rencana tidak cocok dengan typings di `node_modules` atau dokumentasi
   SDK 58 (`https://docs.expo.dev/versions/v58.0.0/`), ikuti versi terpasang, lalu catat penyimpangannya di laporan.
5. **Cek akhir setiap tugas.** Sebelum commit, `npx tsc --noEmit`, `npm run lint`, dan `npx jest` harus hijau.

---

## Peta file

| File | Tanggung jawab |
|---|---|
| `.nvmrc` | Mengunci Node 24 untuk repo ini |
| `app.json` | Nama, skema deep link, paket Android, ikon, splash |
| `package.json` | Skrip dan konfigurasi Jest |
| `jest.setup.ts` | Mock reanimated, safe area, router, haptics untuk tes |
| `scripts/make-icons.mjs` | Membuat ikon adaptif Android dari tanda "S" |
| `assets/brand/*.png` | Pita, tanda, dan versi monokrom dari desain, ditambah ikon hasil skrip |
| `src/brand.ts` | Nama aplikasi sementara dan nama bawaan asisten |
| `src/theme/tokens.ts` | Warna terang/gelap, warna di atas forest, font, skala huruf, radius |
| `src/theme/ThemeProvider.tsx` | Memilih palet sesuai mode HP, hook `useTheme` |
| `src/ui/Txt.tsx` | Teks dengan varian skala huruf |
| `src/ui/icons.ts` | Path SVG semua ikon dari desain |
| `src/ui/Icon.tsx` | Menggambar satu ikon garis |
| `src/ui/IconButton.tsx` | Tombol bulat 48dp berisi ikon |
| `src/ui/Card.tsx` | Kartu: latar card, garis, sudut 24 |
| `src/ui/Toggle.tsx` | Sakelar 52×32 seperti desain |
| `src/ui/inti/size.ts` | Rasio pita dan posisi tiga titik (murni, bisa dites) |
| `src/ui/inti/Inti.tsx` | Inti dengan 5 keadaan |
| `src/ui/orbit/types.ts` | Tipe `OrbitNode` |
| `src/ui/orbit/geometry.ts` | Posisi simpul dan garis di cincin (murni) |
| `src/ui/orbit/label.ts` | Tulisan di bawah cincin ("7 terhubung · …") |
| `src/ui/orbit/Orbit.tsx` | Cincin ekosistem, simpul, aliran titik, Inti di tengah |
| `src/ui/TabBar.tsx` | Tab bar dengan Inti menonjol di tengah |
| `src/ui/LaterScreen.tsx` | Isi sementara tab yang dibangun di fase berikutnya |
| `src/sample/home.ts` | Data contoh Beranda (desain 1a) |
| `app/_layout.tsx` | Memuat font, tema, dan Stack |
| `app/(tabs)/_layout.tsx` | Tabs dengan `TabBar` |
| `app/(tabs)/index.tsx` | Beranda |
| `app/(tabs)/agenda.tsx`, `perangkat.tsx`, `usaha.tsx` | Isi sementara (Fase 2–4) |
| `app/chat.tsx` | Chat kosong (desain 1d) |
| `app/suara.tsx` | Mode Suara (desain 1e) |
| `app/inti.tsx` | Pemeriksa 5 keadaan Inti (desain 1k), hanya untuk development |
| `__tests__/*.test.ts(x)` | Tes per unit |

---

### Tugas 0: Siapkan Mac (sekali saja)

> **Selesai 20 Okt 2026, dengan cara yang berbeda dari langkah di bawah.** Langkah 1–3 di bawah tidak perlu dijalankan
> lagi; langkah 4 (HP) masih perlu dilakukan.
> - Node 24 dipasang lewat nvm yang sudah ada (default nvm tetap 18). fnm tidak dipakai.
> - JDK 17 sudah ada dari Homebrew (`openjdk@17`). JDK 21 bawaan pengguna tidak diubah.
> - Android SDK memakai `android-commandlinetools` dari Homebrew dan `platform-tools`, tanpa Android Studio.
>   Lisensinya sudah diterima. Platform dan build-tools diunduh Gradle saat build pertama.
> - Semua jalur ini diatur oleh `dev-env.sh` di akar repo, jadi `~/.zshrc` tidak diubah.
> - Catatan: `node@22` dari Homebrew yang dipakai `~/.zshrc` pengguna rusak (libsimdjson hilang).

**File:** tidak ada di repo.

- [ ] **Langkah 1: Pastikan Homebrew ada di PATH**

Jalankan: `which brew || echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc`, lalu buka terminal baru.

Hasil yang diharapkan: `which brew` mencetak `/opt/homebrew/bin/brew`.

- [ ] **Langkah 2: Pasang Node 24 lewat fnm**

Node 26 yang ada sekarang terlalu baru untuk Expo.

```bash
brew install fnm
echo 'eval "$(fnm env --use-on-cd --shell zsh)"' >> ~/.zshrc
exec zsh
fnm install 24
```

Hasil yang diharapkan: `fnm list` memuat `v24.x`.

- [ ] **Langkah 3: Pasang JDK 17 dan Android Studio**

```bash
brew install --cask zulu@17 android-studio
```

Buka Android Studio sekali. Di **More Actions → SDK Manager**, pasang:
- Android SDK Platform versi terbaru;
- Android SDK Build-Tools;
- Android SDK Platform-Tools.

Lalu tambahkan ke `~/.zshrc`:

```bash
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
```

Hasil yang diharapkan di terminal baru: `adb version` mencetak versi, dan `java -version` mencetak `17`.

- [ ] **Langkah 4: Siapkan HP Android**

1. Aktifkan **Opsi pengembang**: ketuk Nomor bentukan 7 kali.
2. Nyalakan **Debugging USB**.
3. Sambungkan HP ke Mac dengan kabel.

Hasil yang diharapkan: `adb devices` menampilkan satu perangkat berstatus `device`.

---

### Tugas 1: Kerangka Expo

> **Selesai 20 Okt 2026** (commit `4be0390` sampai `ce568b0`). Perbedaan dari langkah di bawah, hasil review:
> - Rute template ada di `src/app` dan sudah dipindah ke `app/`.
> - Jest memakai `"resolver": "react-native-reanimated/jest/resolver"`, ditambah tes asap `__tests__/setup.test.tsx`.
> - `react-test-renderer` diganti `test-renderer` (dipakai RNTL 14).
> - `@react-navigation/bottom-tabs` dilepas karena expo-router 58 punya tab sendiri.
> - Ditambah `"types": ["jest"]` di tsconfig, lint (`npm run lint`, eslint-config-expo), dan isian `.gitignore`
>   (`.env`, `coverage/`, `credentials.json`, `google-services.json`).
> - LICENSE template dihapus.

**File:**
- Buat: `.nvmrc`, dan semua file template Expo.
- Ubah: `package.json`, `tsconfig.json`, `.gitignore`.
- Buat: `jest.setup.ts`.

- [ ] **Langkah 1: Kunci Node 24 dan buat template di folder sementara**

`create-expo-app` membutuhkan folder kosong, sedangkan repo ini sudah berisi `docs/` dan `design/`.

```bash
echo 24 > .nvmrc && fnm use
npx create-expo-app@latest "$TMPDIR/sk-scaffold" --template default --no-install
rsync -a --exclude .git "$TMPDIR/sk-scaffold/" ./
rm -rf "$TMPDIR/sk-scaffold"
npm pkg set name=sekretaris-ai-mobile
npm install
```

Hasil yang diharapkan: `npm install` selesai tanpa `ERR!`.

- [ ] **Langkah 2: Kosongkan contoh bawaan template**

Jawaban `n` membuat contoh template dihapus, tidak dipindah.

```bash
echo n | npm run reset-project
```

Kalau rute template ada di `src/app`, pindahkan ke akar dengan `mv src/app app`.

Hasil yang diharapkan: ada `app/_layout.tsx` dan `app/index.tsx`, tanpa folder `components/`, `hooks/`, atau
`constants/` dari template.

- [ ] **Langkah 3: Pasang dependensi**

```bash
npx expo install expo-dev-client react-native-svg react-native-reanimated expo-haptics expo-font \
  @expo-google-fonts/plus-jakarta-sans expo-splash-screen expo-status-bar expo-system-ui \
  @react-navigation/bottom-tabs react-native-safe-area-context
npx expo install jest-expo jest @types/jest @testing-library/react-native -- --save-dev
npm i -D react-test-renderer@$(node -p "require('react/package.json').version") sharp
```

- [ ] **Langkah 4: Atur alias `@/` ke `src/`**

Di `tsconfig.json`, ganti isi `compilerOptions.paths` menjadi:

```json
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Langkah 5: Atur Jest dan skrip**

```bash
npm pkg set scripts.test="jest" scripts.typecheck="tsc --noEmit"
```

Tambahkan kunci `jest` ini ke `package.json` secara manual. `npm pkg set` tidak bisa dipakai di sini karena titik
di dalam `(.*)` akan dibaca sebagai pemisah kunci.

```json
"jest": {
  "preset": "jest-expo",
  "setupFiles": ["<rootDir>/jest.setup.ts"],
  "moduleNameMapper": { "^@/(.*)$": "<rootDir>/src/$1" }
}
```

Buat `jest.setup.ts`:

```ts
import { setUpTests } from 'react-native-reanimated';

setUpTests();

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() },
}));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
```

- [ ] **Langkah 6: Abaikan zip desain**

```bash
printf '\n# Zip asli dari Claude Design; isinya sudah ada di design/handoff/\ndesign/*.zip\n' >> .gitignore
```

- [ ] **Langkah 7: Pastikan semuanya hijau**

Jalankan: `npx expo-doctor && npx jest --passWithNoTests`

Hasil yang diharapkan: expo-doctor tidak menemukan masalah, dan Jest mencetak `No tests found, exiting with code 0`.

- [ ] **Langkah 8: Commit**

```bash
git add -A
git commit -m "chore: kerangka Expo, Jest, alias @/"
```

---

### Tugas 2: Aset merek, ikon aplikasi, app.json

**File:**
- Buat: `assets/brand/` (5 PNG salinan dan 3 PNG hasil skrip), `scripts/make-icons.mjs`, `src/brand.ts`.
- Ubah: `app.json`.

- [ ] **Langkah 1: Salin gambar dari desain**

```bash
mkdir -p assets/brand
cp design/handoff/sekretaris-ai-mobile-app-design/project/assets/{s-ribbon,s-ribbon-light,s-mark,s-mono-ink,s-mono-light}.png assets/brand/
```

- [ ] **Langkah 2: Tulis skrip ikon**

Buat `scripts/make-icons.mjs`:

```js
// Ikon adaptif Android dari tanda "S" desain (2r): kanvas 1024, tanda setinggi 116/216 kanvas, tepat di tengah,
// jadi selalu di dalam zona aman 66/108. Jalankan ulang setelah logo vektor tersedia.
import sharp from 'sharp';

const SIZE = 1024;
const MARK_H = Math.round((SIZE * 116) / 216);

async function centered(src, out) {
  const mark = await sharp(src).resize({ height: MARK_H }).png().toBuffer();
  const { width } = await sharp(mark).metadata();
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: mark, left: Math.round((SIZE - width) / 2), top: Math.round((SIZE - MARK_H) / 2) }])
    .png()
    .toFile(out);
}

await centered('assets/brand/s-mark.png', 'assets/brand/icon-foreground.png');
await centered('assets/brand/s-mono-ink.png', 'assets/brand/icon-monochrome.png');
const fg = await sharp('assets/brand/icon-foreground.png').toBuffer();
await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: '#F6F6F0' } })
  .composite([{ input: fg }])
  .png()
  .toFile('assets/brand/icon.png');
console.log('ikon dibuat');
```

- [ ] **Langkah 3: Jalankan skripnya**

Jalankan: `node scripts/make-icons.mjs && file assets/brand/icon*.png`

Hasil yang diharapkan: `ikon dibuat`, dan ketiga file berukuran `1024 x 1024`.

- [ ] **Langkah 4: Isi app.json**

Di `app.json`, ganti atau tambahkan kunci berikut di dalam `expo`. Kunci template lain (misalnya `newArchEnabled`,
`ios`, `web`) dibiarkan.

```json
"name": "Sekretaris AI",
"slug": "sekretaris-ai",
"scheme": "sekretarisai",
"orientation": "portrait",
"userInterfaceStyle": "automatic",
"icon": "./assets/brand/icon.png",
"android": {
  "package": "id.my.secretary.dev",
  "adaptiveIcon": {
    "foregroundImage": "./assets/brand/icon-foreground.png",
    "monochromeImage": "./assets/brand/icon-monochrome.png",
    "backgroundColor": "#F6F6F0"
  }
},
"plugins": [
  "expo-router",
  "expo-font",
  [
    "expo-splash-screen",
    {
      "image": "./assets/brand/s-mark.png",
      "imageWidth": 120,
      "backgroundColor": "#F6F6F0",
      "dark": { "image": "./assets/brand/s-ribbon-light.png", "backgroundColor": "#0A1F18" }
    }
  ]
]
```

- [ ] **Langkah 5: Tulis konstanta merek**

Buat `src/brand.ts`:

```ts
/** Nama sementara. Saat nama final ditetapkan, ganti di sini dan di app.json. */
export const APP_NAME = 'Sekretaris AI';

/** Nama bawaan asisten. Mulai Fase 1, nama pilihan pengguna datang dari server. */
export const DEFAULT_ASSISTANT = 'Nadia';
```

- [ ] **Langkah 6: Periksa konfigurasi dan commit**

Jalankan: `npx expo config --type public | grep -E '"(name|package|scheme)"'`

Hasil yang diharapkan: ketiga nilai di atas tercetak.

```bash
git add -A
git commit -m "feat: aset merek, ikon adaptif, app.json"
```

---

### Tugas 3: Token dan ThemeProvider

**File:**
- Buat: `src/theme/tokens.ts`, `src/theme/ThemeProvider.tsx`.
- Tes: `__tests__/theme.test.tsx`.

- [ ] **Langkah 1: Tulis tes yang gagal**

Buat `__tests__/theme.test.tsx`:

```tsx
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { dark, light, typeScale } from '@/theme/tokens';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

test('terang dan gelap punya token yang sama', () => {
  expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
});

test('warna utama sama dengan logo dan situs', () => {
  expect(light.green).toBe('#1D7550');
  expect(light.paper).toBe('#F6F6F0');
  expect(dark.paper).toBe('#0A1F18');
});

test('skala huruf sesuai brief', () => {
  expect(typeScale.display).toMatchObject({ fontSize: 32, lineHeight: 40 });
  expect(typeScale.caption).toMatchObject({ fontSize: 13, lineHeight: 18 });
});

function Probe() {
  const { scheme, c } = useTheme();
  return <Text>{`${scheme} ${c.paper}`}</Text>;
}

test('tanpa provider memakai mode terang', () => {
  render(<Probe />);
  expect(screen.getByText('light #F6F6F0')).toBeTruthy();
});

test('provider gelap memberi palet gelap', () => {
  render(
    <ThemeProvider scheme="dark">
      <Probe />
    </ThemeProvider>,
  );
  expect(screen.getByText('dark #0A1F18')).toBeTruthy();
});
```

- [ ] **Langkah 2: Jalankan tes, pastikan gagal**

Jalankan: `npx jest __tests__/theme.test.tsx`

Hasil yang diharapkan: FAIL, `Cannot find module '@/theme/tokens'`.

- [ ] **Langkah 3: Tulis token**

Buat `src/theme/tokens.ts`:

```ts
/** Warna dari desain: renderVals() di design/handoff/.../Sekretaris AI.dc.html, objek L dan D. */
export const light = {
  paper: '#F6F6F0',
  card: '#FCFCF8',
  mint: '#E8F4E8',
  line: '#E2E6DE',
  ink: '#0D2B22',
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
```

- [ ] **Langkah 4: Tulis ThemeProvider**

Buat `src/theme/ThemeProvider.tsx`:

```tsx
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
```

- [ ] **Langkah 5: Jalankan tes, pastikan lulus**

Jalankan: `npx jest __tests__/theme.test.tsx`

Hasil yang diharapkan: PASS, 5 tes.

- [ ] **Langkah 6: Commit**

```bash
git add src/theme __tests__/theme.test.tsx
git commit -m "feat: token warna dan ThemeProvider"
```

---

### Tugas 4: Font dan komponen teks

**File:**
- Buat: `src/ui/Txt.tsx`.
- Ubah: `app/_layout.tsx` (diganti seluruhnya).
- Tes: `__tests__/Txt.test.tsx`.

- [ ] **Langkah 1: Tulis tes yang gagal**

Buat `__tests__/Txt.test.tsx`:

```tsx
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Txt } from '@/ui/Txt';

test('varian display memakai 32/40 semibold dan warna ink', () => {
  render(<Txt v="display">Selamat pagi</Txt>);
  const s = StyleSheet.flatten(screen.getByText('Selamat pagi').props.style);
  expect(s).toMatchObject({ fontSize: 32, lineHeight: 40, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#0D2B22' });
});

test('angka tabular dan ketebalan bisa diatur', () => {
  render(
    <Txt tabular weight={600}>
      09.00
    </Txt>,
  );
  const s = StyleSheet.flatten(screen.getByText('09.00').props.style);
  expect(s.fontVariant).toEqual(['tabular-nums']);
  expect(s.fontFamily).toBe('PlusJakartaSans_600SemiBold');
});
```

- [ ] **Langkah 2: Jalankan tes, pastikan gagal**

Jalankan: `npx jest __tests__/Txt.test.tsx`

Hasil yang diharapkan: FAIL, `Cannot find module '@/ui/Txt'`.

- [ ] **Langkah 3: Tulis Txt**

Buat `src/ui/Txt.tsx`:

```tsx
import { Text, type TextProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { FONT, typeScale } from '@/theme/tokens';

export type TxtVariant = keyof typeof typeScale;

interface Props extends TextProps {
  v?: TxtVariant;
  color?: string;
  weight?: keyof typeof FONT;
  /** Angka uang dan jam: lebar tiap angka sama, jadi tidak bergeser. */
  tabular?: boolean;
}

export function Txt({ v = 'body', color, weight, tabular, style, ...rest }: Props) {
  const { c } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        typeScale[v],
        { color: color ?? c.ink },
        weight ? { fontFamily: FONT[weight] } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
```

- [ ] **Langkah 4: Muat font di root layout**

Ganti seluruh isi `app/_layout.tsx`:

```tsx
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { c, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.paper } }} />
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);
  if (!loaded) return null;
  return (
    <ThemeProvider>
      <Navigator />
    </ThemeProvider>
  );
}
```

- [ ] **Langkah 5: Jalankan tes, pastikan lulus**

Jalankan: `npx jest __tests__/Txt.test.tsx`

Hasil yang diharapkan: PASS, 2 tes.

- [ ] **Langkah 6: Commit**

```bash
git add src/ui/Txt.tsx app/_layout.tsx __tests__/Txt.test.tsx
git commit -m "feat: Plus Jakarta Sans dan komponen Txt"
```

---

### Tugas 5: Ikon

**File:**
- Buat: `src/ui/icons.ts`, `src/ui/Icon.tsx`, `src/ui/IconButton.tsx`.
- Tes: `__tests__/Icon.test.tsx`.

- [ ] **Langkah 1: Tulis tes yang gagal**

Buat `__tests__/Icon.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { ICON_PATHS, type IconName } from '@/ui/icons';

test('setiap ikon dari desain bisa digambar', () => {
  for (const name of Object.keys(ICON_PATHS) as IconName[]) {
    render(<Icon name={name} />);
    expect(screen.getByTestId(`ikon-${name}`)).toBeTruthy();
    screen.unmount();
  }
});

test('tombol ikon punya label dan bisa ditekan', () => {
  const onPress = jest.fn();
  render(<IconButton icon="back" label="Kembali" onPress={onPress} />);
  fireEvent.press(screen.getByRole('button', { name: 'Kembali' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
```

- [ ] **Langkah 2: Jalankan tes, pastikan gagal**

Jalankan: `npx jest __tests__/Icon.test.tsx`

Hasil yang diharapkan: FAIL, `Cannot find module '@/ui/Icon'`.

- [ ] **Langkah 3: Salin path ikon**

Buat `src/ui/icons.ts`. Isinya sama persis dengan objek `P` di `sk-shared.js`:

```ts
/** Disalin dari design/handoff/sekretaris-ai-mobile-app-design/project/sk-shared.js (objek P). viewBox 24. */
export const ICON_PATHS = {
  home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  calendar: 'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM4 10h16M8 4v4M16 4v4',
  bulb: 'M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z',
  store: 'M4 9l1.5-5h13L20 9M4 9h16M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5 11v9h14v-9M10 20v-5h4v5',
  mail: 'M4.5 6h15a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5zM4.5 7l7.5 6 7.5-6',
  chat: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  snow: 'M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5',
  camera: 'M4 7h11a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM16 10.5l5-3v9l-5-3',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  bank: 'M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  lock: 'M6.5 11h11a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  chevD: 'M7 10l5 5 5-5',
  chevR: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  clip: 'M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4L15 7',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4',
  micOff: 'M15 10V6a3 3 0 0 0-5.8-1M9 9v3a3 3 0 0 0 4.6 2.5M6 11a6 6 0 0 0 9.7 4.7M18 11c0 .7-.1 1.4-.3 2M12 17v4M4 4l16 16',
  wave: 'M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  keyboard: 'M3.5 7h17a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-17a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5zM7 10.5h.01M10.5 10.5h.01M14 10.5h.01M17.5 10.5h.01M8 14h8',
  note: 'M6.5 4h11a.5.5 0 0 1 .5.5v15a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-15a.5.5 0 0 1 .5-.5zM9 8.5h6M9 12h6M9 15.5h4',
  bolt: 'M13 3 5.5 13h5.5l-1 8 7.5-10H12z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  power: 'M12 3v8M7 6.3a7 7 0 1 0 10 0',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  plane: 'M21 15.5v-2l-7.5-4.5V4a1.5 1.5 0 0 0-3 0v5L3 13.5v2l7.5-2.5V18L8.5 19.5V21l3.5-1 3.5 1v-1.5L13.5 18v-5z',
  box: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 15.5h6M9 9h.01M12 9h.01M15 9h.01',
  thermo: 'M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0zM12 9v6',
  drop: 'M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z',
  fan: 'M12 10.5C12 6 13 3.5 15.5 4s2 4-3.5 6.5M13.5 12c4.5 0 7 1 6.5 3.5s-4 2-6.5-3.5M12 13.5c0 4.5-1 7-3.5 6.5s-2-4 3.5-6.5M10.5 12C6 12 3.5 11 4 8.5s4-2 6.5 3.5',
  auto: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  shield: 'M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.6-2.4 2-2.4 3.3M12 17h.01',
  bag: 'M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  repeat: 'M17 2.5 20.5 6 17 9.5M3.5 11V9a3 3 0 0 1 3-3h14M7 21.5 3.5 18 7 14.5M20.5 13v2a3 3 0 0 1-3 3h-14',
  task: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  taskDone: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 12.5l3 3 5-6',
  call: 'M5 4h3.5l1.5 4.5-2.2 1.3a11 11 0 0 0 6.4 6.4l1.3-2.2L20 15.5V19a1.5 1.5 0 0 1-1.5 1.5A16.5 16.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4z',
  backspace: 'M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7zM12 9.5l5 5M17 9.5l-5 5',
  bt: 'M7 7.5l10 9-5 4.5V3l5 4.5-10 9',
  send: 'M12 19V5M6 11l6-6 6 6',
  x: 'M6 6l12 12M18 6 6 18',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  share: 'M12 4v11M7 9l5-5 5 5M5 14v5h14v-5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  history: 'M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4M12 8v4l3 2',
} as const;

export type IconName = keyof typeof ICON_PATHS;
```

- [ ] **Langkah 4: Tulis Icon dan IconButton**

Buat `src/ui/Icon.tsx`:

```tsx
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { ICON_PATHS, type IconName } from './icons';

/** Ikon garis seperti di desain: ketebalan 1,75, ujung membulat. */
export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color?: string }) {
  const { c } = useTheme();
  return (
    <Svg
      testID={`ikon-${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? c.ink}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={ICON_PATHS[name]} />
    </Svg>
  );
}
```

Buat `src/ui/IconButton.tsx`:

```tsx
import { Pressable } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import type { IconName } from './icons';

interface Props {
  icon: IconName;
  label: string;
  onPress?: () => void;
  /** Latar mint dan ikon hijau, seperti tombol Mode Suara di header chat. */
  tinted?: boolean;
  color?: string;
}

export function IconButton({ icon, label, onPress, tinted = false, color }: Props) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tinted ? c.mint : 'transparent',
      }}
    >
      <Icon name={icon} size={tinted ? 22 : 24} color={color ?? (tinted ? c.green : c.ink)} />
    </Pressable>
  );
}
```

- [ ] **Langkah 5: Jalankan tes, pastikan lulus**

Jalankan: `npx jest __tests__/Icon.test.tsx`

Hasil yang diharapkan: PASS, 2 tes.

- [ ] **Langkah 6: Commit**

```bash
git add src/ui/icons.ts src/ui/Icon.tsx src/ui/IconButton.tsx __tests__/Icon.test.tsx
git commit -m "feat: ikon garis dari desain"
```

---

### Tugas 6: Kartu dan sakelar

**File:**
- Buat: `src/ui/Card.tsx`, `src/ui/Toggle.tsx`.
- Tes: `__tests__/Toggle.test.tsx`.

- [ ] **Langkah 1: Tulis tes yang gagal**

Buat `__tests__/Toggle.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Toggle } from '@/ui/Toggle';

test('sakelar memberi tahu nilai barunya dan terbaca oleh pembaca layar', () => {
  const onChange = jest.fn();
  render(<Toggle value label="AC kamar" onChange={onChange} />);
  const sw = screen.getByRole('switch', { name: 'AC kamar' });
  expect(sw.props.accessibilityState?.checked).toBe(true);
  fireEvent.press(sw);
  expect(onChange).toHaveBeenCalledWith(false);
});
```

- [ ] **Langkah 2: Jalankan tes, pastikan gagal**

Jalankan: `npx jest __tests__/Toggle.test.tsx`

Hasil yang diharapkan: FAIL, `Cannot find module '@/ui/Toggle'`.

- [ ] **Langkah 3: Tulis Toggle dan Card**

Buat `src/ui/Toggle.tsx`:

```tsx
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

/** Sakelar 52×32 seperti di desain. hitSlop membuat area sentuhnya 48dp. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (next: boolean) => void; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={{ width: 52, height: 32, borderRadius: 16, padding: 4, backgroundColor: value ? c.green : c.track }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: '#FFFFFF',
          transform: [{ translateX: value ? 20 : 0 }],
        }}
      />
    </Pressable>
  );
}
```

Buat `src/ui/Card.tsx`:

```tsx
import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

export function Card({ style, ...rest }: ViewProps) {
  const { c } = useTheme();
  return (
    <View
      {...rest}
      style={[
        { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: radius.card, padding: 20 },
        style,
      ]}
    />
  );
}
```

- [ ] **Langkah 4: Jalankan tes, pastikan lulus**

Jalankan: `npx jest __tests__/Toggle.test.tsx`

Hasil yang diharapkan: PASS, 1 tes.

- [ ] **Langkah 5: Commit**

```bash
git add src/ui/Toggle.tsx src/ui/Card.tsx __tests__/Toggle.test.tsx
git commit -m "feat: kartu dan sakelar"
```

---

### Tugas 7: Geometri dan tulisan cincin

**File:**
- Buat: `src/ui/orbit/types.ts`, `src/ui/orbit/geometry.ts`, `src/ui/orbit/label.ts`.
- Tes: `__tests__/orbit-geometry.test.ts`.

- [ ] **Langkah 1: Tulis tes yang gagal**

Buat `__tests__/orbit-geometry.test.ts`:

```ts
import { orbitLayout } from '@/ui/orbit/geometry';
import { ringLabel } from '@/ui/orbit/label';

test('simpul pertama ada di puncak cincin, garisnya dari Inti ke tepi simpul', () => {
  const { cx, cy, nodes } = orbitLayout(7);
  expect(cx).toBe(180);
  expect(cy).toBe(152);
  expect(nodes).toHaveLength(7);
  const top = nodes[0]!;
  expect(top.x).toBeCloseTo(180);
  expect(top.y).toBeCloseTo(26);
  expect(top.line.x1).toBeCloseTo(180);
  expect(top.line.y1).toBeCloseTo(72);
  expect(top.line.y2).toBeCloseTo(48);
});

test('dengan 4 simpul, simpul kedua ada di kanan', () => {
  const right = orbitLayout(4).nodes[1]!;
  expect(right.x).toBeCloseTo(306);
  expect(right.y).toBeCloseTo(152);
  expect(right.line.x1).toBeCloseTo(260);
  expect(right.line.x2).toBeCloseTo(284);
});

test('ukuran bisa diperkecil untuk layar 360', () => {
  const { cx, nodes } = orbitLayout(7, { W: 320, H: 270, r: 112, ri: 71 });
  expect(cx).toBe(160);
  expect(nodes[0]!.y).toBeCloseTo(135 - 112);
});

test('tulisan cincin menyebut yang tidak terjangkau', () => {
  const nodes = [{ label: 'Gmail' }, { label: 'CCTV', offline: true }, { label: 'Bank' }];
  expect(ringLabel(nodes)).toBe('3 terhubung · CCTV tidak terjangkau');
  expect(ringLabel([{ label: 'Gmail' }])).toBe('1 terhubung');
});
```

- [ ] **Langkah 2: Jalankan tes, pastikan gagal**

Jalankan: `npx jest __tests__/orbit-geometry.test.ts`

Hasil yang diharapkan: FAIL, `Cannot find module '@/ui/orbit/geometry'`.

- [ ] **Langkah 3: Tulis tipe, geometri, dan tulisan**

Buat `src/ui/orbit/types.ts`:

```ts
import type { IconName } from '@/ui/icons';

export interface OrbitNode {
  key: string;
  icon: IconName;
  label: string;
  /** Tidak terjangkau: abu-abu, titik clay, garis putus-putus, dan tidak ikut aliran titik. */
  offline?: boolean;
}
```

Buat `src/ui/orbit/geometry.ts`:

```ts
export interface OrbitPoint {
  x: number;
  y: number;
  /** Garis dari tepi dalam (dekat Inti) ke tepi simpul. Aliran titik berjalan dari (x2,y2) ke (x1,y1). */
  line: { x1: number; y1: number; x2: number; y2: number };
}

/** Sama dengan SK.orbit di desain: simpul pertama di puncak, berputar searah jarum jam. */
export function orbitLayout(
  count: number,
  opts: { W?: number; H?: number; r?: number; ri?: number; node?: number } = {},
): { cx: number; cy: number; nodes: OrbitPoint[] } {
  const W = opts.W ?? 360;
  const H = opts.H ?? 304;
  const r = opts.r ?? 126;
  const ri = opts.ri ?? 80;
  const half = (opts.node ?? 44) / 2;
  const cx = W / 2;
  const cy = H / 2;
  const nodes = Array.from({ length: count }, (_, i) => {
    const t = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const x = cx + r * cos;
    const y = cy + r * sin;
    return { x, y, line: { x1: cx + ri * cos, y1: cy + ri * sin, x2: x - half * cos, y2: y - half * sin } };
  });
  return { cx, cy, nodes };
}
```

Buat `src/ui/orbit/label.ts`:

```ts
import type { OrbitNode } from './types';

/** "7 terhubung · CCTV tidak terjangkau". Jumlahnya menghitung semua simpul, termasuk yang tidak terjangkau. */
export function ringLabel(nodes: Pick<OrbitNode, 'label' | 'offline'>[]): string {
  const off = nodes.filter((n) => n.offline).map((n) => n.label);
  const base = `${nodes.length} terhubung`;
  return off.length ? `${base} · ${off.join(', ')} tidak terjangkau` : base;
}
```

- [ ] **Langkah 4: Jalankan tes, pastikan lulus**

Jalankan: `npx jest __tests__/orbit-geometry.test.ts`

Hasil yang diharapkan: PASS, 4 tes.

- [ ] **Langkah 5: Commit**

```bash
git add src/ui/orbit __tests__/orbit-geometry.test.ts
git commit -m "feat: geometri dan tulisan cincin ekosistem"
```

---

### Tugas 8: Inti

**File:**
- Buat: `src/ui/inti/size.ts`, `src/ui/inti/Inti.tsx`.
- Tes: `__tests__/Inti.test.tsx`.

- [ ] **Langkah 1: Tulis tes yang gagal**

Buat `__tests__/Inti.test.tsx`:

```tsx
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Inti } from '@/ui/inti/Inti';
import { intiSize } from '@/ui/inti/size';

test('ukuran mengikuti rasio pita logo 282×310', () => {
  const s = intiSize(140);
  expect(s.w).toBe(127);
  expect(s.h).toBe(140);
  expect(s.dot).toBeCloseTo(9.52);
  expect(intiSize(36).dot).toBe(3);
});

test('tiga titik gelembung chat selalu ada', () => {
  render(<Inti size={140} state="think" />);
  expect(screen.getAllByTestId(/^inti-titik-/)).toHaveLength(3);
});

test('tanpa sinyal, Inti memudar', () => {
  render(<Inti size={140} state="off" />);
  expect(StyleSheet.flatten(screen.getByTestId('inti-inti').props.style).opacity).toBe(0.35);
});

test('mendengar menambah dua cincin, berbicara tiga gelombang', () => {
  render(<Inti size={140} state="listen" />);
  expect(screen.getAllByTestId(/^inti-cincin-/)).toHaveLength(2);
  screen.unmount();
  render(<Inti size={140} state="speak" />);
  expect(screen.getAllByTestId(/^inti-gelombang-/)).toHaveLength(3);
});
```

- [ ] **Langkah 2: Jalankan tes, pastikan gagal**

Jalankan: `npx jest __tests__/Inti.test.tsx`

Hasil yang diharapkan: FAIL, `Cannot find module '@/ui/inti/Inti'`.

- [ ] **Langkah 3: Tulis ukuran**

Buat `src/ui/inti/size.ts`:

```ts
/** Pita "S" berukuran 282×310. Tiga titik gelembung chat ada di 27,8 / 39,2 / 50,5 % lebar dan 72,3 % tinggi. */
export const DOT_X = [0.278, 0.392, 0.505] as const;
export const DOT_Y = 0.723;

export function intiSize(size: number): { w: number; h: number; dot: number } {
  return { w: Math.round((size * 282) / 310), h: size, dot: Math.max(3, size * 0.068) };
}
```

- [ ] **Langkah 4: Tulis Inti**

Waktu animasi diambil dari keyframe `sk-breath`, `sk-dot`, `sk-listen`, dan `sk-wave` di desain.

Buat `src/ui/inti/Inti.tsx`:

```tsx
import { useEffect, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { DOT_X, DOT_Y, intiSize } from './size';

export type IntiState = 'idle' | 'listen' | 'think' | 'speak' | 'off';

const RIBBON = require('../../../assets/brand/s-ribbon.png');
const RIBBON_LIGHT = require('../../../assets/brand/s-ribbon-light.png');
const SAGE = '#81C084';
const LISTEN_SCALE = [1.07, 1.02, 1.1, 1.03, 1.06, 1];
const LISTEN_MS = [210, 210, 252, 196, 252, 280];

interface Props {
  size: number;
  state?: IntiState;
  /** Di latar gelap (mode gelap, Mode Suara, alarm) pitanya hijau muda supaya tetap terbaca. */
  onDark?: boolean;
}

export function Inti({ size, state = 'idle', onDark = false }: Props) {
  const reduce = useReducedMotion();
  const { w, h, dot } = intiSize(size);
  const circle = (D: number) => ({
    position: 'absolute' as const,
    left: w / 2 - D / 2,
    top: h / 2 - D / 2,
    width: D,
    height: D,
    borderRadius: D / 2,
  });
  return (
    <View testID="inti" style={{ width: w, height: h }}>
      {state === 'listen' && (
        <>
          <Ring id={0} frame={circle(size * 1.22)} border={2} opacity={0.85} delay={0} reduce={reduce} />
          <Ring id={1} frame={circle(size * 1.48)} border={1.5} opacity={0.35} delay={250} reduce={reduce} />
        </>
      )}
      {state === 'speak' && [0, 1, 2].map((i) => <Wave key={i} index={i} frame={circle(size * 1.08)} reduce={reduce} />)}
      <View testID="inti-inti" style={[StyleSheet.absoluteFill, { opacity: state === 'off' ? 0.35 : 1 }]}>
        <Breath active={(state === 'idle' || state === 'speak') && !reduce}>
          <Image source={onDark ? RIBBON_LIGHT : RIBBON} style={{ width: w, height: h }} resizeMode="contain" />
          {DOT_X.map((x, i) => (
            <Dot
              key={i}
              index={i}
              left={x * w - dot / 2}
              top={DOT_Y * h - dot / 2}
              d={dot}
              color={onDark ? '#C9E6C7' : '#2A8A5C'}
              pulse={state === 'think' && !reduce}
            />
          ))}
        </Breath>
      </View>
    </View>
  );
}

/** Napas: skala 1,00 → 1,04 selama 4 detik, bolak-balik. */
function Breath({ active, children }: { active: boolean; children: ReactNode }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = active
      ? withRepeat(withTiming(1.04, { duration: 4000, easing: Easing.inOut(Easing.ease) }), -1, true)
      : withTiming(1, { duration: 200 });
  }, [active, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '50% 55%' }, style]}>{children}</Animated.View>;
}

/** Berpikir: tiap titik naik dan terang bergantian, jeda 180 ms, satu siklus 1,2 detik. */
function Dot(p: { index: number; left: number; top: number; d: number; color: string; pulse: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = p.pulse
      ? withDelay(
          p.index * 180,
          withRepeat(
            withSequence(withTiming(1, { duration: 420 }), withTiming(0, { duration: 420 }), withTiming(0, { duration: 360 })),
            -1,
          ),
        )
      : withTiming(0, { duration: 0 });
  }, [p.pulse, p.index, t]);
  const pulse = p.pulse;
  const d = p.d;
  const style = useAnimatedStyle(() =>
    pulse
      ? { opacity: 0.35 + 0.65 * t.value, transform: [{ translateY: -0.3 * d * t.value }] }
      : { opacity: 1, transform: [{ translateY: 0 }] },
  );
  return (
    <Animated.View
      testID={`inti-titik-${p.index}`}
      style={[
        { position: 'absolute', left: p.left, top: p.top, width: d, height: d, borderRadius: d / 2, backgroundColor: p.color },
        style,
      ]}
    />
  );
}

type Frame = { position: 'absolute'; left: number; top: number; width: number; height: number; borderRadius: number };

/** Mendengar: cincin berdenyut tak beraturan, satu siklus 1,4 detik. */
function Ring(p: { id: number; frame: Frame; border: number; opacity: number; delay: number; reduce: boolean }) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (p.reduce) return;
    s.value = withDelay(
      p.delay,
      withRepeat(withSequence(...LISTEN_SCALE.map((v, i) => withTiming(v, { duration: LISTEN_MS[i] }))), -1),
    );
  }, [p.reduce, p.delay, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View
      testID={`inti-cincin-${p.id}`}
      style={[p.frame, { borderWidth: p.border, borderColor: SAGE, opacity: p.opacity }, style]}
    />
  );
}

/** Berbicara: gelombang membesar 1 → 1,5 dan memudar, 2,4 detik, jeda 0,8 detik antar gelombang. */
function Wave(p: { index: number; frame: Frame; reduce: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (p.reduce) return;
    t.value = withDelay(p.index * 800, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.ease) }), -1));
  }, [p.reduce, p.index, t]);
  const reduce = p.reduce;
  const first = p.index === 0;
  const style = useAnimatedStyle(() =>
    reduce
      ? { opacity: first ? 0.4 : 0, transform: [{ scale: 1.2 }] }
      : { opacity: 0.55 * (1 - t.value), transform: [{ scale: 1 + 0.5 * t.value }] },
  );
  return (
    <Animated.View
      testID={`inti-gelombang-${p.index}`}
      style={[p.frame, { borderWidth: 1.5, borderColor: SAGE }, style]}
    />
  );
}
```

- [ ] **Langkah 5: Jalankan tes, pastikan lulus**

Jalankan: `npx jest __tests__/Inti.test.tsx`

Hasil yang diharapkan: PASS, 4 tes.

- [ ] **Langkah 6: Commit**

```bash
git add src/ui/inti __tests__/Inti.test.tsx
git commit -m "feat: Inti dengan lima keadaan"
```

---

### Tugas 9: Cincin ekosistem

**File:**
- Buat: `src/ui/orbit/Orbit.tsx`.
- Tes: `__tests__/Orbit.test.tsx`.

- [ ] **Langkah 1: Tulis tes yang gagal**

Buat `__tests__/Orbit.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Orbit } from '@/ui/orbit/Orbit';
import type { OrbitNode } from '@/ui/orbit/types';

const nodes: OrbitNode[] = [
  { key: 'gcal', icon: 'calendar', label: 'Google Kalender' },
  { key: 'cctv', icon: 'camera', label: 'CCTV', offline: true },
  { key: 'bank', icon: 'bank', label: 'Bank' },
];

test('setiap simpul terbaca oleh pembaca layar, yang tidak terjangkau disebut', () => {
  render(<Orbit nodes={nodes} flowEveryMs={0} />);
  expect(screen.getByLabelText('Google Kalender')).toBeTruthy();
  expect(screen.getByLabelText('CCTV, tidak terjangkau')).toBeTruthy();
  expect(screen.getByTestId('simpul-offline-cctv')).toBeTruthy();
});

test('ketuk Inti, tahan Inti, dan ketuk cincin memanggil aksinya masing-masing', () => {
  const onPressInti = jest.fn();
  const onLongPressInti = jest.fn();
  const onPressRing = jest.fn();
  render(
    <Orbit nodes={nodes} flowEveryMs={0} onPressInti={onPressInti} onLongPressInti={onLongPressInti} onPressRing={onPressRing} />,
  );
  const inti = screen.getByRole('button', { name: 'Bicara dengan Nadia' });
  fireEvent.press(inti);
  fireEvent(inti, 'longPress');
  fireEvent.press(screen.getByRole('button', { name: 'Buka Terhubung' }));
  expect(onPressInti).toHaveBeenCalledTimes(1);
  expect(onLongPressInti).toHaveBeenCalledTimes(1);
  expect(onPressRing).toHaveBeenCalledTimes(1);
});
```

- [ ] **Langkah 2: Jalankan tes, pastikan gagal**

Jalankan: `npx jest __tests__/Orbit.test.tsx`

Hasil yang diharapkan: FAIL, `Cannot find module '@/ui/orbit/Orbit'`.

- [ ] **Langkah 3: Tulis Orbit**

Buat `src/ui/orbit/Orbit.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import { DEFAULT_ASSISTANT } from '@/brand';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from '@/ui/Icon';
import { Inti, type IntiState } from '@/ui/inti/Inti';
import { intiSize } from '@/ui/inti/size';
import { orbitLayout } from './geometry';
import type { OrbitNode } from './types';

const NODE = 44;

interface Props {
  nodes: OrbitNode[];
  intiState?: IntiState;
  onPressInti?: () => void;
  onLongPressInti?: () => void;
  onPressRing?: () => void;
  /** Jeda antar aliran titik. 0 mematikan aliran (dipakai tes). */
  flowEveryMs?: number;
}

export function Orbit({ nodes, intiState = 'idle', onPressInti, onLongPressInti, onPressRing, flowEveryMs = 3000 }: Props) {
  const { c, scheme } = useTheme();
  const { width } = useWindowDimensions();
  // Desain 360 lebar di layar 412. Di layar 360, semuanya diperkecil kecuali simpul (tetap 44, mudah disentuh).
  const k = Math.min(1, (width - 40) / 360);
  const W = 360 * k;
  const H = 304 * k;
  const r = 126 * k;
  const intiPx = Math.round(140 * k);
  const layout = orbitLayout(nodes.length, { W, H, r, ri: 80 * k, node: NODE });
  const [flow, setFlow] = useState<{ node: number; tick: number } | null>(null);

  useEffect(() => {
    if (!flowEveryMs) return;
    const live = nodes.flatMap((n, i) => (n.offline ? [] : [i]));
    if (!live.length) return;
    const id = setInterval(() => {
      setFlow((f) => ({ node: live[Math.floor(Math.random() * live.length)]!, tick: (f?.tick ?? 0) + 1 }));
    }, flowEveryMs);
    return () => clearInterval(id);
  }, [nodes, flowEveryMs]);

  const flowLine = flow ? layout.nodes[flow.node]?.line : undefined;
  const iw = intiSize(intiPx).w;

  return (
    <Pressable
      onPress={onPressRing}
      accessibilityRole="button"
      accessibilityLabel="Buka Terhubung"
      style={{ width: W, height: H }}
    >
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Circle cx={layout.cx} cy={layout.cy} r={r} fill="none" stroke={c.sage} strokeOpacity={0.55} strokeWidth={1} />
        {layout.nodes.map((p, i) => (
          <Line
            key={nodes[i]!.key}
            x1={p.line.x1}
            y1={p.line.y1}
            x2={p.line.x2}
            y2={p.line.y2}
            stroke={c.sage}
            strokeOpacity={nodes[i]!.offline ? 0.3 : 0.6}
            strokeWidth={1}
            strokeDasharray={nodes[i]!.offline ? '3 4' : undefined}
          />
        ))}
      </Svg>
      {layout.nodes.map((p, i) => (
        <Node key={nodes[i]!.key} node={nodes[i]!} x={p.x} y={p.y} />
      ))}
      {flowLine && <FlowDot key={flow!.tick} from={{ x: flowLine.x2, y: flowLine.y2 }} to={{ x: flowLine.x1, y: flowLine.y1 }} />}
      <Pressable
        onPress={onPressInti}
        onLongPress={onLongPressInti}
        delayLongPress={450}
        accessibilityRole="button"
        accessibilityLabel={`Bicara dengan ${DEFAULT_ASSISTANT}`}
        accessibilityHint="Ketuk untuk chat, tahan untuk bicara"
        style={{ position: 'absolute', left: layout.cx - iw / 2, top: layout.cy - intiPx / 2 }}
      >
        <Inti size={intiPx} state={intiState} onDark={scheme === 'dark'} />
      </Pressable>
    </Pressable>
  );
}

function Node({ node, x, y }: { node: OrbitNode; x: number; y: number }) {
  const { c } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={node.offline ? `${node.label}, tidak terjangkau` : node.label}
      testID={node.offline ? `simpul-offline-${node.key}` : `simpul-${node.key}`}
      style={{
        position: 'absolute',
        left: x - NODE / 2,
        top: y - NODE / 2,
        width: NODE,
        height: NODE,
        borderRadius: NODE / 2,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: node.offline ? c.paper : c.card,
        opacity: node.offline ? 0.7 : 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={node.icon} size={22} color={node.offline ? c.muted : c.ink} />
      {node.offline && (
        <View
          style={{
            position: 'absolute',
            top: -1,
            right: -1,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: c.clay,
            borderWidth: 2,
            borderColor: c.paper,
          }}
        />
      )}
    </View>
  );
}

/** Satu titik cahaya dari simpul ke Inti, 600 ms. Kalau gerak dikurangi: berkedip sekali di simpul. */
function FlowDot({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) });
  }, [t]);
  const style = useAnimatedStyle(() => {
    const k = reduce ? 0 : t.value;
    const fade = t.value < 0.15 ? t.value / 0.15 : t.value > 0.85 ? (1 - t.value) / 0.15 : 1;
    return {
      opacity: reduce ? Math.sin(Math.PI * t.value) : fade,
      transform: [{ translateX: from.x + (to.x - from.x) * k - 4 }, { translateY: from.y + (to.y - from.y) * k - 4 }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, top: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: c.leaf, borderWidth: 2, borderColor: c.paper },
        style,
      ]}
    />
  );
}
```

- [ ] **Langkah 4: Jalankan tes, pastikan lulus**

Jalankan: `npx jest __tests__/Orbit.test.tsx`

Hasil yang diharapkan: PASS, 2 tes.

- [ ] **Langkah 5: Commit**

```bash
git add src/ui/orbit/Orbit.tsx __tests__/Orbit.test.tsx
git commit -m "feat: cincin ekosistem dengan aliran titik"
```

---

### Tugas 10: Chat kosong dan Mode Suara

**File:**
- Buat: `app/chat.tsx`, `app/suara.tsx`.
- Tes: `__tests__/screens.test.tsx`.

- [ ] **Langkah 1: Tulis tes yang gagal**

Buat `__tests__/screens.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Chat from '../app/chat';
import Suara from '../app/suara';

beforeEach(() => jest.clearAllMocks());

test('chat kosong menawarkan empat saran dan bisa pindah ke Mode Suara', () => {
  render(<Chat />);
  expect(screen.getByText('Mau saya bantu urus apa?')).toBeTruthy();
  for (const s of ['Ringkas email hari ini', 'Matikan semua lampu', 'Cek stok kedai', 'Beli token listrik']) {
    expect(screen.getByRole('button', { name: s })).toBeTruthy();
  }
  fireEvent.press(screen.getByRole('button', { name: 'Mode Suara' }));
  expect(router.replace).toHaveBeenCalledWith('/suara');
});

test('Mode Suara: Selesai menutup, Pindah ke ketik membuka chat', () => {
  render(<Suara />);
  fireEvent.press(screen.getByRole('button', { name: 'Selesai' }));
  expect(router.back).toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Pindah ke ketik' }));
  expect(router.replace).toHaveBeenCalledWith('/chat');
});
```

- [ ] **Langkah 2: Jalankan tes, pastikan gagal**

Jalankan: `npx jest __tests__/screens.test.tsx`

Hasil yang diharapkan: FAIL, `Cannot find module '../app/chat'`.

- [ ] **Langkah 3: Tulis Chat kosong (desain 1d)**

Buat `app/chat.tsx`:

```tsx
import { router } from 'expo-router';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_ASSISTANT } from '@/brand';
import { useTheme } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import type { IconName } from '@/ui/icons';
import { Inti } from '@/ui/inti/Inti';
import { Txt } from '@/ui/Txt';

const SUGGESTIONS: { icon: IconName; text: string }[] = [
  { icon: 'mail', text: 'Ringkas email hari ini' },
  { icon: 'bulb', text: 'Matikan semua lampu' },
  { icon: 'store', text: 'Cek stok kedai' },
  { icon: 'bolt', text: 'Beli token listrik' },
];

// Fase 0: tampilan saja. Mengirim pesan dan riwayat chat dibangun di Fase 1.
export default function Chat() {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.paper, paddingTop: insets.top }}>
      <View
        style={{
          height: 64,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 8,
          borderBottomWidth: 1,
          borderBottomColor: c.line,
        }}
      >
        <IconButton icon="back" label="Kembali" onPress={() => router.back()} />
        <Inti size={36} onDark={scheme === 'dark'} />
        <View style={{ flex: 1, marginLeft: 4 }}>
          <Txt v="subtitle">{DEFAULT_ASSISTANT}</Txt>
          <Txt v="caption" color={c.muted}>
            Siap membantu
          </Txt>
        </View>
        <IconButton icon="wave" label="Mode Suara" tinted onPress={() => router.replace('/suara')} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 16 }}>
        <Txt v="caption" color={c.muted} style={{ alignSelf: 'center', maxWidth: 300, textAlign: 'center' }}>
          {DEFAULT_ASSISTANT} ingat semua obrolan Anda, di aplikasi maupun di WhatsApp.
        </Txt>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <Inti size={104} onDark={scheme === 'dark'} />
          <Txt v="title" style={{ textAlign: 'center' }}>
            Mau saya bantu urus apa?
          </Txt>
        </View>
        <View style={{ gap: 8 }}>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s.text}
              accessibilityRole="button"
              accessibilityLabel={s.text}
              style={{
                height: 52,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: c.line,
                backgroundColor: c.card,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Icon name={s.icon} size={22} color={c.green} />
              <Txt>{s.text}</Txt>
            </Pressable>
          ))}
        </View>
      </View>

      <View
        style={{
          height: 88 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <IconButton icon="clip" label="Lampiran" color={c.muted} />
        <TextInput
          placeholder={`Tulis pesan untuk ${DEFAULT_ASSISTANT}`}
          placeholderTextColor={c.muted}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: c.line,
            backgroundColor: c.card,
            paddingHorizontal: 20,
            fontFamily: FONT[400],
            fontSize: 16,
            color: c.ink,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bicara"
          onPress={() => router.replace('/suara')}
          style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="mic" size={24} color={c.onGreen} />
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Langkah 4: Tulis Mode Suara (desain 1e)**

Buat `app/suara.tsx`:

```tsx
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_ASSISTANT } from '@/brand';
import { useTheme } from '@/theme/ThemeProvider';
import { onForest } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import type { IconName } from '@/ui/icons';
import { Inti } from '@/ui/inti/Inti';
import { Txt } from '@/ui/Txt';

// Fase 0: isi contoh. Rekaman, teks langsung, dan suara balasan dibangun di Fase 6.
export default function Suara() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.voice, paddingTop: insets.top + 24 }}>
      <StatusBar style="light" />
      <View style={{ paddingHorizontal: 28, gap: 8, minHeight: 120 }}>
        <Txt v="caption" color={onForest.soft}>
          Anda
        </Txt>
        <Txt weight={500} color={onForest.text} style={{ fontSize: 20, lineHeight: 28 }}>
          Matikan AC kamar dan ingatkan saya jam 7 pagi <Text style={{ color: onForest.hint }}>berangkat ke bandara.</Text>
        </Txt>
      </View>
      <View style={{ height: 340, alignItems: 'center', justifyContent: 'center' }}>
        <Inti size={200} state="speak" onDark />
      </View>
      <View style={{ paddingHorizontal: 28, gap: 8 }}>
        <Txt v="caption" color={onForest.soft}>
          {DEFAULT_ASSISTANT}
        </Txt>
        <Txt weight={600} color={onForest.strong} style={{ fontSize: 26, lineHeight: 34, letterSpacing: -0.26 }}>
          Siap. AC kamar sudah mati, dan alarm jam 07.00 sudah saya pasang.
        </Txt>
      </View>
      <View
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: insets.bottom + 36,
          flexDirection: 'row',
          alignItems: 'flex-start',
        }}
      >
        <RoundAction icon="micOff" label="Bisukan mic" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Selesai"
          onPress={() => router.back()}
          style={{ height: 56, paddingHorizontal: 40, borderRadius: 28, backgroundColor: onForest.strong, justifyContent: 'center' }}
        >
          <Txt v="subtitle" color="#0E3A2C">
            Selesai
          </Txt>
        </Pressable>
        <RoundAction icon="keyboard" label="Pindah ke ketik" onPress={() => router.replace('/chat')} />
      </View>
    </View>
  );
}

function RoundAction({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: onForest.buttonLine,
          backgroundColor: onForest.button,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={24} color={onForest.text} />
      </Pressable>
      <Txt v="caption" color={onForest.label}>
        {label}
      </Txt>
    </View>
  );
}
```

- [ ] **Langkah 5: Jalankan tes, pastikan lulus**

Jalankan: `npx jest __tests__/screens.test.tsx`

Hasil yang diharapkan: PASS, 2 tes.

- [ ] **Langkah 6: Commit**

```bash
git add app/chat.tsx app/suara.tsx __tests__/screens.test.tsx
git commit -m "feat: layar chat kosong dan Mode Suara"
```

---

### Tugas 11: Tab bar dan tab

**File:**
- Buat: `src/ui/TabBar.tsx`, `src/ui/LaterScreen.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/agenda.tsx`,
  `app/(tabs)/perangkat.tsx`, `app/(tabs)/usaha.tsx`.
- Hapus: `app/index.tsx`. Rute `/` akan dipegang `app/(tabs)/index.tsx` di Tugas 12.
- Tes: `__tests__/TabBar.test.tsx`.

- [ ] **Langkah 1: Tulis tes yang gagal**

Buat `__tests__/TabBar.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { TabBar } from '@/ui/TabBar';

beforeEach(() => jest.clearAllMocks());

async function setup(index = 0) {
  const emitter = { emit: jest.fn(() => ({ defaultPrevented: false })) };
  const navigateToTab = jest.fn();
  const routes = ['index', 'agenda', 'perangkat', 'usaha'].map((name) => ({ key: `${name}-k`, name }));
  const props = {
    state: { index, routes },
    descriptors: {},
    emitter,
    navigateToTab,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  } as unknown as BottomTabBarProps;
  await render(<TabBar {...props} />);
  return { emitter, navigateToTab };
}

test('urutan tab sesuai desain, Inti di tengah', async () => {
  await setup();
  const tabs = screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel);
  expect(tabs).toEqual(['Beranda', 'Agenda', 'Perangkat', 'Usaha']);
  expect(screen.getByRole('button', { name: 'Bicara dengan Nadia' })).toBeTruthy();
});

test('ketuk Agenda pindah tab', async () => {
  const { emitter, navigateToTab } = await setup();
  await fireEvent.press(screen.getByRole('tab', { name: 'Agenda' }));
  expect(emitter.emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'agenda-k', canPreventDefault: true });
  expect(navigateToTab).toHaveBeenCalledWith('agenda-k');
});

test('ketuk tab yang sedang aktif tidak berpindah', async () => {
  const { navigateToTab } = await setup(0);
  await fireEvent.press(screen.getByRole('tab', { name: 'Beranda' }));
  expect(navigateToTab).not.toHaveBeenCalled();
});

test('ketuk Inti membuka chat, tahan Inti membuka Mode Suara dengan getar', async () => {
  await setup();
  const inti = screen.getByRole('button', { name: 'Bicara dengan Nadia' });
  await fireEvent.press(inti);
  expect(router.push).toHaveBeenCalledWith('/chat');
  await fireEvent(inti, 'longPress');
  expect(Haptics.impactAsync).toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith('/suara');
});
```

- [ ] **Langkah 2: Jalankan tes, pastikan gagal**

Jalankan: `npx jest __tests__/TabBar.test.tsx`

Hasil yang diharapkan: FAIL, `Cannot find module '@/ui/TabBar'`.

- [ ] **Langkah 3: Tulis TabBar**

Buat `src/ui/TabBar.tsx`:

```tsx
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { DEFAULT_ASSISTANT } from '@/brand';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Inti } from './inti/Inti';
import { Txt } from './Txt';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Beranda', icon: 'home' },
  agenda: { label: 'Agenda', icon: 'calendar' },
  perangkat: { label: 'Perangkat', icon: 'bulb' },
  usaha: { label: 'Usaha', icon: 'store' },
};

/** Beranda · Agenda · [Inti] · Perangkat · Usaha. Inti bukan tab: ketuk membuka chat, tahan membuka Mode Suara. */
export function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { c, scheme } = useTheme();

  const tab = (index: number) => {
    const route = state.routes[index];
    const meta = route && TABS[route.name];
    if (!route || !meta) return null;
    const active = state.index === index;
    const color = active ? c.green : c.muted;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={meta.label}
        accessibilityState={{ selected: active }}
        onPress={() => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) navigateToTab(route.key);
        }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}
      >
        <Icon name={meta.icon} size={24} color={color} />
        <Txt v="caption" weight={active ? 600 : 500} color={color}>
          {meta.label}
        </Txt>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        height: 88 + insets.bottom,
        paddingBottom: insets.bottom,
        paddingHorizontal: 4,
        flexDirection: 'row',
        backgroundColor: c.card,
        borderTopWidth: 1,
        borderTopColor: c.line,
      }}
    >
      {tab(0)}
      {tab(1)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Bicara dengan ${DEFAULT_ASSISTANT}`}
        accessibilityHint="Ketuk untuk chat, tahan untuk bicara"
        onPress={() => router.push('/chat')}
        onLongPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/suara');
        }}
        delayLongPress={450}
        style={{ flex: 1, alignItems: 'center', gap: 4, marginTop: -26 }}
      >
        <View
          style={{
            width: 68,
            height: 68,
            borderRadius: 34,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Inti size={50} onDark={scheme === 'dark'} />
        </View>
        <Txt v="caption" weight={600}>
          {DEFAULT_ASSISTANT}
        </Txt>
      </Pressable>
      {tab(2)}
      {tab(3)}
    </View>
  );
}
```

- [ ] **Langkah 4: Jalankan tes, pastikan lulus**

Jalankan: `npx jest __tests__/TabBar.test.tsx`

Hasil yang diharapkan: PASS, 4 tes.

- [ ] **Langkah 5: Tulis layout tab dan isi sementara**

Buat `src/ui/LaterScreen.tsx`:

```tsx
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Txt } from './Txt';

/** Tab yang layarnya dibangun di fase berikutnya. Hanya terlihat di build uji. */
export function LaterScreen({ title, phase }: { title: string; phase: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.paper, paddingTop: insets.top + 24, paddingHorizontal: 20, gap: 8 }}>
      <Txt v="title">{title}</Txt>
      <Txt color={c.muted}>Layar ini dibangun di {phase}.</Txt>
    </View>
  );
}
```

Buat `app/(tabs)/_layout.tsx`:

```tsx
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
```

Buat `app/(tabs)/agenda.tsx`:

```tsx
import { LaterScreen } from '@/ui/LaterScreen';

export default function Agenda() {
  return <LaterScreen title="Agenda" phase="Fase 2" />;
}
```

Buat `app/(tabs)/perangkat.tsx`:

```tsx
import { LaterScreen } from '@/ui/LaterScreen';

export default function Perangkat() {
  return <LaterScreen title="Perangkat" phase="Fase 3" />;
}
```

Buat `app/(tabs)/usaha.tsx`:

```tsx
import { LaterScreen } from '@/ui/LaterScreen';

export default function Usaha() {
  return <LaterScreen title="Usaha" phase="Fase 4" />;
}
```

Hapus rute akar bawaan template: `rm app/index.tsx`.

- [ ] **Langkah 6: Commit**

Beranda belum ada, jadi `/` belum punya layar sampai Tugas 12.

```bash
git add -A
git commit -m "feat: tab bar dengan Inti di tengah"
```

---

### Tugas 12: Beranda (desain 1a dan 1f)

**File:**
- Buat: `src/sample/home.ts`, `app/(tabs)/index.tsx`.
- Tes: `__tests__/Beranda.test.tsx`.

- [ ] **Langkah 1: Tulis tes yang gagal**

Buat `__tests__/Beranda.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ThemeProvider } from '@/theme/ThemeProvider';
import Beranda from '../app/(tabs)/index';

beforeEach(() => jest.clearAllMocks());

test('Beranda menampilkan isi desain 1a', () => {
  render(<Beranda />);
  expect(screen.getByText('Selamat pagi, Rina')).toBeTruthy();
  expect(screen.getByText('7 terhubung · CCTV tidak terjangkau')).toBeTruthy();
  expect(screen.getByText('Butuh persetujuan Anda')).toBeTruthy();
  expect(screen.getByText('Bayar listrik Kedai Dago')).toBeTruthy();
  expect(screen.getByText('Rp4.250.000')).toBeTruthy();
  expect(screen.getByText('Susu UHT tinggal 6 karton')).toBeTruthy();
});

test('sakelar AC mengubah tulisannya', () => {
  render(<Beranda />);
  fireEvent.press(screen.getByRole('switch', { name: 'AC kamar' }));
  expect(screen.getByText('AC kamar mati')).toBeTruthy();
});

test('Lihat di kartu persetujuan membuka chat', () => {
  render(<Beranda />);
  fireEvent.press(screen.getByRole('button', { name: 'Lihat' }));
  expect(router.push).toHaveBeenCalledWith('/chat');
});

test('mode gelap tetap menampilkan isi yang sama', () => {
  render(
    <ThemeProvider scheme="dark">
      <Beranda />
    </ThemeProvider>,
  );
  expect(screen.getByText('Selamat pagi, Rina')).toBeTruthy();
});
```

- [ ] **Langkah 2: Jalankan tes, pastikan gagal**

Jalankan: `npx jest __tests__/Beranda.test.tsx`

Hasil yang diharapkan: FAIL, `Cannot find module '../app/(tabs)/index'`.

- [ ] **Langkah 3: Tulis data contoh**

Buat `src/sample/home.ts`:

```ts
import type { IconName } from '@/ui/icons';
import type { OrbitNode } from '@/ui/orbit/types';

/** Data contoh Fase 0, sama dengan desain 1a. Di Fase 2 diganti respons /app/v1/home. */
export const homeSample = {
  name: 'Rina',
  initials: 'RW',
  place: 'Semua',
  summary: 'Ada 3 hal yang perlu Anda hari ini.',
  nodes: [
    { key: 'gcal', icon: 'calendar', label: 'Google Kalender' },
    { key: 'gmail', icon: 'mail', label: 'Gmail' },
    { key: 'wa', icon: 'chat', label: 'WhatsApp' },
    { key: 'ac', icon: 'snow', label: 'AC kamar' },
    { key: 'cctv', icon: 'camera', label: 'CCTV', offline: true },
    { key: 'kasir', icon: 'receipt', label: 'Kasir Kopi Rindang' },
    { key: 'bank', icon: 'bank', label: 'Bank' },
  ] satisfies OrbitNode[],
  approval: 'Balasan untuk Pak Budi soal harga sewa sudah siap. Kirim?',
  agenda: [
    { time: '09.00', title: 'Rapat dengan supplier susu' },
    { time: '13.00', title: 'Bayar listrik Kedai Dago' },
    { time: '16.00', title: 'Jemput Kayla les' },
  ],
  house: {
    acOn: true,
    acTemp: 24,
    others: [
      { icon: 'lock', text: 'Pintu depan terkunci' },
      { icon: 'camera', text: 'Kamera aktif' },
    ] satisfies { icon: IconName; text: string }[],
  },
  business: {
    source: 'dari Moka',
    sales: 'Rp4.250.000',
    change: 'naik 12% dari Senin lalu',
    alert: 'Susu UHT tinggal 6 karton',
  },
};
```

- [ ] **Langkah 4: Tulis Beranda**

Buat `app/(tabs)/index.tsx`:

```tsx
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { homeSample } from '@/sample/home';
import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import type { IconName } from '@/ui/icons';
import { Orbit } from '@/ui/orbit/Orbit';
import { ringLabel } from '@/ui/orbit/label';
import { Toggle } from '@/ui/Toggle';
import { Txt } from '@/ui/Txt';

export default function Beranda() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const d = homeSample;
  const [acOn, setAcOn] = useState(d.house.acOn);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.paper }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 12, paddingRight: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Tempat: ${d.place}`}
          style={{
            height: 48,
            paddingLeft: 16,
            paddingRight: 12,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: c.line,
            backgroundColor: c.card,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Txt weight={600}>{d.place}</Txt>
          <Icon name="chevD" size={20} color={c.ink} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Akun"
          onLongPress={__DEV__ ? () => router.push('/inti') : undefined}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.mint, alignItems: 'center', justifyContent: 'center' }}
        >
          <Txt weight={700} color={c.green} style={{ fontSize: 15 }}>
            {d.initials}
          </Txt>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 8 }}>
        <Txt v="display">Selamat pagi, {d.name}</Txt>
        <Txt v="subtitle" weight={400} color={c.muted}>
          {d.summary}
        </Txt>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 16, alignItems: 'center' }}>
        <Orbit
          nodes={d.nodes}
          onPressInti={() => router.push('/chat')}
          onLongPressInti={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/suara');
          }}
        />
        <Pressable accessibilityRole="button" style={{ height: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt v="caption" color={c.muted}>
            {ringLabel(d.nodes)}
          </Txt>
          <Icon name="chevR" size={16} color={c.muted} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
        <View style={{ backgroundColor: c.mint, borderRadius: 24, padding: 20, gap: 16 }}>
          <Txt v="caption" weight={600} color={c.green}>
            Butuh persetujuan Anda
          </Txt>
          <Txt>{d.approval}</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Lihat"
            onPress={() => router.push('/chat')}
            style={{ height: 48, borderRadius: 24, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' }}
          >
            <Txt weight={600} color={c.onGreen}>
              Lihat
            </Txt>
          </Pressable>
        </View>

        <Card style={{ paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Txt v="subtitle">Agenda hari ini</Txt>
            <Pressable accessibilityRole="link" onPress={() => router.navigate('/agenda')} style={{ paddingVertical: 12, paddingLeft: 12 }}>
              <Txt weight={600} color={c.green} style={{ fontSize: 15 }}>
                Lihat semua
              </Txt>
            </Pressable>
          </View>
          {d.agenda.map((a, i) => (
            <View
              key={a.time}
              style={{
                flexDirection: 'row',
                gap: 16,
                paddingVertical: 12,
                borderBottomWidth: i < d.agenda.length - 1 ? 1 : 0,
                borderBottomColor: c.line,
              }}
            >
              <Txt weight={600} tabular style={{ width: 52 }}>
                {a.time}
              </Txt>
              <Txt style={{ flex: 1 }}>{a.title}</Txt>
            </View>
          ))}
        </Card>

        <Card style={{ gap: 4 }}>
          <Txt v="subtitle" style={{ marginBottom: 8 }}>
            Rumah
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
            <IconTile icon="snow" tinted />
            <Txt weight={500} style={{ flex: 1 }}>
              {acOn ? `AC kamar nyala · ${d.house.acTemp}°` : 'AC kamar mati'}
            </Txt>
            <Toggle value={acOn} onChange={setAcOn} label="AC kamar" />
          </View>
          {d.house.others.map((o) => (
            <View key={o.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
              <IconTile icon={o.icon} />
              <Txt style={{ flex: 1 }}>{o.text}</Txt>
            </View>
          ))}
        </Card>

        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Txt v="subtitle">Usaha</Txt>
            <Txt v="caption" color={c.muted}>
              {d.business.source}
            </Txt>
          </View>
          <View style={{ gap: 2 }}>
            <Txt v="caption" color={c.muted}>
              Penjualan hari ini
            </Txt>
            <Txt weight={600} tabular style={{ fontSize: 28, lineHeight: 36, letterSpacing: -0.28 }}>
              {d.business.sales}
            </Txt>
            <Txt weight={500} color={c.leafText}>
              {d.business.change}
            </Txt>
          </View>
          <View
            style={{
              backgroundColor: c.clayBg,
              borderRadius: 16,
              paddingVertical: 12,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.clay }} />
            <Txt weight={500} color={c.clay}>
              {d.business.alert}
            </Txt>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}

function IconTile({ icon, tinted = false }: { icon: IconName; tinted?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: tinted ? c.mint : c.paper,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={22} color={tinted ? c.green : c.ink} />
    </View>
  );
}
```

- [ ] **Langkah 5: Jalankan tes, pastikan lulus**

Jalankan: `npx jest __tests__/Beranda.test.tsx`

Hasil yang diharapkan: PASS, 4 tes.

- [ ] **Langkah 6: Commit**

```bash
git add src/sample app/\(tabs\)/index.tsx __tests__/Beranda.test.tsx
git commit -m "feat: Beranda dengan data contoh"
```

---

### Tugas 13: Pemeriksa Inti dan Stack lengkap

**File:**
- Buat: `app/inti.tsx`.
- Ubah: `app/_layout.tsx` (fungsi `Navigator`).

- [ ] **Langkah 1: Tulis layar pemeriksa Inti (desain 1k)**

Layar ini dibuka dengan menahan foto profil di Beranda, dan hanya ada di build development.

Buat `app/inti.tsx`:

```tsx
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onForest } from '@/theme/tokens';
import { IconButton } from '@/ui/IconButton';
import { Inti, type IntiState } from '@/ui/inti/Inti';
import { Txt } from '@/ui/Txt';

const STATES: { state: IntiState; name: string; desc: string }[] = [
  { state: 'idle', name: 'Diam', desc: 'Bernapas pelan, 1,00 → 1,04 tiap 4 detik.' },
  { state: 'listen', name: 'Mendengar', desc: 'Cincin luar mengikuti keras-pelannya suara.' },
  { state: 'think', name: 'Berpikir', desc: 'Tiga titik berdenyut bergantian.' },
  { state: 'speak', name: 'Berbicara', desc: 'Gelombang lembut keluar dari tepi Inti.' },
  { state: 'off', name: 'Tanpa sinyal', desc: 'Sinyal lemah, permintaan Anda saya simpan dulu.' },
];

export default function IntiPreview() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#0E3A2C', paddingTop: insets.top }}>
      <StatusBar style="light" />
      <IconButton icon="back" label="Kembali" color={onForest.text} onPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40, gap: 40, alignItems: 'center' }}>
        {STATES.map((s) => (
          <View key={s.state} style={{ alignItems: 'center', gap: 20 }}>
            <View style={{ height: 200, justifyContent: 'center' }}>
              <Inti size={140} state={s.state} onDark />
            </View>
            <Txt v="subtitle" color={onForest.strong}>
              {s.name}
            </Txt>
            <Txt v="caption" color={onForest.soft} style={{ textAlign: 'center', maxWidth: 260 }}>
              {s.desc}
            </Txt>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Langkah 2: Daftarkan layar di Stack**

Di `app/_layout.tsx`, ganti fungsi `Navigator` dengan:

```tsx
function Navigator() {
  const { c, scheme } = useTheme();
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
```

- [ ] **Langkah 3: Jalankan semua tes dan cek tipe**

`npx expo start` membuat tipe rute. Hentikan dengan Ctrl+C setelah muncul `Logs for your project will appear below`.

Jalankan:

```bash
npx expo start
npm run typecheck && npm test
```

Hasil yang diharapkan: `tsc` tanpa error, dan Jest PASS di 10 file tes.

- [ ] **Langkah 4: Commit**

```bash
git add app/inti.tsx app/_layout.tsx
git commit -m "feat: pemeriksa Inti dan Stack lengkap"
```

---

### Tugas 14: Pasang di HP dan cocokkan dengan desain

**File:** tidak ada perubahan kode, kecuali ada temuan.

- [ ] **Langkah 1: Buat development build di HP**

Pastikan HP tersambung (`adb devices`), lalu jalankan: `npx expo run:android`

Hasil yang diharapkan: aplikasi "Sekretaris AI" terpasang dan terbuka di Beranda. Build pertama memakan
5–15 menit.

- [ ] **Langkah 2: Cocokkan dengan desain**

Buka `design/handoff/sekretaris-ai-mobile-app-design/project/Sekretaris AI.dc.html` di browser sebagai pembanding.
Centang tiap butir:

1. Beranda terang sama dengan **1a**: urutan, ukuran huruf, jarak, kartu persetujuan di atas.
2. Ubah HP ke mode gelap. Beranda sama dengan **1f**, dan pita Inti berganti hijau muda.
3. Inti di cincin bernapas pelan. Tiap 3 detik satu titik mengalir dari simpul ke Inti. CCTV abu-abu dengan titik
   clay dan garis putus-putus.
4. Ketuk Inti (di cincin maupun tab bar) membuka Chat kosong yang sama dengan **1d**.
5. Tahan Inti: HP bergetar, lalu Mode Suara terbuka dan sama dengan **1e**, dengan tiga gelombang dari Inti.
6. Tombol Selesai menutup Mode Suara. Pindah ke ketik membuka Chat.
7. Tahan foto profil "RW": muncul pemeriksa Inti dengan 5 keadaan, sama dengan **1k**.
8. Buka **Pengaturan → Aksesibilitas → Hapus animasi**: Inti diam, dan aliran titik hanya berkedip.
9. Perbesar **Ukuran tampilan** sampai lebar layar sekitar 360dp: cincin mengecil, tidak ada yang terpotong.
10. Ikon aplikasi di layar utama: tanda "S" di latar paper, tidak terpotong masker. Ikon bertema Android ikut warna.

- [ ] **Langkah 3: Catat temuan dan perbaiki**

Setiap selisih dengan desain diperbaiki di file komponennya, satu commit per perbaikan. Contoh:
`git commit -m "fix: jarak kartu Beranda sesuai 1a"`.

- [ ] **Langkah 4: Tandai Fase 0 selesai**

```bash
git tag fase-0
```

---

## Setelah Fase 0

Tulis rencana Fase 1 (`docs/plans/<tanggal>-fase-1-masuk-dan-chat.md`) setelah membaca ulang ROADMAP. Mulai dengan
bagian server di milo-ai: `src/appapi/`.
