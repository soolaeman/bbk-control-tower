'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import {
  formatIDR,
  resolveLocationFromCode,
  resolveHubCode,
  WAREHOUSE_13_HUBS,
  matchWarehouseHub,
  matchCategory,
  UniversalDatePreset,
  getDynamicDatePresetOptions,
  getDatePresetBounds,
  isDateInRange,
} from '@/lib/repositories/warehouse-utils';
import { OFFICIAL_CATEGORIES } from '@/lib/repositories/categories';
import { ClosingDealItem, Invoice, DocumentType } from '@/lib/types/finance';
import { OfficialDocumentModal } from './OfficialDocumentModal';
import { ResolveNonSkuModal, NonSkuResolveItem } from './ResolveNonSkuModal';
import {
  Banknote,
  Percent,
  Receipt,
  Building,
  DollarSign,
  Lock,
  TrendingUp,
  Package,
  Clock,
  Search,
  Calendar,
  Layers,
  Filter,
  RefreshCw,
  Truck,
  FileText,
  BarChart3,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Activity,
  AlertTriangle,
  Award,
  Zap,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Link2,
  ArrowUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
} from 'recharts';

type DatePreset = UniversalDatePreset;
type GrowthMetric = 'REVENUE' | 'PROFIT' | 'CLOSING' | 'UNITS';
type UnitEconomicsMetric = 'PROFIT' | 'MARGIN' | 'UNITS';

interface InventorySummaryItem {
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

export function FinanceDashboard() {
  const { role, permissions } = useAuth();
  const [deals, setDeals] = useState<ClosingDealItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventorySummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. PRIMARY FILTERS
  const filterBarRef = React.useRef<HTMLDivElement>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'SALES_BBK' | 'THIRD_PARTY'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // UI Interactive States
  const [growthMetric, setGrowthMetric] = useState<GrowthMetric>('REVENUE');
  const [unitEconMetric, setUnitEconMetric] = useState<UnitEconomicsMetric>('PROFIT');

  // Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [documentModalType, setDocumentModalType] = useState<DocumentType>('INVOICE');
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [resolveItem, setResolveItem] = useState<NonSkuResolveItem | null>(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  // Pagination for Closing Deal Ledger
  const [dealPage, setDealPage] = useState(1);
  const [dealPageSize, setDealPageSize] = useState(25);
  const [dealPageInput, setDealPageInput] = useState('1');

  // Helper: Open Document from Deal Row
  const handleOpenDocFromDeal = (deal: ClosingDealItem, type: DocumentType) => {
    if (deal.rawInvoice) {
      setSelectedInvoice(deal.rawInvoice);
      setDocumentModalType(type);
      setIsDocModalOpen(true);
      return;
    }

    const dummyInv: Invoice = {
      id: deal.invoiceId || `inv_${deal.sku}`,
      invoiceNumber: deal.invoiceNumber || deal.sku.replace('BBK-CUSTOM-', '').replace('INV-', '').split('_')[0],
      issueDate: deal.tanggalTerjual || new Date().toISOString().split('T')[0],
      dueDate: deal.tanggalTerjual || new Date().toISOString().split('T')[0],
      customerName: deal.customerName || 'Pelanggan BBKitchen',
      customerPhone: '0812-BBK-SALES',
      status: 'PAID',
      items: [
        {
          id: `it_${deal.sku}`,
          sku: deal.sku,
          description: deal.productTitle,
          quantity: deal.quantity || 1,
          unitPrice: (deal.hargaClosing || 0) / (deal.quantity || 1),
          unitCost: (deal.hargaModal || 0) / (deal.quantity || 1),
          total: deal.hargaClosing || 0,
        },
      ],
      subtotal: deal.hargaClosing || 0,
      discount: 0,
      tax: 0,
      totalAmount: deal.hargaClosing || 0,
      dpAmount: deal.hargaClosing || 0,
      remainingAmount: 0,
      createdBy: 'SALES_BBK',
    };
    setSelectedInvoice(dummyInv);
    setDocumentModalType(type);
    setIsDocModalOpen(true);
  };

  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/invoices', {
        headers: { ...(role ? { 'x-bbk-role': role } : {}) },
      });
      const data = await res.json();
      if (data.deals) setDeals(data.deals);
      if (data.inventorySummary) setInventoryItems(data.inventorySummary);
    } catch (err) {
      console.error('Failed to load finance data', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset pagination when filters change
  useEffect(() => {
    setDealPage(1);
    setDealPageInput('1');
  }, [channelFilter, categoryFilter, warehouseFilter, datePreset, searchQuery, startDate, endDate]);

  // Keep page input in sync
  useEffect(() => {
    setDealPageInput(String(dealPage));
  }, [dealPage]);

  // Dynamic Date Bounds for Active Period & Previous Period (For Growth Calculation)
  const { dateBounds, prevDateBounds } = useMemo(() => {
    const bounds = getDatePresetBounds(datePreset, startDate, endDate, now);
    return {
      dateBounds: { startFilter: bounds.startFilter, endFilter: bounds.endFilter },
      prevDateBounds: { startFilter: bounds.prevStartFilter, endFilter: bounds.prevEndFilter },
    };
  }, [datePreset, startDate, endDate, now]);

  const extractISODate = (raw?: string): string => {
    if (!raw) return '';
    const str = String(raw).trim();
    const iso = str.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    const d = new Date(str.replace(/\./g, ':'));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return str;
  };

  // Helper to isolate revenue, cogs, profit, and physical units for an individual deal based on active filters
  const getDealFilteredMetrics = React.useCallback(
    (
      deal: ClosingDealItem,
      whFilter: string = 'ALL',
      catFilter: string = 'ALL'
    ): { matches: boolean; revenue: number; cogs: number; profit: number; units: number } => {
      // If no specific hub/category filter is active, return entire deal values
      if ((!whFilter || whFilter === 'ALL') && (!catFilter || catFilter === 'ALL')) {
        const revenue = deal.hargaClosing > 0 ? deal.hargaClosing : (deal.hargaModal || 0);
        const cogs = deal.hargaModal || (deal.hargaClosing - (deal.realizedProfit || 0));
        const profit = deal.realizedProfit || 0;
        const units = deal.quantity || (deal.items && deal.items.length > 0 ? deal.items.reduce((s, it) => s + (it.quantity || 1), 0) : 1);
        return { matches: true, revenue, cogs, profit, units };
      }

      // If deal has itemized list (e.g. unified multi-item invoice)
      if (deal.items && deal.items.length > 0) {
        let sumRev = 0;
        let sumCost = 0;
        let sumProf = 0;
        let sumUnits = 0;
        let matchedAny = false;

        for (const it of deal.items) {
          const itemWh = it.warehouseLocation || it.asalGudang || '';
          const itemCat = it.condition || it.category || '';
          const itemTitle = it.description || it.sku || '';

          const whMatch = matchWarehouseHub(itemWh, it.asalGudang || itemWh, it.sku || deal.sku, whFilter);
          const catMatch = matchCategory(itemTitle, itemCat, catFilter);

          if (whMatch && catMatch) {
            matchedAny = true;
            const qty = it.quantity || 1;
            const rev = (it.unitPrice || 0) * qty;
            const cost = (it.unitCost || 0) * qty;
            const prof = Math.max(0, rev - cost);

            sumRev += rev;
            sumCost += cost;
            sumProf += prof;
            sumUnits += qty;
          }
        }

        if (matchedAny) {
          return {
            matches: true,
            revenue: sumRev,
            cogs: sumCost,
            profit: sumProf,
            units: sumUnits,
          };
        } else {
          return { matches: false, revenue: 0, cogs: 0, profit: 0, units: 0 };
        }
      }

      // Fallback for single-item deals / legacy deals without items array
      const whMatch = matchWarehouseHub(deal.lokasiGudang, deal.asalGudang, deal.sku, whFilter);
      const catMatch = matchCategory(deal.productTitle, deal.category, catFilter);

      if (whMatch && catMatch) {
        const revenue = deal.hargaClosing > 0 ? deal.hargaClosing : (deal.hargaModal || 0);
        const cogs = deal.hargaModal || (deal.hargaClosing - (deal.realizedProfit || 0));
        const profit = deal.realizedProfit || 0;
        const units = deal.quantity || 1;
        return { matches: true, revenue, cogs, profit, units };
      }

      return { matches: false, revenue: 0, cogs: 0, profit: 0, units: 0 };
    },
    []
  );

  // 1. FILTERED DEALS (ACTIVE PERIOD)
  const filteredDeals = useMemo(() => {
    const { startFilter, endFilter } = dateBounds;

    return deals.filter((deal) => {
      // Keyword search
      const q = searchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        deal.sku.toLowerCase().includes(q) ||
        deal.productTitle.toLowerCase().includes(q) ||
        deal.lokasiGudang.toLowerCase().includes(q) ||
        (deal.notes ? deal.notes.toLowerCase().includes(q) : false) ||
        (deal.items && deal.items.some((it) => (it.description || '').toLowerCase().includes(q) || (it.sku || '').toLowerCase().includes(q)));

      // Channel filter
      const matchChannel = channelFilter === 'ALL' || deal.soldBy === channelFilter;

      // Item-level Warehouse & Category Matching
      const itemMetrics = getDealFilteredMetrics(deal, warehouseFilter, categoryFilter);
      if (!itemMetrics.matches) return false;

      // Date filtering comparison on clean ISO YYYY-MM-DD
      let matchDate = true;
      if (startFilter || endFilter) {
        const dealDateStr = extractISODate(deal.tanggalTerjual || deal.tanggalMasuk);
        if (!dealDateStr) {
          matchDate = false;
        } else {
          if (startFilter && dealDateStr < startFilter) matchDate = false;
          if (endFilter && dealDateStr > endFilter) matchDate = false;
        }
      }

      return matchQ && matchChannel && matchDate;
    });
  }, [deals, searchQuery, channelFilter, warehouseFilter, categoryFilter, dateBounds, getDealFilteredMetrics]);

  const dealTotalPages = Math.max(1, Math.ceil(filteredDeals.length / dealPageSize));
  const paginatedDeals = useMemo(() => {
    const start = (dealPage - 1) * dealPageSize;
    return filteredDeals.slice(start, start + dealPageSize);
  }, [filteredDeals, dealPage, dealPageSize]);

  // PREVIOUS PERIOD DEALS (FOR GROWTH COMPARISON)
  const previousDeals = useMemo(() => {
    const { startFilter, endFilter } = prevDateBounds;
    if (!startFilter && !endFilter) return [];

    return deals.filter((deal) => {
      const matchChannel = channelFilter === 'ALL' || deal.soldBy === channelFilter;
      const itemMetrics = getDealFilteredMetrics(deal, warehouseFilter, categoryFilter);
      if (!itemMetrics.matches) return false;

      const dealDateStr = extractISODate(deal.tanggalTerjual || deal.tanggalMasuk);
      if (!dealDateStr) return false;
      if (startFilter && dealDateStr < startFilter) return false;
      if (endFilter && dealDateStr > endFilter) return false;

      return matchChannel;
    });
  }, [deals, channelFilter, warehouseFilter, categoryFilter, prevDateBounds, getDealFilteredMetrics]);

  // 2. FILTERED INVENTORY (FOR SUPPLY & ASSET VALUATION)
  const filteredInventory = useMemo(() => {
    const { startFilter, endFilter } = dateBounds;

    return inventoryItems.filter((item) => {
      const matchWarehouse = matchWarehouseHub(item.warehouse, item.asalGudang, item.sku, warehouseFilter);
      const matchCat = categoryFilter === 'ALL' || matchCategory(item.category, item.category, categoryFilter);

      if (!matchWarehouse || !matchCat) return false;

      if (startFilter || endFilter) {
        const itemDate = item.inDate || item.soldDate || '';
        if (itemDate) {
          if (startFilter && itemDate < startFilter) return false;
          if (endFilter && itemDate > endFilter) return false;
        }
      }

      return true;
    });
  }, [inventoryItems, warehouseFilter, categoryFilter, dateBounds]);

  // 3. FINANCIAL HEALTH METRICS
  const healthKPIs = useMemo(() => {
    let revenue = 0;
    let profit = 0;
    let bbkSalesCount = 0;
    let thirdPartyCount = 0;
    let totalCogs = 0;
    let unitsSold = 0;

    filteredDeals.forEach((d) => {
      const m = getDealFilteredMetrics(d, warehouseFilter, categoryFilter);
      revenue += m.revenue;
      totalCogs += m.cogs;
      profit += m.profit;
      unitsSold += m.units;

      if (d.soldBy === 'SALES_BBK') {
        bbkSalesCount++;
      } else {
        thirdPartyCount++;
      }
    });

    const totalDeals = filteredDeals.length;
    const grossMarginPct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    return {
      revenue,
      grossProfit: profit,
      grossMarginPct,
      totalDeals,
      bbkSalesCount,
      thirdPartyCount,
      unitsSold,
      totalCogs,
    };
  }, [filteredDeals, warehouseFilter, categoryFilter, getDealFilteredMetrics]);

  // 4. GROWTH CALCULATIONS (COMPARED TO PREVIOUS PERIOD)
  const growthKPIs = useMemo(() => {
    let prevRevenue = 0;
    let prevProfit = 0;
    let prevDealsCount = 0;
    let prevUnitsSold = 0;

    previousDeals.forEach((d) => {
      const m = getDealFilteredMetrics(d, warehouseFilter, categoryFilter);
      prevRevenue += m.revenue;
      prevProfit += m.profit;
      prevUnitsSold += m.units;
      prevDealsCount++;
    });

    const calcGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const revenueGrowth = calcGrowth(healthKPIs.revenue, prevRevenue);
    const profitGrowth = calcGrowth(healthKPIs.grossProfit, prevProfit);
    const closingGrowth = calcGrowth(healthKPIs.totalDeals, prevDealsCount);
    const unitsGrowth = calcGrowth(healthKPIs.unitsSold, prevUnitsSold);

    return {
      prevRevenue,
      prevProfit,
      prevDealsCount,
      prevUnitsSold,
      revenueGrowth,
      profitGrowth,
      closingGrowth,
      unitsGrowth,
      hasPrevData: previousDeals.length > 0,
    };
  }, [previousDeals, healthKPIs, warehouseFilter, categoryFilter, getDealFilteredMetrics]);

  // 5. TIME-SERIES TIMELINE CHART DATA
  const timelineChartData = useMemo(() => {
    const timelineMap = new Map<string, { date: string; revenue: number; profit: number; closing: number; units: number }>();

    filteredDeals.forEach((deal) => {
      const dateStr = deal.tanggalTerjual ? deal.tanggalTerjual.split('T')[0] : 'Unknown';
      if (dateStr === 'Unknown') return;

      if (!timelineMap.has(dateStr)) {
        timelineMap.set(dateStr, {
          date: dateStr,
          revenue: 0,
          profit: 0,
          closing: 0,
          units: 0,
        });
      }

      const m = getDealFilteredMetrics(deal, warehouseFilter, categoryFilter);
      const bucket = timelineMap.get(dateStr)!;
      bucket.closing++;
      bucket.units += m.units;
      bucket.revenue += m.revenue;
      bucket.profit += m.profit;
    });

    return Array.from(timelineMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredDeals, warehouseFilter, categoryFilter, getDealFilteredMetrics]);

  // Helper to dynamically resolve the category bucket based on active categoryFilter and OFFICIAL_CATEGORIES
  const resolveCategoryBucket = React.useCallback((itemTitle: string = '', itemCat: string = ''): string => {
    const filterClean = (categoryFilter || '').toLowerCase().trim().replace(' (semua)', '');

    // 1. Check if active categoryFilter matches a Parent Category Group (e.g. MEJA STAINLESS, SINK STAINLESS, KOMPOR, etc.)
    const activeParent = OFFICIAL_CATEGORIES.find(
      (g) =>
        filterClean === g.slug.toLowerCase() ||
        filterClean === g.name.toLowerCase() ||
        g.name.toLowerCase().includes(filterClean) ||
        filterClean.includes(g.name.toLowerCase())
    );

    if (activeParent && activeParent.children.length > 0) {
      // DRILL-DOWN MODE: Match item into one of the official child subcategories
      for (const child of activeParent.children) {
        if (!child.name.toLowerCase().includes('lainnya') && matchCategory(itemTitle, itemCat, child.name)) {
          return child.name;
        }
      }
      const otherChild = activeParent.children.find((c) => c.name.toLowerCase().includes('lainnya'));
      return otherChild ? otherChild.name : `${activeParent.name} (Lainnya)`;
    }

    // 2. If filter is ALL or not a parent group, match into official Parent Groups
    for (const group of OFFICIAL_CATEGORIES) {
      if (group.name !== 'PERALATAN LAINNYA' && matchCategory(itemTitle, itemCat, group.name)) {
        return group.name;
      }
    }

    // Fallback: strictly official PERALATAN LAINNYA
    return 'PERALATAN LAINNYA';
  }, [categoryFilter]);

  // 6. UNIT ECONOMICS METRICS & TOP CATEGORIES BREAKDOWN (ITEMIZED)
  const categoryEconomics = useMemo(() => {
    const map = new Map<string, {
      category: string;
      unitsSold: number;
      revenueSum: number;
      cogsSum: number;
      profitSum: number;
      readyUnits: number;
      readyCostSum: number;
    }>();

    const getEntry = (cat: string) => {
      if (!map.has(cat)) {
        map.set(cat, {
          category: cat,
          unitsSold: 0,
          revenueSum: 0,
          cogsSum: 0,
          profitSum: 0,
          readyUnits: 0,
          readyCostSum: 0,
        });
      }
      return map.get(cat)!;
    };

    // Pre-populate Map with official categories/subcategories so all official slots appear even before transactions
    const filterClean = (categoryFilter || '').toLowerCase().trim().replace(' (semua)', '');
    const activeParent = OFFICIAL_CATEGORIES.find(
      (g) =>
        filterClean === g.slug.toLowerCase() ||
        filterClean === g.name.toLowerCase() ||
        g.name.toLowerCase().includes(filterClean) ||
        filterClean.includes(g.name.toLowerCase())
    );

    if (activeParent && activeParent.children.length > 0) {
      activeParent.children.forEach((ch) => getEntry(ch.name));
    } else if (categoryFilter === 'ALL') {
      OFFICIAL_CATEGORIES.forEach((g) => getEntry(g.name));
    }

    // Aggregate from filtered deals (Item-by-item breakdown so multi-item invoices are properly distributed)
    filteredDeals.forEach((deal) => {
      if (deal.items && deal.items.length > 0) {
        deal.items.forEach((it) => {
          const itemWh = it.warehouseLocation || it.asalGudang || '';
          const itemCat = it.condition || it.category || '';
          const itemTitle = it.description || it.sku || '';

          // Only aggregate item if it matches the current warehouse and category filter
          const whMatch = matchWarehouseHub(itemWh, it.asalGudang || itemWh, it.sku || deal.sku, warehouseFilter);
          const catMatch = matchCategory(itemTitle, itemCat, categoryFilter);

          if (!whMatch || !catMatch) return;

          const cat = resolveCategoryBucket(itemTitle, itemCat);
          const itemQty = it.quantity || 1;
          const itemRevenue = (it.unitPrice || 0) * itemQty;
          const itemCost = (it.unitCost || 0) * itemQty;
          const itemProfit = Math.max(0, itemRevenue - itemCost);

          const entry = getEntry(cat);
          entry.unitsSold += itemQty;
          entry.revenueSum += itemRevenue;
          entry.cogsSum += itemCost;
          entry.profitSum += itemProfit;
        });
      } else {
        const cat = resolveCategoryBucket(deal.productTitle, deal.category);
        const qty = deal.quantity || 1;
        const closingVal = deal.hargaClosing > 0 ? deal.hargaClosing : (deal.hargaModal || 0);

        const entry = getEntry(cat);
        entry.unitsSold += qty;
        entry.revenueSum += closingVal;
        entry.cogsSum += deal.hargaModal || 0;
        entry.profitSum += deal.realizedProfit || 0;
      }
    });

    // Aggregate ready supply from inventory matching the active filter
    filteredInventory.forEach((item) => {
      const isReady = item.statusUnit === 'READY' || item.statusUnit === 'AVAILABLE';
      if (isReady) {
        const itemCat = item.category || '';
        const itemTitle = item.sku || '';
        const cat = resolveCategoryBucket(itemTitle, itemCat);
        const entry = getEntry(cat);
        entry.readyUnits++;
        entry.readyCostSum += item.modal || 0;
      }
    });

    return Array.from(map.values()).map((c) => {
      const asp = c.unitsSold > 0 ? Math.round(c.revenueSum / c.unitsSold) : 0;
      const avgCost = c.unitsSold > 0 ? Math.round(c.cogsSum / c.unitsSold) : 0;
      const avgProfit = c.unitsSold > 0 ? Math.round(c.profitSum / c.unitsSold) : 0;
      const marginPct = c.revenueSum > 0 ? Math.round((c.profitSum / c.revenueSum) * 100) : 0;

      return {
        ...c,
        asp,
        avgCost,
        avgProfit,
        marginPct,
      };
    });
  }, [filteredDeals, filteredInventory, warehouseFilter, categoryFilter, resolveCategoryBucket]);

  // Overall Unit Economics averages (Based on REAL Physical Units Sold)
  const unitEconomicsAverages = useMemo(() => {
    const totalPhysicalUnits = healthKPIs.unitsSold;

    const asp = totalPhysicalUnits > 0 ? Math.round(healthKPIs.revenue / totalPhysicalUnits) : 0;
    const avgHpp = totalPhysicalUnits > 0 ? Math.round(healthKPIs.totalCogs / totalPhysicalUnits) : 0;
    const avgProfit = totalPhysicalUnits > 0 ? Math.round(healthKPIs.grossProfit / totalPhysicalUnits) : 0;
    const avgMargin = healthKPIs.grossMarginPct;

    return { asp, avgHpp, avgProfit, avgMargin };
  }, [healthKPIs]);

  // Top Products / Categories Chart Data
  const topCategoriesChartData = useMemo(() => {
    const sorted = [...categoryEconomics];
    if (unitEconMetric === 'PROFIT') {
      sorted.sort((a, b) => b.profitSum - a.profitSum);
    } else if (unitEconMetric === 'MARGIN') {
      sorted.sort((a, b) => b.marginPct - a.marginPct);
    } else {
      sorted.sort((a, b) => b.unitsSold - a.unitsSold);
    }

    return sorted.slice(0, 7).map((c) => ({
      category: c.category.length > 14 ? `${c.category.slice(0, 13)}…` : c.category,
      fullCategory: c.category,
      value:
        unitEconMetric === 'PROFIT'
          ? c.profitSum
          : unitEconMetric === 'MARGIN'
          ? c.marginPct
          : c.unitsSold,
      profit: c.profitSum,
      margin: c.marginPct,
      units: c.unitsSold,
    }));
  }, [categoryEconomics, unitEconMetric]);

  // 7. DEMAND & SUPPLY BREAKDOWN
  // Demand: All Selling Categories / Subcategories under active filter
  const topDemandCategories = useMemo(() => {
    return [...categoryEconomics]
      .sort((a, b) => b.unitsSold - a.unitsSold || b.readyUnits - a.readyUnits);
  }, [categoryEconomics]);

  // Supply: Global Partner Hub Supply across all 13 Hubs
  const allHubsSupply = useMemo(() => {
    const hubMap = new Map<string, { code: string; label: string; availableUnits: number; estPartnerCapital: number }>();

    const hubLabels: Record<string, string> = {
      GK: 'GK - Pamulang 2',
      BB: 'BB - Pamulang 2',
      SM: 'SM - Pamulang 2',
      BL: 'BL - Pamulang 2',
      ML: 'ML - Pamulang Barat',
      RB: 'RB - Pamulang Barat',
      KG: 'KG - Kitchen Gembel',
      PY: 'PY - Setu Tangsel',
      PE: 'PE - Sawangan Depok',
      SK: 'SK - Sanjaya Kitchen',
      WT: 'WT - Kedaung Tangsel',
      ON: 'ON - Kedaung Tangsel',
      RK: 'RK - Rizki Kitchen',
    };

    // Pre-populate all 13 partner hubs
    Object.entries(hubLabels).forEach(([code, label]) => {
      hubMap.set(code, {
        code,
        label,
        availableUnits: 0,
        estPartnerCapital: 0,
      });
    });

    const { startFilter, endFilter } = dateBounds;
    let totalReadyGlobal = 0;
    let totalCapitalGlobal = 0;
    let totalAllUnitsGlobal = 0;

    inventoryItems.forEach((item) => {
      const itemTitle = item.sku || '';
      const itemCat = item.category || '';
      if (categoryFilter !== 'ALL' && !matchCategory(itemTitle, itemCat, categoryFilter)) return;
      if (startFilter || endFilter) {
        const itemDate = item.inDate || item.soldDate || '';
        if (itemDate && !isDateInRange(itemDate, startFilter, endFilter)) return;
      }

      totalAllUnitsGlobal++;
      const isReady = item.statusUnit === 'READY' || item.statusUnit === 'AVAILABLE';
      if (isReady) {
        totalReadyGlobal++;
        totalCapitalGlobal += item.modal || 0;

        const code = resolveHubCode(item.asalGudang, item.warehouse, item.sku) || (item.asalGudang ? item.asalGudang.toUpperCase() : 'GK');
        if (!hubMap.has(code)) {
          hubMap.set(code, {
            code,
            label: hubLabels[code] || `${code} Hub`,
            availableUnits: 0,
            estPartnerCapital: 0,
          });
        }
        const entry = hubMap.get(code)!;
        entry.availableUnits++;
        entry.estPartnerCapital += item.modal || 0;
      }
    });

    const list = Array.from(hubMap.values()).sort((a, b) => b.availableUnits - a.availableUnits);
    return {
      list,
      totalReadyGlobal,
      totalCapitalGlobal,
      totalAllUnitsGlobal,
    };
  }, [inventoryItems, categoryFilter, dateBounds]);

  // Selected Hub Details (When a specific Hub is chosen in filter)
  const selectedHubOverview = useMemo(() => {
    if (warehouseFilter === 'ALL') return null;

    const hub = allHubsSupply.list.find((h) => h.code === warehouseFilter) || {
      code: warehouseFilter,
      label: `${warehouseFilter} Hub`,
      availableUnits: 0,
      estPartnerCapital: 0,
    };

    // Total items terdata di hub ini (Ready + Sold) YANG COCOK DENGAN KATEGORI AKTIF
    const allItemsInHub = inventoryItems.filter((it) => {
      const whMatch = matchWarehouseHub(it.warehouse, it.asalGudang, it.sku, warehouseFilter);
      const catMatch = matchCategory(it.sku, it.category, categoryFilter);
      return whMatch && catMatch;
    });

    const totalUnitsInHub = allItemsInHub.length;
    const readyItemsInHub = allItemsInHub.filter((it) => it.statusUnit === 'READY' || it.statusUnit === 'AVAILABLE');
    const readyUnitsInHub = readyItemsInHub.length;
    const soldUnitsInHub = allItemsInHub.filter((it) => it.statusUnit === 'SOLD').length;
    const estPartnerCapital = readyItemsInHub.reduce((acc, it) => acc + (it.modal || 0), 0);

    // Filtered deals in active filter
    const hubDeals = filteredDeals.filter((d) => matchWarehouseHub(d.lokasiGudang, d.asalGudang, d.sku, warehouseFilter));
    const hubDealsCount = hubDeals.length;

    const ratioVsGlobalReady = allHubsSupply.totalReadyGlobal > 0
      ? Math.round((readyUnitsInHub / allHubsSupply.totalReadyGlobal) * 100)
      : 0;

    const ratioVsHubTotal = totalUnitsInHub > 0
      ? Math.round((readyUnitsInHub / totalUnitsInHub) * 100)
      : 0;

    return {
      ...hub,
      availableUnits: readyUnitsInHub,
      estPartnerCapital,
      totalUnitsInHub,
      soldUnitsInHub,
      hubDealsCount,
      ratioVsGlobalReady,
      ratioVsHubTotal,
      totalReadyGlobal: allHubsSupply.totalReadyGlobal,
      totalCapitalGlobal: allHubsSupply.totalCapitalGlobal,
      totalAllUnitsGlobal: allHubsSupply.totalAllUnitsGlobal,
    };
  }, [warehouseFilter, allHubsSupply, inventoryItems, filteredDeals, categoryFilter]);

  // 8. DUAL-MODE EXECUTIVE RISKS & OPPORTUNITIES INTELLIGENCE
  const executiveIntelligence = useMemo(() => {
    const isSalesWaMode = channelFilter === 'SALES_BBK';

    // 1. STOK READY POTENTIAL (Unlocked Gross Profit & Margins)
    let totalReadyUnits = 0;
    let totalReadyModal = 0;
    let totalReadyEstimasiJual = 0;
    let slowMovingUnits = 0;
    let slowMovingModal = 0;
    const nowMs = Date.now();

    // Grouping ready stock by hub
    const hubStockMap = new Map<string, {
      code: string;
      label: string;
      readyUnits: number;
      modalSum: number;
      priceSum: number;
      avgModal: number;
      avgPrice: number;
      spreadRp: number;
      spreadMarginPct: number;
      slowMovingCount: number;
      slowMovingModal: number;
    }>();

    // Grouping ready stock by category
    const catStockMap = new Map<string, {
      category: string;
      readyUnits: number;
      modalSum: number;
      priceSum: number;
      avgModal: number;
      avgPrice: number;
      spreadRp: number;
      spreadMarginPct: number;
    }>();

    inventoryItems.forEach((item) => {
      const isReady = item.statusUnit === 'READY' || item.statusUnit === 'AVAILABLE';
      const catMatch = matchCategory(item.sku, item.category, categoryFilter);
      const whMatch = matchWarehouseHub(item.warehouse, item.asalGudang, item.sku, warehouseFilter);

      if (!catMatch || !whMatch) return;

      if (isReady) {
        const itemModal = item.modal || 0;
        const itemPrice = item.price > 0 ? item.price : Math.round(itemModal * 1.35);

        totalReadyUnits++;
        totalReadyModal += itemModal;
        totalReadyEstimasiJual += itemPrice;

        // Calculate aging (>60 days in stock considered slow-moving)
        let isSlowMoving = false;
        if (item.inDate) {
          const inMs = new Date(item.inDate).getTime();
          if (!isNaN(inMs)) {
            const ageDays = Math.floor((nowMs - inMs) / (1000 * 60 * 60 * 24));
            if (ageDays > 60) {
              isSlowMoving = true;
              slowMovingUnits++;
              slowMovingModal += itemModal;
            }
          }
        }

        // Hub grouping
        const hubCode = resolveHubCode(item.asalGudang, item.warehouse, item.sku) || (item.asalGudang ? item.asalGudang.toUpperCase() : 'GK');
        const hubLabel = WAREHOUSE_13_HUBS.find((h) => h.code === hubCode)?.partnerName || `${hubCode} Hub`;
        if (!hubStockMap.has(hubCode)) {
          hubStockMap.set(hubCode, {
            code: hubCode,
            label: `${hubCode} - ${hubLabel}`,
            readyUnits: 0,
            modalSum: 0,
            priceSum: 0,
            avgModal: 0,
            avgPrice: 0,
            spreadRp: 0,
            spreadMarginPct: 0,
            slowMovingCount: 0,
            slowMovingModal: 0,
          });
        }
        const hEntry = hubStockMap.get(hubCode)!;
        hEntry.readyUnits++;
        hEntry.modalSum += itemModal;
        hEntry.priceSum += itemPrice;
        if (isSlowMoving) {
          hEntry.slowMovingCount++;
          hEntry.slowMovingModal += itemModal;
        }

        // Category grouping
        const cat = resolveCategoryBucket(item.sku, item.category);
        if (!catStockMap.has(cat)) {
          catStockMap.set(cat, {
            category: cat,
            readyUnits: 0,
            modalSum: 0,
            priceSum: 0,
            avgModal: 0,
            avgPrice: 0,
            spreadRp: 0,
            spreadMarginPct: 0,
          });
        }
        const cEntry = catStockMap.get(cat)!;
        cEntry.readyUnits++;
        cEntry.modalSum += itemModal;
        cEntry.priceSum += itemPrice;
      }
    });

    const totalPotentialGrossProfit = Math.max(0, totalReadyEstimasiJual - totalReadyModal);
    const avgPotentialMarginPct = totalReadyEstimasiJual > 0 ? Math.round((totalPotentialGrossProfit / totalReadyEstimasiJual) * 100) : 0;

    // Finalize hub stats
    const hubStatsList = Array.from(hubStockMap.values()).map((h) => {
      const avgModal = h.readyUnits > 0 ? Math.round(h.modalSum / h.readyUnits) : 0;
      const avgPrice = h.readyUnits > 0 ? Math.round(h.priceSum / h.readyUnits) : 0;
      const spreadRp = Math.max(0, avgPrice - avgModal);
      const spreadMarginPct = avgPrice > 0 ? Math.round((spreadRp / avgPrice) * 100) : 0;
      return { ...h, avgModal, avgPrice, spreadRp, spreadMarginPct };
    });

    // 2. HUB ARBITRAGE (Hub Termurah & Spread Margin Tertinggi)
    const activeHubsWithStock = hubStatsList.filter((h) => h.readyUnits > 0);
    const cheapestHubs = [...activeHubsWithStock].sort((a, b) => a.avgModal - b.avgModal);
    const highestSpreadHubs = [...activeHubsWithStock].sort((a, b) => b.spreadMarginPct - a.spreadMarginPct);

    // 3. BEST-VALUE OPPORTUNITIES (Categories with high demand + available ready stock + good spread)
    const catOpportunities = Array.from(catStockMap.values()).map((c) => {
      const avgModal = c.readyUnits > 0 ? Math.round(c.modalSum / c.readyUnits) : 0;
      const avgPrice = c.readyUnits > 0 ? Math.round(c.priceSum / c.readyUnits) : 0;
      const spreadRp = Math.max(0, avgPrice - avgModal);
      const spreadMarginPct = avgPrice > 0 ? Math.round((spreadRp / avgPrice) * 100) : 0;
      const econ = categoryEconomics.find((e) => e.category === c.category);
      const unitsSold = econ?.unitsSold || 0;
      const realizedProfit = econ?.profitSum || 0;
      return {
        ...c,
        avgModal,
        avgPrice,
        spreadRp,
        spreadMarginPct,
        unitsSold,
        realizedProfit,
      };
    }).sort((a, b) => (b.unitsSold * b.spreadMarginPct) - (a.unitsSold * a.spreadMarginPct));

    // 4. RISKS: DEADSTOCK & AGING CONCENTRATION
    const hubsWithDeadstock = [...activeHubsWithStock].sort((a, b) => b.slowMovingModal - a.slowMovingModal);
    const topDeadstockHub = hubsWithDeadstock[0] || null;

    // 5. RISKS: MARGIN COMPRESSION (Categories with slim spread < 18%)
    const lowSpreadCats = catOpportunities.filter((c) => c.readyUnits > 0 && c.spreadMarginPct > 0 && c.spreadMarginPct < 18);

    // 6. RISKS: SUPPLY DEFICIT (High Demand > 10 units sold, but ready stock < 3 units)
    const supplyDeficitCats = categoryEconomics
      .filter((e) => e.unitsSold >= 10 && e.readyUnits <= 3)
      .sort((a, b) => b.unitsSold - a.unitsSold);

    // 7. REALIZED SALES WA INSIGHTS (When in Sales WA mode)
    const topRealizedProfitCat = [...categoryEconomics].sort((a, b) => b.profitSum - a.profitSum)[0] || null;
    const topRealizedMarginCat = [...categoryEconomics].filter((c) => c.unitsSold >= 2).sort((a, b) => b.marginPct - a.marginPct)[0] || null;
    const lowRealizedMarginCat = [...categoryEconomics].filter((c) => c.unitsSold >= 2 && c.marginPct < 15).sort((a, b) => a.marginPct - b.marginPct)[0] || null;

    return {
      isSalesWaMode,
      totalReadyUnits,
      totalReadyModal,
      totalReadyEstimasiJual,
      totalPotentialGrossProfit,
      avgPotentialMarginPct,
      slowMovingUnits,
      slowMovingModal,
      cheapestHubs,
      highestSpreadHubs,
      catOpportunities,
      topDeadstockHub,
      lowSpreadCats,
      supplyDeficitCats,
      topRealizedProfitCat,
      topRealizedMarginCat,
      lowRealizedMarginCat,
      activeHubCount: activeHubsWithStock.length,
    };
  }, [inventoryItems, categoryEconomics, channelFilter, categoryFilter, warehouseFilter, resolveCategoryBucket]);

  if (!permissions?.canViewFinanceReports && role !== 'ADMIN') {
    return (
      <div className="p-8 bg-slate-900/80 border border-slate-800 rounded-2xl text-center space-y-3">
        <Lock className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-white">Akses Keuangan Terbatas</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Modul Keuangan memerlukan izin hak akses laporan finansial (canViewFinanceReports). Hubungi Administrator untuk mengaktifkan izin ini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. HEADER & REFRESH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2 font-mono">
            <Banknote className="w-6 h-6 text-emerald-400" />
            <span>EXECUTIVE OWNER DASHBOARD & FINANCIALS</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Ringkasan 30-detik performa bisnis: Penjualan, Margin Laba Kotor, Pertumbuhan, Demand & Supply Rekanan.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsRefreshing(true);
            loadData();
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Memuat Data...' : 'Sync Real-Time'}</span>
        </button>
      </div>

      {/* 2. FILTER UTAMA (PERIODE, CHANNEL, KATEGORI, HUB) */}
      <div ref={filterBarRef} className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4.5 space-y-3 shadow-xl transition-all">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-200">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span>Filter Utama Bisnis</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Menganalisa <strong className="text-emerald-400">{filteredDeals.length}</strong> deal closing & <strong className="text-amber-400">{filteredInventory.length}</strong> unit stok live
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Periode Preset */}
          <div>
            <label className="block text-slate-400 font-bold mb-1">📅 Periode Waktu:</label>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold text-xs"
            >
              {getDynamicDatePresetOptions(now).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Channel Closing */}
          <div>
            <label className="block text-slate-400 font-bold mb-1">💼 Channel Closing:</label>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold text-xs"
            >
              <option value="ALL">Semua Channel ({deals.length} Total)</option>
              <option value="SALES_BBK">Sales WhatsApp BBKitchen</option>
              <option value="THIRD_PARTY">Rekanan Gudang / Pihak Ketiga</option>
            </select>
          </div>

          {/* Kategori */}
          <div>
            <label className="block text-slate-400 font-bold mb-1">📁 Kategori Produk:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold text-xs"
            >
              <option value="ALL">Semua Kategori</option>
              {OFFICIAL_CATEGORIES.map((group) => (
                <optgroup key={group.slug} label={group.name}>
                  <option value={group.name}>{group.name} (Semua)</option>
                  {group.children.map((child) => (
                    <option key={child.slug} value={child.name}>
                      &nbsp;&nbsp;↳ {child.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Hub Rekanan Gudang */}
          <div>
            <label className="block text-slate-400 font-bold mb-1">🏢 Hub Rekanan:</label>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold text-xs"
            >
              <option value="ALL">Semua Hub Rekanan (13 Hub)</option>
              {WAREHOUSE_13_HUBS.map((hub) => (
                <option key={hub.code} value={hub.code}>
                  {hub.code} - {hub.partnerName} ({hub.hubGroup})
                </option>
              ))}
            </select>
          </div>

          {/* Custom Date Inputs */}
          {datePreset === 'CUSTOM' && (
            <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-bold shrink-0">Dari:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-bold shrink-0">Sampai:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. FINANCIAL HEALTH (REVENUE, GROSS PROFIT, MARGIN, ORDERS, UNITS) */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>1. Financial Health (Kesehatan Finansial)</span>
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-mono font-bold">
            Realized Closing Data
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Revenue */}
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Penjualan (Revenue)</span>
            <div className="text-lg sm:text-xl font-black text-emerald-400 font-mono">
              {formatIDR(healthKPIs.revenue)}
            </div>
            <p className="text-[10px] text-slate-500">Closing Sales WhatsApp</p>
          </div>

          {/* Gross Profit */}
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Gross Profit (Laba Kotor)</span>
            <div className="text-lg sm:text-xl font-black text-amber-400 font-mono">
              {formatIDR(healthKPIs.grossProfit)}
            </div>
            <p className="text-[10px] text-slate-500">Laba Bersih Realisasi</p>
          </div>

          {/* Gross Margin */}
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Gross Margin %</span>
            <div className="text-lg sm:text-xl font-black text-purple-400 font-mono">
              {healthKPIs.grossMarginPct}%
            </div>
            <p className="text-[10px] text-slate-500">Persentase Margin Rata-rata</p>
          </div>

          {/* Closing Deals / Orders */}
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Closing / Orders</span>
            <div className="text-lg sm:text-xl font-black text-white font-mono">
              {healthKPIs.totalDeals} <span className="text-xs font-normal text-slate-400">Deals</span>
            </div>
            <p className="text-[10px] text-slate-500">{healthKPIs.bbkSalesCount} WA • {healthKPIs.thirdPartyCount} Rekanan</p>
          </div>

          {/* Units Sold */}
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Units Sold (Terjual)</span>
            <div className="text-lg sm:text-xl font-black text-blue-400 font-mono">
              {healthKPIs.unitsSold} <span className="text-xs font-normal text-slate-400">Unit</span>
            </div>
            <p className="text-[10px] text-slate-500">Unit Fisik Terkirim</p>
          </div>
        </div>

        {/* Revenue vs Gross Profit Chart */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Grafik Penjualan vs Laba Kotor (Revenue vs Gross Profit)</span>
              </h3>
              <p className="text-[11px] text-slate-400">Tren nominal omset penjualan dan profit riil berdasarkan periode aktif.</p>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            {timelineChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Tidak ada data transaksi closing pada periode ini.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickFormatter={(d) => d.slice(5)} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(0)}Jt`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                    formatter={(val: any) => formatIDR(Number(val))}
                  />
                  <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="revenue" name="Total Penjualan" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" dataKey="profit" name="Gross Profit" stroke="#f59e0b" fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. GROWTH (BISNIS NAIK ATAU TURUN?) */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span>2. Growth (Pertumbuhan Bisnis vs Periode Sebelumnya)</span>
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800 text-blue-400 font-mono font-bold">
            Period-over-Period
          </span>
        </div>

        {/* Growth Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Revenue Growth */}
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Revenue Growth</span>
            <div className={`text-lg sm:text-xl font-black font-mono flex items-center gap-1 ${growthKPIs.revenueGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {growthKPIs.revenueGrowth >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
              <span>{growthKPIs.revenueGrowth > 0 ? `+${growthKPIs.revenueGrowth}%` : `${growthKPIs.revenueGrowth}%`}</span>
            </div>
            <p className="text-[10px] text-slate-500">Lalu: {formatIDR(growthKPIs.prevRevenue)}</p>
          </div>

          {/* Profit Growth */}
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Profit Growth</span>
            <div className={`text-lg sm:text-xl font-black font-mono flex items-center gap-1 ${growthKPIs.profitGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {growthKPIs.profitGrowth >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
              <span>{growthKPIs.profitGrowth > 0 ? `+${growthKPIs.profitGrowth}%` : `${growthKPIs.profitGrowth}%`}</span>
            </div>
            <p className="text-[10px] text-slate-500">Lalu: {formatIDR(growthKPIs.prevProfit)}</p>
          </div>

          {/* Closing Growth */}
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Closing Growth</span>
            <div className={`text-lg sm:text-xl font-black font-mono flex items-center gap-1 ${growthKPIs.closingGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {growthKPIs.closingGrowth >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
              <span>{growthKPIs.closingGrowth > 0 ? `+${growthKPIs.closingGrowth}%` : `${growthKPIs.closingGrowth}%`}</span>
            </div>
            <p className="text-[10px] text-slate-500">Lalu: {growthKPIs.prevDealsCount} Deals</p>
          </div>

          {/* Unit Growth */}
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Unit Sold Growth</span>
            <div className={`text-lg sm:text-xl font-black font-mono flex items-center gap-1 ${growthKPIs.unitsGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {growthKPIs.unitsGrowth >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
              <span>{growthKPIs.unitsGrowth > 0 ? `+${growthKPIs.unitsGrowth}%` : `${growthKPIs.unitsGrowth}%`}</span>
            </div>
            <p className="text-[10px] text-slate-500">Lalu: {growthKPIs.prevUnitsSold} Unit</p>
          </div>
        </div>

        {/* Interactive Growth Performance Over Time Chart */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-400" />
                <span>Performance Over Time (Tren Performa Interaktif)</span>
              </h3>
              <p className="text-[11px] text-slate-400">Pilih metrik pertumbuhan yang ingin ditinjau sepanjang waktu.</p>
            </div>

            {/* Metric Switcher Tabs */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 text-xs">
              <button
                type="button"
                onClick={() => setGrowthMetric('REVENUE')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  growthMetric === 'REVENUE' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Penjualan
              </button>
              <button
                type="button"
                onClick={() => setGrowthMetric('PROFIT')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  growthMetric === 'PROFIT' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Profit
              </button>
              <button
                type="button"
                onClick={() => setGrowthMetric('CLOSING')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  growthMetric === 'CLOSING' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Closing Deals
              </button>
              <button
                type="button"
                onClick={() => setGrowthMetric('UNITS')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  growthMetric === 'UNITS' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Units
              </button>
            </div>
          </div>

          <div className="h-60 w-full pt-2">
            {timelineChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Tidak ada data pada periode ini.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickFormatter={(d) => d.slice(5)} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(val) =>
                      growthMetric === 'REVENUE' || growthMetric === 'PROFIT'
                        ? `Rp ${(val / 1000000).toFixed(0)}Jt`
                        : `${val}`
                    }
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                    formatter={(val: any) =>
                      growthMetric === 'REVENUE' || growthMetric === 'PROFIT'
                        ? formatIDR(Number(val))
                        : `${val} Unit/Deal`
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey={
                      growthMetric === 'REVENUE'
                        ? 'revenue'
                        : growthMetric === 'PROFIT'
                        ? 'profit'
                        : growthMetric === 'CLOSING'
                        ? 'closing'
                        : 'units'
                    }
                    name={
                      growthMetric === 'REVENUE'
                        ? 'Penjualan'
                        : growthMetric === 'PROFIT'
                        ? 'Gross Profit'
                        : growthMetric === 'CLOSING'
                        ? 'Jumlah Closing'
                        : 'Jumlah Unit'
                    }
                    stroke={
                      growthMetric === 'REVENUE'
                        ? '#10b981'
                        : growthMetric === 'PROFIT'
                        ? '#f59e0b'
                        : growthMetric === 'CLOSING'
                        ? '#3b82f6'
                        : '#a855f7'
                    }
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. UNIT ECONOMICS (PRODUK MANA YANG MENGHASILKAN?) */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Percent className="w-4 h-4 text-amber-400" />
            <span>3. Unit Economics (Rata-Rata per Transaksi Unit)</span>
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-400 font-mono font-bold">
            Average Economics
          </span>
        </div>

        {/* 4 Unit Economics Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Average Selling Price (ASP)</span>
            <div className="text-lg sm:text-xl font-black text-emerald-400 font-mono">
              {formatIDR(unitEconomicsAverages.asp)}
            </div>
            <p className="text-[10px] text-slate-500">Rata-rata Harga Closing</p>
          </div>

          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Average HPP Modal</span>
            <div className="text-lg sm:text-xl font-black text-indigo-400 font-mono">
              {formatIDR(unitEconomicsAverages.avgHpp)}
            </div>
            <p className="text-[10px] text-slate-500">Rata-rata HPP per Unit</p>
          </div>

          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Average Profit per Unit</span>
            <div className="text-lg sm:text-xl font-black text-amber-400 font-mono">
              {formatIDR(unitEconomicsAverages.avgProfit)}
            </div>
            <p className="text-[10px] text-slate-500">Laba Kotor per Transaksi</p>
          </div>

          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Average Margin</span>
            <div className="text-lg sm:text-xl font-black text-purple-400 font-mono">
              {unitEconomicsAverages.avgMargin}%
            </div>
            <p className="text-[10px] text-slate-500">Rata-rata Margin Realisasi</p>
          </div>
        </div>

        {/* Top Products / Categories Chart */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Top Kategori / Produk Paling Menguntungkan</span>
              </h3>
              <p className="text-[11px] text-slate-400">Peringkat kontribusi keuntungan per kategori mesin restoran.</p>
            </div>

            {/* Toggle Profit / Margin / Units Sold */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 text-xs">
              <button
                type="button"
                onClick={() => setUnitEconMetric('PROFIT')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  unitEconMetric === 'PROFIT' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Laba Kotor (Rp)
              </button>
              <button
                type="button"
                onClick={() => setUnitEconMetric('MARGIN')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  unitEconMetric === 'MARGIN' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Margin (%)
              </button>
              <button
                type="button"
                onClick={() => setUnitEconMetric('UNITS')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  unitEconMetric === 'UNITS' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Unit Terjual
              </button>
            </div>
          </div>

          <div className="h-60 w-full pt-2">
            {topCategoriesChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Tidak ada data kategori yang sesuai.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCategoriesChartData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="category" stroke="#94a3b8" fontSize={10} interval={0} angle={-10} textAnchor="end" />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(val) =>
                      unitEconMetric === 'PROFIT'
                        ? `Rp ${(val / 1000000).toFixed(0)}Jt`
                        : unitEconMetric === 'MARGIN'
                        ? `${val}%`
                        : `${val}`
                    }
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                    formatter={(val: any) =>
                      unitEconMetric === 'PROFIT'
                        ? formatIDR(Number(val))
                        : unitEconMetric === 'MARGIN'
                        ? `${val}%`
                        : `${val} Unit Terjual`
                    }
                  />
                  <Bar
                    dataKey="value"
                    name={
                      unitEconMetric === 'PROFIT'
                        ? 'Total Gross Profit'
                        : unitEconMetric === 'MARGIN'
                        ? 'Margin %'
                        : 'Unit Terjual'
                    }
                    fill={unitEconMetric === 'PROFIT' ? '#f59e0b' : unitEconMetric === 'MARGIN' ? '#a855f7' : '#10b981'}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. DEMAND & SUPPLY (SUPPLY ADA DI MANA?) */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Building className="w-4 h-4 text-indigo-400" />
            <span>4. Demand & Supply Rekanan</span>
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800 text-indigo-400 font-mono font-bold">
            Stok Siap Jual Rekanan Gudang
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Panel DEMAND: Top Products by Units Sold */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    DEMAND: {categoryFilter !== 'ALL' ? 'Subkategori' : 'Kategori'} Paling Cepat Terjual
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {topDemandCategories.length} {categoryFilter !== 'ALL' ? 'Subkategori' : 'Kategori'}
                </span>
              </div>

              <div className="divide-y divide-slate-800/60 mt-1 max-h-52 overflow-y-auto pr-1">
                {topDemandCategories.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">Tidak ada transaksi pada filter ini.</p>
                ) : (
                  topDemandCategories.map((item, idx) => (
                    <div key={item.category} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span className="w-5 h-5 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-[10px] text-amber-400 font-mono shrink-0">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <span className="font-bold text-slate-200 block truncate" title={item.category}>
                            {item.category}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {item.unitsSold > 0 ? `ASP: ${formatIDR(item.asp)}` : `${item.readyUnits} Unit Ready`}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-emerald-400">
                          {item.unitsSold} Unit Terjual
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {item.unitsSold > 0 ? `Margin: ${item.marginPct}%` : `${item.readyUnits} Stok Ready`}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <p className="text-[10px] text-slate-500 border-t border-slate-800/60 pt-2">
              💡 Seluruh {categoryFilter !== 'ALL' ? 'subkategori' : 'kategori'} dapat discroll untuk memantau demand penjualan dan ketersediaan stok.
            </p>
          </div>

          {/* Panel SUPPLY: Overview by Filter vs Full Ranked List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-3 flex flex-col justify-between">
            {selectedHubOverview ? (
              /* FOCUSED OVERVIEW WHEN HUB FILTER IS SELECTED */
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      SUPPLY: OVERVIEW {categoryFilter !== 'ALL' ? `${categoryFilter.toUpperCase().replace(' (SEMUA)', '')} ` : ''}GUDANG {selectedHubOverview.code}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWarehouseFilter('ALL')}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-mono flex items-center gap-1"
                    title="Kembali tampilkan semua hub rekanan"
                  >
                    <span>Semua Hub</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="pt-3 space-y-3">
                  {/* Valuasi Pergudang */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Valuasi Modal Stok Ready {categoryFilter !== 'ALL' ? categoryFilter.replace(' (Semua)', '') : ''} ({selectedHubOverview.code})
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono font-bold">
                        {selectedHubOverview.ratioVsGlobalReady}% Pasokan Global
                      </span>
                    </div>
                    <div className="text-xl font-black text-indigo-400 font-mono">
                      {formatIDR(selectedHubOverview.estPartnerCapital)}
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">{selectedHubOverview.label}</p>
                  </div>

                  {/* 2 Detail Rasio Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Rasio 1: vs Total Unit Ready Global */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-bold block">
                        Pasokan {categoryFilter !== 'ALL' ? categoryFilter.replace(' (Semua)', '') : ''} vs Total Ready Global:
                      </span>
                      <div className="font-mono text-xs font-bold text-slate-200">
                        <span className="text-indigo-400 font-black text-sm">{selectedHubOverview.availableUnits} Unit</span>
                        <span className="text-slate-400 text-xs"> / {selectedHubOverview.totalReadyGlobal} Unit Ready</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800 mt-1">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.max(2, selectedHubOverview.ratioVsGlobalReady))}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-indigo-300/90 font-mono block">
                        {selectedHubOverview.ratioVsGlobalReady}% dari seluruh pasokan mitra
                      </span>
                    </div>

                    {/* Rasio 2: vs Total Unit Terdata di Hub Ini */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-bold block">
                        Ketersediaan {categoryFilter !== 'ALL' ? categoryFilter.replace(' (Semua)', '') : ''} di Hub {selectedHubOverview.code}:
                      </span>
                      <div className="font-mono text-xs font-bold text-slate-200">
                        <span className="text-emerald-400 font-black text-sm">{selectedHubOverview.availableUnits} Unit</span>
                        <span className="text-slate-400 text-xs"> / {selectedHubOverview.totalUnitsInHub} Unit Terdata</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800 mt-1">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.max(2, selectedHubOverview.ratioVsHubTotal))}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {selectedHubOverview.ratioVsHubTotal}% Ready • <strong className="text-amber-400">{selectedHubOverview.soldUnitsInHub} Terjual</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* FULL RANKED LIST WHEN FILTER IS ALL */
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-400" />
                    <div>
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        SUPPLY: STOK SIAP JUAL REKANAN GUDANG
                      </h3>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">13 Hub Rekanan</span>
                </div>

                <div className="pt-2 pb-1 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Total: <strong className="text-indigo-400 font-mono">{allHubsSupply.totalReadyGlobal} Unit Ready</strong></span>
                  <span>Valuasi Modal: <strong className="text-slate-200 font-mono">{formatIDR(allHubsSupply.totalCapitalGlobal)}</strong></span>
                </div>

                <div className="divide-y divide-slate-800/60 mt-1 max-h-52 overflow-y-auto pr-1">
                  {allHubsSupply.list.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">Tidak ada unit ready di hub rekanan.</p>
                  ) : (
                    allHubsSupply.list.map((hub) => (
                      <button
                        key={hub.code}
                        type="button"
                        onClick={() => setWarehouseFilter(hub.code)}
                        className="w-full py-2.5 flex items-center justify-between text-xs hover:bg-slate-850/60 px-2 rounded-lg transition-colors text-left group"
                        title={`Klik untuk zoom filter ${hub.label}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono font-bold text-[10px] text-indigo-300 group-hover:border-indigo-600 transition-colors">
                            {hub.code}
                          </span>
                          <div>
                            <span className="font-semibold text-slate-200 block group-hover:text-white">{hub.label}</span>
                            <span className="text-[10px] text-slate-400">Modal: {formatIDR(hub.estPartnerCapital)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-indigo-400 block">{hub.availableUnits} Unit Ready</span>
                          <span className="text-[9px] text-slate-500">
                            {allHubsSupply.totalReadyGlobal > 0 ? `${Math.round((hub.availableUnits / allHubsSupply.totalReadyGlobal) * 100)}% total` : '0%'}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            <p className="text-[10px] text-slate-500 border-t border-slate-800/60 pt-2">
              ℹ️ Stok di atas adalah unit siap jual di lokasi rekanan gudang mitra BBKitchen.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. RISKS & OPPORTUNITIES: EXECUTIVE INTELLIGENCE MATRIX */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-300">
              5. Risks & Opportunities (Executive Intelligence Matrix)
            </h2>
          </div>
          <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-mono font-bold self-start sm:self-auto ${
            executiveIntelligence.isSalesWaMode
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
              : 'bg-indigo-950/80 border-indigo-800 text-indigo-300'
          }`}>
            {executiveIntelligence.isSalesWaMode
              ? '🎯 Mode: Realisasi Sales WA'
              : '💎 Mode: Potensi Arbitrase & Rekanan'}
          </span>
        </div>

        {/* Top 3 Metric Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Metric 1: Potential / Realized Profit */}
          <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>{executiveIntelligence.isSalesWaMode ? 'Realisasi Laba Bersih WA' : 'Potensi Laba Kotor Stok Ready'}</span>
            </span>
            <div className="text-lg font-black text-emerald-400 font-mono">
              {executiveIntelligence.isSalesWaMode
                ? formatIDR(healthKPIs.grossProfit)
                : formatIDR(executiveIntelligence.totalPotentialGrossProfit)}
            </div>
            <p className="text-[10px] text-slate-400">
              {executiveIntelligence.isSalesWaMode
                ? `Margin Realisasi: ${healthKPIs.grossMarginPct}% dari ${healthKPIs.unitsSold} unit`
                : `Spread potensi margin ${executiveIntelligence.avgPotentialMarginPct}% dari ${executiveIntelligence.totalReadyUnits} unit ready`}
            </p>
          </div>

          {/* Metric 2: Cheapest Supply Hub */}
          <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-indigo-400" />
              <span>Hub Pasokan Termurah</span>
            </span>
            <div className="text-lg font-black text-indigo-400 font-mono truncate" title={executiveIntelligence.cheapestHubs[0]?.label || 'Semua Hub'}>
              {executiveIntelligence.cheapestHubs[0] ? executiveIntelligence.cheapestHubs[0].code : '-'}
              <span className="text-xs font-normal text-slate-300 ml-1.5">
                ({executiveIntelligence.cheapestHubs[0] ? formatIDR(executiveIntelligence.cheapestHubs[0].avgModal) : 'Rp 0'})
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {executiveIntelligence.cheapestHubs[0]
                ? `${executiveIntelligence.cheapestHubs[0].label} (${executiveIntelligence.cheapestHubs[0].readyUnits} unit)`
                : 'Belum ada data unit ready'}
            </p>
          </div>

          {/* Metric 3: Locked Slow-Moving Capital */}
          <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Modal Tertahan (Aging &gt;60 Hari)</span>
            </span>
            <div className="text-lg font-black text-amber-400 font-mono">
              {formatIDR(executiveIntelligence.slowMovingModal)}
            </div>
            <p className="text-[10px] text-slate-400">
              {executiveIntelligence.slowMovingUnits > 0
                ? `${executiveIntelligence.slowMovingUnits} unit siap jual butuh program akselerasi sales`
                : 'Seluruh unit ready berada dalam siklus perputaran sehat'}
            </p>
          </div>
        </div>

        {/* 2-Column Split Deep Analytical Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* PANEL 1 (KIRI): OPPORTUNITIES & SUPPLY ARBITRAGE */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-3.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Peluang &amp; Arbitrase Pasokan Termurah
                  </h3>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">Cost Advantage</span>
              </div>

              {/* Sub-item A: Cheapest Hubs Comparison Table */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  🏭 4 Hub dengan Modal Rata-Rata Termurah:
                </span>
                <div className="divide-y divide-slate-800/60 bg-slate-950/60 rounded-xl border border-slate-800/80 p-2">
                  {executiveIntelligence.cheapestHubs.slice(0, 4).length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center">Tidak ada stok ready pada filter ini.</p>
                  ) : (
                    executiveIntelligence.cheapestHubs.slice(0, 4).map((hub, idx) => (
                      <div key={hub.code} className="py-1.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="w-4 h-4 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-[9px] text-indigo-300 font-mono shrink-0">
                            {idx + 1}
                          </span>
                          <div className="truncate">
                            <span className="font-semibold text-slate-200 block truncate">{hub.label}</span>
                            <span className="text-[10px] text-slate-400">
                              Modal: <strong className="text-slate-300 font-mono">{formatIDR(hub.avgModal)}</strong> • Ready: {hub.readyUnits} Unit
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-emerald-400 block">+{formatIDR(hub.spreadRp)}</span>
                          <span className="text-[9px] text-emerald-300/80 font-mono">Potensi {hub.spreadMarginPct}% Margin</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sub-item B: Top Recommended Fast-Moving Pitch */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  🚀 Kategori Prioritas Pitching Sales (Demand + Stok):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {executiveIntelligence.catOpportunities.slice(0, 2).map((cat) => (
                    <div key={cat.category} className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                      <span className="font-bold text-xs text-slate-200 block truncate" title={cat.category}>
                        {cat.category}
                      </span>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 font-mono">{cat.readyUnits} Unit Ready</span>
                        <span className="text-emerald-400 font-bold font-mono">Spread: {formatIDR(cat.spreadRp)}</span>
                      </div>
                      <div className="text-[9px] text-indigo-300 flex items-center justify-between">
                        <span>Terjual: {cat.unitsSold} unit</span>
                        <span className="font-bold">{cat.spreadMarginPct}% Margin</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 border-t border-slate-800/60 pt-2">
              💡 Rekomendasi pasokan di atas memberikan spread keuntungan tertinggi untuk penawaran sales.
            </p>
          </div>

          {/* PANEL 2 (KANAN): RISKS, AGING & SUPPLY DEFICIT */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-3.5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Risiko, Aging &amp; Defisit Pasokan
                  </h3>
                </div>
                <span className="text-[10px] text-rose-400 font-mono font-bold">Capital Guardrail</span>
              </div>

              {/* Sub-item A: Deadstock / Aging Concentration */}
              <div className="p-3 bg-slate-950/80 border border-rose-950/60 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Konsentrasi Modal Tertahan Terbesar</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-mono font-bold">
                    Slow-Moving
                  </span>
                </div>
                {executiveIntelligence.topDeadstockHub && executiveIntelligence.topDeadstockHub.slowMovingModal > 0 ? (
                  <div>
                    <div className="text-xs font-bold text-white flex items-center justify-between mt-0.5">
                      <span className="truncate">{executiveIntelligence.topDeadstockHub.label}</span>
                      <span className="text-rose-400 font-mono font-black">{formatIDR(executiveIntelligence.topDeadstockHub.slowMovingModal)}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Terdapat {executiveIntelligence.topDeadstockHub.slowMovingCount} unit mengendap &gt;60 hari. Disarankan program bundling atau flash sale.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-1">Tidak terdeteksi modal tertahan signifikan pada filter ini.</p>
                )}
              </div>

              {/* Sub-item B: Supply Deficit Warning (High Demand, Low Stock) */}
              <div className="p-3 bg-slate-950/80 border border-amber-950/60 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    <span>Peringatan Defisit Pasokan (Demand &gt; Stok)</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 font-mono font-bold">
                    Restock Alert
                  </span>
                </div>
                {executiveIntelligence.supplyDeficitCats.length > 0 ? (
                  <div>
                    <div className="text-xs font-bold text-slate-200 flex items-center justify-between mt-0.5">
                      <span className="truncate">{executiveIntelligence.supplyDeficitCats[0].category}</span>
                      <span className="text-amber-400 font-mono">{executiveIntelligence.supplyDeficitCats[0].readyUnits} Unit Ready</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Demand pasar tinggi ({executiveIntelligence.supplyDeficitCats[0].unitsSold} unit terjual), namun pasokan siap jual kritis. Segera tambah pasokan rekanan.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-1">Rasio pasokan siap jual terhadap demand pasar dalam kondisi seimbang.</p>
                )}
              </div>

              {/* Sub-item C: Margin Compression Warning */}
              {executiveIntelligence.lowSpreadCats.length > 0 && (
                <div className="px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Spread Margin Tipis:</span>
                    <span className="font-semibold text-slate-200 text-[11px]">{executiveIntelligence.lowSpreadCats[0].category}</span>
                  </div>
                  <span className="text-[10px] text-rose-300 font-mono font-bold">
                    Hanya {executiveIntelligence.lowSpreadCats[0].spreadMarginPct}% spread
                  </span>
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-500 border-t border-slate-800/60 pt-2">
              ℹ️ Pantau modal tertahan secara berkala untuk menjaga kecepatan perputaran kas (cash conversion).
            </p>
          </div>
        </div>

        {/* PANEL 3 (BAWAH): STRATEGIC ACTION PLAN */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-900/50 rounded-2xl p-4 space-y-2.5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Strategic Action Plan (Rekomendasi Tindakan 30 Detik)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Executive Guidance</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Action 1: Sales Action */}
            <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                🎯 Aksi Sales Desk:
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {executiveIntelligence.catOpportunities[0] && executiveIntelligence.cheapestHubs[0]
                  ? `Push promosi ${executiveIntelligence.catOpportunities[0].category} dari ${executiveIntelligence.cheapestHubs[0].label} karena memiliki spread potensi margin ${executiveIntelligence.cheapestHubs[0].spreadMarginPct}% (modal terendah ${formatIDR(executiveIntelligence.cheapestHubs[0].avgModal)}).`
                  : 'Fokuskan penawaran pada unit-unit dengan HPP modal di bawah rata-rata pasar untuk mengamankan margin tebal.'}
              </p>
            </div>

            {/* Action 2: Procurement & Warehouse Action */}
            <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                📦 Aksi Pengadaan &amp; Gudang:
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {executiveIntelligence.supplyDeficitCats.length > 0
                  ? `Prioritaskan pengadaan unit ${executiveIntelligence.supplyDeficitCats[0].category} dari mitra rekanan karena stok siap jual menipis (${executiveIntelligence.supplyDeficitCats[0].readyUnits} unit) di tengah tingginya permintaan.`
                  : executiveIntelligence.topDeadstockHub && executiveIntelligence.topDeadstockHub.slowMovingModal > 0
                  ? `Terapkan strategi cuci gudang/diskon khusus pada unit slow-moving di ${executiveIntelligence.topDeadstockHub.label} untuk melepaskan modal tertahan.`
                  : 'Pertahankan kapasitas pasokan saat ini karena perputaran stok di seluruh hub berjalan seimbang.'}
              </p>
            </div>

            {/* Action 3: Pricing Strategy */}
            <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">
                🏷️ Strategi Penetapan Harga:
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {executiveIntelligence.isSalesWaMode
                  ? `Realisasi margin rata-rata saat ini sebesar ${healthKPIs.grossMarginPct}%. Pertahankan floor price penawaran awal agar tidak terdiskon di bawah 18%.`
                  : `Potensi laba kotor stok siap jual mencapai ${formatIDR(executiveIntelligence.totalPotentialGrossProfit)}. Konversi calon pembeli langsung via Sales WA untuk menangkap margin tersebut.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. BUKU REKAP CLOSING DEAL LEDGER (TABLE & 4-IN-1 DOCUMENT PRINT) */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden space-y-0 shadow-xl">
        <div className="p-4.5 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900">
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              <span>Buku Rekap Closing Deal Ledger ({filteredDeals.length} Transaksi)</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Daftar transaksi closing riil. Hanya transaksi Sales BBKitchen yang memiliki berkas dokumen resmi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Box */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari SKU / nama..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Top Pagination Controls */}
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-mono text-slate-300">
                <span className="text-[11px] text-slate-400">Hal</span>
                <input
                  type="number"
                  min={1}
                  max={dealTotalPages}
                  value={dealPageInput}
                  onChange={(e) => setDealPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const num = parseInt(dealPageInput, 10);
                      if (!isNaN(num) && num >= 1 && num <= dealTotalPages) {
                        setDealPage(num);
                      } else {
                        setDealPageInput(String(dealPage));
                      }
                    }
                  }}
                  onBlur={() => {
                    const num = parseInt(dealPageInput, 10);
                    if (!isNaN(num) && num >= 1 && num <= dealTotalPages) {
                      setDealPage(num);
                    } else {
                      setDealPageInput(String(dealPage));
                    }
                  }}
                  className="w-12 px-1.5 py-0.5 text-center bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  title="Ketik nomor halaman & tekan Enter"
                />
                <span className="text-[11px] text-slate-400">dari {dealTotalPages}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={dealPage <= 1 || isLoading}
                  onClick={() => setDealPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={dealPage >= dealTotalPages || isLoading}
                  onClick={() => setDealPage((p) => Math.min(dealTotalPages, p + 1))}
                  className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Halaman Selanjutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3.5">SKU Unit</th>
                <th className="py-3 px-3.5">Nama Mesin & Deskripsi</th>
                <th className="py-3 px-3.5">Tanggal Terjual</th>
                <th className="py-3 px-3.5">Durasi (Aging)</th>
                <th className="py-3 px-3.5">Lokasi Gudang</th>
                <th className="py-3 px-3.5 text-right">Modal (HPP)</th>
                <th className="py-3 px-3.5 text-right text-amber-400">Harga Closing</th>
                <th className="py-3 px-3.5 text-right text-emerald-400">Realized Profit</th>
                <th className="py-3 px-3.5 text-center">Channel</th>
                <th className="py-3 px-3.5 text-center">Dokumen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
                    Memuat data closing ledger...
                  </td>
                </tr>
              ) : paginatedDeals.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    Tidak ada transaksi closing deal pada filter yang dipilih.
                  </td>
                </tr>
              ) : (
                paginatedDeals.map((deal) => {
                  const isItemNonSku = deal.isNonSku || deal.sku.startsWith('BBK-CUSTOM') || deal.sku.startsWith('INV-');
                  const isMultiItem = (deal.itemsCount && deal.itemsCount > 1) || (deal.items && deal.items.length > 1);
                  const isFilterActive = warehouseFilter !== 'ALL' || categoryFilter !== 'ALL';
                  const rowMetrics = getDealFilteredMetrics(deal, warehouseFilter, categoryFilter);

                  const displayRevenue = isFilterActive ? rowMetrics.revenue : (deal.hargaClosing > 0 ? deal.hargaClosing : (deal.hargaModal || 0));
                  const displayModal = isFilterActive ? rowMetrics.cogs : deal.hargaModal;
                  const displayProfit = isFilterActive ? rowMetrics.profit : deal.realizedProfit;
                  const displayMargin = displayRevenue > 0 ? Math.round((displayProfit / displayRevenue) * 100) : 0;
                  const displayUnits = isFilterActive ? rowMetrics.units : (deal.quantity || 1);

                  // Find matching items in multi-item invoice
                  const matchingItems = isMultiItem && deal.items
                    ? deal.items.filter((it) => {
                        const itemWh = it.warehouseLocation || it.asalGudang || '';
                        const itemCat = it.condition || it.category || '';
                        const itemTitle = it.description || it.sku || '';
                        return (
                          matchWarehouseHub(itemWh, it.asalGudang || itemWh, it.sku || deal.sku, warehouseFilter) &&
                          matchCategory(itemTitle, itemCat, categoryFilter)
                        );
                      })
                    : [];

                  const firstMatch = matchingItems[0];
                  const rowAsalGudang = (isFilterActive && firstMatch?.warehouseLocation)
                    ? firstMatch.warehouseLocation
                    : (deal.asalGudang || 'GK');

                  const rowProductTitle = (isFilterActive && isMultiItem && matchingItems.length > 0)
                    ? matchingItems.map((it) => `${(it.quantity || 1) > 1 ? `${it.quantity}x ` : ''}${it.description || it.sku}`).join(' • ')
                    : deal.productTitle;

                  const rowKey = `${deal.sku}_${deal.invoiceNumber || ''}_${deal.tanggalTerjual || ''}`;
                  return (
                    <tr key={rowKey} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-3 px-3.5 font-mono font-bold text-amber-400">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{deal.sku}</span>
                          {isMultiItem && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950/90 text-amber-300 border border-amber-800">
                              {isFilterActive && matchingItems.length > 0
                                ? `${displayUnits} Unit (Filtered)`
                                : `${deal.itemsCount || deal.items?.length || 1} Item (${deal.quantity || 1} Unit)`}
                            </span>
                          )}
                          {isItemNonSku && !isMultiItem && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-950/90 text-purple-300 border border-purple-800">
                              Non-SKU
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 max-w-xs">
                        <p className="font-bold text-slate-200 line-clamp-2">{rowProductTitle}</p>
                        <p className="text-[10px] text-slate-500 line-clamp-1">{deal.notes}</p>
                      </td>
                      <td className="py-3 px-3.5 text-slate-300 font-mono text-[11px]">
                        {deal.tanggalTerjual || '-'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-400 font-mono text-[11px]">
                        {deal.durasiTerjual}
                      </td>
                      <td className="py-3 px-3.5 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono font-bold text-[10px] text-indigo-300">
                            {rowAsalGudang}
                          </span>
                          <span className="text-[11px] text-slate-300">
                            {resolveLocationFromCode(rowAsalGudang as any)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-slate-400">
                        {displayModal > 0 ? formatIDR(displayModal) : '-'}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-amber-400">
                        {displayRevenue > 0 ? formatIDR(displayRevenue) : (displayModal > 0 ? formatIDR(displayModal) : '-')}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-400">
                        {displayProfit > 0 ? (
                          <span>
                            +{formatIDR(displayProfit)} <span className="text-[10px] font-normal text-emerald-500/80">({displayMargin}%)</span>
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        {deal.soldBy === 'SALES_BBK' ? (
                          <span className="inline-flex items-center px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px] font-bold">
                            Sales BBK
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 bg-slate-950 text-slate-400 border border-slate-800 rounded text-[10px] font-bold">
                            Pihak Ketiga
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isItemNonSku && (
                            <button
                              type="button"
                              onClick={() => {
                                setResolveItem({
                                  invoiceId: '',
                                  invoiceNumber: deal.sku.replace('BBK-CUSTOM-', '').replace('INV-', '').split('_')[0],
                                  customSku: deal.sku,
                                  productTitle: deal.productTitle,
                                  sellingPrice: deal.hargaClosing,
                                  quantity: 1,
                                  currentModal: deal.hargaModal,
                                  isNonSku: true,
                                });
                                setIsResolveModalOpen(true);
                              }}
                              title="Rekonsiliasi / Resolve SKU Unit ini"
                              className="p-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-800 text-indigo-300 border border-indigo-800 transition-colors"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {deal.soldBy === 'SALES_BBK' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenDocFromDeal(deal, 'INVOICE')}
                                title="Cetak Faktur Tagihan (Invoice)"
                                className="p-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-800 text-amber-300 border border-amber-800 transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDocFromDeal(deal, 'DELIVERY_NOTE')}
                                title="Cetak Surat Jalan Pengiriman"
                                className="p-1.5 rounded-lg bg-orange-950/80 hover:bg-orange-800 text-orange-300 border border-orange-800 transition-colors"
                              >
                                <Truck className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            !isItemNonSku && <span className="text-slate-600 font-mono text-[11px]">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Bar */}
        {dealTotalPages > 1 && (
          <div className="p-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 bg-slate-900/60">
            <span className="text-[11px]">
              Menampilkan {((dealPage - 1) * dealPageSize) + 1} - {Math.min(dealPage * dealPageSize, filteredDeals.length)} dari {filteredDeals.length} Transaksi Closing
            </span>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 font-mono text-slate-300">
                <span className="text-[11px] text-slate-400">Hal</span>
                <input
                  type="number"
                  min={1}
                  max={dealTotalPages}
                  value={dealPageInput}
                  onChange={(e) => setDealPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const num = parseInt(dealPageInput, 10);
                      if (!isNaN(num) && num >= 1 && num <= dealTotalPages) {
                        setDealPage(num);
                      } else {
                        setDealPageInput(String(dealPage));
                      }
                    }
                  }}
                  onBlur={() => {
                    const num = parseInt(dealPageInput, 10);
                    if (!isNaN(num) && num >= 1 && num <= dealTotalPages) {
                      setDealPage(num);
                    } else {
                      setDealPageInput(String(dealPage));
                    }
                  }}
                  className="w-12 px-1.5 py-0.5 text-center bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[11px] text-slate-400">dari {dealTotalPages}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={dealPage <= 1 || isLoading}
                  onClick={() => setDealPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={dealPage >= dealTotalPages || isLoading}
                  onClick={() => setDealPage((p) => Math.min(dealTotalPages, p + 1))}
                  className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Halaman Selanjutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4-IN-1 OFFICIAL DOCUMENT PRINT & PREVIEW MODAL */}
      {selectedInvoice && (
        <OfficialDocumentModal
          invoice={selectedInvoice}
          isOpen={isDocModalOpen}
          initialType={documentModalType}
          canPrint={role === 'ADMIN' || Boolean(permissions?.canEditInvoices)}
          onClose={() => setIsDocModalOpen(false)}
        />
      )}

      {/* RESOLVE NON-SKU MODAL */}
      {resolveItem && (
        <ResolveNonSkuModal
          isOpen={isResolveModalOpen}
          item={resolveItem}
          onClose={() => {
            setIsResolveModalOpen(false);
            setResolveItem(null);
          }}
          onSuccess={() => {
            loadData();
          }}
        />
      )}

      {/* FLOATING ACTION BUTTON (QUICK FILTER & SCROLL TO TOP FILTER) */}
      <button
        type="button"
        onClick={() => filterBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className="fixed bottom-6 right-6 z-40 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-[0_8px_30px_rgb(5,150,105,0.4)] border border-emerald-400/50 backdrop-blur-md flex items-center gap-2 hover:scale-105 active:scale-95 transition-all group"
        title="Scroll cepat ke Filter Utama Bisnis"
      >
        <Filter className="w-3.5 h-3.5 text-emerald-200 group-hover:rotate-12 transition-transform" />
        <span className="font-sans tracking-wide">Ubah Filter</span>
        <ArrowUp className="w-3.5 h-3.5 text-emerald-200 group-hover:-translate-y-0.5 transition-transform" />
      </button>
    </div>
  );
}
