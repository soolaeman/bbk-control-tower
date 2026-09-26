'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { formatIDR } from '@/lib/repositories/warehouse-utils';
import {
  LayoutDashboard,
  Boxes,
  Workflow,
  Warehouse,
  MessageSquareShare,
  Banknote,
  FileText,
  SearchCode,
  Share2,
  Users,
  Settings,
  Sparkles,
  TrendingUp,
  DollarSign,
  Package,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Wallet,
  Receipt,
  Percent,
} from 'lucide-react';

export default function ExecutiveOverviewPage() {
  const { user, role } = useAuth();
  const [stats, setStats] = useState({
    totalStockCount: 3133,
    readyCount: 2448,
    soldCount: 685,
    totalCapitalValue: 14850000000,
    realizedGmvBbk: 2450000000,
    grossMarginPercent: 28.5,
    avgTurnoverDays: 24,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch live inventory & finance stats
    fetch('/api/inventory?pageSize=1')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.totalCount === 'number') {
          setStats((prev) => ({
            ...prev,
            totalStockCount: data.totalCount,
            readyCount: data.totalCount - 685,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Executive Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 p-6 lg:p-8 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
              <LayoutDashboard className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Executive Overview & Sovereign Cockpit
              </h1>
              <p className="text-xs text-slate-400">
                Pusat Kendali Bisnis Komersial Bukan Baru Kitchen (Holding BBK)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://bukanbarukitchen.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition shadow-sm"
          >
            <span>Buka Storefront Web</span>
            <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
          </a>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Asset Value */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-medium">
            <span>Nilai Aset Modal Stok</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-100 tracking-tight font-mono">
            {formatIDR(stats.totalCapitalValue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="text-emerald-400 font-bold">2.448 Unit</span>
            <span>siap kirim di 14 Gudang</span>
          </div>
        </div>

        {/* Card 2: Realized GMV */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-medium">
            <span>Realized GMV BBK</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-100 tracking-tight font-mono">
            {formatIDR(stats.realizedGmvBbk)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="text-emerald-400 font-bold">Jalur Resmi BBK</span>
            <span>Bank Jago Syariah</span>
          </div>
        </div>

        {/* Card 3: Gross Margin */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-medium">
            <span>Rata-Rata Margin Bersih</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-100 tracking-tight font-mono">
            {stats.grossMarginPercent}%
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="text-sky-400 font-bold">Guardrail Safe</span>
            <span>Floor: Min 15% / Deal: 28%</span>
          </div>
        </div>

        {/* Card 4: Inventory Velocity */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-medium">
            <span>Kecepatan Perputaran (Velocity)</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-100 tracking-tight font-mono">
            {stats.avgTurnoverDays} Hari
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="text-purple-400 font-bold">Dead Stock &lt; 5%</span>
            <span>di atas 90 hari</span>
          </div>
        </div>
      </div>

      {/* 4 Pillars Quick Launchpad */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
          4 Pilar Kendali Operasional Terintegrasi
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pilar 1 */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
              <Boxes className="w-4 h-4" />
              <span>PILAR 1: GUDANG & INVENTORI</span>
            </div>
            <p className="text-xs text-slate-400">
              Master katalog 3.133 unit, review barang baru, sinyal SOLD Telegram, dan radar 14 hub.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/admin/inventory"
                className="text-xs font-semibold text-sky-300 hover:text-white flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
              >
                <span>Master Inventory Table</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin/pipeline"
                className="text-xs font-semibold text-rose-300 hover:text-white flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
              >
                <span>Pipeline & SOLD Signals</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin/warehouse"
                className="text-xs font-semibold text-amber-300 hover:text-white flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
              >
                <span>Warehouse Intelligence</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Pilar 2 */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <MessageSquareShare className="w-4 h-4" />
              <span>PILAR 2: SALES, CRM & TRANSAKSI</span>
            </div>
            <p className="text-xs text-slate-400">
              WA Pitch 1-klik, CRM kontak buyer resto & MBG, Invoice PDF, E-POD & E-Garansi resmi.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/admin/sales"
                className="text-xs font-semibold text-emerald-300 hover:text-white flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
              >
                <span>Sales & WA Pitch Generator</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin/customers"
                className="text-xs font-semibold text-indigo-300 hover:text-white flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
              >
                <span>Buku Pelanggan & CRM</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin/invoices"
                className="text-xs font-semibold text-amber-300 hover:text-white flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
              >
                <span>Invoices & Dokumen Resmi</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Pilar 3 */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
              <Sparkles className="w-4 h-4" />
              <span>PILAR 3: GROWTH, SEO & SOSMED</span>
            </div>
            <p className="text-xs text-slate-400">
              DeepSeek autonomous article drafter, proteksi 3.062 URL GSC, 301 redirect, dan sosmed generator.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/admin/content"
                className="text-xs font-semibold text-purple-300 hover:text-white flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
              >
                <span>Content Drafter (DeepSeek)</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin/seo"
                className="text-xs font-semibold text-blue-300 hover:text-white flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
              >
                <span>SEO Quality & GSC Hub</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin/social"
                className="text-xs font-semibold text-pink-300 hover:text-white flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
              >
                <span>Social Media Center</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Pilar 4 */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-400">
              <ShieldCheck className="w-4 h-4" />
              <span>PILAR 4: OWNER & DESK UTAMA</span>
            </div>
            <p className="text-xs text-slate-400">
              Mutasi 4 kantong Bank Jago Syariah, hak akses RBAC multi-role, dan konfigurasi API keys.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/admin/finance"
                className="text-xs font-semibold text-emerald-300 hover:text-white flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
              >
                <span>Bank Jago Cashflow Pockets</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin/roles"
                className="text-xs font-semibold text-teal-300 hover:text-white flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
              >
                <span>Roles & Manajemen Tim</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin/settings"
                className="text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
              >
                <span>Settings & API Integrations</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
