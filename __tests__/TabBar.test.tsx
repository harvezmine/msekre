import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet } from 'react-native';
import Beranda from '../app/(tabs)/index';
import { createTestApi, renderWithProviders, toastNow } from './helpers';
import { HttpTransport, type SocketLike } from '@/api/http';
import { createMemorySession } from '@/api/session';
import { newUserSampleState } from '@/sample/fresh';
import { initialSampleState, type SampleState } from '@/sample/store';
import { TabBar } from '@/ui/TabBar';
import { splitTabs, tabsFor } from '@/ui/tabSet';
import { VOICE_SOON_TEXT } from '@/voice/available';
import { holdBridge } from '@/voice/holdBridge';

beforeEach(() => jest.clearAllMocks());

const settle = () =>
  act(async () => {
    for (let i = 0; i < 4; i++) await Promise.resolve();
  });

function props(index = 0) {
  const emitter = { emit: jest.fn(() => ({ defaultPrevented: false })) };
  const navigateToTab = jest.fn();
  const routes = ['index', 'agenda', 'perangkat', 'usaha'].map((name) => ({ key: `${name}-k`, name }));
  const p = {
    state: { index, routes },
    descriptors: {},
    emitter,
    navigateToTab,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  } as unknown as BottomTabBarProps;
  return { p, emitter, navigateToTab };
}

async function setup(
  index = 0,
  options: Parameters<typeof renderWithProviders>[1] = {},
): Promise<ReturnType<typeof props>> {
  const made = props(index);
  await renderWithProviders(<TabBar {...made.p} />, options);
  await settle();
  return made;
}

const tabNames = () => screen.queryAllByRole('tab').map((t) => t.props.accessibilityLabel);

describe('tab tumbuh sesuai pemakaian', () => {
  test('data contoh (perangkat dan usaha): Beranda, Agenda | Inti | Perangkat, Usaha', async () => {
    await setup(1);
    expect(tabNames()).toEqual(['Beranda', 'Agenda', 'Perangkat', 'Usaha']);
    expect(screen.getByRole('button', { name: 'Nadia' })).toBeOnTheScreen();
  });

  test('pengguna baru: hanya Beranda | Inti | Agenda', async () => {
    await setup(0, { state: newUserSampleState });
    expect(tabNames()).toEqual(['Beranda', 'Agenda']);
  });

  test('ada perangkat tanpa usaha: tanpa tab Usaha', async () => {
    const state: SampleState = { ...initialSampleState, business: null };
    await setup(0, { state });
    expect(tabNames()).toEqual(['Beranda', 'Agenda', 'Perangkat']);
  });

  test('ada usaha tanpa perangkat (juga tanpa Kotak): tanpa tab Perangkat', async () => {
    const state: SampleState = { ...initialSampleState, devices: [], hasBox: false };
    await setup(0, { state });
    expect(tabNames()).toEqual(['Beranda', 'Agenda', 'Usaha']);
  });

  test('Kotak saja sudah dihitung perangkat', async () => {
    const state: SampleState = { ...initialSampleState, devices: [], business: null };
    await setup(0, { state });
    expect(tabNames()).toEqual(['Beranda', 'Agenda', 'Perangkat']);
  });

  test('pembagian kiri dan kanan Inti', () => {
    expect(splitTabs(tabsFor({ perangkat: false, usaha: false }))).toEqual({ left: ['index'], right: ['agenda'] });
    expect(splitTabs(tabsFor({ perangkat: true, usaha: false }))).toEqual({
      left: ['index', 'agenda'],
      right: ['perangkat'],
    });
    expect(splitTabs(tabsFor({ perangkat: true, usaha: true }))).toEqual({
      left: ['index', 'agenda'],
      right: ['perangkat', 'usaha'],
    });
  });
});

describe('tab yang muncul selagi aplikasi terbuka', () => {
  const BASE = 'https://app.sekertaris.com';
  class Socket implements SocketLike {
    onopen: ((ev: unknown) => void) | null = null;
    onmessage: ((ev: { data?: unknown }) => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;
    onclose: ((ev: { code?: number }) => void) | null = null;
    close() {}
  }
  const home = {
    place: 'Semua',
    places: [],
    greetingName: 'Budi',
    summary: '',
    approvals: [],
    agendaToday: [],
    house: { lines: [] },
    business: null,
    ring: { nodes: [] },
    rev: 1,
  };
  const lamp = {
    id: 'lampu-1',
    place: 'Rumah',
    room: 'Teras',
    name: 'Lampu teras',
    icon: 'bulb',
    kind: 'lamp',
    on: true,
    reachable: true,
    status: 'Nyala',
  };

  function serverApi() {
    const session = createMemorySession('tok');
    const sockets: Socket[] = [];
    const fetch = jest.fn(async (url: string) => {
      const path = url.replace(`${BASE}/app/v1`, '');
      const body = path.startsWith('/devices')
        ? { place: 'Semua', places: [], rooms: [], devices: [], box: null, routines: [], rev: 1 }
        : path === '/home'
          ? home
          : path === '/me'
            ? { id: 'u1', name: 'Budi', assistantName: 'Nadia', plan: { name: 'Bisnis', activeUntil: null } }
            : null;
      const status = body ? 200 : 404;
      return { status, ok: status < 300, text: async () => JSON.stringify(body ?? { error: 'tidak_ditemukan' }) };
    });
    const transport = new HttpTransport(BASE, session, {
      fetch: fetch as unknown as typeof globalThis.fetch,
      socket: () => {
        const s = new Socket();
        sockets.push(s);
        return s;
      },
      appVersion: '1.0.0',
    });
    return { api: { mode: 'server' as const, session, transport }, sockets };
  }
  const send = (s: Socket, event: unknown) => s.onmessage?.({ data: JSON.stringify(event) });

  test('perangkat pertama: tab Perangkat muncul dengan titik sampai dikunjungi; usaha pertama: tab Usaha', async () => {
    const { api, sockets } = serverApi();
    const { navigateToTab } = await setup(0, { api });
    expect(tabNames()).toEqual(['Beranda', 'Agenda']);

    await act(async () => {
      sockets.forEach((s) => s.onopen?.({}));
    });
    await act(async () => {
      sockets.forEach((s) => send(s, { type: 'device', devices: [lamp], rev: 2 }));
    });
    expect(tabNames()).toEqual(['Beranda', 'Agenda', 'Perangkat']);
    expect(screen.getByTestId('tab-baru-perangkat')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('tab', { name: 'Perangkat' }));
    expect(navigateToTab).toHaveBeenCalledWith('perangkat-k');
    expect(screen.queryByTestId('tab-baru-perangkat')).toBeNull();

    await act(async () => {
      sockets.forEach((s) =>
        send(s, {
          type: 'home',
          home: {
            ...home,
            rev: 2,
            business: { source: 'dari Moka', sales: 'Rp1.000.000', change: 'naik 1%', down: false, alert: null },
          },
        }),
      );
    });
    expect(tabNames()).toEqual(['Beranda', 'Agenda', 'Perangkat', 'Usaha']);
    expect(screen.getByTestId('tab-baru-usaha')).toBeOnTheScreen();
  });
});

describe('perpindahan tab', () => {
  test('ketuk Agenda pindah tab', async () => {
    const { emitter, navigateToTab } = await setup();
    await fireEvent.press(screen.getByRole('tab', { name: 'Agenda' }));
    expect(emitter.emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'agenda-k', canPreventDefault: true });
    expect(navigateToTab).toHaveBeenCalledWith('agenda-k');
  });

  test('ketuk tab yang sedang aktif tidak berpindah', async () => {
    const { navigateToTab } = await setup(0);
    await fireEvent.press(screen.getByRole('tab', { name: 'Beranda' }));
    expect(navigateToTab).not.toHaveBeenCalled();
  });

  test('tab aktif ditandai terpilih; daftar tab dibaca sebagai tablist', async () => {
    await setup(1);
    expect(screen.getByRole('tab', { name: 'Agenda' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Beranda' })).not.toBeSelected();
    expect(screen.getByTestId('bilah-tab').props.accessibilityRole).toBe('tablist');
  });
});

/** Inti di bilah tab diuji di Agenda (di Beranda Inti besar di atas layar yang dibacakan, lihat beranda-inti.test). */
describe('Inti', () => {
  const HIDDEN = { includeHiddenElements: true };
  const orbWidth = () =>
    (StyleSheet.flatten(screen.getByTestId('inti-bola', HIDDEN).props.style) as { width: number }).width;

  test('ukurannya sama di semua tab (48, di dalam bilah, tanpa naik atau membesar di Beranda)', async () => {
    await setup(0);
    expect(orbWidth()).toBe(48);
    expect(StyleSheet.flatten(screen.getByTestId('inti-tab', HIDDEN).props.style).transform).toBeUndefined();
    await screen.unmount();
    await setup(1);
    expect(orbWidth()).toBe(48);
  });

  test('di Beranda tidak dibacakan dua kali (Inti besar membawa aksi yang sama), tetapi tetap bisa diketuk dan ditahan', async () => {
    await setup(0);
    expect(screen.queryByRole('button', { name: 'Nadia' })).toBeNull();
    const inti = screen.getByTestId('inti', HIDDEN);
    await fireEvent.press(inti);
    expect(router.navigate).toHaveBeenCalledWith('/chat');
    await fireEvent(inti, 'longPress');
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/suara', params: { hold: '1' } });
    await fireEvent(inti, 'pressOut');
    expect(holdBridge.isHeld()).toBe(false);
  });

  test('ketuk membuka chat', async () => {
    await setup(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Nadia' }));
    expect(router.navigate).toHaveBeenCalledWith('/chat');
  });

  test('tahan: getar, Mode Suara terbuka selagi jari menempel; diangkat: tahanan dilepas', async () => {
    await setup(1);
    const inti = screen.getByRole('button', { name: 'Nadia' });
    expect(inti.props.accessibilityHint).toBe('Ketuk untuk chat, tahan untuk bicara');
    await fireEvent(inti, 'pressIn');
    await fireEvent(inti, 'longPress');
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/suara', params: { hold: '1' } });
    expect(holdBridge.isHeld()).toBe(true);
    const released = jest.fn();
    holdBridge.onRelease(released);
    await fireEvent(inti, 'pressOut');
    expect(holdBridge.isHeld()).toBe(false);
    expect(released).toHaveBeenCalledTimes(1);
  });

  test('ketukan biasa tidak meninggalkan tahanan', async () => {
    await setup(1);
    const inti = screen.getByRole('button', { name: 'Nadia' });
    await fireEvent(inti, 'pressIn');
    await fireEvent(inti, 'pressOut');
    await fireEvent.press(inti);
    expect(holdBridge.isHeld()).toBe(false);
  });

  test('pembaca layar: aksi Chat dan Bicara', async () => {
    await setup(1);
    const inti = screen.getByRole('button', { name: 'Nadia' });
    expect(inti.props.accessibilityActions.map((a: { label: string }) => a.label)).toEqual(['Chat', 'Bicara']);
    await fireEvent(inti, 'accessibilityAction', { nativeEvent: { actionName: 'longpress' } });
    expect(router.navigate).toHaveBeenCalledWith('/suara');
    await fireEvent(inti, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(router.navigate).toHaveBeenCalledWith('/chat');
  });

  test('Mode Suara belum tersedia untuk akun ini: tahan memberi catatan, tidak membuka apa pun', async () => {
    const api = createTestApi({ mode: 'server', token: 'tok', voice: false });
    await setup(1, { api });
    await fireEvent(screen.getByRole('button', { name: 'Nadia' }), 'longPress');
    expect(toastNow()?.text).toBe(VOICE_SOON_TEXT);
    expect(router.navigate).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/suara' }));
    expect(holdBridge.isHeld()).toBe(false);
  });

  test('petunjuk pertama: halo di Inti besar Beranda (bukan di bilah); ketukan tab menutup petunjuk', async () => {
    const made = props(0);
    await renderWithProviders(
      <>
        <Beranda />
        <TabBar {...made.p} />
      </>,
      { tips: 'fresh' },
    );
    await settle();
    const halos = () => screen.queryAllByTestId('inti-halo', HIDDEN);
    expect(halos()).toHaveLength(1);
    expect(screen.getByTestId('inti-besar', HIDDEN)).toContainElement(halos()[0]!);
    await fireEvent.press(screen.getByRole('tab', { name: 'Agenda' }));
    expect(halos()).toHaveLength(0);
  });
});
