'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
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
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';

interface NavGroup {
  pillar: string;
  items: {
    name: string;
    href: string;
    icon: React.ElementType;
    iconColor: string;
    badge?: string;
    badgeColor?: string;
    requiredPermission?: string;
  }[];
}

const PILLAR_NAV_GROUPS: NavGroup[] = [
  {
    pillar: 'PILAR 1: GUDANG & INVENTORI',
    items: [
      { name: 'Master Inventory', href: '/admin/inventory', icon: Boxes, iconColor: 'text-sky-400', badge: 'Live' },
      { name: 'Pipeline & Review', href: '/admin/pipeline', icon: Workflow, iconColor: 'text-rose-400', badge: 'Sensors' },
      { name: 'Warehouse Intelligence', href: '/admin/warehouse', icon: Warehouse, iconColor: 'text-amber-400' },
    ],
  },
  {
    pillar: 'PILAR 2: SALES, CRM & TRANSAKSI',
    items: [
      { name: 'Sales & WA Pitch', href: '/admin/sales', icon: MessageSquareShare, iconColor: 'text-emerald-400' },
      { name: 'Buku Pelanggan CRM', href: '/admin/customers', icon: Users, iconColor: 'text-indigo-400' },
      { name: 'Invoices & Dokumen', href: '/admin/invoices', icon: Receipt, iconColor: 'text-amber-400' },
    ],
  },
  {
    pillar: 'PILAR 3: GROWTH, MARKETING & SEO',
    items: [
      { name: 'Content Drafter (AI)', href: '/admin/content', icon: Sparkles, iconColor: 'text-purple-400', badge: 'Auto' },
      { name: 'SEO & GSC Health', href: '/admin/seo', icon: SearchCode, iconColor: 'text-blue-400' },
      { name: 'Social Media Center', href: '/admin/social', icon: Share2, iconColor: 'text-pink-400' },
    ],
  },
  {
    pillar: 'PILAR 4: OWNER & EXECUTIVE DESK',
    items: [
      { name: 'Executive Overview', href: '/admin', icon: LayoutDashboard, iconColor: 'text-emerald-400' },
      { name: 'Bank Jago Cashflow', href: '/admin/finance', icon: Banknote, iconColor: 'text-emerald-400' },
      { name: 'Roles & Manajemen Tim', href: '/admin/roles', icon: ShieldCheck, iconColor: 'text-teal-400' },
      { name: 'Settings & API Keys', href: '/admin/settings', icon: Settings, iconColor: 'text-slate-400' },
    ],
  },
];

export function AdminSidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { role, permissions } = useAuth();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-950">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center font-black text-slate-950 text-sm shadow-md shadow-amber-500/20">
              BBK
            </div>
            <div>
              <div className="text-xs font-bold tracking-wider text-slate-100 uppercase">
                Control Tower
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                Bukan Baru Kitchen
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation List - 4 Pillars */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-4 custom-scrollbar">
          {PILLAR_NAV_GROUPS.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              <div className="px-3 pb-1 text-[9px] font-bold text-slate-500 tracking-wider uppercase">
                {group.pillar}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.href === '/admin' 
                  ? pathname === '/admin' 
                  : pathname === item.href || pathname.startsWith(item.href + '/');

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${item.iconColor}`} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          item.badgeColor || 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Info / Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[10px]">SQLite SSOT Live</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">v2.20</span>
        </div>
      </aside>
    </>
  );
}
