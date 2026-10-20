import { useSyncExternalStore } from 'react';
import { useHomeControllerOptional } from './HomeProvider';
import type { HomeController, HomeState } from './homeController';

export interface HomeApi extends HomeState {
  /** Muat ulang ("Coba lagi"). */
  retry: HomeController['load'];
  /** Pilih tempat. `null` kalau berhasil, selain itu teks ramah untuk toast. */
  setPlace: HomeController['setPlace'];
  /** Hidupkan atau matikan perangkat dari kartu Rumah lewat server. `null` kalau berhasil, selain itu teks ramah. */
  controlDevice: HomeController['controlDevice'];
}

const NONE: HomeState = { home: null, ring: [], status: 'loading', error: null };
const noSubscribe = () => () => {};
const noState = () => NONE;
const noPlace = async () => null;

/**
 * Beranda untuk layar: dari pengendali bersama di {@link HomeProvider} (`GET /home`, event `home`). Sama di mode
 * `contoh` dan `server`. Di luar provider hasilnya kosong (`status: 'loading'`), jadi komponen kecil seperti
 * `PlaceButton` tetap bisa dipakai sendirian dan memakai cadangannya.
 */
export function useHome(): HomeApi {
  const controller = useHomeControllerOptional();
  const state = useSyncExternalStore(controller?.subscribe ?? noSubscribe, controller?.getState ?? noState);
  return {
    ...state,
    retry: controller?.load ?? (async () => {}),
    setPlace: controller?.setPlace ?? noPlace,
    controlDevice: controller?.controlDevice ?? noPlace,
  };
}
