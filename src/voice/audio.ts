import {
  createAudioPlayer,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Izin mikrofon:
 * - `granted`: boleh merekam;
 * - `ask`: belum pernah ditanya (atau sistem masih mau menanyakan lagi): jelaskan dulu, lalu {@link requestMic};
 * - `blocked`: ditolak dan sistem tidak mau menanyakan lagi: hanya lewat pengaturan HP.
 */
export type MicPermission = 'granted' | 'ask' | 'blocked';

function classify(res: { granted: boolean; canAskAgain: boolean; status: string }): MicPermission {
  if (res.granted) return 'granted';
  return res.canAskAgain ? 'ask' : 'blocked';
}

export async function checkMic(): Promise<MicPermission> {
  try {
    return classify(await getRecordingPermissionsAsync());
  } catch {
    return 'blocked';
  }
}

/** Munculkan jendela izin sistem. Hasilnya `granted` atau, kalau ditolak, `ask`/`blocked` menurut sistem. */
export async function requestMic(): Promise<MicPermission> {
  try {
    const res = await requestRecordingPermissionsAsync();
    if (res.granted) return 'granted';
    // Setelah jendela sistem ditolak, jangan menanyakan lagi dari dalam aplikasi: arahkan ke pengaturan.
    return 'blocked';
  } catch {
    return 'blocked';
  }
}

/** Sesi audio untuk Mode Suara: boleh merekam, suara keluar lewat speaker (atau headset yang tersambung), juga saat HP senyap. */
export async function enterVoiceAudio(): Promise<void> {
  try {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
      shouldPlayInBackground: false,
      interruptionMode: 'doNotMix',
    });
  } catch {
    // Mode audio gagal dipasang: perekaman dan pemutaran tetap dicoba dengan pengaturan sistem.
  }
}

export async function leaveVoiceAudio(): Promise<void> {
  try {
    await setAudioModeAsync({ allowsRecording: false, interruptionMode: 'mixWithOthers' });
  } catch {
    // Tidak ada yang perlu dilakukan.
  }
}

const EXTENSIONS: Record<string, string> = {
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/aac': 'aac',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
};

/** Sumber suara yang bisa diputar `expo-audio`. */
export type SpeechSource = { uri: string; headers?: Record<string, string> };

/**
 * Tulis potongan audio balasan (base64) menjadi satu berkas di cache; alamat berkasnya. Base64 ditulis langsung oleh
 * pustaka berkas (potongan berikutnya ditambahkan), tanpa diurai jadi byte di JavaScript.
 */
export function writeSpeechFile(chunksBase64: string[], mime: string, name: string): string {
  const dir = new Directory(Paths.cache, 'suara');
  dir.create({ idempotent: true, intermediates: true });
  const file = new File(dir, `${name}.${EXTENSIONS[mime.toLowerCase()] ?? 'mp3'}`);
  file.create({ overwrite: true });
  chunksBase64.forEach((chunk, i) => file.writeSync(chunk, { encoding: 'base64', append: i > 0 }));
  return file.uri;
}

/** Hapus berkas suara balasan yang sudah diputar. Tidak ada yang rusak kalau berkasnya sudah tidak ada. */
export function removeSpeechFile(uri: string): void {
  try {
    new File(uri).delete();
  } catch {
    // Sudah terhapus.
  }
}

/** Pemutaran yang tidak kunjung selesai (dan tidak melapor gagal) dianggap selesai: lama klip + ini, atau {@link UNKNOWN_CLIP_MS}. */
export const CLIP_SLACK_MS = 10_000;
export const UNKNOWN_CLIP_MS = 60_000;

/** Pemutar balasan: klip diputar berurutan, satu pada satu waktu. */
export interface Speaker {
  /**
   * Putar `source` setelah klip yang sedang jalan selesai; `onDone` dipanggil sekali saat klip ini selesai, gagal, atau
   * kehabisan waktu.
   */
  play(source: SpeechSource, onDone: () => void): void;
  /** Hentikan dan lepaskan pemutar yang sedang jalan dan buang antreannya. Tidak memanggil `onDone`. */
  stop(): void;
}

export function createSpeaker(): Speaker {
  let current: AudioPlayer | null = null;
  let off: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queue: { source: SpeechSource; onDone: () => void }[] = [];
  const release = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    off?.();
    off = null;
    const player = current;
    current = null;
    if (!player) return;
    try {
      player.pause();
      player.remove();
    } catch {
      // Pemutar sudah dilepas.
    }
  };
  const next = () => {
    if (current) return;
    const item = queue.shift();
    if (!item) return;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      release();
      item.onDone();
      next();
    };
    const arm = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(done, ms);
    };
    try {
      const player = createAudioPlayer(item.source);
      current = player;
      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish || status.error) return done();
        // Lama klip diketahui: batas waktunya diperketat.
        if (status.duration > 0) arm(status.duration * 1000 + CLIP_SLACK_MS);
      });
      off = () => sub.remove();
      arm(UNKNOWN_CLIP_MS);
      player.play();
    } catch {
      done();
    }
  };
  return {
    play(source, onDone) {
      queue.push({ source, onDone });
      if (!current) next();
    },
    stop() {
      queue = [];
      release();
    },
  };
}
