import React from 'react';
import { InvoiceManager } from '@/components/admin/InvoiceManager';

export const metadata = {
  title: 'Invoices & Official Documents | BBKitchen Control Tower',
  description: 'Commercial Invoice Generator, Bank Jago Syariah Pockets, DP & Holding Fee, Dual-Track SOLD BBK, E-POD & E-Warranty.',
};

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <InvoiceManager />
    </div>
  );
}
