'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  ShieldCheck,
  AlertTriangle,
  Image as ImageIcon,
  CheckCircle2,
  Edit3,
  ExternalLink,
  RotateCcw,
  Search,
  Filter,
  Eye,
  Trash2,
  Sparkles,
  Zap,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Send,
  MessageSquare
} from 'lucide-react';
import { OFFICIAL_CATEGORIES } from '@/lib/repositories/categories';

const R2_BASE = 'https://pub-946d1fe1a1b1461eb2cca6be4462ba11.r2.dev';

export function CatalogQualityTriage() {
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 3133, clean: 2824, desync: 0, quarantine: 0, needsReview: 309 });
  const [activeTab, setActiveTab] = useState<'ALL' | 'CLEAN' | 'NEEDS_REVIEW' | 'DESYNC' | 'QUARANTINE'>('NEEDS_REVIEW');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    title: '',
    category_slug: '',
    kondisi_unit: 'Bekas',
    status_unit: 'READY',
    status_pipeline: 'READY',
    harga_buka_wa: 0,
    harga_display_low: 0,
    harga_display_high: 0
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/catalog-triage?filter=${activeTab}&search=${encodeURIComponent(search)}&page=${page}&pageSize=30`);
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
        setStats(data.stats);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch triage items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, search, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showToast = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleAcc = async (sku: string) => {
    try {
      const res = await fetch('/api/admin/catalog-triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ACC_WHITELIST', sku })
      });
      const data = await res.json();
      showToast(`✅ SKU ${sku} berhasil di-ACC & masuk Verified Clean!`);
      fetchData();
    } catch {
      showToast('❌ Gagal melakukan ACC');
    }
  };

  const handleQuarantine = async (sku: string) => {
    try {
      const res = await fetch('/api/admin/catalog-triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'QUARANTINE', sku })
      });
      showToast(`⛔ SKU ${sku} dikarantina / disembunyikan dari etalase!`);
      fetchData();
    } catch {
      showToast('❌ Gagal mengkarantina unit');
    }
  };

  const openEditModal = (item: any) => {
    setSelectedSku(item);
    setEditForm({
      title: item.title || '',
      category_slug: item.category_slug || '',
      kondisi_unit: item.kondisi_unit || 'Bekas',
      status_unit: item.status_unit || 'READY',
      status_pipeline: item.status_pipeline || 'READY',
      harga_buka_wa: Number(item.harga_buka_wa) || 0,
      harga_display_low: Number(item.harga_display_low) || 0,
      harga_display_high: Number(item.harga_display_high) || 0
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedSku) return;
    try {
      const res = await fetch('/api/admin/catalog-triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_SINGLE',
          sku: selectedSku.sku,
          updates: editForm
        })
      });
      showToast(`💾 Perubahan SKU ${selectedSku.sku} tersimpan ke SQLite!`);
      setIsEditModalOpen(false);
      fetchData();
    } catch {
      showToast('❌ Gagal menyimpan perubahan');
    }
  };

  const formatIDR = (val: number | null | undefined) => {
    if (!val) return '—';
    return `Rp ${Number(val).toLocaleString('id-ID')}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notice */}
      {actionNotice && (
        <div className="fixed top-16 right-8 z-50 bg-emerald-950 border border-emerald-500 text-emerald-200 px-5 py-3 rounded-xl shadow-2xl font-bold flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#1a1a24] to-slate-900 border border-white/[0.08] rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-black text-white tracking-wide uppercase">
                Quality Matrix & Mitigasi Foto Visual
              </h1>
              <p className="text-xs text-white/60 font-mono mt-0.5">
                Pusat Forensic Triage, Deteksi Desinkronisasi Foto & Remediasi Katalog 3.133 Unit
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => fetchData()}
          className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] rounded-xl text-xs font-bold text-slate-300 flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => { setActiveTab('ALL'); setPage(1); }}
          className={`p-4 rounded-xl border text-left transition ${
            activeTab === 'ALL'
              ? 'bg-blue-950/40 border-blue-500 text-blue-200 shadow-lg'
              : 'bg-[#141417] border-white/[0.06] text-slate-400 hover:text-white'
          }`}
        >
          <div className="text-[10px] uppercase font-mono font-bold">Total Katalog</div>
          <div className="text-2xl font-black text-white mt-1">{stats.total.toLocaleString()}</div>
        </button>

        <button
          onClick={() => { setActiveTab('CLEAN'); setPage(1); }}
          className={`p-4 rounded-xl border text-left transition ${
            activeTab === 'CLEAN'
              ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200 shadow-lg'
              : 'bg-[#141417] border-white/[0.06] text-slate-400 hover:text-white'
          }`}
        >
          <div className="text-[10px] uppercase font-mono font-bold text-emerald-400">🟢 Verified Clean</div>
          <div className="text-2xl font-black text-emerald-300 mt-1">{stats.clean.toLocaleString()}</div>
        </button>

        <button
          onClick={() => { setActiveTab('NEEDS_REVIEW'); setPage(1); }}
          className={`p-4 rounded-xl border text-left transition ${
            activeTab === 'NEEDS_REVIEW'
              ? 'bg-amber-950/40 border-amber-500 text-amber-200 shadow-lg'
              : 'bg-[#141417] border-white/[0.06] text-slate-400 hover:text-white'
          }`}
        >
          <div className="text-[10px] uppercase font-mono font-bold text-amber-400">🟡 Needs Attention</div>
          <div className="text-2xl font-black text-amber-300 mt-1">{stats.needsReview.toLocaleString()}</div>
        </button>

        <button
          onClick={() => { setActiveTab('DESYNC'); setPage(1); }}
          className={`p-4 rounded-xl border text-left transition ${
            activeTab === 'DESYNC'
              ? 'bg-rose-950/40 border-rose-500 text-rose-200 shadow-lg'
              : 'bg-[#141417] border-white/[0.06] text-slate-400 hover:text-white'
          }`}
        >
          <div className="text-[10px] uppercase font-mono font-bold text-rose-400">🔴 Foto Desync</div>
          <div className="text-2xl font-black text-rose-300 mt-1">{stats.desync.toLocaleString()}</div>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-[#141417] border border-white/[0.08] rounded-xl p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari SKU, Judul, Kategori..."
            className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/[0.08] rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>

        <div className="text-xs text-white/50 font-mono">
          Menampilkan halaman <strong className="text-white">{page}</strong> dari <strong className="text-white">{totalPages}</strong>
        </div>
      </div>

      {/* Forensic Triage Table */}
      <div className="bg-[#141417] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0e0e11] text-white/60 font-mono uppercase text-[10px] tracking-wider border-b border-white/[0.08]">
              <tr>
                <th className="py-3.5 px-4">Foto Fisik</th>
                <th className="py-3.5 px-3">SKU & Kategori</th>
                <th className="py-3.5 px-4">Judul Kanonikal & Dimensi</th>
                <th className="py-3.5 px-3">Harga WA / Web</th>
                <th className="py-3.5 px-3">Status Triage & AI Vision</th>
                <th className="py-3.5 px-4 text-right">Aksi Mitigasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-mono text-[11px]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Memuat data forensic triage...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <span>Tidak ada item anomali dalam filter ini! Semua bersih.</span>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const photoFilename = (item.photo_urls || item.featured_image || `${item.sku}_1.webp`).split('|')[0].split(',')[0].trim();
                  const photoUrl = photoFilename.startsWith('http') ? photoFilename : `${R2_BASE}/${photoFilename}`;
                  const isDesync = item.photo_desync_flag === 1 || item.ai_vision_status === 'DESYNC_MISMATCH';
                  const isQuarantine = item.status_pipeline === 'QUARANTINE';

                  return (
                    <tr key={item.sku} className="hover:bg-white/[0.02] transition-colors">
                      {/* Photo Thumbnail */}
                      <td className="py-3 px-4">
                        <div
                          onClick={() => setZoomImage(photoUrl)}
                          className="relative w-16 h-16 rounded-lg bg-black/40 border border-white/[0.1] overflow-hidden cursor-pointer group shrink-0"
                        >
                          <img
                            src={photoUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                            onError={(e: any) => { e.target.src = '/logo.png'; }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </td>

                      {/* SKU & Category */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-amber-400 font-mono text-xs">{item.sku}</div>
                        <div className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/40 text-blue-300 text-[10px]">
                          {item.category_slug || 'uncategorized'}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 font-sans">{item.lokasi_unit || 'Pamulang'}</div>
                      </td>

                      {/* Title & Dimension */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-white leading-relaxed font-sans">{item.title}</div>
                        {item.vision_catatan && (
                          <div className="text-[10px] text-slate-400 mt-1 italic flex items-center gap-1 font-sans">
                            <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>{item.vision_catatan}</span>
                          </div>
                        )}
                      </td>

                      {/* Pricing */}
                      <td className="py-3 px-3">
                        <div className="text-white font-bold">{formatIDR(item.harga_buka_wa)}</div>
                        <div className="text-[10px] text-slate-500">
                          Web: {formatIDR(item.harga_display_low)} - {formatIDR(item.harga_display_high)}
                        </div>
                      </td>

                      {/* Status & Flags */}
                      <td className="py-3 px-3">
                        {isDesync ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-950/80 border border-rose-600 text-rose-300 font-bold text-[10px]">
                            <AlertTriangle className="w-3 h-3" />
                            <span>FOTO MISMATCH</span>
                          </span>
                        ) : isQuarantine ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 border border-slate-600 text-slate-300 font-bold text-[10px]">
                            <span>⛔ DIKARANTINA</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[10px]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>VERIFIED</span>
                          </span>
                        )}
                        {item.vision_kondisi_persen && (
                          <div className="text-[10px] text-slate-500 mt-1">Fisik: {item.vision_kondisi_persen}%</div>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {/* 1-Click ACC */}
                        <button
                          onClick={() => handleAcc(item.sku)}
                          title="ACC & Nyatakan Bersih (Verified Clean)"
                          className="p-1.5 bg-emerald-950/80 hover:bg-emerald-800 border border-emerald-600 text-emerald-300 rounded-lg transition"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>

                        {/* Quick Edit */}
                        <button
                          onClick={() => openEditModal(item)}
                          title="Edit Judul, Kategori & Harga"
                          className="p-1.5 bg-blue-950/80 hover:bg-blue-800 border border-blue-600 text-blue-300 rounded-lg transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Telegram Link */}
                        {item.link_telegram && (
                          <a
                            href={item.link_telegram}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Buka Pesan Telegram Asli Gudang"
                            className="inline-block p-1.5 bg-cyan-950/80 hover:bg-cyan-800 border border-cyan-600 text-cyan-300 rounded-lg transition"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {/* Quarantine Non-Kitchen */}
                        <button
                          onClick={() => handleQuarantine(item.sku)}
                          title="Karantina / Sembunyikan dari Storefront"
                          className="p-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-400 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-[#0e0e11] border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-400">
          <div>
            Total <strong className="text-white">{stats.total}</strong> produk di database master
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-white px-2">Halaman {page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && selectedSku && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141417] border border-white/[0.1] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-bold text-white uppercase font-mono">
                ✏️ Edit SKU: <span className="text-amber-400">{selectedSku.sku}</span>
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-mono">Judul Produk Resmi</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-sans focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono">Kategori 66-SSOT</label>
                <select
                  value={editForm.category_slug}
                  onChange={(e) => setEditForm({ ...editForm, category_slug: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-amber-500 focus:outline-none"
                >
                  {OFFICIAL_CATEGORIES.map((cat: any) => (
                    <option key={cat.slug} value={cat.slug}>{cat.name} ({cat.slug})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-mono">Harga Buka WA (Rp)</label>
                  <input
                    type="number"
                    value={editForm.harga_buka_wa}
                    onChange={(e) => setEditForm({ ...editForm, harga_buka_wa: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-mono">Kondisi</label>
                  <select
                    value={editForm.kondisi_unit}
                    onChange={(e) => setEditForm({ ...editForm, kondisi_unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:border-amber-500 focus:outline-none"
                  >
                    <option value="Bekas">Bekas</option>
                    <option value="Baru">Baru</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/[0.08]">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-lg"
              >
                <Check className="w-4 h-4" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Zoom Modal */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-white/20">
            <img src={zoomImage} alt="Zoom" className="w-full h-full object-contain" />
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 p-2 bg-black/60 rounded-full text-white hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
