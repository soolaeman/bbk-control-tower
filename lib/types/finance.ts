// Finance, Invoicing, and Deal Ledger Domain Types for Bukan Baru Kitchen (BBKitchen)

export type InvoiceStatus =
  | 'DRAFT'
  | 'GENERATING'
  | 'GENERATED'
  | 'SENT'
  | 'DP_PAID'
  | 'PAID'
  | 'VOID'
  | 'ERROR';

export type DocumentType =
  | 'INVOICE'           // Faktur Penagihan Resmi
  | 'QUOTATION'         // Surat Penawaran Harga Komersial (1x24 Jam)
  | 'DELIVERY_NOTE'     // Surat Jalan & Tanda Terima Ekspedisi/Driver (Hanya saat LUNAS)
  | 'WARRANTY'          // Kartu Garansi Resmi (E-Warranty)
  | 'CANCELLATION_NOTE'; // Nota Pembatalan / Credit Note (Ihsan & Ta'widh)

export type DocumentDeliveryStatus = 'NOT_SENT' | 'SENT' | 'OPENED';

export interface PaymentRecord {
  id: string;
  label: string; // e.g. "Pembayaran 1 (DP)", "Pembayaran 2", "Pembayaran 3 (Pelunasan)"
  amount: number;
  date: string;  // YYYY-MM-DD
  method?: 'TRANSFER_JAGO_SYARIAH' | 'CASH_PICKUP' | string;
  notes?: string;
}

export interface InvoiceItem {
  id: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number; // Internal HPP modal per unit (confidential, never exposed to customer/receipt)
  total: number;
  condition?: string;
  warehouseLocation?: string;
  asalGudang?: string;
  category?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  documentType?: DocumentType;
  kuitansiNumber?: string; // legacy support
  quotationNumber?: string;
  suratJalanNumber?: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  customerCompany?: string;
  orderReference?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  dpAmount?: number;
  remainingAmount?: number;
  payments?: PaymentRecord[]; // Riwayat pembayaran termin 1, 2, dst hingga lunas
  issueDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  validUntilDate?: string; // Untuk Quotation
  status: InvoiceStatus;
  paidDate?: string | null;
  paymentMethod?: 'TRANSFER_JAGO_SYARIAH' | 'TRANSFER_BCA' | 'TRANSFER_MANDIRI' | 'CASH_PICKUP' | 'WOOCOMMERCE_GATEWAY' | string;
  
  // Shipping & Delivery Details (Opsional dalam Invoice)
  hasShipping?: boolean;
  deliveryDriver?: string;
  driverPhone?: string;
  deliveryVehiclePlate?: string;
  deliveryExpedition?: string;
  shippingFeeType?: 'INCLUDED' | 'BUYER_COD' | 'FREE_PROMO' | 'NO_SHIPPING';
  shippingFee?: number;
  
  salesPic?: string;
  pdfUrl?: string;
  notes?: string;
  termsConditions?: string;
  storageDeadline?: string; // Counter sisa hari Free Storage (maks. 7 hari pasca-lunas)
  documentDeliveryStatus?: DocumentDeliveryStatus; // Not Sent | Sent | Opened ala Paper.id
  holdingFeeAmount?: number; // Ta'widh / Holding fee 10% max Rp 1.000.000
  refundAmount?: number; // Dana sisa DP yang ditransfer balik ke pembeli
  quotationExpiresAt?: string; // Masa berlaku Quotation 1x24 jam
  createdBy: string;
}

export interface ClosingDealItem {
  sku: string;
  productTitle: string;
  category?: string;
  tanggalMasuk?: string;
  tanggalTerjual?: string;
  durasiTerjual?: string | number;
  lokasiGudang: string;
  asalGudang?: string;
  quantity?: number; // Real physical unit count
  hargaModal: number;
  hargaClosing: number;
  realizedProfit: number;
  marginPercent: number;
  soldBy: 'SALES_BBK' | 'THIRD_PARTY';
  customerName?: string;
  notes?: string;
  isNonSku?: boolean;
  invoiceNumber?: string;
  invoiceId?: string;
  items?: InvoiceItem[];
  itemsCount?: number;
  rawInvoice?: Invoice;
}

export interface NonSkuTransaction {
  id: string;
  invoiceNumber: string;
  invoiceId?: string;
  tanggal: string; // YYYY-MM-DD
  itemTitle: string;
  skuTemp: string; // e.g. BBK-CUSTOM-3
  quantity: number;
  hppModal: number;
  hargaJual: number;
  realizedProfit: number;
  vendorBengkel?: string;
  customerName?: string;
  notes?: string;
  hubLocation?: string;
  warehouseCode?: string;
  category?: string;
  resolvedAt: string;
  resolvedBy: string;
}

export interface FinancialKPIs {
  period: string;
  totalRevenue: number;
  totalCOGS: number;
  grossMarginAmount: number;
  grossMarginPercentage: number;
  unitsSold: number;
  averageOrderValue: number;
  averageUnitMargin: number;
  outstandingInvoicesAmount: number;
  paidInvoicesAmount: number;
  inventoryAssetValue: number;
}

// ==========================================
// 7 Logic Gates Domain Records (PLAN-BBK-04)
// ==========================================

export interface WarrantyItemRecord {
  id: string;
  warrantyId: string;
  itemCode: string;
  itemName: string;
  itemCondition?: string;
  warrantyEligible: boolean; // Gate 2: True (1) untuk Pendingin & Kompor, False (0) untuk Stainless Meja/Rak/Sink
}

export interface WarrantyRecord {
  id: string;
  warrantyNumber: string; // GAR-YYYY-XXXXX
  invoiceNumber: string;
  poNumber?: string;
  customerName: string;
  customerCompany?: string;
  receivedAt: string; // Gate 3: Day 0 Timestamp dari delivered_at tanda tangan fisik E-POD
  warrantyExpiresAt: string; // Day 14 timestamp (H+14)
  publicExpiresAt: string; // Day 21 timestamp (H+21)
  status: 'ACTIVE' | 'EXPIRED' | 'ARCHIVED';
  items?: WarrantyItemRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryDispatchRecord {
  id: string;
  sjNumber: string; // SJ-BBK-YYYYMM-XXXX
  invoiceNumber: string;
  driverName?: string;
  driverPhone?: string;
  vehiclePlateReal?: string; // Gate 5: No Plat Fisik Real Mobil
  ktpPhotoUrl?: string;      // Gate 5: Foto KTP Supir
  platePhotoUrl?: string;    // Gate 5: Foto Plat Depan Mobil
  loadingPhotoUrl?: string;  // Gate 5: Foto Unit Terikat di Bak
  dispatchedAt?: string;
  isUnlockedForAcceptance: boolean; // Gate 6: Remote Acceptance Gate (Kunci TTD di HP Penerima)
  recipientNameAllowed?: string;
  recipientName?: string;
  recipientSignatureSvg?: string; // Gate 3 & 6: Tanda Tangan Jari Digital di Layar HP
  arrivalPhotoUrl?: string;
  deliveredAt?: string; // Gate 3: Day-0 Penguncian Garansi Resmi
}

export interface CancellationNote {
  id: string;
  invoiceNumber: string;
  customerName: string;
  cancelledAt: string;
  totalAmount: number;
  dpReceived: number;
  holdingFee: number; // Gate 7: 10% Capped at Rp 1.000.000 (Ta'widh Ruang Fisik Gudang)
  refundAmount: number; // Dana sisa DP yang ditransfer balik
  reason: string;
  approvedBy: string;
}

