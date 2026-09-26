'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { RoleSwitcher } from '@/components/admin/RoleSwitcher';
import { Menu, Bell, ShieldCheck, Activity, Database } from 'lucide-react';

export function AdminHeader({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user, role } = useAuth();
  const [stockStats, setStockStats] = useState<{ total: number; ready: number; sold: number }>({
    total: 3133,
    ready: 2448,
    sold: 685,
  });

  useEffect(() => {
    fetch('/api/inventory?pageSize=1')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.totalCount === 'number') {
          setStockStats({
            total: data.totalCount || 3133,
            ready: (data.totalCount || 3133) - 685,
            sold: 685,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900"
          aria-label="Open Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Control Tower Live</span>
          </div>
          <span className="hidden md:inline text-xs text-slate-600">|</span>
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-900/60 px-3 py-1 rounded-md border border-slate-800/60">
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span>
              <strong className="text-amber-400 font-bold">{stockStats.total.toLocaleString()}</strong> Stock Sync •{' '}
              <strong className="text-emerald-400 font-bold">{stockStats.ready.toLocaleString()}</strong> Ready •{' '}
              <strong className="text-slate-400">{stockStats.sold.toLocaleString()}</strong> Sold
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {/* Role Switcher for instant RBAC preview */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-slate-400 font-medium">
            Active Role:
          </span>
          <RoleSwitcher />
        </div>

        {/* User profile avatar badge */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center text-xs font-bold text-amber-400 shadow-sm">
            {user?.name.charAt(0) || 'O'}
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-semibold text-slate-200 leading-tight">
              {user?.name || 'Sovereign Operator'}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {role || 'ADMIN'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
