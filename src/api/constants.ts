/** Batas suhu AC yang bisa diatur dari aplikasi. */
export const AC_MIN = 16;
export const AC_MAX = 30;

/** Panjang PIN perangkat. */
export const PIN_LENGTH = 6;

/** Merek di "Tambah perangkat": monogram dan nama. */
export const BRANDS = [
  { m: 'LG', n: 'LG' },
  { m: 'S', n: 'Samsung SmartThings' },
  { m: 'Hue', n: 'Philips Hue' },
  { m: 'A', n: 'Aqara' },
  { m: 'eW', n: 'eWeLink / Sonoff' },
  { m: 'I', n: 'Imou' },
  { m: 'EZ', n: 'EZVIZ' },
  { m: 'T', n: 'Tuya' },
  { m: 'HA', n: 'Home Assistant' },
] as const;
