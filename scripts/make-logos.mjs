// Logo layanan untuk Terhubung (khusus pengembangan, tidak ikut aplikasi): membaca assets/logos/*.svg lalu menulis
// src/ui/connect/logoXml.ts, satu string SVG per logo untuk `SvgXml` (react-native-svg).
//
//   source dev-env.sh && node scripts/make-logos.mjs
//
// Asal berkas: logo landing (landing/site/img/logos), Simple Icons v13 (CC0; warna dari data simple-icons) untuk merek
// yang tidak ada di landing, dan empat persegi Microsoft. Logo PNG (Plaud, Tokopedia) dipakai langsung lewat `Image`;
// latar putih PNG landing sudah dibuang sekali (Plaud: alfa dari gelapnya, supaya bisa diwarnai ulang di mode gelap).
// Yang dibersihkan: <title>, role, dan bagian yang memakai <filter> (sorot blur halus di logo Google; dukungan filter di
// HP belum pasti, dan tanpa blur sorotnya bersudut tajam, jadi dibuang utuh).
// id di dalam SVG diberi awalan nama logo supaya tidak bentrok saat beberapa logo tampil di satu halaman (web).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const root = join(import.meta.dirname, '..');
const dir = join(root, 'assets/logos');
const out = join(root, 'src/ui/connect/logoXml.ts');

function clean(name, xml) {
  let s = xml
    .replace(/<\?xml[^>]*>/g, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/\srole="img"/g, '')
    .replace(/<g[^>]*\sfilter="[^"]*"[^>]*>[\s\S]*?<\/g>/g, '')
    .replace(/<path[^>]*\sfilter="[^"]*"[^>]*\/>/g, '')
    .replace(/<filter[\s\S]*?<\/filter>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids) {
    const next = `${name}-${id}`;
    s = s
      .replaceAll(`id="${id}"`, `id="${next}"`)
      .replaceAll(`url(#${id})`, `url(#${next})`)
      .replaceAll(`href="#${id}"`, `href="#${next}"`);
  }
  return s;
}

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.svg'))
  .sort();
const lines = files.map((f) => {
  const name = f.replace(/\.svg$/, '');
  const xml = clean(name, readFileSync(join(dir, f), 'utf8'));
  if (/['\\]/.test(xml)) throw new Error(`${f}: tanda kutip tunggal atau garis miring terbalik`);
  return `  ${/^[a-z]+$/.test(name) ? name : `'${name}'`}: '${xml}',`;
});

writeFileSync(
  out,
  `// Dibuat oleh scripts/make-logos.mjs dari assets/logos/*.svg. Jangan diubah dengan tangan: ubah berkasnya, lalu jalankan
// lagi skripnya.
// prettier-ignore
export const LOGO_XML = {
${lines.join('\n')}
} as const;

export type LogoXmlKey = keyof typeof LOGO_XML;
`,
);
process.stdout.write(`${files.length} logo -> ${out}\n`);
