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
import { UserRole, ROLE_PERMISSIONS } from '@/lib/types/auth';

const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://bbk-soolaeman.aws-ap-northeast-1.turso.io';
const TURSO_AUTH_TOKEN =
  process.env.TURSO_AUTH_TOKEN ||
  'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk4MjI2ODcsImlkIjoiMDFhMGI5YmQtZTIwMS03ZjUxLWExMDQtMzk5NzlkNjAzMTNiIiwia2lkIjoickFjZFotQXpjdjkwZE5pLWd6aHF4ZWZPN1dzNTJnMjB3VmNtQld1bS1UcyIsInJpZCI6IjgwYzI0OTQ1LTRmMDctNGYwNy05YzJkLTdhYmFlZGFjMzNlYSJ9.qavUPG-VqnaFxPUHsi7OV_7uesPTMk2K3Tn35YueMnq4hR0KJDhZ-rc4zzCpatWWovjCCJQ0LTpINp_KRC2vCA';

const R2_BASE_URL = (
  process.env.NEXT_PUBLIC_R2_PHOTO_BASE_URL ||
  'https://pub-946d1fe1a1b1461eb2cca6be4462ba11.r2.dev'
).replace(/\/$/, '');

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

export function maskItemForRole(item: MasterInventoryItem, role?: UserRole): MasterInventoryItem {
  const permissions = role
    ? ROLE_PERMISSIONS[role]
    : {
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
  role?: UserRole
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
  const pageSize = Math.max(5, Math.min(100, options.pageSize || 25));
  const offset = (page - 1) * pageSize;

  const selectSql = `
    SELECT 
      p.*,
      c.parent_name, c.child_name
    FROM products p
    LEFT JOIN categories c ON p.category_slug = c.child_slug
    WHERE ${whereSql}
    ORDER BY p.tanggal_masuk DESC, p.sku DESC
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
    maskItemForRole(mapRowToMasterItem(row as unknown as Record<string, any>), role)
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

export async function getTursoTelegramSoldRadarCandidates(): Promise<
  Array<{
    id: string;
    sku: string;
    dealPrice?: number;
    notes: string;
    reportedAt: string;
    reportedBy: string;
  }>
> {
  const client = getTursoClient();

  const sql = `
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
    LIMIT 30
  `;

  try {
    const res = await client.execute(sql);
    const candidates: Array<{
      id: string;
      sku: string;
      dealPrice?: number;
      notes: string;
      reportedAt: string;
      reportedBy: string;
    }> = [];

    for (const r of res.rows) {
      const sku = String(r.kode_unit || '').trim();
      const id = `radar_${sku}`;
      if (dismissedCandidates.has(sku)) continue;

      const caption = String(r.caption_raw || '').replace(/\n+/g, ' ').slice(0, 100);
      const title = String(r.title || '');
      const location = String(r.lokasi_unit || '');
      const source = String(r.source_group || 'Telegram Group');

      candidates.push({
        id,
        sku,
        dealPrice: r.harga_buka_wa ? Number(r.harga_buka_wa) : undefined,
        notes: `[Radar Telegram: "${caption}..."] • ${title} (${location})`,
        reportedAt: String(r.fetch_date || new Date().toISOString().split('T')[0]),
        reportedBy: `Radar Telegram (${source})`,
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
