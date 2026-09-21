'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CustomerProfile } from '@/lib/repositories/turso-customers-repository';
import { formatIDR } from '@/lib/repositories/warehouse-utils';
import {
  Users,
  Search,
  Plus,
  Phone,
  Building2,
  MapPin,
  MessageCircle,
  Tag,
  Clock,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  FileText,
} from 'lucide-react';

interface CustomersCRMProps {
  onNavigateToInvoice?: (customerData: Partial<CustomerProfile>) => void;
  onNavigateToSalesPitch?: (customerData: Partial<CustomerProfile>) => void;
}

export function CustomersCRM({ onNavigateToInvoice, onNavigateToSalesPitch }: CustomersCRMProps) {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [segment, setSegment] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerProfile | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formAddressNotes, setFormAddressNotes] = useState('');
  const [formSegment, setFormSegment] = useState<CustomerProfile['segment']>('LEAD_BARU');
  const [formCategories, setFormCategories] = useState('');
  const [formBudget, setFormBudget] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '25',
      });
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (segment !== 'ALL') params.append('segment', segment);

      const res = await fetch(`/api/customers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, segment]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormCompany('');
    setFormAddress('');
    setFormAddressNotes('');
    setFormSegment('LEAD_BARU');
    setFormCategories('');
    setFormBudget('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cust: CustomerProfile) => {
    setEditingCustomer(cust);
    setFormName(cust.name);
    setFormPhone(cust.phone);
    setFormCompany(cust.company_name || '');
    setFormAddress(cust.address || '');
    setFormAddressNotes(cust.address_notes || '');
    setFormSegment(cust.segment);
    setFormCategories(cust.preferred_categories || '');
    setFormBudget(cust.budget_bracket || '');
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      alert('Nama dan nomor WhatsApp wajib diisi');
      return;
    }

    try {
      const payload: Partial<CustomerProfile> = {
        id: editingCustomer ? editingCustomer.id : undefined,
        name: formName.trim(),
        phone: formPhone.trim(),
        company_name: formCompany.trim() || null,
        address: formAddress.trim() || null,
        address_notes: formAddressNotes.trim() || null,
        segment: formSegment,
        preferred_categories: formCategories.trim() || null,
        budget_bracket: formBudget.trim() || null,
      };

      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setActionSuccessMsg(
          editingCustomer
            ? `✓ Profil ${formName} berhasil diperbarui.`
            : `✓ Pelanggan baru ${formName} berhasil ditambahkan.`
        );
        fetchCustomers();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Gagal menyimpan data pelanggan');
      }
    } catch (err) {
      console.error('Error saving customer:', err);
    }
  };

  const handleDeleteCustomer = async (cust: CustomerProfile) => {
    if (!confirm(`Hapus data pelanggan ${cust.name} (${cust.phone})?`)) return;
    try {
      const res = await fetch(`/api/customers?id=${cust.id}`, { method: 'DELETE' });
      if (res.ok) {
        setActionSuccessMsg(`✓ Pelanggan ${cust.name} berhasil dihapus.`);
        fetchCustomers();
        setTimeout(() => setActionSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Error deleting customer:', err);
    }
  };

  // Format clean phone for WhatsApp link
  const formatWaUrl = (rawPhone: string, customerName: string) => {
    let clean = rawPhone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    if (!clean.startsWith('62')) clean = '62' + clean;
    const msg = encodeURIComponent(`Halo Kak ${customerName}! 🙏 Salam dari Bukan Baru Kitchen (BBKitchen).`);
    return `https://wa.me/${clean}?text=${msg}`;
  };

  const getSegmentBadge = (seg: CustomerProfile['segment']) => {
    switch (seg) {
      case 'VIP':
        return { label: '👑 VIP Resto', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      case 'LANGGANAN_REPEAT':
        return { label: '🔁 Repeat Buyer', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'PEMBELI_AKTIF':
        return { label: '🛒 Pembeli Aktif', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
      case 'PENAWARAN_AKTIF':
        return { label: '📋 Penawaran Aktif', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
      default:
        return { label: '🌱 Lead Baru', bg: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <span>Buku Pelanggan & CRM Brokerage</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
              {total} Kontak Terdata
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Direktori profil pembeli, preferensi mesin resto, riwayat transaksi, dan retargeting penawaran unit baru.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pelanggan</span>
        </button>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-950/90 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama pembeli, nomor WhatsApp, nama resto/PT, atau alamat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Segment Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {['ALL', 'LEAD_BARU', 'PENAWARAN_AKTIF', 'PEMBELI_AKTIF', 'LANGGANAN_REPEAT', 'VIP'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSegment(s);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                  segment === s
                    ? 'bg-emerald-500 text-slate-950 shadow-sm font-black'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {s === 'ALL'
                  ? 'Semua'
                  : s === 'LEAD_BARU'
                  ? '🌱 Lead'
                  : s === 'PENAWARAN_AKTIF'
                  ? '📋 Penawaran'
                  : s === 'PEMBELI_AKTIF'
                  ? '🛒 Pembeli'
                  : s === 'LANGGANAN_REPEAT'
                  ? '🔁 Repeat'
                  : '👑 VIP'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Customers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-16 text-center text-slate-500 text-xs">
            Memuat direktori pelanggan...
          </div>
        ) : customers.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <div className="font-bold text-slate-200">Belum Ada Data Pelanggan</div>
            <p className="text-xs text-slate-500 mt-1">
              Tambahkan data kontak pembeli atau buat invoice untuk mengisi direktori secara otomatis.
            </p>
          </div>
        ) : (
          customers.map((cust) => {
            const badge = getSegmentBadge(cust.segment);
            const waUrl = formatWaUrl(cust.phone, cust.name);

            return (
              <div
                key={cust.id}
                className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 shadow-md group"
              >
                <div className="space-y-2.5">
                  {/* Name & Segment Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {cust.name}
                      </h3>
                      {cust.company_name && (
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{cust.company_name}</span>
                        </div>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Phone & 1-Click WA */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-mono text-slate-300 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>{cust.phone}</span>
                    </span>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 hover:bg-emerald-800 hover:text-white text-[11px] font-bold transition-colors"
                      title="Buka Chat WhatsApp"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>Chat WA</span>
                    </a>
                  </div>

                  {/* Address */}
                  {cust.address && (
                    <div className="text-[11px] text-slate-400 flex items-start gap-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="line-clamp-2">{cust.address}</p>
                        {cust.address_notes && (
                          <p className="text-[10px] text-amber-400/90 mt-1 font-mono">
                            Patokan: {cust.address_notes}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Preference / Unit Hunting Notes */}
                  {(cust.preferred_categories || cust.budget_bracket) && (
                    <div className="flex flex-wrap items-center gap-1 text-[10px]">
                      {cust.preferred_categories && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-sky-300 font-mono flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5" />
                          <span>{cust.preferred_categories}</span>
                        </span>
                      )}
                      {cust.budget_bracket && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 font-mono">
                          Budget: {cust.budget_bracket}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer KPIs & Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="font-mono text-[11px] text-slate-400">
                    <span className="text-white font-bold">{cust.total_orders} Order</span>
                    {cust.lifetime_spend > 0 && (
                      <span className="text-emerald-400 font-bold ml-1.5">
                        • {formatIDR(cust.lifetime_spend)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {onNavigateToInvoice && (
                      <button
                        type="button"
                        onClick={() => onNavigateToInvoice(cust)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                        title="Buat Dokumen Invoice / Penawaran"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(cust)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                      title="Edit Data Pelanggan"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomer(cust)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors"
                      title="Hapus Pelanggan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>{editingCustomer ? 'Edit Profil Pelanggan' : 'Tambah Pelanggan Baru'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3.5 overflow-y-auto text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Nama PIC / Pembeli *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pak Budi Santoso"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">No. WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="0812xxxxxxxx"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Nama Resto / Usaha / PT</label>
                  <input
                    type="text"
                    placeholder="Contoh: Kopi Kenangan / PT Boga"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Segmentasi Pelanggan</label>
                <select
                  value={formSegment}
                  onChange={(e) => setFormSegment(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                >
                  <option value="LEAD_BARU">🌱 Lead Baru (Tanya-tanya)</option>
                  <option value="PENAWARAN_AKTIF">📋 Penawaran Aktif (Menunggu DP)</option>
                  <option value="PEMBELI_AKTIF">🛒 Pembeli Aktif (Pernah Transaksi)</option>
                  <option value="LANGGANAN_REPEAT">🔁 Langganan Repeat (Sering Belanja)</option>
                  <option value="VIP">👑 VIP Resto / Korporat</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Alamat Dapur / Pengiriman</label>
                <textarea
                  rows={2}
                  placeholder="Alamat lengkap tujuan kirim unit komersial..."
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Patokan & Catatan Akses Truk</label>
                <input
                  type="text"
                  placeholder="Contoh: Depan Alfamart, jalan muat truk engkel, dapur di lantai 1"
                  value={formAddressNotes}
                  onChange={(e) => setFormAddressNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Kategori Mesin Incaran</label>
                  <input
                    type="text"
                    placeholder="Contoh: Chiller 2 Pintu, Combi Oven"
                    value={formCategories}
                    onChange={(e) => setFormCategories(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Kisaran Budget</label>
                  <input
                    type="text"
                    placeholder="Contoh: Rp 8jt - 15jt"
                    value={formBudget}
                    onChange={(e) => setFormBudget(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-md shadow-emerald-500/20"
                >
                  {editingCustomer ? 'Simpan Perubahan' : 'Tambah Pelanggan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
