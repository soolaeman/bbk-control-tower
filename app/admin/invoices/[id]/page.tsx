import React from 'react';
import { InvoiceManager } from '@/components/admin/InvoiceManager';

export const metadata = {
  title: 'Invoice Detail & Documents | BBKitchen Control Tower',
  description: 'View and manage individual invoice, receipts, surat jalan, and warranty certificates.',
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Document Detail: {id}</h1>
          <p className="text-xs text-slate-400">Official Commercial Transaction Record</p>
        </div>
      </div>
      <InvoiceManager />
    </div>
  );
}
