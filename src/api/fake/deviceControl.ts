import { AC_MAX, AC_MIN } from '@/api/constants';
import type { AcFan, AcMode, Device as SampleDevice, DeviceExtra } from '@/sample/types';
import type { Capability, CapabilityOption, DeviceControlReq, DeviceState, RemoteKey } from '../contract';
import { REMOTE_KEYS } from '../contract';

export const AC_MODE_OPTIONS: CapabilityOption[] = (['Dingin', 'Kering', 'Kipas', 'Otomatis'] satisfies AcMode[]).map(
  (id) => ({ id, label: id }),
);
export const AC_FAN_OPTIONS: CapabilityOption[] = (['Pelan', 'Sedang', 'Kencang', 'Otomatis'] satisfies AcFan[]).map(
  (id) => ({ id, label: id }),
);
const FAN_SPEEDS: CapabilityOption[] = [
  { id: '1', label: 'Kecepatan 1' },
  { id: '2', label: 'Kecepatan 2' },
  { id: '3', label: 'Kecepatan 3' },
];
const TV_SOURCES: CapabilityOption[] = [
  { id: 'hdmi1', label: 'HDMI 1' },
  { id: 'hdmi2', label: 'HDMI 2' },
  { id: 'tv', label: 'TV digital' },
  { id: 'youtube', label: 'YouTube' },
];
const SPEAKER_SOURCES: CapabilityOption[] = [
  { id: 'bluetooth', label: 'Bluetooth' },
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'aux', label: 'AUX' },
];
const COLOR_PRESETS = [
  { id: 'putih', label: 'Putih', hex: '#FFFFFF' },
  { id: 'hangat', label: 'Hangat', hex: '#FFB46B' },
  { id: 'biru', label: 'Biru', hex: '#4D8DFF' },
  { id: 'hijau', label: 'Hijau', hex: '#3ECF8E' },
  { id: 'merah', label: 'Merah', hex: '#FF5A5F' },
  { id: 'ungu', label: 'Ungu', hex: '#A06BFF' },
];
/** Daftar putar contoh untuk speaker: "berikutnya" dan "sebelumnya" berputar di sini. */
export const PLAYLIST: { title: string; artist: string }[] = [
  { title: 'Bengawan Solo', artist: 'Keroncong' },
  { title: 'Rumah Kita', artist: 'God Bless' },
  { title: 'Kopi Dangdut', artist: 'Fahmi Shahab' },
  { title: 'Laskar Pelangi', artist: 'Nidji' },
];
export const VOLUME_MAX = 100;
export const CHANNEL_MAX = 999;

const POWER: Capability = { type: 'power' };

/** Kemampuan perangkat contoh menurut jenisnya (dan keadaannya, untuk lampu yang punya warna). */
export function capabilitiesOf(d: SampleDevice): Capability[] {
  switch (d.kind) {
    case 'ac':
      return [
        POWER,
        { type: 'temperature', min: AC_MIN, max: AC_MAX, step: 1, unit: 'C' },
        { type: 'mode', options: AC_MODE_OPTIONS },
        { type: 'fan', options: AC_FAN_OPTIONS },
        { type: 'swing' },
        { type: 'timer', maxMinutes: 720 },
      ];
    case 'tv':
      return [
        POWER,
        { type: 'volume', min: 0, max: VOLUME_MAX, step: 1 },
        { type: 'mute' },
        { type: 'source', options: TV_SOURCES },
        { type: 'channel' },
        { type: 'keys', keys: [...REMOTE_KEYS] },
      ];
    case 'speaker':
      return [
        POWER,
        { type: 'playback' },
        { type: 'volume', min: 0, max: VOLUME_MAX, step: 1 },
        { type: 'mute' },
        { type: 'source', options: SPEAKER_SOURCES },
      ];
    case 'lampu': {
      const caps: Capability[] = [POWER, { type: 'brightness', min: 0, max: 100 }];
      if (d.extra?.colorTemp !== undefined) caps.push({ type: 'colorTemp', minK: 2200, maxK: 6500 });
      if (d.extra?.color !== undefined) caps.push({ type: 'color', presets: COLOR_PRESETS });
      return caps;
    }
    case 'kipas':
      return [POWER, { type: 'fan', options: FAN_SPEEDS }, { type: 'swing' }, { type: 'timer', maxMinutes: 480 }];
    case 'colokan':
      return [POWER, { type: 'energy' }, { type: 'timer', maxMinutes: 720 }];
    case 'tirai':
      return [{ type: 'position' }];
    case 'kunci':
      return [{ type: 'lock' }, { type: 'battery' }];
    case 'kamera':
      return [POWER, { type: 'camera' }];
    case 'sensor':
      return [
        {
          type: 'sensor',
          readings: [
            { id: 'temp', label: 'Suhu', unit: '°C' },
            { id: 'humidity', label: 'Kelembapan', unit: '%' },
          ],
        },
        { type: 'battery' },
      ];
    default:
      return [POWER];
  }
}

/** Keadaan terstruktur perangkat contoh. Bidang datar lama (`on`, `level`, `ac`, `roomTemp`) tetap disusun terpisah. */
export function stateOf(d: SampleDevice): DeviceState {
  const x = d.extra ?? {};
  const state: DeviceState = {};
  const set = <K extends keyof DeviceState>(key: K, value: DeviceState[K] | undefined) => {
    if (value !== undefined) state[key] = value;
  };
  switch (d.kind) {
    case 'ac':
      set('on', d.on);
      set('temp', d.ac?.temp);
      set('mode', d.ac?.mode);
      set('fan', d.ac?.fan);
      set('swing', x.swing ?? false);
      set('timerMinutes', x.timerMinutes ?? 0);
      set('roomTemp', d.roomTemp);
      break;
    case 'tv':
      set('on', d.on);
      set('volume', x.volume);
      set('muted', x.muted ?? false);
      set('source', x.source);
      set('channel', x.channel);
      break;
    case 'speaker': {
      set('on', d.on);
      set('playing', d.on && (x.playing ?? false));
      const track = PLAYLIST[x.trackIndex ?? 0];
      if (track) state.track = { title: track.title, artist: track.artist };
      set('volume', x.volume);
      set('muted', x.muted ?? false);
      set('source', x.source);
      break;
    }
    case 'lampu':
      set('on', d.on);
      set('brightness', d.level);
      set('colorTemp', x.colorTemp);
      set('color', x.color);
      break;
    case 'kipas':
      set('on', d.on);
      set('fan', x.fan);
      set('swing', x.swing ?? false);
      set('timerMinutes', x.timerMinutes ?? 0);
      break;
    case 'colokan':
      set('on', d.on);
      set('powerW', d.on ? x.powerW : 0);
      set('energyTodayKWh', x.energyTodayKWh);
      set('timerMinutes', x.timerMinutes ?? 0);
      break;
    case 'tirai':
      set('position', x.position);
      break;
    case 'kunci':
      set('locked', d.on);
      set('battery', x.battery ?? 64);
      break;
    case 'kamera':
      set('on', d.on);
      set('privacy', !d.on);
      if (d.on) {
        set('snapshotMediaId', `snap-${d.id}`);
        set('snapshotAt', x.snapshotAt);
      }
      break;
    case 'sensor':
      set('readings', x.readings);
      set('roomTemp', d.roomTemp);
      set('humidity', x.humidity);
      set('battery', x.battery);
      break;
    default:
      set('on', d.on);
  }
  return state;
}

/** Apa yang diubah satu perintah, siap dikirim ke penyimpanan contoh. */
export interface ControlPlan {
  on?: boolean;
  ac?: { temp?: number; mode?: AcMode; fan?: AcFan };
  level?: number;
  extra: DeviceExtra;
}
export type PlanResult = { ok: true; plan: ControlPlan } | { ok: false; error: 'invalid' | 'unsupported' };

const NO = (error: 'invalid' | 'unsupported'): PlanResult => ({ ok: false, error });
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Menerjemahkan satu perintah ke perubahan keadaan, dengan aturan server: kemampuan yang tidak dimiliki perangkat
 * `unsupported` (400 `tidak_didukung`), nilai di luar rentang atau pilihan asing `invalid` (400 `tidak_valid`).
 */
export function planControl(d: SampleDevice, r: DeviceControlReq): PlanResult {
  const caps = capabilitiesOf(d);
  const has = <T extends Capability['type']>(type: T) =>
    caps.find((c): c is Extract<Capability, { type: T }> => c.type === type);
  const plan: ControlPlan = { extra: {} };
  const extra = plan.extra;
  const x = d.extra ?? {};

  // Nyala-mati. Kunci memakai `locked`, kamera `privacy`; `on` lama tetap diterima untuk keduanya.
  if (r.on !== undefined) {
    if (!has('power') && !has('lock')) return NO('unsupported');
    plan.on = r.on;
  }
  if (r.locked !== undefined) {
    if (!has('lock')) return NO('unsupported');
    if (r.on !== undefined && r.on !== r.locked) return NO('invalid');
    plan.on = r.locked;
  }
  if (r.privacy !== undefined) {
    if (!has('camera')) return NO('unsupported');
    if (r.on !== undefined && r.on === r.privacy) return NO('invalid');
    plan.on = !r.privacy;
  }

  const temperature = has('temperature');
  if (r.temp !== undefined) {
    if (!temperature) return NO('unsupported');
    if (r.temp < temperature.min || r.temp > temperature.max) return NO('invalid');
    plan.ac = { ...plan.ac, temp: Math.round(r.temp / temperature.step) * temperature.step };
  }
  if (r.mode !== undefined) {
    const mode = has('mode');
    if (!mode) return NO('unsupported');
    if (!mode.options.some((o) => o.id === r.mode)) return NO('invalid');
    plan.ac = { ...plan.ac, mode: r.mode as AcMode };
  }
  if (r.fan !== undefined) {
    const fan = has('fan');
    if (!fan) return NO('unsupported');
    if (!fan.options.some((o) => o.id === r.fan)) return NO('invalid');
    if (d.kind === 'ac') plan.ac = { ...plan.ac, fan: r.fan as AcFan };
    else extra.fan = r.fan;
  }
  if (r.swing !== undefined) {
    if (!has('swing')) return NO('unsupported');
    extra.swing = r.swing;
  }
  if (r.timerMinutes !== undefined) {
    const timer = has('timer');
    if (!timer) return NO('unsupported');
    if (r.timerMinutes > timer.maxMinutes) return NO('invalid');
    extra.timerMinutes = r.timerMinutes;
  }

  const brightness = r.brightness ?? r.level;
  if (brightness !== undefined) {
    const cap = has('brightness');
    if (!cap) return NO('unsupported');
    if (brightness < cap.min || brightness > cap.max) return NO('invalid');
    plan.level = brightness;
  }
  if (r.colorTemp !== undefined) {
    const cap = has('colorTemp');
    if (!cap) return NO('unsupported');
    if (r.colorTemp < cap.minK || r.colorTemp > cap.maxK) return NO('invalid');
    extra.colorTemp = r.colorTemp;
  }
  if (r.color !== undefined) {
    const cap = has('color');
    if (!cap) return NO('unsupported');
    if (!cap.presets.some((p) => p.id === r.color) && !HEX.test(r.color)) return NO('invalid');
    extra.color = r.color;
  }

  const volume = has('volume');
  if (r.volume !== undefined) {
    if (!volume) return NO('unsupported');
    if (r.volume < volume.min || r.volume > volume.max) return NO('invalid');
    extra.volume = r.volume;
  }
  if (r.muted !== undefined) {
    if (!has('mute')) return NO('unsupported');
    extra.muted = r.muted;
  }
  if (r.playback !== undefined) {
    if (!has('playback')) return NO('unsupported');
    const count = PLAYLIST.length;
    const at = x.trackIndex ?? 0;
    if (r.playback === 'play') extra.playing = true;
    else if (r.playback === 'pause') extra.playing = false;
    else {
      extra.trackIndex = (at + (r.playback === 'next' ? 1 : count - 1)) % count;
      extra.playing = true;
    }
  }
  if (r.source !== undefined) {
    const cap = has('source');
    if (!cap) return NO('unsupported');
    if (!cap.options.some((o) => o.id === r.source)) return NO('invalid');
    extra.source = r.source;
  }
  if (r.channel !== undefined) {
    if (!has('channel')) return NO('unsupported');
    if (r.channel < 1 || r.channel > CHANNEL_MAX) return NO('invalid');
    extra.channel = r.channel;
    extra.channelBuf = '';
  }
  if (r.position !== undefined) {
    if (!has('position')) return NO('unsupported');
    extra.position = r.position;
    plan.on = r.position > 0;
  }
  if (r.key !== undefined) {
    const keys = has('keys');
    if (!keys?.keys.includes(r.key)) return NO('unsupported');
    // Tombol hanya bekerja saat perangkat menyala.
    if (d.on) applyKey(r.key, d, extra, volume);
  }
  return { ok: true, plan };
}

function applyKey(
  key: RemoteKey,
  d: SampleDevice,
  extra: DeviceExtra,
  volume: Extract<Capability, { type: 'volume' }> | undefined,
) {
  const x = d.extra ?? {};
  if (key === 'vol_up' || key === 'vol_down') {
    const max = volume?.max ?? VOLUME_MAX;
    extra.volume = clamp((x.volume ?? 0) + (key === 'vol_up' ? 1 : -1), volume?.min ?? 0, max);
    extra.muted = false;
  } else if (key === 'ch_up' || key === 'ch_down') {
    const next = (x.channel ?? 1) + (key === 'ch_up' ? 1 : -1);
    extra.channel = next > CHANNEL_MAX ? 1 : next < 1 ? CHANNEL_MAX : next;
    extra.channelBuf = '';
  } else if (/^[0-9]$/.test(key)) {
    // Mengetik channel: angka menyambung sampai tiga angka, lalu mulai dari awal.
    const typed = (x.channelBuf ?? '').length >= 3 ? key : `${x.channelBuf ?? ''}${key}`;
    extra.channelBuf = typed;
    const n = Number(typed);
    if (n >= 1) extra.channel = n;
  }
  // Tombol arah, OK, kembali, beranda, dan menu hanya diteruskan ke perangkat; tidak ada keadaan yang berubah.
}
