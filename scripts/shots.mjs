// Tangkapan layar aplikasi tanpa HP (khusus pengembangan, tidak ikut aplikasi). Menyalakan server web Expo, membuka
// rute di Chromium tanpa layar (cache Playwright), lalu menyimpan PNG per rute × ukuran × tema.
//
//   source dev-env.sh && node scripts/shots.mjs /dev/kit /akun --out /tmp/shots
//   node scripts/shots.mjs /dev/kit --sizes 393x873 --themes dark --url http://localhost:8099   (server sudah jalan)
//
// Pilihan: --out <folder> (wajib), --sizes 393x873,360x640,412x915, --themes light,dark, --port 8099,
// --url <server yang sudah jalan>, --wait <ms waktu virtual per halaman, bawaan 12000>, --motion on (gerak tetap jalan;
// bawaannya "kurangi gerakan" dipaksa supaya halaman langsung dalam keadaan akhir), --real <ms> (jam sungguhan lewat
// DevTools: tunggu sekian ms lalu ambil gambar; perlu untuk Skia di web, yang macet dengan waktu virtual). Peramban: env CHROME, atau
// chrome-headless-shell terbaru di ~/Library/Caches/ms-playwright. Data: mode contoh (tanpa server API).
// Skia di web (gelombang Mode Suara) butuh CanvasKit: `canvaskit.wasm` disalin ke `public/` (diabaikan git) selama
// skrip berjalan, lalu dihapus lagi.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
import process from 'node:process';

function parse(argv) {
  const opts = { routes: [], sizes: '393x873,360x640,412x915', themes: 'light,dark', port: '8099', wait: '12000' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) opts[a.slice(2)] = argv[++i];
    else opts.routes.push(a);
  }
  return opts;
}

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = join(homedir(), 'Library/Caches/ms-playwright');
  const dirs = existsSync(base)
    ? readdirSync(base)
        .filter((d) => d.startsWith('chromium_headless_shell-'))
        .sort()
        .reverse()
    : [];
  for (const d of dirs) {
    for (const arch of [
      'chrome-headless-shell-mac-arm64',
      'chrome-headless-shell-mac-x64',
      'chrome-headless-shell-linux64',
    ]) {
      const p = join(base, d, arch, 'chrome-headless-shell');
      if (existsSync(p)) return p;
    }
  }
  throw new Error('chrome-headless-shell tidak ditemukan: set env CHROME.');
}

async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // Server belum siap.
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server web tidak siap: ${url}`);
}

/**
 * Satu gambar dengan jam sungguhan lewat Chrome DevTools Protocol: animasi (gelombang Skia) berjalan seperti di HP.
 * Waktu virtual Chrome tidak dipakai karena tiap frame WebGL perangkat lunak sangat lambat.
 */
async function shotReal(chrome, url, file, size, theme, waitMs, reduce) {
  const [width, height] = size.split('x').map(Number);
  const port = 9333;
  const proc = spawn(
    chrome,
    [
      '--headless',
      '--hide-scrollbars',
      '--enable-unsafe-swiftshader',
      `--remote-debugging-port=${port}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      await sleep(200);
      const list = await fetch(`http://127.0.0.1:${port}/json/list`)
        .then((r) => r.json())
        .catch(() => []);
      target = list.find((t) => t.type === 'page');
    }
    if (!target) return false;
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    });
    const send = (method, params = {}) =>
      new Promise((r) => {
        const n = ++id;
        pending.set(n, r);
        ws.send(JSON.stringify({ id: n, method, params }));
      });
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
    await send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-color-scheme', value: theme },
        { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' },
      ],
    });
    await send('Page.navigate', { url });
    await sleep(waitMs);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    ws.close();
    if (!shot.result?.data) return false;
    writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
    return true;
  } finally {
    proc.kill();
  }
}

const opts = parse(process.argv.slice(2));
const CANVASKIT_FROM = 'node_modules/canvaskit-wasm/bin/full/canvaskit.wasm';
const CANVASKIT_TO = 'public/canvaskit.wasm';
if (!opts.out || opts.routes.length === 0) {
  console.error('Pakai: node scripts/shots.mjs <rute...> --out <folder> [--sizes 393x873] [--themes light,dark]');
  process.exit(1);
}
mkdirSync(opts.out, { recursive: true });
const chrome = findChrome();
const base = opts.url ?? `http://localhost:${opts.port}`;

// CanvasKit untuk Skia di web; dihapus lagi di akhir kalau skrip ini yang menyalinnya.
let copiedCanvasKit = false;
const hadPublic = existsSync('public');
if (!existsSync(CANVASKIT_TO) && existsSync(CANVASKIT_FROM)) {
  mkdirSync('public', { recursive: true });
  copyFileSync(CANVASKIT_FROM, CANVASKIT_TO);
  copiedCanvasKit = true;
}

let server = null;
if (!opts.url) {
  server = spawn('npx', ['expo', 'start', '--web', '--port', opts.port], {
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
    stdio: 'ignore',
    detached: true,
  });
}
const stop = () => {
  if (copiedCanvasKit) {
    rmSync(CANVASKIT_TO, { force: true });
    if (!hadPublic) rmSync('public', { recursive: true, force: true });
    copiedCanvasKit = false;
  }
  if (server) {
    try {
      process.kill(-server.pid);
    } catch {
      // Sudah berhenti.
    }
    server = null;
  }
};
process.on('exit', stop);
process.on('SIGINT', () => process.exit(130));

try {
  await waitFor(base, 180_000);
  for (const route of opts.routes) {
    // Pemanasan: bundel pertama Metro bisa lebih dari satu menit.
    await fetch(base + route).catch(() => {});
    for (const size of opts.sizes.split(',')) {
      for (const theme of opts.themes.split(',')) {
        const name = `${route.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '-') || 'beranda'}-${size}-${theme}.png`;
        const file = join(opts.out, name);
        if (opts.real) {
          const ok = await shotReal(chrome, base + route, file, size, theme, Number(opts.real), opts.motion !== 'on');
          console.log(ok ? file : `gagal: ${name}`);
          continue;
        }
        const args = [
          '--headless',
          '--disable-gpu',
          '--hide-scrollbars',
          '--force-device-scale-factor=2',
          `--window-size=${size.replace('x', ',')}`,
          `--virtual-time-budget=${opts.wait}`,
          '--run-all-compositor-stages-before-draw',
          // Tanpa animasi masuk: halaman langsung dalam keadaan akhir (waktu virtual tidak selalu menjalankan semua frame).
          ...(opts.motion === 'on' ? [] : ['--force-prefers-reduced-motion']),
          `--screenshot=${file}`,
          ...(theme === 'dark' ? ['--force-dark-mode', '--blink-settings=preferredColorScheme=0'] : []),
          base + route,
        ];
        const r = spawnSync(chrome, args, { stdio: 'ignore', timeout: 120_000 });
        console.log(r.status === 0 && existsSync(file) ? file : `gagal: ${name}`);
      }
    }
  }
} finally {
  stop();
}
