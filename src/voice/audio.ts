import {
  createAudioPlayer,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { concat, fromBase64 } from './pcm';

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

/** Tulis potongan audio balasan (base64) menjadi satu berkas di cache; alamat berkasnya. */
export function writeSpeechFile(chunksBase64: string[], mime: string, name: string): string {
  const dir = new Directory(Paths.cache, 'suara');
  dir.create({ idempotent: true, intermediates: true });
  const file = new File(dir, `${name}.${EXTENSIONS[mime.toLowerCase()] ?? 'mp3'}`);
  file.create({ overwrite: true });
  file.write(concat(chunksBase64.map(fromBase64)));
  return file.uri;
}

/** Pemutar balasan: satu suara pada satu waktu. */
export interface Speaker {
  /** Putar `source`; `onDone` dipanggil saat selesai atau gagal (sekali). Memutar baru menghentikan yang lama. */
  play(source: SpeechSource, onDone: () => void): void;
  /** Hentikan dan lepaskan pemutar yang sedang jalan. Tidak memanggil `onDone`. */
  stop(): void;
}

export function createSpeaker(): Speaker {
  let current: AudioPlayer | null = null;
  let off: (() => void) | null = null;
  const release = () => {
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
  return {
    play(source, onDone) {
      release();
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        release();
        onDone();
      };
      try {
        const player = createAudioPlayer(source);
        current = player;
        const sub = player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) done();
        });
        off = () => sub.remove();
        player.play();
      } catch {
        done();
      }
    },
    stop: release,
  };
}
