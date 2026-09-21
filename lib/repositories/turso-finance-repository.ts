import { getTursoClient } from './turso-inventory-repository';
import type {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  DocumentType,
  PaymentRecord,
  WarrantyRecord,
  WarrantyItemRecord,
  DeliveryDispatchRecord,
} from '@/lib/types/finance';

function mapRowToInvoice(r: Record<string, any>): Invoice {
  let items: InvoiceItem[] = [];
  try {
    items = r.items_json ? JSON.parse(r.items_json) : [];
  } catch {
    items = [];
  }

  let payments: PaymentRecord[] | undefined = undefined;
  if (r.payments_json) {
    try {
      payments = JSON.parse(r.payments_json);
    } catch {
      payments = undefined;
    }
  }

  return {
    id: String(r.id),
    invoiceNumber: String(r.invoice_number || ''),
    documentType: (r.doc_type as DocumentType) || 'INVOICE',
    customerName: String(r.customer_name || ''),
    customerPhone: String(r.customer_phone || ''),
    customerAddress: r.customer_address ? String(r.customer_address) : undefined,
    customerCompany: r.customer_company ? String(r.customer_company) : undefined,
    items,
    subtotal: Number(r.subtotal || 0),
    discount: Number(r.discount || 0),
    tax: 0,
    totalAmount: Number(r.total_amount || 0),
    dpAmount: r.dp_amount ? Number(r.dp_amount) : undefined,
    remainingAmount: r.remaining_balance ? Number(r.remaining_balance) : 0,
    payments,
    status: (r.status as InvoiceStatus) || 'DRAFT',
    issueDate: r.created_at ? String(r.created_at).split(' ')[0] : new Date().toISOString().split('T')[0],
    dueDate: r.created_at ? String(r.created_at).split(' ')[0] : new Date().toISOString().split('T')[0],
    createdBy: 'Finance Desk',
    notes: r.notes ? String(r.notes) : undefined,
    paymentMethod: r.payment_method ? String(r.payment_method) : undefined,
    termsConditions: r.terms_conditions ? String(r.terms_conditions) : undefined,
    storageDeadline: r.storage_deadline ? String(r.storage_deadline) : undefined,
  };
}

export async function fetchTursoInvoices(): Promise<Invoice[]> {
  const client = getTursoClient();
  try {
    const res = await client.execute('SELECT * FROM invoices ORDER BY created_at DESC');
    return res.rows.map((row) => mapRowToInvoice(row as unknown as Record<string, any>));
  } catch (err) {
    console.error('Error fetching invoices from Turso:', err);
    return [];
  }
}

export async function saveTursoInvoice(invoice: Invoice): Promise<void> {
  const client = getTursoClient();
  const sql = `
    INSERT OR REPLACE INTO invoices (
      id, invoice_number, doc_type, created_at, customer_name, customer_phone,
      customer_address, customer_company, items_json, subtotal, discount,
      shipping_fee, shipping_fee_type, total_amount, dp_amount, remaining_balance,
      status, paid_date, payment_method, notes, payments_json, terms_conditions, storage_deadline
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const itemsJson = JSON.stringify(invoice.items || []);
  const paymentsJson = invoice.payments ? JSON.stringify(invoice.payments) : null;
  const now = new Date().toISOString();

  await client.execute({
    sql,
    args: [
      invoice.id,
      invoice.invoiceNumber,
      invoice.documentType || 'INVOICE',
      invoice.issueDate || now,
      invoice.customerName,
      invoice.customerPhone,
      invoice.customerAddress || null,
      invoice.customerCompany || null,
      itemsJson,
      invoice.subtotal,
      invoice.discount,
      invoice.shippingFee || 0,
      invoice.shippingFeeType || 'INCLUDED',
      invoice.totalAmount,
      invoice.dpAmount || 0,
      invoice.remainingAmount || 0,
      invoice.status,
      invoice.status === 'PAID' ? now : null,
      invoice.paymentMethod || null,
      invoice.notes || null,
      paymentsJson,
      invoice.termsConditions || null,
      invoice.storageDeadline || null,
    ],
  });
}

export async function updateTursoInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const client = getTursoClient();
  const sql = `UPDATE invoices SET status = ? WHERE id = ? OR invoice_number = ?`;
  await client.execute({
    sql,
    args: [status, id, id],
  });
}

export async function deleteTursoInvoice(id: string): Promise<void> {
  const client = getTursoClient();
  const sql = `DELETE FROM invoices WHERE id = ? OR invoice_number = ?`;
  await client.execute({
    sql,
    args: [id, id],
  });
}

// ==========================================
// WARRANTIES REPOSITORY (E-WARRANTY ENGINE)
// ==========================================

function mapRowToWarranty(r: Record<string, any>, items: WarrantyItemRecord[] = []): WarrantyRecord {
  return {
    id: String(r.id),
    warrantyNumber: String(r.warranty_number || ''),
    invoiceNumber: String(r.invoice_number || ''),
    poNumber: r.po_number ? String(r.po_number) : undefined,
    customerName: String(r.customer_name || ''),
    customerCompany: r.customer_company ? String(r.customer_company) : undefined,
    receivedAt: String(r.received_at || ''),
    warrantyExpiresAt: String(r.warranty_expires_at || ''),
    publicExpiresAt: String(r.public_expires_at || ''),
    status: (r.status as 'ACTIVE' | 'EXPIRED' | 'ARCHIVED') || 'ACTIVE',
    items,
    createdAt: String(r.created_at || ''),
    updatedAt: String(r.updated_at || ''),
  };
}

export async function fetchTursoWarranties(): Promise<WarrantyRecord[]> {
  const client = getTursoClient();
  try {
    const res = await client.execute('SELECT * FROM warranties ORDER BY created_at DESC');
    return res.rows.map((row) => mapRowToWarranty(row as unknown as Record<string, any>));
  } catch (err) {
    console.error('Error fetching warranties from Turso:', err);
    return [];
  }
}

export async function getTursoWarrantyByNumber(warrantyNumber: string): Promise<WarrantyRecord | null> {
  const client = getTursoClient();
  try {
    const res = await client.execute({
      sql: 'SELECT * FROM warranties WHERE UPPER(warranty_number) = UPPER(?) LIMIT 1',
      args: [warrantyNumber.trim()],
    });
    if (res.rows.length === 0) return null;

    const row = res.rows[0] as unknown as Record<string, any>;
    const itemsRes = await client.execute({
      sql: 'SELECT * FROM warranty_items WHERE warranty_id = ?',
      args: [row.id],
    });

    const items: WarrantyItemRecord[] = itemsRes.rows.map((ir: any) => ({
      id: String(ir.id),
      warrantyId: String(ir.warranty_id),
      itemCode: String(ir.item_code),
      itemName: String(ir.item_name),
      itemCondition: ir.item_condition ? String(ir.item_condition) : undefined,
      warrantyEligible: Boolean(ir.warranty_eligible),
    }));

    return mapRowToWarranty(row, items);
  } catch (err) {
    console.error(`Error fetching warranty ${warrantyNumber}:`, err);
    return null;
  }
}

export async function getTursoWarrantyByInvoice(invoiceNumber: string): Promise<WarrantyRecord | null> {
  const client = getTursoClient();
  try {
    const res = await client.execute({
      sql: 'SELECT * FROM warranties WHERE UPPER(invoice_number) = UPPER(?) LIMIT 1',
      args: [invoiceNumber.trim()],
    });
    if (res.rows.length === 0) return null;
    return mapRowToWarranty(res.rows[0] as unknown as Record<string, any>);
  } catch (err) {
    console.error(`Error fetching warranty for invoice ${invoiceNumber}:`, err);
    return null;
  }
}

export async function saveTursoWarranty(warranty: WarrantyRecord): Promise<void> {
  const client = getTursoClient();
  const now = new Date().toISOString();

  await client.execute({
    sql: `
      INSERT OR REPLACE INTO warranties (
        id, warranty_number, invoice_number, po_number, customer_name,
        customer_company, received_at, warranty_expires_at, public_expires_at,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      warranty.id,
      warranty.warrantyNumber,
      warranty.invoiceNumber,
      warranty.poNumber || null,
      warranty.customerName,
      warranty.customerCompany || null,
      warranty.receivedAt,
      warranty.warrantyExpiresAt,
      warranty.publicExpiresAt,
      warranty.status,
      warranty.createdAt || now,
      now,
    ],
  });

  if (warranty.items && warranty.items.length > 0) {
    for (const item of warranty.items) {
      await client.execute({
        sql: `
          INSERT OR REPLACE INTO warranty_items (
            id, warranty_id, item_code, item_name, item_condition, warranty_eligible
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
          item.id,
          warranty.id,
          item.itemCode,
          item.itemName,
          item.itemCondition || null,
          item.warrantyEligible ? 1 : 0,
        ],
      });
    }
  }
}

// ==========================================
// DELIVERY DISPATCHES REPOSITORY (E-POD LOGISTICS)
// ==========================================

function mapRowToDispatch(r: Record<string, any>): DeliveryDispatchRecord {
  return {
    id: String(r.id),
    sjNumber: String(r.sj_number || ''),
    invoiceNumber: String(r.invoice_number || ''),
    driverName: r.driver_name ? String(r.driver_name) : undefined,
    driverPhone: r.driver_phone ? String(r.driver_phone) : undefined,
    vehiclePlateReal: r.vehicle_plate_real ? String(r.vehicle_plate_real) : undefined,
    ktpPhotoUrl: r.ktp_photo_url ? String(r.ktp_photo_url) : undefined,
    platePhotoUrl: r.plate_photo_url ? String(r.plate_photo_url) : undefined,
    loadingPhotoUrl: r.loading_photo_url ? String(r.loading_photo_url) : undefined,
    dispatchedAt: r.dispatched_at ? String(r.dispatched_at) : undefined,
    isUnlockedForAcceptance: Boolean(r.is_unlocked_for_acceptance),
    recipientNameAllowed: r.recipient_name_allowed ? String(r.recipient_name_allowed) : undefined,
    recipientName: r.recipient_name ? String(r.recipient_name) : undefined,
    recipientSignatureSvg: r.recipient_signature_svg ? String(r.recipient_signature_svg) : undefined,
    arrivalPhotoUrl: r.arrival_photo_url ? String(r.arrival_photo_url) : undefined,
    deliveredAt: r.delivered_at ? String(r.delivered_at) : undefined,
  };
}

export async function fetchTursoDispatches(): Promise<DeliveryDispatchRecord[]> {
  const client = getTursoClient();
  try {
    const res = await client.execute('SELECT * FROM delivery_dispatches ORDER BY dispatched_at DESC');
    return res.rows.map((row) => mapRowToDispatch(row as unknown as Record<string, any>));
  } catch (err) {
    console.error('Error fetching delivery dispatches from Turso:', err);
    return [];
  }
}

export async function getTursoDispatchBySjNumber(sjNumber: string): Promise<DeliveryDispatchRecord | null> {
  const client = getTursoClient();
  try {
    const res = await client.execute({
      sql: 'SELECT * FROM delivery_dispatches WHERE UPPER(sj_number) = UPPER(?) LIMIT 1',
      args: [sjNumber.trim()],
    });
    if (res.rows.length === 0) return null;
    return mapRowToDispatch(res.rows[0] as unknown as Record<string, any>);
  } catch (err) {
    console.error(`Error fetching dispatch ${sjNumber}:`, err);
    return null;
  }
}

export async function getTursoDispatchByInvoice(invoiceNumber: string): Promise<DeliveryDispatchRecord | null> {
  const client = getTursoClient();
  try {
    const res = await client.execute({
      sql: 'SELECT * FROM delivery_dispatches WHERE UPPER(invoice_number) = UPPER(?) LIMIT 1',
      args: [invoiceNumber.trim()],
    });
    if (res.rows.length === 0) return null;
    return mapRowToDispatch(res.rows[0] as unknown as Record<string, any>);
  } catch (err) {
    console.error(`Error fetching dispatch for invoice ${invoiceNumber}:`, err);
    return null;
  }
}

export async function saveTursoDispatch(dispatch: DeliveryDispatchRecord): Promise<void> {
  const client = getTursoClient();
  const sql = `
    INSERT OR REPLACE INTO delivery_dispatches (
      id, sj_number, invoice_number, driver_name, driver_phone, vehicle_plate_real,
      ktp_photo_url, plate_photo_url, loading_photo_url, dispatched_at,
      is_unlocked_for_acceptance, recipient_name_allowed, recipient_name,
      recipient_signature_svg, arrival_photo_url, delivered_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await client.execute({
    sql,
    args: [
      dispatch.id,
      dispatch.sjNumber,
      dispatch.invoiceNumber,
      dispatch.driverName || null,
      dispatch.driverPhone || null,
      dispatch.vehiclePlateReal || null,
      dispatch.ktpPhotoUrl || null,
      dispatch.platePhotoUrl || null,
      dispatch.loadingPhotoUrl || null,
      dispatch.dispatchedAt || null,
      dispatch.isUnlockedForAcceptance ? 1 : 0,
      dispatch.recipientNameAllowed || null,
      dispatch.recipientName || null,
      dispatch.recipientSignatureSvg || null,
      dispatch.arrivalPhotoUrl || null,
      dispatch.deliveredAt || null,
    ],
  });
}

export async function unlockTursoDispatchAcceptance(sjNumber: string): Promise<boolean> {
  const client = getTursoClient();
  try {
    await client.execute({
      sql: 'UPDATE delivery_dispatches SET is_unlocked_for_acceptance = 1 WHERE UPPER(sj_number) = UPPER(?)',
      args: [sjNumber.trim()],
    });
    return true;
  } catch (err) {
    console.error(`Error unlocking dispatch acceptance for ${sjNumber}:`, err);
    return false;
  }
}
