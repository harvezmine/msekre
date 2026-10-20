import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useLive } from '@/ui/useLive';

test('hidup hanya saat aplikasi aktif', async () => {
  let listener: (s: string) => void = () => {};
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
    listener = cb;
    return { remove };
  }) as never);
  const { result, unmount } = await renderHook(() => useLive());
  expect(result.current).toBe(true);
  await act(async () => listener('background'));
  expect(result.current).toBe(false);
  await act(async () => listener('active'));
  expect(result.current).toBe(true);
  await unmount();
  expect(remove).toHaveBeenCalled();
});
