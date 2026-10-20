import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { user } from '@/sample/profile';
import { ROUTINES, routineActions, type Routine } from '@/sample/routines';
import { PLACES, useSample, type Device } from '@/sample/store';
import { useTheme } from '@/theme/ThemeProvider';
import { BoxCard } from '@/ui/device/BoxCard';
import { DeviceTile } from '@/ui/device/DeviceTile';
import { RoomTabs } from '@/ui/device/RoomTabs';
import { RoutineRow } from '@/ui/device/RoutineRow';
import { Icon } from '@/ui/Icon';
import { ListGroup } from '@/ui/ListRow';
import { PlaceButton } from '@/ui/PlaceButton';
import { Txt } from '@/ui/Txt';

const HOME_ROOMS = ['Ruang tamu', 'Kamar', 'Dapur', 'Teras'];
const GAP = 12;

export default function Perangkat() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { state, dispatch } = useSample();
  const [picked, setPicked] = useState<string | null>(null);

  const all = state.place === 'Semua';
  const placeDevices = state.devices.filter((d) => all || d.place === state.place);
  const rooms = state.place === 'Rumah' ? HOME_ROOMS : [...new Set(placeDevices.map((d) => d.room))];
  const room = picked && rooms.includes(picked) ? picked : rooms[0]!;
  const tileWidth = (width - 32 - GAP) / 2;

  const toggle = (d: Device, next: boolean) => {
    if (!next && d.needsPin) router.push({ pathname: '/pin', params: { id: d.id } });
    else dispatch({ type: 'toggleDevice', id: d.id, on: next });
  };
  const tile = (d: Device) => (
    <DeviceTile
      key={d.id}
      device={d}
      width={tileWidth}
      onToggle={(next) => toggle(d, next)}
      onOpen={d.kind === 'ac' ? () => router.push({ pathname: '/perangkat/[id]', params: { id: d.id } }) : undefined}
    />
  );
  const run = (r: Routine) => {
    for (const a of routineActions(r, state)) dispatch(a);
    dispatch({ type: 'showToast', text: `Rutinitas ${r.name} dijalankan.` });
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
              onPress={() => dispatch({ type: 'showToast', text: 'Akun dibangun di tugas berikutnya.' })}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: c.mint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt weight={700} color={c.green} style={{ fontSize: 15 }}>
                {user.initials}
              </Txt>
            </Pressable>
          </View>
        </View>
        <Txt v="title" accessibilityRole="header" style={{ paddingTop: 16, paddingHorizontal: 20 }}>
          Perangkat
        </Txt>
        {all ? null : <RoomTabs rooms={rooms} value={room} onChange={setPicked} />}

        <View style={{ paddingTop: 16, paddingHorizontal: 16, gap: 12 }}>
          {all ? (
            PLACES.filter((p) => p !== 'Semua').map((p) => (
              <View key={p} style={{ gap: 12 }}>
                <Txt v="subtitle" accessibilityRole="header" style={{ paddingHorizontal: 4, paddingTop: 4 }}>
                  {p}
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
                  {state.devices.filter((d) => d.place === p).map(tile)}
                </View>
              </View>
            ))
          ) : (
            <>
              {state.place === 'Rumah' && room === 'Ruang tamu' ? <BoxCard /> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
                {placeDevices.filter((d) => d.room === room).map(tile)}
              </View>
            </>
          )}
          <Txt v="subtitle" accessibilityRole="header" style={{ paddingTop: 12, paddingHorizontal: 4 }}>
            Rutinitas
          </Txt>
          <ListGroup>
            {ROUTINES.map((r, i) => (
              <RoutineRow key={r.id} routine={r} last={i === ROUTINES.length - 1} onRun={() => run(r)} />
            ))}
          </ListGroup>
        </View>
      </ScrollView>
    </View>
  );
}
