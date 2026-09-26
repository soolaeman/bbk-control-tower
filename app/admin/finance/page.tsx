'use client';

import React, { useState } from 'react';
import { FinanceDashboard } from '@/components/admin/FinanceDashboard';
import { CashflowFinanceView } from '@/components/admin/CashflowFinanceView';
import { Banknote, Wallet, BarChart3 } from 'lucide-react';

export default function FinancePage() {
  const [subTab, setSubTab] = useState<'OVERVIEW' | 'CASHFLOW'>('CASHFLOW');

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('CASHFLOW')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              subTab === 'CASHFLOW'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Bank Jago Syariah Cashflow Pockets</span>
          </button>

          <button
            onClick={() => setSubTab('OVERVIEW')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              subTab === 'OVERVIEW'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Revenue & Profit Analytics</span>
          </button>
        </div>
      </div>

      {subTab === 'CASHFLOW' ? <CashflowFinanceView /> : <FinanceDashboard />}
    </div>
  );
}
