import { initialAgenda, initialLeftover, TODAY } from './agenda';
import { clampTemp, initialDevices, MAIN_AC_ID } from './devices';
import { initialBusiness, initialHistory } from './history';
import { addMinutes } from '@/api/dates';
import { initialOutgoing } from './outgoing';
import { initialServices, serviceCatalog } from './services';
import type {
  AcFan,
  AcMode,
  AcSettings,
  AgendaItem,
  Business,
  Device,
  HistoryEntry,
  Leftover,
  NewDraft,
  Outgoing,
  Permission,
  Place,
  Service,
} from './types';

export type ActionSource = 'suara' | 'aplikasi' | 'chat';

export interface SampleState {
  place: Place;
  /** Semua perangkat semua tempat, dengan keadaan terstruktur. Tulisan keadaan dibuat `deviceStatus`. */
  devices: Device[];
  /** Mikrofon Kotak Sekretaris AI menyala (kartu Kotak di Perangkat). */
  boxMic: boolean;
  /** Kiriman per id: draf, tertahan, terkirim, dibatalkan. Urutan sisip = urutan dibuat. */
  outgoing: Record<string, Outgoing>;
  agenda: AgendaItem[];
  leftover: Leftover | null;
  /** Layanan tersambung. Cincin Beranda diturunkan dari sini dan dari perangkat (`ringNodes`). */
  services: Service[];
  /** Id layanan yang isi ingatannya sudah dihapus. */
  forgotten: string[];
  /** Id layanan yang pernah tersambung lalu diputus, yang terbaru di depan. */
  formerly: string[];
  history: HistoryEntry[];
  business: Business;
  /** Pencacah untuk id baru, supaya reducer tetap murni. */
  seq: number;
}

export type SampleAction =
  | { type: 'setPlace'; place: Place }
  /** Mengatur satu AC (bawaan AC kamar). Suhu dibulatkan dan dibatasi 16–30. */
  | {
      type: 'setAc';
      deviceId?: string;
      on?: boolean;
      temp?: number;
      mode?: AcMode;
      fan?: AcFan;
      source?: ActionSource;
    }
  | { type: 'toggleDevice'; id: string; on: boolean }
  /** Terang lampu 0–100. Tidak mengubah nyala atau matinya. */
  | { type: 'setLevel'; id: string; level: number }
  | { type: 'setBoxMic'; on: boolean }
  /** Draf baru (misalnya "Pesan lagi"). Kartunya di chat dibuat server tiruan (`FakeTransport`) saat melihat kiriman baru. */
  | { type: 'addDraft'; draft: NewDraft }
  | { type: 'editDraft'; id: string; text: string }
  | { type: 'sendDraft'; id: string }
  | { type: 'cancelSend'; id: string }
  /** Masa tahan lima menit habis dan kiriman sudah keluar (server mengabarkannya). */
  | { type: 'markSent'; id: string }
  /** Draf yang belum disetujui dibuang (tombol "Buang draf" di chat). */
  | { type: 'discardDraft'; id: string }
  | { type: 'addAgenda'; item: Omit<AgendaItem, 'id'> }
  | { type: 'snooze'; id: string; until: string }
  | { type: 'finishLeftover'; choice: 'today' | 'drop' }
  | { type: 'toggleTask'; id: string }
  /** Tandai item (tugas atau pengingat) selesai atau belum, dari server tiruan. */
  | { type: 'setDone'; id: string; done: boolean }
  | { type: 'connect'; id: string }
  | { type: 'disconnect'; id: string }
  | { type: 'forget'; id: string }
  | { type: 'setPermission'; id: string; permission: Permission };

export const initialSampleState: SampleState = {
  place: 'Semua',
  devices: initialDevices,
  boxMic: true,
  outgoing: initialOutgoing,
  agenda: initialAgenda,
  leftover: initialLeftover,
  services: initialServices,
  forgotten: [],
  formerly: [],
  history: initialHistory,
  business: initialBusiness,
  seq: 0,
};

/** Jam contoh saat pengguna bertindak lewat aplikasi (desain 2m). */
const NOW_APP = '10.43';
const NOW_VOICE = '10.41';

const lc = (s: string) => (s.length > 1 && s[1] === s[1]!.toLowerCase() ? s[0]!.toLowerCase() + s.slice(1) : s);

function withHistory(state: SampleState, entry: Omit<HistoryEntry, 'id' | 'day'>): { state: SampleState; id: string } {
  const id = `h-${state.seq + 1}`;
  return {
    id,
    state: { ...state, seq: state.seq + 1, history: [{ ...entry, id, day: 'Hari ini' }, ...state.history] },
  };
}

function setOutgoing(state: SampleState, id: string, patch: Partial<Outgoing>): SampleState {
  return { ...state, outgoing: { ...state.outgoing, [id]: { ...state.outgoing[id]!, ...patch } } };
}

const placeKind = (d: Device) => (d.place === 'Rumah' ? 'rumah' : 'usaha');

function setDevice(devices: Device[], id: string, patch: Partial<Device>): Device[] {
  return devices.map((d) => (d.id === id ? { ...d, ...patch } : d));
}

export function sampleReducer(state: SampleState, action: SampleAction): SampleState {
  switch (action.type) {
    case 'setPlace':
      return state.place === action.place ? state : { ...state, place: action.place };

    case 'setAc': {
      const d = state.devices.find((x) => x.id === (action.deviceId ?? MAIN_AC_ID));
      if (!d || d.kind !== 'ac' || !d.ac || !d.reachable) return state;
      const on = action.on ?? d.on;
      const ac: AcSettings = {
        temp: action.temp === undefined ? d.ac.temp : clampTemp(action.temp),
        mode: action.mode ?? d.ac.mode,
        fan: action.fan ?? d.ac.fan,
      };
      if (on === d.on && ac.temp === d.ac.temp && ac.mode === d.ac.mode && ac.fan === d.ac.fan) return state;
      const next: SampleState = { ...state, devices: setDevice(state.devices, d.id, { on, ac }) };
      const time = action.source === 'suara' ? NOW_VOICE : NOW_APP;
      const where = d.place === 'Rumah' ? '' : `${d.place} · `;
      const via = `lewat ${action.source ?? 'aplikasi'} · ${time}`;
      const base = { time, kind: placeKind(d), icon: d.icon, deviceId: d.id } as const;
      if (on !== d.on) {
        return withHistory(next, {
          ...base,
          title: `${on ? 'Menyalakan' : 'Mematikan'} ${lc(d.name)}`,
          sub: `${where}${via}`,
        }).state;
      }
      // Mengatur suhu/mode berkali-kali jadi satu catatan, bukan sepuluh.
      const entry = { ...base, title: `Mengatur ${lc(d.name)}`, sub: `${where}${ac.temp}° · ${ac.mode} · ${via}` };
      const top = next.history[0];
      return top && top.deviceId === d.id && top.title === entry.title && top.day === 'Hari ini'
        ? { ...next, history: [{ ...top, ...entry }, ...next.history.slice(1)] }
        : withHistory(next, entry).state;
    }

    case 'toggleDevice': {
      const d = state.devices.find((x) => x.id === action.id);
      if (!d || !d.reachable || d.on === action.on) return state;
      if (d.kind === 'ac') return sampleReducer(state, { type: 'setAc', deviceId: d.id, on: action.on });
      const name = lc(d.name);
      const title =
        d.kind === 'kunci'
          ? `${action.on ? 'Mengunci' : 'Membuka'} ${name}`
          : `${action.on ? 'Menyalakan' : 'Mematikan'} ${name}`;
      return withHistory(
        { ...state, devices: setDevice(state.devices, d.id, { on: action.on }) },
        {
          time: NOW_APP,
          kind: placeKind(d),
          icon: d.icon,
          title,
          sub: `${d.place} · lewat aplikasi · ${NOW_APP}`,
          deviceId: d.id,
        },
      ).state;
    }

    case 'setLevel': {
      const d = state.devices.find((x) => x.id === action.id);
      const level = Math.min(100, Math.max(0, Math.round(action.level)));
      if (!d || !d.reachable || d.kind !== 'lampu' || d.level === level) return state;
      return withHistory(
        { ...state, devices: setDevice(state.devices, d.id, { level }) },
        {
          time: NOW_APP,
          kind: placeKind(d),
          icon: d.icon,
          title: `Mengatur terang ${lc(d.name)}`,
          sub: `${d.place} · ${level}% · lewat aplikasi · ${NOW_APP}`,
          deviceId: d.id,
        },
      ).state;
    }

    case 'setBoxMic':
      if (state.boxMic === action.on) return state;
      return withHistory(
        { ...state, boxMic: action.on },
        {
          time: NOW_APP,
          kind: 'rumah',
          icon: action.on ? 'mic' : 'micOff',
          title: `${action.on ? 'Menyalakan' : 'Mematikan'} mic Kotak Sekretaris AI`,
          sub: `Rumah · lewat aplikasi · ${NOW_APP}`,
        },
      ).state;

    case 'addDraft': {
      const id = `o-${state.seq + 1}`;
      const sentAt = action.draft.sentAt ?? NOW_APP;
      const draft: Outgoing = { ...action.draft, id, status: 'draft', sentAt, heldUntil: addMinutes(sentAt, 5) };
      return { ...state, seq: state.seq + 1, outgoing: { ...state.outgoing, [id]: draft } };
    }

    case 'editDraft': {
      const o = state.outgoing[action.id];
      const text = action.text.trim();
      if (o?.status !== 'draft' || !text || text === o.text) return state;
      return setOutgoing(state, o.id, { text });
    }

    case 'sendDraft': {
      const o = state.outgoing[action.id];
      if (o?.status !== 'draft') return state;
      return withHistory(setOutgoing(state, o.id, { status: 'held' }), {
        time: o.sentAt,
        kind: o.what === 'pesanan' ? 'usaha' : 'pesan',
        icon: 'chat',
        title: `Mengirim ${o.what} ke ${o.to}`,
        sub: `disetujui Anda ${o.sentAt}`,
        outgoingId: o.id,
      }).state;
    }

    case 'cancelSend': {
      const o = state.outgoing[action.id];
      if (o?.status !== 'held') return state;
      return setOutgoing(state, o.id, { status: 'cancelled' });
    }

    case 'markSent': {
      const o = state.outgoing[action.id];
      return o?.status === 'held' ? setOutgoing(state, o.id, { status: 'sent' }) : state;
    }

    case 'discardDraft': {
      const o = state.outgoing[action.id];
      return o?.status === 'draft' ? setOutgoing(state, o.id, { status: 'cancelled' }) : state;
    }

    case 'addAgenda': {
      const id = `a-${state.seq + 1}`;
      const item: AgendaItem = { ...action.item, id };
      const next = { ...state, seq: state.seq + 1, agenda: [...state.agenda, item] };
      return withHistory(next, {
        time: NOW_APP,
        kind: 'lainnya',
        icon: item.kind === 'task' ? 'task' : 'bell',
        title: 'Menambah ke agenda',
        sub: `${item.title} · ${item.time}`,
      }).state;
    }

    case 'snooze':
      return {
        ...state,
        agenda: state.agenda.map((a) => (a.id === action.id ? { ...a, snoozedUntil: action.until } : a)),
      };

    case 'finishLeftover': {
      if (!state.leftover) return state;
      if (action.choice === 'drop') return { ...state, leftover: null };
      const id = `a-${state.seq + 1}`;
      return {
        ...state,
        seq: state.seq + 1,
        leftover: null,
        agenda: [...state.agenda, { id, date: TODAY, time: '17.00', title: state.leftover.title, kind: 'task' }],
      };
    }

    case 'toggleTask':
      return {
        ...state,
        agenda: state.agenda.map((a) => (a.id === action.id && a.kind === 'task' ? { ...a, done: !a.done } : a)),
      };

    case 'setDone':
      return {
        ...state,
        agenda: state.agenda.map((a) =>
          a.id === action.id && !!a.done !== action.done ? { ...a, done: action.done } : a,
        ),
      };

    case 'connect': {
      if (state.services.some((s) => s.id === action.id)) return state;
      // Layanan dari katalog 2h, atau layanan awal yang tadi diputus dan disambungkan lagi.
      const known = serviceCatalog[action.id] ?? initialServices.find((s) => s.id === action.id);
      if (!known) return state;
      const service: Service = {
        ...known,
        note: 'baru tersambung',
        reachable: true,
        unreachableSince: undefined,
      };
      return withHistory(
        {
          ...state,
          services: [...state.services, service],
          formerly: state.formerly.filter((id) => id !== service.id),
        },
        {
          time: NOW_APP,
          kind: 'lainnya',
          icon: 'link',
          title: `Menyambungkan ${service.name}`,
          sub: `baru tersambung · ${NOW_APP}`,
        },
      ).state;
    }

    case 'disconnect': {
      const s = state.services.find((x) => x.id === action.id);
      if (!s) return state;
      return withHistory(
        { ...state, services: state.services.filter((x) => x.id !== s.id), formerly: [s.id, ...state.formerly] },
        { time: NOW_APP, kind: 'lainnya', icon: 'link', title: `Memutus ${s.name}`, sub: `diputus Anda · ${NOW_APP}` },
      ).state;
    }

    case 'forget': {
      const s = state.services.find((x) => x.id === action.id);
      if (!s || state.forgotten.includes(s.id)) return state;
      return withHistory(
        { ...state, forgotten: [...state.forgotten, s.id] },
        {
          time: NOW_APP,
          kind: 'lainnya',
          icon: 'trash',
          title: `Menghapus yang saya tahu dari ${s.name}`,
          sub: `atas permintaan Anda · ${NOW_APP}`,
        },
      ).state;
    }

    case 'setPermission': {
      const s = state.services.find((x) => x.id === action.id);
      if (!s || s.permission === action.permission) return state;
      return withHistory(
        {
          ...state,
          services: state.services.map((x) => (x.id === s.id ? { ...x, permission: action.permission } : x)),
        },
        {
          time: NOW_APP,
          kind: 'lainnya',
          icon: 'shield',
          title: `Mengubah izin ${s.name}`,
          sub: `${action.permission === 'read' ? 'hanya membaca' : 'boleh bertindak'} · ${NOW_APP}`,
        },
      ).state;
    }
  }
}
