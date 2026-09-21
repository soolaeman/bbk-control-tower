import {
  MasterInventoryItem,
  InventoryFilterOptions,
  PaginatedInventoryResponse,
  UnitStatus,
  PipelineStatus,
  WarehouseCode,
  GuardrailStatus,
} from '@/lib/types/inventory';
import { UserRole, ROLE_PERMISSIONS } from '@/lib/types/auth';
import { resolveLocationFromCode } from './warehouse-utils';
import { fetchAllTursoMasterItems } from './turso-inventory-repository';

// Official commercial kitchen equipment categories in Bukan Baru Kitchen
const CATEGORIES = [
  { slug: 'meja-stainless', name: 'Meja Stainless', keyword: 'meja stainless bekas restoran' },
  { slug: 'sink-stainless', name: 'Sink Stainless', keyword: 'sink cuci piring stainless bekas' },
  { slug: 'kompor', name: 'Kompor & Cooking', keyword: 'kompor resto heavy duty bekas' },
  { slug: 'chiller', name: 'Chiller', keyword: 'chiller stainless bekas restoran' },
  { slug: 'freezer', name: 'Freezer', keyword: 'upright freezer bekas resto' },
  { slug: 'showcase', name: 'Showcase', keyword: 'showcase display cake bekas' },
  { slug: 'rak-stainless', name: 'Rak Stainless', keyword: 'rak stainless susun bekas' },
  { slug: 'hood-stainless', name: 'Hood Stainless & Exhaust', keyword: 'exhaust hood stainless resto' },
  { slug: 'ice-system', name: 'Ice System & Maker', keyword: 'mesin ice maker bekas resto' },
  { slug: 'peralatan-dapur-bekas-lainnya', name: 'Peralatan Dapur Lainnya', keyword: 'peralatan dapur bekas restoran' },
];

const BRANDS = [
  'Rational', 'Unox', 'Hobart', 'Hoshizaki', 'Berjaya', 'Nayati', 'Fagor',
  'Williams', 'Kolb', 'Winterhalter', 'Sirman', 'Santos', 'La Marzocco',
  'Nuova Simonelli', 'Gea', 'Crown', 'Mastro', 'Electrolux Professional'
];

const WAREHOUSES: WarehouseCode[] = ['BK', 'GK', 'BB', 'SM', 'BL', 'ML', 'RB', 'KG', 'PY', 'PE', 'SK', 'WT', 'ON', 'RK'];

const CONDITIONS = [
  'Bekas Resto Bintang 5 (95% Mulus)',
  'Rekondisi Prima Siap Pakai (90%)',
  'Unit Display Cafe (Like New 98%)',
  'Bekas Hotel Siap Kerja (85%)',
  'Service Standar BBK Certified (90%)',
];

// Helper to generate deterministic sample data
function generateMasterInventory(count = 2750): MasterInventoryItem[] {
  const items: MasterInventoryItem[] = [];
  const baseDate = new Date(2026, 7, 27); // Aug 27, 2026

  for (let i = 1; i <= count; i++) {
    const brand = BRANDS[i % BRANDS.length];
    const cat = CATEGORIES[i % CATEGORIES.length];
    const wh = WAREHOUSES[i % WAREHOUSES.length];
    const cond = CONDITIONS[i % CONDITIONS.length];

    // SKU Format: BBK-WH-CAT-0001
    const whPrefix = wh;
    const catCode = cat.slug.slice(0, 3).toUpperCase();
    const numPad = String(i).padStart(4, '0');
    const sku = `BBK-${whPrefix}-${catCode}-${numPad}`;

    // Pipeline & Unit Status
    let statusUnit: UnitStatus = 'AVAILABLE';
    let statusPipeline: PipelineStatus = 'PUBLISHED';
    let isDirty = false;
    const dirtyReasons: string[] = [];

    // Realistic operational distribution
    if (i % 7 === 0) {
      statusUnit = 'SOLD';
      statusPipeline = 'PUBLISHED';
    } else if (i % 29 === 0) {
      statusPipeline = 'ERROR';
      isDirty = true;
      dirtyReasons.push('Dimensi listrik tidak valid atau metadata terpotong');
    } else if (i % 23 === 0) {
      statusPipeline = 'NO_PHOTOS_FOUND';
      isDirty = true;
      dirtyReasons.push('Foto di Telegram belum ditemukan / parsing gagal');
    } else if (i % 17 === 0) {
      statusPipeline = 'PENDING_PHOTOS';
    } else if (i % 13 === 0) {
      statusPipeline = 'READY_TO_PUBLISH';
    } else if (i % 41 === 0) {
      statusPipeline = 'AMBIGUOUS';
      statusUnit = 'AMBIGUOUS';
      isDirty = true;
      dirtyReasons.push('Data duplikat terdeteksi pada baris sheets lama');
    } else if (i % 50 === 0) {
      statusPipeline = 'SKIP: NO IMAGE';
    }

    // Days in inventory calculation
    const daysAgo = (i * 3) % 180 + 2;
    const masukDate = new Date(baseDate);
    masukDate.setDate(masukDate.getDate() - daysAgo);
    const tanggalMasuk = masukDate.toISOString().split('T')[0];

    let tanggalTerjual: string | null = null;
    let durasiTerjual: number | null = null;

    if (statusUnit === 'SOLD') {
      const soldDaysAfter = Math.min(daysAgo, (i * 7) % 60 + 5);
      const terjualDate = new Date(masukDate);
      terjualDate.setDate(terjualDate.getDate() + soldDaysAfter);
      tanggalTerjual = terjualDate.toISOString().split('T')[0];
      durasiTerjual = soldDaysAfter;
    }

    // Commercial pricing formula
    const baseModal = 5000000 + ((i * 1370000) % 65000000);
    const hargaModal = Math.round(baseModal / 100000) * 100000;
    const marginFloorRate = 0.25; // 25% min margin
    const marginDealRate = 0.35; // 35% target margin
    const marginBukaRate = 0.48; // 48% opening quote

    const hargaFloorWA = Math.round((hargaModal * (1 + marginFloorRate)) / 100000) * 100000;
    const hargaDealWA = Math.round((hargaModal * (1 + marginDealRate)) / 100000) * 100000;
    const hargaBukaWA = Math.round((hargaModal * (1 + marginBukaRate)) / 100000) * 100000;
    const hargaEstimasiPublik = hargaBukaWA;

    const marginFloor = hargaFloorWA - hargaModal;
    const marginDeal = hargaDealWA - hargaModal;

    let guardrailStatus: GuardrailStatus = 'SAFE';
    if (i % 37 === 0) {
      guardrailStatus = 'WARNING';
    }

    const title = `${brand} ${cat.name} ${cond.includes('95%') ? 'Prima 95%' : 'Heavy Duty'} (${sku})`;
    const seoTitle = `Jual ${brand} ${cat.name} Bekas Restoran Jakarta Tangsel | BBKitchen ${sku}`;

    const location = resolveLocationFromCode(wh);

    // Photos
    const featuredImg = `https://picsum.photos/seed/bbk_${sku}/800/600`;
    const photoUrls = [
      featuredImg,
      `https://picsum.photos/seed/bbk_${sku}_2/800/600`,
      `https://picsum.photos/seed/bbk_${sku}_3/800/600`,
    ];

    items.push({
      SKU: sku,
      PRODUCT_TITLE: title,
      SEO_TITLE: seoTitle,
      CATEGORY_SLUG: cat.slug,
      CATEGORY_NAME: cat.name,
      STATUS_UNIT: statusUnit,
      STATUS_PIPELINE: statusPipeline,
      LOKASI_UNIT: location,
      KONDISI_UNIT: cond,
      SHORT_DESCRIPTION: `Unit ${brand} ${cat.name} kondisi siap pakai untuk restoran, cafe, hotel, dan catering. Telah melalui 12 titik inspeksi teknis BBKitchen di ${location}.`,
      FULL_DESCRIPTION: `<p><strong>${brand} ${cat.name}</strong> rekondisi premium standar BBKitchen. Unit asli ex-restoran terkemuka dengan performa handal dan konsumsi daya optimal.</p><p>Setiap pembelian unit di Bukan Baru Kitchen mendapatkan garansi operasional 30 hari, gratis konsultasi layout dapur, dan dukungan teknisi panggilan jabodetabek.</p>`,
      SPESIFIKASI: {
        'Merk / Brand': brand,
        'Kategori': cat.name,
        'Daya Listrik / Gas': i % 2 === 0 ? `${(i % 5 + 1) * 1500} Watt, 220V/50Hz` : 'LPG Heavy Duty High Pressure',
        'Dimensi (PxLxT)': `${700 + (i % 8) * 100} x ${600 + (i % 4) * 100} x ${850 + (i % 6) * 150} mm`,
        'Material Body': 'Stainless Steel AISI 304 Food Grade',
        'Kondisi Fisik': cond,
        'Lokasi Gudang': location,
        'Garansi Unit': 'Garansi Servis BBKitchen 30 Hari',
      },
      YOAST_KEYWORD: `${brand.toLowerCase()} ${cat.slug} bekas`,
      YOAST_DESCRIPTION: `Beli ${brand} ${cat.name} bekas berkualitas di Bukan Baru Kitchen. Garansi servis, siap kirim Jabodetabek. Lokasi gudang di ${location}. Hubungi WhatsApp kami.`,
      FEATURED_IMAGE: featuredImg,
      PHOTO_URLS: photoUrls,
      TANGGAL_MASUK: tanggalMasuk,
      TANGGAL_TERJUAL: tanggalTerjual,
      DURASI_TERJUAL: durasiTerjual,
      PRODUCT_ID: 10000 + i,
      IS_DIRTY: isDirty,
      image_alt: `${brand} ${cat.name} bekas siap pakai BBKitchen ${sku}`,
      image_title: `${brand} ${cat.name} - BBKitchen`,
      image_caption: `Unit ${brand} di gudang ${location}`,
      image_description: `Foto asli unit ${sku} ${brand} kondisi ${cond}`,
      asal_gudang: wh,
      HARGA_ESTIMASI_PUBLIK: hargaEstimasiPublik,

      // Internal fields
      HARGA_MODAL: hargaModal,
      HARGA_BUKA_WA: hargaBukaWA,
      HARGA_DEAL_WA: hargaDealWA,
      HARGA_FLOOR_WA: hargaFloorWA,
      MARGIN_FLOOR: marginFloor,
      MARGIN_DEAL: marginDeal,
      STATUS_GUARDRAIL: guardrailStatus,
      LINK_TELEGRAM: `https://t.me/c/1837492019/supp_${wh}_${numPad}`,
      LINK_UNIT: `https://bukanbarukitchen.com/product/${sku.toLowerCase()}`,
      supplier_code: `SRC-${wh}-${numPad.slice(0, 2)}XX`,
      internal_notes: `Inspeksi QC passed. Unit masuk dari lelang hotel partner. Thermostat & seal pintu baru.`,
      dirty_reasons: dirtyReasons,
      last_pipeline_update: new Date(baseDate.getTime() - (i % 10) * 86400000).toISOString(),
    });
  }

  return items;
}

// Global in-memory singleton for fast execution
let cachedInventory: MasterInventoryItem[] | null = null;

export function getRawMasterInventory(): MasterInventoryItem[] {
  if (!cachedInventory) {
    cachedInventory = generateMasterInventory(2750);
  }
  return cachedInventory;
}

export async function getLiveMasterInventory(role?: UserRole): Promise<MasterInventoryItem[]> {
  try {
    const items = await fetchAllTursoMasterItems(role);
    if (items && items.length > 0) {
      cachedInventory = items;
      return items;
    }
  } catch (err) {
    console.warn('Turso live inventory fetch warning:', err);
  }

  return getRawMasterInventory();
}

export function getMasterInventory(): MasterInventoryItem[] {
  return getRawMasterInventory();
}

/**
 * Server-side RBAC Data Masking
 * Strips out strictly sensitive fields before sending to unauthorized users or client-side.
 */
export function maskItemForRole(item: MasterInventoryItem, role?: UserRole): MasterInventoryItem {
  const permissions = role ? ROLE_PERMISSIONS[role] : {
    canViewInternalCost: false,
    canViewFloorPrice: false,
    canViewDealPrice: false,
    canViewTelegramLink: false,
    canViewSupplierData: false,
    isInvestorRestricted: true,
  };

  const copy = { ...item };

  if (!permissions.canViewInternalCost) {
    delete copy.HARGA_MODAL;
  }
  if (!permissions.canViewFloorPrice) {
    delete copy.HARGA_FLOOR_WA;
    delete copy.MARGIN_FLOOR;
  }
  if (!permissions.canViewDealPrice && role !== 'OPERATOR' && role !== 'ADMIN' && role !== 'FINANCE') {
    delete copy.HARGA_DEAL_WA;
    delete copy.MARGIN_DEAL;
  }
  if (!permissions.canViewTelegramLink) {
    delete copy.LINK_TELEGRAM;
  }
  if (!permissions.canViewSupplierData || permissions.isInvestorRestricted) {
    delete copy.supplier_code;
    delete copy.internal_notes;
  }

  return copy;
}

/**
 * High-performance repository query with filtering, sorting, pagination, and RBAC
 */
export function queryInventory(
  options: InventoryFilterOptions = {},
  role?: UserRole
): PaginatedInventoryResponse {
  const allItems = getRawMasterInventory();

  let filtered = allItems;

  if (options.search) {
    const q = options.search.toLowerCase().trim();
    filtered = filtered.filter(
      (item) =>
        item.SKU.toLowerCase().includes(q) ||
        item.PRODUCT_TITLE.toLowerCase().includes(q) ||
        item.CATEGORY_NAME.toLowerCase().includes(q) ||
        item.LOKASI_UNIT.toLowerCase().includes(q)
    );
  }

  if (options.category && options.category !== 'ALL') {
    filtered = filtered.filter((item) => item.CATEGORY_SLUG === options.category);
  }

  if (options.location && options.location !== 'ALL') {
    filtered = filtered.filter((item) => item.LOKASI_UNIT.includes(options.location!));
  }

  if (options.warehouse && options.warehouse !== 'ALL') {
    filtered = filtered.filter((item) => item.asal_gudang === options.warehouse);
  }

  if (options.condition && options.condition !== 'ALL') {
    filtered = filtered.filter((item) => item.KONDISI_UNIT.includes(options.condition!));
  }

  if (options.statusUnit && options.statusUnit !== 'ALL') {
    filtered = filtered.filter((item) => item.STATUS_UNIT === options.statusUnit);
  }

  if (options.statusPipeline && options.statusPipeline !== 'ALL') {
    if (options.statusPipeline === 'ALL_EXCEPTIONS') {
      filtered = filtered.filter(
        (item) =>
          item.STATUS_PIPELINE === 'ERROR' ||
          item.STATUS_PIPELINE === 'NO_PHOTOS_FOUND' ||
          item.STATUS_PIPELINE === 'AMBIGUOUS' ||
          item.STATUS_PIPELINE === 'PENDING_PHOTOS' ||
          item.IS_DIRTY ||
          !item.FEATURED_IMAGE
      );
    } else if (options.statusPipeline === 'NO_PHOTOS_FOUND') {
      filtered = filtered.filter(
        (item) =>
          item.STATUS_PIPELINE === 'NO_PHOTOS_FOUND' ||
          item.STATUS_PIPELINE === 'PENDING_PHOTOS' ||
          !item.FEATURED_IMAGE
      );
    } else if (options.statusPipeline === 'ERROR') {
      filtered = filtered.filter(
        (item) => item.STATUS_PIPELINE === 'ERROR' || item.IS_DIRTY
      );
    } else {
      filtered = filtered.filter((item) => item.STATUS_PIPELINE === options.statusPipeline);
    }
  }

  if (options.guardrailStatus && options.guardrailStatus !== 'ALL') {
    filtered = filtered.filter((item) => item.STATUS_GUARDRAIL === options.guardrailStatus);
  }

  if (options.isDirty !== undefined) {
    filtered = filtered.filter((item) => item.IS_DIRTY === options.isDirty);
  }

  if (options.minPrice !== undefined) {
    filtered = filtered.filter(
      (item) => item.HARGA_ESTIMASI_PUBLIK != null && item.HARGA_ESTIMASI_PUBLIK >= options.minPrice!
    );
  }

  if (options.maxPrice !== undefined) {
    filtered = filtered.filter(
      (item) => item.HARGA_ESTIMASI_PUBLIK != null && item.HARGA_ESTIMASI_PUBLIK <= options.maxPrice!
    );
  }

  // Calculate high-level stats from the total filtered or all items
  const stats = {
    totalUnits: allItems.length,
    availableUnits: allItems.filter((i) => i.STATUS_UNIT === 'AVAILABLE').length,
    soldUnits: allItems.filter((i) => i.STATUS_UNIT === 'SOLD').length,
    pendingPhotos: allItems.filter(
      (i) => i.STATUS_PIPELINE === 'PENDING_PHOTOS' || i.STATUS_PIPELINE === 'NO_PHOTOS_FOUND' || !i.FEATURED_IMAGE
    ).length,
    readyToPublish: allItems.filter((i) => i.STATUS_PIPELINE === 'READY_TO_PUBLISH').length,
    published: allItems.filter((i) => i.STATUS_PIPELINE === 'PUBLISHED').length,
    errors: allItems.filter((i) => i.STATUS_PIPELINE === 'ERROR' || i.IS_DIRTY).length,
    ambiguous: allItems.filter((i) => i.STATUS_PIPELINE === 'AMBIGUOUS' || i.STATUS_UNIT === 'AMBIGUOUS').length,
    dirtyCount: allItems.filter((i) => i.IS_DIRTY).length,
  };

  // Sorting
  const sortBy = options.sortBy || 'TANGGAL_MASUK';
  const sortOrder = options.sortOrder || 'desc';

  filtered.sort((a, b) => {
    let valA = a[sortBy as keyof MasterInventoryItem];
    let valB = b[sortBy as keyof MasterInventoryItem];

    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    }

    return 0;
  });

  // Pagination
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(5, Math.min(100, options.pageSize || 25));
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const offset = (page - 1) * pageSize;
  const paginatedItems = filtered.slice(offset, offset + pageSize);

  // Apply server-side RBAC masking
  const maskedItems = paginatedItems.map((item) => maskItemForRole(item, role));

  return {
    items: maskedItems,
    total,
    page,
    pageSize,
    totalPages,
    stats,
  };
}

/**
 * Mark a unit as sold with audit timestamps
 */
export function markUnitAsSold(
  sku: string,
  dealPrice?: number,
  notes?: string
): { success: boolean; item?: MasterInventoryItem; error?: string } {
  const inventory = getRawMasterInventory();
  const index = inventory.findIndex((i) => i.SKU.toLowerCase() === sku.toLowerCase());

  if (index === -1) {
    return { success: false, error: `SKU ${sku} not found in inventory` };
  }

  const existing = inventory[index];
  const today = new Date().toISOString().split('T')[0];
  const masuk = new Date(existing.TANGGAL_MASUK);
  const now = new Date();
  const diffDays = Math.max(1, Math.floor((now.getTime() - masuk.getTime()) / (1000 * 60 * 60 * 24)));

  existing.STATUS_UNIT = 'SOLD';
  existing.TANGGAL_TERJUAL = today;
  existing.DURASI_TERJUAL = diffDays;
  if (dealPrice) {
    existing.HARGA_DEAL_WA = dealPrice;
    if (existing.HARGA_MODAL) {
      existing.MARGIN_DEAL = dealPrice - existing.HARGA_MODAL;
    }
  }
  if (notes) {
    existing.internal_notes = `${existing.internal_notes || ''} [SOLD: ${notes}]`;
  }

  return { success: true, item: existing };
}

/**
 * Pipeline Exception Quick Actions
 */
export function updatePipelineStatus(
  sku: string,
  newStatus: PipelineStatus,
  clearDirty = true
): boolean {
  const inventory = getRawMasterInventory();
  const item = inventory.find((i) => i.SKU.toLowerCase() === sku.toLowerCase());
  if (!item) return false;

  item.STATUS_PIPELINE = newStatus;
  if (clearDirty) {
    item.IS_DIRTY = false;
    item.dirty_reasons = [];
  }
  item.last_pipeline_update = new Date().toISOString();
  return true;
}

/**
 * Update SEO metadata for a specific SKU
 */
export function updateItemSEOMetadata(
  sku: string,
  metadata: {
    yoastKeyword?: string;
    seoTitle?: string;
    yoastDescription?: string;
    imageAlt?: string;
  }
): boolean {
  const inventory = getRawMasterInventory();
  const item = inventory.find((i) => i.SKU.toLowerCase() === sku.toLowerCase());
  if (!item) return false;

  if (metadata.yoastKeyword) item.YOAST_KEYWORD = metadata.yoastKeyword;
  if (metadata.seoTitle) item.SEO_TITLE = metadata.seoTitle;
  if (metadata.yoastDescription) item.YOAST_DESCRIPTION = metadata.yoastDescription;
  if (metadata.imageAlt) item.image_alt = metadata.imageAlt;
  item.last_pipeline_update = new Date().toISOString();
  return true;
}

/**
 * Public & Server helper alias
 */
export const getMasterInventoryItems = queryInventory;

