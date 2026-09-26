import { createClient } from '@libsql/client';
import type {
  MasterInventoryItem,
  InventoryFilterOptions,
  PaginatedInventoryResponse,
  UnitStatus,
  PipelineStatus,
  WarehouseCode,
  GuardrailStatus,
} from '@/lib/types/inventory';
import { UserRole, RolePermissions, ROLE_PERMISSIONS } from '@/lib/types/auth';

const R2_BASE_URL = (
  process.env.NEXT_PUBLIC_R2_PHOTO_BASE_URL ||
  'https://pub-946d1fe1a1b1461eb2cca6be4462ba11.r2.dev'
).replace(/\/$/, '');

const TURSO_URL =
  process.env.TURSO_DATABASE_URL && !process.env.TURSO_DATABASE_URL.includes('bbk-soolaeman.aws-ap-northeast-1.turso.io')
    ? process.env.TURSO_DATABASE_URL
    : 'file:data/bbk.db';

const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || undefined;

let clientInstance: ReturnType<typeof createClient> | null = null;

export function getTursoClient() {
  if (!clientInstance) {
    clientInstance = createClient({
      url: TURSO_URL,
      authToken: TURSO_AUTH_TOKEN,
    });
  }
  return clientInstance;
}

export function maskItemForRole(
  item: MasterInventoryItem,
  role?: UserRole,
  customPermissions?: RolePermissions
): MasterInventoryItem {
  if (role === 'ADMIN') return item;

  const permissions: RolePermissions =
    customPermissions ||
    (role && (ROLE_PERMISSIONS as Record<string, RolePermissions>)[role]) || {
      canViewInternalCost: false,
      canViewFloorPrice: false,
      canViewDealPrice: false,
      canViewTelegramLink: false,
      canViewSupplierData: false,
      isInvestorRestricted: true,
      canMarkAsSold: false,
      canEditInventory: false,
      canManageInvoices: false,
      canViewFinanceReports: false,
      canEditSEO: false,
      canManageSocialMedia: false,
      canViewRawAnalytics: false,
      canAccessInvestorPortal: false,
    };

  const copy = { ...item };

  if (!permissions.canViewInternalCost) {
    delete copy.HARGA_MODAL;
  }
  if (!permissions.canViewFloorPrice) {
    delete copy.HARGA_FLOOR_WA;
    delete copy.MARGIN_FLOOR;
  }
  if (!permissions.canViewDealPrice) {
    delete copy.HARGA_DEAL_WA;
    delete copy.MARGIN_DEAL;
  }
  if (!permissions.canViewTelegramLink) {
    delete copy.LINK_TELEGRAM;
  }

  return copy;
}

export function mapRowToMasterItem(row: Record<string, any>): MasterInventoryItem {
  const sku = String(row.sku || '').trim();
  const photoUrlsStr = String(row.photo_urls || '');
  let imageCount = 1;
  if (photoUrlsStr) {
    const parts = photoUrlsStr.split(',').filter(Boolean);
    if (parts.length > 1) imageCount = parts.length;
  }

  const photoUrls: string[] = [];
  for (let i = 1; i <= imageCount; i++) {
    photoUrls.push(`${R2_BASE_URL}/${sku}_${i}.webp`);
  }

  const featuredImage = photoUrls[0] || '';

  const hargaModal = row.harga_modal ? Number(row.harga_modal) : undefined;
  const hargaBuka = row.harga_buka_wa ? Number(row.harga_buka_wa) : undefined;
  const hargaDeal = row.harga_deal_wa ? Number(row.harga_deal_wa) : undefined;
  const hargaFloor = row.harga_floor_wa ? Number(row.harga_floor_wa) : undefined;
  const marginFloor = row.margin_floor ? Number(row.margin_floor) : undefined;
  const marginDeal = row.margin_deal ? Number(row.margin_deal) : undefined;

  let statusUnit: UnitStatus = 'READY';
  const rawStatus = String(row.status_unit || '').trim().toUpperCase();
  if (rawStatus === 'SOLD') statusUnit = 'SOLD';
  else if (rawStatus === 'AVAILABLE' || rawStatus === 'READY') statusUnit = 'READY';
  else if (rawStatus === 'AMBIGUOUS') statusUnit = 'AMBIGUOUS';

  let statusPipeline: PipelineStatus = 'PUBLISHED';
  const rawPipe = String(row.status_pipeline || '').trim().toUpperCase();
  if (rawPipe.includes('ERROR')) statusPipeline = 'ERROR';
  else if (rawPipe.includes('NO_PHOTOS') || rawPipe.includes('NO IMAGE')) statusPipeline = 'NO_PHOTOS_FOUND';
  else if (rawPipe.includes('PENDING')) statusPipeline = 'PENDING_PHOTOS';
  else if (rawPipe.includes('READY')) statusPipeline = 'READY_TO_PUBLISH';
  else if (rawPipe.includes('AMBIGUOUS')) statusPipeline = 'AMBIGUOUS';

  return {
    SKU: sku,
    PRODUCT_TITLE: String(row.title || ''),
    SEO_TITLE: String(row.seo_title || ''),
    CATEGORY_SLUG: String(row.category_slug || ''),
    CATEGORY_NAME: String(row.child_name || row.parent_name || row.category_slug || 'Peralatan Dapur'),
    STATUS_UNIT: statusUnit,
    STATUS_PIPELINE: statusPipeline,
    LOKASI_UNIT: String(row.lokasi_unit || 'PAMULANG 2'),
    KONDISI_UNIT: String(row.kondisi_unit || 'BEKAS'),
    SHORT_DESCRIPTION: String(row.short_description || ''),
    FULL_DESCRIPTION: String(row.full_description || ''),
    SPESIFIKASI: {},
    YOAST_KEYWORD: String(row.yoast_keyword || ''),
    YOAST_DESCRIPTION: String(row.yoast_description || ''),
    FEATURED_IMAGE: featuredImage,
    PHOTO_URLS: photoUrls,
    TANGGAL_MASUK: String(row.tanggal_masuk || new Date().toISOString().split('T')[0]),
    TANGGAL_TERJUAL: row.tanggal_terjual ? String(row.tanggal_terjual) : null,
    DURASI_TERJUAL: row.durasi_terjual ? Number(row.durasi_terjual) : null,
    PRODUCT_ID: row.product_id_woo ? String(row.product_id_woo) : sku,
    IS_DIRTY: Boolean(row.is_dirty),
    image_alt: String(row.image_alt || ''),
    image_title: String(row.image_title || ''),
    image_caption: String(row.image_caption || ''),
    image_description: String(row.image_description || ''),
    asal_gudang: (row.asal_gudang as WarehouseCode) || 'PY',
    LINK_TELEGRAM: row.link_telegram ? String(row.link_telegram) : undefined,
    HARGA_ESTIMASI_PUBLIK: hargaBuka ?? null,
    HARGA_MODAL: hargaModal,
    HARGA_BUKA_WA: hargaBuka,
    HARGA_DEAL_WA: hargaDeal,
    HARGA_FLOOR_WA: hargaFloor,
    MARGIN_FLOOR: marginFloor,
    MARGIN_DEAL: marginDeal,
    STATUS_GUARDRAIL: (row.status_guardrail as GuardrailStatus) || 'SAFE',
    LINK_UNIT: row.link_unit ? String(row.link_unit) : undefined,
  };
}

export async function queryTursoInventory(
  options: InventoryFilterOptions,
  role?: UserRole,
  permissions?: RolePermissions
): Promise<PaginatedInventoryResponse> {
  const client = getTursoClient();

  const whereClauses: string[] = ['1=1'];
  const args: any[] = [];

  if (options.search) {
    const q = `%${options.search.trim()}%`;
    whereClauses.push('(p.sku LIKE ? OR p.title LIKE ? OR p.short_description LIKE ?)');
    args.push(q, q, q);
  }

  if (options.category && options.category !== 'ALL') {
    whereClauses.push('(p.category_slug = ? OR c.parent_slug = ?)');
    args.push(options.category, options.category);
  }

  if (options.location && options.location !== 'ALL') {
    whereClauses.push('p.lokasi_unit = ?');
    args.push(options.location);
  }

  if (options.warehouse && options.warehouse !== 'ALL') {
    whereClauses.push('p.asal_gudang = ?');
    args.push(options.warehouse);
  }

  if (options.condition && options.condition !== 'ALL') {
    whereClauses.push('p.kondisi_unit LIKE ?');
    args.push(`%${options.condition}%`);
  }

  if (options.statusUnit && options.statusUnit !== 'ALL') {
    whereClauses.push('p.status_unit = ?');
    args.push(options.statusUnit);
  }

  if (options.statusPipeline && options.statusPipeline !== 'ALL') {
    if (options.statusPipeline === 'ALL_EXCEPTIONS') {
      whereClauses.push(
        "(p.status_pipeline IN ('ERROR', 'NO_PHOTOS_FOUND', 'AMBIGUOUS', 'PENDING_PHOTOS') OR p.is_dirty = 1)"
      );
    } else if (options.statusPipeline === 'NO_PHOTOS_FOUND') {
      whereClauses.push("(p.status_pipeline IN ('NO_PHOTOS_FOUND', 'PENDING_PHOTOS'))");
    } else if (options.statusPipeline === 'ERROR') {
      whereClauses.push("(p.status_pipeline = 'ERROR' OR p.is_dirty = 1)");
    } else {
      whereClauses.push('p.status_pipeline = ?');
      args.push(options.statusPipeline);
    }
  }

  if (options.isDirty !== undefined) {
    whereClauses.push('p.is_dirty = ?');
    args.push(options.isDirty ? 1 : 0);
  }

  if (options.minPrice !== undefined) {
    whereClauses.push('p.harga_buka_wa >= ?');
    args.push(options.minPrice);
  }

  if (options.maxPrice !== undefined) {
    whereClauses.push('p.harga_buka_wa <= ?');
    args.push(options.maxPrice);
  }

  const whereSql = whereClauses.join(' AND ');

  // Stats query
  const statsSql = `
    SELECT 
      COUNT(*) as totalUnits,
      SUM(CASE WHEN status_unit = 'READY' OR status_unit = 'AVAILABLE' THEN 1 ELSE 0 END) as availableUnits,
      SUM(CASE WHEN status_unit = 'SOLD' THEN 1 ELSE 0 END) as soldUnits,
      SUM(CASE WHEN status_pipeline IN ('PENDING_PHOTOS', 'NO_PHOTOS_FOUND') THEN 1 ELSE 0 END) as pendingPhotos,
      SUM(CASE WHEN status_pipeline = 'READY_TO_PUBLISH' THEN 1 ELSE 0 END) as readyToPublish,
      SUM(CASE WHEN status_pipeline = 'PUBLISHED' THEN 1 ELSE 0 END) as published,
      SUM(CASE WHEN status_pipeline = 'ERROR' OR is_dirty = 1 THEN 1 ELSE 0 END) as errors,
      SUM(CASE WHEN status_pipeline = 'AMBIGUOUS' OR status_unit = 'AMBIGUOUS' THEN 1 ELSE 0 END) as ambiguous,
      SUM(CASE WHEN is_dirty = 1 THEN 1 ELSE 0 END) as dirtyCount
    FROM products
  `;

  // Count query
  const countSql = `
    SELECT COUNT(*) as total
    FROM products p
    LEFT JOIN categories c ON p.category_slug = c.child_slug
    WHERE ${whereSql}
  `;

  // Pagination
  const page = Math.max(1, options.page || 1);
  const pageSize = options.pageSize && options.pageSize > 0 ? Math.min(5000, options.pageSize) : 25;
  const offset = (page - 1) * pageSize;

  let orderByClause = 'p.tanggal_masuk DESC, p.sku DESC';
  if (options.sortBy === 'HARGA_MODAL') {
    const dir = options.sortOrder === 'asc' ? 'ASC' : 'DESC';
    orderByClause = `p.harga_modal ${dir}, p.sku DESC`;
  } else if (options.sortBy === 'HARGA_BUKA_WA') {
    const dir = options.sortOrder === 'asc' ? 'ASC' : 'DESC';
    orderByClause = `p.harga_buka_wa ${dir}, p.sku DESC`;
  } else if (options.sortBy === 'SKU') {
    const dir = options.sortOrder === 'asc' ? 'ASC' : 'DESC';
    orderByClause = `p.sku ${dir}`;
  } else if (options.sortBy === 'TANGGAL_MASUK') {
    const dir = options.sortOrder === 'asc' ? 'ASC' : 'DESC';
    orderByClause = `p.tanggal_masuk ${dir}, p.sku DESC`;
  }

  const selectSql = `
    SELECT 
      p.*,
      c.parent_name, c.child_name
    FROM products p
    LEFT JOIN categories c ON p.category_slug = c.child_slug
    WHERE ${whereSql}
    ORDER BY ${orderByClause}
    LIMIT ? OFFSET ?
  `;

  const [statsRes, countRes, itemsRes] = await Promise.all([
    client.execute(statsSql),
    client.execute({ sql: countSql, args }),
    client.execute({ sql: selectSql, args: [...args, pageSize, offset] }),
  ]);

  const statsRow = statsRes.rows[0] || {};
  const stats = {
    totalUnits: Number(statsRow.totalUnits || 0),
    availableUnits: Number(statsRow.availableUnits || 0),
    soldUnits: Number(statsRow.soldUnits || 0),
    pendingPhotos: Number(statsRow.pendingPhotos || 0),
    readyToPublish: Number(statsRow.readyToPublish || 0),
    published: Number(statsRow.published || 0),
    errors: Number(statsRow.errors || 0),
    ambiguous: Number(statsRow.ambiguous || 0),
    dirtyCount: Number(statsRow.dirtyCount || 0),
  };

  const total = Number(countRes.rows[0]?.total || 0);
  const totalPages = Math.ceil(total / pageSize);
  const items = itemsRes.rows.map((row) =>
    maskItemForRole(mapRowToMasterItem(row as unknown as Record<string, any>), role, permissions)
  );

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    stats,
  };
}

export async function updateTursoStockStatus(
  sku: string,
  newStatus: 'READY' | 'SOLD' | 'BOOKED' | UnitStatus,
  dealPrice?: number,
  notes?: string
): Promise<{ success: boolean; item?: MasterInventoryItem; error?: string }> {
  const client = getTursoClient();
  const cleanSku = sku.trim().toUpperCase();

  try {
    const today = new Date().toISOString().split('T')[0];
    let sql = `
      UPDATE products 
      SET status_unit = ?, 
          updated_at = datetime('now')
    `;
    const args: any[] = [newStatus];

    if (newStatus === 'SOLD') {
      sql += ', tanggal_terjual = ?';
      args.push(today);
      if (dealPrice) {
        sql += ', harga_deal_wa = ?';
        args.push(dealPrice);
      }
    }

    sql += ' WHERE UPPER(sku) = ?';
    args.push(cleanSku);

    await client.execute({ sql, args });

    // Fetch updated item
    const fetchSql = 'SELECT * FROM products WHERE UPPER(sku) = ? LIMIT 1';
    const res = await client.execute({ sql: fetchSql, args: [cleanSku] });

    if (res.rows.length === 0) {
      return { success: false, error: `SKU ${cleanSku} not found in Turso` };
    }

    const item = mapRowToMasterItem(res.rows[0] as unknown as Record<string, any>);
    return { success: true, item };
  } catch (err: any) {
    console.error('Error updating stock status in Turso:', err);
    return { success: false, error: err.message || 'Failed to update stock status in Turso' };
  }
}

// In-memory set of dismissed radar candidate IDs (cleared upon service restart or persisted locally)
const dismissedCandidates = new Set<string>();

export interface TursoSoldRadarCandidate {
  id: string;
  sku: string;
  dealPrice?: number;
  notes: string;
  pattern: 'PATTERN_1_DELETED' | 'PATTERN_2_SINGLE_PHOTO' | 'PATTERN_3_EDITED_SOLD' | 'PATTERN_4_REPLY_SOLD' | 'SALES_REPORT';
  patternLabel: string;
  patternIcon: string;
  linkTelegram?: string;
  reportedAt: string;
  reportedBy: string;
}

export async function getTursoTelegramSoldRadarCandidates(): Promise<TursoSoldRadarCandidate[]> {
  const client = getTursoClient();

  const candidates: TursoSoldRadarCandidate[] = [];
  const seenSkus = new Set<string>();

  try {
    // 1. Check raw_pipeline if any fresh broadcast records exist
    const rawSql = `
      SELECT 
        r.kode_unit, p.title, r.caption_raw, r.link_message, r.fetch_date, r.source_group,
        p.harga_buka_wa, p.lokasi_unit
      FROM raw_pipeline r
      JOIN products p ON r.kode_unit = p.sku
      WHERE (p.status_unit = 'READY' OR p.status_unit = 'AVAILABLE')
        AND (
          r.caption_raw LIKE '%SOLD%' OR 
          r.caption_raw LIKE '%LAKU%' OR 
          r.caption_raw LIKE '%TERJUAL%' OR 
          r.caption_raw LIKE '%SUDAH LAKU%'
        )
      ORDER BY r.fetch_date DESC
      LIMIT 20
    `;
    const rawRes = await client.execute(rawSql).catch(() => ({ rows: [] }));
    for (const r of rawRes.rows) {
      const sku = String(r.kode_unit || '').trim().toUpperCase();
      if (!sku || dismissedCandidates.has(sku) || seenSkus.has(sku)) continue;
      seenSkus.add(sku);

      const caption = String(r.caption_raw || '').replace(/\n+/g, ' ').slice(0, 120);
      const isReply = caption.toLowerCase().includes('reply') || caption.toLowerCase().includes('laku ke');
      candidates.push({
        id: `radar_${sku}`,
        sku,
        dealPrice: r.harga_buka_wa ? Number(r.harga_buka_wa) : undefined,
        pattern: isReply ? 'PATTERN_4_REPLY_SOLD' : 'PATTERN_3_EDITED_SOLD',
        patternLabel: isReply ? 'Pola 4: Reply SOLD di Grup' : 'Pola 3: Pesan Diedit SOLD',
        patternIcon: isReply ? '💬' : '✏️',
        notes: `[Radar TG: "${caption}"] • ${r.title} (${r.lokasi_unit || 'Gudang'})`,
        linkTelegram: r.link_message ? String(r.link_message) : undefined,
        reportedAt: String(r.fetch_date || new Date().toISOString().split('T')[0]),
        reportedBy: `Radar Telegram (${r.source_group || 'Channel'})`,
      });
    }

    // 2. Pola 3: Check products where title or description explicitly contains SOLD/LAKU/TERJUAL
    const editedSql = `
      SELECT sku, title, short_description, link_telegram, lokasi_unit, harga_buka_wa, harga_deal_wa
      FROM products
      WHERE status_unit IN ('READY', 'AVAILABLE')
        AND (
          title LIKE '%SOLD%' OR 
          title LIKE '%LAKU%' OR 
          title LIKE '%TERJUAL%' OR
          short_description LIKE '%SOLD%' OR 
          short_description LIKE '%LAKU%'
        )
      LIMIT 15
    `;
    const editedRes = await client.execute(editedSql).catch(() => ({ rows: [] }));
    for (const r of editedRes.rows) {
      const sku = String(r.sku || '').trim().toUpperCase();
      if (!sku || dismissedCandidates.has(sku) || seenSkus.has(sku)) continue;
      seenSkus.add(sku);

      candidates.push({
        id: `radar_${sku}`,
        sku,
        dealPrice: r.harga_deal_wa ? Number(r.harga_deal_wa) : (r.harga_buka_wa ? Number(r.harga_buka_wa) : undefined),
        pattern: 'PATTERN_3_EDITED_SOLD',
        patternLabel: 'Pola 3: Teks Diedit SOLD / LAKU',
        patternIcon: '✏️',
        notes: `[Terdeteksi Kata SOLD] • ${r.title} (${r.lokasi_unit || 'Gudang'})`,
        linkTelegram: r.link_telegram ? String(r.link_telegram) : undefined,
        reportedAt: new Date().toISOString().split('T')[0],
        reportedBy: 'Radar AI Keyword Scan',
      });
    }

    // 3. Pola 1: Check products with Pipeline Exception / Missing Telegram Message
    const deletedSql = `
      SELECT sku, title, link_telegram, lokasi_unit, harga_buka_wa, status_pipeline
      FROM products
      WHERE status_unit IN ('READY', 'AVAILABLE')
        AND status_pipeline = 'TELEGRAM_DELETED'
      ORDER BY sku DESC
      LIMIT 15
    `;
    const deletedRes = await client.execute(deletedSql).catch(() => ({ rows: [] }));
    for (const r of deletedRes.rows) {
      const sku = String(r.sku || '').trim().toUpperCase();
      if (!sku || dismissedCandidates.has(sku) || seenSkus.has(sku)) continue;
      seenSkus.add(sku);

      candidates.push({
        id: `radar_${sku}`,
        sku,
        dealPrice: r.harga_buka_wa ? Number(r.harga_buka_wa) : undefined,
        pattern: 'PATTERN_1_DELETED',
        patternLabel: 'Pola 1: Pesan Dihapus / Link Exception',
        patternIcon: '🗑️',
        notes: `[Exception Telegram: ${r.status_pipeline || 'Dirty Row'}] • ${r.title}`,
        linkTelegram: r.link_telegram ? String(r.link_telegram) : undefined,
        reportedAt: new Date().toISOString().split('T')[0],
        reportedBy: 'Radar Integrity Check',
      });
    }

    // 4. Pola 2: Check products where photos are pending / single photo preserved
    const singlePhotoSql = `
      SELECT sku, title, link_telegram, lokasi_unit, harga_buka_wa
      FROM products
      WHERE status_unit IN ('READY', 'AVAILABLE')
        AND status_pipeline = 'PENDING_PHOTOS'
      LIMIT 10
    `;
    const singlePhotoRes = await client.execute(singlePhotoSql).catch(() => ({ rows: [] }));
    for (const r of singlePhotoRes.rows) {
      const sku = String(r.sku || '').trim().toUpperCase();
      if (!sku || dismissedCandidates.has(sku) || seenSkus.has(sku)) continue;
      seenSkus.add(sku);

      candidates.push({
        id: `radar_${sku}`,
        sku,
        dealPrice: r.harga_buka_wa ? Number(r.harga_buka_wa) : undefined,
        pattern: 'PATTERN_2_SINGLE_PHOTO',
        patternLabel: 'Pola 2: Foto Disisakan 1 di Channel',
        patternIcon: '📸',
        notes: `[Foto Minimalis / Pending Photos] • ${r.title}`,
        linkTelegram: r.link_telegram ? String(r.link_telegram) : undefined,
        reportedAt: new Date().toISOString().split('T')[0],
        reportedBy: 'Radar Photo Monitor',
      });
    }

    return candidates;
  } catch (err) {
    console.error('Error fetching Telegram Sold Radar candidates from Turso:', err);
    return [];
  }
}

export function dismissSoldRadarCandidate(sku: string): boolean {
  dismissedCandidates.add(sku.trim().toUpperCase());
  return true;
}

export async function fetchAllTursoMasterItems(role?: UserRole): Promise<MasterInventoryItem[]> {
  const client = getTursoClient();
  try {
    const res = await client.execute(`
      SELECT p.*, c.parent_name, c.child_name
      FROM products p
      LEFT JOIN categories c ON p.category_slug = c.child_slug
      ORDER BY p.tanggal_masuk DESC, p.sku DESC
    `);
    return res.rows.map((row) =>
      maskItemForRole(mapRowToMasterItem(row as unknown as Record<string, any>), role)
    );
  } catch (err) {
    console.error('Error fetching all master items from Turso:', err);
    return [];
  }
}

