/** Sambungan yang simpul barunya sudah dianimasikan di layar Tersambung, supaya tidak dua kali. Dibersihkan saat alur dimulai lagi. */
const animated = new Set<string>();

export const joinAnimated = (id: string) => animated.has(id);
export const markJoinAnimated = (id: string) => void animated.add(id);
export const clearJoinAnimated = (id: string) => void animated.delete(id);
