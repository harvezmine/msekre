import type { IconName } from '@/ui/icons';
import type { SampleAction, SampleState } from './reducer';

export interface Routine {
  id: 'pulang' | 'tutup-kedai' | 'tidur';
  name: string;
  sub: string;
  icon: IconName;
  /** Tempat yang disentuh rutinitas ini. */
  places: string[];
}

/** Rutinitas di Perangkat (desain 2c). */
export const ROUTINES: Routine[] = [
  { id: 'pulang', name: 'Saya pulang', sub: 'Lampu teras nyala, AC kamar 25°', icon: 'home', places: ['Rumah'] },
  {
    id: 'tutup-kedai',
    name: 'Tutup kedai',
    sub: 'Matikan semua, kunci, aktifkan kamera',
    icon: 'store',
    places: ['Kedai Dago', 'Kedai Riau'],
  },
  { id: 'tidur', name: 'Tidur', sub: 'Lampu mati, AC kamar 26°, pintu dikunci', icon: 'moon', places: ['Rumah'] },
];

const isKedai = (place: string) => place === 'Kedai Dago' || place === 'Kedai Riau';

/** Tutup kedai hanya menyentuh kedai yang dipilih; di Semua atau Rumah, kedua kedai. */
const kedaiTarget = (place: string, d: SampleState['devices'][number]) =>
  isKedai(place) ? d.place === place : d.place !== 'Rumah';

/** Teks hasil setelah rutinitas dijalankan di `place`; Tutup kedai menyebut kedai yang terkena. */
export function routineDone(routine: Routine, place: string): string {
  if (routine.id !== 'tutup-kedai') return `Rutinitas ${routine.name} dijalankan.`;
  const where = isKedai(place) ? place : 'semua kedai';
  return `Rutinitas ${routine.name} dijalankan di ${where}.`;
}

/**
 * Aksi penyimpanan untuk satu rutinitas, dari perangkat yang ada. Perangkat yang tidak terjangkau dilewati oleh
 * reducer sendiri, dan perangkat yang sudah pada keadaan itu tidak mencatat apa-apa.
 */
export function routineActions(routine: Routine, state: SampleState, place: string = state.place): SampleAction[] {
  const pick = (pred: (d: SampleState['devices'][number]) => boolean) => state.devices.filter(pred);
  const acts: SampleAction[] = [];
  switch (routine.id) {
    case 'pulang':
      for (const d of pick((x) => x.id === 'lampu-teras')) acts.push({ type: 'toggleDevice', id: d.id, on: true });
      for (const d of pick((x) => x.id === 'ac-kamar'))
        acts.push({ type: 'setAc', deviceId: d.id, on: true, temp: 25 });
      break;
    case 'tutup-kedai':
      for (const d of pick((x) => kedaiTarget(place, x))) {
        if (d.kind === 'lampu' || d.kind === 'ac') acts.push({ type: 'toggleDevice', id: d.id, on: false });
        else if (d.kind === 'kamera' || d.kind === 'kunci') acts.push({ type: 'toggleDevice', id: d.id, on: true });
      }
      break;
    case 'tidur':
      for (const d of pick((x) => x.place === 'Rumah' && x.kind === 'lampu'))
        acts.push({ type: 'toggleDevice', id: d.id, on: false });
      for (const d of pick((x) => x.id === 'ac-kamar'))
        acts.push({ type: 'setAc', deviceId: d.id, on: true, temp: 26 });
      for (const d of pick((x) => x.place === 'Rumah' && x.kind === 'kunci'))
        acts.push({ type: 'toggleDevice', id: d.id, on: true });
      break;
  }
  return acts;
}
