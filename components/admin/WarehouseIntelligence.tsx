'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/auth-context';
import { MasterInventoryItem, WarehouseCode } from '@/lib/types/inventory';
import { WAREHOUSE_14_HUBS, formatIDR } from '@/lib/repositories/warehouse-utils';
import { StatusBadge } from '@/components/ui/StatusBadges';
import {
  Warehouse,
  Clock,
  AlertTriangle,
  Flame,
  RefreshCw,
  Search,
  DollarSign,
  Package,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface HubAggregate {
  code: WarehouseCode;
  name: string;
  partnerName: string;
  hubLocation: string;
  hubGroup: string;
  isInternalHQ: boolean;
  totalUnits: number;
  availableUnits: number;
  soldUnits: number;
  totalCapital: number;
  totalEstimatedSales: number;
  avgTurnoverDays: number;
  freshCount: number; // < 30 days
  normalCount: number; // 30 - 60 days
  warningCount: number; // 60 - 90 days
  deadStockCount: number; // > 90 days
  items: MasterInventoryItem[];
  deadStockItems: MasterInventoryItem[];
}

export function WarehouseIntelligence({ onNavigateToInventory }: { onNavigateToInventory?: (whCode: string) => void }) {
  const { role, permissions } = useAuth();

  const [hubData, setHubData] = useState<HubAggregate[]>([]);
  const [globalStats, setGlobalStats] = useState({
    totalUnits: 0,
    totalAvailable: 0,
    totalSold: 0,
    totalCapital: 0,
    totalEstimatedSales: 0,
    totalDeadStock: 0,
    bestVelocityHub: 'GK (Griya Kitchen)',
    minTurnover: 21,
  });
  const [deadStockTopList, setDeadStockTopList] = useState<any[]>([]);
  const [hubSpecificItems, setHubSpecificItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHubItems, setIsLoadingHubItems] = useState(false);
  const [selectedHubCode, setSelectedHubCode] = useState<WarehouseCode | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAgingOnly, setFilterAgingOnly] = useState(false);

  // Fetch Live Aggregated Warehouse Data from Turso SQLite
  const loadWarehouseStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/warehouses/stats');
      if (res.ok) {
        const data = await res.json();
        if (data.hubs) setHubData(data.hubs);
        if (data.globalStats) setGlobalStats(data.globalStats);
        if (data.deadStockItems) setDeadStockTopList(data.deadStockItems);
      }
    } catch (err) {
      console.error('Failed to load warehouse stats from Turso:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWarehouseStats();
  }, [loadWarehouseStats]);

  // When a specific hub is selected, fetch its items on demand (paginated 50 rows)
  useEffect(() => {
    if (selectedHubCode === 'ALL') {
      setHubSpecificItems([]);
      return;
    }
    let ignore = false;
    setIsLoadingHubItems(true);
    fetch(`/api/inventory?warehouse=${selectedHubCode}&pageSize=50`)
      .then((r) => r.json())
      .then((d) => {
        if (!ignore && d?.items) {
          setHubSpecificItems(d.items);
        }
      })
      .catch((err) => console.error('Failed to fetch hub items:', err))
      .finally(() => {
        if (!ignore) setIsLoadingHubItems(false);
      });
    return () => {
      ignore = true;
    };
  }, [selectedHubCode]);

  // Compute live days age for an item
  const getItemAgeDays = (item: any): number => {
    if (item.age_days !== undefined && item.age_days !== null) return Number(item.age_days);
    if (!item.TANGGAL_MASUK) return 15;
    const masuk = new Date(item.TANGGAL_MASUK).getTime();
    const refDate = item.TANGGAL_TERJUAL ? new Date(item.TANGGAL_TERJUAL).getTime() : Date.now();
    const diff = Math.max(0, Math.floor((refDate - masuk) / (1000 * 60 * 60 * 24)));
    return isNaN(diff) ? 15 : diff;
  };

  // Selected Hub Object
  const currentSelectedHub = useMemo(() => {
    if (selectedHubCode === 'ALL') return null;
    return hubData.find((h) => h.code === selectedHubCode) || null;
  }, [hubData, selectedHubCode]);

  // Filtered unit list for drilldown inspection
  const drilldownUnits = useMemo(() => {
    let list: any[] = [];
    if (selectedHubCode === 'ALL') {
      list = deadStockTopList;
    } else {
      list = filterAgingOnly
        ? hubSpecificItems.filter((i) => getItemAgeDays(i) >= 90)
        : hubSpecificItems;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((i) =>
        (i.SKU || '').toLowerCase().includes(q) ||
        (i.PRODUCT_TITLE || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [selectedHubCode, filterAgingOnly, deadStockTopList, hubSpecificItems, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl pb-16">
      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-orange-400" />
              <span>Warehouse & Aging Intelligence</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-950 text-orange-300 border border-orange-800 font-mono">
              14 Hub Network Live
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Pusat kontrol sebaran inventaris fisik di 13 Hub Mitra Supplier & 1 Gudang Pusat BBKitchen (HQ Manifest).
          </p>
        </div>

        <button
          type="button"
          onClick={loadWarehouseStats}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-semibold hover:border-slate-700 transition-colors shadow-sm self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Menghitung Data...' : 'Sinkronkan Metrik Gudang'}</span>
        </button>
      </div>

      {/* 4 Global Pareto Top-Level KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Units & Network Share */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Total Sebaran Unit</span>
            <Package className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">
            {isLoading ? '...' : globalStats.totalUnits.toLocaleString('id-ID')}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span className="text-emerald-400 font-semibold">{globalStats.totalAvailable} Siap Jual</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">{globalStats.totalSold} Terjual</span>
          </div>
        </div>

        {/* Card 2: Total Capital in Network */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Modal Tersebar di Mitra</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-2">
            {isLoading ? '...' : permissions.canViewInternalCost ? formatIDR(globalStats.totalCapital) : 'Rp ••••••••'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Nilai HPP modal yang mengendap di 14 Hub
          </div>
        </div>

        {/* Card 3: Dead Stock Alert */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Dead Stock (&gt;90 Hari)</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono mt-2">
            {isLoading ? '...' : `${globalStats.totalDeadStock} Unit`}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Prioritas promo & cuci gudang perputaran kas
          </div>
        </div>

        {/* Card 4: Top Velocity Partner */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Hub Tercepat (Fast-Moving)</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-300 truncate mt-2 font-mono">
            {isLoading ? '...' : globalStats.bestVelocityHub}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Rata-rata laku dalam <span className="text-amber-400 font-bold">{globalStats.minTurnover} hari</span>
          </div>
        </div>
      </div>

      {/* 14 Hub Cards Grid */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <span>Matriks 14 Hub Inventaris (Klik Kartu untuk Filter Detail)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-[11px] text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500" /> &lt;30hr</span>
            <span className="flex items-center gap-1 text-[11px] text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-500" /> 30-60hr</span>
            <span className="flex items-center gap-1 text-[11px] text-orange-400"><span className="w-2 h-2 rounded-full bg-orange-500" /> 60-90hr</span>
            <span className="flex items-center gap-1 text-[11px] text-rose-400"><span className="w-2 h-2 rounded-full bg-rose-500" /> &gt;90hr (Dead Stock)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {hubData.map((hub) => {
            const isSelected = selectedHubCode === hub.code;
            const totalAgingUnits = (hub.freshCount + hub.normalCount + hub.warningCount + hub.deadStockCount) || 1;
            const freshPct = (hub.freshCount / totalAgingUnits) * 100;
            const normalPct = (hub.normalCount / totalAgingUnits) * 100;
            const warningPct = (hub.warningCount / totalAgingUnits) * 100;
            const deadStockPct = (hub.deadStockCount / totalAgingUnits) * 100;

            return (
              <div
                key={hub.code}
                onClick={() => setSelectedHubCode(isSelected ? 'ALL' : hub.code)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden group ${
                  hub.isInternalHQ
                    ? isSelected
                      ? 'bg-gradient-to-b from-cyan-950/90 to-slate-900 border-cyan-500 ring-2 ring-cyan-400/40 shadow-xl shadow-cyan-950/40'
                      : 'bg-gradient-to-b from-cyan-950/30 to-slate-900/90 border-cyan-900/60 hover:border-cyan-500/80 shadow-md'
                    : isSelected
                    ? 'bg-slate-900 border-orange-500 ring-2 ring-orange-500/40 shadow-xl shadow-orange-950/40'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 shadow-md'
                }`}
              >
                {/* Header Tag */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono text-xs font-black px-2 py-0.5 rounded border ${
                        hub.isInternalHQ
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                          : 'bg-slate-800 text-slate-200 border-slate-700'
                      }`}>
                        {hub.code}
                      </span>
                      {hub.isInternalHQ && (
                        <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                          <span>HQ Pusat</span>
                        </span>
                      )}
                    </div>
                    
                    <span className="text-[11px] font-mono text-slate-400 font-bold">
                      {hub.availableUnits} Ready
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-orange-300 transition-colors truncate">
                    {hub.isInternalHQ ? 'BK - BBKitchen (HQ)' : hub.partnerName}
                  </h3>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {hub.hubLocation}
                  </p>

                  {/* Financial & Velocity Stats */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-800/80">
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-mono">Modal Stok</span>
                      <span className="text-xs font-bold font-mono text-emerald-400">
                        {permissions.canViewInternalCost ? formatIDR(hub.totalCapital) : 'Rp ••••••••'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-mono">Turnover</span>
                      <span className="text-xs font-bold font-mono text-amber-300">
                        ~{hub.avgTurnoverDays} hari
                      </span>
                    </div>
                  </div>
                </div>

                {/* Aging Multi-segment Bar */}
                <div className="mt-3.5 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-slate-400">Distribusi Umur:</span>
                    {hub.deadStockCount > 0 ? (
                      <span className="text-rose-400 font-bold animate-pulse">
                        ⚠️ {hub.deadStockCount} Dead Stock
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-medium">✓ Sehat</span>
                    )}
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
                    {hub.freshCount > 0 && <div style={{ width: `${freshPct}%` }} className="bg-emerald-500 h-full" title={`Fresh: ${hub.freshCount} unit`} />}
                    {hub.normalCount > 0 && <div style={{ width: `${normalPct}%` }} className="bg-amber-500 h-full" title={`Normal: ${hub.normalCount} unit`} />}
                    {hub.warningCount > 0 && <div style={{ width: `${warningPct}%` }} className="bg-orange-500 h-full" title={`Waspada: ${hub.warningCount} unit`} />}
                    {hub.deadStockCount > 0 && <div style={{ width: `${deadStockPct}%` }} className="bg-rose-500 h-full" title={`Dead Stock: ${hub.deadStockCount} unit`} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Drilldown & Dead Stock Action Panel */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {selectedHubCode === 'ALL'
                ? 'Semua Unit di 14 Hub'
                : `Detail Hub: ${selectedHubCode === 'BK' ? 'BK - BBKitchen (HQ)' : currentSelectedHub?.name}`}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300">
              {drilldownUnits.length} Unit
            </span>

            {selectedHubCode !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedHubCode('ALL')}
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Reset Filter Hub
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search within hub */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari SKU / nama barang..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* Toggle Dead Stock Only */}
            <button
              type="button"
              onClick={() => setFilterAgingOnly(!filterAgingOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                filterAgingOnly
                  ? 'bg-rose-950 border-rose-600 text-rose-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Hanya Dead Stock (&gt;90hr)</span>
            </button>
          </div>
        </div>

        {/* Unit List */}
        <div className="divide-y divide-slate-800/60 max-h-[600px] overflow-y-auto">
          {isLoading ? (
            <div className="py-16 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-400" />
              Memuat data inventaris hub...
            </div>
          ) : drilldownUnits.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <div className="font-bold text-slate-200">Tidak Ada Unit Ditemukan</div>
              <p className="text-xs text-slate-500 mt-1">
                {filterAgingOnly ? 'Semua unit di hub ini memiliki umur simpan sehat (<90 hari)!' : 'Coba ubah kata kunci pencarian.'}
              </p>
            </div>
          ) : (
            drilldownUnits.slice(0, 50).map((item) => {
              const ageDays = getItemAgeDays(item);
              const isDeadStock = ageDays >= 90;

              return (
                <div
                  key={item.SKU}
                  className="p-4 hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
                      {item.FEATURED_IMAGE ? (
                        <Image
                          src={item.FEATURED_IMAGE}
                          alt={item.PRODUCT_TITLE}
                          fill
                          className="object-cover"
                          sizes="48px"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-500 font-mono">
                          NO PIC
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                          {item.SKU}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-cyan-300 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                          Hub: {item.asal_gudang === 'BK' ? 'BK (HQ)' : (item.asal_gudang || 'GK')}
                        </span>
                        <StatusBadge status={item.STATUS_UNIT} />
                        <span className="text-[11px] text-slate-400">{item.LOKASI_UNIT}</span>
                      </div>

                      <div className="font-semibold text-slate-200 text-sm mt-1">
                        {item.PRODUCT_TITLE}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1.5 font-mono">
                        <span>Tgl Masuk: {item.TANGGAL_MASUK || '-'}</span>
                        <span className="text-slate-600">•</span>
                        <span className={`font-bold flex items-center gap-1 ${
                          isDeadStock ? 'text-rose-400 font-black' : ageDays > 60 ? 'text-orange-400' : 'text-emerald-400'
                        }`}>
                          <Clock className="w-3 h-3" />
                          <span>Umur: {ageDays} hari</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-center shrink-0">
                    <div className="text-right">
                      {permissions.canViewInternalCost && item.HARGA_MODAL && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          Modal: {formatIDR(item.HARGA_MODAL)}
                        </div>
                      )}
                      <div className="text-sm font-bold font-mono text-emerald-400">
                        {formatIDR(item.HARGA_BUKA_WA || item.HARGA_ESTIMASI_PUBLIK)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
