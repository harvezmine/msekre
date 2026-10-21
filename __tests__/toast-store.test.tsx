import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { createToastStore, ToastProvider, useToast, useToastState } from '@/ui/toastStore';

test('toast baru dengan teks yang sama tetap toast baru; menutup yang lama tidak menutup yang baru', () => {
  const store = createToastStore();
  store.show('Halo');
  const one = store.get()!;
  store.show('Halo');
  const two = store.get()!;
  expect(two.text).toBe('Halo');
  expect(two.id).not.toBe(one.id);
  store.hide(one.id);
  expect(store.get()).toBe(two);
  store.hide(two.id);
  expect(store.get()).toBeNull();
  store.show('Lagi');
  store.hide();
  expect(store.get()).toBeNull();
});

test('pendengar dikabari saat toast berubah, dan berhenti setelah berhenti berlangganan', () => {
  const store = createToastStore();
  const listener = jest.fn();
  const off = store.subscribe(listener);
  store.show('a');
  store.hide();
  expect(listener).toHaveBeenCalledTimes(2);
  off();
  store.show('b');
  expect(listener).toHaveBeenCalledTimes(2);
});

test('useToast menampilkan lewat provider, dan tanpa provider tidak berbuat apa-apa', async () => {
  let show!: (text: string) => void;
  function Probe() {
    show = useToast();
    const { toast } = useToastState();
    return <Text>{toast?.text ?? '-'}</Text>;
  }
  const withProvider = await render(
    <ToastProvider>
      <Probe />
    </ToastProvider>,
  );
  expect(withProvider.getByText('-')).toBeTruthy();
  await act(async () => show('Tersimpan.'));
  expect(withProvider.getByText('Tersimpan.')).toBeTruthy();
  await withProvider.unmount();

  const bare = await render(<Probe />);
  await act(async () => show('Tidak tampil.'));
  expect(bare.getByText('-')).toBeTruthy();
});
