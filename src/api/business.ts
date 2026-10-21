import type { Business, BusinessSales } from './contract';

/** "naik 12% dari Senin lalu". */
export function changeText(s: Pick<BusinessSales, 'change' | 'down' | 'compareLabel'>): string {
  const pct = `${String(s.change).replace('.', ',')}%`;
  return `${s.down ? 'turun' : 'naik'} ${pct}${s.compareLabel ? ` dari ${s.compareLabel}` : ''}`;
}

/** "6 karton". */
export function stockLeft(s: { left: number; unit: string }): string {
  return `${s.left}${s.unit ? ` ${s.unit}` : ''}`;
}

/** Ada sesuatu untuk ditampilkan? Pengguna tanpa kasir atau rekening tersambung mendapat jawaban kosong. */
export function hasBusinessData(b: Business): boolean {
  return (
    b.sales.total > 0 ||
    b.series.length > 0 ||
    b.moneyIn.length > 0 ||
    b.lowStock.length > 0 ||
    b.orders.length > 0 ||
    b.report !== null
  );
}

const MIME: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  csv: 'text/csv',
};

/** Jenis berkas dari nama; laporan tidak membawa jenisnya sendiri. */
export function mimeOfName(name: string): string {
  return MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}
