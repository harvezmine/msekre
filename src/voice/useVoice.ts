import * as Haptics from 'expo-haptics';
import { useAudioStream } from 'expo-audio';
import { useIsFocused } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useApi } from '@/api/ApiProvider';
import { createSpeaker, enterVoiceAudio, leaveVoiceAudio } from './audio';
import { VoiceController, type VoiceState } from './controller';

const KEEP_AWAKE_TAG = 'mode-suara';

export interface Voice extends VoiceState {
  /** Keras-pelannya suara dari mikrofon, 0..1; cincin Inti mengikutinya. */
  level: SharedValue<number>;
  holdStart(): Promise<void>;
  holdEnd(): Promise<void>;
  sendText(text: string): void;
  setTyping(typing: boolean): void;
  setMuted(muted: boolean): void;
  dismissConfirm(): void;
  closePermission(): void;
  waitForSettings(): void;
  requestPermission(): Promise<void>;
  recheckPermission(): Promise<void>;
}

/**
 * Mode Suara untuk layar: satu sesi suara ke server (`transport.openVoice`), mikrofon PCM dari expo-audio, dan pemutar
 * balasan. Layar menyala selama terbuka. Mikrofon dan pemutar dilepas saat layar ditutup dan saat aplikasi ke latar.
 */
export function useVoice(): Voice {
  const { transport } = useApi();
  const level = useSharedValue(0);
  const controllerRef = useRef<VoiceController | null>(null);
  const { stream } = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: 'int16',
    onBuffer: (buffer) => controllerRef.current?.pushBuffer(buffer),
  });
  const controller = useMemo(
    () =>
      new VoiceController({
        transport,
        mic: { start: () => stream.start(), stop: () => stream.stop() },
        speaker: createSpeaker(),
        haptic: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        onLevel: (value) => level.set(value),
      }),
    [transport, stream, level],
  );

  useEffect(() => {
    controllerRef.current = controller;
    void enterVoiceAudio();
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    controller.start();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') controller.suspend();
      else void controller.recheckPermission();
    });
    return () => {
      sub.remove();
      controller.dispose();
      try {
        stream.stop();
      } catch {
        // Mikrofon sudah berhenti.
      }
      controllerRef.current = null;
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
      void leaveVoiceAudio();
    };
  }, [controller, stream]);

  // Layar lain menutupi Mode Suara (alarm, notifikasi yang dibuka): rekaman dan suara berhenti.
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) controller.suspend();
  }, [focused, controller]);

  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  return {
    ...state,
    level,
    holdStart: controller.holdStart,
    holdEnd: controller.holdEnd,
    sendText: controller.sendText,
    setTyping: controller.setTyping,
    setMuted: controller.setMuted,
    dismissConfirm: controller.dismissConfirm,
    closePermission: controller.closePermission,
    waitForSettings: controller.waitForSettings,
    requestPermission: controller.requestPermission,
    recheckPermission: controller.recheckPermission.bind(controller),
  };
}
