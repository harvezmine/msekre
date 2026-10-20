import type { IntiState } from '@/ui/inti/Inti';

export interface VoiceStep {
  /** Milidetik sejak mulai. */
  at: number;
  state: IntiState;
  label: string;
  you: string;
  /** Bagian ucapan yang belum selesai, tampil abu-abu. */
  youRest: string;
  reply: string;
}

export const VOICE_SAMPLE: VoiceStep[] = [
  { at: 0, state: 'listen', label: 'Mendengar', you: 'Matikan AC kamar ', youRest: 'dan…', reply: '' },
  { at: 2200, state: 'think', label: 'Nadia', you: 'Matikan AC kamar.', youRest: '', reply: '' },
  { at: 3400, state: 'speak', label: 'Nadia', you: 'Matikan AC kamar.', youRest: '', reply: 'Sudah. AC kamar saya matikan.' },
  { at: 7400, state: 'idle', label: 'Nadia', you: 'Matikan AC kamar.', youRest: '', reply: 'Sudah. AC kamar saya matikan.' },
];
