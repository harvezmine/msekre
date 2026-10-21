import { Directory } from 'expo-file-system';
import { clearDocumentCache, downloadDocument } from '@/files/documents';

const deleted = () => (Directory as unknown as { deleted: string[] }).deleted;

beforeEach(() => {
  deleted().length = 0;
});

describe('nama berkas dan folder yang aman', () => {
  test('.. dan nama dengan pemisah jalur tidak bisa keluar dari folder berkas', async () => {
    const doc = await downloadDocument({ kind: 'sampleFile' }, '..', '../../etc/passwd', 'text/plain');
    // Folder dan nama berkas tidak mengandung `..` maupun garis miring dari masukan.
    expect(doc.uri).not.toContain('..');
    expect(doc.uri).toMatch(/^file:\/\/\/cache\/berkas\/berkas\/[^/]+$/);
    const nested = await downloadDocument({ kind: 'sampleFile' }, 'a/../b', 'x.pdf', 'application/pdf');
    expect(nested.uri).not.toContain('..');
    expect(nested.uri).toMatch(/^file:\/\/\/cache\/berkas\/a_\._b\/[^/]+$/);
    const dots = await downloadDocument({ kind: 'sampleFile' }, 'id1', '.', 'text/plain');
    expect(dots.uri).toMatch(/\/id1\/berkas \(contoh\)\.txt$/);
  });
});

describe('cache berkas', () => {
  test('clearDocumentCache membuang folder berkas; gagal membuang tidak dilempar', () => {
    clearDocumentCache();
    expect(deleted()).toEqual(['file:///cache/berkas']);
  });
});
