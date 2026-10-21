// Sapuan warna inti "Inti" (assets/brand/inti-sapuan.png): gradasi melingkar brand dari spesifikasi v2 §1.4, sama dengan
// `conic-gradient(from 200deg, #1D7550, #159A84 22%, #19B3A6 36%, #3B6FE0 58%, #2A8C6A 80%, #1D7550)` di papan desain.
// react-native-svg tidak punya gradasi melingkar, jadi digambar sekali di sini lalu diputar pelan oleh Reanimated.
//
//   source dev-env.sh && node scripts/make-inti.mjs
import { Buffer } from 'node:buffer';
import sharp from 'sharp';

const SIZE = 256;
const FROM = 200;
const STOPS = [
  [0, '#1D7550'],
  [0.22, '#159A84'],
  [0.36, '#19B3A6'],
  [0.58, '#3B6FE0'],
  [0.8, '#2A8C6A'],
  [1, '#1D7550'],
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const stops = STOPS.map(([t, c]) => [t, hex(c)]);

function colorAt(t) {
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    const [t0, c0] = stops[i - 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
    }
  }
  return stops[stops.length - 1][1];
}

const data = Buffer.alloc(SIZE * SIZE * 3);
const c = (SIZE - 1) / 2;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // Sudut CSS: 0° di atas, searah jarum jam.
    const deg = (Math.atan2(x - c, -(y - c)) * 180) / Math.PI;
    const t = ((((deg - FROM) % 360) + 360) % 360) / 360;
    const [r, g, b] = colorAt(t);
    const o = (y * SIZE + x) * 3;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
  }
}

await sharp(data, { raw: { width: SIZE, height: SIZE, channels: 3 } })
  .png({ compressionLevel: 9, palette: false })
  .toFile('assets/brand/inti-sapuan.png');
console.log('assets/brand/inti-sapuan.png dibuat');
