/** Kendali atas tiruan `expo-audio` di jest.setup.ts. */
export interface AudioMock {
  permission: { status: string; granted: boolean; canAskAgain: boolean };
  requestResult: { status: string; granted: boolean; canAskAgain: boolean } | null;
  streaming: boolean;
  /** Menahan `stream.start()` sampai janjinya selesai (tes tombol dilepas sebelum mikrofon menyala). */
  streamStart: (() => Promise<void>) | null;
  players: {
    source: unknown;
    play: jest.Mock;
    pause: jest.Mock;
    remove: jest.Mock;
    removed: boolean;
  }[];
  reset(): void;
  /** Potongan PCM 16-bit dari mikrofon (bawaan 16 kHz). */
  emitBuffer(samples: number[], sampleRate?: number): void;
  /** Pemutaran balasan selesai (pemutar terakhir). */
  finishPlayback(index?: number): void;
  /** Status dari pemutar: `error`, `duration`, dan seterusnya (bawaan pemutar terakhir). */
  statusUpdate(status: { didJustFinish?: boolean; error?: string | null; duration?: number }, index?: number): void;
}

export const audio = (jest.requireMock('expo-audio') as { __audio: AudioMock }).__audio;
export const stream = (jest.requireMock('expo-audio') as { __stream: { start: jest.Mock; stop: jest.Mock } }).__stream;
