import { NextRequest, NextResponse } from 'next/server';
import { getTursoClient } from '@/lib/repositories/turso-inventory-repository';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceNumber: string }> }
) {
  try {
    const { invoiceNumber } = await params;
    const cleanNumber = decodeURIComponent(invoiceNumber).trim().toUpperCase();

    const client = getTursoClient();

    // 1. Fetch invoice
    const invRes = await client.execute({
      sql: 'SELECT * FROM invoices WHERE UPPER(invoice_number) = ? LIMIT 1',
      args: [cleanNumber],
    });

    if (invRes.rows.length === 0) {
      return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 });
    }

    const inv = invRes.rows[0];

    // 2. Fetch delivery dispatch
    const dispRes = await client.execute({
      sql: 'SELECT * FROM delivery_dispatches WHERE UPPER(invoice_number) = ? LIMIT 1',
      args: [cleanNumber],
    });
    const dispatch = dispRes.rows.length > 0 ? dispRes.rows[0] : null;

    // 3. Fetch warranty
    const warRes = await client.execute({
      sql: 'SELECT * FROM warranties WHERE UPPER(invoice_number) = ? LIMIT 1',
      args: [cleanNumber],
    });
    const warranty = warRes.rows.length > 0 ? warRes.rows[0] : null;

    // Parse items JSON safely
    let items: any[] = [];
    try {
      if (inv.items_json) {
        items = typeof inv.items_json === 'string' ? JSON.parse(inv.items_json) : inv.items_json;
      }
    } catch {
      items = [];
    }

    // Mask sensitive broker data
    const safeInvoice = {
      invoiceNumber: String(inv.invoice_number),
      docType: String(inv.doc_type || 'INVOICE'),
      customerName: String(inv.customer_name || 'Pelanggan'),
      customerCompany: inv.customer_company ? String(inv.customer_company) : null,
      customerAddress: inv.customer_address ? String(inv.customer_address) : null,
      subtotal: Number(inv.subtotal || inv.total_amount || 0),
      discount: Number(inv.discount || 0),
      shippingFee: Number(inv.shipping_fee || 0),
      totalAmount: Number(inv.total_amount || 0),
      dpAmount: Number(inv.dp_amount || 0),
      remainingBalance: Number(inv.remaining_balance || 0),
      status: String(inv.status || 'DRAFT'),
      createdAt: String(inv.created_at || ''),
      paidDate: inv.paid_date ? String(inv.paid_date) : null,
      paymentMethod: String(inv.payment_method || 'TRANSFER_JAGO_SYARIAH'),
      notes: inv.notes ? String(inv.notes) : null,
      items: items.map((it) => ({
        sku: it.sku || 'BBK-UNIT',
        description: it.description || 'Unit Komersial BBKitchen',
        condition: it.condition || 'SECOND_RECONDITIONED',
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || it.price || 0),
        total: Number(it.total || 0),
      })),
    };

    const safeDispatch = dispatch
      ? {
          sjNumber: String(dispatch.sj_number || ''),
          driverName: String(dispatch.driver_name || ''),
          driverPhone: String(dispatch.driver_phone || ''),
          vehiclePlateReal: String(dispatch.vehicle_plate_real || ''),
          loadingPhotoUrl: dispatch.loading_photo_url ? String(dispatch.loading_photo_url) : null,
          dispatchedAt: dispatch.dispatched_at ? String(dispatch.dispatched_at) : null,
          isUnlockedForAcceptance: Boolean(dispatch.is_unlocked_for_acceptance),
          recipientName: dispatch.recipient_name ? String(dispatch.recipient_name) : null,
          recipientSignatureSvg: dispatch.recipient_signature_svg ? String(dispatch.recipient_signature_svg) : null,
          arrivalPhotoUrl: dispatch.arrival_photo_url ? String(dispatch.arrival_photo_url) : null,
          deliveredAt: dispatch.delivered_at ? String(dispatch.delivered_at) : null,
        }
      : null;

    const safeWarranty = warranty
      ? {
          warrantyNumber: String(warranty.warranty_number || ''),
          receivedAt: warranty.received_at ? String(warranty.received_at) : null,
          warrantyExpiresAt: String(warranty.warranty_expires_at || ''),
          status: String(warranty.status || 'PENDING'),
        }
      : null;

    return NextResponse.json({
      success: true,
      deal: {
        invoice: safeInvoice,
        dispatch: safeDispatch,
        warranty: safeWarranty,
      },
    });
  } catch (error: any) {
    console.error('Error fetching deal details:', error);
    return NextResponse.json({ error: error.message || 'Failed to load deal' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceNumber: string }> }
) {
  try {
    const { invoiceNumber } = await params;
    const cleanNumber = decodeURIComponent(invoiceNumber).trim().toUpperCase();

    const body = await request.json();
    const { recipientName, signatureSvg, arrivalPhotoUrl } = body;

    if (!signatureSvg) {
      return NextResponse.json({ error: 'Tanda tangan digital wajib dibubuhkan' }, { status: 400 });
    }

    const client = getTursoClient();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Update delivery dispatch record
    await client.execute({
      sql: `
        UPDATE delivery_dispatches SET
          recipient_name = COALESCE(?, recipient_name),
          recipient_signature_svg = ?,
          arrival_photo_url = COALESCE(?, arrival_photo_url),
          delivered_at = ?
        WHERE UPPER(invoice_number) = ?
      `,
      args: [recipientName || 'Penerima Dapur', signatureSvg, arrivalPhotoUrl || null, now, cleanNumber],
    });

    // 2. Activate E-Warranty 14 Hari
    const warRes = await client.execute({
      sql: 'SELECT id FROM warranties WHERE UPPER(invoice_number) = ? LIMIT 1',
      args: [cleanNumber],
    });

    if (warRes.rows.length > 0) {
      await client.execute({
        sql: `
          UPDATE warranties SET
            status = 'ACTIVE',
            received_at = ?,
            warranty_expires_at = ?,
            updated_at = ?
          WHERE UPPER(invoice_number) = ?
        `,
        args: [now, expiresAt, now, cleanNumber],
      });
    } else {
      // Create new active warranty record
      const warId = `war_${Date.now()}`;
      const warNum = `GAR-${cleanNumber.replace('INV-', '')}`;
      await client.execute({
        sql: `
          INSERT INTO warranties (
            id, warranty_number, invoice_number, received_at,
            warranty_expires_at, public_expires_at, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
        `,
        args: [warId, warNum, cleanNumber, now, expiresAt, expiresAt, now, now],
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Serah terima digital berhasil dikonfirmasi & Garansi 14 Hari telah aktif!',
    });
  } catch (error: any) {
    console.error('Error submitting delivery acceptance:', error);
    return NextResponse.json({ error: error.message || 'Gagal memproses tanda tangan' }, { status: 500 });
  }
}
