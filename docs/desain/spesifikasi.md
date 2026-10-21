# Sekretaris AI, Fase R: visual direction spec (v2)

Companion to `index.html` (animations run live; `?solo=<frame-id>` shows one frame at device size) and `shots/`. v1 is kept in `shots-v1/`, `board-v1.png`, `index-v1.html`, `spec-v1.md`. Everything here maps to React Native (Expo SDK 58, RN 0.88, New Architecture). Values are dp.

## 0. What changed in v2 (founder review)

1. **Green is the brand again.** Target mix: about 60% warm neutrals, 30% brand green, 10% small category markers. Green carries the hero field, the Inti, the active tab, primary buttons, and **every "on" state** (device tiles, power keys, switches, selected options). Off is neutral.
2. **Category colours are markers only.** Blue / orange / violet / sky appear only as an icon tint inside a neutral circle, a small dot, or a chart line. Never as a large fill, a section title, or a tinted surface. The AC dial keeps a cool-blue arc as a detail.
3. **Comfort first.** One purpose per screen, at most three blocks on Beranda, 56 dp main controls, no explanatory sublines, nothing that has to be read to be understood. Test: would a busy 45-year-old shop owner feel calm and know what to tap in 2 seconds?
4. **Progressive disclosure over time.** A new user sees an almost empty Beranda with one suggestion and two tabs. Blocks, tabs and tips appear only when they have content (§6).
5. **Remotes show 3 to 5 big controls.** Everything else is behind one **Lainnya** button that opens a sheet.

---

## 1. Palette and roles

### 1.1 Neutrals (60%)

| Token | Light | Dark |
|---|---|---|
| `bg` | `#F7F6F2` | `#0E1012` |
| `surface` | `#FFFFFF` | `#171A1E` |
| `raised` | `#FFFFFF` | `#1F2328` |
| `sunken` | `#F0EEE8` | `#202328` |
| `sunken2` | `#E6E3DB` | `#2A2E34` |
| `text` | `#15181B` | `#F2F3F5` |
| `muted` | `#64686F` | `#9CA1A8` |
| `faint` (decorative only) | `#A4A7AC` | `#5E636A` |
| `line` | `#E9E7E1` | `#262A30` |
| `tabbar` | `#FFFFFF` | `#131619` |
| `voiceCanvas` | `#07090B` | `#07090B` |

Dark mode stays neutral charcoal. Green appears there as accents and light (icon fills, glows, the power key), never as a green surface.

### 1.2 Brand green (30%)

| Token | Light | Dark | Role |
|---|---|---|---|
| `brand` | `#1D7550` | `#5BBF86` | Primary button, on-state fill (tile icon circle, power key, switch track, selected day), Inti, now-line |
| `onBrand` | `#FFFFFF` (5.66:1) | `#0E1012` (8.39:1) | Text/icon on `brand` |
| `brandInk` | `#1D7550` | `#5BBF86` | Green text: active tab label, "Nyala" / "24°" state, Perpanjang |
| `brandSoft` | `#E3F1E8` | `rgba(91,191,134,.14)` (≈ `#21312D` on surface) | **On tile background (light)**, active tab indicator, selected mode key, soft buttons (Pesan, Perpanjang) |
| `brandGlow` | `rgba(77,163,110,.34)` | `rgba(91,191,134,.22)` | Dark on-tiles: radial glow top-right on a neutral `surface`. Not used in light (the soft fill is enough) |
| `brand2` (leaf) | `#4DA36E` | n/a | Gradient mid stop |

**On-state, exactly:**
- Device tile on: light = `brandSoft` fill, no shadow, icon circle `brand` with `onBrand` glyph, state text `brandInk`. Dark = `surface` fill + `brandGlow` radial (160 dp, top-right), same icon circle and state text.
- Device tile off: `surface` + `e1` shadow, icon circle `sunken` with `muted` glyph, state text `muted`.
- Power key on: filled `brand`, `onBrand` icon, shadow `0 16 32 -10 rgba(29,117,80,.65)` (dark: `rgba(91,191,134,.55)`). Off: neutral key (`surface` / `raised`, `key` shadow, `muted` icon).
- Selected option (AC mode, segmented emphasis): `brandSoft` fill + 2 dp inset ring `brand` + `brandInk` glyph and label.
- Switch on: track `brand`, white thumb. Off: `sunken2`.

### 1.3 Category markers (10%)

| Category | Light marker / ink | Dark marker / ink | Allowed uses |
|---|---|---|---|
| Agenda | `#3B6FE0` / `#2F5BC4` | `#6E96F5` / `#8DADF7` | Calendar glyph tint, the dot of the next agenda item |
| Rumah | `#F08A24` / `#A64F08` | `#F5A04F` / `#F5A04F` | Glyph tint only (on-state is green) |
| Usaha | `#7C5CE6` / `#6343D1` | `#A58BFF` / `#B6A0FF` | Chart line, chart area at 14%, branch dots, theme glyph |
| Terhubung | `#1AA3C9` / `#0D6F8B` | `#4CC3E3` | Glyph tint, contact initial tint; AC cool arc and cool glyph |
| Warning | `#E5484D` / `#C8313A` | `#F2777B` | Low-stock glyph, Keluar, camera recording dot |

`AccentIcon` = neutral `sunken` circle + glyph in the category ink. Only the `brand` variant uses a tinted circle (`brandSoft`).

### 1.4 Gradients

| Name | Recipe | Use |
|---|---|---|
| `heroField` light | radial mint `rgba(190,232,205,.95)` 360×320 at (0,0) + radial green `rgba(77,163,110,.30)` 300×260 at (62%, -8%) + radial teal `rgba(25,179,166,.20)` 260×240 at (108%, 16%), each to 0 at 72%. Height 460 | Beranda top |
| `heroField` dark | radial `rgba(91,191,134,.20)` 340×300 at (0,0) + radial teal `rgba(25,179,166,.12)` 280×240 at (104%, 10%) | Beranda dark |
| `coolField` | radial `rgba(26,163,201,.16)` 340×300 at (50%, 10%) + mint `rgba(190,232,205,.6)` at (0,0) (light); dark sky `.13` only | AC remote |
| `intiGradient` | sweep `#1D7550` → `#159A84` → `#19B3A6` → `#3B6FE0` → `#2A8C6A` → `#1D7550`, highlights white 42% (top-left), lime `#B7E07A` 55% (top), shade navy 42% (bottom) | Inti |
| `glowOnDark` | `#2FBF7F`, `#19D3C0`, `#4F86FF`, `#C6F08A`, `#7C9CFF`, `#5FE3B5` | Voice waves |
| Lamp | radial `rgba(255,196,96,.55·b)` → `rgba(255,170,70,.22·b)` → 0, b = brightness | Lampu (the light's own colour, content not accent) |

The lamp's vertical slider is filled with the light's own colour (warm white `#F5A04F → #FFC979 → #FFE0A6` at 3000 K, cooler stops for cooler presets). That is a representation of the light, like album art, not an accent; its power key is green.

### 1.5 Contrast

All text pairs pass WCAG AA: light text/bg 16.5, muted/bg 5.18, muted/sunken 4.82, muted/brandSoft 4.9+, brandInk/brandSoft 4.85, onBrand/brand 5.66, category inks on bg ≥ 4.9; dark text 17.2, muted/surface 6.71, brand/bg 9.0, onBrand/brand 8.39. Voice: text 17.96.

---

## 2. Comfort rules (apply to every screen)

1. **One purpose per screen.** Beranda = what needs me now. Agenda = today. Perangkat = control devices. Usaha = how is business today. Akun = a few settings.
2. **Show less.** Secondary things go one tap away (Lainnya sheet, a detail screen), never on the main view.
3. **No explanatory sublines.** Rows and cards carry a title (1 to 3 words) and, where useful, a value on the right or one state word ("Nyala", "Mati", "24°", "Terkunci"). A one-line message preview is the only exception (approval card).
4. **Words budget.** A screen should read in 2 seconds: Beranda ≤ 15 words, remotes ≤ 6 words, lists ≤ 2 words per row.
5. **Targets.** Main controls ≥ 56 dp (buttons 56, remote keys 60 to 100, tiles ≥ 104). Secondary ≥ 48.
6. **Labels only where a glyph is ambiguous** (AC modes keep one word; VOL/CH stay; back, home, mute, keyboard, mic-off do not get labels; Mode Suara has none).
7. **Whitespace is a feature.** Empty space under the blocks on Beranda is intentional; do not fill it.

---

## 3. Typography

Plus Jakarta Sans. Add the 300 weight (`PlusJakartaSans_300Light`). `fontVariant: ['tabular-nums']` for times, money, temperatures.

| Style | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `readout` | 100 / 104 | 300 | -5 | AC temperature (88 lamp %, 56 AC tile) |
| `figure` | 46 / 52 | 600 | -1.8 | Usaha money |
| `display` | 32 / 38 | 600 | -1 | Greeting (28/34 compact) |
| `transcript` | 32 / 42 | 500 | -0.64 | Mode Suara |
| `title` | 28 / 34 | 600 | -0.7 | Tab screen titles |
| `headline` | 24 / 30 | 600 | -0.5 | Song title |
| `header` | 20 / 26 | 600 | -0.3 | Remote / Akun header |
| `quote` | 19 / 26 | 600 | -0.2 | Suggestion card |
| `row` | 17-18 / 22 | 500-600 | 0 | Rows, agenda items, approval name |
| `body` | 15-16 / 21-22 | 400-600 | 0 | Preview, tile names, buttons |
| `caption` | 13-14 / 18 | 500-600 | 0 | State words, small labels |
| `micro` | 12-12.5 / 15 | 500-700 | 0 | Tab labels, day names, VOL/CH |

Font scale up to 1.3 with `maxFontSizeMultiplier` 1.1 on `readout`/`figure`, 1.2 on tab labels and key labels. Rows and tiles have min heights, not fixed heights.

---

## 4. Shape, elevation, spacing

Radii: cards 28, tiles 26, keys full circle, rocker 40, segmented 18/14, buttons 28 (56 high), composer 28, cover 34, vertical slider 44, sheet top 30.

Elevation (RN `boxShadow`):
- `e1` tiles: light `0 1 2 rgba(21,24,27,.04), 0 6 18 -4 rgba(21,24,27,.08)`; dark `inset 0 1 0 rgba(255,255,255,.035)`.
- `e2` cards: light `0 1 2 rgba(21,24,27,.04), 0 16 36 -10 rgba(21,24,27,.14)`; dark `inset 0 1 0 rgba(255,255,255,.05), 0 18 40 -14 rgba(0,0,0,.7)`.
- `key`: light `inset 0 1 0 rgba(255,255,255,.9), 0 1 2 rgba(21,24,27,.07), 0 6 16 -4 rgba(21,24,27,.13)`; dark `inset 0 1 0 rgba(255,255,255,.07), 0 2 4 rgba(0,0,0,.35), 0 10 22 -8 rgba(0,0,0,.6)`.
- `power`: see §1.2. On tiles have no shadow.

Spacing: 4-pt grid; gutter 20-24; cards inset 16; block gap 20-28; row min height 64-72; tile gap 10-12.

---

## 5. Motion (slow and smooth)

| What | Spec |
|---|---|
| Press | scale 0.97 (keys 0.94), spring `{ damping: 20, stiffness: 260, mass: 0.7 }` |
| Block appears (new approval, first device…) | opacity 0 → 1 and translateY 12 → 0, 320 ms, `Easing.out(Easing.cubic)`; blocks below shift with a 320 ms layout transition (`LinearTransition.duration(320)`); stagger 80 ms if several |
| Block leaves (approval sent) | fade + collapse 260 ms, then a quiet success haptic |
| Screen enter | content fade 240 ms, no stagger beyond 3 items |
| Tab appears in the bar | the bar re-distributes over 360 ms (layout transition); the new tab fades in 240 ms after, with a single soft dot on it until first visit |
| Coach mark | fade + 6 dp rise 280 ms; Inti halo ring expands 0.92 → 1.25 and fades, 2.4 s loop, while the tip is visible |
| Inti idle | glow breathing 4.2 s (scale 0.90 ↔ 1.06, opacity 0.62 ↔ 1), sweep rotation 16 s |
| Sheet (Lainnya) | slide up with spring `{ damping: 26, stiffness: 220 }`, scrim to 38% over 220 ms |
| Number change | 160 ms slide + fade |
| Haptics | toggles `selectionAsync`, keys `impactAsync(Light)`, power `impactAsync(Medium)`, Kirim `notificationAsync(Success)` |
| Reduce motion | no breathing, no stagger, no halo, waves frozen with a 2.4 s opacity pulse; layout changes instant |
| Off-screen | pause loops when unfocused or in background |

### 5.1 Voice waves (unchanged from v1)

Bottom 540 dp canvas, 4 layers, additive blend:

| Layer | base | amp | freq | speed | phase | colours | alpha | blur | band |
|---|---|---|---|---|---|---|---|---|---|
| 0 | .34 | .20 | .85 | +.55 | 0 | `#2FBF7F` `#19D3C0` `#4F86FF` | .85 | 34 | .55 |
| 1 | .40 | .17 | 1.30 | -.70 | 1.7 | `#4F86FF` `#19D3C0` `#2FBF7F` | .75 | 24 | .45 |
| 2 | .46 | .14 | 1.75 | +.95 | 3.1 | `#2FBF7F` `#4F86FF` `#7C9CFF` | .62 | 14 | .35 |
| 3 | .52 | .10 | 2.30 | -1.25 | 4.4 | `#C6F08A` `#5FE3B5` `#4F86FF` | .55 | 8 | .28 |

```
env(u)  = 0.38 + 0.62·sin(πu)^1.3
wave(u) = 0.62·sin(2π·f·u + 1.6·sp·t + φ) + 0.38·sin(2π·1.9f·u − 2.1·sp·t + 2φ)
y(u)    = H·base − H·amp·L·env(u)·wave(u) − 0.10·H·L·env(u)
```
Each layer: horizontal 3-stop gradient, multiplied by a vertical alpha ramp from the crest (1 → .55 at 25% → 0 at `band·H`), blurred by σ, drawn at its alpha with `plus` blend. Front layer gets a 3 dp crest highlight (blur 3, alpha .32). Bottom wash `rgba(20,70,80,.30)`.

Level: `db = 20·log10(rms)`, `target = clamp((db+50)/40, 0, 1)`, floor 0.12 while listening; smoothing per frame `L += (target − L)·(target > L ? .35 : .10)` (attack ≈ 40 ms, release ≈ 160 ms). Inti glow scales `1 + .45·L`. States: listening (mic, speed 1), thinking (`.14 + .04·sin 1.3t`, speed .45, alpha ×.7, sweeping shimmer), speaking (TTS RMS, speed .8), muted (.08, speed .3, alpha ×.5); interpolate over 300 ms.

Mode Suara v2 layout: a single green live dot (no status text, no language label), transcript, waves, three controls (mute 60, Inti 88 under the finger, keyboard 60, no labels), "Selesai" (52 high).

---

## 6. Progressive disclosure (when things appear)

### 6.1 Beranda blocks

Order is fixed; each block shows only when its condition is true. At most 3 blocks, so the Inti always has air above it.

| Block | Shows when | Content | Leaves when |
|---|---|---|---|
| Suggestion card | No other block has content, and the user has sent fewer than 5 requests | "Coba bilang" + one example sentence (rotates daily: reminder, message, AC, bill). Tap = send it in chat | Any other block appears, or 5 requests done |
| Approval | ≥ 1 draft waits for approval | The oldest one only: contact initial, name, one-line preview, Ubah / Kirim (56) | Sent, edited, or cancelled; the next draft slides in |
| Next agenda | An item starts within the next 12 hours | Calendar glyph (blue), time, 2-3 word title, chevron to Agenda | Item starts (+15 min) or nothing in 12 h |
| Favourite devices | ≥ 1 device connected | 2 or 3 big toggles: icon, short name, state word. Tap toggles, long-press opens the remote. Favourites = user-pinned, else the 3 most used in 7 days | All devices removed |

Usaha, Terhubung, history and summaries are **never** on Beranda (Usaha has its own tab). Greeting: "Pagi / Siang / Sore / Malam, {nama}" by local time; "Halo, {nama}" for the first 3 days.

### 6.2 Tab bar

| Stage | Tabs (left | Inti | right) | Trigger |
|---|---|---|
| New | Beranda | Inti | Agenda | default |
| Has devices | Beranda, Agenda | Inti | Perangkat | first device connected (Kotak, HA, SmartThings…) |
| Has business | Beranda, Agenda | Inti | Perangkat, Usaha | first business source (kasir, rekening, marketplace) or user tells the assistant they run a business. If business but no devices: Beranda, Agenda | Inti | Usaha |

The bar is built as two halves around a fixed 96 dp centre slot, so the Inti stays centred whatever the count. Akun is always the avatar at the top right of Beranda (one place). On Beranda the Inti is 92 (76 compact) and rises over the bar; on other tabs it is 48 inline.

### 6.3 Tips (coach marks)

One tip at a time, at most one per day, each shown once, dismissed by any tap, never stacked with the suggestion card.
| Tip | Trigger | Points at |
|---|---|---|
| "Ketuk untuk chat · Tahan untuk bicara" | First app open (before the suggestion card) | Inti (halo ring while shown) |
| "Tahan untuk membuka remote" | First time a favourite device appears | First device tile |
| "Kirim baru keluar setelah Anda setuju" | First approval block | Kirim button |

---

## 7. Screens: main view vs Lainnya

| Screen | Main view (big, obvious) | Behind Lainnya / one tap away |
|---|---|---|
| AC | Dial + 24° readout (cool arc), room temp, 4 modes (Dingin, Kering, Kipas, Otomatis), − / power / + (76 / 100 / 76) | Kipas speed (auto + 3 bar glyphs), Ayun switch, Timer |
| TV | Power, D-pad + OK (264), back, home, VOL rocker, mute, CH rocker | Input source, number pad, menu, info |
| Speaker | Cover, title, artist, progress, prev / play-pause (92) / next, volume (56 high) | Source (Spotify, Bluetooth), power, speaker group |
| Lampu | Bulb glow, % readout, vertical slider (112×440), power (100) | Colour temperature and colour presets, scenes |
| Perangkat | Rooms segmented, big tiles: name + state (AC wide with readout, camera with last picture) | Routines (shown as a row only after the user creates one), unreachable devices list, add device (+) |
| Agenda | Week strip (today green), today's items: time + 2-3 words + glyph, green now-line, next item on a white card with a blue dot, "Tambah…" composer with green mic | Week view, history, leftover tasks (asked once in chat) |
| Usaha | Period segmented, money figure + %, violet area chart, 2 branches, 1 low-stock row with Pesan | Money in, orders, reports |
| Akun | Profile (avatar, name, trial + Perpanjang + day bar), 5 rows: Asisten (Nadia), Pemberitahuan (Nyala), Tampilan (inline segmented), Keamanan (PIN), Bantuan; Keluar as a coral text button | Each row's detail page (max depth 2) |

---

## 8. Components

| Component | Notes |
|---|---|
| `Surface` | plain / raised; on-state handled by the component using it |
| `AccentIcon` | Neutral `sunken` circle (40-48) + glyph in category ink; `brand` variant `brandSoft` + `brandInk`; `on` variant `brand` + `onBrand` |
| `GradientField` | `react-native-svg` RadialGradient ellipses per recipe (§1.4) |
| `PressableScale` | spring + haptic + long-press (300 ms) |
| `FavToggle` | 104-132 high, flex 1 in a row of 3; icon circle 46, name 15.5/600, state 13.5/600 |
| `ApprovalCard` | avatar 48 (sunken + sky initial), name 17/600, preview 15 one line, Ubah (sunken) + Kirim (brand, 1.4×), 56 high |
| `NextItemRow` | AccentIcon (blue calendar) + time 18/600 + title 18/400 + chevron; no surface |
| `SuggestionCard` | `e2` card, brand mic AccentIcon, "Coba bilang" caption + quote 19/600 |
| `CoachMark` | `tip-bg` ink bubble (light `#15181B`, dark `#F2F3F5`), 15/600, radius 18, arrow 16; target gets a halo ring |
| `TabBar` | two halves + 96 centre slot; active = `brandInk` icon/label on `brandSoft` 60×32 indicator |
| `RemoteKey` | 60-100 circle, `key` shadow; `power` / `selected` / `ink` / `glass` variants |
| `MoreButton` + `MoreSheet` | "⋯ Lainnya" 44 high sunken capsule in the header; sheet rows 72 high: AccentIcon + one word + control (segmented / switch / value chip) |
| `Dial` | 270° arc r 134, stroke 18; track `sunken2`; active arc cool gradient; knob r 17; no tick labels (just 24° in the centre) |
| `DPad`, `Rocker`, `Slider` (56 horizontal, 112×440 vertical), `Segmented` (44 items) | as drawn |
| `TimeRail` | vertical rail, 56 time column, green now-line, next item card |
| `AreaChart` | violet line 3, area 14% → 0, end dot 6 with bg ring |
| `Inti` | 92 / 88 / 76 / 48 sizes; glow, sweep core, white S (`s-mono-light.png` + `tintColor`), thinking ring, halo |

---

## 9. Thumb zone and responsive

`useLayoutClass()`: `compact` = height < 700; `tall` = height / width ≥ 2.0 (includes 393×873); `regular` otherwise.
- Every screen: top content, flexible spacer, bottom actions anchored to the bottom inset.
- Primary actions in the bottom 40%: Inti, Kirim (falls into it on most phones), − / power / +, rockers, play, Tambah.
- compact: greeting 28, Inti 76, tiles 104, approval padding 14, dock fade 120 (frame 20 shows all three Beranda blocks fit at 360×640). tall: extra height goes to the spacer (frame 21).

---

## 10. React Native implementation notes

- **Tokens**: replace `src/theme/tokens.ts` with §1. Suggested shape: neutrals flat; `brand: { base, on, ink, soft, glow }`; `marker: { agenda, rumah, usaha, terhubung, warn }` each `{ base, ink }` (no `soft` for markers on purpose, so nobody builds a large tinted surface from them).
- **Disclosure state**: one selector `useHomeBlocks()` returning the ordered list of visible blocks from server state (`approvals`, `nextAgenda`, `devices`, request count) and one `useTabSet()` returning `minimal | devices | business | full`. Animate list changes with Reanimated `entering={FadeInDown.duration(320)}` and `layout={LinearTransition.duration(320)}`.
- **Tips**: persist "seen" flags locally (`expo-secure-store` or AsyncStorage) per tip id; a tiny scheduler allows one per day.
- **Skia only for the voice waves** (`@shopify/react-native-skia`): Path + `BlurMask` + `plus` blend + a `dstIn` alpha ramp per layer, path built in a `useDerivedValue` worklet from a `useFrameCallback` clock. Check the `<Blend>` child order in the installed version. Adds several MB per ABI; measure on EAS. Fallback without Skia: 4 pre-blurred ribbon PNGs moved with Reanimated.
- **Everything else** uses what the app already has: `react-native-svg` (fields, dial, chart, D-pad dividers, bulb), Reanimated 4 (`sv.get()/sv.set()`), Gesture Handler (Inti tap vs hold into Mode Suara, dial and slider pans), `expo-haptics`, RN `boxShadow`.
- **Inti core**: react-native-svg has no sweep gradient; use a pre-rendered sweep PNG rotated with Reanimated plus SVG highlights, or Skia `SweepGradient` if Skia is in.
- **No** backdrop blur, gradient text, or tinted category surfaces.
- **Copy**: plain Indonesian, no emoji, no technical words; one-word labels where needed.
