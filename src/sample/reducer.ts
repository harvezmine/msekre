import { initialAgenda, initialLeftover, TODAY } from './agenda';
import { clampTemp, initialDevices, MAIN_AC_ID } from './devices';
import { initialBusiness, initialHistory } from './history';
import { draftIntro, initialChat } from './chat';
import { addMinutes } from './dates';
import { initialOutgoing } from './outgoing';
import { initialServices, serviceCatalog } from './services';
import type {
  AcFan,
  AcMode,
  AcSettings,
  AgendaItem,
  Business,
  ChatEntry,
  Device,
  HistoryEntry,
  Leftover,
  NewChatEntry,
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
  /** Utas chat. Kartu konfirmasi dan perangkat menunjuk ke `outgoing` dan `devices` lewat id. */
  chat: ChatEntry[];
  agenda: AgendaItem[];
  leftover: Leftover | null;
  /** Layanan tersambung. Cincin Beranda diturunkan dari sini dan dari perangkat (`ringNodes`). */
  services: Service[];
  /** Id layanan yang isi ingatannya sudah dihapus. */
  forgotten: string[];
  history: HistoryEntry[];
  business: Business;
  /** Toast yang sedang tampil. `id` baru setiap kali, jadi teks yang sama dua kali tetap tampil dan dibacakan ulang. */
  toast: { id: number; text: string } | null;
  /**
   * Penanda contoh saja: layar pertama kali sudah dilewati. Di Fase 0b tidak ada pengalihan ke /mulai; penjaga
   * onboarding sungguhan dibangun di Fase 1.
   */
  onboarded: boolean;
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
  | { type: 'setBoxMic'; on: boolean }
  | { type: 'addDraft'; draft: NewDraft }
  | { type: 'editDraft'; id: string; text: string }
  | { type: 'sendDraft'; id: string }
  | { type: 'cancelSend'; id: string }
  | { type: 'addChatMessage'; from: 'user' | 'assistant'; text: string }
  | { type: 'addAgenda'; item: Omit<AgendaItem, 'id'> }
  | { type: 'snooze'; id: string; until: string }
  | { type: 'finishLeftover'; choice: 'today' | 'drop' }
  | { type: 'toggleTask'; id: string }
  | { type: 'connect'; id: string }
  | { type: 'disconnect'; id: string }
  | { type: 'forget'; id: string }
  | { type: 'setPermission'; id: string; permission: Permission }
  | { type: 'showToast'; text: string }
  /** Dengan `id`: hanya menutup toast itu, bukan toast yang lebih baru. */
  | { type: 'hideToast'; id?: number }
  | { type: 'finishOnboarding' };

export const initialSampleState: SampleState = {
  place: 'Semua',
  devices: initialDevices,
  boxMic: true,
  outgoing: initialOutgoing,
  chat: initialChat,
  agenda: initialAgenda,
  leftover: initialLeftover,
  services: initialServices,
  forgotten: [],
  history: initialHistory,
  business: initialBusiness,
  toast: null,
  onboarded: false,
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

function withToast(state: SampleState, text: string): SampleState {
  return { ...state, seq: state.seq + 1, toast: { id: state.seq + 1, text } };
}

/** Menambah baris ke utas. Tanda berpikir hanya berlaku di ujung utas, jadi baris baru menggantikannya. */
function withChat(state: SampleState, entries: NewChatEntry[]): SampleState {
  let seq = state.seq;
  const added = entries.map((e): ChatEntry => ({ ...e, id: `c-${++seq}` }));
  return { ...state, seq, chat: [...state.chat.filter((e) => e.kind !== 'thinking'), ...added] };
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

    case 'setBoxMic':
      return state.boxMic === action.on ? state : { ...state, boxMic: action.on };

    case 'addDraft': {
      const id = `o-${state.seq + 1}`;
      const sentAt = action.draft.sentAt ?? NOW_APP;
      const draft: Outgoing = { ...action.draft, id, status: 'draft', sentAt, heldUntil: addMinutes(sentAt, 5) };
      return withChat({ ...state, seq: state.seq + 1, outgoing: { ...state.outgoing, [id]: draft } }, [
        { kind: 'assistant', text: draftIntro(draft.what) },
        { kind: 'confirm', outgoingId: id },
      ]);
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
      return withToast(setOutgoing(state, o.id, { status: 'cancelled' }), `Kiriman ke ${o.to} dibatalkan.`);
    }

    case 'addChatMessage': {
      const text = action.text.trim();
      return text ? withChat(state, [{ kind: action.from, text }]) : state;
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
        { ...state, services: [...state.services, service] },
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
        { ...state, services: state.services.filter((x) => x.id !== s.id) },
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

    case 'showToast':
      return withToast(state, action.text);
    case 'hideToast':
      if (state.toast === null || (action.id !== undefined && action.id !== state.toast.id)) return state;
      return { ...state, toast: null };
    case 'finishOnboarding':
      return { ...state, onboarded: true };
  }
}
