/**
 * Penjaga kendala aplikasi.
 * - {@link reportError}: kendala yang sudah ditangani (batas kesalahan, try/catch di sekitar modul native) dicatat ke log HP
 *   (`adb logcat`, tag `ReactNativeJS`, awalan `[SekretarisAI]`) dan ke daftar singkat di memori ({@link recentErrors}).
 *   Saat pengembangan juga muncul di LogBox, jadi tidak pernah tertelan diam-diam.
 * - {@link installCrashGuard}: penangan global `ErrorUtils`. Di build rilis, kesalahan JavaScript yang tidak tertangkap
 *   (yang biasanya menutup paksa aplikasi lewat `JavascriptException`) dicatat lalu diteruskan sebagai kesalahan biasa,
 *   jadi aplikasi tetap terbuka. Saat pengembangan diteruskan apa adanya (layar merah).
 *
 * Catatan: kesalahan di worklet utas UI (Reanimated, Skia) di build rilis membatalkan proses langsung di C++ dan tidak
 * pernah sampai ke sini; worklet dijaga sendiri (src/voice/waveMath.ts, src/voice/WavesSkia.tsx).
 */

export const LOG_TAG = '[SekretarisAI]';
const MAX_RECENT = 20;

export interface RecordedError {
  at: number;
  where: string;
  message: string;
  fatal: boolean;
}

const recent: RecordedError[] = [];

export function errorMessage(error: unknown): string {
  try {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    if (typeof error === 'string') return error;
    return JSON.stringify(error) ?? String(error);
  } catch {
    return 'kendala tanpa keterangan';
  }
}

function remember(where: string, error: unknown, fatal: boolean): void {
  recent.push({ at: Date.now(), where, message: errorMessage(error), fatal });
  if (recent.length > MAX_RECENT) recent.shift();
}

/** Kendala terakhir yang dicatat (paling baru di akhir), untuk pemeriksaan dan laporan. */
export function recentErrors(): readonly RecordedError[] {
  return recent;
}

/** Catat kendala yang sudah ditangani. Tidak pernah melempar. */
export function reportError(where: string, error: unknown): void {
  try {
    remember(where, error, false);
    console.error(`${LOG_TAG} ${where}:`, errorMessage(error));
  } catch {
    // Mencatat pun gagal: tidak ada lagi yang bisa dilakukan.
  }
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
interface ErrorUtilsLike {
  getGlobalHandler(): GlobalHandler;
  setGlobalHandler(handler: GlobalHandler): void;
}

let installed: { utils: ErrorUtilsLike; previous: GlobalHandler } | null = null;

/**
 * Pasang penangan global sekali, sedini mungkin (app/_layout.tsx). `dev` = build pengembangan: kesalahan fatal tetap fatal
 * (layar merah). Rilis: dicatat dan diteruskan sebagai bukan fatal, jadi aplikasi tidak ditutup paksa.
 */
export function installCrashGuard(dev: boolean = __DEV__): void {
  if (installed) return;
  const utils = (globalThis as { ErrorUtils?: Partial<ErrorUtilsLike> }).ErrorUtils;
  if (typeof utils?.getGlobalHandler !== 'function' || typeof utils.setGlobalHandler !== 'function') return;
  const previous = utils.getGlobalHandler();
  const handler: GlobalHandler = (error, isFatal) => {
    try {
      remember(isFatal ? 'tidak tertangkap (fatal)' : 'tidak tertangkap', error, !!isFatal);
    } catch {
      // Lanjut ke penangan bawaan.
    }
    try {
      // Penangan bawaan React Native mencatatnya ke log (dan LogBox saat pengembangan).
      previous?.(error, dev ? isFatal : false);
    } catch (e) {
      if (dev) throw e;
    }
  };
  utils.setGlobalHandler(handler);
  installed = { utils: utils as ErrorUtilsLike, previous };
}

/** Untuk tes: lepas penangan dan kosongkan catatan. */
export function resetCrashGuard(): void {
  if (installed) installed.utils.setGlobalHandler(installed.previous);
  installed = null;
  recent.length = 0;
}
