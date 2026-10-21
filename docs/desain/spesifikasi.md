# Sekretaris AI, Fase R: visual direction spec

Companion to `index.html` (open it in a browser: animations run live; `?solo=<frame-id>` shows one frame at device size) and the PNGs in `shots/`. Everything here maps to React Native (Expo SDK 58, RN 0.88, New Architecture). Values are dp unless noted.

Direction in one line: **warm neutral paper, one accent per domain, green only for the primary action and the Inti, big numbers and flowing content instead of bordered boxes, every primary action in the bottom 40%.**

---

## 1. Palette

### 1.1 Neutrals

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F7F6F2` | `#0E1012` | Screen background |
| `surface` | `#FFFFFF` | `#171A1E` | Touchable cards, tiles, keys |
| `raised` | `#FFFFFF` | `#1F2328` | Keys, D-pad, rockers in dark (one step above surface) |
| `sunken` | `#F0EEE8` | `#202328` | Segmented track, message bubble, composer field, secondary button |
| `sunken2` | `#E6E3DB` | `#2A2E34` | Unfilled slider/dial track, dark segmented thumb |
| `text` | `#15181B` | `#F2F3F5` | Primary text, icons |
| `muted` | `#64686F` | `#9CA1A8` | Secondary text, inactive tabs |
| `faint` | `#A4A7AC` | `#5E636A` | Decorative only (empty timeline dots, chevrons). Never for text that must be read |
| `line` | `#E9E7E1` | `#262A30` | Hairlines, rails, dividers |
| `tabbar` | `#FFFFFF` | `#131619` | Bottom navigation surface |
| `voiceCanvas` | `#07090B` | `#07090B` | Mode Suara in both themes |

Deviation from the plan: light `muted` is `#64686F` instead of `#6B6F76`. The plan value is 4.35:1 on `sunken` and 4.43:1 on `orangeSoft`, which fails AA for the inactive segmented labels and tile captions. `#64686F` passes everywhere (4.82 to 5.18).

### 1.2 Brand and domain accents

Each accent has three roles. **base**: fills, glows, chart strokes, selected dots. **ink**: text and icons on `bg`, `surface` or its own `soft` (AA 4.5+). **soft**: tinted background for an "on" tile, AccentIcon circle, or highlighted row.

| Domain | Light base | Light ink | Light soft | Dark base | Dark ink | Dark soft |
|---|---|---|---|---|---|---|
| Brand (Inti, primary action, success, "aktif") | `#1D7550` | `#1D7550` | `#E3F1E8` | `#5BBF86` | `#5BBF86` | `#15291F` |
| Agenda (blue) | `#3B6FE0` | `#2F5BC4` | `#E8EEFC` | `#6E96F5` | `#8DADF7` | `#18223A` |
| Rumah / devices (orange) | `#F08A24` | `#A64F08` | `#FDEEDD` | `#F5A04F` | `#F5A04F` | `#2C2015` |
| Usaha (violet) | `#7C5CE6` | `#6343D1` | `#EFEAFD` | `#A58BFF` | `#B6A0FF` | `#231D38` |
| Terhubung (sky) + "cold air" state on AC | `#1AA3C9` | `#0D6F8B` | `#E2F4FA` | `#4CC3E3` | `#4CC3E3` | `#10272E` |
| Warning / delete (coral) | `#E5484D` | `#C8313A` | `#FDE8E8` | `#F2777B` | `#F2777B` | `#311A1C` |

`onAccent` (text/icon placed on a filled accent): light `#15181B`, dark `#0E1012`. Orange and sky are too light for white text (white on `#F08A24` is 2.5:1), so filled orange keys use dark icons. Exceptions with white text: brand button (`#FFFFFF` on `#1D7550`, 5.66) and the selected day in Agenda (`#FFFFFF` on `#3B6FE0`, 4.63).

**Usage rules**
- Green appears only on: the Inti, the primary button on a screen (Kirim, Simpan), success ticks, and "aktif/terkunci" status text. Never on backgrounds, cards, tabs or toggles. Active tab = `text` colour on a `sunken` indicator.
- Device "on" is **orange** (tile fill `orangeSoft`, icon circle filled `orange`). The power key on every remote is a filled orange circle. This is a deliberate refinement of the plan, which said green for "menyala": a screen full of green toggles was exactly the founder's complaint.
- The AC remote uses **sky** for the climate state while cooling (dial arc, mode selection, swing). Orange stays on the power key. Sky never shares a screen with the Terhubung domain, so there is no ambiguity.
- One domain accent per screen, plus brand for the primary action, plus coral for warnings. Beranda is the exception: it is the overview, so each section wears its own accent (blue rail, orange tiles, violet chart).

### 1.3 Gradients

| Name | Stops | Use |
|---|---|---|
| `intiGradient` | `#1D7550` → `#19B3A6` → `#3B6FE0`, highlight `#B7E07A` | Inti core, Akun avatar ring, brand moments |
| `glowOnDark` (voice waves) | green `#2FBF7F`, teal `#19D3C0`, blue `#4F86FF`, lime `#C6F08A`, periwinkle `#7C9CFF`, mint `#5FE3B5` | Brand gradient lifted in lightness so additive blending glows on `#07090B`. Same hues as `intiGradient` |
| `GradientField` (Beranda, light) | radial teal `#19B3A6` 30% at (6%, 2%) r 260×240; radial lime `#B7E07A` 42% at (52%, -6%) r 240×200; radial blue `#3B6FE0` 20% at (104%, 8%) r 280×260; all fade to 0 at 72% | Top 420 dp of Beranda |
| `GradientField` (Beranda, dark) | same positions, opacities teal 22%, lime 10%, blue 30% | |
| `GradientField.cool` (AC) | sky 20% at (50%, 8%) r 320×300 + lime 14% at (0, 0) | AC remote while cooling |
| `GradientField.violet` (Usaha) | violet 16% at (90%, 0) + lime 18% at (0, 0) | |
| Lamp glow | radial `rgba(255,196,96, 0.55·b)` → `rgba(255,170,70, 0.22·b)` at 45% → 0, where b = brightness 0..1 | Lampu remote |

No gradient text anywhere (thinking state uses an opacity pulse instead of a shimmer on text).

### 1.4 Contrast (WCAG 2.x, computed)

Light: text/bg 16.5, muted/bg 5.18, muted/sunken 4.82, blueInk/blueSoft 5.29, orangeInk/orangeSoft 4.93, violetInk/violetSoft 5.49, skyInk/skySoft 5.06, coralInk/coralSoft 4.52, brandInk/brandSoft 4.85, onAccent/orange 7.10, white/brand 5.66.
Dark: text/bg 17.2, muted/surface 6.71, muted/sunken 6.06, blueInk/blueSoft 7.11, orange/orangeSoft 7.57, violetInk/violetSoft 7.25, sky/skySoft 7.56, coral/coralSoft 5.95, onBrand/brand 8.39.
Voice canvas: text 17.96, muted 7.67, "Selesai" button 17.2. Interim transcript is intentionally 42% white (decorative, the final words are full white).

---

## 2. Typography

Plus Jakarta Sans (Indonesian typeface, already in the app). **Add the 300 Light weight** (`PlusJakartaSans_300Light` from `@expo-google-fonts/plus-jakarta-sans`) for readouts. Tabular figures for all times, money and temperatures (`fontVariant: ['tabular-nums']`).

| Style | Size / line | Weight | Tracking (px) | Use |
|---|---|---|---|---|
| `readout` | 96 / 100 | 300 | -4.8 | AC temperature. 84 for lamp %, 52 in the AC tile |
| `figure` | 44 / 50 | 600 | -1.76 | Usaha hero money. 36/42 on Beranda |
| `display` | 30 / 36 | 600 | -0.75 | Greeting |
| `title` | 28 / 34 | 600 | -0.7 | Tab screen titles (Perangkat, Agenda, Usaha) |
| `transcript` | 32 / 42 | 500 | -0.64 | Mode Suara live transcript (28/37 once final) |
| `headline` | 24 / 30 | 600 | -0.48 | Song title |
| `section` | 18 / 24 | 600 | -0.18 | Section headers ("Hari ini", "Rumah"), header titles |
| `subtitle` | 16 / 22 | 600 | 0 | Row titles, card titles |
| `body` | 16 / 24 | 400 | 0 | Body |
| `bubble` | 15 / 22 | 400 | 0 | Message preview |
| `label` | 14 / 20 | 500-600 | 0 | Links, segmented, buttons (15.5/600 for 48-dp buttons) |
| `caption` | 13 / 18 | 500 | 0 | Secondary lines |
| `micro` | 12 / 14-16 | 500-700 | 0 (VOL/CH: +0.7) | Tab labels, chart axis, key labels |

Font scale up to 1.3: all text uses `allowFontScaling`. Cap `readout` and `figure` with `maxFontSizeMultiplier={1.1}` (they are already huge); cap tab labels and key labels at 1.2. Rows grow vertically; nothing is fixed-height except remote keys.

---

## 3. Shape, elevation, spacing

**Radii**: card 28 (approval, profile), tile 24-26 (device tiles, routines 22), key = full circle, rocker 38, segmented track 16 / thumb 12, bubble 6-20-20-20 (tail top-left), button 24 (48-dp pill), composer 26, cover art 32, vertical slider 40, bottom chrome top corners 28.

**Elevation** (RN 0.88 `boxShadow` style prop, New Architecture):

| Token | Light | Dark |
|---|---|---|
| `e0` | none (flat on bg) | none |
| `e1` tiles | `0 1px 2px rgba(21,24,27,.04), 0 4px 14px -2px rgba(21,24,27,.06)` | `inset 0 1px 0 rgba(255,255,255,.035)` |
| `e2` approval/profile card | `0 1px 2px rgba(21,24,27,.04), 0 14px 34px -8px rgba(21,24,27,.13)` | `inset 0 1px 0 rgba(255,255,255,.05), 0 18px 40px -14px rgba(0,0,0,.7)` |
| `key` remote keys | `inset 0 1px 0 rgba(255,255,255,.9), 0 1px 2px rgba(21,24,27,.07), 0 6px 16px -4px rgba(21,24,27,.13)` | `inset 0 1px 0 rgba(255,255,255,.07), 0 2px 4px rgba(0,0,0,.35), 0 10px 22px -8px rgba(0,0,0,.6)` |
| `power` | `inset 0 1px 0 rgba(255,255,255,.35), 0 14px 30px -8px rgba(240,138,36,.65)` | same |

No borders on surfaces. "On" tiles drop their shadow and use the soft fill instead. Unreachable devices: transparent fill with a 1.5 inset `line` ring and muted text.

**Spacing**: 4-pt grid. Page gutter 20 (cards 16 so their content aligns with the 20 gutter). Section gap 26-28; header to content 10-12; inside cards 14-18; horizontal scroller gap 10; list row min height 68. Content bleeds off the right edge in every horizontal scroller (no right padding on the last visible item) so scrolling is obvious.

---

## 4. Motion

| Interaction | Spec |
|---|---|
| Press (`PressableScale`) | scale 0.97, `withSpring({ damping: 18, stiffness: 320, mass: 0.6 })`, release same spring. Remote keys 0.94 |
| Haptics | Toggle tap: `selectionAsync`. Remote key: `impactAsync(Light)`. Power: `impactAsync(Medium)`. Dial step (each 1°): `selectionAsync`. Inti long-press start: `impactAsync(Medium)`. Kirim: `notificationAsync(Success)` |
| Screen enter | Children fade + rise 8 dp, 220 ms, `Easing.out(Easing.cubic)`, stagger 40 ms, max 6 staggered items |
| Number change | Old value slides up 6 dp and fades, new value comes in from below, 160 ms. Temperature also cross-fades the dial arc with `withTiming(…, 180)` |
| Inti idle (breathing) | Glow scale 0.90 ↔ 1.06 and opacity 0.62 ↔ 1, 4.2 s loop, `Easing.inOut(Easing.sin)`. Core swirl rotates 360° per 16 s, linear |
| Inti thinking | Thin sweep ring (teal → blue → lime) rotates once per 3.2 s, fades in over 200 ms |
| Inti hold → Mode Suara | On long-press (300 ms) the orb stays under the finger, canvas cross-fades to `#07090B` (250 ms), waves rise from the orb (amplitude 0 → live over 300 ms). Release = send |
| Voice state change | Parameter sets interpolate over 300 ms (`withTiming`); never cut |
| Equalizer bars (playing) | 4 bars 4 dp wide, height 6 ↔ 22, 1 s ease-in-out, phase offsets 0 / -0.3 / -0.6 / -0.15 s |
| Reduce motion (`useReducedMotion`) | No enter stagger, no swirl, no breathing scale (glow holds at 0.85 opacity), waves frozen at t = 1.2 s with level 0.35 and a 2.4 s opacity pulse 0.7 ↔ 1 only, no equalizer motion. Haptics stay |
| Off-screen | Pause all loops when the screen is not focused (`useIsFocused`) or the app is in background (`AppState`) |

### 4.1 Voice waves algorithm (Mode Suara)

Canvas: full width, bottom 540 dp of the screen (independent of screen height, so on taller phones the waves stay at the bottom). Draw back to front, 4 layers, additive blend (`plus` in Skia, `lighter` on web).

| Layer | base (fraction of canvas height, from top) | amp | freq f (cycles across width) | speed sp | phase φ | colours left → mid → right | alpha | blur σ (dp) | band |
|---|---|---|---|---|---|---|---|---|---|
| 0 (back) | 0.34 | 0.20 | 0.85 | +0.55 | 0.0 | `#2FBF7F` `#19D3C0` `#4F86FF` | 0.85 | 34 | 0.55 |
| 1 | 0.40 | 0.17 | 1.30 | -0.70 | 1.7 | `#4F86FF` `#19D3C0` `#2FBF7F` | 0.75 | 24 | 0.45 |
| 2 | 0.46 | 0.14 | 1.75 | +0.95 | 3.1 | `#2FBF7F` `#4F86FF` `#7C9CFF` | 0.62 | 14 | 0.35 |
| 3 (front) | 0.52 | 0.10 | 2.30 | -1.25 | 4.4 | `#C6F08A` `#5FE3B5` `#4F86FF` | 0.55 | 8 | 0.28 |

For each layer, sample N = 56 points, u = i / N, x = u · W:

```
env(u)  = 0.38 + 0.62 · sin(π·u)^1.3                    // taller in the middle
wave(u) = 0.62 · sin(2π·f·u + 1.6·sp·t + φ)
        + 0.38 · sin(2π·1.9·f·u − 2.1·sp·t + 2φ)          // two sines, opposite drift
y(u)    = H·base − H·amp·L·env(u)·wave(u) − 0.10·H·L·env(u) // L lifts the whole band
```

Fill the path from the crest down to the canvas bottom with a horizontal 3-stop gradient (colours above), multiplied (dst-in) by a vertical alpha ramp that starts at the crest top `H·(base − amp·L − 0.06)`: 1.0 at 0, 0.55 at 25%, 0 at `band·H` below. So each layer is a glowing ribbon, not a filled hill. Blur the layer by σ, draw at its alpha with additive blend. Front layer only: stroke its crest 3 dp wide, blur 3, alpha 0.32, horizontal gradient transparent lime → `#D6F5BE` → `#AADCFF` → transparent. Under everything, a vertical wash `rgba(20,70,80,0)` at 55% height → `rgba(20,70,80,.30)` at the bottom.

**Level L (0..1) from the microphone**: from each PCM chunk (already computed in `src/voice/pcm.ts`), use a perceptual curve instead of `rms·6`:

```
db     = 20·log10(max(rms, 1e-5))          // rms of the chunk, 0..1
target = clamp((db + 50) / 40, 0, 1)        // −50 dB → 0, −10 dB → 1
target = max(target, 0.12)                  // never flat while listening
L     += (target − L) · (target > L ? 0.35 : 0.10)   // per frame at 60 fps:
                                            // attack τ ≈ 40 ms, release τ ≈ 160 ms
```

Push `target` into a Reanimated shared value from JS; do the smoothing in the frame callback on the UI thread. The Inti glow under the finger scales `1 + 0.45·L`.

**States** (interpolate between parameter sets over 300 ms):

| State | Level source | Speed multiplier | Alpha multiplier | Extra |
|---|---|---|---|---|
| Mendengar | mic, as above | 1.0 | 1.0 | |
| Berpikir | `0.14 + 0.04·sin(1.3·t)` | 0.45 | 0.70 | Shimmer: radial `rgba(220,245,210,.45)` r 150, centre y = 0.58·H, x sweeps −0.2W → 1.2W every 6.4 s, blur 10. Inti thinking ring on |
| Menjawab | RMS of the TTS audio being played (same curve), or a syllable envelope if no PCM is available | 0.8 | 0.9 | |
| Diam / bisu | 0.08 | 0.3 | 0.5 | |

---

## 5. Components

| Component | Purpose and key props | Implementation |
|---|---|---|
| `Surface` | `variant: 'plain' | 'raised' | 'accent'`, `accent?: Domain`, `on?: boolean`. Radius from size, no border, `e1`/`e2` shadow; `accent+on` = soft fill, no shadow | View + `boxShadow` |
| `SectionHeader` | Title (18/600) left, optional link right in the section's accent ink with chevron. Height 28, 48-dp hit area on the link | View |
| `AccentIcon` | Circle 36-52 with icon 20-24. `tone: soft | filled | quiet` × domain. Filled uses `onAccent` icon | View + existing `Icon` (stroke 1.75) |
| `GradientField` | Absolutely positioned behind the top of a screen; recipe name (`home`, `cool`, `violet`, `warm`) per theme. Static | `react-native-svg` `RadialGradient` ellipses (no blur needed: the gradient falloff is the softness) |
| `PressableScale` | Wraps Pressable; spring scale; haptic kind; `onLongPress` with 300 ms delay; respects reduce motion | gesture-handler or Pressable + Reanimated |
| `BigNumber` | `value`, `unit`, `style: readout | figure`; animated digit change; tabular; `maxFontSizeMultiplier 1.1` | Text + Reanimated |
| `HScroller` | Horizontal ScrollView, `contentContainerStyle` paddingLeft 20, gap 10, `decelerationRate="fast"`, `snapToInterval` = item + gap | ScrollView |
| `TimeRail` | Two forms. **Strip** (Beranda): horizontal rail 2 dp at y 31, past part tinted blue 35%, items 108-122 wide with time / dot / title (2 lines) / meta, "now" = 3×22 blue tick with time label; next item has a blue dot with 5-dp halo. **Rail** (Agenda): vertical, 52-dp time column, dots 14, now line full width in blue, next item on `blueSoft` 20-radius surface, past items 50% opacity | Views |
| `ApprovalCard` | Avatar initial (contact tone from name hash among soft accents), brand badge dot, title, one-line sub, time, 2-line bubble (`numberOfLines={2}`), Ubah (sunken) + Kirim (brand, 1.35× width) | Surface `e2` |
| `DeviceTile` | Mini control for Beranda (122×132) and grid tiles (1 or 2 columns, heights 100 / 112 / 176) by content: AC shows readout, lamp shows % + level bar + warm glow, camera shows last snapshot full-bleed with gradient scrim, speaker shows equalizer. Tap toggles, long-press opens the remote | Surface + `PressableScale` |
| `RemoteButton` | Circle 52-88. Variants: `key` (surface + `key` shadow), `power` (orange), `selected` (accent soft + 1.5 inset ring), `ink` (text colour fill, e.g. play/pause), `glass` (Mode Suara: `rgba(242,243,245,.10)`). Optional label below (12.5/500, selected 600) | View + `boxShadow` |
| `Dial` | 270° arc from 135° to 405°, r 128, stroke 16 round caps; track `sunken2`; active arc gradient pale `#A7E1F4` → `sky` (cooling) or pale `#FFD5A8` → `orange` (heating/fan); ticks every 1° at r+17..r+22 (current r+28, accent); 16°/30° labels; knob r 15 white with shadow and 5-dp accent dot. Pan to change, 1° steps with haptic; −/+ keys do the same. Readout + mode label + room temperature centred | `react-native-svg` Path + Circle; gesture-handler Pan; angle math already in `src/ui/device/dialMath.ts` |
| `DPad` | 256 circle `raised`, four 64-dp hit zones with chevrons, diagonal dividers (`line`, from r 66 to r 118), OK = 104 sunken ring with 88 raised button. Pressed direction: orange radial glow 80 dp behind the chevron for 180 ms + haptic | Views + SVG lines |
| `Rocker` | 76×212 capsule, two 52-dp keys and a centre label (VOL / CH) | View |
| `Slider` | Horizontal 44 high (volume): sunken track, accent-soft fill, 4-dp accent grip. Vertical 104×432 (lamp): sunken track, warm gradient fill `#F5A04F → #FFC979 → #FFE0A6` bottom-up, white grip line, sun icons at both ends | View + Reanimated + Pan |
| `Segmented` | Track `sunken` r16 p4; thumb `surface` r12 with tiny shadow (dark: `sunken2`, no shadow). Animated thumb slide 200 ms. Scrollable variant for rooms | View + Reanimated |
| `Sparkline` / `AreaChart` | Catmull-Rom smoothing (tension 0.18) → cubic Béziers; stroke 2.5-3 accent; area gradient accent 26-28% → 0; end point 4.5-5.5 dot with 2.5 bg ring and 11 halo at 16%; dashed hairline grid (2/5) in `line`; axis labels 12/500, today 700 in ink | `react-native-svg`; math in `src/ui/business/sparkMath.ts` |
| `Inti` | Sizes: 88 (Beranda tall), 72 (compact), 84 (Mode Suara hold), 46 (inline in tab bar). Layers: glow (3 radial gradients teal/blue/lime at 55% of d beyond the edge, breathing), core (sweep gradient green → teal → blue → green rotating 16 s, plus top-left white highlight 38%, lime highlight 55% top-right, dark shade bottom 42%), white S mark (`s-mono-light.png` with `tintColor="#FFFFFF"`), optional thinking ring | See §7 |
| `TabBar` | 4 tabs + centre slot (92 wide). Beranda: big Inti rises from the centre slot over the bar (centre on the bar's top edge), hint above it. Other tabs: Inti 46 inline. Active tab = `text` colour + 56×30 `sunken` indicator. Surface `tabbar`, top hairline | Existing `src/ui/TabBar.tsx` |
| `BottomChrome` | Agenda: one surface with top radius 28 containing the composer (52 high, sunken, "+" in blue ink, placeholder "Tambah, misalnya "rapat Kamis jam 2"", round blue mic button) and the tab bar. Attached to the edge, not floating | View |
| `ListRow` (Akun) | AccentIcon 42 + title 16/600 + one line 13 muted (`numberOfLines={1}`) + chevron; optional inline control under the text (Tampilan segmented). Rows sit on the background, no group boxes | View |

---

## 6. Thumb zone and responsive rules

`useLayoutClass()` from `useWindowDimensions()`:

| Class | Rule | Examples |
|---|---|---|
| `compact` | height < 700 | 360×640 |
| `regular` | height ≥ 700 and height/width < 2.0 | 412×780, small foldables |
| `tall` | height/width ≥ 2.0 | 360×800, 393×873 (reference), 412×915 |

Rules:
1. Every screen is `flex: 1` with a top part (header and reading content) and a bottom part (primary actions) separated by a flexible spacer. No fixed `marginTop` that pushes actions down from the top.
2. The primary action of each screen lives in the bottom 40%: Inti (Beranda), Kirim (approval card when visible), −/power/+ (AC), rockers + Bisukan (TV), play/volume (Speaker), Redup/power/Terang + colours (Lampu), Tambah composer (Agenda), Pesan lagi (Usaha), Selesai/hold (Mode Suara).
3. Bottom anchors are measured from the bottom inset (gesture bar), never from the top. On `tall`, extra height goes to the spacer between content and actions (see frame 17).
4. Touch targets ≥ 48 dp (keys 52-88, links have 48-dp hit slop).

Per class:

| | compact | regular | tall |
|---|---|---|---|
| Beranda Inti | 72, hint hidden | 84 | 88 |
| Beranda greeting | date line hidden, display 26/32 | 30/36 | 30/36 + date/weather line |
| Hari ini strip | no meta line (84 high) | 108 | 108 |
| Approval card padding | 14 | 16 | 16 |
| AC dial radius | 104, readout 80 | 118 | 128, readout 96 |
| TV D-pad | 224 | 248 | 256 |
| Lamp vertical slider | 104×340 | 104×400 | 104×432 |
| Mode Suara transcript | 28/37 | 32/42 | 32/42 |
| Voice waves canvas | bottom 420 | bottom 500 | bottom 540 |

At font scale 1.3: section headers and list rows wrap to 2 lines (allowed), tiles grow taller (min heights, not fixed), the Beranda strip switches its item width from 122 to 150, tab labels cap at 1.2.

---

## 7. React Native implementation notes

**Libraries** (all except Skia already in `package.json`):
- `react-native-svg` 15: GradientField, Dial, Sparkline/AreaChart, D-pad dividers, cover art, bulb, lamp glow (radial gradient), status illustrations.
- `react-native-reanimated` 4 (React Compiler: use `sv.get()/sv.set()`): press springs, enter stagger, number transitions, Inti breathing/rotation, segmented thumb, sliders, wave frame clock (`useFrameCallback`).
- `react-native-gesture-handler` 3: Inti tap vs long-press (300 ms) with the press continuing into Mode Suara, dial and slider pans.
- `expo-haptics`: see §4.
- `@shopify/react-native-skia` (to add with `npx expo install`): **needed only for the voice waves** (path + blur + additive blend + per-layer alpha ramp at 60 fps). Everything else can ship without it. Skia adds several MB per ABI to the APK; measure on an EAS build. If the size cost is rejected, the fallback is: pre-render 4 blurred ribbon PNGs (one per layer, wide, horizontal gradient baked in), and animate their `translateX` (opposite directions) and `scaleY` (from L) with Reanimated, `mixBlendMode` not required because the PNGs carry their own alpha. It looks about 80% as good and costs < 200 KB.

**Waves in Skia (recommended)**:
```tsx
<Canvas style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 540 }}>
  <Rect …>{/* bottom wash: vertical LinearGradient */}</Rect>
  {LAYERS.map((l, i) => (
    <Group key={i} blendMode="plus" opacity={l.alpha * alphaMul}>
      <Path path={paths[i]}>  {/* derived value from t and L, 57 points */}
        <Blend mode="dstIn">
          <LinearGradient start={vec(0, 0)} end={vec(W, 0)} colors={l.colors} />
          <LinearGradient start={vec(0, top[i])} end={vec(0, top[i] + l.band * H)} colors={['#000', '#0008', '#0000']} positions={[0, .25, 1]} />
        </Blend>
        <BlurMask blur={l.blur} style="normal" />
      </Path>
    </Group>
  ))}
</Canvas>
```
Build each `SkPath` in a `useDerivedValue` worklet from the frame-clock shared value; no React re-renders per frame. This is a sketch: check the child order of `<Blend>` in the installed Skia version (the colour gradient must be the destination and the alpha ramp the source for `dstIn`).

**Inti without Skia**: glow = 3 SVG radial gradients in one `Svg` (scaled by Reanimated); core = a pre-rendered sweep-gradient PNG (green → teal → blue, 2× and 3×) rotated with Reanimated plus an SVG overlay for the highlights (react-native-svg has no sweep gradient); S = `Image` of `assets/brand/s-mono-light.png` with `tintColor="#FFFFFF"`. If Skia is added, use `SweepGradient` and draw the core in the same Canvas as the glow.

**Shadows and blur**: use the RN `boxShadow` prop (New Architecture, RN ≥ 0.76; inset shadows used for the key highlight; verify on a low-end Android, fallback is a 1-dp top highlight View). Do not use backdrop blur anywhere; Mode Suara controls are plain translucent fills (`rgba(242,243,245,.10)`).

**Web-only things in the board and their RN equivalents**:
| Board (HTML) | React Native |
|---|---|
| CSS radial-gradient backgrounds | `react-native-svg` RadialGradient |
| `conic-gradient` (Inti core, thinking ring, avatar ring) | Skia `SweepGradient`, or a pre-rendered PNG rotated |
| `mask-image` S mark | `Image` + `tintColor` |
| `-webkit-line-clamp` | `numberOfLines` |
| canvas `filter: blur` + `lighter` | Skia `BlurMask` + `blendMode="plus"` |
| `box-shadow` | `boxShadow` prop |
| CSS keyframes | Reanimated `withRepeat(withTiming(…))` |

**Copy rules kept from the founder**: plain everyday Indonesian, no emoji, no technical words, no pill tags or floating cards; the composer and approval card are attached to structure, not floating.

**Tokens**: replace `src/theme/tokens.ts` palette with the tables in §1 (suggested names: `bg, surface, raised, sunken, sunken2, text, muted, faint, line, tabbar, brand, onBrand, brandSoft, onAccent`, and per domain `{ base, ink, soft }` under `accent.agenda | rumah | usaha | terhubung | warn`). Add `typeScale.readout/figure/transcript` and `FONT[300]`.
