import { router } from 'expo-router';
import { useMemo } from 'react';
import { useProfile } from '@/api/useProfile';
import { useToast } from '@/ui/toastStore';
import { VOICE_SOON_TEXT } from './texts';

export { VOICE_SOON_TEXT } from './texts';

/** Mode Suara boleh dibuka? Mode contoh selalu; mode server menurut `Me.features.voice` (hilang = belum). */
export function useVoiceAvailable(): boolean {
  return useProfile().voice;
}

type Open = 'navigate' | 'push' | 'replace';

/**
 * Pembuka Mode Suara untuk semua pintu masuk (tab, Beranda, kolom chat, Agenda): membuka `/suara`, atau kalau belum
 * tersedia memunculkan catatan "segera hadir" dan tetap di layar sekarang.
 */
export function useOpenVoice(): (how?: Open) => void {
  const available = useVoiceAvailable();
  const toast = useToast();
  return useMemo(
    () =>
      (how: Open = 'navigate') => {
        if (!available) return toast(VOICE_SOON_TEXT);
        router[how]('/suara');
      },
    [available, toast],
  );
}
