import { NextRequest, NextResponse } from 'next/server';
import { getTursoClient } from '@/lib/repositories/turso-inventory-repository';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.role) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel') || 'ALL'; // 'ALL' | 'SALES_BBK' | 'THIRD_PARTY'
    const category = searchParams.get('category') || 'ALL';
    const warehouse = searchParams.get('warehouse') || 'ALL';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    const client = getTursoClient();

    // 1. Build WHERE conditions for products
    const productConditions: string[] = ["(status_pipeline != 'ARCHIVED' OR status_pipeline IS NULL)"];
    const productArgs: any[] = [];

    if (category && category !== 'ALL') {
      productConditions.push("(category_slug = ? OR category_slug LIKE ?)");
      productArgs.push(category, `%${category}%`);
    }

    if (warehouse && warehouse !== 'ALL') {
      productConditions.push("(UPPER(asal_gudang) = ? OR sku LIKE ?)");
      productArgs.push(warehouse.toUpperCase(), `%${warehouse.toUpperCase()}%`);
    }

    if (startDate) {
      productConditions.push("(date(COALESCE(tanggal_terjual, tanggal_masuk)) >= date(?))");
      productArgs.push(startDate);
    }
    if (endDate) {
      productConditions.push("(date(COALESCE(tanggal_terjual, tanggal_masuk)) <= date(?))");
      productArgs.push(endDate);
    }

    const productWhere = productConditions.join(' AND ');

    // 2. Main KPI Aggregation Query
    const mainSql = `
      SELECT 
        COUNT(*) as totalUnits,
        SUM(CASE WHEN status_unit = 'SOLD' THEN 1 ELSE 0 END) as soldCount,
        SUM(CASE WHEN status_unit = 'SOLD' THEN COALESCE(harga_deal_wa, harga_buka_wa, 0) ELSE 0 END) as soldValuation,
        SUM(CASE WHEN status_unit IN ('READY', 'AVAILABLE') THEN 1 ELSE 0 END) as readyCount,
        SUM(CASE WHEN status_unit IN ('READY', 'AVAILABLE') THEN COALESCE(harga_buka_wa, harga_modal, 0) ELSE 0 END) as readyValuation,
        SUM(CASE WHEN status_unit IN ('READY', 'AVAILABLE') THEN COALESCE(harga_modal, 0) ELSE 0 END) as readyCapitalModal
      FROM products
      WHERE ${productWhere};
    `;

    // 3. Hub Breakdown Aggregation Query
    const hubSql = `
      SELECT 
        COALESCE(UPPER(asal_gudang), 'GK') as hubCode,
        COUNT(*) as totalUnits,
        SUM(CASE WHEN status_unit IN ('READY', 'AVAILABLE') THEN 1 ELSE 0 END) as readyUnits,
        SUM(CASE WHEN status_unit = 'SOLD' THEN 1 ELSE 0 END) as soldUnits,
        SUM(CASE WHEN status_unit = 'SOLD' THEN COALESCE(harga_deal_wa, harga_buka_wa, 0) ELSE 0 END) as soldValuation,
        SUM(CASE WHEN status_unit IN ('READY', 'AVAILABLE') THEN COALESCE(harga_buka_wa, harga_modal, 0) ELSE 0 END) as readyValuation,
        SUM(CASE WHEN status_unit IN ('READY', 'AVAILABLE') THEN COALESCE(harga_modal, 0) ELSE 0 END) as modalSum
      FROM products
      WHERE ${productWhere}
      GROUP BY hubCode
      ORDER BY totalUnits DESC;
    `;

    // 4. Invoices Direct Query (Direct BBKitchen deals from Bank Jago)
    const invoiceConditions: string[] = ["status IN ('PAID', 'DP_PAID')"];
    const invoiceArgs: any[] = [];

    if (startDate) {
      invoiceConditions.push("date(issue_date) >= date(?)");
      invoiceArgs.push(startDate);
    }
    if (endDate) {
      invoiceConditions.push("date(issue_date) <= date(?)");
      invoiceArgs.push(endDate);
    }

    const invoiceWhere = invoiceConditions.join(' AND ');
    const invoiceSql = `
      SELECT 
        COUNT(*) as directPaidDealsCount,
        SUM(COALESCE(total_amount, 0)) as directInvoicedRevenue,
        SUM(COALESCE(dp_amount, 0) + CASE WHEN status = 'PAID' THEN COALESCE(remaining_balance, 0) ELSE 0 END) as directCashIn
      FROM invoices
      WHERE ${invoiceWhere};
    `;

    // 5. Monthly Timeline Breakdown
    const timelineSql = `
      SELECT 
        strftime('%Y-%m', date(COALESCE(tanggal_terjual, tanggal_masuk))) as periodMonth,
        COUNT(*) as monthlyDeals,
        SUM(COALESCE(harga_deal_wa, harga_buka_wa, 0)) as monthlyRevenue
      FROM products
      WHERE status_unit = 'SOLD' AND ${productWhere}
      GROUP BY periodMonth
      ORDER BY periodMonth DESC
      LIMIT 12;
    `;

    // Execute in parallel
    const [mainRes, hubRes, invRes, timelineRes] = await Promise.all([
      client.execute({ sql: mainSql, args: productArgs }),
      client.execute({ sql: hubSql, args: productArgs }),
      client.execute({ sql: invoiceSql, args: invoiceArgs }),
      client.execute({ sql: timelineSql, args: productArgs }),
    ]);

    const main = mainRes.rows[0] || {};
    const inv = invRes.rows[0] || {};

    const totalUnits = Number(main.totalUnits || 0);
    const soldCount = Number(main.soldCount || 0);
    const soldValuation = Number(main.soldValuation || 0);
    const readyCount = Number(main.readyCount || 0);
    const readyValuation = Number(main.readyValuation || 0);
    const readyCapitalModal = Number(main.readyCapitalModal || 0);

    const directInvoicedRevenue = Number(inv.directInvoicedRevenue || 0);
    const directCashIn = Number(inv.directCashIn || 0);
    const directPaidDealsCount = Number(inv.directPaidDealsCount || 0);

    // Formulate response based on active channel filter
    const isDirectChannel = channel === 'SALES_BBK';
    const effectiveRevenue = isDirectChannel ? directInvoicedRevenue : soldValuation;
    const effectiveDeals = isDirectChannel ? directPaidDealsCount : soldCount;
    const effectiveProfit = isDirectChannel ? Math.round(directInvoicedRevenue * 0.25) : 0; // Or from non_sku_transactions / direct invoice cost
    const grossMarginPct = effectiveRevenue > 0 ? Math.round((effectiveProfit / effectiveRevenue) * 100) : 0;

    const hubBreakdown = hubRes.rows.map((r: any) => ({
      hubCode: String(r.hubCode || 'GK'),
      totalUnits: Number(r.totalUnits || 0),
      readyUnits: Number(r.readyUnits || 0),
      soldUnits: Number(r.soldUnits || 0),
      soldValuation: Number(r.soldValuation || 0),
      readyValuation: Number(r.readyValuation || 0),
      modalSum: Number(r.modalSum || 0),
    }));

    const timeline = timelineRes.rows.map((r: any) => ({
      month: String(r.periodMonth || ''),
      deals: Number(r.monthlyDeals || 0),
      revenue: Number(r.monthlyRevenue || 0),
    }));

    return NextResponse.json({
      success: true,
      channel,
      kpis: {
        totalUnits,
        soldCount,
        soldValuation,
        readyCount,
        readyValuation,
        readyCapitalModal,
        effectiveRevenue,
        effectiveDeals,
        effectiveProfit,
        grossMarginPct,
        directInvoicedRevenue,
        directCashIn,
        directPaidDealsCount,
      },
      hubBreakdown,
      timeline,
      computedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Failed to compute SQLite overview stats:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Database aggregation error' },
      { status: 500 }
    );
  }
}
