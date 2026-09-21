import { NextRequest, NextResponse } from 'next/server';
import {
  getInvoices,
  createInvoice,
  updateInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  getFinancialKPIs,
  getLiveClosingDealLedger,
} from '@/lib/repositories/finance-repository';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');
    const session = await auth();
    if (!session?.user?.role) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    const role = session.user.role;
    const permissions = (session.user as any).permissions;
    const canRead =
      role === 'ADMIN' ||
      Boolean(
        permissions?.canViewInvoices ||
        permissions?.canViewOverview ||
        permissions?.canViewFinancials ||
        permissions?.canViewFinanceReports ||
        ['FINANCE', 'OPERATOR', 'INVESTOR', 'SALES_DESK'].includes(role)
      );

    if (!canRead) {
      return NextResponse.json({ error: 'FORBIDDEN: Izin akses diperlukan.' }, { status: 403 });
    }

    if (view === 'ledger') {
      const ledgerData = await getLiveClosingDealLedger();
      return NextResponse.json(ledgerData);
    }

    if (view === 'kpis') {
      const kpis = await getFinancialKPIs();
      return NextResponse.json(kpis);
    }

    const invoices = await getInvoices();
    const ledgerData = await getLiveClosingDealLedger();
    return NextResponse.json({
      invoices,
      deals: ledgerData.deals,
      categoryEconomics: ledgerData.categoryEconomics,
      totalAssetValuation: ledgerData.totalAssetValuation,
      inventorySummary: ledgerData.inventorySummary,
      closingKPIs: ledgerData.kpis,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load invoices' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.role) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    const role = session.user.role;
    const permissions = (session.user as any).permissions;
    const canMutate =
      role === 'ADMIN' ||
      Boolean(
        permissions?.canEditInvoices ||
        permissions?.canManageInvoices ||
        ['FINANCE', 'OPERATOR'].includes(role)
      );

    if (!canMutate) {
      return NextResponse.json({ error: 'FORBIDDEN: Izin Edit Dokumen diperlukan.' }, { status: 403 });
    }

    const body = await request.json();
    const { action, invoice, id, status } = body;

    if (action === 'CREATE') {
      const created = await createInvoice(invoice);
      return NextResponse.json({ success: true, invoice: created });
    }

    if (action === 'UPDATE' || action === 'EDIT') {
      const updated = await updateInvoice(invoice);
      return NextResponse.json({ success: true, invoice: updated });
    }

    if (action === 'UPDATE_STATUS') {
      const updated = await updateInvoiceStatus(id, status);
      return NextResponse.json({ success: updated });
    }

    if (action === 'DELETE') {
      const deleted = await deleteInvoice(id);
      return NextResponse.json({ success: deleted });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Invoice mutation failed' }, { status: 500 });
  }
}
