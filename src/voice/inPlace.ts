import { useSyncExternalStore } from 'react';
import { reportError } from '@/crash';
import { haptic } from '@/ui/kit/haptics';

/**
 * Mode Suara di tempat (Beranda): menahan Inti besar tidak membuka layar lain. Sesi tahanan di sini, satu pada satu
 * waktu, dipakai Inti besar (`IntiButton hold="inPlace"`: mulai, geser, lepas), lapisan suara Beranda
 * (`InPlaceVoice`: mendengar, berpikir, kartu balasan), dan bilah tab (ikut meredup, ketukan di sana menutup).
 *
 * Geser jari menjauh dari titik awal untuk membatalkan: lewat {@link SLIDE_START} tampil "Geser untuk batal", lewat
 * {@link CANCEL_DISTANCE} siap batal ("Lepas untuk batal", getar sekali); dilepas di sana = tidak ada yang dikirim.
 *
 * Dipanggil dari penangan sentuhan: kesalahan di pendengar tidak boleh keluar (menutup paksa build rilis).
 */
export type SlideZone = 'none' | 'sliding' | 'armed';
export type HoldEvent = 'start' | 'send' | 'cancel';

/** Jari bergeser sejauh ini (dp) dari titik awal: petunjuk batal tampil. */
export const SLIDE_START = 28;
/** Sejauh ini: dilepas = batal. */
export const CANCEL_DISTANCE = 120;

export function slideZoneFor(dx: number, dy: number): SlideZone {
  const d = Math.hypot(dx, dy);
  if (!Number.isFinite(d) || d < SLIDE_START) return 'none';
  return d >= CANCEL_DISTANCE ? 'armed' : 'sliding';
}

export interface Point {
  x: number;
  y: number;
}

/** Pusat Inti besar di jendela dan garis tengahnya (dp). */
export interface Anchor extends Point {
  size: number;
}

export interface InPlaceSession {
  /** Lapisan suara Beranda tampil. */
  open: boolean;
  /** Jari masih menahan Inti. */
  held: boolean;
  zone: SlideZone;
  /** Pusat Inti besar di jendela (diukur saat disentuh), bila diketahui. */
  anchor: Anchor | null;
}

const CLOSED: InPlaceSession = { open: false, held: false, zone: 'none', anchor: null };
let session: InPlaceSession = CLOSED;
let start: Point | null = null;
const listeners = new Set<() => void>();
const handlers = new Set<(e: HoldEvent) => void>();

const finitePoint = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
const finiteAnchor = (a: Anchor | null | undefined): Anchor | null =>
  a && Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.size) && a.size > 0
    ? { x: a.x, y: a.y, size: a.size }
    : null;

function update(next: InPlaceSession) {
  session = next;
  for (const l of [...listeners]) {
    try {
      l();
    } catch (e) {
      reportError('suara di tempat: pendengar', e);
    }
  }
}

function emit(event: HoldEvent) {
  for (const h of [...handlers]) {
    try {
      h(event);
    } catch (e) {
      reportError(`suara di tempat: ${event}`, e);
    }
  }
}

export const inPlace = {
  /** Inti besar mulai ditahan: lapisan suara terbuka (atau giliran baru di lapisan yang sudah terbuka). */
  begin({ finger, anchor }: { finger?: Point | null; anchor?: Anchor | null } = {}): void {
    start = finitePoint(finger);
    update({ open: true, held: true, zone: 'none', anchor: finiteAnchor(anchor) ?? session.anchor });
    emit('start');
  },
  /** Jari bergerak selagi menahan (koordinat halaman). */
  move(x: number, y: number): void {
    if (!session.held || !start) return;
    const zone = slideZoneFor(x - start.x, y - start.y);
    if (zone === session.zone) return;
    if (zone === 'armed' || session.zone === 'armed') haptic('selection');
    update({ ...session, zone });
  },
  /** Jari diangkat (atau sentuhan dibatalkan sistem): kirim, atau batal bila sedang di zona batal. */
  release(): void {
    if (!session.held) return;
    const cancelled = session.zone === 'armed';
    start = null;
    update({ ...session, held: false, zone: 'none' });
    emit(cancelled ? 'cancel' : 'send');
  },
  /** Tutup lapisan suara (ketuk di luar, pindah layar, selesai). */
  close(): void {
    start = null;
    if (session.open || session.held) update(CLOSED);
  },
  get(): InPlaceSession {
    return session;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Mulai, kirim, batal: untuk mesin suara yang terpasang selagi lapisan terbuka. */
  onHold(handler: (e: HoldEvent) => void): () => void {
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  },
  /** Untuk tes. */
  reset(): void {
    start = null;
    session = CLOSED;
    handlers.clear();
    for (const l of [...listeners]) l();
  },
};

export function useInPlace(): InPlaceSession {
  return useSyncExternalStore(inPlace.subscribe, inPlace.get, inPlace.get);
}
