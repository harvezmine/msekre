/** Remote virtual per perangkat (Fase R4). Tata letak dipilih `remoteKindOf`; semuanya memakai `RemoteFrame`. */
import type { ComponentType } from 'react';
import { AcRemote } from './AcRemote';
import { BasicRemote } from './BasicRemote';
import { BoxRemote } from './BoxRemote';
import { CameraRemote } from './CameraRemote';
import type { RemoteKind } from './caps';
import { CurtainRemote } from './CurtainRemote';
import { FanRemote } from './FanRemote';
import { LampRemote } from './LampRemote';
import { LockRemote } from './LockRemote';
import { PlugRemote } from './PlugRemote';
import { SensorRemote } from './SensorRemote';
import { SpeakerRemote } from './SpeakerRemote';
import { TvRemote } from './TvRemote';

export const REMOTES: Record<RemoteKind, ComponentType> = {
  ac: AcRemote,
  tv: TvRemote,
  speaker: SpeakerRemote,
  lamp: LampRemote,
  fan: FanRemote,
  plug: PlugRemote,
  curtain: CurtainRemote,
  lock: LockRemote,
  camera: CameraRemote,
  sensor: SensorRemote,
  box: BoxRemote,
  basic: BasicRemote,
};

export { capOf, capsOf, remoteKindOf, type RemoteKind } from './caps';
export { RemoteContext, useRemote, type RemoteApi } from './RemoteContext';
export { ASSUMED_TEXT } from './RemoteFrame';
