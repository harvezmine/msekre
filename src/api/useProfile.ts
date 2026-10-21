import { use } from 'react';
import { DEFAULT_ASSISTANT } from '@/brand';
import { AssistantNameContext } from './AccountProvider';
import { ApiContext } from './ApiProvider';
import { AuthContext } from './useAuth';
import type { Me } from './contract';
import { DEMO_USER as user } from './demo';

export interface Profile {
  /** Nama asisten pilihan pengguna, atau {@link DEFAULT_ASSISTANT} sebelum `GET /me` selesai (atau tanpa sesi). */
  assistantName: string;
  /**
   * Nama pengguna untuk sapaan. `null` kalau belum ada: di mode server tidak pernah memakai nama contoh, jadi pengguna
   * asli tidak disapa dengan nama orang lain.
   */
  name: string | null;
  /** Nomor WhatsApp akun (E.164 tanpa "+") dari `GET /me`, atau `null` bila belum terbaca. */
  phone: string | null;
  /** Huruf awal untuk avatar (contoh: "RW"), atau `null` bila nama belum ada. */
  initials: string | null;
  plan: Me['plan'] | null;
  /** Mode contoh (atau di luar `ApiProvider`): layar boleh memakai isian contoh dari desain. */
  sample: boolean;
  /** Mode Suara boleh dipakai: selalu di mode contoh, di mode server menurut `Me.features.voice` (hilang = belum). */
  voice: boolean;
}

/**
 * Nama yang ditampilkan di layar. Satu tempat untuk cadangannya, supaya layar tidak mengurusnya sendiri. Di luar
 * `AuthProvider` (tes komponen) hasilnya nilai bawaan dengan nama contoh.
 */
export function useProfile(): Profile {
  const me = use(AuthContext)?.me ?? null;
  const accountName = use(AssistantNameContext);
  const sample = (use(ApiContext)?.mode ?? 'contoh') !== 'server';
  const name = me?.name ?? (sample ? user.name : null);
  return {
    assistantName: accountName ?? me?.assistantName ?? DEFAULT_ASSISTANT,
    name,
    initials: sample && name === user.name ? user.initials : initialsOf(name),
    phone: me?.phone ?? null,
    plan: me?.plan ?? null,
    sample,
    voice: sample || me?.features?.voice === true,
  };
}

export function useAssistantName(): string {
  return useProfile().assistantName;
}

/** Huruf pertama dari paling banyak dua kata pertama nama: "Budi Santoso" -> "BS". */
export function initialsOf(name: string | null): string | null {
  const letters = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return letters || null;
}
