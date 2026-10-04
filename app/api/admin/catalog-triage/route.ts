import { NextRequest, NextResponse } from 'next/server';
import { getSqliteClient } from '@/lib/repositories/sqlite-inventory-repository';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'ALL';
    const search = searchParams.get('search') || '';
    const page = Number(searchParams.get('page')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 50;
    const offset = (page - 1) * pageSize;

    const client = getSqliteClient();

    // Query statistics
    const statsRes = await client.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN photo_desync_flag = 1 OR ai_vision_status = 'DESYNC_MISMATCH' THEN 1 ELSE 0 END) as desync_count,
        SUM(CASE WHEN status_pipeline = 'QUARANTINE' THEN 1 ELSE 0 END) as quarantine_count,
        SUM(CASE WHEN ai_enrichment_status = 'COMPLETED' AND (photo_desync_flag = 0 OR photo_desync_flag IS NULL) THEN 1 ELSE 0 END) as clean_count
      FROM products
    `);

    const stats = statsRes.rows[0] || { total: 0, desync_count: 0, quarantine_count: 0, clean_count: 0 };

    let whereClause = '1=1';
    const params: any[] = [];

    if (filter === 'DESYNC') {
      whereClause += ' AND (photo_desync_flag = 1 OR ai_vision_status = "DESYNC_MISMATCH")';
    } else if (filter === 'QUARANTINE') {
      whereClause += ' AND status_pipeline = "QUARANTINE"';
    } else if (filter === 'NEEDS_REVIEW') {
      whereClause += ' AND (photo_desync_flag = 1 OR title NOT LIKE "%x%" AND title NOT LIKE "%liter%" AND title NOT LIKE "%pintu%" AND title NOT LIKE "%tray%" AND title NOT LIKE "%tungku%")';
    } else if (filter === 'CLEAN') {
      whereClause += ' AND (photo_desync_flag = 0 OR photo_desync_flag IS NULL) AND status_pipeline != "QUARANTINE"';
    }

    if (search) {
      whereClause += ' AND (sku LIKE ? OR title LIKE ? OR category_slug LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countRes = await client.execute({
      sql: `SELECT COUNT(*) as total FROM products WHERE ${whereClause}`,
      args: params
    });
    const filteredTotal = Number(countRes.rows[0]?.total || 0);

    const queryRes = await client.execute({
      sql: `
        SELECT 
          sku, title, category_slug, status_unit, status_pipeline, lokasi_unit,
          kondisi_unit, harga_modal, harga_buka_wa, harga_display_low, harga_display_high,
          photo_urls, featured_image, link_telegram, slug, ai_vision_status,
          vision_kategori_slug, vision_fitur_utama, vision_kondisi_persen, vision_catatan,
          photo_desync_flag, reconciliation_log, updated_at
        FROM products 
        WHERE ${whereClause}
        ORDER BY CAST(SUBSTR(sku, 4) AS INTEGER) ASC
        LIMIT ? OFFSET ?
      `,
      args: [...params, pageSize, offset]
    });

    return NextResponse.json({
      items: queryRes.rows,
      total: filteredTotal,
      stats: {
        total: Number(stats.total || 0),
        clean: Number(stats.clean_count || 0),
        desync: Number(stats.desync_count || 0),
        quarantine: Number(stats.quarantine_count || 0),
        needsReview: Math.max(0, Number(stats.total || 0) - Number(stats.clean_count || 0))
      },
      page,
      pageSize,
      totalPages: Math.ceil(filteredTotal / pageSize)
    });
  } catch (error: any) {
    console.error('Catalog Triage API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to query catalog triage' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    // Allow action
    const body = await request.json();
    const { action, sku, updates, skus } = body;

    const client = getSqliteClient();

    if (action === 'UPDATE_SINGLE' && sku) {
      const { title, category_slug, kondisi_unit, status_unit, status_pipeline, harga_buka_wa, harga_display_low, harga_display_high } = updates;
      await client.execute({
        sql: `
          UPDATE products
          SET title = COALESCE(?, title),
              category_slug = COALESCE(?, category_slug),
              kondisi_unit = COALESCE(?, kondisi_unit),
              status_unit = COALESCE(?, status_unit),
              status_pipeline = COALESCE(?, status_pipeline),
              harga_buka_wa = COALESCE(?, harga_buka_wa),
              harga_display_low = COALESCE(?, harga_display_low),
              harga_display_high = COALESCE(?, harga_display_high),
              photo_desync_flag = 0,
              ai_vision_status = 'MANUAL_VERIFIED',
              updated_at = datetime('now', 'localtime')
          WHERE sku = ?
        `,
        args: [title, category_slug, kondisi_unit, status_unit, status_pipeline, harga_buka_wa, harga_display_low, harga_display_high, sku]
      });
      return NextResponse.json({ success: true, message: `SKU ${sku} berhasil diperbarui!` });
    }

    if (action === 'ACC_WHITELIST' && sku) {
      await client.execute({
        sql: `
          UPDATE products
          SET photo_desync_flag = 0,
              ai_vision_status = 'APPROVED_CLEAN',
              status_pipeline = 'READY',
              reconciliation_log = 'ACC_MANUAL_APPROVED',
              updated_at = datetime('now', 'localtime')
          WHERE sku = ?
        `,
        args: [sku]
      });
      return NextResponse.json({ success: true, message: `SKU ${sku} berhasil di-ACC!` });
    }

    if (action === 'QUARANTINE' && sku) {
      await client.execute({
        sql: `
          UPDATE products
          SET status_pipeline = 'QUARANTINE',
              reconciliation_log = 'QUARANTINED_NON_KITCHEN',
              updated_at = datetime('now', 'localtime')
          WHERE sku = ?
        `,
        args: [sku]
      });
      return NextResponse.json({ success: true, message: `SKU ${sku} berhasil dikarantina/disembunyikan dari etalase!` });
    }

    if (action === 'BATCH_ACC' && Array.isArray(skus)) {
      for (const s of skus) {
        await client.execute({
          sql: `
            UPDATE products
            SET photo_desync_flag = 0,
                ai_vision_status = 'APPROVED_CLEAN',
                status_pipeline = 'READY',
                updated_at = datetime('now', 'localtime')
            WHERE sku = ?
          `,
          args: [s]
        });
      }
      return NextResponse.json({ success: true, count: skus.length });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Catalog Triage Update Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update catalog triage' }, { status: 500 });
  }
}
