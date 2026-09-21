import { getTursoClient } from './turso-inventory-repository';

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  company_name?: string | null;
  address?: string | null;
  address_notes?: string | null;
  segment: 'LEAD_BARU' | 'PENAWARAN_AKTIF' | 'PEMBELI_AKTIF' | 'LANGGANAN_REPEAT' | 'VIP';
  preferred_categories?: string | null;
  budget_bracket?: string | null;
  lifetime_spend: number;
  total_orders: number;
  last_order_at?: string | null;
  created_at: string;
  updated_at: string;
}

export async function queryCustomers(options: {
  search?: string;
  segment?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  customers: CustomerProfile[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const client = getTursoClient();
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(100, options.pageSize || 25);
  const offset = (page - 1) * pageSize;

  const whereClauses: string[] = ['1=1'];
  const args: any[] = [];

  if (options.search && options.search.trim()) {
    const q = `%${options.search.trim()}%`;
    whereClauses.push('(name LIKE ? OR phone LIKE ? OR company_name LIKE ? OR address LIKE ?)');
    args.push(q, q, q, q);
  }

  if (options.segment && options.segment !== 'ALL') {
    whereClauses.push('segment = ?');
    args.push(options.segment);
  }

  const whereSql = whereClauses.join(' AND ');

  const countSql = `SELECT COUNT(*) as total FROM customers WHERE ${whereSql}`;
  const selectSql = `
    SELECT * FROM customers 
    WHERE ${whereSql}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ? OFFSET ?
  `;

  const [countRes, selectRes] = await Promise.all([
    client.execute({ sql: countSql, args }),
    client.execute({ sql: selectSql, args: [...args, pageSize, offset] }),
  ]);

  const total = Number(countRes.rows[0]?.total || 0);
  const totalPages = Math.ceil(total / pageSize);

  const customers: CustomerProfile[] = selectRes.rows.map((row: any) => ({
    id: String(row.id),
    name: String(row.name || ''),
    phone: String(row.phone || ''),
    company_name: row.company_name ? String(row.company_name) : null,
    address: row.address ? String(row.address) : null,
    address_notes: row.address_notes ? String(row.address_notes) : null,
    segment: (row.segment || 'LEAD_BARU') as CustomerProfile['segment'],
    preferred_categories: row.preferred_categories ? String(row.preferred_categories) : null,
    budget_bracket: row.budget_bracket ? String(row.budget_bracket) : null,
    lifetime_spend: Number(row.lifetime_spend || 0),
    total_orders: Number(row.total_orders || 0),
    last_order_at: row.last_order_at ? String(row.last_order_at) : null,
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || new Date().toISOString()),
  }));

  return {
    customers,
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function upsertCustomer(data: Partial<CustomerProfile>): Promise<CustomerProfile> {
  const client = getTursoClient();
  const id = data.id || `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const existingRes = await client.execute({
    sql: 'SELECT * FROM customers WHERE id = ? OR phone = ? LIMIT 1',
    args: [id, data.phone || ''],
  });

  if (existingRes.rows.length > 0) {
    const existing = existingRes.rows[0];
    const targetId = String(existing.id);

    await client.execute({
      sql: `
        UPDATE customers SET
          name = COALESCE(?, name),
          phone = COALESCE(?, phone),
          company_name = COALESCE(?, company_name),
          address = COALESCE(?, address),
          address_notes = COALESCE(?, address_notes),
          segment = COALESCE(?, segment),
          preferred_categories = COALESCE(?, preferred_categories),
          budget_bracket = COALESCE(?, budget_bracket),
          lifetime_spend = CASE WHEN ? IS NOT NULL THEN ? ELSE lifetime_spend END,
          total_orders = CASE WHEN ? IS NOT NULL THEN ? ELSE total_orders END,
          last_order_at = COALESCE(?, last_order_at),
          updated_at = ?
        WHERE id = ?
      `,
      args: [
        data.name ?? null,
        data.phone ?? null,
        data.company_name ?? null,
        data.address ?? null,
        data.address_notes ?? null,
        data.segment ?? null,
        data.preferred_categories ?? null,
        data.budget_bracket ?? null,
        data.lifetime_spend ?? null,
        data.lifetime_spend ?? null,
        data.total_orders ?? null,
        data.total_orders ?? null,
        data.last_order_at ?? null,
        now,
        targetId,
      ],
    });

    const updated = await client.execute({
      sql: 'SELECT * FROM customers WHERE id = ?',
      args: [targetId],
    });

    return updated.rows[0] as unknown as CustomerProfile;
  }

  // Insert new customer
  await client.execute({
    sql: `
      INSERT INTO customers (
        id, name, phone, company_name, address, address_notes,
        segment, preferred_categories, budget_bracket,
        lifetime_spend, total_orders, last_order_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      data.name || 'Pelanggan Baru',
      data.phone || '',
      data.company_name ?? null,
      data.address ?? null,
      data.address_notes ?? null,
      data.segment || 'LEAD_BARU',
      data.preferred_categories ?? null,
      data.budget_bracket ?? null,
      data.lifetime_spend || 0,
      data.total_orders || 0,
      data.last_order_at ?? null,
      now,
      now,
    ],
  });

  const inserted = await client.execute({
    sql: 'SELECT * FROM customers WHERE id = ?',
    args: [id],
  });

  return inserted.rows[0] as unknown as CustomerProfile;
}

export async function deleteCustomer(id: string): Promise<boolean> {
  const client = getTursoClient();
  await client.execute({
    sql: 'DELETE FROM customers WHERE id = ?',
    args: [id],
  });
  return true;
}
