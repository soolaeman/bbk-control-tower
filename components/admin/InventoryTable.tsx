'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/auth-context';
import { MasterInventoryItem, PaginatedInventoryResponse } from '@/lib/types/inventory';
import { OFFICIAL_CATEGORIES } from '@/lib/repositories/categories';
import { StatusBadge, PipelineBadge, GuardrailBadge } from '@/components/ui/StatusBadges';
import { formatIDR, formatCleanProductUrl, WAREHOUSE_14_HUBS } from '@/lib/repositories/warehouse-utils';
import {
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertCircle,
  SlidersHorizontal,
  Lock,
  MessageSquare,
  Check,
  Copy,
} from 'lucide-react';

function formatTimestampWithYear(raw?: any): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (!str) return '';

  try {
    let d: Date | null = null;

    // 1. Numeric Excel / Sheets serial date (e.g. 46267.61398148148)
    const num = Number(str);
    if (!isNaN(num) && num > 30000 && num < 60000) {
      const ms = Math.round((num - 25569) * 86400 * 1000);
      d = new Date(ms);
    } else if (str.includes('-') || str.includes('/') || str.includes('T')) {
      const parsed = new Date(str.replace(' ', 'T'));
      if (!isNaN(parsed.getTime())) {
        d = parsed;
      }
    }

    if (d && !isNaN(d.getTime())) {
      const datePart = d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
      });
      const timePart = d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }).replace(':', '.');
      return `${datePart}, ${timePart}`;
    }

    // 2. Formatted string like "03 Sep, 16.14" (missing year)
    if (str.includes(',') && !str.match(/\d{4}/)) {
      const parts = str.split(',');
      return `${parts[0].trim()} ${new Date().getFullYear()}, ${parts[1].trim()}`;
    }

    return str;
  } catch {
    return str;
  }
}

export function InventoryTable() {
  const { role, permissions } = useAuth();

  // Filter States
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [warehouse, setWarehouse] = useState('ALL');
  const [statusUnit, setStatusUnit] = useState('ALL');
  const [statusPipeline, setStatusPipeline] = useState('ALL');
  const [guardrailStatus, setGuardrailStatus] = useState('ALL');
  const [isDirtyOnly, setIsDirtyOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('TANGGAL_MASUK');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Column Visibility
  const [showColumns, setShowColumns] = useState({
    sku: true,
    photo: true,
    title: true,
    category: true,
    location: true,
    condition: true,
    unitStatus: true,
    pipeline: true,
    publicPrice: true,
    dealFloor: true,
    cogs: true,
    telegram: true,
    aging: true,
    actions: true,
  });

  // Data States
  const [data, setData] = useState<PaginatedInventoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedItem, setSelectedItem] = useState<MasterInventoryItem | null>(null);
  const [soldModalItem, setSoldModalItem] = useState<MasterInventoryItem | null>(null);
  const [waModalItem, setWaModalItem] = useState<MasterInventoryItem | null>(null);
  const [waCopied, setWaCopied] = useState(false);
  const [dealPriceInput, setDealPriceInput] = useState('');
  const [soldNotesInput, setSoldNotesInput] = useState('');
  const [soldByOther, setSoldByOther] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Active Row & Audit Timestamps Tracker (Persistent in localStorage, 0 reload)
  const [activeClickedSku, setActiveClickedSku] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('bbk_last_active_sku') || null;
    }
    return null;
  });

  const [soldNotices, setSoldNotices] = useState<any[]>([]);
  const [auditTimestamps, setAuditTimestamps] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('bbk_audit_timestamps');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return {};
  });

  // Cross-device synchronization for audit timestamps & active row (Desktop <-> Mobile)
  useEffect(() => {
    // 1. Initial push of existing desktop timestamps to backend if present
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('bbk_audit_timestamps');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
            fetch('/api/audit-timestamps', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ batch: parsed }),
            }).catch(() => {});
          }
        }
      } catch {}
    }

    async function syncTimestamps() {
      try {
        const res = await fetch('/api/audit-timestamps');
        const data = await res.json();
        if (data.timestamps && typeof data.timestamps === 'object') {
          setAuditTimestamps((prev) => {
            const merged = { ...prev, ...data.timestamps };
            if (typeof window !== 'undefined') {
              localStorage.setItem('bbk_audit_timestamps', JSON.stringify(merged));
            }
            return merged;
          });
        }
        if (Array.isArray(data.soldNotices)) {
          setSoldNotices(data.soldNotices);
        }
        if (data.activeSku) {
          setActiveClickedSku(data.activeSku);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('bbk_last_active_sku', data.activeSku);
          }
        }
      } catch {}
    }

    syncTimestamps();
    const interval = setInterval(syncTimestamps, 3000);
    window.addEventListener('focus', syncTimestamps);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncTimestamps);
    };
  }, []);

  const [radarPatternFilter, setRadarPatternFilter] = useState<'ALL' | 'PATTERN_1_DELETED' | 'PATTERN_2_SINGLE_PHOTO' | 'PATTERN_3_EDITED_SOLD' | 'PATTERN_4_REPLY_SOLD'>('ALL');
  const [isRadarOnly, setIsRadarOnly] = useState(false);

  const handleDismissSoldNotice = async (noticeId: string, sku?: string) => {
    setSoldNotices((prev) => prev.filter((n) => (noticeId ? n.id !== noticeId : n.sku !== sku)));
    try {
      await fetch('/api/audit-timestamps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DISMISS_SOLD_NOTICE', noticeId, sku }),
      });
    } catch {}
  };

  const handleQuickApproveSold = async (sku: string, dealPrice?: number, notes?: string, noticeId?: string) => {
    const targetSku = sku.trim().toUpperCase();
    const finalPrice = dealPrice || undefined;
    const finalNotes = notes || 'Disetujui via Radar Telegram (4 Pola Sold)';

    // 1. Optimistic feedback
    setActionSuccessMsg(`⚡ Menyetujui SOLD untuk unit ${targetSku}...`);
    if (noticeId) {
      setSoldNotices((prev) => prev.filter((n) => n.id !== noticeId));
    } else {
      setSoldNotices((prev) => prev.filter((n) => n.sku !== targetSku));
    }

    if (data?.items) {
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) =>
                i.SKU === targetSku ? { ...i, STATUS_UNIT: 'SOLD' as const } : i
              ),
            }
          : null
      );
    }

    try {
      // 2. Persist to Turso SQLite SSOT
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bbk-role': role ?? '',
        },
        body: JSON.stringify({
          action: 'MARK_AS_SOLD',
          sku: targetSku,
          dealPrice: finalPrice,
          notes: finalNotes,
        }),
      });

      // 3. Dismiss from pending radar state
      fetch('/api/audit-timestamps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DISMISS_SOLD_NOTICE', sku: targetSku, noticeId }),
      }).catch(() => {});

      if (res.ok) {
        setActionSuccessMsg(`✓ Unit ${targetSku} 100% Selesai Disetujui SOLD di Web & Database SQLite.`);
        fetchInventory();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      } else {
        const resJson = await res.json();
        alert(resJson.error || 'Gagal menandai unit sebagai SOLD');
        fetchInventory();
      }
    } catch (err) {
      console.error('Error in quick approve sold:', err);
      fetchInventory();
    }
  };

  const markSkuAsVisited = (sku: string) => {
    setActiveClickedSku(sku);
    const now = new Date();
    const datePart = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const timePart = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
    const timeStr = `${datePart}, ${timePart}`;

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('bbk_last_active_sku', sku);
      setAuditTimestamps((prev) => {
        const next = { ...prev, [sku]: timeStr };
        localStorage.setItem('bbk_audit_timestamps', JSON.stringify(next));
        return next;
      });
    }

    // Sync to shared backend in background
    fetch('/api/audit-timestamps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, timestamp: timeStr, activeSku: sku }),
    }).catch(() => {});
  };

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [pageInput, setPageInput] = useState(String(page));

  // Sync pageInput whenever page changes
  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  // Debounce live typing search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortOrder,
      });

      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (category !== 'ALL') params.append('category', category);
      if (warehouse !== 'ALL') params.append('warehouse', warehouse);
      if (statusUnit !== 'ALL') params.append('statusUnit', statusUnit);
      if (statusPipeline !== 'ALL') params.append('statusPipeline', statusPipeline);
      if (guardrailStatus !== 'ALL') params.append('guardrailStatus', guardrailStatus);
      if (isDirtyOnly) params.append('isDirty', 'true');

      const res = await fetch(`/api/inventory?${params.toString()}`, {
        headers: { ...(role ? { 'x-bbk-role': role ?? '' } : {}) },
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        setErrorMessage(result.error || 'Failed to load inventory');
        setData(null);
      } else {
        setData(result);
        setErrorMessage('');
      }
    } catch (err: any) {
      console.error('Failed to load inventory', err);
      setErrorMessage(err.message || 'Network error fetching inventory');
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    pageSize,
    sortBy,
    sortOrder,
    debouncedSearch,
    category,
    warehouse,
    statusUnit,
    statusPipeline,
    guardrailStatus,
    isDirtyOnly,
    role,
  ]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!ignore) {
        await fetchInventory();
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [fetchInventory]);

  const handleMarkAsSoldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!soldModalItem) return;

    const targetSku = soldModalItem.SKU;
    const finalNotes = soldByOther
      ? (soldNotesInput.trim() ? `[Terjual Pihak Ketiga/Orang Lain] ${soldNotesInput.trim()}` : 'Terjual Pihak Ketiga / Rekanan Gudang')
      : soldNotesInput.trim();

    const finalPrice = soldByOther ? 0 : (dealPriceInput ? Number(dealPriceInput) : soldModalItem.HARGA_BUKA_WA);

    // 1. Optimistic Instant UI Feedback (0.05s)
    setActionSuccessMsg(`⚡ Unit ${targetSku} berhasil ditandai SOLD! Menyinkronkan ke Web & Google Sheets...`);
    setSoldModalItem(null);
    setDealPriceInput('');
    setSoldNotesInput('');
    setSoldByOther(false);

    // Update local table state and clear pending notice banner immediately
    setSoldNotices((prev) => prev.filter((n) => n.sku !== targetSku));
    if (data?.items) {
      setData((prev) => prev ? {
        ...prev,
        items: prev.items.map((i) => i.SKU === targetSku ? { ...i, STATUS_UNIT: 'SOLD' as const } : i),
      } : null);
    }

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bbk-role': role ?? '',
        },
        body: JSON.stringify({
          action: 'MARK_AS_SOLD',
          sku: targetSku,
          dealPrice: finalPrice,
          notes: finalNotes,
        }),
      });

      const resJson = await res.json();
      if (res.ok) {
        setActionSuccessMsg(`✓ Unit ${targetSku} 100% Selesai Ditandai SOLD di Web & Database.`);
        fetchInventory();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      } else {
        alert(resJson.error || 'Failed to mark unit as sold');
        fetchInventory();
      }
    } catch (err) {
      console.error('Error marking as sold', err);
      fetchInventory();
    }
  };

  const handleMarkAsReady = async (sku: string) => {
    if (!confirm(`Kembalikan unit ${sku} menjadi status READY?`)) return;
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bbk-role': role ?? '',
        },
        body: JSON.stringify({
          action: 'MARK_AS_READY',
          sku,
        }),
      });

      const resJson = await res.json();
      if (res.ok) {
        setActionSuccessMsg(`Unit ${sku} berhasil dikembalikan ke status READY.`);
        fetchInventory();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      } else {
        alert(resJson.error || 'Failed to mark unit as ready');
      }
    } catch (err) {
      console.error('Error marking as ready', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Inventory Control Tower</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {data?.total !== undefined ? `${data.total} SKUs` : (isLoading ? 'Syncing...' : '0 SKUs')}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Katalog operasional live tersinkronisasi dengan Google Sheets & WooCommerce.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchInventory()}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-950/90 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-950/90 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-rose-200">Gagal Memuat Data Google Sheets</div>
            <div className="mt-0.5 text-rose-300/90 font-mono text-[11px]">{errorMessage}</div>
          </div>
        </div>
      )}

      {/* Quick Status Pill Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setStatusUnit('ALL');
            setIsRadarOnly(false);
            setPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            statusUnit === 'ALL' && !isRadarOnly
              ? 'bg-slate-200 text-slate-950 shadow-md'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <span>🏢 Semua Unit</span>
          {data?.stats?.totalUnits !== undefined && (
            <span className="text-[10px] font-mono opacity-80 font-normal">
              ({data.stats.totalUnits.toLocaleString('id-ID')})
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusUnit('READY');
            setIsRadarOnly(false);
            setPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            statusUnit === 'READY' && !isRadarOnly
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
              : 'bg-slate-900 border border-slate-800 text-emerald-400 hover:border-emerald-700'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>READY (Siap Jual)</span>
          {data?.stats?.availableUnits !== undefined && (
            <span className="text-[10px] font-mono opacity-80 font-normal">
              ({data.stats.availableUnits.toLocaleString('id-ID')})
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusUnit('SOLD');
            setIsRadarOnly(false);
            setPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            statusUnit === 'SOLD' && !isRadarOnly
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20 font-black'
              : 'bg-slate-900 border border-slate-800 text-rose-400 hover:border-rose-700'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>SOLD (Terjual)</span>
          {data?.stats?.soldUnits !== undefined && (
            <span className="text-[10px] font-mono opacity-80 font-normal">
              ({data.stats.soldUnits.toLocaleString('id-ID')})
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsRadarOnly((prev) => !prev);
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            isRadarOnly
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 font-black'
              : 'bg-amber-950/40 border border-amber-500/50 text-amber-300 hover:bg-amber-900/40'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>⚡ Radar Telegram (4 Pola Sold)</span>
          {soldNotices.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-mono font-bold">
              {soldNotices.length}
            </span>
          )}
        </button>
      </div>

      {/* Radar Telegram & Meja Verifikasi Sold (4 Pola) */}
      {(isRadarOnly || soldNotices.length > 0) && (
        <div className="bg-gradient-to-b from-amber-950/60 to-slate-950 border border-amber-500/50 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <h3 className="text-sm font-bold text-amber-300 tracking-tight flex items-center gap-1.5">
                  <span>⚡ Radar Telegram & Meja Verifikasi Sold</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[10px] font-mono">
                    4 Pola Signal
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Mendeteksi sinyal unit laku di Channel Telegram rekanan secara otomatis untuk mencegah barang sudah laku ditawarkan ke pembeli WA.
              </p>
            </div>

            {/* Pattern Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setRadarPatternFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  radarPatternFilter === 'ALL'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Semua ({soldNotices.length})
              </button>
              <button
                type="button"
                onClick={() => setRadarPatternFilter('PATTERN_1_DELETED')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                  radarPatternFilter === 'PATTERN_1_DELETED'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-slate-900 text-rose-300 hover:text-white border border-slate-800'
                }`}
                title="Pola 1: Pesan postingan dihapus oleh admin gudang di Telegram"
              >
                <span>🗑️ Pola 1: Dihapus</span>
                <span className="font-mono text-[10px]">({soldNotices.filter((n) => n.pattern === 'PATTERN_1_DELETED').length})</span>
              </button>
              <button
                type="button"
                onClick={() => setRadarPatternFilter('PATTERN_2_SINGLE_PHOTO')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                  radarPatternFilter === 'PATTERN_2_SINGLE_PHOTO'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-sky-300 hover:text-white border border-slate-800'
                }`}
                title="Pola 2: Foto album dihapus dan disisakan 1 foto saja"
              >
                <span>📸 Pola 2: Foto 1</span>
                <span className="font-mono text-[10px]">({soldNotices.filter((n) => n.pattern === 'PATTERN_2_SINGLE_PHOTO').length})</span>
              </button>
              <button
                type="button"
                onClick={() => setRadarPatternFilter('PATTERN_3_EDITED_SOLD')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                  radarPatternFilter === 'PATTERN_3_EDITED_SOLD'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-emerald-300 hover:text-white border border-slate-800'
                }`}
                title="Pola 3: Pesan diedit dengan mencantumkan kata SOLD / LAKU / TERJUAL"
              >
                <span>✏️ Pola 3: Diedit SOLD</span>
                <span className="font-mono text-[10px]">({soldNotices.filter((n) => n.pattern === 'PATTERN_3_EDITED_SOLD').length})</span>
              </button>
              <button
                type="button"
                onClick={() => setRadarPatternFilter('PATTERN_4_REPLY_SOLD')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                  radarPatternFilter === 'PATTERN_4_REPLY_SOLD'
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'bg-slate-900 text-purple-300 hover:text-white border border-slate-800'
                }`}
                title="Pola 4: Admin gudang me-reply pesan dengan kata SOLD / BOOKED / DP"
              >
                <span>💬 Pola 4: Reply SOLD</span>
                <span className="font-mono text-[10px]">({soldNotices.filter((n) => n.pattern === 'PATTERN_4_REPLY_SOLD').length})</span>
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          {soldNotices.filter((n) => radarPatternFilter === 'ALL' || n.pattern === radarPatternFilter).length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs bg-slate-950/60 rounded-xl border border-slate-800">
              Tidak ada kandidat unit terdeteksi untuk filter pola ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {soldNotices
                .filter((n) => radarPatternFilter === 'ALL' || n.pattern === radarPatternFilter)
                .map((notice) => (
                  <div
                    key={notice.id}
                    className="p-3.5 bg-slate-950 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md hover:border-amber-400/60 transition-all"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-amber-300 text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                          {notice.sku}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1">
                          <span>{notice.patternIcon || '⚡'}</span>
                          <span>{notice.patternLabel || 'Radar Candidate'}</span>
                        </span>
                        {notice.dealPrice ? (
                          <span className="text-emerald-400 font-mono text-[11px] font-bold">
                            Estimasi: {formatIDR(notice.dealPrice)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                        {notice.notes}
                      </p>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2">
                        <span>📡 {notice.reportedBy || 'Radar Telegram'}</span>
                        <span>•</span>
                        <span>{notice.reportedAt}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {notice.linkTelegram && (
                        <a
                          href={notice.linkTelegram}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => markSkuAsVisited(notice.sku)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-950/80 border border-blue-800 text-blue-300 hover:bg-blue-900 text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                          title="Buka Pesan Asli di Telegram"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Cek TG</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleQuickApproveSold(notice.sku, notice.dealPrice, notice.notes, notice.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm transition-colors inline-flex items-center gap-1"
                        title="1-Klik Setujui SOLD (Sinkron ke SQLite Turso)"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Setujui SOLD</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const targetItem = data?.items?.find((i) => i.SKU === notice.sku) || ({
                            SKU: notice.sku,
                            PRODUCT_TITLE: notice.sku,
                            HARGA_BUKA_WA: notice.dealPrice,
                          } as any);
                          setDealPriceInput(notice.dealPrice ? String(notice.dealPrice) : '');
                          setSoldNotesInput(notice.notes || '');
                          setSoldModalItem(targetItem);
                          handleDismissSoldNotice(notice.id, notice.sku);
                        }}
                        className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[11px]"
                        title="Sesuaikan Harga Deal & Catatan"
                      >
                        ⚙️
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDismissSoldNotice(notice.id, notice.sku)}
                        className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-400 text-[11px]"
                        title="Abaikan (False Positive / Bukan Terjual)"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input with Enter key and Clear support */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setDebouncedSearch(search);
              setPage(1);
            }}
            className="relative flex items-center"
          >
            <Search className="w-4 h-4 absolute left-3 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari SKU, merk, nama mesin... (Tekan Enter)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-16 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="absolute right-1.5 flex items-center gap-1">
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                  }}
                  className="p-1 text-slate-500 hover:text-slate-200 text-xs rounded"
                  title="Hapus Pencarian"
                >
                  ✕
                </button>
              )}
              <button
                type="submit"
                className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold transition-colors"
              >
                Cari
              </button>
            </div>
          </form>

          {/* Category Filter */}
          <div>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">Semua Kategori (Official Woo)</option>
              {OFFICIAL_CATEGORIES.map((group) => (
                <optgroup key={group.slug} label={`📁 ${group.name}`}>
                  <option value={group.slug}>Semua {group.name}</option>
                  {group.children.map((child) => (
                    <option key={child.slug} value={child.slug}>
                      &nbsp;&nbsp;↳ {child.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Status Unit Filter */}
          <div>
            <select
              value={statusUnit}
              onChange={(e) => {
                setStatusUnit(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
            >
              <option value="ALL">Semua Status Unit</option>
              <option value="READY">READY (Siap Jual)</option>
              <option value="SOLD">SOLD (Terjual)</option>
            </select>
          </div>

          {/* Pipeline Status Filter */}
          <div>
            <select
              value={statusPipeline}
              onChange={(e) => {
                setStatusPipeline(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
            >
              <option value="ALL">Semua Status Pipeline</option>
              <option value="PUBLISHED">PUBLISHED (Live di Web)</option>
              <option value="READY_TO_PUBLISH">READY_TO_PUBLISH (Siap Tayang)</option>
              <option value="PENDING_PHOTOS">PENDING_PHOTOS (Menunggu Foto)</option>
            </select>
          </div>
        </div>

        {/* Secondary Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Gudang:</span>
              <select
                value={warehouse}
                onChange={(e) => {
                  setWarehouse(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
              >
                <option value="ALL">Semua Hub (14 Hub)</option>
                {WAREHOUSE_14_HUBS.map((hub) => (
                  <option key={hub.code} value={hub.code}>
                    {hub.code === 'BK' ? 'BK - BBKitchen (HQ)' : `${hub.code} - ${hub.partnerName} (${hub.hubGroup})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order Selector (Termurah -> Termahal) */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Urutkan:</span>
              <select
                value={
                  sortBy === 'HARGA_MODAL' && sortOrder === 'asc'
                    ? 'MODAL_ASC'
                    : sortBy === 'HARGA_MODAL' && sortOrder === 'desc'
                    ? 'MODAL_DESC'
                    : sortBy === 'HARGA_BUKA_WA' && sortOrder === 'asc'
                    ? 'PRICE_ASC'
                    : sortBy === 'HARGA_BUKA_WA' && sortOrder === 'desc'
                    ? 'PRICE_DESC'
                    : 'NEWEST'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'MODAL_ASC') {
                    setSortBy('HARGA_MODAL');
                    setSortOrder('asc');
                  } else if (val === 'MODAL_DESC') {
                    setSortBy('HARGA_MODAL');
                    setSortOrder('desc');
                  } else if (val === 'PRICE_ASC') {
                    setSortBy('HARGA_BUKA_WA');
                    setSortOrder('asc');
                  } else if (val === 'PRICE_DESC') {
                    setSortBy('HARGA_BUKA_WA');
                    setSortOrder('desc');
                  } else {
                    setSortBy('TANGGAL_MASUK');
                    setSortOrder('desc');
                  }
                  setPage(1);
                }}
                className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="NEWEST">🔥 Terbaru Masuk (Default)</option>
                {permissions.canViewInternalCost && (
                  <>
                    <option value="MODAL_ASC">💰 Harga Modal: Termurah → Termahal</option>
                    <option value="MODAL_DESC">💰 Harga Modal: Termahal → Termurah</option>
                  </>
                )}
                <option value="PRICE_ASC">🏷️ Harga Jual (Buka WA): Termurah → Termahal</option>
                <option value="PRICE_DESC">🏷️ Harga Jual (Buka WA): Termahal → Termurah</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={isDirtyOnly}
                onChange={(e) => {
                  setIsDirtyOnly(e.target.checked);
                  setPage(1);
                }}
                className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-xs">Hanya Data Dirty (Error/Missing)</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono"
            >
              <option value="10">10 baris</option>
              <option value="25">25 baris</option>
              <option value="50">50 baris</option>
              <option value="100">100 baris</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active SKU Cross-Device Sync Banner */}
      {activeClickedSku && (
        <div className="bg-amber-950/80 border border-amber-500/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs text-amber-200">
              📍 Baris Aktif Sedang Dicek: <strong className="text-amber-300 font-mono font-black">{activeClickedSku}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById(`row-${activeClickedSku}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              } else {
                setSearch(activeClickedSku);
                setDebouncedSearch(activeClickedSku);
                setPage(1);
              }
            }}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-black text-xs transition-colors shadow flex items-center gap-1"
          >
            <span>⚡ Lompat ke Baris Ini</span>
          </button>
        </div>
      )}


      {/* Main Responsive Table */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">SKU</th>
                <th className="py-3.5 px-3">Foto</th>
                <th className="py-3.5 px-4 min-w-[220px]">Nama Produk & Spesifikasi</th>

                {/* Telegram Source (Protected) */}
                {permissions?.canViewTelegramLink && (
                  <th className="py-3.5 px-3 text-center text-blue-400">
                    Telegram
                  </th>
                )}

                {/* Actions (Moved right next to Product Title) */}
                <th className="py-3.5 px-4 text-center">Aksi Cepat</th>

                <th className="py-3.5 px-3">Lokasi Gudang</th>
                <th className="py-3.5 px-3">Status Unit</th>
                <th className="py-3.5 px-3">Pipeline</th>
                <th className="py-3.5 px-3 text-right">Harga Estimasi (WA)</th>

                {/* Role-Protected Columns */}
                {permissions?.canViewFloorPrice && (
                  <th className="py-3.5 px-3 text-right text-amber-400 bg-amber-950/20">
                    Floor Price
                  </th>
                )}
                {permissions?.canViewInternalCost && (
                  <th className="py-3.5 px-3 text-right text-purple-400 bg-purple-950/20">
                    Modal (HPP)
                  </th>
                )}

                <th className="py-3.5 px-3 text-center">Aging</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    Memuat data inventaris BBKitchen...
                  </td>
                </tr>
              ) : !data?.items || data.items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    Tidak ada unit yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                data.items.map((item) => {
                  const isActive = activeClickedSku === item.SKU;
                  const isAudited = Boolean(auditTimestamps[item.SKU] || item.LAST_CHECKED_TELEGRAM);
                  const rawTime = auditTimestamps[item.SKU] || item.LAST_CHECKED_TELEGRAM || item.TANGGAL_MASUK;
                  const displayTime = rawTime ? formatTimestampWithYear(rawTime) : null;
                  const soldNotice = soldNotices.find((n) => n.sku === item.SKU);

                  return (
                    <tr
                      key={item.SKU}
                      id={`row-${item.SKU}`}
                      className={`transition-all duration-200 group ${
                        isActive
                          ? 'bg-amber-950/50 border-l-4 border-l-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/40'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* SKU */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-200 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isActive && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" title="Sedang Aktif Dicek" />
                          )}
                          <span className={isActive ? 'text-amber-300 font-black' : ''}>{item.SKU}</span>
                          {item.IS_DIRTY && (
                            <span className="w-2 h-2 rounded-full bg-rose-500" title="Dirty Data" />
                          )}
                          {soldNotice && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold inline-flex items-center gap-1 cursor-pointer hover:bg-amber-500/30 transition-colors"
                              onClick={() => {
                                setSoldModalItem(item);
                                setDealPriceInput(String(soldNotice.dealPrice || item.HARGA_BUKA_WA || ''));
                                setSoldNotesInput(soldNotice.notes || '');
                              }}
                              title={soldNotice.notes || 'Radar Telegram Candidate'}
                            >
                              <span>{soldNotice.patternIcon || '⚡'}</span>
                              <span>{soldNotice.patternLabel || 'Radar Sold'}</span>
                            </span>
                          )}
                        </div>
                        {isActive && (
                          <div className="text-[9px] text-amber-400 font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1">
                            <span>📍 Terakhir Dicek</span>
                          </div>
                        )}
                      </td>

                      {/* Thumbnail */}
                      <td className="py-3 px-3">
                        <div className="relative w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
                          {item.FEATURED_IMAGE ? (
                            <Image
                              src={item.FEATURED_IMAGE}
                              alt={item.image_alt || item.PRODUCT_TITLE}
                              fill
                              className="object-cover"
                              sizes="48px"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-500">
                              No Pic
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Product Title & Category */}
                      <td className="py-3 px-4">
                        <a
                          href={formatCleanProductUrl(item.PRODUCT_TITLE, item.LINK_UNIT)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`font-semibold line-clamp-1 transition-colors hover:underline inline-flex items-center gap-1.5 group/title ${
                            isActive ? 'text-amber-300' : 'text-slate-100 hover:text-amber-400'
                          }`}
                          title="Buka Halaman Produk Publik di Website"
                        >
                          <span>{item.PRODUCT_TITLE}</span>
                          <ExternalLink className="w-3 h-3 text-slate-500 group-hover/title:text-amber-400 shrink-0 opacity-60 group-hover/title:opacity-100 transition-opacity" />
                        </a>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="text-amber-400/90">{item.CATEGORY_NAME}</span>
                          <span>•</span>
                          <span className="text-slate-400">{item.KONDISI_UNIT}</span>
                        </div>
                      </td>

                      {/* Telegram Source (Protected) */}
                      {permissions?.canViewTelegramLink && (
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {item.LINK_TELEGRAM ? (
                            <div className="flex flex-col items-center gap-1">
                              <a
                                href={item.LINK_TELEGRAM}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => markSkuAsVisited(item.SKU)}
                                className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                                  isActive
                                    ? 'bg-amber-500 text-slate-950 font-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)] scale-105'
                                    : 'bg-blue-950/60 text-blue-400 hover:text-blue-300 border-blue-800/80 hover:bg-blue-900/60'
                                }`}
                              >
                                <Send className="w-3 h-3" />
                                <span>{isActive ? 'Sedang Dibuka' : 'Channel'}</span>
                              </a>
                              {displayTime && (
                                <span className="text-[9px] font-mono text-slate-400 whitespace-nowrap" title="Waktu posting Telegram">
                                  🕒 {displayTime}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                      )}

                      {/* Actions (Moved right next to Product Title & Telegram) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedItem(item)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Quick View & Specs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setWaModalItem(item)}
                            className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 hover:bg-emerald-800 hover:text-white transition-colors"
                            title="1-Klik Format Penawaran WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          {permissions?.canMarkAsSold && (
                            item.STATUS_UNIT === 'SOLD' ? (
                              <button
                                type="button"
                                onClick={() => handleMarkAsReady(item.SKU)}
                                className="px-2 py-1 rounded-lg bg-blue-700/80 hover:bg-blue-600 text-white text-[11px] font-bold transition-colors flex items-center gap-1"
                                title="Kembalikan status unit menjadi READY"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Set Ready</span>
                              </button>
                            ) : (
                              soldNotice ? (
                                <button
                                  type="button"
                                  onClick={() => handleQuickApproveSold(item.SKU, soldNotice.dealPrice, soldNotice.notes, soldNotice.id)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black transition-all shadow-md shadow-amber-500/20 flex items-center gap-1"
                                  title="1-Klik Setujui SOLD (Sinkron ke SQLite Turso)"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Setujui SOLD</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSoldModalItem(item);
                                    setDealPriceInput(String(item.HARGA_DEAL_WA || item.HARGA_BUKA_WA || ''));
                                  }}
                                  className="px-2 py-1 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-[11px] font-bold transition-colors"
                                  title="Tandai Sudah Terjual (Deal)"
                                >
                                  Mark Sold
                                </button>
                              )
                            )
                          )}
                        </div>
                      </td>

                    {/* Location */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono">
                        {item.asal_gudang}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {item.LOKASI_UNIT.split(',')[0]}
                      </div>
                    </td>

                    {/* Status Unit */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <StatusBadge status={item.STATUS_UNIT} />
                    </td>

                    {/* Pipeline */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <PipelineBadge status={item.STATUS_PIPELINE} />
                    </td>

                    {/* Public Price */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-100 whitespace-nowrap">
                      {item.HARGA_BUKA_WA != null ? formatIDR(item.HARGA_BUKA_WA) : item.HARGA_ESTIMASI_PUBLIK != null ? formatIDR(item.HARGA_ESTIMASI_PUBLIK) : 'Hubungi kami'}
                    </td>

                    {/* Floor Price (Protected) */}
                    {permissions?.canViewFloorPrice && (
                      <td className="py-3 px-3 text-right font-mono text-amber-300 bg-amber-950/10 whitespace-nowrap">
                        {item.HARGA_FLOOR_WA ? formatIDR(item.HARGA_FLOOR_WA) : '-'}
                      </td>
                    )}

                    {/* Cost COGS (Protected) */}
                    {permissions?.canViewInternalCost && (
                      <td className="py-3 px-3 text-right font-mono text-purple-300 bg-purple-950/10 whitespace-nowrap">
                        {item.HARGA_MODAL ? formatIDR(item.HARGA_MODAL) : <Lock className="w-3.5 h-3.5 inline text-slate-600" />}
                      </td>
                    )}

                    {/* Aging */}
                    <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-[11px] text-slate-400">
                      {(() => {
                        if (item.STATUS_UNIT === 'SOLD' && item.DURASI_TERJUAL != null) {
                          return <span className="text-emerald-400 font-bold">{item.DURASI_TERJUAL} hr (laku)</span>;
                        }
                        if (item.TANGGAL_MASUK) {
                          try {
                            const masuk = new Date(item.TANGGAL_MASUK);
                            if (!isNaN(masuk.getTime())) {
                              const diffDays = Math.max(0, Math.floor((Date.now() - masuk.getTime()) / (1000 * 60 * 60 * 24)));
                              return (
                                <span className={diffDays > 45 ? 'text-rose-400 font-bold' : diffDays > 20 ? 'text-amber-400' : 'text-slate-400'}>
                                  {diffDays} hr
                                </span>
                              );
                            }
                          } catch {}
                        }
                        return <span>-</span>;
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {data && data.totalPages > 1 && (
          <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Menampilkan <span className="font-bold text-slate-200">{(page - 1) * pageSize + 1}</span> -{' '}
              <span className="font-bold text-slate-200">{Math.min(page * pageSize, data.total)}</span> dari{' '}
              <span className="font-bold text-slate-200">{data.total}</span> unit
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 font-mono text-slate-200">
                <span>Hal</span>
                <input
                  type="number"
                  min={1}
                  max={data.totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const num = parseInt(pageInput, 10);
                      if (!isNaN(num) && num >= 1 && num <= data.totalPages) {
                        setPage(num);
                      } else {
                        setPageInput(String(page));
                      }
                    }
                  }}
                  onBlur={() => {
                    const num = parseInt(pageInput, 10);
                    if (!isNaN(num) && num >= 1 && num <= data.totalPages) {
                      setPage(num);
                    } else {
                      setPageInput(String(page));
                    }
                  }}
                  className="w-14 px-2 py-1 text-center bg-slate-950 border border-slate-700 rounded-lg text-amber-400 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-inner"
                  title="Ketik nomor halaman & tekan Enter"
                />
                <span>dari {data.totalPages}</span>
              </div>

              <button
                type="button"
                disabled={page >= data.totalPages || isLoading}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick View Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/80">
                  {selectedItem.SKU}
                </span>
                <a
                  href={formatCleanProductUrl(selectedItem.PRODUCT_TITLE, selectedItem.LINK_UNIT)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-bold text-white hover:text-amber-300 transition-colors mt-1 inline-flex items-center gap-1.5 group hover:underline"
                  title="Buka Halaman Publik"
                >
                  <span>{selectedItem.PRODUCT_TITLE}</span>
                  <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-amber-400 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
                </a>
                <p className="text-xs text-slate-400">{selectedItem.KONDISI_UNIT} • {selectedItem.LOKASI_UNIT}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Photo Gallery Grid */}
            <div className="grid grid-cols-3 gap-2">
              {(selectedItem.PHOTO_URLS || [selectedItem.FEATURED_IMAGE]).map((url, idx) => (
                <div key={idx} className="relative aspect-video rounded-lg overflow-hidden bg-slate-800">
                  <Image
                    src={url}
                    alt={selectedItem.image_alt || 'Unit photo'}
                    fill
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}
            </div>

            {/* Specifications Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-slate-950 px-3 py-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                Spesifikasi Teknis
              </div>
              <div className="divide-y divide-slate-800/60 text-xs">
                {Object.entries(selectedItem.SPESIFIKASI || {}).map(([key, val]) => (
                  <div key={key} className="grid grid-cols-3 px-3 py-2">
                    <span className="text-slate-400">{key}</span>
                    <span className="col-span-2 font-medium text-slate-200">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Commercial Data Section */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <div className="text-[11px] text-slate-400">Harga Estimasi / Buka</div>
                <div className="text-sm font-bold text-white font-mono">
                  {formatIDR(selectedItem.HARGA_BUKA_WA || selectedItem.HARGA_ESTIMASI_PUBLIK)}
                </div>
              </div>

              {permissions?.canViewFloorPrice && (
                <div>
                  <div className="text-[11px] text-amber-400">Harga Floor (Batas Bawah)</div>
                  <div className="text-sm font-bold text-amber-300 font-mono">
                    {selectedItem.HARGA_FLOOR_WA ? formatIDR(selectedItem.HARGA_FLOOR_WA) : '-'}
                  </div>
                </div>
              )}

              {permissions?.canViewInternalCost && (
                <div>
                  <div className="text-[11px] text-purple-400">Modal HPP (Rahasia)</div>
                  <div className="text-sm font-bold text-purple-300 font-mono">
                    {selectedItem.HARGA_MODAL ? formatIDR(selectedItem.HARGA_MODAL) : '-'}
                  </div>
                </div>
              )}

              {selectedItem.STATUS_UNIT === 'SOLD' && (
                <div>
                  <div className="text-[11px] text-emerald-400">Harga Closing Riil</div>
                  <div className="text-sm font-bold text-emerald-300 font-mono">
                    {selectedItem.HARGA_CLOSING != null ? formatIDR(selectedItem.HARGA_CLOSING) : (selectedItem.HARGA_DEAL_WA ? formatIDR(selectedItem.HARGA_DEAL_WA) : 'Pihak Ketiga')}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <a
                href={formatCleanProductUrl(selectedItem.PRODUCT_TITLE, selectedItem.LINK_UNIT)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                <span>Lihat Halaman Publik (Web)</span>
              </a>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark As Sold Modal */}
      {soldModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Tandai Unit Terjual (SOLD)
            </h2>
            <p className="text-xs text-slate-400">
              Konfirmasi penjualan untuk SKU <span className="font-mono font-bold text-slate-200">{soldModalItem.SKU}</span>. Sistem akan mencatat tanggal terjual dan durasi hari secara otomatis.
            </p>

            <form onSubmit={handleMarkAsSoldSubmit} className="space-y-3">
              {/* Sales Channel Selector */}
              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1.5">
                  Siapa yang Menjual Unit Ini?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSoldByOther(false);
                      setSoldNotesInput('');
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                      !soldByOther
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">🟢 Sales BBKitchen</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Ada harga deal riil</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSoldByOther(true);
                      setSoldNotesInput('Dijual Orang Lain / Rekanan Gudang');
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                      soldByOther
                        ? 'bg-amber-950/80 border-amber-500 text-amber-300 ring-1 ring-amber-500/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">🟠 Pihak Ketiga / Gudang</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Harga tidak diketahui</div>
                  </button>
                </div>
              </div>

              {!soldByOther && (
                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">
                    Harga Deal Kesepakatan (IDR)
                  </label>
                  <input
                    type="number"
                    required
                    value={dealPriceInput}
                    onChange={(e) => setDealPriceInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Contoh: 45000000"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">
                  Catatan Pembeli / Keterangan
                </label>
                <textarea
                  rows={2}
                  value={soldNotesInput}
                  onChange={(e) => setSoldNotesInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder={soldByOther ? "Contoh: Terjual oleh pemilik gudang Pamulang" : "Contoh: Deal via WA Sales, dikirim ke Resto BSD"}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSoldModalItem(null)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20"
                >
                  Simpan Status Terjual
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick WhatsApp Pitch Modal */}
      {waModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Format Penawaran WhatsApp</h2>
                  <div className="text-xs font-mono text-amber-400">{waModalItem.SKU} • {waModalItem.LOKASI_UNIT}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaModalItem(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Quick Action Bar */}
            <div className="flex items-center gap-2">
              {waModalItem.LINK_TELEGRAM && (
                <a
                  href={waModalItem.LINK_TELEGRAM}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-800 text-[11px] font-bold"
                >
                  <Send className="w-3 h-3 text-blue-400" />
                  <span>Cek Telegram</span>
                </a>
              )}
              {waModalItem.FEATURED_IMAGE && (
                <a
                  href={waModalItem.FEATURED_IMAGE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Buka Foto HD</span>
                </a>
              )}
            </div>

            {/* Formatted Text Box */}
            <div className="flex-1 overflow-y-auto bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-300/90 whitespace-pre-wrap leading-relaxed">
              {(() => {
                const cleanTitle = waModalItem.PRODUCT_TITLE.replace(/[-|–]\s*BBKitchen.*/gi, '').trim();
                const publicUrl = formatCleanProductUrl(waModalItem.PRODUCT_TITLE, waModalItem.LINK_UNIT);
                const price = waModalItem.HARGA_BUKA_WA ? formatIDR(waModalItem.HARGA_BUKA_WA) : (waModalItem.HARGA_ESTIMASI_PUBLIK ? formatIDR(waModalItem.HARGA_ESTIMASI_PUBLIK) : 'Hubungi kami');

                return `Halo Kak! Terima kasih sudah menghubungi Bukan Baru Kitchen 🙏

Berikut informasi detail unit yang sedang *READY* di gudang:

📌 *${cleanTitle}*
• *Kode SKU:* ${waModalItem.SKU}
• *Kondisi:* ${waModalItem.KONDISI_UNIT || 'Bekas Siap Pakai'}
• *Lokasi Gudang:* ${waModalItem.LOKASI_UNIT}
• *Hasil Uji QC:* 100% Normal Siap Pakai

💰 *Penawaran Khusus:* ${price} *(Nego Halus)*
🔗 *Foto & Katalog Web:* ${publicUrl}

💡 *Kunjungan Fisik / Video Call:*
Kakak bisa datang langsung cek fisik & test running mesin di gudang (${waModalItem.LOKASI_UNIT.split(',')[0]}), atau mau kami kirimkan video uji fungsi unitnya Kak?

_Stok cepat berputar, segera amankan unit sebelum diambil resto lain!_`;
              })()}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  const cleanTitle = waModalItem.PRODUCT_TITLE.replace(/[-|–]\s*BBKitchen.*/gi, '').trim();
                  const publicUrl = formatCleanProductUrl(waModalItem.PRODUCT_TITLE, waModalItem.LINK_UNIT);
                  const price = waModalItem.HARGA_BUKA_WA ? formatIDR(waModalItem.HARGA_BUKA_WA) : (waModalItem.HARGA_ESTIMASI_PUBLIK ? formatIDR(waModalItem.HARGA_ESTIMASI_PUBLIK) : 'Hubungi kami');
                  const text = `Halo Kak! Terima kasih sudah menghubungi Bukan Baru Kitchen 🙏\n\nBerikut informasi detail unit yang sedang *READY* di gudang:\n\n📌 *${cleanTitle}*\n• *Kode SKU:* ${waModalItem.SKU}\n• *Kondisi:* ${waModalItem.KONDISI_UNIT || 'Bekas Siap Pakai'}\n• *Lokasi Gudang:* ${waModalItem.LOKASI_UNIT}\n• *Hasil Uji QC:* 100% Normal Siap Pakai\n\n💰 *Penawaran Khusus:* ${price} *(Nego Halus)*\n🔗 *Foto & Katalog Web:* ${publicUrl}\n\n💡 *Kunjungan Fisik / Video Call:*\nKakak bisa datang langsung cek fisik & test running mesin di gudang (${waModalItem.LOKASI_UNIT.split(',')[0]}), atau mau kami kirimkan video uji fungsi unitnya Kak?\n\n_Stok cepat berputar, segera amankan unit sebelum diambil resto lain!_`;
                  navigator.clipboard.writeText(text);
                  setWaCopied(true);
                  setTimeout(() => setWaCopied(false), 3000);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
              >
                {waCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{waCopied ? 'Teks Tersalin!' : 'Salin Pesan'}</span>
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent((() => {
                  const cleanTitle = waModalItem.PRODUCT_TITLE.replace(/[-|–]\s*BBKitchen.*/gi, '').trim();
                  const publicUrl = formatCleanProductUrl(waModalItem.PRODUCT_TITLE, waModalItem.LINK_UNIT);
                  const price = waModalItem.HARGA_BUKA_WA ? formatIDR(waModalItem.HARGA_BUKA_WA) : (waModalItem.HARGA_ESTIMASI_PUBLIK ? formatIDR(waModalItem.HARGA_ESTIMASI_PUBLIK) : 'Hubungi kami');
                  return `Halo Kak! Terima kasih sudah menghubungi Bukan Baru Kitchen 🙏\n\nBerikut informasi detail unit yang sedang *READY* di gudang:\n\n📌 *${cleanTitle}*\n• *Kode SKU:* ${waModalItem.SKU}\n• *Kondisi:* ${waModalItem.KONDISI_UNIT || 'Bekas Siap Pakai'}\n• *Lokasi Gudang:* ${waModalItem.LOKASI_UNIT}\n• *Hasil Uji QC:* 100% Normal Siap Pakai\n\n💰 *Penawaran Khusus:* ${price} *(Nego Halus)*\n🔗 *Foto & Katalog Web:* ${publicUrl}\n\n💡 *Kunjungan Fisik / Video Call:*\nKakak bisa datang langsung cek fisik & test running mesin di gudang (${waModalItem.LOKASI_UNIT.split(',')[0]}), atau mau kami kirimkan video uji fungsi unitnya Kak?\n\n_Stok cepat berputar, segera amankan unit sebelum diambil resto lain!_`;
                })())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-105"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Buka di WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
