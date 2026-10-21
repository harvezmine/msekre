import * as WebBrowser from 'expo-web-browser';

/** Hasil membuka halaman masuk resmi: kembali ke aplikasi dengan alamat, atau ditutup tanpa selesai. */
export type AuthResult = { type: 'success'; url: string } | { type: 'cancel' };

/** Membuka halaman masuk resmi (satu tab dalam aplikasi) sampai kembali ke `redirectUrl` atau ditutup. */
export type OpenAuth = (url: string, redirectUrl: string) => Promise<AuthResult>;

/**
 * Pembuka bawaan: `expo-web-browser` `openAuthSessionAsync`. Di Android halaman dibuka di Chrome Custom Tab dan hasilnya
 * `success` bila alamat kembali tertangkap, selain itu `cancel` atau `dismiss`.
 */
export const openAuthBrowser: OpenAuth = async (url, redirectUrl) => {
  const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
  return result.type === 'success' ? { type: 'success', url: result.url } : { type: 'cancel' };
};
