import { router } from 'expo-router';

/** Buka chat di draf pesanan (dan pesannya bila diketahui). */
export function openDraft(draftId: string, messageId?: string) {
  router.push({ pathname: '/chat', params: messageId ? { draf: draftId, pesan: messageId } : { draf: draftId } });
}
