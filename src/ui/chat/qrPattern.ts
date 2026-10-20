export const QR_SIZE = 25;

export interface QrCell {
  x: number;
  y: number;
}

// Mata penjuru 7x7: bingkai luar, cincin kosong, inti 3x3.
const finder = (lx: number, ly: number) =>
  lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);

/** Pola QR contoh (bukan kode sungguhan): sama dengan qr() di sk-shared.js desain, 25x25, benih 11. Selalu menghasilkan sel yang sama. */
export function qrCells(): QrCell[] {
  const N = QR_SIZE;
  let s = 11;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const cells: QrCell[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const ox = x < 8 ? x : x >= N - 8 ? x - (N - 7) : -1;
      const oy = y < 8 ? y : y >= N - 8 ? y - (N - 7) : -1;
      const inFinder = (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
      const on = inFinder ? ox >= 0 && ox < 7 && oy >= 0 && oy < 7 && finder(ox, oy) : rnd() > 0.52;
      if (on) cells.push({ x, y });
    }
  }
  return cells;
}
