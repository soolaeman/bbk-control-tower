import { NextRequest, NextResponse } from 'next/server';
import { queryCustomers, upsertCustomer, deleteCustomer } from '@/lib/repositories/turso-customers-repository';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.role) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const segment = searchParams.get('segment') || undefined;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
    const pageSize = searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 25;

    const result = await queryCustomers({ search, segment, page, pageSize });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.role) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.name || !body.phone) {
      return NextResponse.json({ error: 'Nama dan nomor telepon WhatsApp wajib diisi' }, { status: 400 });
    }

    const customer = await upsertCustomer(body);
    return NextResponse.json({ success: true, customer });
  } catch (error: any) {
    console.error('Error upserting customer:', error);
    return NextResponse.json({ error: error.message || 'Failed to save customer' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.role) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID customer wajib disertakan' }, { status: 400 });
    }

    await deleteCustomer(id);
    return NextResponse.json({ success: true, message: 'Customer berhasil dihapus' });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete customer' }, { status: 500 });
  }
}
