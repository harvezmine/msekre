// Pastikan patch di patches/ benar-benar terpasang di node_modules (dijalankan EAS setelah npm ci lewat
// `eas-build-post-install`, juga bisa dijalankan sendiri). Tanpa patch Reanimated, jam frame dengan id yang tak dikenal
// melempar di utas UI, dan di build rilis itu menutup paksa aplikasi: lebih baik build-nya gagal di sini.
import { readFileSync } from 'node:fs';

const MARK = 'patch Sekretaris AI';
const FILES = [
  // Metro membundel dari src (kolom "react-native"), Jest memakai lib (kolom "main").
  'node_modules/react-native-reanimated/src/frameCallback/FrameCallbackRegistryUI.ts',
  'node_modules/react-native-reanimated/lib/module/frameCallback/FrameCallbackRegistryUI.js',
];

const missing = FILES.filter((file) => !readFileSync(file, 'utf8').includes(MARK));
if (missing.length > 0) {
  console.error(`Patch belum terpasang (jalankan npx patch-package):\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log(`Patch terpasang: ${FILES.length} berkas.`);
