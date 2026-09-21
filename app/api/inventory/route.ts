import { NextRequest, NextResponse } from 'next/server';
import { queryInventory, markUnitAsSold } from '@/lib/repositories/inventory-repository';
import { UserRole } from '@/lib/types/auth';
import { queryTursoInventory, updateTursoStockStatus } from '@/lib/repositories/turso-inventory-repository';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const location = searchParams.get('location') || undefined;
    const warehouse = searchParams.get('warehouse') || undefined;
    const statusUnit = searchParams.get('statusUnit') || undefined;
    const statusPipeline = searchParams.get('statusPipeline') || undefined;
    const guardrailStatus = searchParams.get('guardrailStatus') || undefined;
    const isDirtyParam = searchParams.get('isDirty');
    const isDirty = isDirtyParam !== null ? isDirtyParam === 'true' : undefined;
    const hasProductIdParam = searchParams.get('hasProductId');
    const hasProductId = hasProductIdParam !== null ? hasProductIdParam === 'true' : undefined;
    const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined;
    const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'TANGGAL_MASUK';
    const sortOrder = (searchParams.get('sortOrder') as any) || 'desc';
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
    const pageSize = searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 25;

    // Role and permissions are injected by authenticated server session
    const session = await auth();
    if (!session?.user?.role) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    const roleHeader = session.user.role as UserRole;
    const permissions = (session.user as any).permissions;

    // Direct Query to Turso SQLite SSOT
    const result = await queryTursoInventory(
      {
        search,
        category,
        location,
        warehouse,
        statusUnit,
        statusPipeline,
        guardrailStatus,
        isDirty,
        hasProductId,
        minPrice,
        maxPrice,
        sortBy,
        sortOrder,
        page,
        pageSize,
      },
      roleHeader,
      permissions
    );
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to query inventory' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sku, dealPrice, notes, status } = body;

    const session = await auth();
    if (!session?.user?.role) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    const roleHeader = session.user.role as UserRole;
    const permissions = (session.user as any).permissions;
    const canMutate =
      roleHeader === 'ADMIN' ||
      Boolean(
        permissions?.canEditInventory ||
        permissions?.canMarkAsSold ||
        roleHeader === 'OPERATOR'
      );

    if (!canMutate) {
      return NextResponse.json(
        { error: 'Unauthorized: Izin Edit Inventori atau Mark as Sold diperlukan.' },
        { status: 403 }
      );
    }

    if (!sku) {
      return NextResponse.json({ error: 'SKU is required' }, { status: 400 });
    }

    if (action === 'MARK_AS_SOLD' || status === 'SOLD' || action === 'UPDATE_STOCK_STATUS') {
      const tursoResult = await updateTursoStockStatus(
        sku,
        (status as any) || 'SOLD',
        dealPrice ? Number(dealPrice) : undefined,
        notes
      );
      if (!tursoResult.success) {
        return NextResponse.json({ error: tursoResult.error }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        item: tursoResult.item,
        message: `Unit ${sku} successfully updated to ${(status as any) || 'SOLD'} in Turso SQLite SSOT`,
      });
    }

    if (action === 'MARK_AS_READY' || status === 'READY') {
      const tursoResult = await updateTursoStockStatus(sku, 'READY', undefined, notes);
      if (!tursoResult.success) {
        return NextResponse.json({ error: tursoResult.error }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        item: tursoResult.item,
        message: `Unit ${sku} successfully set to READY in Turso SQLite SSOT`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to process inventory update' }, { status: 500 });
  }
}
