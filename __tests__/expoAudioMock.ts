/** Tiruan `expo-audio` untuk jest.setup.ts. Kendalinya: __tests__/audioMock.ts. */
export function createExpoAudioMock() {
  type MockListener = (status: { didJustFinish: boolean }) => void;
  type MockOnBuffer = (b: { data: ArrayBuffer; sampleRate: number; channels: number; timestamp: number }) => void;
  const audio = {
    permission: { status: 'granted', granted: true, canAskAgain: true } as {
      status: string;
      granted: boolean;
      canAskAgain: boolean;
    },
    /** Hasil `requestRecordingPermissionsAsync`; kosong = izin tidak berubah. */
    requestResult: null as null | { status: string; granted: boolean; canAskAgain: boolean },
    onBuffer: null as null | MockOnBuffer,
    streaming: false,
    streamStart: null as null | (() => Promise<void>),
    players: [] as {
      source: unknown;
      play: jest.Mock;
      pause: jest.Mock;
      remove: jest.Mock;
      listeners: MockListener[];
      removed: boolean;
    }[],
    reset(): void {
      audio.permission = { status: 'granted', granted: true, canAskAgain: true };
      audio.requestResult = null;
      audio.onBuffer = null;
      audio.streaming = false;
      audio.streamStart = null;
      audio.players = [];
    },
    emitBuffer(samples: number[], sampleRate = 16000): void {
      const data = new Int16Array(samples).buffer;
      audio.onBuffer?.({ data, sampleRate, channels: 1, timestamp: 0 });
    },
    finishPlayback(index?: number): void {
      for (const l of audio.players[index ?? audio.players.length - 1]?.listeners ?? []) l({ didJustFinish: true });
    },
  };
  const stream = {
    start: jest.fn(async () => {
      await audio.streamStart?.();
      audio.streaming = true;
    }),
    stop: jest.fn(() => {
      audio.streaming = false;
    }),
  };
  return {
    __audio: audio,
    __stream: stream,
    useAudioStream: (options: { onBuffer?: MockOnBuffer }) => {
      audio.onBuffer = options?.onBuffer ?? null;
      return { stream, isStreaming: false };
    },
    createAudioPlayer: jest.fn((source: unknown) => {
      const player = {
        source,
        listeners: [] as MockListener[],
        removed: false,
        play: jest.fn(),
        pause: jest.fn(),
        remove: jest.fn(() => {
          player.removed = true;
        }),
        addListener: (_name: string, listener: MockListener) => {
          player.listeners.push(listener);
          return { remove: () => (player.listeners = player.listeners.filter((l) => l !== listener)) };
        },
      };
      audio.players.push(player);
      return player;
    }),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    getRecordingPermissionsAsync: jest.fn(() => Promise.resolve(audio.permission)),
    requestRecordingPermissionsAsync: jest.fn(() => {
      if (audio.requestResult) audio.permission = audio.requestResult;
      return Promise.resolve(audio.permission);
    }),
  };
}
