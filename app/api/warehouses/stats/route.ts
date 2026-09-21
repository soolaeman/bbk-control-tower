import { NextRequest, NextResponse } from 'next/server';
import { getTursoClient } from '@/lib/repositories/turso-inventory-repository';
import { auth } from '@/auth';
import { WAREHOUSE_14_HUBS, formatCleanProductUrl } from '@/lib/repositories/warehouse-utils';
import { WarehouseCode } from '@/lib/types/inventory';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.role) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const client = getTursoClient();

    // 1. Hub breakdown aggregation query directly on Turso SQLite
    const hubSql = `
      SELECT 
        COALESCE(UPPER(asal_gudang), 'GK') as hubCode,
        COUNT(*) as totalUnits,
        SUM(CASE WHEN status_unit IN ('READY', 'AVAILABLE') THEN 1 ELSE 0 END) as availableUnits,
        SUM(CASE WHEN status_unit = 'SOLD' THEN 1 ELSE 0 END) as soldUnits,
        SUM(CASE WHEN status_unit IN ('READY', 'AVAILABLE') THEN COALESCE(harga_modal, 0) ELSE 0 END) as totalCapital,
        SUM(CASE WHEN status_unit IN ('READY', 'AVAILABLE') THEN COALESCE(harga_buka_wa, harga_modal, 0) ELSE 0 END) as totalEstimatedSales,
        SUM(CASE WHEN status_unit IN ('READY', 'AVAILABLE') AND (julianday('now') - julianday(COALESCE(tanggal_masuk, 'now'))) < 30 THEN 1 ELSE 0 END) as freshCount,
        SUM(CASE WHEN status_unit IN ('READY', 'AVAILABLE') AND (julianday('now') - julianday(COALESCE(tanggal_masuk, 'now'))) >= 30 AND (julianday('now') - julianday(COALESCE(tanggal_masuk, 'now'))) < 60 THEN 1 ELSE 0 END) as normalCount,
        SUM(CASE WHEN status_unit IN ('READY', 'AVAILABLE') AND (julianday('now') - julianday(COALESCE(tanggal_masuk, 'now'))) >= 60 AND (julianday('now') - julianday(COALESCE(tanggal_masuk, 'now'))) < 90 THEN 1 ELSE 0 END) as warningCount,
        SUM(CASE WHEN status_unit IN ('READY', 'AVAILABLE') AND (julianday('now') - julianday(COALESCE(tanggal_masuk, 'now'))) >= 90 THEN 1 ELSE 0 END) as deadStockCount,
        ROUND(AVG(CASE WHEN status_unit = 'SOLD' AND tanggal_terjual IS NOT NULL AND tanggal_masuk IS NOT NULL THEN (julianday(tanggal_terjual) - julianday(tanggal_masuk)) ELSE NULL END), 1) as avgTurnoverDays
      FROM products
      GROUP BY hubCode
      ORDER BY totalUnits DESC;
    `;

    // 2. Deadstock items query (Top 60 oldest available units for drilldown)
    const deadstockSql = `
      SELECT 
        p.sku, p.title, p.category_slug, p.status_unit, p.lokasi_unit, p.kondisi_unit,
        p.featured_image, p.tanggal_masuk, p.asal_gudang, p.harga_modal, p.harga_buka_wa,
        p.link_telegram, p.link_unit,
        CAST(julianday('now') - julianday(COALESCE(p.tanggal_masuk, 'now')) AS INTEGER) as age_days
      FROM products p
      WHERE p.status_unit IN ('READY', 'AVAILABLE')
      ORDER BY age_days DESC
      LIMIT 60;
    `;

    const [hubResult, deadstockResult] = await Promise.all([
      client.execute(hubSql),
      client.execute(deadstockSql),
    ]);

    // Build lookup map from DB rows
    const dbHubMap = new Map<string, any>();
    for (const r of hubResult.rows) {
      dbHubMap.set(String(r.hubCode || '').toUpperCase(), r);
    }

    // Map against canonical 14 hubs
    const hubs = WAREHOUSE_14_HUBS.map((hub) => {
      const codeUpper = hub.code.toUpperCase();
      const isInternalHQ = hub.code === 'BK';
      const dbRow = dbHubMap.get(codeUpper);

      const totalUnits = dbRow ? Number(dbRow.totalUnits) || 0 : 0;
      const availableUnits = dbRow ? Number(dbRow.availableUnits) || 0 : 0;
      const soldUnits = dbRow ? Number(dbRow.soldUnits) || 0 : 0;
      const totalCapital = dbRow ? Number(dbRow.totalCapital) || 0 : 0;
      const totalEstimatedSales = dbRow ? Number(dbRow.totalEstimatedSales) || 0 : 0;
      const freshCount = dbRow ? Number(dbRow.freshCount) || 0 : 0;
      const normalCount = dbRow ? Number(dbRow.normalCount) || 0 : 0;
      const warningCount = dbRow ? Number(dbRow.warningCount) || 0 : 0;
      const deadStockCount = dbRow ? Number(dbRow.deadStockCount) || 0 : 0;
      const avgTurnoverDays = dbRow && dbRow.avgTurnoverDays !== null && dbRow.avgTurnoverDays !== undefined
        ? Number(dbRow.avgTurnoverDays)
        : (isInternalHQ ? 14 : 35);

      return {
        code: hub.code as WarehouseCode,
        name: hub.name,
        partnerName: hub.partnerName,
        hubLocation: hub.hubLocation,
        hubGroup: hub.hubGroup,
        isInternalHQ,
        totalUnits,
        availableUnits,
        soldUnits,
        totalCapital,
        totalEstimatedSales,
        avgTurnoverDays,
        freshCount,
        normalCount,
        warningCount,
        deadStockCount,
      };
    });

    // Compute high-level global Pareto KPIs
    let totalUnits = 0;
    let totalAvailable = 0;
    let totalSold = 0;
    let totalCapital = 0;
    let totalEstimatedSales = 0;
    let totalDeadStock = 0;
    let bestVelocityHub = 'GK (Griya Kitchen)';
    let minTurnover = 999;

    hubs.forEach((h) => {
      totalUnits += h.totalUnits;
      totalAvailable += h.availableUnits;
      totalSold += h.soldUnits;
      totalCapital += h.totalCapital;
      totalEstimatedSales += h.totalEstimatedSales;
      totalDeadStock += h.deadStockCount;
      if (h.soldUnits > 5 && h.avgTurnoverDays < minTurnover) {
        minTurnover = h.avgTurnoverDays;
        bestVelocityHub = `${h.code} (${h.partnerName})`;
      }
    });

    const globalStats = {
      totalUnits,
      totalAvailable,
      totalSold,
      totalCapital,
      totalEstimatedSales,
      totalDeadStock,
      bestVelocityHub: minTurnover === 999 ? 'GK (Griya Kitchen)' : bestVelocityHub,
      minTurnover: minTurnover === 999 ? 21 : minTurnover,
    };

    // Format deadstock items for frontend consumption
    const deadStockItems = deadstockResult.rows.map((row: any) => ({
      SKU: String(row.sku || ''),
      PRODUCT_TITLE: String(row.title || ''),
      CATEGORY_SLUG: String(row.category_slug || ''),
      STATUS_UNIT: String(row.status_unit || 'READY'),
      LOKASI_UNIT: String(row.lokasi_unit || ''),
      KONDISI_UNIT: String(row.kondisi_unit || 'Bekas'),
      FEATURED_IMAGE: row.featured_image ? String(row.featured_image) : null,
      TANGGAL_MASUK: String(row.tanggal_masuk || ''),
      asal_gudang: String(row.asal_gudang || ''),
      HARGA_MODAL: row.harga_modal ? Number(row.harga_modal) : 0,
      HARGA_BUKA_WA: row.harga_buka_wa ? Number(row.harga_buka_wa) : 0,
      LINK_TELEGRAM: row.link_telegram ? String(row.link_telegram) : null,
      LINK_UNIT: formatCleanProductUrl(String(row.title || ''), row.link_unit ? String(row.link_unit) : undefined),
      age_days: Number(row.age_days) || 0,
    }));

    return NextResponse.json({
      success: true,
      globalStats,
      hubs,
      deadStockItems,
    });
  } catch (error: any) {
    console.error('Error fetching warehouse stats from Turso:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch warehouse statistics' },
      { status: 500 }
    );
  }
}
