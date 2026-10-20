import { use } from 'react';
import { DEFAULT_ASSISTANT } from '@/brand';
import { user } from '@/sample/profile';
import { AuthContext } from './useAuth';

export interface Profile {
  /** Nama asisten pilihan pengguna, atau {@link DEFAULT_ASSISTANT} sebelum `GET /me` selesai (atau tanpa sesi). */
  assistantName: string;
  /** Nama pengguna, atau nama contoh bila belum ada. */
  name: string;
}

/**
 * Nama yang ditampilkan di layar. Satu tempat untuk cadangannya, supaya layar tidak mengurusnya sendiri. Di luar
 * `AuthProvider` (tes komponen) hasilnya nilai bawaan.
 */
export function useProfile(): Profile {
  const me = use(AuthContext)?.me;
  return { assistantName: me?.assistantName ?? DEFAULT_ASSISTANT, name: me?.name ?? user.name };
}

export function useAssistantName(): string {
  return useProfile().assistantName;
}
