import { NextRequest, NextResponse } from 'next/server';
import { updatePipelineStatus } from '@/lib/repositories/inventory-repository';
import { updateGoogleSheetsPipelineStatus } from '@/lib/repositories/google-sheets-inventory';
import { PipelineStatus } from '@/lib/types/inventory';
import { auth } from '@/auth';
import { UserRole } from '@/lib/types/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.role) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    const roleHeader = session.user.role as UserRole;
    const permissions = (session.user as any).permissions;
    const canMutate =
      roleHeader === 'ADMIN' ||
      Boolean(
        permissions?.canEditPipeline ||
        permissions?.canEditInventory ||
        roleHeader === 'OPERATOR'
      );

    if (!canMutate) {
      return NextResponse.json({ error: 'FORBIDDEN: Izin Edit Pipeline diperlukan.' }, { status: 403 });
    }

    const body = await request.json();
    const { sku, newStatus, clearDirty } = body;

    if (!sku || !newStatus) {
      return NextResponse.json({ error: 'SKU and newStatus are required' }, { status: 400 });
    }

    if (process.env.BBK_INVENTORY_SOURCE === 'google_sheets') {
      const gsResult = await updateGoogleSheetsPipelineStatus({
        sku,
        newStatus,
        clearDirty: clearDirty ?? true,
      });

      if (!gsResult.success) {
        return NextResponse.json({ error: gsResult.error }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `Unit ${sku} pipeline status updated to ${newStatus} in Google Sheets`,
      });
    }

    const success = updatePipelineStatus(sku, newStatus as PipelineStatus, clearDirty ?? true);
    if (!success) {
      return NextResponse.json({ error: `Unit with SKU ${sku} not found` }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Unit ${sku} pipeline status updated to ${newStatus}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Pipeline update failed' }, { status: 500 });
  }
}

