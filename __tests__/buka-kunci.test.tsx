import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import BukaKunci from '../app/buka-kunci';
import { deviceById, useSample, type SampleState } from '@/sample/store';
import { createTestApi, renderWithProviders } from './helpers';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'pintu-depan' });
});
afterAll(() => jest.mocked(useLocalSearchParams).mockReturnValue({}));

let latest: SampleState;
function Probe() {
  const { state } = useSample();
  useEffect(() => {
    latest = state;
  });
  return null;
}
async function show(api = createTestApi()) {
  await renderWithProviders(
    <>
      <BukaKunci />
      <Probe />
    </>,
    { api, actions: [{ type: 'setPlace', place: 'Rumah' }] },
  );
}
const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

test('PIN mati: "Buka kunci Pintu depan?" lalu Buka membuka kunci tanpa PIN', async () => {
  await show();
  expect(await screen.findByText('Buka kunci Pintu depan?')).toBeOnTheScreen();
  expect(screen.queryByLabelText(/PIN terisi/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Buka' }));
  await advance(300);
  expect(deviceById(latest, 'pintu-depan')!.on).toBe(false);
  expect(router.back).toHaveBeenCalled();
});

test('Batal menutup tanpa mengubah kunci', async () => {
  await show();
  await fireEvent.press(await screen.findByRole('button', { name: 'Batal' }));
  await advance(300);
  expect(deviceById(latest, 'pintu-depan')!.on).toBe(true);
  expect(router.back).toHaveBeenCalled();
});

test('PIN ternyata dihidupkan: lembar ini menutup dan membuka lembar PIN', async () => {
  const api = createTestApi({ security: { pinEnabled: true, pin: '123456' } });
  await show(api);
  await fireEvent.press(await screen.findByRole('button', { name: 'Buka' }));
  await advance(300);
  expect(router.push).toHaveBeenCalledWith({ pathname: '/pin', params: { id: 'pintu-depan' } });
  expect(deviceById(latest, 'pintu-depan')!.on).toBe(true);
});

test('perangkat tak dikenal: kalimat ramah', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'hilang' });
  await show();
  expect(await screen.findByText('Perangkat ini tidak ditemukan.')).toBeOnTheScreen();
});
