import { NextRequest, NextResponse } from 'next/server';
import {
  getPersistentAuditState,
  savePersistentAuditState,
  SoldNotice,
} from '@/lib/repositories/audit-repository';
import { updateGoogleSheetsTelegramAudit } from '@/lib/repositories/google-sheets-inventory';
import {
  addPendingSoldReport,
  getPendingSoldReports,
  removePendingSoldReport,
} from '@/lib/repositories/sold-reports-repository';

import {
  getTursoTelegramSoldRadarCandidates,
  dismissSoldRadarCandidate,
  getTursoClient,
} from '@/lib/repositories/turso-inventory-repository';

export type { SoldNotice };

export async function GET() {
  const [state, sheetReports, radarCandidates] = await Promise.all([
    getPersistentAuditState(),
    getPendingSoldReports().catch(() => []),
    getTursoTelegramSoldRadarCandidates().catch(() => []),
  ]);

  // Convert sheet reports directly from LAPORAN_TERJUAL sheet
  const mappedNotices: SoldNotice[] = sheetReports.map((r) => ({
    id: r.id || `report_${r.sku}`,
    sku: r.sku,
    dealPrice: r.dealPrice || undefined,
    notes: r.notes ? (r.lokasiGudang ? `[${r.lokasiGudang}] ${r.notes}` : r.notes) : 'Deal via WhatsApp Sales',
    reportedAt: r.timestamp || new Date().toISOString(),
    reportedBy: r.reportedBy || 'Sales',
  }));

  // Combine sheet reports and radar candidates
  const allNotices: SoldNotice[] = [...mappedNotices, ...radarCandidates];

  return NextResponse.json({
    timestamps: state.timestamps,
    activeSku: state.activeSku,
    soldNotices: allNotices,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, sku, timestamp, batch, activeSku, dealPrice, notes, reportedBy, noticeId, productTitle, lokasiGudang } = body;

    const currentState = await getPersistentAuditState();

    // 1. Report Sold Notice from Sales to Master Inventory (Appends to LAPORAN_TERJUAL Sheet)
    if (action === 'REPORT_SOLD_NOTICE' && sku) {
      // Append row to LAPORAN_TERJUAL Google Sheets tab
      await addPendingSoldReport({
        sku,
        productTitle,
        lokasiGudang,
        dealPrice: dealPrice ? Number(dealPrice) : undefined,
        reportedBy: reportedBy || 'Sales Desk',
        notes,
      }).catch((err) => console.warn('Could not add to LAPORAN_TERJUAL sheet:', err));

      const newNotice: SoldNotice = {
        id: `notice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sku,
        dealPrice: dealPrice ? Number(dealPrice) : undefined,
        notes: notes || 'Deal via WhatsApp Sales',
        reportedAt: new Date().toISOString(),
        reportedBy: reportedBy || 'Sales',
      };

      const updatedNotices = (currentState.soldNotices || []).filter((n) => n.sku !== sku);
      updatedNotices.unshift(newNotice);

      const savedState = await savePersistentAuditState({ soldNotices: updatedNotices });

      return NextResponse.json({
        success: true,
        message: `Sold notice for ${sku} appended to LAPORAN_TERJUAL sheet tab`,
        soldNotices: savedState.soldNotices,
      });
    }

    // 2. Dismiss Sold Notice (Removes row from LAPORAN_TERJUAL Sheet)
    if (action === 'DISMISS_SOLD_NOTICE') {
      let targetSku = sku;
      let updatedNotices = currentState.soldNotices || [];
      if (noticeId) {
        const found = updatedNotices.find((n) => n.id === noticeId);
        if (found) targetSku = found.sku;
        updatedNotices = updatedNotices.filter((n) => n.id !== noticeId);
      } else if (sku) {
        updatedNotices = updatedNotices.filter((n) => n.sku !== sku);
      }

      if (targetSku) {
        dismissSoldRadarCandidate(targetSku);
        await removePendingSoldReport(targetSku).catch((err) =>
          console.warn(`Could not delete row from LAPORAN_TERJUAL for SKU ${targetSku}:`, err)
        );
      }

      const savedState = await savePersistentAuditState({ soldNotices: updatedNotices });
      return NextResponse.json({
        success: true,
        soldNotices: savedState.soldNotices,
      });
    }

    // 3. Timestamps & Active SKU sync
    const newTimestamps: Record<string, string> = {};
    if (batch && typeof batch === 'object') {
      Object.assign(newTimestamps, batch);
    }
    if (sku && timestamp) {
      newTimestamps[sku] = timestamp;
      // Persist directly to Turso SQLite SSOT products.last_checked_telegram
      const client = getTursoClient();
      client.execute({
        sql: "UPDATE products SET last_checked_telegram = ? WHERE UPPER(sku) = ?",
        args: [timestamp, sku.toUpperCase()],
      }).catch((err) => console.warn(`Could not update Turso last_checked_telegram for SKU ${sku}:`, err));
    }

    const savedState = await savePersistentAuditState({
      timestamps: Object.keys(newTimestamps).length > 0 ? newTimestamps : undefined,
      activeSku: activeSku !== undefined ? activeSku : undefined,
    });

    return NextResponse.json({
      success: true,
      timestamps: savedState.timestamps,
      activeSku: savedState.activeSku,
      soldNotices: savedState.soldNotices,
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
