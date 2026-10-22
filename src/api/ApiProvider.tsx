import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { devQuery } from '@/dev/query';
import { newUserSampleState } from '@/sample/fresh';
import { initialSampleState } from '@/sample/reducer';
import { PLACES, type Place } from '@/sample/types';
import { FakeTransport } from './fake/FakeTransport';
import { HttpTransport } from './http';
import { HybridTransport } from './hybrid';
import { loadMode, needsSignIn, readApiUrl, saveMode, type DataMode } from './mode';
import { createMemorySession, createSecureSession, type Session } from './session';
import { readWaNumber } from './waNumber';
import type { Transport } from './transport';

/**
 * Kunci sesi per mode, supaya token server tiruan tidak pernah terkirim ke server asli (dan sebaliknya). `akun` dan
 * `server` bicara dengan server asli yang sama, jadi berbagi satu sesi.
 */
export const SESSION_KEYS: Record<DataMode, string> = {
  contoh: 'sesi.contoh',
  akun: 'sesi.server',
  server: 'sesi.server',
};
/** Jeda request server tiruan di aplikasi, supaya tanda "mengirim…" sempat terlihat. */
export const FAKE_LATENCY_MS = 300;

/** Sumber data yang sedang dipakai: mode, transport-nya, dan sesi token milik mode itu. */
export interface Api {
  mode: DataMode;
  transport: Transport;
  session: Session;
}

export interface ApiValue extends Api {
  /** Alamat server dari app.config.ts (`extra.apiUrl`), atau `null`. */
  apiUrl: string | null;
  /** Mode `akun` dan `server` hanya bisa dipilih kalau `apiUrl` diisi. */
  canUseServer: boolean;
  /**
   * Ganti mode data dan simpan pilihannya. `false` kalau `akun`/`server` dipilih tanpa `apiUrl` (tidak ada yang
   * berubah). Transport lama dilepas; sesi `contoh` terpisah dari sesi server asli, jadi berganti ke `akun` bisa berarti
   * perlu masuk, sedangkan berganti ke `contoh` membiarkan sesi akun tersimpan untuk nanti.
   */
  setMode(mode: DataMode): Promise<boolean>;
}

/** Pembuat transport dan sesi per mode. Bawaannya {@link createApi}; tes memberi pembuat sendiri. */
export type ApiFactory = (mode: DataMode, apiUrl: string | null) => Api;

/** Server tiruan untuk mode `contoh`, dan untuk layar contoh di mode `akun`. */
function sampleTransport(session: Session): FakeTransport {
  return new FakeTransport(session, {
    latencyMs: FAKE_LATENCY_MS,
    // Nomor sungguhan dari konfigurasi build, supaya "Mulai lewat WhatsApp" di APK pratinjau tidak menuju nomor palsu.
    // Kosong (tes, build tanpa nomor): bawaan server tiruan.
    ...(readWaNumber() ? { waNumber: readWaNumber() } : {}),
    // Pratinjau web saat pengembangan: `?contoh=baru` memulai sebagai pengguna baru (Beranda hampir kosong);
    // `?tempat=Rumah` memulai dengan tempat itu terpilih.
    ...(devQuery().contoh === 'baru' ? { sample: newUserSampleState } : {}),
    ...(PLACES.includes(devQuery().tempat as Place)
      ? { sample: { ...initialSampleState, place: devQuery().tempat as Place } }
      : {}),
  });
}

/** Transport dan sesi untuk `mode`. `akun` dan `server` tanpa `apiUrl` menjadi `contoh`. */
export function createApi(mode: DataMode, apiUrl: string | null): Api {
  if (needsSignIn(mode) && apiUrl) {
    const session = createSecureSession(SESSION_KEYS[mode]);
    const real = new HttpTransport(apiUrl, session);
    if (mode === 'server') return { mode, session, transport: real };
    // Server tiruan di dalam mode akun tidak punya sesi sendiri: ia tidak pernah meminta masuk.
    return { mode, session, transport: new HybridTransport(real, sampleTransport(createMemorySession(null)), session) };
  }
  const session = createSecureSession(SESSION_KEYS.contoh);
  return { mode: 'contoh', session, transport: sampleTransport(session) };
}

export const ApiContext = createContext<ApiValue | null>(null);

interface ApiProviderProps {
  children: ReactNode;
  /** Alamat server. Bawaannya dari app.config.ts `extra.apiUrl`. */
  apiUrl?: string | null;
  /** Untuk tes: transport dan sesi yang sudah jadi. Pilihan mode yang tersimpan tidak dibaca. */
  initial?: Api;
  /** Untuk tes: pembuat sumber data saat mode dimuat atau diganti. Bawaan {@link createApi}. */
  factory?: ApiFactory;
  /** Tampil selama pilihan mode dibaca dari HP (sekejap, di balik layar pembuka). */
  fallback?: ReactNode;
}

/**
 * Memilih transport menurut mode data yang tersimpan (`contoh` → `FakeTransport`, `akun` → `HybridTransport`, `server`
 * → `HttpTransport`) dan membagikannya ke layar lewat {@link useApi}. Layar dan hook tidak tahu transport mana yang
 * dipakai.
 */
export function ApiProvider({
  children,
  apiUrl: apiUrlProp,
  initial,
  fallback = null,
  factory = createApi,
}: ApiProviderProps) {
  const apiUrl = apiUrlProp === undefined ? readApiUrl() : apiUrlProp;
  const [api, setApi] = useState<Api | null>(initial ?? null);
  const loaded = api !== null;
  const transport = api?.transport;

  useEffect(() => {
    if (loaded) return;
    let alive = true;
    void loadMode(apiUrl).then((mode) => {
      if (alive) setApi((prev) => prev ?? factory(mode, apiUrl));
    });
    return () => {
      alive = false;
    };
  }, [loaded, apiUrl, factory]);

  // Transport yang diganti (atau saat provider dilepas) dihentikan koneksi dan timernya.
  useEffect(() => () => transport?.dispose(), [transport]);

  const setMode = useCallback(
    async (mode: DataMode) => {
      if (!(await saveMode(mode, apiUrl))) return false;
      setApi((prev) => (prev?.mode === mode ? prev : factory(mode, apiUrl)));
      return true;
    },
    [apiUrl, factory],
  );

  const value = useMemo<ApiValue | null>(
    () => (api ? { ...api, apiUrl, canUseServer: apiUrl !== null, setMode } : null),
    [api, apiUrl, setMode],
  );

  if (!value) return fallback;
  return <ApiContext value={value}>{children}</ApiContext>;
}

/** Sumber data aplikasi. Hanya di dalam {@link ApiProvider}. */
export function useApi(): ApiValue {
  const value = use(ApiContext);
  if (!value) throw new Error('useApi dipakai di luar ApiProvider');
  return value;
}
