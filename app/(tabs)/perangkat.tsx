import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Device, Routine } from '@/api/contract';
import { useDeviceControl } from '@/api/useDeviceControl';
import { useHome } from '@/api/useHome';
import { useSampleDispatch } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { BoxCard } from '@/ui/device/BoxCard';
import { DeviceTile } from '@/ui/device/DeviceTile';
import { RoomTabs } from '@/ui/device/RoomTabs';
import { RoutineRow } from '@/ui/device/RoutineRow';
import { Icon } from '@/ui/Icon';
import { ListGroup } from '@/ui/ListRow';
import { PlaceButton } from '@/ui/PlaceButton';
import { Initials } from '@/ui/Initials';
import { Txt } from '@/ui/Txt';

const GAP = 12;

export default function Perangkat() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const dispatch = useSampleDispatch();
  const { home } = useHome();
  const place = home?.place;
  const {
    data,
    devices,
    rooms: roomList,
    routines,
    box,
    status,
    error,
    retry,
    control,
    runRoutine,
    setBoxMic,
  } = useDeviceControl(place);
  const [picked, setPicked] = useState<string | null>(null);

  const all = place === 'Semua';
  const rooms = roomList.map((r) => r.name);
  const room = picked && rooms.includes(picked) ? picked : rooms[0];
  const tileWidth = (width - 32 - GAP) / 2;
  const toast = (text: string) => dispatch({ type: 'showToast', text });

  // Sakelar ubin: perintah lewat server. Aksi yang dijaga (kamera, kunci) butuh PIN bila pemilik menghidupkannya; lembar
  // PIN dibuka otomatis oleh `control`.
  const tile = (d: Device) => (
    <DeviceTile
      key={d.id}
      device={d}
      width={tileWidth}
      onToggle={(next) => void control(d.id, { on: next })}
      onOpen={d.kind === 'ac' ? () => router.push({ pathname: '/perangkat/[id]', params: { id: d.id } }) : undefined}
    />
  );
  const run = async (r: Routine) => {
    const result = await runRoutine(r.id, place ?? 'Semua');
    toast(result.ok ? result.summary : result.message);
  };
  const toggleMic = async (on: boolean) => {
    const failed = await setBoxMic(on);
    if (failed) toast(failed);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 8,
            paddingLeft: 12,
            paddingRight: 16,
          }}
        >
          <PlaceButton />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tambah perangkat"
              onPress={() => router.push('/perangkat/tambah')}
              android_ripple={{ color: c.ripple, borderless: true, radius: 24 }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: c.line,
                backgroundColor: c.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="plus" size={22} color={c.ink} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Akun"
              onPress={() => router.push('/akun')}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: c.mint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Initials />
            </Pressable>
          </View>
        </View>
        <Txt v="title" accessibilityRole="header" style={{ paddingTop: 16, paddingHorizontal: 20 }}>
          Perangkat
        </Txt>
        {all || !room ? null : <RoomTabs rooms={rooms} value={room} onChange={setPicked} />}

        {!data ? (
          status === 'error' ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 32, gap: 16, alignItems: 'flex-start' }}>
              <Txt>{error}</Txt>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Coba lagi"
                onPress={() => void retry()}
                style={{
                  height: 48,
                  paddingHorizontal: 24,
                  borderRadius: 24,
                  backgroundColor: c.green,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt weight={600} color={c.onGreen}>
                  Coba lagi
                </Txt>
              </Pressable>
            </View>
          ) : null
        ) : (
          <View style={{ paddingTop: 16, paddingHorizontal: 16, gap: 12 }}>
            {all ? (
              data.places.map((p) => (
                <View key={p} style={{ gap: 12 }}>
                  <Txt v="subtitle" accessibilityRole="header" style={{ paddingHorizontal: 4, paddingTop: 4 }}>
                    {p}
                  </Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
                    {devices.filter((d) => d.place === p).map(tile)}
                  </View>
                </View>
              ))
            ) : (
              <>
                {box && place === 'Rumah' && room === 'Ruang tamu' ? (
                  <BoxCard box={box} onMic={(on) => void toggleMic(on)} />
                ) : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
                  {devices.filter((d) => d.room === room).map(tile)}
                </View>
              </>
            )}
            {routines.length > 0 ? (
              <>
                <Txt v="subtitle" accessibilityRole="header" style={{ paddingTop: 12, paddingHorizontal: 4 }}>
                  Rutinitas
                </Txt>
                <ListGroup>
                  {routines.map((r, i) => (
                    <RoutineRow key={r.id} routine={r} last={i === routines.length - 1} onRun={() => void run(r)} />
                  ))}
                </ListGroup>
              </>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
