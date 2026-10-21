import { useEffect } from 'react';
import { cancelAnimation, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { devQuery } from '@/dev/query';
import type { VoiceState } from './controller';

/**
 * Keadaan Mode Suara yang dipaksa lewat alamat, hanya pratinjau web saat pengembangan (`/suara?demo=mendengar`), untuk
 * tangkapan layar tanpa HP dan mikrofon. Di HP `devQuery()` selalu kosong, jadi tidak pernah aktif.
 */
export type VoiceDemo = 'mendengar' | 'berpikir' | 'menjawab' | 'siap';

export const DEMO_SAID = 'Matikan AC kamar jam sepuluh malam nanti';
export const DEMO_REPLY = 'Baik, AC kamar mati jam 22.00.';

export function voiceDemo(): VoiceDemo | null {
  const d = devQuery().demo;
  return d === 'mendengar' || d === 'berpikir' || d === 'menjawab' || d === 'siap' ? d : null;
}

/** Bagian keadaan yang ditimpa untuk pratinjau. */
export function demoState(demo: VoiceDemo | null): Partial<VoiceState> | null {
  switch (demo) {
    case 'mendengar':
      return { phase: 'listening', transcript: DEMO_SAID, transcriptFinal: false, reply: null, note: null };
    case 'berpikir':
      return { phase: 'thinking', transcript: `${DEMO_SAID}.`, transcriptFinal: true, reply: null, note: null };
    case 'menjawab':
      return { phase: 'speaking', transcript: `${DEMO_SAID}.`, transcriptFinal: true, reply: DEMO_REPLY, note: null };
    case 'siap':
      return { phase: 'idle', transcript: '', transcriptFinal: false, reply: null, note: null };
    default:
      return null;
  }
}

/** Pratinjau mendengar: level mikrofon tiruan yang naik-turun seperti orang bicara. */
export function useDemoLevel(demo: VoiceDemo | null, level: SharedValue<number>): void {
  useEffect(() => {
    if (demo !== 'mendengar') return;
    const step = (to: number, duration: number) => withTiming(to, { duration });
    level.set(
      withRepeat(
        withSequence(step(0.85, 90), step(0.45, 150), step(0.7, 110), step(0.15, 170), step(0.6, 120), step(0.3, 160)),
        -1,
      ),
    );
    return () => cancelAnimation(level);
  }, [demo, level]);
}
