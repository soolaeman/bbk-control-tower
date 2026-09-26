import { NextRequest, NextResponse } from 'next/server';
import { getTursoClient } from '@/lib/repositories/turso-inventory-repository';
import { auth } from '@/auth';
import { UserRole } from '@/lib/types/auth';

export async function GET(request: NextRequest) {
  try {
    const client = getTursoClient();

    // Ensure sold_signals table exists
    await client.execute(`
      CREATE TABLE IF NOT EXISTS sold_signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT NOT NULL,
        source_group TEXT,
        sensor_type TEXT NOT NULL,
        confidence_score REAL DEFAULT 0.95,
        signal_details TEXT,
        telegram_message_id TEXT,
        detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        review_status TEXT DEFAULT 'PENDING_REVIEW',
        reviewed_at DATETIME,
        reviewed_by TEXT
      )
    `);

    const result = await client.execute(`
      SELECT 
        s.id,
        s.sku,
        s.source_group,
        s.sensor_type,
        s.confidence_score,
        s.signal_details,
        s.telegram_message_id,
        s.detected_at,
        s.review_status,
        p.title,
        p.lokasi_unit,
        p.harga_buka_wa,
        p.photo_urls,
        p.link_telegram,
        p.status_unit
      FROM sold_signals s
      LEFT JOIN products p ON s.sku = p.sku
      ORDER BY s.detected_at DESC
      LIMIT 100
    `);

    const signals = result.rows.map((row) => ({
      id: Number(row.id),
      sku: String(row.sku || ''),
      sourceGroup: String(row.source_group || ''),
      sensorType: String(row.sensor_type || ''),
      confidenceScore: Number(row.confidence_score || 0.95),
      signalDetails: String(row.signal_details || ''),
      telegramMessageId: String(row.telegram_message_id || ''),
      detectedAt: String(row.detected_at || ''),
      reviewStatus: String(row.review_status || 'PENDING_REVIEW'),
      title: String(row.title || 'Unknown Product'),
      lokasiUnit: String(row.lokasi_unit || '-'),
      hargaBukaWa: Number(row.harga_buka_wa || 0),
      photoUrls: String(row.photo_urls || ''),
      linkTelegram: String(row.link_telegram || ''),
      statusUnit: String(row.status_unit || 'AVAILABLE'),
    }));

    return NextResponse.json({ signals });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sold signals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, signalId, sku } = body;

    const session = await auth();
    const reviewer = session?.user?.name || 'Control Tower Operator';

    const client = getTursoClient();
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    if (action === 'APPROVE') {
      // 1. Mark signal as approved
      await client.execute({
        sql: `UPDATE sold_signals SET review_status = 'APPROVED', reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
        args: [nowStr, reviewer, signalId],
      });

      // 2. Mark product as SOLD Non-BBK
      if (sku) {
        await client.execute({
          sql: `
            UPDATE products 
            SET status_unit = 'SOLD', tanggal_terjual = ?, harga_deal_wa = NULL, is_dirty = 1, updated_at = ?
            WHERE sku = ?
          `,
          args: [nowStr, nowStr, sku],
        });
        await client.execute({
          sql: `UPDATE raw_pipeline SET status_unit = 'SOLD', status_pipeline = 'PROCESSED' WHERE kode_unit = ?`,
          args: [sku],
        });
      }

      return NextResponse.json({ success: true, message: `Unit ${sku} berhasil ditandai SOLD (Non-BBK).` });
    } else if (action === 'REJECT') {
      await client.execute({
        sql: `UPDATE sold_signals SET review_status = 'REJECTED', reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
        args: [nowStr, reviewer, signalId],
      });
      if (sku) {
        await client.execute({
          sql: `UPDATE raw_pipeline SET status_pipeline = 'PROCESSED' WHERE kode_unit = ?`,
          args: [sku],
        });
      }
      return NextResponse.json({ success: true, message: `Sinyal SOLD ${sku} diabaikan. Unit tetap AVAILABLE.` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to process signal' },
      { status: 500 }
    );
  }
}
