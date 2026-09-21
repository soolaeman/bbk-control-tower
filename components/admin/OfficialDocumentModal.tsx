'use client';

import React, { useState } from 'react';
import { Invoice, DocumentType } from '@/lib/types/finance';
import { formatIDR, parseToISODate } from '@/lib/repositories/warehouse-utils';
import {
  Printer,
  FileText,
  Receipt,
  FileCheck,
  Truck,
  Copy,
  Check,
  X,
  Send,
  Building2,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  QrCode,
  Lock,
} from 'lucide-react';

interface OfficialDocumentModalProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
  initialType?: DocumentType;
}

export function OfficialDocumentModal({
  invoice,
  isOpen,
  onClose,
  initialType = 'INVOICE',
}: OfficialDocumentModalProps) {
  const [activeType, setActiveType] = useState<DocumentType>(
    initialType === 'DELIVERY_NOTE'
      ? 'DELIVERY_NOTE'
      : initialType === 'WARRANTY'
      ? 'WARRANTY'
      : initialType === 'CANCELLATION_NOTE'
      ? 'CANCELLATION_NOTE'
      : (initialType || 'INVOICE')
  );
  const [copied, setCopied] = useState(false);

  // Editable fields for Surat Jalan / Driver
  const [driverName, setDriverName] = useState(invoice.deliveryDriver || '');
  const [driverPhone, setDriverPhone] = useState(invoice.driverPhone || '');
  const [plateNumber, setPlateNumber] = useState(invoice.deliveryVehiclePlate || '');
  const [expedition, setExpedition] = useState(invoice.deliveryExpedition || '');

  if (!isOpen) return null;

  const now = new Date();
  const todayFormatted = now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const rawIssue = parseToISODate(invoice.issueDate) || invoice.issueDate;
  const issueDateObj = rawIssue ? new Date(rawIssue) : now;
  const formattedIssueDate = !isNaN(issueDateObj.getTime())
    ? issueDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : todayFormatted;

  const rawDue = parseToISODate(invoice.dueDate);
  const dueDateObj = rawDue ? new Date(rawDue) : null;
  const formattedDueDate =
    dueDateObj && !isNaN(dueDateObj.getTime())
      ? dueDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '3 Hari Kerja';

  // Calculate numbers
  const subtotal = invoice.subtotal || invoice.totalAmount;
  const discount = invoice.discount || 0;
  const total = invoice.totalAmount;

  // Multi-Payment installments calculation
  const paymentsList =
    invoice.payments && invoice.payments.length > 0
      ? invoice.payments
      : invoice.dpAmount && invoice.dpAmount > 0
      ? [
          {
            id: 'pay_1',
            label: 'Pembayaran 1 (DP)',
            amount: invoice.dpAmount,
            date: invoice.issueDate || todayFormatted,
            method: invoice.paymentMethod || 'TRANSFER_JAGO_SYARIAH',
          },
        ]
      : [];

  const totalPaid = paymentsList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const sisa = Math.max(0, total - totalPaid);
  const isFullyPaid = invoice.status === 'PAID' || (total > 0 && totalPaid >= total);
  const isVoid = invoice.status === 'VOID';

  // Gate 7: Ihsan & Ta'widh Calculation
  const calculatedHoldingFee =
    invoice.holdingFeeAmount != null
      ? invoice.holdingFeeAmount
      : Math.min(Math.round((invoice.totalAmount || 0) * 0.1), 1000000);
  const calculatedRefund =
    invoice.refundAmount != null
      ? invoice.refundAmount
      : Math.max(0, (invoice.dpAmount || totalPaid) - calculatedHoldingFee);

  // Gate 2: Warranty Classifier (Pendingin/Kompor vs Meja/Rak/Sink)
  const isWarrantyEligible = (desc: string) => {
    const lower = (desc || '').toLowerCase();
    return (
      lower.includes('chiller') ||
      lower.includes('freezer') ||
      lower.includes('showcase') ||
      lower.includes('kulkas') ||
      lower.includes('kompor') ||
      lower.includes('burner') ||
      lower.includes('fryer') ||
      lower.includes('oven') ||
      lower.includes('steamer') ||
      lower.includes('ice maker') ||
      lower.includes('blender') ||
      lower.includes('mixer') ||
      lower.includes('slicer') ||
      lower.includes('mesin')
    );
  };

  const eligibleItems = invoice.items.filter((it) => isWarrantyEligible(it.description));
  const nonEligibleItems = invoice.items.filter((it) => !isWarrantyEligible(it.description));

  // Numbers generator
  const docNumber = (() => {
    switch (activeType) {
      case 'QUOTATION':
        return (
          invoice.quotationNumber ||
          `QUO-BBK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${
            invoice.id.replace(/\D/g, '').slice(-4) || '1024'
          }`
        );
      case 'DELIVERY_NOTE':
        return (
          invoice.suratJalanNumber ||
          `SJ-BBK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${
            invoice.id.replace(/\D/g, '').slice(-4) || '1024'
          }`
        );
      case 'WARRANTY':
        return `GAR-${now.getFullYear()}-${invoice.id.replace(/\D/g, '').slice(-5) || '20261'}`;
      case 'CANCELLATION_NOTE':
        return `CN-BBK-${now.getFullYear()}-${invoice.id.replace(/\D/g, '').slice(-4) || '0001'}`;
      case 'INVOICE':
      default:
        return invoice.invoiceNumber;
    }
  })();

  const printDocument = () => {
    window.print();
  };

  // Terbilang Rupiah Helper
  const terbilangRupiah = (nominal: number): string => {
    const angka = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
    if (nominal < 12) return angka[nominal];
    if (nominal < 20) return terbilangRupiah(nominal - 10) + ' Belas';
    if (nominal < 100) return terbilangRupiah(Math.floor(nominal / 10)) + ' Puluh ' + terbilangRupiah(nominal % 10);
    if (nominal < 200) return 'Seratus ' + terbilangRupiah(nominal - 100);
    if (nominal < 1000) return terbilangRupiah(Math.floor(nominal / 100)) + ' Ratus ' + terbilangRupiah(nominal % 100);
    if (nominal < 2000) return 'Seribu ' + terbilangRupiah(nominal - 1000);
    if (nominal < 1000000) return terbilangRupiah(Math.floor(nominal / 1000)) + ' Ribu ' + terbilangRupiah(nominal % 1000);
    if (nominal < 1000000000) return terbilangRupiah(Math.floor(nominal / 1000000)) + ' Juta ' + terbilangRupiah(nominal % 1000000);
    return terbilangRupiah(Math.floor(nominal / 1000000000)) + ' Miliar ' + terbilangRupiah(nominal % 1000000000);
  };

  // Generate WA share summary
  const generateWhatsAppShare = () => {
    if (activeType === 'WARRANTY') {
      return `Halo Kak *${invoice.customerName}*! 🙏
Berikut kami lampirkan dokumen *Kartu Garansi Resmi Digital (E-Warranty)* dari *Bukan Baru Kitchen (BBKitchen)*:

🛡️ *E-WARRANTY RESMI 14 HARI*
No. Garansi: *${docNumber}*
Rujukan Invoice: ${invoice.invoiceNumber}
Status: *GARANSI AKTIF (14 HARI KALENDER)*
Tautan Verifikasi QR: https://bukanbarukitchen.com/garansi/${docNumber}

⚠️ *PENTING KHUSUS CHILLER/FREEZER:*
Wajib didiamkan minimal 3-4 jam setelah posisi diturunkan sebelum mencolokkan kabel listrik ke stopkontak PLN.

Hotline Service Desk BBKitchen: 0851 2200 1051
www.bukanbarukitchen.com`;
    }

    if (activeType === 'CANCELLATION_NOTE') {
      return `Yth. *${invoice.customerName}*,
Berikut kami sampaikan Surat Keterangan Pembatalan & Refund Resmi:

🚫 *SURAT KETERANGAN PEMBATALAN (CREDIT NOTE)*
No: *${docNumber}*
Invoice Rujukan: ${invoice.invoiceNumber}

• Nilai Tagihan: ${formatIDR(total)}
• DP Diterima: ${formatIDR(invoice.dpAmount || totalPaid)}
• Holding Fee (10% Cap Max Rp 1jt): -${formatIDR(calculatedHoldingFee)}
• *Sisa DP Di-Refund:* *${formatIDR(calculatedRefund)}*

Dana refund telah ditransfer balik ke rekening Anda via Bank Jago Syariah. Terima kasih atas pengertiannya.

Salam,
Bukan Baru Kitchen (0851-2200-1051)`;
    }

    if (activeType === 'DELIVERY_NOTE') {
      const itemsListSJ = invoice.items
        .map((it, idx) => `${idx + 1}. *${it.description}* (${it.sku}) • ${it.quantity} Unit`)
        .join('\n');

      return `Halo Kak *${invoice.customerName}*! 🙏
Berikut kami lampirkan dokumen surat jalan serah-terima unit dari *Bukan Baru Kitchen (BBKitchen)*:

🚚 *SURAT JALAN PENGIRIMAN UNIT (LUNAS)*
No: *${docNumber}*
Tanggal: ${todayFormatted}

📌 *Daftar Fisik Unit yang Dikirim:*
${itemsListSJ}

📍 *Alamat Pengiriman:*
${invoice.customerAddress || 'Alamat Penerima'}

${expedition ? `🚚 Ekspedisi: *${expedition}*` : ''}
${driverName ? `👤 Driver/Kurir: *${driverName}* ${driverPhone ? `(${driverPhone})` : ''}` : ''}
${plateNumber ? `🚗 No. Polisi: *${plateNumber}*` : ''}

Mohon diperiksa kelengkapan dan kondisi fisik unit saat diterima. Terima kasih!

🏢 *Bukan Baru Kitchen*
Pusat Peralatan Dapur Komersial & Resto Second Terpercaya
Hotline: 0851 2200 1051 | www.bukanbarukitchen.com`;
    }

    const itemsList = invoice.items
      .map(
        (it, idx) =>
          `${idx + 1}. *${it.description}* (${it.sku})\n   ${it.quantity} unit x ${formatIDR(
            it.unitPrice
          )} = *${formatIDR(it.total)}*`
      )
      .join('\n');

    if (activeType === 'QUOTATION') {
      return `Halo Kak *${invoice.customerName}*! 🙏
Berikut kami lampirkan penawaran harga resmi dari *Bukan Baru Kitchen (BBKitchen)*:

📋 *SURAT PENAWARAN HARGA (QUOTATION)*
No: *${docNumber}*
Tanggal: ${todayFormatted}
⏰ *Masa Berlaku: 1x24 Jam (First-Come, First-Served)*

📌 *Rincian Unit:*
${itemsList}
${discount > 0 ? `🏷️ *Diskon:* -${formatIDR(discount)}\n` : ''}
💰 *Total Penawaran:* ${formatIDR(total)}

ℹ️ *Ketentuan:* Penawaran ini berlaku 1x24 jam sebelum unit dilepas ke calon pembeli lain atau dikunci dengan DP minimal 30%.

🏢 *Bukan Baru Kitchen*
Pusat Peralatan Dapur Komersial & Resto Second Terpercaya
Hotline: 0851 2200 1051 | www.bukanbarukitchen.com`;
    }

    // INVOICE WA Share
    let shippingTextWA = '';
    if (invoice.hasShipping) {
      if (invoice.shippingFeeType === 'INCLUDED' && (invoice.shippingFee || 0) > 0) {
        shippingTextWA = `\n🚚 *Ongkos Kirim (Include):* ${formatIDR(invoice.shippingFee || 0)}`;
      } else if (invoice.shippingFeeType === 'BUYER_COD') {
        shippingTextWA = `\n🚚 *Ongkos Kirim:* Ditanggung Pembeli (Bayar COD ke Driver saat tiba)`;
      } else if (invoice.shippingFeeType === 'FREE_PROMO') {
        shippingTextWA = `\n🚚 *Ongkos Kirim:* Free Ongkir Promo BBKitchen (Gratis)`;
      }
    }

    return `Halo Kak *${invoice.customerName}*! 🙏
Berikut rincian tagihan resmi dari *Bukan Baru Kitchen (BBKitchen)*:

📄 *FAKTUR INVOICE TAGIHAN*
No: *${invoice.invoiceNumber}*
Tanggal: ${todayFormatted}

📌 *Item Terpilih:*
${itemsList}${shippingTextWA}
${discount > 0 ? `🏷️ *Diskon:* -${formatIDR(discount)}\n` : ''}
💰 *Total Tagihan:* ${formatIDR(total)}

🏦 *Rekening Pembayaran Resmi:*
• Bank: *Bank Jago Syariah*
• No. Rek: *5079 8068 4419*
• A.n: *Ahmad Sulaeman*

Mohon konfirmasi dan kirim bukti transfer jika dana telah terkirim. Terima kasih!`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateWhatsAppShare());
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      {/* Container with Print CSS */}
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Control Bar (Hidden during Print) */}
        <div className="print:hidden bg-slate-950 p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {invoice.documentType === 'QUOTATION' ? (
              <button
                type="button"
                onClick={() => setActiveType('QUOTATION')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-500 text-white shadow-md shadow-blue-500/20"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>📋 Surat Penawaran (1x24j)</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveType('INVOICE')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeType === 'INVOICE'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-850 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>📄 Faktur Invoice</span>
                </button>

                {isFullyPaid ? (
                  <button
                    type="button"
                    onClick={() => setActiveType('DELIVERY_NOTE')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeType === 'DELIVERY_NOTE'
                        ? 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/20'
                        : 'bg-slate-850 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>🚚 Surat Jalan (Lunas)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Surat Jalan hanya dapat dicetak setelah transaksi LUNAS"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-850 text-slate-500 opacity-50 cursor-not-allowed border border-slate-800"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Surat Jalan (Syarat Lunas)</span>
                  </button>
                )}

                {/* Tab 4: E-Warranty Generator */}
                {isFullyPaid && (
                  <button
                    type="button"
                    onClick={() => setActiveType('WARRANTY')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeType === 'WARRANTY'
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-850 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>🛡️ E-Warranty (14 Hari)</span>
                  </button>
                )}

                {/* Tab 5: Credit Note / Pembatalan */}
                {isVoid && (
                  <button
                    type="button"
                    onClick={() => setActiveType('CANCELLATION_NOTE')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeType === 'CANCELLATION_NOTE'
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                        : 'bg-slate-850 text-rose-300 hover:bg-slate-800'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>🚫 Nota Batal & Refund</span>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyToClipboard}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin!' : 'Copy WA'}</span>
            </button>

            <button
              type="button"
              onClick={printDocument}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PRINTABLE A4 PAPER CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-white text-slate-900 font-sans print:p-0 print:m-0 print:overflow-visible">
          {/* Document Header with BBKitchen Branding */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tighter uppercase font-mono">
                  BB<span className="text-amber-500">KITCHEN</span>
                </span>
                <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded tracking-widest uppercase">
                  Official
                </span>
              </div>
              <p className="text-xs font-bold text-slate-700">PT BUKAN BARU KITCHEN INDONESIA</p>
              <p className="text-[11px] text-slate-500 max-w-sm leading-snug">
                Sentra Peralatan Dapur Komersial, Mesin Resto, Chiller & Stainless Steel Terkurasi.
                <br />
                Jl. Surya Kencana No. 42, Pamulang 2, Tangerang Selatan
                <br />
                WhatsApp: 0851 2200 1051 | Website: bukanbarukitchen.com
              </p>
            </div>

            <div className="text-right space-y-1">
              <span
                className={`inline-block px-3 py-1 border rounded text-xs font-black tracking-widest uppercase ${
                  activeType === 'INVOICE'
                    ? 'bg-amber-100 border-amber-300 text-amber-950'
                    : activeType === 'QUOTATION'
                    ? 'bg-blue-100 border-blue-300 text-blue-950'
                    : activeType === 'WARRANTY'
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-950'
                    : activeType === 'CANCELLATION_NOTE'
                    ? 'bg-rose-100 border-rose-300 text-rose-950'
                    : 'bg-orange-100 border-orange-300 text-orange-950'
                }`}
              >
                {activeType === 'INVOICE' && 'FAKTUR TAGIHAN RESMI (INVOICE)'}
                {activeType === 'QUOTATION' && 'SURAT PENAWARAN HARGA (QUOTATION)'}
                {activeType === 'DELIVERY_NOTE' && 'SURAT JALAN PENGIRIMAN UNIT'}
                {activeType === 'WARRANTY' && 'KARTU GARANSI RESMI DIGITAL (E-WARRANTY)'}
                {activeType === 'CANCELLATION_NOTE' && 'SURAT KETERANGAN PEMBATALAN (CREDIT NOTE)'}
              </span>
              <p className="text-sm font-black font-mono text-slate-900 pt-1">{docNumber}</p>
              <p className="text-xs text-slate-600">
                Tanggal: <strong className="text-slate-900">{formattedIssueDate}</strong>
              </p>
              {activeType === 'INVOICE' && (
                <p className="text-xs text-slate-600">
                  Jatuh Tempo: <strong className="text-red-600">{formattedDueDate}</strong>
                </p>
              )}
              {activeType === 'QUOTATION' && (
                <p className="text-xs text-red-600 font-bold">
                  Masa Berlaku: <strong>1x24 Jam (First-Come, First-Served)</strong>
                </p>
              )}
              {activeType === 'WARRANTY' && (
                <p className="text-xs text-emerald-700 font-bold">
                  Masa Garansi: <strong>14 Hari Kalender (Day-0 Serah Terima)</strong>
                </p>
              )}
            </div>
          </div>

          {/* Customer & Recipient Information */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-xs leading-relaxed">
            <div>
              <p className="font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-1">
                {activeType === 'DELIVERY_NOTE'
                  ? 'Tujuan Pengiriman / Penerima:'
                  : activeType === 'WARRANTY'
                  ? 'Pemegang Sertifikat Garansi:'
                  : 'Ditujukan Kepada:'}
              </p>
              <p className="font-black text-sm text-slate-900">{invoice.customerName || 'Bpk/Ibu Pembeli'}</p>
              {invoice.customerCompany && <p className="font-bold text-slate-700">{invoice.customerCompany}</p>}
              <p className="text-slate-600 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>{invoice.customerPhone || '08xx-xxxx-xxxx'}</span>
              </p>
              <p className="text-slate-600 flex items-start gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                <span>{invoice.customerAddress || 'Jabodetabek'}</span>
              </p>
            </div>

            <div className="text-right flex flex-col justify-between">
              <div>
                <p className="font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-1">
                  Referensi Transaksi:
                </p>
                <p className="font-mono font-bold text-slate-900">
                  {invoice.orderReference || invoice.invoiceNumber}
                </p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  PIC Sales: <strong>{invoice.createdBy || 'BBKitchen Sales Desk'}</strong>
                </p>
              </div>

              {/* Status Badge in Header */}
              <div>
                {activeType === 'QUOTATION' ? (
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 border border-blue-300 rounded font-black text-xs uppercase tracking-widest">
                    PENAWARAN 1x24 JAM
                  </span>
                ) : activeType === 'DELIVERY_NOTE' ? (
                  <span className="inline-block px-3 py-1 bg-orange-100 text-orange-800 border border-orange-300 rounded font-black text-xs uppercase tracking-widest">
                    SIAP DISPATCH • LOLOS QC
                  </span>
                ) : activeType === 'WARRANTY' ? (
                  <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-black text-xs uppercase tracking-widest">
                    🛡️ GARANSI AKTIF (14 HARI)
                  </span>
                ) : activeType === 'CANCELLATION_NOTE' ? (
                  <span className="inline-block px-3 py-1 bg-rose-100 text-rose-800 border border-rose-300 rounded font-black text-xs uppercase tracking-widest">
                    TRANSAKSI DIBATALKAN (REFUND)
                  </span>
                ) : isFullyPaid ? (
                  <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-black text-xs uppercase tracking-widest">
                    ✓ LUNAS / PAID IN FULL
                  </span>
                ) : totalPaid > 0 ? (
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 border border-blue-300 rounded font-black text-xs uppercase tracking-widest">
                    DP DITERIMA ({total > 0 ? Math.round((totalPaid / total) * 100) : 0}%)
                  </span>
                ) : (
                  <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded font-black text-xs uppercase tracking-widest">
                    MENUNGGU PEMBAYARAN
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* VIEW KHUSUS 1: E-WARRANTY (TAB 4) */}
          {activeType === 'WARRANTY' ? (
            <div className="space-y-6">
              {/* Box Peringatan Khusus Pendingin */}
              <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-950 space-y-1">
                  <p className="font-black uppercase tracking-wide text-amber-900">
                    PERINGATAN KHUSUS UNIT PENDINGIN (CHILLER / FREEZER / SHOWCASE):
                  </p>
                  <p className="leading-relaxed">
                    Unit pendingin <strong>WAJIB DIDIAMKAN MINIMAL 3-4 JAM</strong> setelah diturunkan dari
                    armada sebelum dicolok ke sumber listrik PLN. Hal ini mutlak diperlukan agar oli kompresor yang
                    terguncang selama perjalanan mengendap kembali secara stabil. Kerusakan kompresor akibat
                    langsung dicolok seketika menggugurkan garansi.
                  </p>
                </div>
              </div>

              {/* Tabel Unit Tercover Garansi 14 Hari */}
              <div className="overflow-hidden rounded-xl border border-emerald-300">
                <div className="bg-emerald-950 text-emerald-200 px-4 py-2 font-bold text-xs flex justify-between items-center">
                  <span>DAFTAR UNIT TERLINDUNGI GARANSI 14 HARI (MESIN / ELEKTRONIK)</span>
                  <span className="text-[10px] bg-emerald-800 px-2 py-0.5 rounded">Eligible: {eligibleItems.length} Unit</span>
                </div>
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-emerald-50 text-emerald-950 font-bold border-b border-emerald-200 text-[10px] uppercase">
                      <th className="py-2 px-3 w-10 text-center">No</th>
                      <th className="py-2 px-3 w-28">Kode SKU</th>
                      <th className="py-2 px-3">Deskripsi Mesin & Spesifikasi</th>
                      <th className="py-2 px-3 text-center w-24">Cakupan</th>
                      <th className="py-2 px-3 text-center w-24">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100">
                    {eligibleItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-500 italic">
                          Tidak ada unit pendingin/kompor dalam transaksi ini.
                        </td>
                      </tr>
                    ) : (
                      eligibleItems.map((it, idx) => (
                        <tr key={it.id || idx} className="hover:bg-emerald-50/50">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{it.sku}</td>
                          <td className="py-2.5 px-3">
                            <p className="font-bold text-slate-900">{it.description}</p>
                            <p className="text-[10px] text-slate-500">QC Lolos • 100% Normal</p>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-700">14 Hari Kalender</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                              TERPROTEKSI ✅
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Tabel Item Non-Garansi (Hardware/Meja Stainless) */}
              {nonEligibleItems.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="bg-slate-800 text-slate-200 px-4 py-1.5 font-bold text-xs flex justify-between items-center">
                    <span>DAFTAR PERLENGKAPAN NON-GARANSI (SERAH TERIMA FISIK MEJA / RAK / SINK)</span>
                    <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded">{nonEligibleItems.length} Unit</span>
                  </div>
                  <table className="w-full text-xs text-left border-collapse">
                    <tbody className="divide-y divide-slate-100">
                      {nonEligibleItems.map((it, idx) => (
                        <tr key={it.id || idx} className="text-slate-600">
                          <td className="py-2 px-3 w-10 text-center font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-2 px-3 w-28 font-mono text-[11px]">{it.sku}</td>
                          <td className="py-2 px-3 text-[11px]">{it.description} ({it.quantity} Unit)</td>
                          <td className="py-2 px-3 text-right text-[10px] italic text-slate-500">
                            Non-Garansi Mesin (Serah Terima Fisik Selesai)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Dynamic QR Code & Service Desk Box */}
              <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 items-center">
                <div className="col-span-2 text-xs space-y-1">
                  <p className="font-bold text-slate-800">Verifikasi Garansi Publik & Layanan Perbaikan:</p>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Pindai kode QR atau buka tautan resmi: <br />
                    <strong className="font-mono text-emerald-700">bukanbarukitchen.com/garansi/{docNumber}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Service Desk WhatsApp Care: <strong>0851-2200-1051</strong> (Respons 1x24 jam kerja)
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center border-l border-slate-200 pl-4">
                  <div className="w-20 h-20 bg-slate-900 text-white rounded-lg flex flex-col items-center justify-center p-2">
                    <QrCode className="w-12 h-12 text-amber-400" />
                    <span className="text-[8px] font-mono tracking-widest mt-0.5">SCAN QR</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 mt-1">{docNumber}</span>
                </div>
              </div>
            </div>
          ) : activeType === 'CANCELLATION_NOTE' ? (
            /* VIEW KHUSUS 2: CREDIT NOTE / PEMBATALAN (TAB 5) */
            <div className="space-y-6">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1 text-rose-950">
                <p className="font-black uppercase tracking-wide text-rose-900">
                  SURAT KETERANGAN PEMBATALAN KESEPAKATAN & PENGEMBALIAN DANA (IHSAN & TA&apos;WIDH):
                </p>
                <p className="leading-relaxed">
                  Berdasarkan prinsip muamalah syar&apos;i dan asas keadilan, uang muka (DP) tidak dihanguskan
                  seluruhnya. Dikenakan biaya kompensasi penahanan ruang fisik gudang Pamulang (*Holding & Admin
                  Fee*) sebesar 10% dari nilai transaksi (dengan batas atas maksimal Rp 1.000.000), dan sisa dana
                  uang muka ditransfer kembali ke rekening pembeli.
                </p>
              </div>

              {/* Rincian Komputasi Finansial Pembatalan */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Total Nilai Tagihan Transaksi:</span>
                  <span className="font-mono font-bold text-slate-900">{formatIDR(total)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Uang Muka (DP) yang Telah Masuk:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    + {formatIDR(invoice.dpAmount || totalPaid)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 text-amber-800">
                  <div>
                    <span className="font-bold">Holding & Admin Fee (10% Capped Max Rp 1.000.000):</span>
                    <p className="text-[10px] text-slate-500">Upah riil penahanan unit fisik & uji teknisi QC</p>
                  </div>
                  <span className="font-mono font-bold">- {formatIDR(calculatedHoldingFee)}</span>
                </div>
                <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-black text-slate-950">
                  <span>SISA DANA UANG MUKA YANG DI-REFUND:</span>
                  <span className="font-mono text-emerald-700">{formatIDR(calculatedRefund)}</span>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1 text-blue-950">
                <p className="font-bold">Rekening Asal Pengembalian Dana BBKitchen:</p>
                <p className="font-mono text-slate-800">Bank Jago Syariah • 5079 8068 4419 a.n. Ahmad Sulaeman</p>
              </div>
            </div>
          ) : (
            /* VIEW STANDAR: INVOICE / QUOTATION / DELIVERY NOTE */
            <>
              {/* DRIVER & EXPEDITION BAR (ONLY FOR DELIVERY NOTE) */}
              {activeType === 'DELIVERY_NOTE' && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5 mb-6 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-orange-800 block">Jasa Ekspedisi:</span>
                    <span className="font-black text-slate-900">{expedition || 'Ekspedisi Rekanan'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-orange-800 block">Nama Driver:</span>
                    <span className="font-bold text-slate-900">
                      {driverName || '-'} {driverPhone ? `(${driverPhone})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-orange-800 block">No. Polisi Real:</span>
                    <span className="font-bold font-mono text-slate-900">{plateNumber || '-'}</span>
                  </div>
                </div>
              )}

              {/* ITEM DETAILS TABLE */}
              <div className="mb-6 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      <th className="py-2.5 px-3">Kode SKU</th>
                      <th className="py-2.5 px-3">Deskripsi Produk & Spesifikasi</th>
                      <th className="py-2.5 px-3 text-center w-16">Qty</th>
                      {activeType !== 'DELIVERY_NOTE' && (
                        <>
                          <th className="py-2.5 px-3 text-right w-28">Harga Satuan</th>
                          <th className="py-2.5 px-3 text-right w-28">Total</th>
                        </>
                      )}
                      {activeType === 'DELIVERY_NOTE' && (
                        <th className="py-2.5 px-3 text-center w-36">Kondisi Fisik / QC</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invoice.items.map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-slate-50">
                        <td className="py-3 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{it.sku}</td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{it.description}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Kondisi: {it.condition || 'Bekas Siap Pakai (Lolos Uji QC)'} • Gudang:{' '}
                            {it.warehouseLocation || 'Pamulang 2'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900">{it.quantity} unit</td>
                        {activeType !== 'DELIVERY_NOTE' && (
                          <>
                            <td className="py-3 px-3 text-right font-mono text-slate-700">
                              {formatIDR(it.unitPrice)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              {formatIDR(it.total)}
                            </td>
                          </>
                        )}
                        {activeType === 'DELIVERY_NOTE' && (
                          <td className="py-3 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                              ✓ 100% Normal Siap Pakai
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* FINANCIAL SUMMARY / TERBILANG */}
              {activeType !== 'DELIVERY_NOTE' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Terbilang & Payment Info */}
                  <div className="space-y-3">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <span className="font-bold text-slate-500 uppercase text-[10px] block mb-0.5">
                        {activeType === 'QUOTATION'
                          ? 'Terbilang Estimasi Penawaran:'
                          : 'Terbilang Total Transaksi:'}
                      </span>
                      <p className="italic font-bold text-slate-900 leading-snug">
                        &quot;{terbilangRupiah(total)} Rupiah&quot;
                      </p>
                    </div>

                    {activeType === 'INVOICE' && (
                      <>
                        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1.5">
                          <span className="font-bold text-blue-900 uppercase text-[10px] block">
                            Rekening Resmi Pembayaran:
                          </span>
                          <div className="flex items-center justify-between font-mono text-slate-800">
                            <span>
                              • Bank Jago Syariah: <strong>5079 8068 4419</strong>
                            </span>
                            <span className="text-[10px] font-bold text-slate-700">a.n. Ahmad Sulaeman</span>
                          </div>
                          <p className="text-[10px] text-blue-800 pt-1 border-t border-blue-200">
                            * Pembayaran bertahap (DP / Pelunasan) diverifikasi melalui mutasi rekening resmi ini.
                          </p>
                        </div>

                        {/* Breakdown Riwayat Pembayaran (Termin) */}
                        {paymentsList.length > 0 && (
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                            <span className="font-bold text-slate-700 uppercase text-[10px] block border-b border-slate-200 pb-1">
                              Riwayat Catatan Pembayaran ({paymentsList.length} Tahap):
                            </span>
                            <div className="space-y-1">
                              {paymentsList.map((p, pIdx) => (
                                <div
                                  key={p.id || pIdx}
                                  className="flex justify-between items-center text-[11px]"
                                >
                                  <span className="text-slate-600">
                                    <strong>{p.label || `Pembayaran ${pIdx + 1}`}:</strong>{' '}
                                    {p.date ? `(${p.date})` : ''}
                                  </span>
                                  <span className="font-mono font-bold text-emerald-700">
                                    {formatIDR(p.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {activeType === 'QUOTATION' && (
                      <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                        <p className="font-bold text-slate-700">ℹ️ Ketentuan Penawaran Resmi:</p>
                        <p>• Harga penawaran di atas adalah estimasi resmi sebelum finalisasi kesepakatan.</p>
                        <p>• Unit berlaku 1x24 jam (first-come, first-served) kecuali dikunci dengan DP minimal 30%.</p>
                      </div>
                    )}
                  </div>

                  {/* Numbers Summary */}
                  <div className="space-y-1.5 text-xs text-slate-700">
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span>Subtotal Unit / Produk:</span>
                      <span className="font-mono font-bold">{formatIDR(subtotal)}</span>
                    </div>
                    {activeType === 'INVOICE' &&
                      invoice.shippingFeeType === 'INCLUDED' &&
                      (invoice.shippingFee || 0) > 0 && (
                        <div className="flex justify-between py-1 border-b border-slate-200 text-emerald-700">
                          <span>Ongkos Kirim (Include Tagihan):</span>
                          <span className="font-mono font-bold">+ {formatIDR(invoice.shippingFee || 0)}</span>
                        </div>
                      )}
                    {discount > 0 && (
                      <div className="flex justify-between py-1 border-b border-slate-200 text-emerald-600">
                        <span>Diskon Kesepakatan:</span>
                        <span className="font-mono font-bold">- {formatIDR(discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-b-2 border-slate-900 text-sm font-black text-slate-950">
                      <span>{activeType === 'QUOTATION' ? 'TOTAL PENAWARAN:' : 'TOTAL KESEPAKATAN:'}</span>
                      <span className="font-mono">{formatIDR(total)}</span>
                    </div>

                    {activeType === 'INVOICE' && (
                      <>
                        <div className="flex justify-between py-1 text-emerald-700 font-bold bg-emerald-50 px-2 rounded">
                          <span>Total Pembayaran Masuk:</span>
                          <span className="font-mono">{formatIDR(totalPaid)}</span>
                        </div>
                        {isFullyPaid ? (
                          <div className="flex justify-between py-1.5 font-bold text-emerald-800 bg-emerald-100 px-2 rounded border border-emerald-300">
                            <span>Status Tagihan:</span>
                            <span>✓ LUNAS SEPENUHNYA</span>
                          </div>
                        ) : (
                          <div className="flex justify-between py-1 font-bold text-red-600 bg-red-50 px-2 rounded">
                            <span>Sisa Tagihan Pelunasan:</span>
                            <span className="font-mono">{formatIDR(sisa)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TERMS & SIGNATURE BOX */}
          <div className="border-t border-slate-200 pt-4 mt-6">
            <div className="grid grid-cols-3 gap-6 text-center text-xs">
              {activeType === 'DELIVERY_NOTE' ? (
                <>
                  <div className="space-y-12">
                    <p className="font-bold text-slate-600">Yang Menyerahkan (Gudang):</p>
                    <p className="font-bold text-slate-900 border-t border-slate-400 pt-1 mx-4">
                      ( Tim Gudang BBKitchen )
                    </p>
                  </div>
                  <div className="space-y-12">
                    <p className="font-bold text-slate-600">Driver / Ekspedisi:</p>
                    <p className="font-bold text-slate-900 border-t border-slate-400 pt-1 mx-4">
                      ( {driverName || '................................'} )
                    </p>
                  </div>
                  <div className="space-y-12">
                    <p className="font-bold text-slate-600">Penerima di Lokasi:</p>
                    <p className="font-bold text-slate-900 border-t border-slate-400 pt-1 mx-4">
                      ( {invoice.customerName} )
                    </p>
                  </div>
                </>
              ) : activeType === 'WARRANTY' ? (
                <>
                  <div className="text-left col-span-2 space-y-1 text-[11px] text-slate-500">
                    <p className="font-bold text-slate-700">Syarat Garansi Kaffah BBKitchen:</p>
                    <p>1. Mengcover kerusakan fungsi mekanik kompresor & kelistrikan normal selama 14 hari.</p>
                    <p>2. Day-0 garansi dihitung sejak tanda tangan serah terima fisik di lokasi pembeli.</p>
                    <p>3. Klaim cepat via WA Service Desk 0851-2200-1051 dengan melampirkan no. garansi.</p>
                  </div>
                  <div className="space-y-12 text-center">
                    <p className="font-bold text-slate-700">Quality Assurance,</p>
                    <p className="font-bold text-slate-900 border-t border-slate-400 pt-1 mx-2">
                      PT Bukan Baru Kitchen
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-left col-span-2 space-y-1 text-[11px] text-slate-500">
                    <p className="font-bold text-slate-700">Syarat & Ketentuan BBKitchen:</p>
                    <p>1. Unit komersial telah melalui uji QC teknisi 100% normal dan siap operasional.</p>
                    <p>2. Pelunasan 100% wajib sebelum unit dinaikkan / keluar dari gerbang gudang.</p>
                    <p>3. Pembayaran sah hanya melalui Bank Jago Syariah 5079 8068 4419 a.n. Ahmad Sulaeman.</p>
                  </div>
                  <div className="space-y-12 text-center">
                    <p className="font-bold text-slate-700">Hormat Kami,</p>
                    <div className="relative">
                      {activeType === 'INVOICE' && isFullyPaid && (
                        <div className="absolute inset-0 -top-8 flex items-center justify-center pointer-events-none opacity-85">
                          <span className="border-4 border-emerald-600 text-emerald-600 font-black text-lg px-3 py-1 rounded rotate-[-12deg] tracking-widest uppercase shadow-sm">
                            ✓ LUNAS
                          </span>
                        </div>
                      )}
                      <p className="font-bold text-slate-900 border-t border-slate-400 pt-1 mx-2">
                        PT Bukan Baru Kitchen
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
