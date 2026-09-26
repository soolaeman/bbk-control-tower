'use client';

import React from 'react';
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
  BarChart3,
  FileSpreadsheet,
  Settings,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  iconColor?: string;
  requiredPermission?: 'canViewFinanceReports' | 'canEditSEO' | 'canManageSocialMedia' | 'canManageInvoices';
  badge?: string;
  badgeColor?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard, iconColor: 'text-emerald-400' },
  { name: 'Inventory', href: '/admin/inventory', icon: Boxes, badge: 'Live', iconColor: 'text-sky-400' },
  { name: 'Pipeline Monitor', href: '/admin/pipeline', icon: Workflow, badge: 'Exception', badgeColor: 'bg-rose-900 text-rose-200', iconColor: 'text-rose-400' },
  { name: 'Warehouse Intelligence', href: '/admin/warehouse', icon: Warehouse, iconColor: 'text-orange-400' },
  { name: 'Sales & Deal Desk', href: '/admin/sales', icon: MessageSquareShare, iconColor: 'text-emerald-400' },
  { name: 'Finance Hub', href: '/admin/finance', icon: Banknote, iconColor: 'text-emerald-400', requiredPermission: 'canViewFinanceReports' },
  { name: 'Invoices', href: '/admin/invoices', icon: FileText, iconColor: 'text-amber-400', requiredPermission: 'canManageInvoices' },
  { name: 'SEO Quality & Articles', href: '/admin/seo', icon: SearchCode, iconColor: 'text-purple-400' },
  { name: 'Social Media Center', href: '/admin/social', icon: Share2, iconColor: 'text-pink-400' },
  { name: 'Analytics & GSC', href: '/admin/analytics', icon: BarChart3, iconColor: 'text-blue-400' },
  { name: 'Executive Reports', href: '/admin/reports', icon: FileSpreadsheet, iconColor: 'text-teal-400' },
  { name: 'Settings & Integrations', href: '/admin/settings', icon: Settings, iconColor: 'text-slate-400' },
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
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
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

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Operational Modules
          </div>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            
            // Check if current role has access
            let isRestricted = false;
            if (role === 'INVESTOR' && (item.href === '/admin/pipeline' || item.href === '/admin/sales' || item.href === '/admin/invoices' || item.href === '/admin/settings')) {
              isRestricted = true;
            } else if (item.requiredPermission && !permissions[item.requiredPermission] && role !== 'ADMIN') {
              isRestricted = true;
            }

            if (isRestricted) {
              return null; // Clean navigation by role
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900/90'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : (item.iconColor || 'text-slate-400')}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      isActive
                        ? 'bg-slate-950 text-amber-400'
                        : item.badgeColor || 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Footer / Public Link */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
          <Link
            href="/"
            target="_blank"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
              <span>Public Website</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Live</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
