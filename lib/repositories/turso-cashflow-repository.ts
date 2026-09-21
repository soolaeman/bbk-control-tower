import { getTursoClient } from './turso-inventory-repository';
import type { CashflowEntry } from '@/lib/types/cashflow';

function mapRowToCashflow(r: Record<string, any>): CashflowEntry {
  return {
    id: String(r.id),
    tanggal: String(r.tanggal || ''),
    jenisKas: (r.jenis_kas as any) || 'PENGELUARAN',
    kategori: String(r.kategori || 'BIAYA LAINNYA'),
    nominal: Number(r.nominal || 0),
    keterangan: String(r.deskripsi || ''),
    referensiSku: r.nomor_referensi ? String(r.nomor_referensi) : undefined,
    dicatatOleh: String(r.pic || 'OPERATOR'),
  };
}

export async function fetchTursoCashflowEntries(): Promise<CashflowEntry[]> {
  try {
    const client = getTursoClient();
    const res = await client.execute(`
      SELECT * FROM cashflow_transactions
      ORDER BY tanggal DESC, created_at DESC
    `);
    return res.rows.map(mapRowToCashflow);
  } catch (err) {
    console.error('Failed to fetch cashflow entries from Turso:', err);
    return [];
  }
}

export async function saveTursoCashflowEntry(entry: Omit<CashflowEntry, 'id'> & { id?: string }): Promise<CashflowEntry> {
  const client = getTursoClient();
  const id = entry.id || `csh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  await client.execute({
    sql: `
      INSERT INTO cashflow_transactions (
        id, tanggal, jenis_kas, kategori, deskripsi, nominal, kantong, pic, nomor_referensi, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tanggal = excluded.tanggal,
        jenis_kas = excluded.jenis_kas,
        kategori = excluded.kategori,
        deskripsi = excluded.deskripsi,
        nominal = excluded.nominal,
        pic = excluded.pic,
        nomor_referensi = excluded.nomor_referensi,
        updated_at = excluded.updated_at
    `,
    args: [
      id,
      entry.tanggal,
      entry.jenisKas,
      entry.kategori,
      entry.keterangan || '',
      entry.nominal || 0,
      'Kas BBKitchen',
      entry.dicatatOleh || 'OPERATOR',
      entry.referensiSku || null,
      now,
      now,
    ],
  });

  return {
    id,
    tanggal: entry.tanggal,
    jenisKas: entry.jenisKas,
    kategori: entry.kategori,
    nominal: entry.nominal,
    keterangan: entry.keterangan,
    referensiSku: entry.referensiSku,
    dicatatOleh: entry.dicatatOleh || 'OPERATOR',
  };
}

export async function deleteTursoCashflowEntry(id: string): Promise<boolean> {
  try {
    const client = getTursoClient();
    await client.execute({
      sql: 'DELETE FROM cashflow_transactions WHERE id = ?',
      args: [id],
    });
    return true;
  } catch (err) {
    console.error('Failed to delete cashflow entry from Turso:', err);
    return false;
  }
}
