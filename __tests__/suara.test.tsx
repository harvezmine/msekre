import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import Suara from '../app/suara';
import { useTimeline } from '@/ui/useTimeline';

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => jest.clearAllMocks());

test('mulai mendengar, tanpa balasan, dengan getar ringan', async () => {
  await render(<Suara />);
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  expect(screen.getByText('Mendengar')).toBeTruthy();
  expect(screen.getByText(/Matikan AC kamar/)).toBeTruthy();
  expect(screen.getByText('dan…')).toBeTruthy();
  expect(screen.getAllByTestId(/^inti-cincin-/)).toHaveLength(2);
  expect(screen.queryByText('Sudah. AC kamar saya matikan.')).toBeNull();
});

test('2,2 detik: berpikir, ucapan lengkap; 3,4 detik: balasan tampil dan tetap setelah selesai bicara', async () => {
  await render(<Suara />);
  await advance(2200);
  expect(screen.queryByText('Mendengar')).toBeNull();
  expect(screen.getByText('Matikan AC kamar.')).toBeTruthy();
  expect(screen.queryByText('dan…')).toBeNull();
  expect(screen.queryAllByTestId(/^inti-cincin-/)).toHaveLength(0);
  expect(screen.queryAllByTestId(/^inti-gelombang-/)).toHaveLength(0);
  expect(screen.queryByText('Sudah. AC kamar saya matikan.')).toBeNull();
  await advance(1200);
  expect(screen.getByText('Sudah. AC kamar saya matikan.')).toBeTruthy();
  expect(screen.getAllByTestId(/^inti-gelombang-/)).toHaveLength(3);
  await advance(4000);
  expect(screen.getByText('Sudah. AC kamar saya matikan.')).toBeTruthy();
  expect(screen.queryAllByTestId(/^inti-gelombang-/)).toHaveLength(0);
});

test('Ulangi contoh mengulang dari mendengar', async () => {
  await render(<Suara />);
  await advance(5000);
  await fireEvent.press(screen.getByRole('button', { name: 'Ulangi contoh' }));
  expect(screen.getByText('Mendengar')).toBeTruthy();
  expect(screen.queryByText('Sudah. AC kamar saya matikan.')).toBeNull();
  await advance(2200);
  expect(screen.queryByText('Mendengar')).toBeNull();
});

test('useTimeline: restart dan bersih saat dilepas', async () => {
  const steps = [
    { at: 0, n: 0 },
    { at: 100, n: 1 },
    { at: 300, n: 2 },
  ];
  const set = jest.spyOn(globalThis, 'setTimeout');
  const clear = jest.spyOn(globalThis, 'clearTimeout');
  const { result, unmount } = await renderHook(() => useTimeline(steps));
  expect(result.current.step.n).toBe(0);
  await advance(100);
  expect(result.current.step.n).toBe(1);
  await act(async () => result.current.restart());
  expect(result.current.step.n).toBe(0);
  await advance(300);
  expect(result.current.step.n).toBe(2);
  await act(async () => result.current.restart());
  // Hanya pewaktu milik hook: yang jeda 100 dan 300 ms.
  const mine = set.mock.calls.flatMap((c, i) => (c[1] === 100 || c[1] === 300 ? [set.mock.results[i]!.value] : []));
  const last = mine.slice(-2);
  clear.mockClear();
  await unmount();
  for (const id of last) expect(clear).toHaveBeenCalledWith(id);
  set.mockRestore();
  clear.mockRestore();
});
