import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useApi } from './ApiProvider';
import type { Weather, WeatherQuery } from './contract';
import { needsSignIn } from './mode';
import { readSecure, writeSecure } from './secureStore';
import { ApiFailure } from './transport';
import { useAuth } from './useAuth';

/**
 * Keadaan widget cuaca Beranda:
 * - `loading`: pertama kali dimuat;
 * - `ready`: ada cuaca (juga saat memperbarui di belakang);
 * - `needLocation`: server belum tahu tempat pengguna, dan izin lokasi belum ditanyakan: widget menawarkan "Izinkan";
 * - `denied`: izin lokasi ditolak: widget menawarkan pengaturan HP;
 * - `off`: server tanpa penyedia cuaca (501): widget tidak tampil;
 * - `error`: gagal dimuat (tanpa internet): widget tenang dengan "Coba lagi".
 */
export type WeatherStatus = 'loading' | 'ready' | 'needLocation' | 'denied' | 'off' | 'error';

export interface WeatherView {
  status: WeatherStatus;
  weather: Weather | null;
  /** "Izinkan lokasi": tanya izin perkiraan lokasi, lalu muat cuaca di sekitar HP. */
  askLocation(): Promise<void>;
  /** Izin ditolak: buka pengaturan HP. */
  openSettings(): void;
  refresh(): void;
}

/** Perkiraan lokasi terakhir yang diizinkan (dibulatkan sekitar 1 km), hanya di HP ini. */
const POINT_KEY = 'cuaca.lokasi';
/** Cuaca diperbarui paling sering sekali per 15 menit (server juga menyimpannya selama itu). */
export const WEATHER_REFRESH_MS = 15 * 60_000;
/** Posisi terakhir HP yang masih cukup baru untuk cuaca. */
const LAST_KNOWN_MAX_AGE_MS = 60 * 60_000;

type Point = { lat: number; lon: number };

const round2 = (v: number) => Math.round(v * 100) / 100;

function parsePoint(raw: string | null): Point | null {
  try {
    const p = JSON.parse(raw ?? 'null') as Partial<Point> | null;
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? { lat: p.lat!, lon: p.lon! } : null;
  } catch {
    return null;
  }
}

/** Perkiraan lokasi HP (posisi terakhir yang masih baru, kalau tidak ada: satu kali baca berakurasi rendah). */
async function phonePoint(): Promise<Point | null> {
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    const { latitude, longitude } = pos.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { lat: round2(latitude), lon: round2(longitude) };
  } catch {
    return null;
  }
}

async function locationGranted(): Promise<boolean> {
  try {
    return (await Location.getForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

const isFailure = (e: unknown, error: string, status: number) =>
  e instanceof ApiFailure && (e.error === error || e.status === status);

/**
 * Cuaca untuk widget Beranda (`GET /weather`): tempat tersimpan pengguna lebih dulu; tanpa tempat, perkiraan lokasi HP
 * kalau sudah diizinkan; kalau belum, widget menawarkan izinnya (tidak pernah ditanyakan tanpa diketuk). Diperbarui
 * tiap 15 menit dan saat aplikasi kembali ke depan.
 */
export function useWeather(): WeatherView {
  const { transport, mode } = useApi();
  const { status: auth } = useAuth();
  const active = !needsSignIn(mode) || auth === 'signedIn';
  const [status, setStatus] = useState<WeatherStatus>('loading');
  const [weather, setWeather] = useState<Weather | null>(null);
  const lastLoad = useRef(0);
  const loading = useRef(false);
  // Perkiraan lokasi yang diizinkan, juga di memori (penyimpanan HP bisa gagal atau belum terbaca).
  const point = useRef<Point | null>(null);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    lastLoad.current = Date.now();
    try {
      const saved = point.current ?? parsePoint(await readSecure(POINT_KEY).catch(() => null));
      const fetch = (q?: WeatherQuery) => transport.weather(q);
      let result: Weather;
      try {
        result = await fetch(saved ?? undefined);
      } catch (e) {
        if (!isFailure(e, 'tidak_ada_lokasi', 404)) throw e;
        // Server belum tahu tempat pengguna: perkiraan lokasi HP, hanya kalau sudah diizinkan sebelumnya.
        const near = (await locationGranted()) ? await phonePoint() : null;
        if (!near) {
          setStatus('needLocation');
          return;
        }
        point.current = near;
        void writeSecure(POINT_KEY, JSON.stringify(near)).catch(() => {});
        result = await fetch(near);
      }
      setWeather(result);
      setStatus('ready');
    } catch (e) {
      if (isFailure(e, 'belum_tersedia', 501)) setStatus('off');
      else setStatus((s) => (s === 'ready' ? 'ready' : 'error'));
    } finally {
      loading.current = false;
    }
  }, [transport]);

  useEffect(() => {
    if (!active) return;
    // Dimuat dari pengatur waktu (bukan di badan efek), seperti pembaruan berkala sesudahnya.
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), WEATHER_REFRESH_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Date.now() - lastLoad.current >= WEATHER_REFRESH_MS) void load();
    });
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      sub.remove();
    };
  }, [active, load]);

  const askLocation = useCallback(async () => {
    let granted = false;
    try {
      granted = (await Location.requestForegroundPermissionsAsync()).granted;
    } catch {
      granted = false;
    }
    if (!granted) {
      setStatus('denied');
      return;
    }
    const near = await phonePoint();
    if (!near) {
      setStatus('error');
      return;
    }
    point.current = near;
    await writeSecure(POINT_KEY, JSON.stringify(near)).catch(() => {});
    setStatus('loading');
    await load();
  }, [load]);

  const openSettings = useCallback(() => {
    void Linking.openSettings().catch(() => {});
  }, []);

  return { status, weather, askLocation, openSettings, refresh: () => void load() };
}
