// Ikon adaptif Android dari tanda "S": kanvas 1024, tanda di tengah. Diagonal kotak tanda harus muat di lingkaran
// zona aman 66/108, supaya ujung daun dan sudut gelembung tidak terpotong masker bulat. Jalankan ulang setelah logo
// vektor tersedia.
import sharp from 'sharp';

const SIZE = 1024;
const SAFE = (SIZE * 66) / 108;
const RATIO = 282 / 310; // lebar / tinggi tanda "S"
const MARK_H = Math.floor(SAFE / Math.hypot(1, RATIO));

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
