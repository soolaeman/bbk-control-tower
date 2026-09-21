'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { MasterInventoryItem, PaginatedInventoryResponse } from '@/lib/types/inventory';
import { OFFICIAL_CATEGORIES } from '@/lib/repositories/categories';
import { formatIDR, formatCleanProductUrl, WAREHOUSE_14_HUBS } from '@/lib/repositories/warehouse-utils';
import {
  MessageSquare,
  Search,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Send,
  AlertCircle,
  Flame,
  MapPin,
  RefreshCw,
  Share2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Layers,
  ShoppingBag,
  Download,
  Smartphone,
  Laptop,
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

export function SalesHelperView() {
  const { role, permissions } = useAuth();
  
  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [warehouse, setWarehouse] = useState('ALL');
  const [sortOption, setSortOption] = useState<'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC'>('NEWEST');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(16);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Item states
  const [searchedItem, setSearchedItem] = useState<MasterInventoryItem | null>(null);
  const [items, setItems] = useState<MasterInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Deal Desk states
  const [quotePrice, setQuotePrice] = useState<number | ''>('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pageInput, setPageInput] = useState(String(page));

  // Sync pageInput whenever page changes
  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  // Mark Sold modal states
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [soldByOther, setSoldByOther] = useState(false);
  const [dealPriceInput, setDealPriceInput] = useState('');
  const [soldNotesInput, setSoldNotesInput] = useState('');
  const [soldSuccessMsg, setSoldSuccessMsg] = useState('');

  // Media Pitcher states (Cara 1 & Cara 2)
  const [isDownloadingPhotos, setIsDownloadingPhotos] = useState(false);
  const [photoDownloadStatus, setPhotoDownloadStatus] = useState('');
  const [webShareNotice, setWebShareNotice] = useState('');

  // Shared Audit Timestamps Tracker (Synced across Desktop <-> Mobile)
  const [auditTimestamps, setAuditTimestamps] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('bbk_audit_timestamps');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return {};
  });

  const selectItem = useCallback((item: MasterInventoryItem) => {
    setSearchedItem(item);
    setQuotePrice(item.HARGA_BUKA_WA || item.HARGA_ESTIMASI_PUBLIK || '');
  }, []);

  // Cross-device synchronization for audit timestamps ONLY (Row control strictly in Master Inventory)
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

  const markSkuAsVisited = (sku: string) => {
    const now = new Date();
    const datePart = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const timePart = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
    const timeStr = `${datePart}, ${timePart}`;

    if (typeof window !== 'undefined') {
      setAuditTimestamps((prev) => {
        const next = { ...prev, [sku]: timeStr };
        localStorage.setItem('bbk_audit_timestamps', JSON.stringify(next));
        return next;
      });
    }

    // Sync check timestamp ONLY to shared backend (Do NOT send activeSku from Sales tab)
    fetch('/api/audit-timestamps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, timestamp: timeStr }),
    }).catch(() => {});
  };

  // Set responsive pageSize on mount
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setPageSize(8); // Mobile: 8 per page
      } else {
        setPageSize(16); // Desktop: 16 per page
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  // Debounce live typing search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch ready items with pagination & filters
  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const isPriceSort = sortOption === 'PRICE_ASC' || sortOption === 'PRICE_DESC';
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        statusUnit: 'READY',
        sortBy: isPriceSort ? 'HARGA_BUKA_WA' : 'TANGGAL_MASUK',
        sortOrder: sortOption === 'PRICE_ASC' ? 'asc' : 'desc',
      });

      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (category !== 'ALL') params.append('category', category);
      if (warehouse !== 'ALL') params.append('warehouse', warehouse);

      const res = await fetch(`/api/inventory?${params.toString()}`, {
        headers: { ...(role ? { 'x-bbk-role': role } : {}) },
      });
      const data: PaginatedInventoryResponse = await res.json();
      if (data.items) {
        setItems(data.items);
        setTotalItems(data.total || 0);
        setTotalPages(data.totalPages || 1);

        // If searching, prioritize exact SKU or title match
        if (data.items.length > 0) {
          const q = debouncedSearch.trim().toLowerCase();
          const exactMatch = q ? data.items.find((i) => i.SKU.toLowerCase() === q || i.SKU.toLowerCase().replace(/\D/g, '') === q.replace(/\D/g, '')) : null;
          const found = data.items.find((i) => i.SKU === searchedItem?.SKU);

          if (exactMatch) {
            selectItem(exactMatch);
          } else if (found) {
            selectItem(found);
          } else {
            selectItem(data.items[0]);
          }
        } else {
          setSearchedItem(null);
        }
      }
    } catch (err) {
      console.error('Failed to load items for sales pitch', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedSearch, category, warehouse, sortOption, role, searchedItem?.SKU, selectItem]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(searchQuery);
    setPage(1);
  };

  // Report Sold Notice to Master Inventory Handler (No Direct Status Mutation Authority)
  const handleReportSoldNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchedItem) return;

    const targetSku = searchedItem.SKU;
    const finalNotes = soldByOther
      ? (soldNotesInput.trim() ? `[Terjual Pihak Ketiga/Gudang] ${soldNotesInput.trim()}` : 'Terjual Pihak Ketiga / Rekanan Gudang')
      : (soldNotesInput.trim() || 'Deal via WhatsApp Sales');

    const finalPrice = soldByOther ? 0 : (dealPriceInput ? Number(dealPriceInput) : (searchedItem.HARGA_DEAL_WA || searchedItem.HARGA_BUKA_WA || 0));

    setShowSoldModal(false);
    setDealPriceInput('');
    setSoldNotesInput('');
    setSoldByOther(false);

    try {
      const res = await fetch('/api/audit-timestamps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'REPORT_SOLD_NOTICE',
          sku: targetSku,
          productTitle: searchedItem.PRODUCT_TITLE,
          lokasiGudang: searchedItem.LOKASI_UNIT,
          dealPrice: finalPrice,
          notes: finalNotes,
          reportedBy: role || 'Sales Desk',
        }),
      });

      if (res.ok) {
        setSoldSuccessMsg(`✓ Laporan unit ${targetSku} berhasil diteruskan ke Master Inventory! Tim Admin/Gudang telah diinfokan untuk verifikasi & update status.`);
        setTimeout(() => setSoldSuccessMsg(''), 6000);
      } else {
        alert('Gagal mengirimkan laporan terjual ke Master Inventory');
      }
    } catch (err) {
      console.error('Error reporting sold notice in SalesHelper', err);
    }
  };

  // Generate clean WhatsApp pitch template (Without buyer name)
  const generateWhatsAppMessage = () => {
    if (!searchedItem) return '';

    const priceText = quotePrice
      ? formatIDR(Number(quotePrice))
      : formatIDR(searchedItem.HARGA_BUKA_WA || searchedItem.HARGA_ESTIMASI_PUBLIK);

    const cleanTitle = searchedItem.PRODUCT_TITLE
      .replace(/%%title%%|%%sep%%|%%sitename%%/gi, '')
      .replace(/[-|–]\s*BBKitchen.*/gi, '')
      .trim();

    const publicUrl = formatCleanProductUrl(searchedItem.PRODUCT_TITLE, searchedItem.LINK_UNIT);

    const specsList = Object.entries(searchedItem.SPESIFIKASI || {})
      .slice(0, 4)
      .map(([k, v]) => `• *${k}:* ${v}`)
      .join('\n');

    return `Halo Kak! Terima kasih sudah menghubungi Bukan Baru Kitchen! 🙏

Berikut informasi detail unit yang sedang *READY* hari ini di gudang:

📌 *${cleanTitle}*
• *Kode SKU:* ${searchedItem.SKU}
• *Kondisi Fisik:* ${searchedItem.KONDISI_UNIT || 'Bekas Siap Pakai'}
• *Lokasi Gudang:* ${searchedItem.LOKASI_UNIT || 'Pamulang 2, Tangsel'}
• *Hasil Uji QC:* 100% Normal Siap Pakai
${specsList ? `\n📋 *Spesifikasi:*\n${specsList}\n` : ''}
💰 *Penawaran Khusus:* ${priceText} *(Nego Halus)*
🔗 *Foto & Katalog Web:* ${publicUrl}

💡 *Kunjungan Fisik / Video Call:*
Kakak bisa datang langsung cek fisik dan test running mesin di gudang kami (${searchedItem.LOKASI_UNIT.split(',')[0]}), atau mau kami kirimkan video uji fungsi unitnya Kak?

_Stok cepat berputar, segera amankan unit sebelum diambil resto lain!_`;
  };

  const copyToClipboard = () => {
    const text = generateWhatsAppMessage();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const copyPublicLink = () => {
    if (!searchedItem) return;
    const url = formatCleanProductUrl(searchedItem.PRODUCT_TITLE, searchedItem.LINK_UNIT);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Cara 1: Batch Download all item photos (1-8 WebP/JPG)
  const handleBatchDownloadPhotos = async () => {
    if (!searchedItem) return;
    const urls = (searchedItem.PHOTO_URLS?.length ? searchedItem.PHOTO_URLS : [searchedItem.FEATURED_IMAGE]).filter(Boolean) as string[];
    if (urls.length === 0) {
      setPhotoDownloadStatus('Unit ini belum memiliki foto untuk diunduh.');
      setTimeout(() => setPhotoDownloadStatus(''), 3000);
      return;
    }

    setIsDownloadingPhotos(true);
    setPhotoDownloadStatus(`Mengunduh 1 dari ${urls.length} foto...`);

    try {
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        setPhotoDownloadStatus(`Mengunduh foto ${i + 1} dari ${urls.length}...`);
        try {
          const res = await fetch(url, { mode: 'cors' });
          if (!res.ok) throw new Error('Fetch failed');
          const blob = await res.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          const ext = url.split('.').pop()?.split(/[?#]/)[0] || 'jpg';
          a.download = `${searchedItem.SKU}-foto-${i + 1}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);
        } catch {
          // Fallback anchor direct download
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.download = `${searchedItem.SKU}-foto-${i + 1}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      setPhotoDownloadStatus(`✓ ${urls.length} Foto berhasil diunduh ke folder Downloads!`);
      setTimeout(() => setPhotoDownloadStatus(''), 4000);
    } catch (e) {
      console.error('Batch download error:', e);
      setPhotoDownloadStatus('Gagal mengunduh foto secara batch.');
      setTimeout(() => setPhotoDownloadStatus(''), 3000);
    } finally {
      setIsDownloadingPhotos(false);
    }
  };

  // Cara 2: Native Web Share API (Mobile WhatsApp Direct Pitch)
  const handleNativeWebShare = async () => {
    if (!searchedItem) return;
    const text = generateWhatsAppMessage();
    const url = formatCleanProductUrl(searchedItem.PRODUCT_TITLE, searchedItem.LINK_UNIT);

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `BBKitchen - ${searchedItem.SKU}`,
          text,
          url,
        });
        setWebShareNotice('✓ Berhasil dibagikan!');
        setTimeout(() => setWebShareNotice(''), 3000);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Web share failed, fallback to WA link:', err);
          const encoded = encodeURIComponent(text);
          window.open(`https://wa.me/?text=${encoded}`, '_blank');
        }
      }
    } else {
      // Fallback if browser doesn't support Web Share API
      const encoded = encodeURIComponent(text);
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  // Guardrail check
  const isBelowFloor =
    permissions.canViewFloorPrice &&
    searchedItem?.HARGA_FLOOR_WA &&
    quotePrice &&
    Number(quotePrice) < searchedItem.HARGA_FLOOR_WA;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-emerald-400" />
            <span>Quick Sales & WA Dispatcher</span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono border border-emerald-800">
              Sprint 2A Live
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Katalog stok live siap jual (Ready & Terhubung Woo): Pilih unit, cek grup Telegram, tandai terjual, dan buat penawaran WA instan.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSearchQuery('');
            setCategory('ALL');
            setWarehouse('ALL');
            setPage(1);
          }}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors self-start sm:self-auto flex items-center gap-1.5 text-xs font-semibold"
          title="Reset Filter"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Reset Filter</span>
        </button>
      </div>

      {/* Success Notification Alert */}
      {soldSuccessMsg && (
        <div className="p-3 bg-emerald-950/90 border border-emerald-700 rounded-xl text-xs text-emerald-200 flex items-center gap-2 shadow-lg">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{soldSuccessMsg}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Keyword Search */}
          <div className="md:col-span-4 relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari SKU atau nama alat... (Contoh: BBK2731, Chiller, Kwali) - Tekan Enter"
              className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute right-3 p-1 text-slate-500 hover:text-slate-200 text-xs rounded"
                title="Hapus Pencarian"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="md:col-span-3">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Kategori (Official)</option>
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

          {/* Warehouse Filter */}
          <div className="md:col-span-2">
            <select
              value={warehouse}
              onChange={(e) => {
                setWarehouse(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Hub (14 Hub)</option>
              {WAREHOUSE_14_HUBS.map((hub) => (
                <option key={hub.code} value={hub.code}>
                  {hub.code === 'BK' ? 'BK - BBKitchen (HQ)' : `${hub.code} - ${hub.partnerName} (${hub.hubGroup})`}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Filter (Buka WA Price & Newest) */}
          <div className="md:col-span-2">
            <select
              value={sortOption}
              onChange={(e) => {
                setSortOption(e.target.value as any);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="NEWEST">🔥 Terbaru Masuk</option>
              <option value="PRICE_ASC">🏷️ Buka WA: Termurah → Termahal</option>
              <option value="PRICE_DESC">🏷️ Buka WA: Termahal → Termurah</option>
            </select>
          </div>

          {/* Search Button */}
          <div className="md:col-span-1">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-full min-h-[38px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isLoading ? '...' : 'Cari'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Grid of Ready Units with Responsive Pagination */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Katalog Unit Siap Jual ({totalItems} Unit Ready)
            </span>
          </div>

          {/* Pagination Controls (Top) */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-mono text-slate-300">
              <span className="text-[11px] text-slate-400">Hal</span>
              <input
                type="number"
                min={1}
                max={totalPages || 1}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const num = parseInt(pageInput, 10);
                    if (!isNaN(num) && num >= 1 && num <= (totalPages || 1)) {
                      setPage(num);
                    } else {
                      setPageInput(String(page));
                    }
                  }
                }}
                onBlur={() => {
                  const num = parseInt(pageInput, 10);
                  if (!isNaN(num) && num >= 1 && num <= (totalPages || 1)) {
                    setPage(num);
                  } else {
                    setPageInput(String(page));
                  }
                }}
                className="w-12 px-1.5 py-0.5 text-center bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Ketik nomor halaman & tekan Enter"
              />
              <span className="text-[11px] text-slate-400">dari {totalPages || 1}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Item Cards Grid (Mobile 2 cols, Tablet 4 cols, Desktop 8 cols) */}
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
            <span className="text-xs">Memuat katalog unit...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Tidak ada unit ready yang sesuai dengan filter pencarian.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
              {items.map((item) => {
                const isSelected = searchedItem?.SKU === item.SKU;
                const rawTime = auditTimestamps[item.SKU] || item.LAST_CHECKED_TELEGRAM || item.TANGGAL_MASUK;
                const displayTime = rawTime ? formatTimestampWithYear(rawTime) : null;

                return (
                  <button
                    key={item.SKU}
                    type="button"
                    onClick={() => selectItem(item)}
                    className={`p-2 rounded-xl border text-left transition-all relative group ${
                      isSelected
                        ? 'bg-emerald-950/90 border-emerald-500 ring-2 ring-emerald-500/40 shadow-xl'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="relative aspect-square w-full rounded-lg bg-slate-900 overflow-hidden mb-1.5">
                      {item.FEATURED_IMAGE ? (
                        <img
                          src={item.FEATURED_IMAGE}
                          alt={item.PRODUCT_TITLE}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-600">
                          No Pic
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-amber-400 truncate">{item.SKU}</span>
                      <span className="text-[9px] font-mono text-slate-400 px-1 py-0.2 bg-slate-900 rounded">{item.asal_gudang}</span>
                    </div>
                    <div className="text-[10px] text-slate-300 truncate leading-tight mt-0.5">{item.PRODUCT_TITLE}</div>
                    <div className="text-[10px] text-emerald-400 font-mono mt-1 font-bold">
                      {item.HARGA_BUKA_WA ? formatIDR(item.HARGA_BUKA_WA) : 'Tanya Harga'}
                    </div>
                    {displayTime && (
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate" title="Waktu posting / audit">
                        🕒 {displayTime}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Pagination Controls (Bottom) */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                <span className="text-[11px]">
                  Menampilkan {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalItems)} dari {totalItems} Unit Ready
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 font-mono text-slate-300">
                    <span className="text-[11px] text-slate-400">Hal</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages || 1}
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const num = parseInt(pageInput, 10);
                          if (!isNaN(num) && num >= 1 && num <= (totalPages || 1)) {
                            setPage(num);
                          } else {
                            setPageInput(String(page));
                          }
                        }
                      }}
                      onBlur={() => {
                        const num = parseInt(pageInput, 10);
                        if (!isNaN(num) && num >= 1 && num <= (totalPages || 1)) {
                          setPage(num);
                        } else {
                          setPageInput(String(page));
                        }
                      }}
                      className="w-12 px-1.5 py-0.5 text-center bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-[11px] text-slate-400">dari {totalPages || 1}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={page <= 1 || isLoading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Halaman Sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages || isLoading}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Halaman Selanjutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Deal Helper Canvas */}
      {searchedItem && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Product Spec, Photos & Mark Sold Button (5 Cols) */}
          <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 space-y-4">
            {/* Header info */}
            <div className="flex items-start gap-3">
              <div className="relative w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
                {searchedItem.FEATURED_IMAGE ? (
                  <img
                    src={searchedItem.FEATURED_IMAGE}
                    alt={searchedItem.PRODUCT_TITLE}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/80">
                    {searchedItem.SKU}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {searchedItem.asal_gudang}
                  </span>
                  {searchedItem.PRODUCT_ID && searchedItem.PRODUCT_ID !== '0' && searchedItem.PRODUCT_ID !== '' ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-mono border border-blue-800">
                      Woo #{searchedItem.PRODUCT_ID}
                    </span>
                  ) : null}
                </div>
                <h2 className="text-sm font-bold text-white mt-1 line-clamp-2">
                  {searchedItem.PRODUCT_TITLE}
                </h2>
                <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  <span>{searchedItem.LOKASI_UNIT}</span>
                </div>
                {(auditTimestamps[searchedItem.SKU] || searchedItem.LAST_CHECKED_TELEGRAM) && (
                  <div className="text-[10px] font-mono text-emerald-400/90 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 mt-1">
                    <span>🕒 Terakhir Dicek:</span>
                    <strong>{formatTimestampWithYear(auditTimestamps[searchedItem.SKU] || searchedItem.LAST_CHECKED_TELEGRAM)}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Verification & Action Bar */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {searchedItem.LINK_TELEGRAM ? (
                <a
                  href={searchedItem.LINK_TELEGRAM}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => markSkuAsVisited(searchedItem.SKU)}
                  className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-800 text-xs font-bold transition-colors text-center"
                  title="Verifikasi langsung di grup Telegram gudang"
                >
                  <Send className="w-3.5 h-3.5 text-blue-400" />
                  <span>Telegram</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-slate-950 text-slate-600 border border-slate-800 text-xs font-bold cursor-not-allowed"
                >
                  <span>No TG</span>
                </button>
              )}

              <button
                type="button"
                onClick={copyPublicLink}
                className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold transition-colors text-center"
                title="Salin Link Web Publik"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Tersalin' : 'Link Web'}</span>
              </button>

              {/* Report Sold Action (Notice to Master Inventory) */}
              <button
                type="button"
                onClick={() => {
                  setDealPriceInput(String(searchedItem.HARGA_DEAL_WA || searchedItem.HARGA_BUKA_WA || ''));
                  setShowSoldModal(true);
                }}
                className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 text-xs font-bold transition-colors text-center"
                title="Kirim notifikasi lapor terjual ke tim Master Inventory"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                <span>📢 Lapor Terjual</span>
              </button>
            </div>

            {/* Photo Gallery with Direct Download / Preview */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Foto Unit ({searchedItem.PHOTO_URLS?.length || 1} Foto)</span>
                <button
                  type="button"
                  onClick={handleBatchDownloadPhotos}
                  disabled={isDownloadingPhotos}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[10px] font-bold transition-all disabled:opacity-50"
                  title="Unduh seluruh foto unit sekaligus untuk drag & drop ke WhatsApp Web"
                >
                  <Download className={`w-3 h-3 ${isDownloadingPhotos ? 'animate-bounce' : ''}`} />
                  <span>{isDownloadingPhotos ? 'Mengunduh...' : 'Unduh Semua Foto'}</span>
                </button>
              </div>

              {photoDownloadStatus && (
                <div className="p-2 rounded-lg bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-[10px] font-mono flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{photoDownloadStatus}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {(searchedItem.PHOTO_URLS?.length ? searchedItem.PHOTO_URLS : [searchedItem.FEATURED_IMAGE]).map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-square rounded-lg bg-slate-950 border border-slate-800 overflow-hidden hover:border-amber-500 transition-colors group"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-600">
                        No Pic
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <ExternalLink className="w-3.5 h-3.5 text-white" />
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Price Quote Config (Without Nama Pembeli) */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Kalkulator Penawaran (Deal Desk)</span>
                {searchedItem.HARGA_BUKA_WA && (
                  <span className="text-[11px] font-mono text-emerald-400 font-normal">
                    Buka: {formatIDR(searchedItem.HARGA_BUKA_WA)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">No. WA Pembeli (Opsional)</label>
                  <input
                    type="tel"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="08123456789"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Harga Buka Nego (IDR)</label>
                  <input
                    type="number"
                    value={quotePrice}
                    onChange={(e) => setQuotePrice(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Guardrail Warning */}
              {isBelowFloor && (
                <div className="p-2.5 bg-rose-950/80 border border-rose-800 rounded-lg text-xs text-rose-300 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">PERINGATAN FLOOR:</span> Tawaran{' '}
                    <span className="font-mono">{formatIDR(Number(quotePrice))}</span> di bawah Floor Price{' '}
                    <span className="font-mono">{formatIDR(searchedItem.HARGA_FLOOR_WA!)}</span>.
                  </div>
                </div>
              )}

              {/* Floor price confidential */}
              {permissions.canViewFloorPrice && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Floor Price (Batas Bawah Nego):</span>
                  <span className="text-amber-400 font-bold">
                    {searchedItem.HARGA_FLOOR_WA ? formatIDR(searchedItem.HARGA_FLOOR_WA) : '-'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Copyable WhatsApp Pitch Preview (7 Cols) */}
          <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Format Pesan WhatsApp (Siap Kirim ke Pembeli)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin!' : 'Salin Pesan WA'}</span>
                </button>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-300/90 whitespace-pre-wrap leading-relaxed max-h-[460px] overflow-y-auto selection:bg-emerald-800">
                {generateWhatsAppMessage()}
              </div>
            </div>

            {/* Media Pitcher Dual Lane (Cara 1: Desktop Drag & Drop vs Cara 2: Mobile 1-Tap Share) */}
            <div className="pt-3 border-t border-slate-800/80 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Lane 1: Cara 1 (Desktop PC / Laptop) */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-slate-200">Cara 1 (Desktop / Laptop)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Salin teks pitch & unduh batch foto untuk langsung di-drag ke WhatsApp Web.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Tersalin' : '1. Salin Teks'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleBatchDownloadPhotos}
                      disabled={isDownloadingPhotos}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 border border-blue-800 text-blue-300 text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      <Download className={`w-3.5 h-3.5 ${isDownloadingPhotos ? 'animate-bounce' : ''}`} />
                      <span>{isDownloadingPhotos ? 'Mengunduh...' : '2. Unduh Foto'}</span>
                    </button>
                  </div>
                </div>

                {/* Lane 2: Cara 2 (Mobile Phone / 1-Tap Share) */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-200">Cara 2 (Mobile / 1-Tap Share)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Buka native share sheet langsung ke WhatsApp (Web Share API) atau direct chat.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleNativeWebShare}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02]"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>{webShareNotice || '1-Tap Share WA'}</span>
                    </button>
                    <a
                      href={(() => {
                        const text = encodeURIComponent(generateWhatsAppMessage());
                        if (buyerPhone.trim()) {
                          let cleanPhone = buyerPhone.replace(/[^0-9]/g, '');
                          if (cleanPhone.startsWith('0')) {
                            cleanPhone = '62' + cleanPhone.slice(1);
                          }
                          return `https://wa.me/${cleanPhone}?text=${text}`;
                        }
                        return `https://wa.me/?text=${text}`;
                      })()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-colors"
                      title={buyerPhone.trim() ? `Direct chat ke ${buyerPhone}` : 'Pilih kontak WA'}
                    >
                      <Send className="w-3.5 h-3.5 text-emerald-400" />
                      <span>wa.me</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Sold Notice Modal (Inform to Master Inventory) */}
      {showSoldModal && searchedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📢 Lapor Unit Terjual</span>
                  <span className="text-[10px] font-mono font-bold bg-amber-950 border border-amber-800 text-amber-300 px-2 py-0.5 rounded">
                    Info ke Master Inventory
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{searchedItem.SKU} • {searchedItem.PRODUCT_TITLE}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSoldModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              ℹ️ <strong>Catatan:</strong> Laporan ini akan otomatis dikirimkan sebagai notifikasi ke tab <strong>Master Inventory</strong>. Status unit di database resmi akan divalidasi & diubah oleh Admin/Operator Gudang.
            </p>

            <form onSubmit={handleReportSoldNoticeSubmit} className="space-y-4">
              {/* Dual Channel Choice */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-300">Siapa yang menjual unit ini?</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSoldByOther(false)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors ${
                      !soldByOther
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Saya / Tim Sales BBK
                  </button>
                  <button
                    type="button"
                    onClick={() => setSoldByOther(true)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors ${
                      soldByOther
                        ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Pihak Ketiga / Gudang
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
                    placeholder="Contoh: 4500000"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">
                  Catatan Penjualan / Keterangan Pembeli
                </label>
                <textarea
                  rows={2}
                  value={soldNotesInput}
                  onChange={(e) => setSoldNotesInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder={soldByOther ? "Contoh: Terjual oleh pemilik gudang Sawangan" : "Contoh: Deal via WA Sales, dikirim ke Resto BSD"}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSoldModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-950/40"
                >
                  Kirim Info Terjual
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
