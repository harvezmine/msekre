import { useState, type ComponentType } from 'react';
import { reportError } from '@/crash';
import { Boundary } from '@/ui/Boundary';
import { WavesBand } from './WavesBand';
import type { WavesProps, WavesSkiaProps } from './WavesSkia';

/**
 * Gelombang Mode Suara di HP: Skia (`WavesSkia`) dengan tiga lapis pengaman, supaya kendala gelombang tidak pernah
 * menutup paksa aplikasi; kontrol Mode Suara di atasnya tetap jalan dengan pita cahaya diam (`WavesBand`):
 * 1. Skia dimuat dan dicoba sekali saat modul ini dimuat; gagal = selalu pita diam.
 * 2. Batas kesalahan: kesalahan saat menggambar kanvas diganti pita diam.
 * 3. Jam frame di utas UI menangkap kesalahannya sendiri dan melapor lewat `onFail`; gelombang diganti pita diam.
 * Di web lihat `Waves.web.tsx`.
 */
type SkiaModule = typeof import('@shopify/react-native-skia');

/* eslint-disable @typescript-eslint/no-require-imports */
const requireSkia = (): SkiaModule => require('@shopify/react-native-skia') as SkiaModule;
const requireWavesSkia = () => (require('./WavesSkia') as typeof import('./WavesSkia')).WavesSkia;
/* eslint-enable @typescript-eslint/no-require-imports */

/** Muat Skia dan coba sekali; `null` (dan kendalanya dicatat) bila modul native Skia tidak bisa dipakai. */
export function loadSkiaWaves(loadSkia: () => SkiaModule = requireSkia): ComponentType<WavesSkiaProps> | null {
  try {
    // Modul native Skia terpasang: pembangun jalur bisa dibuat (dipakai setiap frame).
    loadSkia().Skia.PathBuilder.Make();
    return requireWavesSkia();
  } catch (e) {
    reportError('gelombang: Skia belum siap', e);
    return null;
  }
}

const SkiaWaves = loadSkiaWaves();
/** Skia siap dipakai di HP ini (untuk tes dan pemeriksaan). */
export const SKIA_WAVES_READY = SkiaWaves !== null;

export function Waves(props: WavesProps) {
  const [failed, setFailed] = useState(false);
  if (!SkiaWaves || failed) return <WavesBand {...props} />;
  const onFail = (why: string) => {
    reportError('gelombang (utas UI)', why);
    setFailed(true);
  };
  return (
    <Boundary where="gelombang" fallback={() => <WavesBand {...props} />}>
      <SkiaWaves {...props} onFail={onFail} />
    </Boundary>
  );
}

export type { WavesProps };
