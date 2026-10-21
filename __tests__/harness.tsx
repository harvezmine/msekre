import { act } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ComponentType } from 'react';
import Beranda from '../app/(tabs)/index';
import Agenda from '../app/(tabs)/agenda';
import Perangkat from '../app/(tabs)/perangkat';
import Usaha from '../app/(tabs)/usaha';
import TambahAgenda from '../app/agenda/tambah';
import Akun from '../app/akun';
import Asisten from '../app/akun/asisten';
import Hp from '../app/akun/hp';
import Keamanan from '../app/akun/keamanan';
import KonfirmasiAkun from '../app/akun/konfirmasi';
import Notifikasi from '../app/akun/notifikasi';
import Privasi from '../app/akun/privasi';
import Sapaan from '../app/akun/sapaan';
import Alarm from '../app/alarm';
import Chat from '../app/chat';
import Inti from '../app/inti';
import IzinAlarm from '../app/izin-alarm';
import Keluar from '../app/keluar';
import Mode from '../app/mode';
import MulaiIndex from '../app/mulai/index';
import MulaiMasuk from '../app/mulai/masuk';
import MulaiPilih from '../app/mulai/pilih';
import DetailPerangkat from '../app/perangkat/[id]';
import TambahPerangkat from '../app/perangkat/tambah';
import BukaKunci from '../app/buka-kunci';
import Pin from '../app/pin';
import Riwayat from '../app/riwayat';
import Suara from '../app/suara';
import Tempat from '../app/tempat';
import DetailLayanan from '../app/terhubung/[id]';
import Konfirmasi from '../app/terhubung/konfirmasi';
import Terhubung from '../app/terhubung/index';
import Masuk from '../app/terhubung/masuk';
import Tersambung from '../app/terhubung/tersambung';
import { renderWithProviders, useSample } from './helpers';
import { AfterSignIn } from '@/api/AfterSignIn';
import { useApi } from '@/api/ApiProvider';
import { canOpen, REDIRECT_APP, REDIRECT_ENTRY, routeKind } from '@/api/routeAccess';
import type { DataMode } from '@/api/mode';
import { useAuth, type AuthStatus } from '@/api/useAuth';
import { type SampleState } from '@/sample/store';
import { ToastHost } from '@/ui/Toast';

/** Peta rute ke layar, sama dengan struktur `app/`. */
export const ROUTES: Record<string, ComponentType> = {
  '/': Beranda,
  '/agenda': Agenda,
  '/perangkat': Perangkat,
  '/usaha': Usaha,
  '/agenda/tambah': TambahAgenda,
  '/akun': Akun,
  '/akun/keamanan': Keamanan,
  '/akun/asisten': Asisten,
  '/akun/sapaan': Sapaan,
  '/akun/notifikasi': Notifikasi,
  '/akun/hp': Hp,
  '/akun/privasi': Privasi,
  '/akun/konfirmasi': KonfirmasiAkun,
  '/alarm': Alarm,
  '/chat': Chat,
  '/inti': Inti,
  '/izin-alarm': IzinAlarm,
  '/keluar': Keluar,
  '/mode': Mode,
  '/mulai': MulaiIndex,
  '/mulai/masuk': MulaiMasuk,
  '/mulai/pilih': MulaiPilih,
  '/perangkat/[id]': DetailPerangkat,
  '/perangkat/tambah': TambahPerangkat,
  '/pin': Pin,
  '/buka-kunci': BukaKunci,
  '/riwayat': Riwayat,
  '/suara': Suara,
  '/tempat': Tempat,
  '/terhubung': Terhubung,
  '/terhubung/[id]': DetailLayanan,
  '/terhubung/konfirmasi': Konfirmasi,
  '/terhubung/masuk': Masuk,
  '/terhubung/tersambung': Tersambung,
};

interface Entry {
  path: string;
  params: Record<string, string>;
}
const STATIC_TERHUBUNG = ['masuk', 'tersambung', 'konfirmasi'];
const STATIC_PERANGKAT = ['tambah'];

/** Mengubah argumen router ("/x?a=1" atau {pathname, params}) menjadi rute dan parameternya. */
export function parseRoute(href: unknown): Entry {
  let raw: string;
  let params: Record<string, string> = {};
  if (typeof href === 'object' && href) {
    const h = href as { pathname: string; params?: Record<string, string> };
    raw = h.pathname;
    params = { ...h.params };
  } else {
    const [p, query = ''] = String(href).split('?');
    raw = p!;
    params = Object.fromEntries(new URLSearchParams(query));
  }
  const parts = raw.split('/');
  const last = parts[parts.length - 1]!;
  if (raw.startsWith('/terhubung/') && !STATIC_TERHUBUNG.includes(last) && last !== '[id]') {
    return { path: '/terhubung/[id]', params: { ...params, id: last } };
  }
  if (raw.startsWith('/perangkat/') && !STATIC_PERANGKAT.includes(last) && last !== '[id]') {
    return { path: '/perangkat/[id]', params: { ...params, id: last } };
  }
  return { path: raw, params };
}

let stack: Entry[] = [];
let access: { mode: DataMode; status: AuthStatus } = { mode: 'contoh', status: 'checking' };
export const currentRoute = () => stack[stack.length - 1]!.path;
export const currentStack = () => stack.map((e) => e.path);

let latest: SampleState;
function Probe() {
  const { state } = useSample();
  useEffect(() => {
    latest = state;
  });
  return null;
}
/** Keadaan penyimpanan contoh terkini. */
export const sampleState = () => latest;

/**
 * Tumpukan navigasi tiruan: push/navigate menambah (navigate kembali ke rute yang sudah ada), replace mengganti,
 * back membuang, dismissTo kembali ke rute yang sudah ada atau, bila tak ada, mengganti rute sekarang, dismissAll
 * membuang semuanya kecuali yang pertama.
 *
 * Penjaga rute meniru `Stack.Protected` di app/_layout.tsx (aturannya `src/api/routeAccess.ts`): menuju rute yang
 * ditolak dialihkan ke `redirectTo` kelompoknya, dan rute yang menjadi tertolak (status masuk berubah) dibuang dari
 * tumpukan beserta riwayatnya; bila tumpukan habis, layar pertama yang boleh dibuka dipakai.
 */
function Rute({ start }: { start: string }) {
  const [, setTick] = useState(0);
  const redraw = () => setTick((t) => t + 1);
  const { mode } = useApi();
  const { status } = useAuth();
  // Seperti penjaga rute di akar: nilainya ikut render yang sama, jadi efek anak (AfterSignIn) sudah melihat yang baru.
  // eslint-disable-next-line react-hooks/globals
  access = { mode, status };
  // Seperti penjaga rute: yang menjadi tertolak dibuang saat itu juga (selama sesi diperiksa, akar menahan tampilan).
  if (!(mode === 'server' && status === 'checking')) {
    const open = stack.filter((e) => canOpen(routeKind(e.path), mode, status));
    if (open.length !== stack.length) {
      // eslint-disable-next-line react-hooks/globals
      stack = open.length > 0 ? open : [parseRoute(canOpen('app', mode, status) ? '/' : REDIRECT_APP)];
    }
  }
  useEffect(() => {
    // Tujuan yang ditolak penjaga dialihkan ke `redirectTo` kelompoknya.
    const guarded = (e: Entry): Entry => {
      const { mode: m, status: st } = access;
      if (m === 'server' && st === 'checking') return e;
      const kind = routeKind(e.path);
      if (canOpen(kind, m, st)) return e;
      return parseRoute(kind === 'entry' ? REDIRECT_ENTRY : REDIRECT_APP);
    };
    const popTo = (e: Entry) => {
      const i = stack.map((s) => s.path).lastIndexOf(e.path);
      if (i >= 0) stack = [...stack.slice(0, i), e];
      else stack = [...stack, e];
    };
    // Seperti expo-router: bila tujuan tidak ada di tumpukan, rute sekarang diganti (bukan ditambah).
    const dismissTo = (e: Entry) => {
      const i = stack.map((s) => s.path).lastIndexOf(e.path);
      stack = i >= 0 ? [...stack.slice(0, i), e] : [...stack.slice(0, -1), e];
    };
    jest.mocked(router.push).mockImplementation((h) => {
      const e = guarded(parseRoute(h));
      if (e.path !== stack[stack.length - 1]!.path) stack = [...stack, e];
      redraw();
    });
    jest.mocked(router.replace).mockImplementation((h) => {
      stack = [...stack.slice(0, -1), guarded(parseRoute(h))];
      redraw();
    });
    jest.mocked(router.navigate).mockImplementation((h) => {
      popTo(guarded(parseRoute(h)));
      redraw();
    });
    jest.mocked(router.dismissTo).mockImplementation((h) => {
      dismissTo(guarded(parseRoute(h)));
      redraw();
    });
    jest.mocked(router.dismissAll).mockImplementation(() => {
      stack = stack.slice(0, 1);
      redraw();
    });
    jest.mocked(router.canGoBack).mockImplementation(() => stack.length > 1);
    jest.mocked(router.back).mockImplementation(() => {
      if (stack.length > 1) stack = stack.slice(0, -1);
      redraw();
    });
  }, []);
  const Layar = ROUTES[stack[stack.length - 1]!.path] ?? Beranda;
  void start;
  return (
    <>
      <AfterSignIn />
      <Layar key={stack.length + stack[stack.length - 1]!.path} />
    </>
  );
}

/** Siapkan useLocalSearchParams; panggil di beforeEach. */
export function mockParams() {
  jest.mocked(useLocalSearchParams).mockImplementation((() => stack[stack.length - 1]?.params ?? {}) as never);
}
export function restoreParams() {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
}

/** Tampilkan rute `start` dalam satu penyimpanan contoh bersama, dengan navigasi tiruan. */
export async function showRoute(start = '/', options: Parameters<typeof renderWithProviders>[1] = {}) {
  stack = [parseRoute(start)];
  return renderWithProviders(
    <>
      <Rute start={start} />
      <Probe />
      <ToastHost />
    </>,
    options,
  );
}

export async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

/** Pindah ke rute lain seperti dari kode layar (tanpa mengetuk tautannya). */
export async function go(href: Parameters<typeof router.push>[0]) {
  await act(async () => {
    router.push(href);
  });
}
