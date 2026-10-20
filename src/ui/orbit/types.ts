import type { IconName } from '@/ui/icons';

export interface OrbitNode {
  key: string;
  icon: IconName;
  label: string;
  /** Tidak terjangkau: abu-abu, titik clay, garis putus-putus, dan tidak ikut aliran titik. */
  offline?: boolean;
}
