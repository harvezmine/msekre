import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FakeTransport } from './fake/FakeTransport';
import { HttpTransport } from './http';
import { loadMode, readApiUrl, saveMode, type DataMode } from './mode';
import { createSecureSession, type Session } from './session';
import { readWaNumber } from './waNumber';
import type { Transport } from './transport';

/** Kunci sesi per mode, supaya token server tiruan tidak pernah terkirim ke server asli (dan sebaliknya). */
export const SESSION_KEYS: Record<DataMode, string> = { contoh: 'sesi.contoh', server: 'sesi.server' };
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
  /** Mode `server` hanya bisa dipilih kalau `apiUrl` diisi. */
  canUseServer: boolean;
  /**
   * Ganti mode data dan simpan pilihannya. `false` kalau `server` dipilih tanpa `apiUrl` (tidak ada yang berubah).
   * Transport lama dilepas; sesi tiap mode terpisah, jadi berganti mode bisa berarti perlu masuk lagi.
   */
  setMode(mode: DataMode): Promise<boolean>;
}

/** Transport dan sesi untuk `mode`. `server` tanpa `apiUrl` menjadi `contoh`. */
export function createApi(mode: DataMode, apiUrl: string | null): Api {
  if (mode === 'server' && apiUrl) {
    const session = createSecureSession(SESSION_KEYS.server);
    return { mode, session, transport: new HttpTransport(apiUrl, session) };
  }
  const session = createSecureSession(SESSION_KEYS.contoh);
  return {
    mode: 'contoh',
    session,
    transport: new FakeTransport(session, {
      latencyMs: FAKE_LATENCY_MS,
      // Nomor sungguhan dari konfigurasi build, supaya "Mulai lewat WhatsApp" di APK pratinjau tidak menuju nomor palsu.
      // Kosong (tes, build tanpa nomor): bawaan server tiruan.
      ...(readWaNumber() ? { waNumber: readWaNumber() } : {}),
    }),
  };
}

export const ApiContext = createContext<ApiValue | null>(null);

interface ApiProviderProps {
  children: ReactNode;
  /** Alamat server. Bawaannya dari app.config.ts `extra.apiUrl`. */
  apiUrl?: string | null;
  /** Untuk tes: transport dan sesi yang sudah jadi. Pilihan mode yang tersimpan tidak dibaca. */
  initial?: Api;
  /** Tampil selama pilihan mode dibaca dari HP (sekejap, di balik layar pembuka). */
  fallback?: ReactNode;
}

/**
 * Memilih transport menurut mode data yang tersimpan (`contoh` → `FakeTransport`, `server` → `HttpTransport`) dan
 * membagikannya ke layar lewat {@link useApi}. Layar dan hook tidak tahu transport mana yang dipakai.
 */
export function ApiProvider({ children, apiUrl: apiUrlProp, initial, fallback = null }: ApiProviderProps) {
  const apiUrl = apiUrlProp === undefined ? readApiUrl() : apiUrlProp;
  const [api, setApi] = useState<Api | null>(initial ?? null);
  const loaded = api !== null;
  const transport = api?.transport;

  useEffect(() => {
    if (loaded) return;
    let alive = true;
    void loadMode(apiUrl).then((mode) => {
      if (alive) setApi((prev) => prev ?? createApi(mode, apiUrl));
    });
    return () => {
      alive = false;
    };
  }, [loaded, apiUrl]);

  // Transport yang diganti (atau saat provider dilepas) dihentikan koneksi dan timernya.
  useEffect(() => () => transport?.dispose(), [transport]);

  const setMode = useCallback(
    async (mode: DataMode) => {
      if (!(await saveMode(mode, apiUrl))) return false;
      setApi((prev) => (prev?.mode === mode ? prev : createApi(mode, apiUrl)));
      return true;
    },
    [apiUrl],
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
