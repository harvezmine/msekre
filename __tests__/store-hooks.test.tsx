import { act, render } from '@testing-library/react-native';
import { SampleProvider, useSample, useSampleDispatch, useSampleState, type SampleAction } from '@/sample/store';

test('komponen yang hanya mengirim aksi tidak digambar ulang saat keadaan berubah', async () => {
  const renders = { dispatchOnly: 0, reader: 0 };
  let send!: (a: SampleAction) => void;
  let place = '';
  function DispatchOnly() {
    renders.dispatchOnly += 1;
    send = useSampleDispatch();
    return null;
  }
  function Reader() {
    renders.reader += 1;
    place = useSampleState().place;
    return null;
  }
  await render(
    <SampleProvider>
      <DispatchOnly />
      <Reader />
    </SampleProvider>,
  );
  const before = { ...renders };
  await act(async () => send({ type: 'setPlace', place: 'Kedai Riau' }));
  expect(place).toBe('Kedai Riau');
  expect(renders.reader).toBeGreaterThan(before.reader);
  expect(renders.dispatchOnly).toBe(before.dispatchOnly);
});

test('useSample mengembalikan keadaan dan dispatch; di luar provider melempar galat', async () => {
  let seen: ReturnType<typeof useSample> | undefined;
  function Probe() {
    seen = useSample();
    return null;
  }
  await render(
    <SampleProvider>
      <Probe />
    </SampleProvider>,
  );
  expect(seen!.state.place).toBe('Semua');
  expect(typeof seen!.dispatch).toBe('function');

  jest.spyOn(console, 'error').mockImplementation(() => {});
  function Outside() {
    useSampleDispatch();
    return null;
  }
  await expect(render(<Outside />)).rejects.toThrow('di luar SampleProvider');
  jest.mocked(console.error).mockRestore();
});
