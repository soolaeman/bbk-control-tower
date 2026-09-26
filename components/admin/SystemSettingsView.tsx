'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import {
  Settings,
  Save,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Globe,
  Sliders,
  Sparkles,
  Phone,
} from 'lucide-react';

export function SystemSettingsView() {
  const { role } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({
    meta_pixel_id: '',
    ga4_measurement_id: '',
    deepseek_api_key: '',
    whatsapp_sales_number: '',
    company_name: '',
    holding_fee_max: '1000000',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setSettings(data.settings);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        setSaveSuccessMsg('Konfigurasi berhasil disimpan ke SQLite SSOT.');
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Settings className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-100">
              Settings & API Integrations
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Konfigurasi Meta Pixel, Google Analytics 4, DeepSeek API Key, dan Aturan Komersial BBKitchen
          </p>
        </div>

        <button
          onClick={loadSettings}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {saveSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Tracking & Attribution */}
        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-400" />
            <span>Tracking, Analytics & Ad Attribution</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Meta Pixel ID (Facebook Ads)
              </label>
              <input
                type="text"
                value={settings.meta_pixel_id || ''}
                onChange={(e) => setSettings({ ...settings, meta_pixel_id: e.target.value })}
                placeholder="1692161474757353"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Digunakan untuk pelacakan event PageView, Contact, dan Lead WA.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Google Analytics 4 Measurement ID
              </label>
              <input
                type="text"
                value={settings.ga4_measurement_id || ''}
                onChange={(e) => setSettings({ ...settings, ga4_measurement_id: e.target.value })}
                placeholder="G-7NKG2N67L2"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Digunakan untuk pelacakan traffic organik GSC & konversi WA.
              </span>
            </div>
          </div>
        </div>

        {/* AI & Automation */}
        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>AI Engines & Automation</span>
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              DeepSeek API Key
            </label>
            <input
              type="password"
              value={settings.deepseek_api_key || ''}
              onChange={(e) => setSettings({ ...settings, deepseek_api_key: e.target.value })}
              placeholder="sk-deepseek-..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Menjalankan mesin normalisasi deterministik dan autonomous content drafter.
            </span>
          </div>
        </div>

        {/* Commercial & Contact Rules */}
        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-400" />
            <span>Commercial & Contact Parameters</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                WhatsApp Business Sales Number (62...)
              </label>
              <input
                type="text"
                value={settings.whatsapp_sales_number || ''}
                onChange={(e) => setSettings({ ...settings, whatsapp_sales_number: e.target.value })}
                placeholder="6281234567890"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Maksimum Ta&apos;widh DP / Holding Fee (Rp)
              </label>
              <input
                type="text"
                value={settings.holding_fee_max || '1000000'}
                onChange={(e) => setSettings({ ...settings, holding_fee_max: e.target.value })}
                placeholder="1000000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Sesuai prinsip syariah: batas kompensasi biaya simpan & tes fungsi bila pembeli batal sepihak.
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-md shadow-amber-500/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
