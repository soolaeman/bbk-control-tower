import { NextRequest, NextResponse } from 'next/server';
import {
  getDispatches,
  getDispatchBySjNumber,
  getDispatchByInvoice,
  saveDispatch,
  unlockDispatchAcceptance,
  saveWarranty,
} from '@/lib/repositories/finance-repository';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sjNumber = searchParams.get('sjNumber');
    const invoiceNumber = searchParams.get('invoiceNumber');

    // Public lookup for Driver Smart Link / Acceptance Page
    if (sjNumber) {
      const item = await getDispatchBySjNumber(sjNumber);
      if (!item) return NextResponse.json({ error: 'Dispatch sheet not found' }, { status: 404 });
      return NextResponse.json(item);
    }

    if (invoiceNumber) {
      const item = await getDispatchByInvoice(invoiceNumber);
      return NextResponse.json(item || null);
    }

    // Protected backoffice listing
    const session = await auth();
    if (!session?.user?.role) {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }

    const list = await getDispatches();
    return NextResponse.json(list);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch dispatches' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, dispatch, sjNumber, acceptanceData } = body;

    // Gate 6: Remote Acceptance Unlock (Admin Control Tower)
    if (action === 'UNLOCK') {
      const session = await auth();
      if (!session?.user?.role) {
        return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
      }
      const success = await unlockDispatchAcceptance(sjNumber);
      return NextResponse.json({ success });
    }

    // Driver Dispatch from Pamulang or Smart Link Handover at Cakung
    if (action === 'SAVE' || action === 'DISPATCH') {
      if (!dispatch || !dispatch.sjNumber) {
        return NextResponse.json({ error: 'Invalid dispatch payload' }, { status: 400 });
      }
      await saveDispatch(dispatch);
      return NextResponse.json({ success: true, dispatch });
    }

    // Customer Acceptance at Delivery Location (Sign-on-Glass & Day-0 Garansi)
    if (action === 'ACCEPT') {
      if (!sjNumber || !acceptanceData) {
        return NextResponse.json({ error: 'Missing acceptance data' }, { status: 400 });
      }

      const existing = await getDispatchBySjNumber(sjNumber);
      if (!existing) {
        return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 });
      }

      if (!existing.isUnlockedForAcceptance) {
        return NextResponse.json(
          { error: 'Gate Acceptance masih terkunci oleh Admin BBKitchen' },
          { status: 403 }
        );
      }

      const now = new Date().toISOString();
      const updatedDispatch = {
        ...existing,
        recipientName: acceptanceData.recipientName || existing.recipientNameAllowed,
        recipientSignatureSvg: acceptanceData.signatureSvg,
        arrivalPhotoUrl: acceptanceData.arrivalPhotoUrl,
        deliveredAt: now,
      };

      await saveDispatch(updatedDispatch);

      // Gate 3: Auto-generate E-Warranty Day-0 on Acceptance
      const warrantyNumber = `GAR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      const day14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const day21 = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();

      const newWarranty = {
        id: `war_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        warrantyNumber,
        invoiceNumber: existing.invoiceNumber,
        customerName: updatedDispatch.recipientName || 'Pembeli BBKitchen',
        receivedAt: now,
        warrantyExpiresAt: day14,
        publicExpiresAt: day21,
        status: 'ACTIVE' as const,
        createdAt: now,
        updatedAt: now,
      };

      await saveWarranty(newWarranty).catch((e) =>
        console.warn('Auto warranty creation warning:', e)
      );

      return NextResponse.json({
        success: true,
        dispatch: updatedDispatch,
        warranty: newWarranty,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Dispatch operation failed' }, { status: 500 });
  }
}
