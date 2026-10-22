import { Component, type ReactNode } from 'react';
import { reportError } from '@/crash';

interface Props {
  /** Nama bagian untuk catatan kendala (log HP). */
  where: string;
  /** Pengganti saat bagian ini gagal digambar; `retry` mencoba menggambarnya lagi. */
  fallback: (retry: () => void) => ReactNode;
  children?: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Batas kesalahan: bagian yang gagal digambar diganti `fallback`, sisa layar tetap jalan, dan kendalanya dicatat
 * (src/crash.ts). Hanya menangkap kesalahan saat menggambar dan efek React; kesalahan di worklet utas UI dijaga di
 * worklet-nya sendiri.
 */
export class Boundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    reportError(this.props.where, error);
  }

  retry = (): void => {
    this.setState({ failed: false });
  };

  render(): ReactNode {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children;
  }
}
