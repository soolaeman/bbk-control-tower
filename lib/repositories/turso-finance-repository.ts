import { getTursoClient } from './turso-inventory-repository';
import type { Invoice, InvoiceItem, InvoiceStatus, DocumentType } from '@/lib/types/finance';

function mapRowToInvoice(r: Record<string, any>): Invoice {
  let items: InvoiceItem[] = [];
  try {
    items = r.items_json ? JSON.parse(r.items_json) : [];
  } catch {
    items = [];
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
    status: (r.status as InvoiceStatus) || 'DRAFT',
    issueDate: r.created_at ? String(r.created_at).split(' ')[0] : new Date().toISOString().split('T')[0],
    dueDate: r.created_at ? String(r.created_at).split(' ')[0] : new Date().toISOString().split('T')[0],
    createdBy: 'Finance Desk',
    notes: r.notes ? String(r.notes) : undefined,
    paymentMethod: r.payment_method ? String(r.payment_method) : undefined,
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
      status, paid_date, payment_method, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const itemsJson = JSON.stringify(invoice.items || []);
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
      0,
      'INCLUDED',
      invoice.totalAmount,
      invoice.dpAmount || 0,
      invoice.remainingAmount || 0,
      invoice.status,
      invoice.status === 'PAID' ? now : null,
      invoice.paymentMethod || null,
      invoice.notes || null,
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
