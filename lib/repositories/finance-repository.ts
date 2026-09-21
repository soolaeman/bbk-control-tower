import { Invoice, InvoiceItem, FinancialKPIs, ClosingDealItem, InvoiceStatus, NonSkuTransaction } from '@/lib/types/finance';
import { resolveLocationFromCode, resolveHubCode, parseToISODate } from './warehouse-utils';

import {
  fetchTursoInvoices,
  saveTursoInvoice,
  updateTursoInvoiceStatus as updateTursoStatus,
  deleteTursoInvoice as deleteTursoInv,
  fetchTursoWarranties,
  getTursoWarrantyByNumber,
  getTursoWarrantyByInvoice,
  saveTursoWarranty,
  fetchTursoDispatches,
  getTursoDispatchBySjNumber,
  getTursoDispatchByInvoice,
  saveTursoDispatch,
  unlockTursoDispatchAcceptance,
  saveTursoNonSkuTransaction,
  fetchTursoNonSkuTransactions,
} from './turso-finance-repository';
import { updateTursoStockStatus, fetchAllTursoMasterItems } from './turso-inventory-repository';
import type { WarrantyRecord, WarrantyItemRecord, DeliveryDispatchRecord } from '@/lib/types/finance';

// Clean Real Invoices store for BBKitchen (in-memory cache backed by Turso SQLite SSOT)
let cachedInvoices: Invoice[] = [];

export async function getInvoices(): Promise<Invoice[]> {
  try {
    const tursoInvoices = await fetchTursoInvoices();
    if (tursoInvoices && tursoInvoices.length > 0) {
      cachedInvoices = tursoInvoices;
      return cachedInvoices;
    }
  } catch (err) {
    console.warn('Turso invoices fetch warning:', err);
  }
  return [...cachedInvoices];
}

export async function createInvoice(invoiceData: Omit<Invoice, 'id'>): Promise<Invoice> {
  const newInvoice: Invoice = {
    ...invoiceData,
    id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };
  cachedInvoices.unshift(newInvoice);

  // Persist to Turso Edge Database SSOT
  await saveTursoInvoice(newInvoice).catch((e) =>
    console.warn('Turso invoice save warning:', e)
  );

  return newInvoice;
}

export async function updateInvoice(invoice: Invoice): Promise<Invoice> {
  const index = cachedInvoices.findIndex(
    (inv) => inv.id === invoice.id || inv.invoiceNumber === invoice.invoiceNumber
  );
  if (index !== -1) {
    cachedInvoices[index] = { ...invoice };
  } else {
    cachedInvoices.unshift(invoice);
  }

  // Persist full update to Turso Edge Database SSOT
  await saveTursoInvoice(invoice).catch((e) =>
    console.warn('Turso invoice update warning:', e)
  );

  return invoice;
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<boolean> {
  const index = cachedInvoices.findIndex((inv) => inv.id === id || inv.invoiceNumber === id);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (index !== -1) {
    const inv = cachedInvoices[index];
    inv.status = status;

    if (status === 'DP_PAID') {
      // Gate 4: Storage Tracker (Maksimal 7 hari free storage pasca booking/DP)
      const deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      inv.storageDeadline = deadline.toISOString().split('T')[0];

      // Hook Inventori: Otomatis kunci unit fisik menjadi BOOKED
      if (inv.items && inv.items.length > 0) {
        for (const item of inv.items) {
          if (item.sku && !item.sku.startsWith('NON-SKU')) {
            await updateTursoStockStatus(item.sku, 'BOOKED').catch((e) =>
              console.warn(`Gagal update unit ${item.sku} ke BOOKED:`, e)
            );
          }
        }
      }
    } else if (status === 'PAID') {
      inv.paidDate = todayStr;

      // Hook Inventori: Otomatis kunci unit fisik menjadi SOLD
      if (inv.items && inv.items.length > 0) {
        for (const item of inv.items) {
          if (item.sku && !item.sku.startsWith('NON-SKU')) {
            await updateTursoStockStatus(item.sku, 'SOLD', item.unitPrice).catch((e) =>
              console.warn(`Gagal update unit ${item.sku} ke SOLD:`, e)
            );
          }
        }
      }

      // DIRECTIVE PR-1: Auto-provision Delivery Dispatch to Turso DB
      const sjNumber =
        inv.suratJalanNumber ||
        `SJ-BBK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${
          inv.id.replace(/\D/g, '').slice(-4) || '1024'
        }`;
      inv.suratJalanNumber = sjNumber;

      const dispatchRecord: DeliveryDispatchRecord = {
        id: `disp_${inv.id}`,
        sjNumber,
        invoiceNumber: inv.invoiceNumber,
        driverName: inv.deliveryDriver || 'Supir Pamulang',
        driverPhone: inv.driverPhone || '-',
        vehiclePlateReal: inv.deliveryVehiclePlate || '-',
        recipientNameAllowed: inv.customerName,
        isUnlockedForAcceptance: false,
        dispatchedAt: now.toISOString(),
      };
      await saveTursoDispatch(dispatchRecord).catch((e) =>
        console.warn('Auto-provision delivery dispatch warning:', e)
      );

      // DIRECTIVE PR-1: Auto-provision E-Warranty to Turso DB
      const isWarrantyEligible = (desc: string) => {
        const lower = (desc || '').toLowerCase();
        return (
          lower.includes('chiller') ||
          lower.includes('freezer') ||
          lower.includes('showcase') ||
          lower.includes('kulkas') ||
          lower.includes('kompor') ||
          lower.includes('burner') ||
          lower.includes('fryer') ||
          lower.includes('oven') ||
          lower.includes('steamer') ||
          lower.includes('ice maker') ||
          lower.includes('blender') ||
          lower.includes('mixer') ||
          lower.includes('slicer') ||
          lower.includes('mesin')
        );
      };

      const warrantyNumber = `GAR-${now.getFullYear()}-${inv.id.replace(/\D/g, '').slice(-5) || '20261'}`;
      const expires14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const expires21 = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString();

      const warrantyItems: WarrantyItemRecord[] = (inv.items || []).map((it, idx) => ({
        id: `witem_${inv.id}_${idx}_${Date.now()}`,
        warrantyId: `war_${inv.id}`,
        itemCode: it.sku || `BBK-${idx + 1}`,
        itemName: it.description || 'Unit Komersial',
        itemCondition: it.condition || 'SECOND_RECONDITIONED',
        warrantyEligible: isWarrantyEligible(it.description),
      }));

      const warrantyRecord: WarrantyRecord = {
        id: `war_${inv.id}`,
        warrantyNumber,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        customerCompany: inv.customerCompany || undefined,
        receivedAt: now.toISOString(),
        warrantyExpiresAt: expires14,
        publicExpiresAt: expires21,
        status: 'ACTIVE',
        items: warrantyItems,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      await saveTursoWarranty(warrantyRecord).catch((e) =>
        console.warn('Auto-provision warranty warning:', e)
      );
    } else if (status === 'VOID') {
      // Gate 7: Ihsan & Ta'widh (Holding fee 10% capped at Rp 1.000.000)
      const holdingFee = Math.min(Math.round((inv.totalAmount || 0) * 0.1), 1000000);
      const dpPaid = inv.dpAmount || 0;
      inv.holdingFeeAmount = holdingFee;
      inv.refundAmount = Math.max(0, dpPaid - holdingFee);

      // Hook Inventori: Lepas kembali unit fisik menjadi READY di katalog publik
      if (inv.items && inv.items.length > 0) {
        for (const item of inv.items) {
          if (item.sku && !item.sku.startsWith('NON-SKU')) {
            await updateTursoStockStatus(item.sku, 'READY').catch((e) =>
              console.warn(`Gagal lepas unit ${item.sku} ke READY:`, e)
            );
          }
        }
      }
    }

    // Persist full state ke Turso
    await saveTursoInvoice(inv).catch((e) =>
      console.warn('Turso full invoice status sync warning:', e)
    );
  }

  // Persist status update to Turso Edge Database
  await updateTursoStatus(id, status).catch((e: any) =>
    console.warn('Turso invoice status update warning:', e)
  );

  return true;
}

// ==========================================
// WARRANTIES & DISPATCH HELPER EXPORTS
// ==========================================

export async function getWarranties(): Promise<WarrantyRecord[]> {
  return fetchTursoWarranties();
}

export async function getWarrantyByNumber(warrantyNumber: string): Promise<WarrantyRecord | null> {
  return getTursoWarrantyByNumber(warrantyNumber);
}

export async function getWarrantyByInvoice(invoiceNumber: string): Promise<WarrantyRecord | null> {
  return getTursoWarrantyByInvoice(invoiceNumber);
}

export async function saveWarranty(warranty: WarrantyRecord): Promise<void> {
  return saveTursoWarranty(warranty);
}

export async function getDispatches(): Promise<DeliveryDispatchRecord[]> {
  return fetchTursoDispatches();
}

export async function getDispatchBySjNumber(sjNumber: string): Promise<DeliveryDispatchRecord | null> {
  return getTursoDispatchBySjNumber(sjNumber);
}

export async function getDispatchByInvoice(invoiceNumber: string): Promise<DeliveryDispatchRecord | null> {
  return getTursoDispatchByInvoice(invoiceNumber);
}

export async function saveDispatch(dispatch: DeliveryDispatchRecord): Promise<void> {
  return saveTursoDispatch(dispatch);
}

export async function unlockDispatchAcceptance(sjNumber: string): Promise<boolean> {
  return unlockTursoDispatchAcceptance(sjNumber);
}

export async function deleteInvoice(idOrNumber: string): Promise<boolean> {
  cachedInvoices = cachedInvoices.filter(
    (inv) => inv.id !== idOrNumber && inv.invoiceNumber !== idOrNumber
  );

  // Persist deletion to Turso Edge Database SSOT
  await deleteTursoInv(idOrNumber).catch((e) =>
    console.warn('Turso invoice deletion warning:', e)
  );

  return true;
}

export interface CategoryEconomics {
  category: string;
  totalUnits: number;
  readyUnits: number;
  soldUnits: number;
  avgRevenue: number;
  avgCOGS: number;
  avgMargin: number;
  marginPercent: number;
  assetValue: number;
}

export interface InventorySummaryItem {
  sku: string;
  category: string;
  statusUnit: string;
  modal: number;
  price: number;
  inDate?: string;
  soldDate?: string;
  warehouse: string;
  asalGudang?: string;
}

export async function getLiveClosingDealLedger(): Promise<{
  deals: ClosingDealItem[];
  categoryEconomics: CategoryEconomics[];
  totalAssetValuation: number;
  inventorySummary: InventorySummaryItem[];
  kpis: {
    totalRevenue: number;
    totalProfit: number;
    totalDeals: number;
    bbkSalesDeals: number;
    thirdPartyDeals: number;
    avgMarginPercent: number;
    avgAgingDays: number;
  };
}> {
  try {
    const rawItems = await fetchAllTursoMasterItems();
    const soldItems = rawItems.filter((i) => i.STATUS_UNIT === 'SOLD');
    // 1. Fetch Turso SQLite Inventory and Paid Invoices
    const matchedSkusSet = new Set<string>();
    const bbkInvoiceDeals: ClosingDealItem[] = [];
    let totalPhysicalUnitsSold = 0;

    try {
      const realInvoices = await getInvoices();
      const paidInvoices = (realInvoices || []).filter((inv) => inv.status === 'PAID');
      const nonSkuRecords = await fetchTursoNonSkuTransactions().catch(() => []);

      for (const inv of paidInvoices) {
        if (!inv.items || inv.items.length === 0) continue;
        const invDate = parseToISODate(inv.paidDate || inv.issueDate) || inv.issueDate;

        let invoiceModal = 0;
        let invoiceClosing = inv.totalAmount || 0;
        let totalQty = 0;
        let hasNonSku = false;

        const enrichedItems: InvoiceItem[] = [];

        for (const it of inv.items) {
          const qty = it.quantity || 1;
          totalQty += qty;
          const itemSku = (it.sku || '').trim().toUpperCase();
          const isCustomSku = !itemSku || itemSku.startsWith('BBK-CUSTOM') || itemSku.startsWith('INV-') || itemSku === 'UNIT';

          if (isCustomSku) {
            hasNonSku = true;
          }

          let itemUnitCost = it.unitCost || 0;
          let itemWarehouse = it.warehouseLocation || '';
          let itemAsalGudang = it.asalGudang || '';
          let itemCategory = it.condition || it.category || '';

          // Check if SKU exists in master inventory
          const rawMatch = !isCustomSku ? rawItems.find((r) => r.SKU.trim().toUpperCase() === itemSku) : undefined;
          if (rawMatch) {
            matchedSkusSet.add(itemSku);
            itemUnitCost = rawMatch.HARGA_MODAL || 0;
            itemAsalGudang = rawMatch.asal_gudang || resolveHubCode(rawMatch.asal_gudang, rawMatch.LOKASI_UNIT, rawMatch.SKU) || 'GK';
            itemWarehouse = rawMatch.LOKASI_UNIT || resolveLocationFromCode(itemAsalGudang);
            itemCategory = rawMatch.CATEGORY_NAME || rawMatch.CATEGORY_SLUG || '';
            invoiceModal += itemUnitCost * qty;
          } else {
            // Check if resolved in TRANSAKSI_NON_SKU
            const resolvedNonSku = nonSkuRecords.find(
              (r) =>
                r.invoiceNumber === inv.invoiceNumber &&
                (r.skuTemp === itemSku ||
                  (Boolean(it.description) &&
                    Boolean(r.itemTitle) &&
                    (r.itemTitle.trim().toLowerCase() === it.description.trim().toLowerCase() ||
                      it.description.toLowerCase().includes(r.itemTitle.toLowerCase()) ||
                      r.itemTitle.toLowerCase().includes(it.description.toLowerCase()))) ||
                  inv.items.length === 1)
            );

            if (resolvedNonSku) {
              itemUnitCost = (resolvedNonSku.hppModal || 0) / qty;
              itemAsalGudang = resolvedNonSku.warehouseCode || resolveHubCode(resolvedNonSku.warehouseCode, resolvedNonSku.hubLocation) || 'ML';
              itemWarehouse = resolvedNonSku.hubLocation || resolveLocationFromCode(itemAsalGudang) || 'Pamulang Barat';
              itemCategory = resolvedNonSku.category || it.condition || it.category || 'Meja 1 Susun';
              invoiceModal += resolvedNonSku.hppModal || 0;
            } else {
              invoiceModal += (it.unitCost || 0) * qty;
              itemAsalGudang = it.asalGudang || (it.warehouseLocation ? resolveHubCode(it.warehouseLocation, it.warehouseLocation) : '') || 'ML';
              itemWarehouse = it.warehouseLocation || resolveLocationFromCode(itemAsalGudang) || 'Pamulang Barat';
            }
          }

          enrichedItems.push({
            ...it,
            unitCost: itemUnitCost,
            warehouseLocation: itemWarehouse,
            asalGudang: itemAsalGudang,
            condition: itemCategory,
            category: itemCategory,
          });
        }

        // If totalAmount was not preset or 0, sum from items
        if (!invoiceClosing || invoiceClosing === 0) {
          invoiceClosing = inv.items.reduce((s, it) => s + (it.unitPrice || 0) * (it.quantity || 1), 0);
        }

        const realizedProfit = Math.max(0, invoiceClosing - invoiceModal);
        const marginPercent = invoiceClosing > 0 ? Math.round((realizedProfit / invoiceClosing) * 100) : 0;

        // Build Title & SKU representation for the unified invoice
        const isMultiItem = inv.items.length > 1;
        const primarySku = !isMultiItem && inv.items[0].sku && !inv.items[0].sku.startsWith('BBK-CUSTOM')
          ? inv.items[0].sku
          : `#${inv.invoiceNumber}`;

        const productTitle = isMultiItem
          ? inv.items.map((it) => `${it.quantity > 1 ? `${it.quantity}x ` : ''}${it.description || it.sku}`).join(' • ')
          : (inv.items[0].description || inv.items[0].sku || 'Peralatan Dapur Komersial');

        const primaryEnriched = enrichedItems[0] || inv.items[0];
        const category = isMultiItem
          ? `Paket Pesanan (${inv.items.length} Item)`
          : (primaryEnriched.category || primaryEnriched.condition || 'Peralatan Dapur Komersial');

        const dealAsalGudang = primaryEnriched.asalGudang || resolveHubCode(primaryEnriched.warehouseLocation, primaryEnriched.warehouseLocation) || 'ML';
        const dealLokasi = primaryEnriched.warehouseLocation || resolveLocationFromCode(dealAsalGudang) || 'Pamulang Barat';

        bbkInvoiceDeals.push({
          sku: primarySku,
          productTitle,
          category,
          tanggalMasuk: invDate,
          tanggalTerjual: invDate,
          durasiTerjual: '1 hari',
          lokasiGudang: dealLokasi,
          asalGudang: dealAsalGudang,
          quantity: totalQty,
          hargaModal: invoiceModal,
          hargaClosing: invoiceClosing,
          realizedProfit,
          marginPercent,
          soldBy: 'SALES_BBK',
          customerName: inv.customerName,
          notes: `Faktur Resmi #${inv.invoiceNumber} (${totalQty} Unit)`,
          isNonSku: hasNonSku,
          invoiceNumber: inv.invoiceNumber,
          invoiceId: inv.id,
          items: enrichedItems,
          itemsCount: inv.items.length,
          rawInvoice: inv,
        });
      }
    } catch (invErr) {
      console.warn('Could not merge real invoices into deal ledger:', invErr);
    }

    // 2. Add remaining Third-Party sold items (excluding SKUs already sold via BBKitchen invoices)
    let totalAging = 0;
    const thirdPartyDeals: ClosingDealItem[] = soldItems
      .filter((item) => !matchedSkusSet.has(item.SKU.trim().toUpperCase()))
      .map((item) => {
        // Priority: HARGA_DEAL_WA -> HARGA_BUKA_WA -> HARGA_MODAL -> 0
        const closing = item.HARGA_DEAL_WA || item.HARGA_BUKA_WA || item.HARGA_MODAL || 0;
        const modal = item.HARGA_MODAL || closing;

        // Convert serial date or raw string to ISO YYYY-MM-DD (fallback to inDate if soldDate missing)
        const cleanInDate = parseToISODate(item.TANGGAL_MASUK) || '2025-01-01';
        const cleanSoldDate = parseToISODate(item.TANGGAL_TERJUAL) || cleanInDate;

        const agingNum = typeof item.DURASI_TERJUAL === 'number'
          ? Math.round(item.DURASI_TERJUAL)
          : (parseInt(String(item.DURASI_TERJUAL || '0').replace(/\D/g, ''), 10) || 0);

        totalAging += agingNum;

        return {
          sku: item.SKU,
          productTitle: item.PRODUCT_TITLE,
          category: item.CATEGORY_NAME || item.CATEGORY_SLUG || '',
          tanggalMasuk: cleanInDate,
          tanggalTerjual: cleanSoldDate,
          durasiTerjual: `${agingNum} hari`,
          lokasiGudang: item.LOKASI_UNIT,
          asalGudang: item.asal_gudang || 'GK',
          quantity: 1,
          hargaModal: modal,
          hargaClosing: closing,
          realizedProfit: 0,
          marginPercent: 0,
          soldBy: 'THIRD_PARTY',
          notes: 'Terjual Rekanan Gudang / Pihak Ketiga',
        };
      });

    // 3. Combine All Deals (BBKitchen Invoice Deals + Third Party Deals)
    const deals: ClosingDealItem[] = [...bbkInvoiceDeals, ...thirdPartyDeals];

    // Recalculate Totals (Total ecosystem turnover + direct BBKitchen profit)
    const bbkDeals = deals.filter((d) => d.soldBy === 'SALES_BBK');
    const totalRevenue = deals.reduce((sum, d) => sum + d.hargaClosing, 0);
    const totalProfit = bbkDeals.reduce((sum, d) => sum + d.realizedProfit, 0);
    totalPhysicalUnitsSold = deals.reduce((sum, d) => sum + (d.quantity || 1), 0);
    const bbkSalesCount = bbkDeals.length;
    const thirdPartyCount = deals.filter((d) => d.soldBy === 'THIRD_PARTY').length;

    // Sort newest sold date first
    deals.sort((a, b) => {
      const dateA = a.tanggalTerjual ? new Date(a.tanggalTerjual).getTime() : 0;
      const dateB = b.tanggalTerjual ? new Date(b.tanggalTerjual).getTime() : 0;
      return dateB - dateA;
    });

    const totalDeals = deals.length;
    const avgMarginPercent = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
    const avgAgingDays = totalDeals > 0 ? Math.round(totalAging / totalDeals) : 0;

    // Calculate Real Category Unit Economics from All 2,760+ Items
    const categoryMap = new Map<string, {
      totalUnits: number;
      readyUnits: number;
      soldUnits: number;
      revenueSum: number;
      revenueCount: number;
      cogsSum: number;
      cogsCount: number;
      assetSum: number;
    }>();

    let totalAssetValuation = 0;

    rawItems.forEach((item) => {
      const cat = item.CATEGORY_NAME || item.CATEGORY_SLUG || 'Peralatan Dapur Lainnya';
      const isSold = item.STATUS_UNIT === 'SOLD';
      const modal = item.HARGA_MODAL || 0;
      const revenue = item.HARGA_CLOSING || item.HARGA_DEAL_WA || item.HARGA_BUKA_WA || modal;

      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, {
          totalUnits: 0,
          readyUnits: 0,
          soldUnits: 0,
          revenueSum: 0,
          revenueCount: 0,
          cogsSum: 0,
          cogsCount: 0,
          assetSum: 0,
        });
      }

      const entry = categoryMap.get(cat)!;
      entry.totalUnits += 1;

      if (isSold) {
        entry.soldUnits += 1;
        if (revenue > 0) {
          entry.revenueSum += revenue;
          entry.revenueCount += 1;
        }
        if (modal > 0) {
          entry.cogsSum += modal;
          entry.cogsCount += 1;
        }
      } else {
        entry.readyUnits += 1;
        entry.assetSum += modal;
        totalAssetValuation += modal;
      }
    });

    const categoryEconomics: CategoryEconomics[] = Array.from(categoryMap.entries())
      .map(([catName, stats]) => {
        const avgRev = stats.revenueCount > 0 ? Math.round(stats.revenueSum / stats.revenueCount) : 0;
        const avgCogs = stats.cogsCount > 0 ? Math.round(stats.cogsSum / stats.cogsCount) : 0;
        const avgMargin = Math.max(0, avgRev - avgCogs);
        const marginPct = avgRev > 0 ? Math.round((avgMargin / avgRev) * 100) : 0;

        return {
          category: catName,
          totalUnits: stats.totalUnits,
          readyUnits: stats.readyUnits,
          soldUnits: stats.soldUnits,
          avgRevenue: avgRev,
          avgCOGS: avgCogs,
          avgMargin,
          marginPercent: marginPct,
          assetValue: stats.assetSum,
        };
      })
      .sort((a, b) => b.totalUnits - a.totalUnits);

    const inventorySummary: InventorySummaryItem[] = rawItems.map((it) => ({
      sku: it.SKU,
      category: it.CATEGORY_NAME || it.CATEGORY_SLUG || 'Peralatan Dapur Lainnya',
      statusUnit: it.STATUS_UNIT,
      modal: it.HARGA_MODAL || 0,
      price: it.HARGA_CLOSING || it.HARGA_DEAL_WA || it.HARGA_BUKA_WA || it.HARGA_ESTIMASI_PUBLIK || 0,
      inDate: parseToISODate(it.TANGGAL_MASUK),
      soldDate: parseToISODate(it.TANGGAL_TERJUAL),
      warehouse: it.LOKASI_UNIT || 'Pamulang 2',
      asalGudang: it.asal_gudang || 'GK',
    }));

    return {
      deals,
      categoryEconomics,
      totalAssetValuation,
      inventorySummary,
      kpis: {
        totalDeals,
        bbkSalesDeals: totalPhysicalUnitsSold,
        thirdPartyDeals: thirdPartyCount,
        totalRevenue,
        totalProfit,
        avgMarginPercent,
        avgAgingDays,
      },
    };
  } catch (error) {
    console.error('Failed to calculate live closing deal ledger:', error);
    return {
      deals: [],
      categoryEconomics: [],
      totalAssetValuation: 0,
      inventorySummary: [],
      kpis: {
        totalDeals: 0,
        bbkSalesDeals: 0,
        thirdPartyDeals: 0,
        totalRevenue: 0,
        totalProfit: 0,
        avgMarginPercent: 0,
        avgAgingDays: 0,
      },
    };
  }
}

export async function resolveNonSkuItem(params: {
  invoiceNumber: string;
  skuTemp: string;
  itemTitle: string;
  action: 'LINK_EXISTING' | 'SET_CUSTOM_MODAL' | 'CREATE_NEW_SKU';
  targetSku?: string;
  hppModal?: number;
  vendorBengkel?: string;
  notes?: string;
  hubLocation?: string;
  warehouseCode?: string;
  category?: string;
}): Promise<boolean> {
  const invoices = await getInvoices();
  const targetInv = invoices.find((i) => i.invoiceNumber === params.invoiceNumber);
  if (!targetInv) return false;

  let targetItem = targetInv.items.find(
    (it) => (it.sku || '').trim().toUpperCase() === params.skuTemp.toUpperCase() || it.description === params.itemTitle
  );
  if (!targetItem && targetInv.items.length === 1) {
    targetItem = targetInv.items[0];
  }
  if (!targetItem) return false;

  if (params.action === 'LINK_EXISTING' && params.targetSku) {
    // 1. Update SKU on the invoice
    targetItem.sku = params.targetSku.toUpperCase();
    await updateInvoice(targetInv);

    // 2. Mark the target SKU as SOLD in Turso Master Inventory
    await updateTursoStockStatus(
      params.targetSku,
      'SOLD',
      targetItem.unitPrice,
      `Linked & Auto-marked from Invoice #${targetInv.invoiceNumber}`
    );

    return true;
  }

  if (params.action === 'SET_CUSTOM_MODAL') {
    const cleanModal = Number(params.hppModal) || 0;
    targetItem.unitCost = cleanModal;
    if (params.hubLocation) {
      targetItem.warehouseLocation = params.hubLocation;
    }
    if (params.warehouseCode) {
      targetItem.asalGudang = params.warehouseCode;
    }
    if (params.category) {
      targetItem.condition = params.category;
      targetItem.category = params.category;
    }
    await updateInvoice(targetInv);

    // Save to Turso non_sku_transactions table (SSOT)
    const tx: NonSkuTransaction = {
      id: `nonsku_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      invoiceNumber: targetInv.invoiceNumber,
      invoiceId: targetInv.id,
      tanggal: targetInv.paidDate || targetInv.issueDate,
      itemTitle: targetItem.description,
      skuTemp: params.skuTemp,
      quantity: targetItem.quantity || 1,
      hppModal: cleanModal,
      hargaJual: (targetItem.unitPrice || 0) * (targetItem.quantity || 1),
      realizedProfit: Math.max(0, (targetItem.unitPrice || 0) * (targetItem.quantity || 1) - cleanModal),
      vendorBengkel: params.vendorBengkel || 'Bengkel Fabrikasi Las',
      customerName: targetInv.customerName,
      notes: params.notes,
      hubLocation: params.hubLocation,
      warehouseCode: params.warehouseCode,
      category: params.category,
      resolvedAt: new Date().toISOString().split('T')[0],
      resolvedBy: 'ADMIN',
    };

    await saveTursoNonSkuTransaction(tx);
    return true;
  }

  return false;
}

export async function getFinancialKPIs(): Promise<FinancialKPIs> {
  const ledgerData = await getLiveClosingDealLedger();
  return {
    period: 'Live Financials',
    totalRevenue: ledgerData.kpis.totalRevenue,
    totalCOGS: Math.max(0, ledgerData.kpis.totalRevenue - ledgerData.kpis.totalProfit),
    grossMarginAmount: ledgerData.kpis.totalProfit,
    grossMarginPercentage: ledgerData.kpis.avgMarginPercent,
    unitsSold: ledgerData.kpis.totalDeals,
    averageOrderValue: ledgerData.kpis.totalDeals > 0 ? Math.round(ledgerData.kpis.totalRevenue / ledgerData.kpis.totalDeals) : 0,
    averageUnitMargin: ledgerData.kpis.totalDeals > 0 ? Math.round(ledgerData.kpis.totalProfit / ledgerData.kpis.totalDeals) : 0,
    outstandingInvoicesAmount: 0,
    paidInvoicesAmount: ledgerData.kpis.totalRevenue,
    inventoryAssetValue: ledgerData.totalAssetValuation,
  };
}
