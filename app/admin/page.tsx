'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { RoleSwitcher } from '@/components/admin/RoleSwitcher';
import { OverviewDashboard } from '@/components/admin/OverviewDashboard';
import { InventoryTable } from '@/components/admin/InventoryTable';
import { PipelineMonitor } from '@/components/admin/PipelineMonitor';
import { InvoiceManager } from '@/components/admin/InvoiceManager';
import { FinanceDashboard } from '@/components/admin/FinanceDashboard';
import { CashflowFinanceView } from '@/components/admin/CashflowFinanceView';
import { WarehouseIntelligence } from '@/components/admin/WarehouseIntelligence';
import { SEOQualityControl } from '@/components/admin/SEOQualityControl';
import { SocialMediaCenter } from '@/components/admin/SocialMediaCenter';
import { SalesHelperView } from '@/components/admin/SalesHelperView';
import { RoleManagement } from '@/components/admin/RoleManagement';
import {
  LayoutDashboard,
  Boxes,
  Workflow,
  Receipt,
  FileText,
  TrendingUp,
  Warehouse,
  SearchCheck,
  Share2,
  MessageSquare,
  Shield,
  ChefHat,
  ArrowUpRight,
  ExternalLink,
  Bell,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export type InvoiceSubTab = 'ALL' | 'QUOTATIONS' | 'ORDERS' | 'INVOICES' | 'DISPATCHES' | 'WARRANTIES';

type AdminTab =
  | 'OVERVIEW'
  | 'INVENTORY'
  | 'PIPELINE'
  | 'INVOICES'
  | 'FINANCE'
  | 'WAREHOUSES'
  | 'SEO'
  | 'SOCIAL'
  | 'SALES_HELPER'
  | 'ROLES';

export default function AdminPage() {
  const { user, role, permissions } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('OVERVIEW');
  const [invoiceSubTab, setInvoiceSubTab] = useState<InvoiceSubTab>('ALL');
  const [isInvoicesExpanded, setIsInvoicesExpanded] = useState<boolean>(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [liveStockCount, setLiveStockCount] = useState<number>(2797);
  const [readyStockCount, setReadyStockCount] = useState<number>(2229);
  const router = useRouter();

  useEffect(() => {
    if (activeTab === 'ROLES' && role !== 'ADMIN') {
      setActiveTab('OVERVIEW');
    }
  }, [activeTab, role]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bbk_sidebar_collapsed');
      if (saved !== null) {
        setIsSidebarCollapsed(saved === 'true');
      }
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('bbk_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    // Fetch live counts for synced header badge
    fetch('/api/inventory?pageSize=1')
      .then((r) => r.json())
      .then((d) => {
        if (d?.total) setLiveStockCount(d.total);
      })
      .catch(() => {});

    fetch('/api/inventory?pageSize=1&statusUnit=READY')
      .then((r) => r.json())
      .then((d) => {
        if (d?.total) setReadyStockCount(d.total);
      })
      .catch(() => {});
  }, []);

  if (!user) return null;

  const navItems: {
    id: AdminTab;
    label: string;
    icon: React.ReactNode;
    allowed: boolean;
  }[] = [
    {
      id: 'ROLES',
      label: 'Roles & Tim',
      icon: <Shield className="w-4 h-4 text-emerald-400" />,
      allowed: role === 'ADMIN',
    },
    {
      id: 'OVERVIEW',
      label: 'Executive Overview',
      icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
      allowed: role === 'ADMIN' || Boolean(permissions.canViewOverview) || Boolean(permissions.canViewFinanceReports),
    },
    {
      id: 'INVENTORY',
      label: 'Master Inventory',
      icon: <Boxes className="w-4 h-4 text-sky-400" />,
      allowed: role === 'ADMIN' || Boolean(permissions.canViewInventory) || Boolean(permissions.canEditInventory) || Boolean(permissions.canViewFloorPrice),
    },
    {
      id: 'SALES_HELPER',
      label: 'Sales & WA Pitch',
      icon: <MessageSquare className="w-4 h-4 text-emerald-400" />,
      allowed: role === 'ADMIN' || Boolean(permissions.canViewSalesPitch) || Boolean(permissions.canViewDealPrice),
    },
    {
      id: 'PIPELINE',
      label: 'Pipeline & QC Funnel',
      icon: <Workflow className="w-4 h-4 text-rose-400" />,
      allowed: role === 'ADMIN' || Boolean(permissions.canViewPipeline) || Boolean(permissions.canEditPipeline) || Boolean(permissions.canEditInventory),
    },
    {
      id: 'INVOICES',
      label: 'Invoices & Dokumen Resmi',
      icon: <FileText className="w-4 h-4 text-amber-400" />,
      allowed: role === 'ADMIN' || Boolean(permissions.canViewInvoices) || Boolean(permissions.canEditInvoices) || Boolean(permissions.canManageInvoices),
    },
    {
      id: 'FINANCE',
      label: 'Financials & Cashflow',
      icon: <Wallet className="w-4 h-4 text-emerald-400" />,
      allowed: role === 'ADMIN' || Boolean(permissions.canViewFinancials) || Boolean(permissions.canEditFinancials) || Boolean(permissions.canViewFinanceReports),
    },
    {
      id: 'WAREHOUSES',
      label: 'Warehouse Intelligence',
      icon: <Warehouse className="w-4 h-4 text-orange-400" />,
      allowed: role === 'ADMIN' || Boolean(permissions.canViewWarehouses) || Boolean(permissions.canEditWarehouses) || Boolean(permissions.canViewSupplierData),
    },
    {
      id: 'SEO',
      label: 'SEO Quality & Schema',
      icon: <SearchCheck className="w-4 h-4 text-purple-400" />,
      allowed: role === 'ADMIN' || Boolean(permissions.canViewSEO) || Boolean(permissions.canEditSEO),
    },
    {
      id: 'SOCIAL',
      label: 'Social Distribution',
      icon: <Share2 className="w-4 h-4 text-pink-400" />,
      allowed: role === 'ADMIN' || Boolean(permissions.canViewSocial) || Boolean(permissions.canEditSocial) || Boolean(permissions.canManageSocialMedia),
    },
  ];

  return (
    <div className="h-screen bg-[#0c0c0e] text-white flex flex-col font-sans overflow-hidden">
      {/* Top Bar for Role Switching & System Status */}
      <div className="shrink-0 bg-[#141417] border-b border-white/[0.08] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-white tracking-wider font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>BUKAN BARU KITCHEN • ENTERPRISE CONTROL TOWER</span>
          </div>
          <span className="text-white/20 hidden md:inline">|</span>
          <span className="text-white/60 hidden md:inline font-mono text-[11px]">
            Active Role: <strong className="text-[#3b82f6]">{role}</strong>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <RoleSwitcher />
          <Link
            href="/"
            className="text-white/60 hover:text-white flex items-center gap-1 font-mono text-xs transition-colors"
          >
            <span>Public Catalog</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Main App Container with Responsive Layout */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Mobile Dropdown Navigation (Visible ONLY on Mobile & Tablet) */}
        <div className="lg:hidden shrink-0 bg-[#141417] border-b border-white/[0.08] p-3.5 z-30 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#3b82f6] font-bold">
              PILIH MODUL DASHBOARD:
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded">
              Online
            </span>
          </div>

          <div className="relative">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as AdminTab)}
              className="w-full pl-3 pr-9 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none shadow-md"
            >
              {navItems.map((item) => {
                if (!item.allowed) return null;
                return (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                );
              })}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          {activeTab === 'INVOICES' && (
            <div className="pt-2 border-t border-white/[0.06]">
              <select
                value={invoiceSubTab}
                onChange={(e) => setInvoiceSubTab(e.target.value as InvoiceSubTab)}
                className="w-full px-3 py-2 bg-slate-900 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="ALL">📑 Semua Dokumen</option>
                <option value="QUOTATIONS">📄 Quotation (1x24j)</option>
                <option value="ORDERS">📋 Order (PO/SO)</option>
                <option value="INVOICES">🧾 Invoice Penjualan</option>
                <option value="DISPATCHES">🚚 Surat Jalan (E-POD)</option>
                <option value="WARRANTIES">🛡️ E-Warranty (14 Hari)</option>
              </select>
            </div>
          )}
        </div>

        {/* Executive Sidebar (Visible ONLY on Desktop when not collapsed) */}
        {!isSidebarCollapsed && (
          <aside className="hidden lg:flex w-72 bg-[#141417] border-r border-white/[0.08] flex-col justify-between shrink-0 p-6 h-full overflow-y-auto transition-all animate-in slide-in-from-left duration-200">
            <div className="space-y-6">
              {/* Brand Header with Collapse Button */}
              <div className="brand mb-6 flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">
                    BBKitchen
                  </h2>
                  <p className="font-mono text-[10px] text-white/60 tracking-widest mt-1.5 uppercase">
                    OS v2.4.0 • Enterprise Control Tower
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
                  title="Sembunyikan Menu Sidebar (Mode Layar Penuh)"
                >
                  <PanelLeftClose className="w-4 h-4 text-slate-400 hover:text-white" />
                </button>
              </div>

              {/* Navigation items */}
              <nav className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#3b82f6] mb-3 block font-semibold">
                  Navigation
                </span>
                {navItems.map((item) => {
                  if (!item.allowed) return null;
                  const isActive = activeTab === item.id;
                  const isInvoiceMenu = item.id === 'INVOICES';

                  return (
                    <div key={item.id} className="space-y-1">
                      <button
                        onClick={() => {
                          setActiveTab(item.id);
                          if (isInvoiceMenu) {
                            setIsInvoicesExpanded((prev) => !prev || activeTab !== 'INVOICES');
                          }
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-all rounded-lg ${
                          isActive
                            ? 'text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20'
                            : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <span className="shrink-0 flex items-center justify-center">
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </div>
                        {isInvoiceMenu && (
                          <span className="text-slate-400 shrink-0">
                            {isActive && isInvoicesExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </span>
                        )}
                      </button>

                      {/* Paper.id Accordion Nested Sub-Menu directly below Invoices & Dokumen Resmi */}
                      {isInvoiceMenu && isActive && isInvoicesExpanded && (
                        <div className="pl-4 pr-1 py-1 space-y-1 ml-3 border-l-2 border-amber-500/30 animate-in slide-in-from-top-1 duration-150">
                          {[
                            { id: 'ALL', label: '📑 Semua Dokumen' },
                            { id: 'QUOTATIONS', label: '📄 Quotation (1x24j)' },
                            { id: 'ORDERS', label: '📋 Order (PO/SO)' },
                            { id: 'INVOICES', label: '🧾 Invoice Penjualan' },
                            { id: 'DISPATCHES', label: '🚚 Surat Jalan (E-POD)' },
                            { id: 'WARRANTIES', label: '🛡️ E-Warranty (14 Hari)' },
                          ].map((sub) => {
                            const isSubActive = invoiceSubTab === sub.id;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInvoiceSubTab(sub.id as InvoiceSubTab);
                                  setActiveTab('INVOICES');
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] rounded-md transition-all text-left ${
                                  isSubActive
                                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                                    : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
                                }`}
                              >
                                <span className="truncate">{sub.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* User Profile Badge at Sidebar Bottom */}
            <div className="profile border-t border-white/[0.08] pt-5 mt-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-[#3b82f6] rounded-sm flex items-center justify-center font-bold text-white text-xs">
                {user?.name ? user.name[0] : 'S'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.name || 'Sarah'}
                </p>
                <p className="text-[10px] text-white/60 font-mono truncate">
                  {role === 'MARKETING' ? 'SEO & Social Lead' : role}
                </p>
              </div>
            </div>
          </aside>
        )}

        {/* Content Area */}
        <main className="flex-1 flex flex-col bg-[#0c0c0e] min-w-0 h-full overflow-hidden">
          {/* Header Bar */}
          <header className="h-20 bg-[#0c0c0e] border-b border-white/[0.08] flex items-center justify-between px-6 sm:px-10 shrink-0 z-20">
            <div className="flex items-center gap-3">
              {/* Sidebar Collapse / Expand Toggle Button */}
              <button
                type="button"
                onClick={toggleSidebar}
                className="hidden lg:inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all shadow-md group"
                title={isSidebarCollapsed ? "Buka Menu Sidebar" : "Sembunyikan Menu Sidebar (Mode Layar Penuh)"}
              >
                {isSidebarCollapsed ? (
                  <>
                    <PanelLeftOpen className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-bold text-emerald-300">Buka Menu</span>
                  </>
                ) : (
                  <>
                    <PanelLeftClose className="w-4 h-4 text-slate-400 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-medium text-slate-400 group-hover:text-slate-200">Fullscreen</span>
                  </>
                )}
              </button>

              <div>
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight uppercase">
                  {navItems.find((n) => n.id === activeTab)?.label}
                </h1>
                <p className="text-[10px] text-white/60 uppercase tracking-widest font-mono mt-0.5">
                  Real-time Multi-Warehouse Sync • Jabodetabek Hubs
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/40 border border-emerald-800/60 rounded-full text-[11px] font-mono text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                </span>
                <span className="font-bold tracking-wide">
                  {activeTab === 'SALES_HELPER'
                    ? `${readyStockCount.toLocaleString('id-ID')} Ready Stock Sync`
                    : `${liveStockCount.toLocaleString('id-ID')} Stock Sync`}
                </span>
              </div>
            </div>
          </header>

          {/* Body Content Scrollable Container */}
          <div className="flex-1 p-6 sm:p-10 space-y-6 overflow-y-auto min-h-0">
            {activeTab === 'ROLES' && <RoleManagement />}
            {activeTab === 'OVERVIEW' && <FinanceDashboard />}
            {activeTab === 'INVENTORY' && <InventoryTable />}
            {activeTab === 'PIPELINE' && <PipelineMonitor />}
            {activeTab === 'INVOICES' && (
              <InvoiceManager subTab={invoiceSubTab} onSubTabChange={setInvoiceSubTab} />
            )}
            {activeTab === 'FINANCE' && <CashflowFinanceView />}
            {activeTab === 'WAREHOUSES' && <WarehouseIntelligence />}
            {activeTab === 'SEO' && <SEOQualityControl />}
            {activeTab === 'SOCIAL' && <SocialMediaCenter />}
            {activeTab === 'SALES_HELPER' && <SalesHelperView />}
          </div>
        </main>
      </div>
    </div>
  );
}
