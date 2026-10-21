import { View } from 'react-native';
import { Segmented } from '../kit/Segmented';

interface Props {
  rooms: readonly string[];
  value: string;
  onChange: (room: string) => void;
}

/** Pilihan ruangan: segmen yang bisa digeser (papan Fase R, layar Perangkat), bukan garis bawah hijau. */
export function RoomTabs({ rooms, value, onChange }: Props) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      <Segmented options={rooms} value={value} onChange={onChange} label="Ruangan" scrollable />
    </View>
  );
}
