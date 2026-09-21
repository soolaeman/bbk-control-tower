import { NextRequest, NextResponse } from 'next/server';
import { resolveNonSkuItem } from '@/lib/repositories/finance-repository';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.role) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    const role = session.user.role;
    const permissions = (session.user as any).permissions;
    const canMutate =
      role === 'ADMIN' ||
      Boolean(
        permissions?.canEditFinancials ||
        permissions?.canEditOverview ||
        permissions?.canEditPipeline ||
        ['FINANCE', 'OPERATOR'].includes(role)
      );

    if (!canMutate) {
      return NextResponse.json({ error: 'FORBIDDEN: Izin mutasi finansial/pipeline diperlukan.' }, { status: 403 });
    }

    const body = await request.json();
    const { invoiceNumber, skuTemp, itemTitle, action, targetSku, hppModal, vendorBengkel, notes, hubLocation, warehouseCode, category } = body;

    if (!invoiceNumber || !skuTemp || !action) {
      return NextResponse.json({ error: 'Missing required resolution parameters' }, { status: 400 });
    }

    const success = await resolveNonSkuItem({
      invoiceNumber,
      skuTemp,
      itemTitle: itemTitle || '',
      action,
      targetSku,
      hppModal: Number(hppModal) || 0,
      vendorBengkel,
      notes,
      hubLocation,
      warehouseCode,
      category,
    });

    return NextResponse.json({ success });
  } catch (error: any) {
    console.error('Resolve Non-SKU API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to resolve non-SKU item' }, { status: 500 });
  }
}
