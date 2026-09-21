'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/auth-context';
import { MasterInventoryItem, PipelineStatus } from '@/lib/types/inventory';
import { PipelineBadge } from '@/components/ui/StatusBadges';
import { formatIDR, resolveLocationFromCode } from '@/lib/repositories/warehouse-utils';
import { ResolveNonSkuModal, NonSkuResolveItem } from './ResolveNonSkuModal';
import {
  AlertTriangle,
  ImageOff,
  HelpCircle,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  Wrench,
  Check,
  Package,
  Layers,
  Link2,
  Flame,
  Radio,
  Clock,
  Trash2,
  CheckCheck,
  Building,
  DollarSign,
  Tag,
} from 'lucide-react';

type PrimaryHubTab = 'QC_DATA_QUALITY' | 'SALES_SOLD_QUEUE' | 'NON_SKU_RESOLVE_QUEUE';

interface SoldReportItem {
  id: string;
  sku: string;
  dealPrice?: number;
  notes: string;
  reportedAt: string;
  reportedBy: string;
}

interface NonSkuQueueItem {
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  customerName: string;
  sku: string;
  productTitle: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  isResolved: boolean;
}

export function PipelineMonitor() {
  const { role, permissions } = useAuth();
  const canEdit = role === 'ADMIN' || Boolean(permissions?.canEditPipeline || permissions?.canEditInventory);
  
  // Primary Hub Tab
  const [hubTab, setHubTab] = useState<PrimaryHubTab>('QC_DATA_QUALITY');

  // Tab 1: Data Quality State
  const [activeQcFilter, setActiveQcFilter] = useState<PipelineStatus | 'ALL_EXCEPTIONS'>('ALL_EXCEPTIONS');
  const [items, setItems] = useState<MasterInventoryItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoadingQc, setIsLoadingQc] = useState(true);

  // Tab 2: Sold Reports State
  const [soldReports, setSoldReports] = useState<SoldReportItem[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  // Tab 3: Non-SKU Invoices State
  const [nonSkuItems, setNonSkuItems] = useState<NonSkuQueueItem[]>([]);
  const [isLoadingNonSku, setIsLoadingNonSku] = useState(false);

  // Modal State for Non-SKU
  const [resolveItem, setResolveItem] = useState<NonSkuResolveItem | null>(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  // Common UI State
  const [actionMessage, setActionMessage] = useState('');
  const [executingSku, setExecutingSku] = useState<string | null>(null);

  // 1. Load Data Quality Exceptions
  const loadPipelineData = useCallback(async () => {
    setIsLoadingQc(true);
    try {
      const url = `/api/inventory?pageSize=50&statusPipeline=${encodeURIComponent(activeQcFilter)}`;
      const res = await fetch(url, {
        headers: { ...(role ? { 'x-bbk-role': role } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to load pipeline exceptions', err);
    } finally {
      setIsLoadingQc(false);
    }
  }, [activeQcFilter, role]);

  // 2. Load Pending Sold Reports from Sales Desk
  const loadSoldReports = useCallback(async () => {
    setIsLoadingReports(true);
    try {
      const res = await fetch('/api/audit-timestamps');
      if (res.ok) {
        const data = await res.json();
        setSoldReports(data.soldNotices || []);
      }
    } catch (err) {
      console.error('Failed to load sold reports', err);
    } finally {
      setIsLoadingReports(false);
    }
  }, []);

  // 3. Load Invoices with Non-SKU items
  const loadNonSkuInvoices = useCallback(async () => {
    setIsLoadingNonSku(true);
    try {
      const res = await fetch('/api/invoices', {
        headers: { ...(role ? { 'x-bbk-role': role } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        const invoices = data.invoices || [];
        const queue: NonSkuQueueItem[] = [];

        invoices.forEach((inv: any) => {
          (inv.items || []).forEach((it: any) => {
            const skuStr = (it.sku || '').trim().toUpperCase();
            const isNonSku = !skuStr || skuStr.startsWith('BBK-CUSTOM') || skuStr.startsWith('INV-');
            if (isNonSku) {
              queue.push({
                invoiceId: inv.id,
                invoiceNumber: inv.invoiceNumber,
                issueDate: inv.issueDate,
                customerName: inv.customerName,
                sku: it.sku || `BBK-CUSTOM-${inv.invoiceNumber}`,
                productTitle: it.description || 'Unit Custom / Fabrikasi',
                quantity: it.quantity || 1,
                unitPrice: it.unitPrice || 0,
                unitCost: it.unitCost || 0,
                isResolved: (it.unitCost || 0) > 0,
              });
            }
          });
        });

        setNonSkuItems(queue);
      }
    } catch (err) {
      console.error('Failed to load non-sku items', err);
    } finally {
      setIsLoadingNonSku(false);
    }
  }, [role]);

  useEffect(() => {
    loadPipelineData();
    loadSoldReports();
    loadNonSkuInvoices();
  }, [loadPipelineData, loadSoldReports, loadNonSkuInvoices]);

  // Handler: Pipeline Exception Actions
  const handleResolvePipelineAction = async (sku: string, newStatus: PipelineStatus) => {
    try {
      const res = await fetch('/api/pipeline/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, newStatus, clearDirty: true }),
      });
      if (res.ok) {
        setActionMessage(`Unit ${sku} berhasil diperbarui ke ${newStatus}.`);
        loadPipelineData();
        setTimeout(() => setActionMessage(''), 4000);
      }
    } catch (err) {
      console.error('Action error', err);
    }
  };

  // Handler: Confirm Sold Notice from Sales Desk
  const handleConfirmSoldReport = async (report: SoldReportItem) => {
    setExecutingSku(report.sku);
    try {
      // 1. Mark status SOLD in Master Inventory
      const resInv = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_STOCK_STATUS',
          sku: report.sku,
          status: 'SOLD',
          dealPrice: report.dealPrice,
          notes: `Confirmed from Sales Sold Report (${report.notes})`,
        }),
      });

      // 2. Dismiss from LAPORAN_TERJUAL sheet
      await fetch('/api/audit-timestamps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DISMISS_SOLD_NOTICE',
          sku: report.sku,
          noticeId: report.id,
        }),
      });

      setActionMessage(`Unit ${report.sku} berhasil dikonfirmasi SOLD dan dihapus dari antrean laporan.`);
      loadSoldReports();
      setTimeout(() => setActionMessage(''), 4000);
    } catch (err) {
      console.error('Failed to confirm sold report', err);
    } finally {
      setExecutingSku(null);
    }
  };

  // Handler: Dismiss Sold Report
  const handleDismissSoldReport = async (report: SoldReportItem) => {
    try {
      await fetch('/api/audit-timestamps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DISMISS_SOLD_NOTICE',
          sku: report.sku,
          noticeId: report.id,
        }),
      });

      setActionMessage(`Laporan unit ${report.sku} telah diabaikan/dihapus.`);
      loadSoldReports();
      setTimeout(() => setActionMessage(''), 4000);
    } catch (err) {
      console.error('Failed to dismiss sold report', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            <span>Pusat Rekonsiliasi & Operasional Pipeline</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Pusat penyelarasan kualitas data katalog, antrean konfirmasi unit sold tim sales, dan rekonsiliasi HPP Non-SKU.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            loadPipelineData();
            loadSoldReports();
            loadNonSkuInvoices();
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-semibold hover:border-slate-700 transition-colors shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQc || isLoadingReports || isLoadingNonSku ? 'animate-spin' : ''}`} />
          <span>Sync Semua Antrean</span>
        </button>
      </div>

      {actionMessage && (
        <div className="p-3.5 bg-emerald-950/90 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2.5 shadow-lg">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <div className="p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-wrap sm:flex-nowrap gap-1 shadow-md">
        <button
          type="button"
          onClick={() => setHubTab('QC_DATA_QUALITY')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            hubTab === 'QC_DATA_QUALITY'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>1. Pipeline & QC Funnel</span>
          {stats?.errors ? (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-950 text-rose-300 border border-rose-800 font-mono">
              {stats.errors}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setHubTab('SALES_SOLD_QUEUE')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            hubTab === 'SALES_SOLD_QUEUE'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>2. Laporan Terjual Sales Desk</span>
          {soldReports.length > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold">
              {soldReports.length} Pending
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setHubTab('NON_SKU_RESOLVE_QUEUE')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
            hubTab === 'NON_SKU_RESOLVE_QUEUE'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Link2 className="w-4 h-4" />
          <span>3. Antrean Resolusi Non-SKU</span>
          {nonSkuItems.filter((i) => !i.isResolved).length > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono font-bold">
              {nonSkuItems.filter((i) => !i.isResolved).length}
            </span>
          ) : null}
        </button>
      </div>

      {/* TAB 1: DATA QUALITY & PIPELINE QC */}
      {hubTab === 'QC_DATA_QUALITY' && (
        <div className="space-y-4">
          {/* Actionable Filter Cards (Red, Yellow, Orange, Blue, Green) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* RED: Errors */}
            <button
              type="button"
              onClick={() => setActiveQcFilter(activeQcFilter === 'ERROR' ? 'ALL_EXCEPTIONS' : 'ERROR')}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                activeQcFilter === 'ERROR'
                  ? 'bg-rose-950 border-rose-600 ring-2 ring-rose-500/40 shadow-lg shadow-rose-950/50'
                  : 'bg-slate-900/90 border-slate-800/80 hover:border-rose-800/80'
              }`}
            >
              <div className="flex items-center justify-between text-rose-400 text-xs font-bold uppercase tracking-wider">
                <span>Critical Errors</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-black text-rose-400 font-mono mt-2">
                {stats ? (stats.errors ?? 0) : <span className="text-sm animate-pulse text-slate-500">...</span>}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Data dirty / spec rusak</div>
            </button>

            {/* YELLOW: Missing Photos */}
            <button
              type="button"
              onClick={() => setActiveQcFilter(activeQcFilter === 'NO_PHOTOS_FOUND' ? 'ALL_EXCEPTIONS' : 'NO_PHOTOS_FOUND')}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                activeQcFilter === 'NO_PHOTOS_FOUND'
                  ? 'bg-amber-950 border-amber-600 ring-2 ring-amber-500/40 shadow-lg shadow-amber-950/50'
                  : 'bg-slate-900/90 border-slate-800/80 hover:border-amber-800/80'
              }`}
            >
              <div className="flex items-center justify-between text-amber-400 text-xs font-bold uppercase tracking-wider">
                <span>Missing Photos</span>
                <ImageOff className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono mt-2">
                {stats ? (stats.pendingPhotos ?? 0) : <span className="text-sm animate-pulse text-slate-500">...</span>}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Foto belum ter-scrape</div>
            </button>

            {/* ORANGE: Ambiguous */}
            <button
              type="button"
              onClick={() => setActiveQcFilter(activeQcFilter === 'AMBIGUOUS' ? 'ALL_EXCEPTIONS' : 'AMBIGUOUS')}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                activeQcFilter === 'AMBIGUOUS'
                  ? 'bg-purple-950 border-purple-600 ring-2 ring-purple-500/40 shadow-lg shadow-purple-950/50'
                  : 'bg-slate-900/90 border-slate-800/80 hover:border-purple-800/80'
              }`}
            >
              <div className="flex items-center justify-between text-purple-400 text-xs font-bold uppercase tracking-wider">
                <span>Ambiguous Dups</span>
                <HelpCircle className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-black text-purple-400 font-mono mt-2">
                {stats ? (stats.ambiguous ?? 0) : <span className="text-sm animate-pulse text-slate-500">...</span>}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Duplikasi row Sheets</div>
            </button>

            {/* BLUE: Ready to Publish */}
            <button
              type="button"
              onClick={() => setActiveQcFilter(activeQcFilter === 'READY_TO_PUBLISH' ? 'ALL_EXCEPTIONS' : 'READY_TO_PUBLISH')}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                activeQcFilter === 'READY_TO_PUBLISH'
                  ? 'bg-blue-950 border-blue-600 ring-2 ring-blue-500/40 shadow-lg shadow-blue-950/50'
                  : 'bg-slate-900/90 border-slate-800/80 hover:border-blue-800/80'
              }`}
            >
              <div className="flex items-center justify-between text-blue-400 text-xs font-bold uppercase tracking-wider">
                <span>Ready to Publish</span>
                <UploadCloud className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-black text-blue-400 font-mono mt-2">
                {stats ? (stats.readyToPublish ?? 0) : <span className="text-sm animate-pulse text-slate-500">...</span>}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Siap tayang ke publik</div>
            </button>

            {/* GREEN: Published Healthy */}
            <button
              type="button"
              onClick={() => setActiveQcFilter(activeQcFilter === 'PUBLISHED' ? 'ALL_EXCEPTIONS' : 'PUBLISHED')}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                activeQcFilter === 'PUBLISHED'
                  ? 'bg-emerald-950 border-emerald-600 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-950/50'
                  : 'bg-slate-900/90 border-slate-800/80 hover:border-emerald-800/80'
              }`}
            >
              <div className="flex items-center justify-between text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <span>Healthy Published</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-2">
                {stats ? (stats.published ?? 0) : <span className="text-sm animate-pulse text-slate-500">...</span>}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Live di WooCommerce</div>
            </button>
          </div>

          {/* Actionable Exception List */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Daftar Pengecualian ({items.length} unit terpilih)
                </span>
                {activeQcFilter !== 'ALL_EXCEPTIONS' && (
                  <button
                    type="button"
                    onClick={() => setActiveQcFilter('ALL_EXCEPTIONS')}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  >
                    Tampilkan Semua Pengecualian
                  </button>
                )}
              </div>
              <div className="text-xs text-slate-400">
                Klik tindakan untuk menyelesaikan bottleneck dalam 1-klik
              </div>
            </div>

            <div className="divide-y divide-slate-800/60">
              {isLoadingQc ? (
                <div className="py-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                  Memeriksa antrian pipeline...
                </div>
              ) : items.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  Tidak ada pengecualian yang memerlukan tindakan pada kategori ini.
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.SKU}
                    className="p-4 hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative w-14 h-14 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
                        {item.FEATURED_IMAGE ? (
                          <Image
                            src={item.FEATURED_IMAGE}
                            alt={item.PRODUCT_TITLE}
                            fill
                            className="object-cover"
                            sizes="56px"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 font-mono">
                            NO PIC
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                            {item.SKU}
                          </span>
                          <PipelineBadge status={item.STATUS_PIPELINE} />
                          <span className="text-[11px] text-slate-400">{item.LOKASI_UNIT}</span>
                        </div>
                        <div className="font-semibold text-slate-200 text-sm mt-1">
                          {item.PRODUCT_TITLE}
                        </div>
                        {item.dirty_reasons && item.dirty_reasons.length > 0 && (
                          <div className="text-xs text-rose-400 mt-1 flex items-center gap-1.5 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{item.dirty_reasons.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Exception Resolution Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {canEdit ? (
                        <>
                          {item.STATUS_PIPELINE === 'ERROR' && (
                            <button
                              type="button"
                              onClick={() => handleResolvePipelineAction(item.SKU, 'READY_TO_PUBLISH')}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              <span>Autofix Metadata</span>
                            </button>
                          )}

                          {item.STATUS_PIPELINE === 'NO_PHOTOS_FOUND' && (
                            <button
                              type="button"
                              onClick={() => handleResolvePipelineAction(item.SKU, 'PENDING_PHOTOS')}
                              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Retry Scrape Telegram</span>
                            </button>
                          )}

                          {item.STATUS_PIPELINE === 'READY_TO_PUBLISH' && (
                            <button
                              type="button"
                              onClick={() => handleResolvePipelineAction(item.SKU, 'PUBLISHED')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                            >
                              <UploadCloud className="w-3.5 h-3.5" />
                              <span>Publish ke WooCommerce</span>
                            </button>
                          )}

                          {item.STATUS_PIPELINE === 'AMBIGUOUS' && (
                            <button
                              type="button"
                              onClick={() => handleResolvePipelineAction(item.SKU, 'READY_TO_PUBLISH')}
                              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                            >
                              Merge & Set Ready
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleResolvePipelineAction(item.SKU, 'SKIP: NO IMAGE')}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs"
                            title="Abaikan dan tandai Skip"
                          >
                            Skip
                          </button>
                        </>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-500 font-mono text-[11px]">
                          Mode Lihat
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALES SOLD REPORTS QUEUE */}
      {hubTab === 'SALES_SOLD_QUEUE' && (
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl space-y-4">
          <div className="p-4 sm:p-5 bg-slate-950/90 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-emerald-400" />
                <span>Antrean Laporan Unit Terjual dari Tim Sales (Sheet LAPORAN_TERJUAL)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Laporan real-time yang dikirim oleh tim sales melalui fitur ⚡ Sales & WA Pitch. Admin dapat memverifikasi & mengeksekusi status SOLD dalam 1-klik.
              </p>
            </div>

            <button
              type="button"
              onClick={loadSoldReports}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold hover:text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReports ? 'animate-spin' : ''}`} />
              <span>Refresh Laporan</span>
            </button>
          </div>

          <div className="p-4 sm:p-5 pt-0">
            {isLoadingReports ? (
              <div className="py-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                Memuat antrean laporan penjualan...
              </div>
            ) : soldReports.length === 0 ? (
              <div className="py-16 text-center text-slate-400 border border-dashed border-slate-800 rounded-2xl">
                <CheckCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-80" />
                <div className="font-bold text-slate-200">Semua Laporan Terjual Telah Bersih!</div>
                <p className="text-xs text-slate-500 mt-1">
                  Tidak ada antrean pending dari sheet <code>LAPORAN_TERJUAL</code>.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {soldReports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 bg-slate-950 border border-emerald-900/60 rounded-xl hover:border-emerald-700/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-amber-400 text-xs px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {report.sku}
                        </span>
                        {report.dealPrice ? (
                          <span className="font-mono font-bold text-emerald-400 text-xs px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800">
                            Deal: {formatIDR(report.dealPrice)}
                          </span>
                        ) : null}
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{report.reportedAt}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                          Oleh: {report.reportedBy || 'Sales Desk'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 font-medium">{report.notes}</p>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      {canEdit ? (
                        <>
                          <button
                            type="button"
                            disabled={executingSku === report.sku}
                            onClick={() => handleConfirmSoldReport(report)}
                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950 flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{executingSku === report.sku ? 'Memproses...' : 'Konfirmasi SOLD'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDismissSoldReport(report)}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-800 text-xs transition-colors flex items-center gap-1.5"
                            title="Hapus laporan ini tanpa mengubah status unit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Abaikan</span>
                          </button>
                        </>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-500 font-mono text-[11px]">
                          Mode Lihat
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: NON-SKU RESOLUTION QUEUE */}
      {hubTab === 'NON_SKU_RESOLVE_QUEUE' && (
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl space-y-4">
          <div className="p-4 sm:p-5 bg-slate-950/90 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Link2 className="w-4 h-4 text-indigo-400" />
                <span>Antrean Resolusi Transaksi Non-SKU & Pesanan Custom</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Item faktur khusus atau custom yang membutuhkan penetapan HPP Modal (biaya bengkel) atau penautan ke stok fisik gudang.
              </p>
            </div>

            <button
              type="button"
              onClick={loadNonSkuInvoices}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold hover:text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingNonSku ? 'animate-spin' : ''}`} />
              <span>Refresh Antrean</span>
            </button>
          </div>

          <div className="p-4 sm:p-5 pt-0">
            {isLoadingNonSku ? (
              <div className="py-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                Memeriksa antrean Non-SKU...
              </div>
            ) : nonSkuItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400 border border-dashed border-slate-800 rounded-2xl">
                <CheckCircle2 className="w-10 h-10 text-indigo-500 mx-auto mb-3 opacity-80" />
                <div className="font-bold text-slate-200">Semua Item Invoice Memiliki SKU / HPP Valid!</div>
                <p className="text-xs text-slate-500 mt-1">
                  Tidak ada transaksi non-SKU yang membutuhkan rekonsiliasi saat ini.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {nonSkuItems.map((it, idx) => (
                  <div
                    key={`${it.invoiceNumber}_${it.sku}_${idx}`}
                    className={`p-4 bg-slate-950 border rounded-xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      it.isResolved
                        ? 'border-slate-800 opacity-75'
                        : 'border-indigo-900/80 hover:border-indigo-600'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-amber-400 text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {it.sku}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Faktur #{it.invoiceNumber} • {it.customerName}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {it.issueDate}
                        </span>
                        {it.isResolved ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            Resolved (HPP: {formatIDR(it.unitCost)})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                            ⚠️ Perlu Resolusi
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-200 font-medium">
                        {it.productTitle} (Qty: {it.quantity} @ {formatIDR(it.unitPrice)})
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => {
                            setResolveItem({
                              invoiceId: it.invoiceId,
                              invoiceNumber: it.invoiceNumber,
                              customSku: it.sku,
                              productTitle: it.productTitle,
                              sellingPrice: it.unitPrice,
                              quantity: it.quantity,
                              currentModal: it.unitCost,
                              isNonSku: true,
                            });
                            setIsResolveModalOpen(true);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-950 flex items-center gap-1.5"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>{it.isResolved ? 'Edit Resolusi' : 'Resolve SKU / Modal'}</span>
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-500 font-mono text-[11px]">
                          Mode Lihat
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
            loadNonSkuInvoices();
          }}
        />
      )}
    </div>
  );
}
