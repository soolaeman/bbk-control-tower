'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { formatIDR } from '@/lib/repositories/warehouse-utils';
import {
  ShieldCheck,
  Truck,
  FileText,
  CreditCard,
  Copy,
  Check,
  MessageCircle,
  Phone,
  Clock,
  AlertTriangle,
  PenTool,
  CheckCircle2,
  Calendar,
  Building2,
  MapPin,
  RefreshCw,
} from 'lucide-react';

export default function CustomerDealPortalPage() {
  const params = useParams();
  const rawInvoiceNumber = params?.invoiceNumber ? String(params.invoiceNumber) : '';
  const invoiceNumber = decodeURIComponent(rawInvoiceNumber);

  const [dealData, setDealData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedBank, setCopiedBank] = useState(false);

  // E-POD Signature Canvas States
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);
  const [signatureSuccessMsg, setSignatureSuccessMsg] = useState('');

  const fetchDeal = async () => {
    if (!invoiceNumber) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/deal/${encodeURIComponent(invoiceNumber)}`);
      if (res.ok) {
        const data = await res.json();
        setDealData(data.deal);
        if (data.deal?.dispatch?.recipientName) {
          setRecipientName(data.deal.dispatch.recipientName);
        }
      } else {
        const errJson = await res.json();
        setError(errJson.error || 'Invoice tidak ditemukan');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat rincian transaksi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceNumber]);

  // Copy Bank Account handler
  const handleCopyAccount = () => {
    navigator.clipboard.writeText('507980684419');
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 3000);
  };

  // Canvas drawing handlers (touch & mouse)
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0284c7';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSubmitSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) {
      alert('Mohon bubuhkan tanda tangan di layar.');
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    setIsSubmittingSignature(true);

    try {
      const res = await fetch(`/api/deal/${encodeURIComponent(invoiceNumber)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: recipientName.trim() || 'Penerima Dapur',
          signatureSvg: dataUrl,
        }),
      });

      if (res.ok) {
        setSignatureSuccessMsg('✓ Serah terima digital sukses dikonfirmasi! Kartu Garansi 14 Hari kini aktif.');
        await fetchDeal();
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Gagal mengirim konfirmasi serah terima');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan jaringan');
    } finally {
      setIsSubmittingSignature(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
        <p className="text-xs text-slate-400 font-mono">Memuat Portal Transaksi Pelanggan...</p>
      </div>
    );
  }

  if (error || !dealData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-lg font-bold">Dokumen Tidak Ditemukan</h2>
        <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
          Nomor rujukan transaksi <strong>{invoiceNumber}</strong> tidak terdaftar dalam sistem Bukan Baru Kitchen.
        </p>
        <a
          href="https://bukanbarukitchen.com"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl"
        >
          Kunjungi Katalog Publik
        </a>
      </div>
    );
  }

  const { invoice, dispatch, warranty } = dealData;
  const isPaid = invoice.status === 'PAID';
  const isDpPaid = invoice.status === 'DP_PAID';
  const isDelivered = Boolean(dispatch?.deliveredAt || dispatch?.recipientSignatureSvg);
  const isWarrantyActive = Boolean(warranty && warranty.status === 'ACTIVE');

  // Days left for warranty
  const nowMs = Date.now();
  const expireMs = warranty?.warrantyExpiresAt ? new Date(warranty.warrantyExpiresAt).getTime() : 0;
  const daysLeft = Math.max(0, Math.ceil((expireMs - nowMs) / (1000 * 60 * 60 * 24)));

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white font-sans antialiased pb-20">
      {/* Top Brand Banner */}
      <div className="bg-slate-950/80 border-b border-slate-800/80 px-4 py-3 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center font-black text-slate-950 text-sm shadow-md">
              BK
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wider font-mono">
                BUKAN BARU KITCHEN
              </div>
              <div className="text-[10px] text-slate-400">Single Customer Portal</div>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
            {invoice.invoiceNumber}
          </span>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* 4-Phase Progress Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
            Status Perjalanan Transaksi:
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold">
            <div
              className={`p-2 rounded-xl border flex flex-col items-center gap-1 ${
                isPaid || isDpPaid
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-500 text-amber-300 animate-pulse'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>1. Tagihan</span>
            </div>

            <div
              className={`p-2 rounded-xl border flex flex-col items-center gap-1 ${
                isPaid
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>2. Logistik</span>
            </div>

            <div
              className={`p-2 rounded-xl border flex flex-col items-center gap-1 ${
                isDelivered
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                  : isPaid
                  ? 'bg-amber-950/40 border-amber-500 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>3. Serah Terima</span>
            </div>

            <div
              className={`p-2 rounded-xl border flex flex-col items-center gap-1 ${
                isWarrantyActive
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>4. Garansi 14h</span>
            </div>
          </div>
        </div>

        {signatureSuccessMsg && (
          <div className="p-4 bg-emerald-950/90 border border-emerald-500 rounded-2xl text-emerald-300 text-xs flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{signatureSuccessMsg}</span>
          </div>
        )}

        {/* STAGE 4: ACTIVE 14-DAY E-WARRANTY (TRANSFORMED) */}
        {isWarrantyActive && (
          <div className="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border-2 border-emerald-500 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-400 animate-pulse" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-300">KARTU GARANSI ELEKTRONIK RESMI</h3>
                  <p className="text-[10px] text-slate-400">Jaminan Service & Sparepart BBKitchen</p>
                </div>
              </div>
              <div className="px-3 py-1 bg-emerald-500 text-slate-950 font-black text-xs rounded-xl shadow">
                {daysLeft > 0 ? `${daysLeft} Hari Aktif` : 'Masa Garansi Berakhir'}
              </div>
            </div>

            <div className="p-3.5 bg-amber-950/40 border border-amber-500/60 rounded-xl text-amber-200 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>PERHATIAN WAJIB SAAT MESIN TIBA:</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Untuk unit pendingin (*Chiller, Freezer, Showcase*), <strong>WAJIB DIDIAMKAN 3-4 JAM</strong> sebelum stop kontak dicolokkan ke listrik. Hal ini memastikan oli kompresor stabil pasca perjalanan armada truk.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <a
                href="https://wa.me/6285122001051?text=Halo%20Service%20Care%20BBKitchen,%20saya%20ingin%20klaim/konsultasi%20garansi%20unit%20nomor%20"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Hubungi Hotline Service Care (0851 2200 1051)</span>
              </a>
            </div>
          </div>
        )}

        {/* STAGE 3: DIGITAL SIGNATURE (E-POD SIGN-ON-GLASS) */}
        {!isDelivered && isPaid && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-2">
              <PenTool className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Tanda Terima Serah-Terima Digital (E-POD)</h3>
                <p className="text-xs text-slate-400">Bubuhkan tanda tangan di layar saat supir tiba di lokasi dapur.</p>
              </div>
            </div>

            <form onSubmit={handleSubmitSignature} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Nama Penerima di Lokasi Dapur *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama penerima / head chef..."
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                  <span>Tanda Tangan di Layar HP (Sign-on-Glass) *</span>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-[10px] text-slate-400 hover:text-rose-400"
                  >
                    Hapus Ulang
                  </button>
                </div>
                <div className="border border-slate-700 rounded-xl bg-white overflow-hidden shadow-inner touch-none">
                  <canvas
                    ref={canvasRef}
                    width={480}
                    height={180}
                    className="w-full h-[140px] cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingSignature || !hasSignature}
                className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmittingSignature ? 'Menyimpan Tanda Tangan...' : 'Konfirmasi Penerimaan Unit Fisik'}</span>
              </button>
            </form>
          </div>
        )}

        {/* STAGE 2: LOGISTICS & DISPATCH INFO (CASH BEFORE DISPATCH) */}
        {(isPaid || isDpPaid) && dispatch && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Manifest Pengiriman Armada</h3>
                  <p className="text-[10px] text-slate-400">Prinsip Cash Before Dispatch (CBD) Terverifikasi</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-950 text-orange-300 border border-orange-800 font-mono">
                {dispatch.sjNumber}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Supir Armada</span>
                <div className="font-bold text-slate-200">{dispatch.driverName || 'Armada Logistik BBKitchen'}</div>
                {dispatch.driverPhone && (
                  <a
                    href={`https://wa.me/${dispatch.driverPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline pt-0.5"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{dispatch.driverPhone}</span>
                  </a>
                )}
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Plat Nomor Kendaraan</span>
                <div className="font-mono font-black text-amber-300 text-sm">
                  {dispatch.vehiclePlateReal || 'B •••• •••'}
                </div>
                <div className="text-[10px] text-slate-400">Armada Resmi Terdaftar</div>
              </div>
            </div>

            {/* Destination */}
            {invoice.customerAddress && (
              <div className="text-xs text-slate-300 flex items-start gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-400 text-[10px] block">Tujuan Pengiriman:</span>
                  <span>{invoice.customerAddress}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STAGE 1: INVOICE & BANK JAGO TRANSFER INSTRUCTIONS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">
                Faktur Pembelian Unit
              </span>
              <h2 className="text-base font-bold text-white">{invoice.customerName}</h2>
              {invoice.customerCompany && (
                <div className="text-xs text-slate-400">{invoice.customerCompany}</div>
              )}
            </div>
            <div className="text-right">
              <span className="text-xs font-mono text-slate-400 block">Total Tagihan</span>
              <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
                {formatIDR(invoice.totalAmount)}
              </span>
            </div>
          </div>

          {/* Unit items list */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Daftar Mesin / Peralatan Dapur:
            </span>
            <div className="divide-y divide-slate-800/80">
              {invoice.items.map((it: any, idx: number) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-200">{it.description}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      SKU: {it.sku} • {it.quantity} Unit • Kondisi: {it.condition}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-slate-200 shrink-0">
                    {formatIDR(it.total)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bank Jago Official Transfer Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-amber-500/40 space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span className="text-xs font-bold text-amber-300">Rekening Resmi Pembayaran BBKitchen</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Bank Jago Syariah</span>
            </div>

            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Nomor Rekening</div>
                <div className="font-mono text-base font-black text-white tracking-widest">
                  5079 8068 4419
                </div>
                <div className="text-[11px] text-slate-400">A.n. Ahmad Sulaeman</div>
              </div>

              <button
                type="button"
                onClick={handleCopyAccount}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow"
              >
                {copiedBank ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBank ? 'Tersalin!' : 'Salin Rekening'}</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-400">
              * Pastikan transfer ditujukan ke rekening resmi atas nama <strong>Ahmad Sulaeman</strong>.
            </p>
          </div>

          {/* Confirmation via WA */}
          <a
            href={`https://wa.me/6285122001051?text=${encodeURIComponent(
              `Halo Admin BBKitchen, saya ingin konfirmasi bukti transfer untuk invoice ${invoice.invoiceNumber} atas nama ${invoice.customerName}.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Kirim Bukti Transfer via WhatsApp</span>
          </a>
        </div>
      </main>
    </div>
  );
}
