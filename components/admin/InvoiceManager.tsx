'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { Invoice, InvoiceItem, InvoiceStatus, DocumentType, PaymentRecord } from '@/lib/types/finance';
import { MasterInventoryItem } from '@/lib/types/inventory';
import { formatIDR, parseToISODate } from '@/lib/repositories/warehouse-utils';
import { OfficialDocumentModal } from './OfficialDocumentModal';
import {
  FileText,
  Plus,
  Printer,
  Truck,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  DollarSign,
  Trash2,
  X,
  ExternalLink,
  Pencil,
  Lock,
  ShieldCheck,
  CreditCard,
  Calendar,
} from 'lucide-react';

interface DocumentItemRow {
  id: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  warehouseLocation?: string;
  condition?: string;
}

const EXPEDITION_OPTIONS = [
  { value: 'LALAMOVE', label: 'Lalamove' },
  { value: 'DELIVEREE', label: 'Deliveree' },
  { value: 'INTERNAL_FLEET', label: 'Armada Sendiri (BBKitchen)' },
  { value: 'SENTRAL_CARGO', label: 'Sentral Cargo' },
  { value: 'INDAH_DAKOTA', label: 'Indah Logistik / Dakota Cargo' },
  { value: 'GOJEK_GRAB', label: 'Gojek / Grab Instant' },
  { value: 'PICKUP_SENDIRI', label: 'Diambil Sendiri (Self Pick-up)' },
  { value: 'CUSTOM', label: 'Lainnya / Tulis Manual...' },
] as const;

export type CommercialSubTab = 'ALL' | 'QUOTATIONS' | 'ORDERS' | 'INVOICES' | 'DISPATCHES' | 'WARRANTIES';

interface InvoiceManagerProps {
  subTab?: CommercialSubTab;
  onSubTabChange?: (tab: CommercialSubTab) => void;
}

export function InvoiceManager({ subTab, onSubTabChange }: InvoiceManagerProps = {}) {
  const { role } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [internalSubTab, setInternalSubTab] = useState<CommercialSubTab>('ALL');
  const commercialSubTab = subTab ?? internalSubTab;
  const setCommercialSubTab = (tab: CommercialSubTab) => {
    if (onSubTabChange) {
      onSubTabChange(tab);
    } else {
      setInternalSubTab(tab);
    }
  };
  const [personaMode, setPersonaMode] = useState<'RETAIL_WARM' | 'B2B_FORMAL'>('RETAIL_WARM');

  // Modal States
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [documentModalType, setDocumentModalType] = useState<DocumentType>('INVOICE');
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // New Document Form States
  const [formDocType, setFormDocType] = useState<DocumentType>('INVOICE');
  const [formIssueDate, setFormIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');

  // Multi-Item Rows
  const [itemRows, setItemRows] = useState<DocumentItemRow[]>([
    { id: 'item_1', sku: '', description: '', quantity: 1, unitPrice: 0 },
  ]);

  // Live SKU Search States for rows
  const [activeSearchRowId, setActiveSearchRowId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<MasterInventoryItem[]>([]);
  const [isSearchingInventory, setIsSearchingInventory] = useState(false);

  // Multi-Payment Installments (Termin)
  const [payments, setPayments] = useState<PaymentRecord[]>([
    {
      id: 'pay_1',
      label: 'Pembayaran 1 (DP)',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      method: 'TRANSFER_JAGO_SYARIAH',
    },
  ]);

  // Financial States
  const [discount, setDiscount] = useState<string>('0');

  // Optional Shipping States
  const [hasShippingDetails, setHasShippingDetails] = useState<boolean>(false);
  const [shippingFeeType, setShippingFeeType] = useState<'BUYER_COD' | 'INCLUDED' | 'FREE_PROMO'>('BUYER_COD');
  const [shippingFee, setShippingFee] = useState<string>('0');
  const [expeditionChoice, setExpeditionChoice] = useState<string>('LALAMOVE');
  const [customExpeditionText, setCustomExpeditionText] = useState('');
  const [deliveryDriver, setDeliveryDriver] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [notes, setNotes] = useState('');

  // DIRECTIVE PR-1 (Task 2): Remote Acceptance Unlock States & Handler
  const [unlockedSjs, setUnlockedSjs] = useState<Record<string, boolean>>({});
  const [unlockingSj, setUnlockingSj] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dispatches')
      .then((res) => res.json())
      .then((data) => {
        if (data?.dispatches && Array.isArray(data.dispatches)) {
          const map: Record<string, boolean> = {};
          data.dispatches.forEach((d: any) => {
            if (d.sjNumber) {
              map[d.sjNumber] = Boolean(d.isUnlockedForAcceptance);
            }
          });
          setUnlockedSjs(map);
        }
      })
      .catch(() => {});
  }, []);

  const handleUnlockAcceptance = async (sjNumber: string) => {
    if (!sjNumber) return;
    setUnlockingSj(sjNumber);
    try {
      const res = await fetch('/api/dispatches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UNLOCK', sjNumber }),
      });
      if (res.ok) {
        setUnlockedSjs((prev) => ({ ...prev, [sjNumber]: true }));
      }
    } catch (err) {
      console.error('Failed to unlock dispatch acceptance:', err);
    } finally {
      setUnlockingSj(null);
    }
  };

  // Helper Methods for Multi-Payment Rows
  const addPaymentRow = () => {
    const nextIdx = payments.length + 1;
    const defaultLabel = nextIdx === 2 ? 'Pembayaran 2 (Pelunasan)' : `Pembayaran ${nextIdx}`;
    setPayments((prev) => [
      ...prev,
      {
        id: `pay_${Date.now()}_${nextIdx}`,
        label: defaultLabel,
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        method: 'TRANSFER_JAGO_SYARIAH',
      },
    ]);
  };

  const removePaymentRow = (id: string) => {
    if (payments.length <= 1) {
      setPayments([
        {
          id: 'pay_1',
          label: 'Pembayaran 1 (DP)',
          amount: 0,
          date: new Date().toISOString().split('T')[0],
          method: 'TRANSFER_JAGO_SYARIAH',
        },
      ]);
      return;
    }
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePaymentRow = (id: string, field: keyof PaymentRecord, val: any) => {
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return { ...p, [field]: val };
        }
        return p;
      })
    );
  };

  // Helper to quickly mark invoice as fully paid with 1 payment
  const handleQuickLunas = (targetTotal: number) => {
    setPayments([
      {
        id: `pay_lunas_${Date.now()}`,
        label: 'Pembayaran Lunas (100%)',
        amount: targetTotal,
        date: new Date().toISOString().split('T')[0],
        method: 'TRANSFER_JAGO_SYARIAH',
      },
    ]);
  };

  // Void Invoice Handler (Gate 7: Ihsan & Ta'widh)
  const handleVoidInvoice = async (inv: Invoice) => {
    const holdingFee = Math.min(Math.round((inv.totalAmount || 0) * 0.1), 1000000);
    const dpPaid = inv.dpAmount || 0;
    const refund = Math.max(0, dpPaid - holdingFee);

    const confirmMsg = `Konfirmasi Pembatalan Invoice ${inv.invoiceNumber}?\n\n• Total: ${formatIDR(inv.totalAmount)}\n• DP Masuk: ${formatIDR(dpPaid)}\n• Holding Fee (10% max Rp 1jt): -${formatIDR(holdingFee)}\n• Sisa Refund ke Pembeli: ${formatIDR(refund)}\n\nUnit fisik di gudang akan otomatis dilepas kembali menjadi READY di katalog publik. Lanjutkan?`;

    if (window.confirm(confirmMsg)) {
      try {
        const res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'UPDATE_STATUS', id: inv.id, status: 'VOID' }),
        });
        if (res.ok) {
          loadInvoices();
        }
      } catch (e) {
        console.error('Void invoice error:', e);
      }
    }
  };

  // 1-Click Convert Quotation to Invoice (Gate 1: Quotation 1x24j Check)
  const handleConvertQuotationToInvoice = (quotation: Invoice) => {
    const issue = parseToISODate(quotation.issueDate) || quotation.issueDate;
    if (issue) {
      const diffHours = (Date.now() - new Date(issue).getTime()) / (1000 * 60 * 60);
      if (diffHours > 24) {
        const ok = window.confirm(
          `⚠️ PERINGATAN KEDALUWARSA (Gate 1):\nQuotation ${quotation.quotationNumber || quotation.invoiceNumber} ini telah melewati batas waktu 1x24 jam.\n\nPastikan ketersediaan unit fisik di Gudang Pamulang belum terjual ke pembeli lain sebelum menerbitkan invoice.\n\nTetap lanjutkan konversi?`
        );
        if (!ok) return;
      }
    }

    setEditingInvoice(null);
    setFormDocType('INVOICE');
    setFormIssueDate(new Date().toISOString().split('T')[0]);
    setCustomerName(quotation.customerName || '');
    setCustomerPhone(quotation.customerPhone || '');
    setCustomerAddress(quotation.customerAddress || '');
    setCustomerCompany(quotation.customerCompany || '');
    if (quotation.items && quotation.items.length > 0) {
      setItemRows(
        quotation.items.map((it, idx) => ({
          id: `item_${idx + 1}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          sku: it.sku || '',
          description: it.description || '',
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          unitCost: it.unitCost || 0,
          warehouseLocation: it.warehouseLocation,
          condition: it.condition,
        }))
      );
    }
    setDiscount(quotation.discount ? String(quotation.discount) : '0');
    setPayments([
      {
        id: `pay_1`,
        label: 'Pembayaran 1 (DP)',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        method: 'TRANSFER_JAGO_SYARIAH',
      },
    ]);
    setHasShippingDetails(false);
    setNotes(
      quotation.notes
        ? `[Diambil dari ${quotation.quotationNumber || quotation.invoiceNumber}] ${quotation.notes}`
        : `Diambil dari Quotation ${quotation.quotationNumber || quotation.invoiceNumber}`
    );
    setShowCreateModal(true);
  };

  // Open Edit Modal for Invoice / Quotation
  const handleOpenEditModal = (inv: Invoice) => {
    setEditingInvoice(inv);
    setFormDocType(inv.documentType === 'QUOTATION' ? 'QUOTATION' : 'INVOICE');
    setFormIssueDate(parseToISODate(inv.issueDate) || inv.issueDate || new Date().toISOString().split('T')[0]);
    setCustomerName(inv.customerName || '');
    setCustomerPhone(inv.customerPhone || '');
    setCustomerAddress(inv.customerAddress || '');
    setCustomerCompany(inv.customerCompany || '');
    if (inv.items && inv.items.length > 0) {
      setItemRows(
        inv.items.map((it, idx) => ({
          id: `item_${idx + 1}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          sku: it.sku || '',
          description: it.description || '',
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          unitCost: it.unitCost || 0,
          warehouseLocation: it.warehouseLocation,
          condition: it.condition,
        }))
      );
    } else {
      setItemRows([{ id: `item_1_${Date.now()}`, sku: '', description: '', quantity: 1, unitPrice: inv.totalAmount || 0, unitCost: 0 }]);
    }
    setDiscount(inv.discount ? String(inv.discount) : '0');

    // Populate Payments
    if (inv.payments && inv.payments.length > 0) {
      setPayments(inv.payments);
    } else if (inv.dpAmount && inv.dpAmount > 0) {
      setPayments([
        {
          id: 'pay_1',
          label: 'Pembayaran 1 (DP)',
          amount: inv.dpAmount,
          date: inv.issueDate || new Date().toISOString().split('T')[0],
          method: inv.paymentMethod || 'TRANSFER_JAGO_SYARIAH',
        },
      ]);
    } else {
      setPayments([
        {
          id: 'pay_1',
          label: 'Pembayaran 1 (DP)',
          amount: inv.status === 'PAID' ? inv.totalAmount : 0,
          date: inv.issueDate || new Date().toISOString().split('T')[0],
          method: inv.paymentMethod || 'TRANSFER_JAGO_SYARIAH',
        },
      ]);
    }

    // Populate Shipping
    const hasShipping = Boolean(inv.hasShipping || (inv.shippingFee && inv.shippingFee > 0) || inv.deliveryExpedition || inv.deliveryDriver);
    setHasShippingDetails(hasShipping);
    setShippingFee(inv.shippingFee ? String(inv.shippingFee) : '0');
    setShippingFeeType(
      inv.shippingFeeType === 'INCLUDED' || inv.shippingFeeType === 'FREE_PROMO'
        ? inv.shippingFeeType
        : 'BUYER_COD'
    );
    setDeliveryDriver(inv.deliveryDriver || '');
    setDriverPhone(inv.driverPhone || '');
    setVehiclePlate(inv.deliveryVehiclePlate || '');
    setNotes(inv.notes || '');

    const matchExp = EXPEDITION_OPTIONS.find((o) => o.label === inv.deliveryExpedition || o.value === inv.deliveryExpedition);
    if (matchExp) {
      setExpeditionChoice(matchExp.value);
      setCustomExpeditionText('');
    } else if (inv.deliveryExpedition) {
      setExpeditionChoice('CUSTOM');
      setCustomExpeditionText(inv.deliveryExpedition);
    }

    setShowCreateModal(true);
  };

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/invoices', {
        headers: { 'x-bbk-role': role ?? '' },
      });
      const data = await res.json();
      if (data.invoices) setInvoices(data.invoices);
    } catch (err) {
      console.error('Failed to load invoices', err);
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Handle Delete Invoice
  const handleDeleteInvoice = async (inv: Invoice) => {
    const docTitle = inv.invoiceNumber || inv.quotationNumber || inv.id;
    if (!window.confirm(`Hapus dokumen ${docTitle} dari arsip transaksi?\nData pada Google Sheets juga akan dihapus.`)) {
      return;
    }

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE', id: inv.id }),
      });

      if (res.ok) {
        setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
        loadInvoices();
      }
    } catch (err) {
      console.error('Failed to delete invoice:', err);
    }
  };

  // Handle Multi-Item Operations
  const addItemRow = (customSku: string = '', customTitle: string = '') => {
    const newId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    setItemRows((prev) => [
      ...prev,
      { id: newId, sku: customSku, description: customTitle, quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeItemRow = (id: string) => {
    if (itemRows.length <= 1) {
      setItemRows([{ id: 'item_1', sku: '', description: '', quantity: 1, unitPrice: 0 }]);
      return;
    }
    setItemRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateItemRow = (id: string, field: keyof DocumentItemRow, val: any) => {
    setItemRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return { ...r, [field]: val };
        }
        return r;
      })
    );
  };

  // Live Auto-Search Catalog when typing SKU / Title
  const handleSearchSku = async (rowId: string, query: string) => {
    updateItemRow(rowId, 'sku', query);
    setActiveSearchRowId(rowId);

    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearchingInventory(true);
    try {
      const res = await fetch(`/api/inventory?search=${encodeURIComponent(query.trim())}&pageSize=6`);
      const data = await res.json();
      if (data.items) {
        setSearchResults(data.items);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearchingInventory(false);
    }
  };

  const handleSelectSearchedItem = (rowId: string, item: MasterInventoryItem) => {
    setItemRows((prev) =>
      prev.map((r) => {
        if (r.id === rowId) {
          return {
            ...r,
            sku: item.SKU,
            description: item.PRODUCT_TITLE,
            unitPrice: item.HARGA_BUKA_WA || item.HARGA_ESTIMASI_PUBLIK || 0,
            unitCost: item.HARGA_MODAL || 0,
            warehouseLocation: item.LOKASI_UNIT || item.asal_gudang,
            condition: item.KONDISI_UNIT || 'Bekas Siap Pakai (Lolos QC)',
          };
        }
        return r;
      })
    );
    setActiveSearchRowId(null);
    setSearchResults([]);
  };

  // Calculations
  const calculatedSubtotal = useMemo(() => {
    return itemRows.reduce((sum, it) => sum + (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0), 0);
  }, [itemRows]);

  const discNum = Number(discount.replace(/\D/g, '')) || 0;
  const shippingNum = (hasShippingDetails && shippingFeeType === 'INCLUDED') ? (Number(shippingFee.replace(/\D/g, '')) || 0) : 0;
  const calculatedTotal = Math.max(0, calculatedSubtotal + shippingNum - discNum);

  // Total Paid across all installments
  const totalPaid = useMemo(() => {
    if (formDocType === 'QUOTATION') return 0;
    return payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [payments, formDocType]);

  const calculatedSisa = Math.max(0, calculatedTotal - totalPaid);
  const isFormFullyPaid = calculatedTotal > 0 && totalPaid >= calculatedTotal;

  // Submit & Create Document
  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanItems: InvoiceItem[] = itemRows.map((r, idx) => {
      const q = Math.max(1, Number(r.quantity) || 1);
      const p = Number(r.unitPrice) || 0;
      const c = r.unitCost ? Number(r.unitCost) : undefined;
      return {
        id: `item_${idx + 1}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sku: r.sku.trim() || `BBK-CUSTOM-${idx + 1}`,
        description: r.description.trim() || 'Peralatan Dapur Komersial Restoran',
        quantity: q,
        unitPrice: p,
        unitCost: c,
        total: q * p,
        warehouseLocation: r.warehouseLocation,
        condition: r.condition,
      };
    });

    const now = new Date();
    const issueDate = now.toISOString().split('T')[0];
    const dueDateObj = new Date(now);
    dueDateObj.setDate(dueDateObj.getDate() + 3);
    const dueDate = dueDateObj.toISOString().split('T')[0];
    const randomNum = Math.floor(1000 + Math.random() * 9000);

    const resolvedExpedition = hasShippingDetails
      ? (expeditionChoice === 'CUSTOM'
          ? customExpeditionText.trim() || 'Ekspedisi Rekanan'
          : EXPEDITION_OPTIONS.find((o) => o.value === expeditionChoice)?.label || expeditionChoice)
      : undefined;

    // Filter valid payment records (only for Invoices)
    const cleanPayments: PaymentRecord[] = formDocType === 'INVOICE'
      ? payments.map((p, idx) => ({
          id: p.id || `pay_${idx + 1}`,
          label: p.label.trim() || `Pembayaran ${idx + 1}`,
          amount: Number(p.amount) || 0,
          date: p.date || issueDate,
          method: p.method || 'TRANSFER_JAGO_SYARIAH',
          notes: p.notes?.trim() || undefined,
        }))
      : [];

    const isPaid = formDocType === 'INVOICE' && calculatedTotal > 0 && totalPaid >= calculatedTotal;
    const finalStatus: InvoiceStatus = formDocType === 'QUOTATION'
      ? 'GENERATED'
      : (isPaid ? 'PAID' : (totalPaid > 0 ? 'DP_PAID' : 'GENERATED'));

    const newInv: Omit<Invoice, 'id'> = {
      invoiceNumber: `INV-BBK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${randomNum}`,
      quotationNumber: `QUO-BBK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${randomNum}`,
      suratJalanNumber: `SJ-BBK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${randomNum}`,
      documentType: formDocType,
      customerName: customerName.trim() || 'Bpk/Ibu Owner Resto',
      customerPhone: customerPhone.trim() || '08xx-xxxx-xxxx',
      customerAddress: customerAddress.trim(),
      customerCompany: customerCompany.trim(),
      orderReference: `ORD-WA-${Date.now().toString().slice(-6)}`,
      items: cleanItems,
      subtotal: calculatedSubtotal,
      discount: discNum,
      tax: 0,
      totalAmount: calculatedTotal,
      dpAmount: cleanPayments[0]?.amount || 0,
      remainingAmount: formDocType === 'QUOTATION' ? 0 : calculatedSisa,
      payments: cleanPayments,
      issueDate,
      dueDate,
      status: finalStatus,
      paymentMethod: cleanPayments[0]?.method || 'TRANSFER_JAGO_SYARIAH',
      hasShipping: hasShippingDetails,
      deliveryDriver: hasShippingDetails ? deliveryDriver.trim() || undefined : undefined,
      driverPhone: hasShippingDetails ? driverPhone.trim() || undefined : undefined,
      deliveryVehiclePlate: hasShippingDetails ? vehiclePlate.trim() || undefined : undefined,
      deliveryExpedition: resolvedExpedition,
      shippingFeeType: hasShippingDetails ? shippingFeeType : undefined,
      shippingFee: hasShippingDetails ? shippingNum : 0,
      notes: notes.trim(),
      createdBy: 'Sales / Finance Desk',
    };

    try {
      if (editingInvoice) {
        const updatedInv: Invoice = {
          ...editingInvoice,
          documentType: formDocType,
          customerName: customerName.trim() || 'Bpk/Ibu Owner Resto',
          customerPhone: customerPhone.trim() || '08xx-xxxx-xxxx',
          customerAddress: customerAddress.trim(),
          customerCompany: customerCompany.trim(),
          items: cleanItems,
          subtotal: calculatedSubtotal,
          discount: discNum,
          tax: 0,
          totalAmount: calculatedTotal,
          dpAmount: cleanPayments[0]?.amount || 0,
          remainingAmount: formDocType === 'QUOTATION' ? 0 : calculatedSisa,
          payments: cleanPayments,
          status: finalStatus,
          paymentMethod: cleanPayments[0]?.method || 'TRANSFER_JAGO_SYARIAH',
          hasShipping: hasShippingDetails,
          deliveryDriver: hasShippingDetails ? deliveryDriver.trim() || undefined : undefined,
          driverPhone: hasShippingDetails ? driverPhone.trim() || undefined : undefined,
          deliveryVehiclePlate: hasShippingDetails ? vehiclePlate.trim() || undefined : undefined,
          deliveryExpedition: resolvedExpedition,
          shippingFeeType: hasShippingDetails ? shippingFeeType : undefined,
          shippingFee: hasShippingDetails ? shippingNum : 0,
          notes: notes.trim(),
        };

        const res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'UPDATE', invoice: updatedInv }),
        });

        if (res.ok) {
          const updatedData = await res.json();
          setShowCreateModal(false);
          setEditingInvoice(null);
          loadInvoices();

          if (updatedData.invoice) {
            setSelectedInvoice(updatedData.invoice);
            setDocumentModalType(formDocType);
            setIsDocModalOpen(true);
          }
        }
      } else {
        const res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'CREATE', invoice: newInv }),
        });
        if (res.ok) {
          const createdData = await res.json();
          setShowCreateModal(false);
          loadInvoices();

          if (createdData.invoice) {
            setSelectedInvoice(createdData.invoice);
            setDocumentModalType(formDocType);
            setIsDocModalOpen(true);
          }
        }
      }
    } catch (err) {
      console.error('Document submission failed', err);
    }
  };

  // Filter invoices for table with Commercial Sub-Tabs (Paper.id Paradigm)
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Commercial Sub-Tab filter
      if (commercialSubTab === 'QUOTATIONS' && inv.documentType !== 'QUOTATION') return false;
      if (commercialSubTab === 'ORDERS' && !inv.orderReference && !inv.customerCompany?.toLowerCase().includes('pt')) return false;
      if (commercialSubTab === 'INVOICES' && inv.documentType !== 'INVOICE') return false;
      if (commercialSubTab === 'DISPATCHES' && !inv.hasShipping && inv.status !== 'PAID') return false;
      if (commercialSubTab === 'WARRANTIES' && inv.status !== 'PAID') return false;

      // Status filter
      let matchStatus = true;
      if (statusFilter === 'PAID') {
        matchStatus = inv.status === 'PAID';
      } else if (statusFilter === 'DP_PAID') {
        matchStatus = inv.status === 'DP_PAID';
      } else if (statusFilter === 'UNPAID') {
        matchStatus = inv.status !== 'PAID' && inv.status !== 'DP_PAID' && inv.status !== 'VOID';
      } else if (statusFilter === 'VOID') {
        matchStatus = inv.status === 'VOID';
      }

      const matchType = typeFilter === 'ALL' || inv.documentType === typeFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchQ =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.quotationNumber && inv.quotationNumber.toLowerCase().includes(q)) ||
        inv.customerName.toLowerCase().includes(q) ||
        (inv.customerPhone && inv.customerPhone.toLowerCase().includes(q)) ||
        (inv.orderReference && inv.orderReference.toLowerCase().includes(q)) ||
        (inv.customerCompany && inv.customerCompany.toLowerCase().includes(q)) ||
        inv.items.some((i) => i.description.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));

      return matchStatus && matchType && matchQ;
    });
  }, [invoices, statusFilter, typeFilter, searchQuery, commercialSubTab]);

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-amber-950 border border-amber-800 text-amber-400">
            <FileText className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-xl font-black text-slate-100 tracking-tight flex items-center gap-2">
              DOKUMEN RESMI &amp; INVOICE
              <span className="px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-300 text-[10px] font-mono font-bold">
                BBKitchen Finance
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Faktur Invoice (Multi-Termin), Penawaran Resmi (Quotation) &amp; Surat Jalan (Syarat Lunas).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadInvoices}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh Arsip Dokumen"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingInvoice(null);
              setFormDocType('INVOICE');
              setCustomerName('');
              setCustomerPhone('');
              setCustomerAddress('');
              setCustomerCompany('');
              setItemRows([{ id: 'item_1', sku: '', description: '', quantity: 1, unitPrice: 0 }]);
              setDiscount('0');
              setPayments([
                {
                  id: 'pay_1',
                  label: 'Pembayaran 1 (DP)',
                  amount: 0,
                  date: new Date().toISOString().split('T')[0],
                  method: 'TRANSFER_JAGO_SYARIAH',
                },
              ]);
              setHasShippingDetails(false);
              setNotes('');
              setShowCreateModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-950/50 flex items-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Terbitkan Dokumen Baru</span>
          </button>
        </div>
      </div>

      {/* ACTIVE SUB-MODULE BANNER (CONTROLLED DIRECTLY FROM SIDEBAR) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 px-5 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="text-slate-400 font-medium">Sub-Menu Aktif:</span>
          <span className="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-400 font-black border border-amber-500/20 flex items-center gap-2 text-xs">
            {commercialSubTab === 'ALL' && '📑 Semua Dokumen Transaksi'}
            {commercialSubTab === 'QUOTATIONS' && '📄 Surat Penawaran (Quotation 1x24 Jam)'}
            {commercialSubTab === 'ORDERS' && '📋 Order Masuk (PO / SO)'}
            {commercialSubTab === 'INVOICES' && '🧾 Faktur Penjualan (Invoice)'}
            {commercialSubTab === 'DISPATCHES' && '🚚 Pengiriman & Surat Jalan (E-POD)'}
            {commercialSubTab === 'WARRANTIES' && '🛡️ E-Warranty Mesin (14 Hari)'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
          <span>
            Terfilter: <strong className="text-amber-400 font-bold">{filteredInvoices.length} Dokumen</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span>
            Total: <strong className="text-white font-bold">{invoices.length} Arsip</strong>
          </span>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block text-slate-400 font-bold mb-1">🔍 Cari Dokumen:</label>
          <input
            type="text"
            placeholder="Cari No. Dokumen, PO/Ref, Pembeli, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-bold mb-1">📄 Format Dokumen:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-xs"
          >
            <option value="ALL">Semua Dokumen</option>
            <option value="INVOICE">📄 Faktur Tagihan (Invoice)</option>
            <option value="QUOTATION">📋 Surat Penawaran (Quotation)</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-400 font-bold mb-1">📌 Status Transaksi (Paper.id):</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-xs"
          >
            <option value="ALL">Semua Status Pembayaran</option>
            <option value="PAID">✓ Paid (Lunas Penuh)</option>
            <option value="DP_PAID">⏳ Partially Paid (DP 30%)</option>
            <option value="UNPAID">⚠️ Unpaid (Belum Bayar)</option>
            <option value="VOID">🚫 Dibatalkan (Void / Refund)</option>
          </select>
        </div>
      </div>

      {/* ARSIP DOKUMEN TABLE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            ARSIP DOKUMEN TRANSAKSI ({filteredInvoices.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3.5">No. Dokumen</th>
                <th className="py-3 px-3.5">Format</th>
                <th className="py-3 px-3.5">Nama Pelanggan</th>
                <th className="py-3 px-3.5">Rincian Unit</th>
                <th className="py-3 px-3.5">Tanggal Terbit</th>
                <th className="py-3 px-3.5 text-right">Total Transaksi</th>
                <th className="py-3 px-3.5 text-center">Status Pembayaran</th>
                <th className="py-3 px-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Memuat arsip dokumen...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    Belum ada dokumen transaksi yang diterbitkan.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  // Calculate dynamic multi-payment metrics for this row
                  const invPayments = (inv.payments && inv.payments.length > 0)
                    ? inv.payments
                    : (inv.dpAmount && inv.dpAmount > 0
                        ? [{ id: 'p1', label: 'Pembayaran 1 (DP)', amount: inv.dpAmount, date: inv.issueDate || '', method: 'TRANSFER_JAGO_SYARIAH' }]
                        : []);

                  const invPaid = invPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                  const isPaid = inv.status === 'PAID' || (inv.totalAmount > 0 && invPaid >= inv.totalAmount);
                  const invRemaining = Math.max(0, inv.totalAmount - invPaid);

                  return (
                    <tr key={inv.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-3 px-3.5 font-mono font-bold text-amber-400">
                        {inv.documentType === 'QUOTATION' ? (inv.quotationNumber || inv.invoiceNumber) : inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          inv.documentType === 'QUOTATION'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {inv.documentType === 'QUOTATION' ? '📋 QUOTATION' : '📄 INVOICE'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <p className="font-bold text-slate-200">{inv.customerName}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{inv.customerPhone}</p>
                      </td>
                      <td className="py-3 px-3.5 max-w-xs">
                        <p className="text-slate-300 line-clamp-1">
                          {inv.items.map((i) => i.description).join(', ')}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {inv.items.map((i) => `${i.sku} (${i.quantity} unit)`).join(', ')}
                        </p>
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-300">
                        {parseToISODate(inv.issueDate) || inv.issueDate}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-white">
                        {formatIDR(inv.totalAmount)}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        {inv.documentType === 'QUOTATION' ? (
                          (() => {
                            const issue = parseToISODate(inv.issueDate) || inv.issueDate;
                            const isExpired = issue
                              ? (Date.now() - new Date(issue).getTime()) / (1000 * 60 * 60) > 24
                              : false;
                            return isExpired ? (
                              <span className="inline-block px-2.5 py-0.5 bg-rose-950 text-rose-300 border border-rose-800 rounded-full text-[10px] font-bold">
                                ⚠️ EXPIRED (&gt;24j)
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full text-[10px] font-bold">
                                📋 VALID (1x24j)
                              </span>
                            );
                          })()
                        ) : inv.status === 'VOID' ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-2.5 py-0.5 bg-rose-950/80 text-rose-300 border border-rose-800 rounded-full text-[10px] font-bold">
                              🚫 VOID (BATAL)
                            </span>
                            {inv.refundAmount != null && (
                              <p className="text-[9px] text-slate-400 font-mono">
                                Refund: {formatIDR(inv.refundAmount)}
                              </p>
                            )}
                          </div>
                        ) : isPaid ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-2.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full text-[10px] font-bold">
                              ✓ PAID (LUNAS)
                            </span>
                            {inv.storageDeadline && (
                              <p className="text-[9px] text-amber-400 font-mono">
                                Storage: s.d {inv.storageDeadline}
                              </p>
                            )}
                            {(() => {
                              const sjNum = inv.suratJalanNumber || ('SJ-' + inv.invoiceNumber.replace(/^INV-/, ''));
                              return (
                                <div className="pt-0.5">
                                  {unlockedSjs[sjNum] ? (
                                    <span className="inline-block px-1.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[9px] font-bold">
                                      🔓 E-POD Terbuka
                                    </span>
                                  ) : (
                                    <span className="inline-block px-1.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded text-[9px] font-bold">
                                      🔒 E-POD Terkunci
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        ) : invPaid > 0 ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-2.5 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 rounded-full text-[10px] font-bold">
                              ⏳ PARTIALLY PAID
                            </span>
                            <p className="text-[9px] text-slate-400 font-mono">
                              Masuk: {formatIDR(invPaid)} • Sisa: {formatIDR(invRemaining)}
                            </p>
                          </div>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded-full text-[10px] font-bold">
                            ⚠️ UNPAID
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {inv.documentType === 'QUOTATION' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setDocumentModalType('QUOTATION');
                                  setIsDocModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30 transition-colors"
                                title="Buka & Cetak Surat Penawaran"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Quotation</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConvertQuotationToInvoice(inv)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md transition-colors"
                                title="Ambil penawaran ini dan buat menjadi Faktur Invoice Resmi"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Ambil ke Invoice</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(inv)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 transition-colors"
                                title="Edit penawaran harga"
                              >
                                <Pencil className="w-3 h-3 text-amber-400" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteInvoice(inv)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                                title="Hapus Penawaran Ini"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setDocumentModalType('INVOICE');
                                  setIsDocModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30 transition-colors"
                                title="Buka / Cetak Faktur Invoice"
                              >
                                <FileText className="w-3 h-3" />
                                <span>Invoice</span>
                              </button>

                              {/* Surat Jalan (Hanya Lunas) */}
                              {isPaid ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedInvoice(inv);
                                      setDocumentModalType('DELIVERY_NOTE');
                                      setIsDocModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition-colors"
                                    title="Cetak Surat Jalan Pengiriman (Invoice Sudah Lunas)"
                                  >
                                    <Truck className="w-3 h-3" />
                                    <span>Surat Jalan</span>
                                  </button>

                                  {/* E-Warranty */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedInvoice(inv);
                                      setDocumentModalType('WARRANTY');
                                      setIsDocModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-500/30 transition-colors"
                                    title="Cetak Kartu Garansi Digital 14 Hari"
                                  >
                                    <ShieldCheck className="w-3 h-3 text-teal-400" />
                                    <span>Garansi</span>
                                  </button>

                                  {/* Remote Acceptance Gate (E-POD) */}
                                  {(() => {
                                    const sjNum = inv.suratJalanNumber || ('SJ-' + inv.invoiceNumber.replace(/^INV-/, ''));
                                    const isUnlocked = unlockedSjs[sjNum];
                                    return isUnlocked ? (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 text-xs font-bold border border-emerald-800"
                                        title="Gate Tanda Tangan Serah Terima Digital E-POD di HP sudah Terbuka"
                                      >
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        <span>TTD Terbuka</span>
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleUnlockAcceptance(sjNum)}
                                        disabled={unlockingSj === sjNum}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
                                        title="Buka Kunci Tanda Tangan Serah Terima Digital di HP Supir/Penerima"
                                      >
                                        <Lock className="w-3 h-3" />
                                        <span>{unlockingSj === sjNum ? 'Membuka...' : '🔓 Buka Kunci Terima'}</span>
                                      </button>
                                    );
                                  })()}
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/40 text-slate-500 text-xs font-medium border border-slate-800 cursor-not-allowed opacity-60"
                                  title="🔒 Surat Jalan terkunci. Syarat penerbitan: Tagihan Invoice harus 100% LUNAS terlebih dahulu."
                                >
                                  <Lock className="w-3 h-3 text-slate-500" />
                                  <span>Surat Jalan</span>
                                </button>
                              )}

                              {/* Void Action */}
                              {inv.status !== 'VOID' ? (
                                <button
                                  type="button"
                                  onClick={() => handleVoidInvoice(inv)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/30 transition-colors"
                                  title="Batalkan Invoice (Holding Fee 10% max Rp 1jt + Auto Catat Refund Bank Jago)"
                                >
                                  <X className="w-3 h-3 text-rose-400" />
                                  <span>Void</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedInvoice(inv);
                                    setDocumentModalType('CANCELLATION_NOTE');
                                    setIsDocModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/40 transition-colors"
                                  title="Cetak Surat Keterangan Batal & Refund (Credit Note)"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Credit Note</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(inv)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 transition-colors"
                                title="Edit rincian unit, diskon, termin pembayaran, atau data ekspedisi"
                              >
                                <Pencil className="w-3 h-3 text-amber-400" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteInvoice(inv)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                                title="Hapus Invoice Ini"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT OFFICIAL DOCUMENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-950 border border-amber-800 text-amber-400">
                  {editingInvoice ? <Pencil className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </span>
                <div>
                  <h3 className="text-base font-black text-white">
                    {editingInvoice
                      ? `Edit Transaksi: ${editingInvoice.invoiceNumber || editingInvoice.quotationNumber}`
                      : 'Penerbitan Dokumen Legal Resmi BBKitchen'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingInvoice
                      ? 'Sesuaikan rincian unit, harga kesepakatan, tahap pembayaran (termin), atau data ekspedisi.'
                      : 'Mendukung multi-unit, pencarian otomatis stok live, pembayaran bertahap, dan pengiriman opsional.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingInvoice(null);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDocument} className="space-y-5 text-xs">
              {/* 1. DOCUMENT TYPE SELECTOR (ONLY QUOTATION & INVOICE) */}
              <div>
                <label className="block text-slate-400 font-bold mb-1.5 uppercase text-[10px] tracking-wider">
                  Pilih Format Dokumen:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormDocType('QUOTATION')}
                    className={`p-3 rounded-xl font-bold border text-center transition-all ${
                      formDocType === 'QUOTATION'
                        ? 'bg-blue-500 text-white border-blue-400 shadow-md shadow-blue-500/20'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    <span className="block text-sm">📋 Surat Penawaran (Quotation)</span>
                    <span className="block text-[10px] font-normal text-blue-200 mt-0.5">
                      Buka estimasi harga awal tanpa status lunas / belum lunas
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormDocType('INVOICE')}
                    className={`p-3 rounded-xl font-bold border text-center transition-all ${
                      formDocType === 'INVOICE'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    <span className="block text-sm">📄 Faktur Tagihan Resmi (Invoice)</span>
                    <span className="block text-[10px] font-normal text-amber-950 mt-0.5">
                      Deal harga sah, pembayaran bertahap (termin) &amp; rekening Jago
                    </span>
                  </button>
                </div>
              </div>

              {/* 2. CUSTOMER & DESTINATION INFO */}
              <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-3">
                <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px] block">
                  👤 Informasi Pembeli & Alamat Pengiriman
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      📅 Tanggal Dokumen *
                    </label>
                    <input
                      type="date"
                      required
                      value={formIssueDate}
                      onChange={(e) => setFormIssueDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:ring-1 focus:ring-amber-500 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Nama Pembeli / Owner Resto *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Bpk. Hendra (Resto Padang Sederhana)"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      No. WhatsApp Pembeli *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="0812-xxxx-xxxx"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:ring-1 focus:ring-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Alamat Lengkap Pengiriman / Restoran (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Jl. Boulevard Gading Serpong Blok M5 No. 12, Tangerang"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* 3. MULTI-UNIT ITEMS BUILDER (MANUAL / AUTO-FILL DARI STOK) */}
              <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px] block">
                      📦 Rincian Unit Barang ({itemRows.length} Baris)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Bisa ketik nama unit bebas (manual) atau ketik kode SKU untuk auto-fill dari stok.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addItemRow('', '')}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg font-bold text-[11px] border border-amber-500/30 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tambah Baris Unit</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {itemRows.map((row, index) => (
                    <div
                      key={row.id}
                      className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400">
                          Unit Barang #{index + 1}
                        </span>
                        {itemRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(row.id)}
                            className="text-slate-500 hover:text-rose-400 p-1"
                            title="Hapus baris unit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        {/* Product Title Input */}
                        <div className="sm:col-span-6">
                          <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                            Nama Unit / Deskripsi Barang *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Contoh: Chiller 2 Pintu Sanden 1.2m Rekondisi Prima..."
                            value={row.description}
                            onChange={(e) => updateItemRow(row.id, 'description', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:ring-1 focus:ring-amber-500 font-medium"
                          />
                        </div>

                        {/* SKU Search Input */}
                        <div className="sm:col-span-3 relative">
                          <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                            Kode SKU (Opsional)
                          </label>
                          <input
                            type="text"
                            placeholder="BBK-xxx"
                            value={row.sku}
                            onChange={(e) => handleSearchSku(row.id, e.target.value.toUpperCase())}
                            onFocus={() => {
                              if (row.sku.length >= 2) handleSearchSku(row.id, row.sku);
                            }}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-amber-400 font-mono text-xs focus:ring-1 focus:ring-amber-500"
                          />

                          {/* Autocomplete Dropdown List */}
                          {activeSearchRowId === row.id && searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-800">
                              {searchResults.map((item) => (
                                <button
                                  key={item.SKU}
                                  type="button"
                                  onClick={() => handleSelectSearchedItem(row.id, item)}
                                  className="w-full text-left p-2 hover:bg-slate-800 flex items-center justify-between gap-2 transition-colors"
                                >
                                  <div className="truncate">
                                    <div className="font-mono font-bold text-amber-400 text-[11px]">
                                      {item.SKU} • {item.asal_gudang || item.LOKASI_UNIT}
                                    </div>
                                    <div className="text-[10px] text-slate-200 truncate">
                                      {item.PRODUCT_TITLE}
                                    </div>
                                  </div>
                                  <span className="font-mono text-emerald-400 font-bold text-[10px] whitespace-nowrap">
                                    {item.HARGA_BUKA_WA ? formatIDR(item.HARGA_BUKA_WA) : 'Cek Harga'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Qty Input */}
                        <div className="sm:col-span-1">
                          <label className="block text-[10px] text-slate-400 font-semibold mb-0.5 text-center">
                            Qty *
                          </label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={row.quantity}
                            onChange={(e) => updateItemRow(row.id, 'quantity', Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-bold text-xs text-center focus:ring-1 focus:ring-amber-500"
                          />
                        </div>

                        {/* Unit Price */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                            Harga Jual (Rp) *
                          </label>
                          <input
                            type="number"
                            required
                            placeholder="0"
                            value={row.unitPrice || ''}
                            onChange={(e) => updateItemRow(row.id, 'unitPrice', Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 font-mono font-bold text-xs focus:ring-1 focus:ring-amber-500 text-right"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. FINANCIAL SUMMARY */}
              <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-4">
                <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px] block">
                  💰 Ringkasan Finansial {formDocType === 'QUOTATION' ? 'Penawaran' : 'Kesepakatan'}
                </span>

                <div className={`grid grid-cols-1 ${hasShippingDetails && shippingFeeType === 'INCLUDED' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                      Subtotal Unit:
                    </label>
                    <div className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-mono font-bold text-xs">
                      {formatIDR(calculatedSubtotal)}
                    </div>
                  </div>

                  {hasShippingDetails && shippingFeeType === 'INCLUDED' && (
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                        Ongkos Kirim (Include):
                      </label>
                      <div className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-emerald-400 font-mono font-bold text-xs">
                        + {formatIDR(shippingNum)}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                      Diskon Kesepakatan:
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-rose-400 font-mono font-bold text-xs focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                      {formDocType === 'QUOTATION' ? 'Total Penawaran:' : 'Total Tagihan Invoice:'}
                    </label>
                    <div className="px-3 py-2 bg-slate-900 border border-amber-500/40 rounded-xl text-amber-400 font-mono font-black text-sm">
                      {formatIDR(calculatedTotal)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. MULTI-PAYMENT TERMINS (RULE 2: KOLOM PEMBAYARAN 1, DST SAMPAI LUNAS - HANYA UNTUK INVOICE) */}
              {formDocType === 'INVOICE' && (
                <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div>
                      <span className="font-bold text-emerald-400 uppercase tracking-wider text-[10px] block">
                        💳 Riwayat Tahap Pembayaran / Termin ({payments.length} Tahap)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Catat Pembayaran 1 (DP), Pembayaran 2, dst hingga invoice lunas.
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={addPaymentRow}
                        className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg font-bold text-[11px] border border-emerald-500/30 flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Tambah Pembayaran {payments.length + 1}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickLunas(calculatedTotal)}
                        className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg font-black text-[11px] shadow transition-colors"
                        title="Set langsung 1 pembayaran 100% LUNAS"
                      >
                        ⚡ Set Langsung Lunas
                      </button>
                    </div>
                  </div>

                  {/* Payments Rows */}
                  <div className="space-y-3">
                    {payments.map((pm, pIndex) => (
                      <div
                        key={pm.id || pIndex}
                        className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                            <CreditCard className="w-3.5 h-3.5" />
                            Tahap #{pIndex + 1}: {pm.label || `Pembayaran ${pIndex + 1}`}
                          </span>
                          {payments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePaymentRow(pm.id)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                              title="Hapus tahap pembayaran ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          {/* Label (e.g. Pembayaran 1 (DP), Pembayaran 2) */}
                          <div className="sm:col-span-4">
                            <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                              Keterangan Pembayaran
                            </label>
                            <input
                              type="text"
                              value={pm.label}
                              onChange={(e) => updatePaymentRow(pm.id, 'label', e.target.value)}
                              placeholder={`Pembayaran ${pIndex + 1}`}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:ring-1 focus:ring-emerald-500 font-medium"
                            />
                          </div>

                          {/* Date */}
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                              Tanggal Pembayaran
                            </label>
                            <input
                              type="date"
                              value={pm.date || ''}
                              onChange={(e) => updatePaymentRow(pm.id, 'date', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:ring-1 focus:ring-emerald-500 font-mono"
                            />
                          </div>

                          {/* Nominal Amount */}
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                              Nominal Masuk (Rp) *
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={pm.amount || ''}
                              onChange={(e) => updatePaymentRow(pm.id, 'amount', Number(e.target.value))}
                              placeholder="0"
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-emerald-500/40 rounded-lg text-emerald-400 font-mono font-bold text-xs focus:ring-1 focus:ring-emerald-500 text-right"
                            />
                          </div>

                          {/* Method */}
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                              Metode
                            </label>
                            <select
                              value={pm.method || 'TRANSFER_JAGO_SYARIAH'}
                              onChange={(e) => updatePaymentRow(pm.id, 'method', e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-[11px] focus:ring-1 focus:ring-emerald-500"
                            >
                              <option value="TRANSFER_JAGO_SYARIAH">Transfer Bank Jago</option>
                              <option value="CASH_PICKUP">Tunai / Pick-up</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Payment Balance Calculation Card */}
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Total Pembayaran Masuk:</span>
                        <span className="font-mono font-bold text-emerald-400 text-xs">{formatIDR(totalPaid)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Sisa Tagihan Pelunasan:</span>
                        <span className={`font-mono font-bold text-xs ${calculatedSisa > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {formatIDR(calculatedSisa)}
                        </span>
                      </div>
                    </div>

                    <div>
                      {isFormFullyPaid ? (
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500 rounded-full font-bold text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Status: LUNAS SEPENUHNYA (Surat Jalan Terbuka)</span>
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500 rounded-full font-bold text-xs flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Status: BELUM LUNAS (Surat Jalan Terkunci)</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 6. OPTIONAL SHIPPING DETAILS (RULE 5: PENGIRIMAN ADALAH OPSI OPSIONAL) */}
              {formDocType === 'INVOICE' && (
                <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasShippingDetails}
                        onChange={(e) => setHasShippingDetails(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                      <span className="font-bold text-slate-200 text-xs">
                        🚚 Tambahkan Rincian &amp; Biaya Pengiriman (Opsional)
                      </span>
                    </label>
                    <span className="text-[10px] text-slate-500">
                      {hasShippingDetails ? 'Aktif' : 'Nonaktif (Tanpa Pengiriman)'}
                    </span>
                  </div>

                  {hasShippingDetails && (
                    <div className="space-y-3 pt-2 border-t border-slate-800">
                      <label className="block text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                        Ketentuan Ongkos Kirim:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setShippingFeeType('BUYER_COD')}
                          className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                            shippingFeeType === 'BUYER_COD'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="font-bold">🚚 Bayar Sendiri / COD</div>
                          <div className="text-[10px] opacity-80 mt-0.5">Ditanggung pembeli ke kurir</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShippingFeeType('INCLUDED')}
                          className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                            shippingFeeType === 'INCLUDED'
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="font-bold">🧾 Include Tagihan</div>
                          <div className="text-[10px] opacity-80 mt-0.5">Masuk ke total Invoice</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShippingFeeType('FREE_PROMO')}
                          className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                            shippingFeeType === 'FREE_PROMO'
                              ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="font-bold">🎁 Free Ongkir</div>
                          <div className="text-[10px] opacity-80 mt-0.5">Gratis subsidi BBKitchen</div>
                        </button>
                      </div>

                      {shippingFeeType === 'INCLUDED' && (
                        <div>
                          <label className="block text-[10px] text-emerald-400 font-semibold mb-1">
                            Nominal Ongkir yang Ditagihkan (Rp):
                          </label>
                          <input
                            type="number"
                            placeholder="Contoh: 250000"
                            value={shippingFee}
                            onChange={(e) => setShippingFee(e.target.value)}
                            className="w-full sm:w-1/2 px-3 py-2 bg-slate-950 border border-emerald-500/50 rounded-xl text-emerald-400 font-mono font-bold text-xs focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                            Pilihan Ekspedisi:
                          </label>
                          <select
                            value={expeditionChoice}
                            onChange={(e) => setExpeditionChoice(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-xs"
                          >
                            {EXPEDITION_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                            Nama Driver / Kurir:
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: Pak Ujang"
                            value={deliveryDriver}
                            onChange={(e) => setDeliveryDriver(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                            No. Polisi Kendaraan:
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: B 9482 SXZ"
                            value={vehiclePlate}
                            onChange={(e) => setVehiclePlate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 font-mono text-xs"
                          />
                        </div>
                      </div>

                      {expeditionChoice === 'CUSTOM' && (
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                            Nama Ekspedisi Kustom:
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: Baraka Sarana Tama / Truk Ekspedisi"
                            value={customExpeditionText}
                            onChange={(e) => setCustomExpeditionText(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 7. NOTES */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                  Catatan Tambahan Dokumen (Opsional):
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Garansi fungsi 7 hari, serah-terima unit di gudang Tangerang"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingInvoice(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-950/50 flex items-center gap-1.5"
                >
                  {editingInvoice ? (
                    <>
                      <Pencil className="w-4 h-4" />
                      <span>Simpan Perubahan Dokumen</span>
                    </>
                  ) : (
                    <span>Simpan &amp; Lihat Dokumen</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL DOCUMENT PRINT & PREVIEW MODAL */}
      {selectedInvoice && (
        <OfficialDocumentModal
          invoice={selectedInvoice}
          isOpen={isDocModalOpen}
          initialType={documentModalType}
          onClose={() => setIsDocModalOpen(false)}
        />
      )}
    </div>
  );
}
