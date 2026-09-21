import { NextRequest, NextResponse } from 'next/server';
import {
  getWarranties,
  getWarrantyByNumber,
  getWarrantyByInvoice,
  saveWarranty,
} from '@/lib/repositories/finance-repository';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const warrantyNumber = searchParams.get('warrantyNumber');
    const invoiceNumber = searchParams.get('invoiceNumber');

    // Public lookup for scan QR Code
    if (warrantyNumber) {
      const item = await getWarrantyByNumber(warrantyNumber);
      if (!item) return NextResponse.json({ error: 'Warranty not found' }, { status: 404 });
      return NextResponse.json(item);
    }

    if (invoiceNumber) {
      const item = await getWarrantyByInvoice(invoiceNumber);
      return NextResponse.json(item || null);
    }

    // Protected backoffice listing
    const session = await auth();
    if (!session?.user?.role) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const list = await getWarranties();
    return NextResponse.json(list);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch warranties' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.role) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const body = await request.json();
    const { warranty } = body;
    if (!warranty || !warranty.warrantyNumber) {
      return NextResponse.json({ error: 'Invalid warranty payload' }, { status: 400 });
    }

    await saveWarranty(warranty);
    return NextResponse.json({ success: true, warranty });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save warranty' }, { status: 500 });
  }
}
